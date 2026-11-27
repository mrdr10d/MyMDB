// Data layer. Talks to the dev/preview proxy defined in vite.config.js.
//   OMDb    (required): search + details + IMDb / Rotten Tomatoes / Metacritic
//   MDBList (optional): extra ratings (TMDB, Trakt, Letterboxd, RT audience, ...)

export class ApiError extends Error {
  constructor(message, code) {
    super(message)
    this.code = code
  }
}

export async function getJson(url, signal) {
  const res = await fetch(url, { signal })
  // OMDb sends JSON error bodies with 401, so parse before checking res.ok.
  const data = await res.json().catch(() => null)
  if (!data) {
    throw new ApiError(
      'Could not reach the API proxy. Run the app with "npm run dev" or "npm run preview".',
      'NO_PROXY',
    )
  }
  return data
}

function omdbError(message = '') {
  if (/api key/i.test(message)) {
    return new ApiError(message, 'NO_KEY')
  }
  if (/limit/i.test(message)) {
    return new ApiError('Daily OMDb request limit reached (free tier: 1,000/day). Try again tomorrow.', 'LIMIT')
  }
  return new ApiError(message || 'Unknown error from OMDb.', 'OMDB')
}

// ---------- Search ----------

export async function searchTitles({ query, type, page }, signal) {
  const params = new URLSearchParams({ s: query, page: String(page) })
  if (type) params.set('type', type)
  const data = await getJson(`/api/omdb?${params}`, signal)

  if (data.Response === 'False') {
    if (/not found|too many/i.test(data.Error)) return { items: [], total: 0 }
    throw omdbError(data.Error)
  }
  return { items: data.Search, total: Number(data.totalResults) || data.Search.length }
}

// ---------- Details + ratings ----------

const detailCache = new Map()
// MDBList is optional (and may be blocked by a corporate proxy). After the first failure,
// stop asking so a page of results doesn't fire a pile of doomed requests.
let mdblistWorks = true

export async function getDetails(imdbID, signal) {
  if (detailCache.has(imdbID)) return detailCache.get(imdbID)

  const [omdb, mdb] = await Promise.all([
    getJson(`/api/omdb?${new URLSearchParams({ i: imdbID, plot: 'full' })}`, signal),
    // Optional source: never let it break the page.
    mdblistWorks
      ? getJson(`/api/mdblist?${new URLSearchParams({ i: imdbID })}`, signal)
          .then((d) => {
            if (!d.ratings) throw new Error('no ratings')
            return d
          })
          .catch((e) => {
            if (e.name === 'AbortError') throw e
            mdblistWorks = false
            return null
          })
      : null,
  ])

  if (omdb.Response === 'False') throw omdbError(omdb.Error)

  const details = { ...omdb, ratings: mergeRatings(omdb, mdb) }
  detailCache.set(imdbID, details)
  return details
}

// ---------- Rating normalisation ----------
// Every rating becomes { key, label, display, score } where score is 0-100.

const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : null
}

function fromOmdb(omdb) {
  const out = []
  for (const r of omdb.Ratings || []) {
    const v = num(r.Value)
    if (v == null) continue
    if (r.Source === 'Internet Movie Database') {
      out.push({ key: 'imdb', label: 'IMDb', display: `${v}/10`, score: v * 10, votes: omdb.imdbVotes })
    } else if (r.Source === 'Rotten Tomatoes') {
      out.push({ key: 'tomatoes', label: 'Rotten Tomatoes', display: `${v}%`, score: v })
    } else if (r.Source === 'Metacritic') {
      out.push({ key: 'metacritic', label: 'Metacritic', display: `${v}/100`, score: v })
    }
  }
  return out
}

// MDBList source id -> how to label and display it. `score` from MDBList is always 0-100.
const MDB_SOURCES = {
  imdb: { label: 'IMDb', fmt: (s, v) => `${v ?? s / 10}/10` },
  tomatoes: { label: 'Rotten Tomatoes', fmt: (s) => `${s}%` },
  tomatoesaudience: { label: 'RT Audience', fmt: (s) => `${s}%` },
  metacritic: { label: 'Metacritic', fmt: (s) => `${s}/100` },
  metacriticuser: { label: 'Metacritic Users', fmt: (s) => `${s}/100` },
  tmdb: { label: 'TMDB', fmt: (s) => `${s}%` },
  trakt: { label: 'Trakt', fmt: (s) => `${s}%` },
  letterboxd: { label: 'Letterboxd', fmt: (s) => `${(s / 20).toFixed(1)}/5` },
  rogerebert: { label: 'Roger Ebert', fmt: (s) => `${(s / 25).toFixed(1)}/4` },
  myanimelist: { label: 'MyAnimeList', fmt: (s) => `${(s / 10).toFixed(1)}/10` },
}

function fromMdblist(mdb) {
  const out = []
  for (const r of mdb?.ratings || []) {
    const score = num(r.score)
    if (score == null || score <= 0) continue
    const meta = MDB_SOURCES[r.source]
    out.push({
      key: r.source,
      label: meta?.label ?? r.source,
      display: meta ? meta.fmt(Math.round(score), num(r.value)) : `${Math.round(score)}/100`,
      score,
      votes: r.votes ? Number(r.votes).toLocaleString() : undefined,
    })
  }
  return out
}

function mergeRatings(omdb, mdb) {
  const byKey = new Map()
  for (const r of fromOmdb(omdb)) byKey.set(r.key, r)
  // MDBList is refreshed often, so let it win on overlap, but keep OMDb's vote count.
  for (const r of fromMdblist(mdb)) byKey.set(r.key, { ...byKey.get(r.key), ...r, votes: r.votes ?? byKey.get(r.key)?.votes })
  return [...byKey.values()]
}
