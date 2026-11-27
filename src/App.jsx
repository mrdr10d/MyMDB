import { useEffect, useMemo, useRef, useState } from 'react'
import { getDetails, searchTitles } from './api/titles'
import AddToHomeScreen from './components/AddToHomeScreen'
import SearchBox from './components/SearchBox'
import { FilterIcon } from './components/Icons'
import Results from './components/Results'
import Details from './components/Details'
import ErrorNotice from './components/ErrorNotice'

const TYPES = [
  { value: '', label: 'All' },
  { value: 'movie', label: 'Movies' },
  { value: 'series', label: 'TV Shows' },
]

// needsInfo: requires the per-title details (genre / rating), which cost one OMDb call each.
const SORTS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'year-desc', label: 'Year: newest first' },
  { value: 'year-asc', label: 'Year: oldest first' },
  { value: 'title-asc', label: 'Title: A → Z' },
  { value: 'title-desc', label: 'Title: Z → A' },
  { value: 'rating-desc', label: 'IMDb rating: high → low', needsInfo: true },
  { value: 'genre-asc', label: 'Genre: A → Z', needsInfo: true },
]

const EMPTY = { items: [], total: 0, page: 1, loading: false, error: null, searched: false }

const startYear = (item) => parseInt(item.Year, 10) // "2008–2013" -> 2008
// "2010" -> [2010, 2010]; "2008–2013" -> [2008, 2013]; "2008–" (still running) -> [2008, this year]
function yearRange(item) {
  const [a, b] = String(item.Year).split(/[–-]/)
  const start = parseInt(a, 10)
  if (b === undefined) return [start, start]
  return [start, b.trim() ? parseInt(b, 10) : new Date().getFullYear()]
}
const firstGenre =(d) => (d?.Genre && d.Genre !== 'N/A' ? d.Genre.split(', ')[0] : '')
const imdbScore = (d) => {
  const n = parseFloat(d?.imdbRating)
  return Number.isFinite(n) ? n : null
}

// Sort comparator that always pushes missing values (null/NaN/'') to the end.
function byKey(get, dir) {
  return (a, b) => {
    const x = get(a)
    const y = get(b)
    const xMissing = x == null || x === '' || Number.isNaN(x)
    const yMissing = y == null || y === '' || Number.isNaN(y)
    if (xMissing || yMissing) return xMissing === yMissing ? 0 : xMissing ? 1 : -1
    const cmp = typeof x === 'string' ? x.localeCompare(y) : x - y
    return dir === 'desc' ? -cmp : cmp
  }
}

