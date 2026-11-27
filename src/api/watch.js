// "Where to watch" via Watchmode (optional, needs WATCHMODE_API_KEY in .env).
// One request per title (2 credits when looked up by IMDb id); results are cached for the session.
import { ApiError, getJson } from './titles'

const cache = new Map()

export async function getWhereToWatch(imdbID, signal) {
  if (cache.has(imdbID)) return cache.get(imdbID)

  // No `regions` param: Watchmode returns every region enabled for the account's plan.
  const data = await getJson(`/api/watchmode/title/${imdbID}/sources/`, signal)

  if (!Array.isArray(data)) {
    const msg = data.errorMessage || data.message || data.error || 'Watchmode request failed.'
    throw new ApiError(msg, /api.?key/i.test(msg) ? 'NO_WM_KEY' : 'WATCHMODE')
  }

  // Keep one entry per (region, type, service); for rent/buy prefer the cheapest (SD/HD/4K duplicates).
  const best = new Map()
  for (const s of data) {
    const key = `${s.region}|${s.type}|${s.name}`
    const prev = best.get(key)
    if (!prev || (s.price ?? Infinity) < (prev.price ?? Infinity)) {
      best.set(key, { name: s.name, type: s.type, region: s.region, url: s.web_url, price: s.price })
    }
  }
  const sources = [...best.values()]
  cache.set(imdbID, sources)
  return sources
}