export default function App() {
  // Optional deep link: /?q=inception starts with that search.
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '')
  const [type, setType] = useState('')
  const [state, setState] = useState(EMPTY)
  const [selected, setSelected] = useState(null)
  const [sort, setSort] = useState('relevance')
  const [genre, setGenre] = useState('')
  const [yearFrom, setYearFrom] = useState('')
  const [yearTo, setYearTo] = useState('')
  const [minRating, setMinRating] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [info, setInfo] = useState({}) // imdbID -> OMDb details, filled by "Load genres & ratings"
  const [enriching, setEnriching] = useState(null) // { done, total } while loading
  const [enrichError, setEnrichError] = useState(null)
  const abortRef = useRef(null)

  async function load(q, t, page) {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const { items, total } = await searchTitles({ query: q, type: t, page }, ctrl.signal)
      setState((s) => {
        const merged = page === 1 ? items : [...s.items, ...items]
        const unique = [...new Map(merged.map((i) => [i.imdbID, i])).values()]
        return { items: unique, total, page, loading: false, error: null, searched: true }
      })
    } catch (e) {
      if (e.name === 'AbortError') return
      setState((s) => ({ ...s, items: page === 1 ? [] : s.items, loading: false, error: e, searched: true }))
    }
  }

  // Debounced search-as-you-type (OMDb free tier is 1,000 requests/day, so don't fire per keystroke).
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      abortRef.current?.abort()
      setState(EMPTY)
      return
    }
    const timer = setTimeout(() => load(q, type, 1), 500)
    return () => clearTimeout(timer)
  }, [query, type])

  // Explicit, opt-in: one OMDb call per title that we don't have details for yet.
  async function loadDetails() {
    const todo = state.items.filter((i) => !info[i.imdbID])
    if (!todo.length) return
    setEnrichError(null)
    setEnriching({ done: 0, total: todo.length })
    await Promise.all(
      todo.map(async (item) => {
        try {
          const d = await getDetails(item.imdbID)
          setInfo((m) => ({ ...m, [item.imdbID]: d }))
        } catch (e) {
          setEnrichError((prev) => prev ?? e)
        } finally {
          setEnriching((p) => p && { ...p, done: p.done + 1 })
        }
      }),
    )
    setEnriching(null)
  }

  const missing = state.items.filter((i) => !info[i.imdbID]).length
  const haveInfo = state.items.length - missing > 0

  const genres = useMemo(() => {
    const set = new Set()
    for (const item of state.items) {
      const g = info[item.imdbID]?.Genre
      if (g && g !== 'N/A') g.split(', ').forEach((x) => set.add(x))
    }
    return [...set].sort()
  }, [state.items, info])

  const visible = useMemo(() => {
    let list = state.items
    if (genre) list = list.filter((i) => info[i.imdbID]?.Genre?.split(', ').includes(genre))
    if (yearFrom || yearTo) {
      const from = yearFrom ? Number(yearFrom) : -Infinity
      const to = yearTo ? Number(yearTo) : Infinity
      list = list.filter((i) => {
        const [s, e] = yearRange(i)
        return !Number.isNaN(s) && e >= from && s <= to // overlaps the range
      })
    }
    if (minRating) list = list.filter((i) => (imdbScore(info[i.imdbID]) ?? -1) >= Number(minRating))
    const sorters = {
      'year-desc': byKey(startYear, 'desc'),
      'year-asc': byKey(startYear, 'asc'),
      'title-asc': byKey((i) => i.Title, 'asc'),
      'title-desc': byKey((i) => i.Title, 'desc'),
      'rating-desc': byKey((i) => imdbScore(info[i.imdbID]), 'desc'),
      'genre-asc': byKey((i) => firstGenre(info[i.imdbID]), 'asc'),
    }
    return sorters[sort] ? [...list].sort(sorters[sort]) : list
  }, [state.items, info, sort, genre, yearFrom, yearTo, minRating])

  const activeFilters = (yearFrom || yearTo ? 1 : 0) + (genre ? 1 : 0) + (minRating ? 1 : 0)
  const clearFilters = () => {
    setYearFrom('')
    setYearTo('')
    setGenre('')
    setMinRating('')
  }

  const hasMore = state.items.length < state.total

  return (
    <div className="app">
      <header className="header">
        <h1>🎬 MyMDB</h1>
        <p>Search movies &amp; TV shows and compare ratings from IMDb, Rotten Tomatoes and more.</p>
        <AddToHomeScreen />
      </header>

      <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); load(query.trim(), type, 1) }}>
        <SearchBox value={query} onChange={setQuery} suggestions={state.items} onPick={(item) => setSelected(item.imdbID)} />
        <div className="tabs" role="group" aria-label="Filter by type">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              className={type === t.value ? 'tab active' : 'tab'}
              aria-pressed={type === t.value}
              onClick={() => setType(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn filter-btn"
          aria-expanded={showFilters}
          aria-controls="filters-panel"
          onClick={() => setShowFilters((v) => !v)}
        >
          <FilterIcon /> Filters {activeFilters > 0 && <span className="badge">{activeFilters}</span>}
        </button>
      </form>

      {showFilters && (
        <div className="filters" id="filters-panel">
          <label>
            Year from
            <input type="number" min="1888" max="2100" placeholder="e.g. 2000" value={yearFrom}
              onChange={(e) => setYearFrom(e.target.value)} />
          </label>
          <label>
            Year to
            <input type="number" min="1888" max="2100" placeholder="e.g. 2020" value={yearTo}
              onChange={(e) => setYearTo(e.target.value)} />
          </label>
          <label>
            Genre
            <select value={genre} onChange={(e) => setGenre(e.target.value)} disabled={!genres.length}>
              <option value="">Any genre</option>
              {genres.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
          <label>
            Min IMDb rating
            <select value={minRating} onChange={(e) => setMinRating(e.target.value)} disabled={!haveInfo}>
              <option value="">Any</option>
              {[9, 8, 7, 6, 5].map((r) => <option key={r} value={r}>{r}+</option>)}
            </select>
          </label>
          {activeFilters > 0 && <button type="button" className="link-btn" onClick={clearFilters}>Clear filters</button>}
          {!haveInfo && (
            <p className="muted small hint">
              Year filtering is free. Genre and rating filters unlock after you click “Load genres &amp; ratings” below
              the search results (one OMDb request per title).
            </p>
          )}
        </div>
      )}

      <main>
        <ErrorNotice error={state.error} />

        {state.items.length > 0 && (
          <div className="toolbar">
            <label>
              Sort by
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value} disabled={s.needsInfo && !haveInfo}>
                    {s.label}
                    {s.needsInfo && !haveInfo ? ' (load details first)' : ''}
                  </option>
                ))}
              </select>
            </label>

            {missing > 0 && (
              <button className="btn" disabled={!!enriching} onClick={loadDetails}
                title="Genre and rating aren't in search results, so this makes one OMDb request per title.">
                {enriching
                  ? `Loading details ${enriching.done}/${enriching.total}…`
                  : `Load genres & ratings (${missing} request${missing === 1 ? '' : 's'})`}
              </button>
            )}
          </div>
        )}
        {state.items.length > 0 && (
          <p className="muted small">
            Sorting applies to the {state.items.length} results loaded so far. Year and title sorting are free;
            genre and rating need one OMDb request per title.
          </p>
        )}
        <ErrorNotice error={enrichError} />

        {state.searched && !state.error && state.items.length === 0 && !state.loading && (
          <p className="muted center">No results for “{query.trim()}”.</p>
        )}
        {state.items.length > 0 && visible.length === 0 && (
          <p className="muted center">
            No loaded titles match these filters.{' '}
            <button type="button" className="link-btn" onClick={clearFilters}>Clear filters</button>
          </p>
        )}

        <Results items={visible} info={info} onSelect={setSelected} />

        {state.loading && <p className="muted center">Loading…</p>}

        {hasMore && !state.loading && (
          <div className="center">
            <button className="btn" onClick={() => load(query.trim(), type, state.page + 1)}>
              Load more ({state.items.length} of {state.total})
            </button>
          </div>
        )}
      </main>

      {selected && <Details imdbID={selected} onClose={() => setSelected(null)} />}

      <footer className="footer">
        Data from <a href="https://www.omdbapi.com/" target="_blank" rel="noreferrer">OMDb</a> and{' '}
        <a href="https://mdblist.com/" target="_blank" rel="noreferrer">MDBList</a>. Not affiliated with IMDb.
      </footer>
    </div>
  )
}
