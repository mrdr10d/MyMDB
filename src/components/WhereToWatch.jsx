import { useEffect, useMemo, useState } from 'react'
import { getWhereToWatch } from '../api/watch'

const GROUPS = [
  ['sub', 'Stream'],
  ['free', 'Free (with ads)'],
  ['rent', 'Rent'],
  ['buy', 'Buy'],
  ['tve', 'TV channel app'],
]
const CURRENCY = { US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', IN: 'INR', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', JP: 'JPY' }

const money = (price, region) => {
  if (price == null) return ''
  const currency = CURRENCY[region]
  if (!currency) return String(price)
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(price)
  } catch {
    return String(price)
  }
}

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

// Icon for a streaming service: its site's favicon (via Google's favicon service, keyed only on the
// service's domain), falling back to a coloured initial if there's no link or the icon fails to load.
// Watchmode's own logo CDN is deliberately not used: it is blocked on some corporate networks.
function ServiceIcon({ name, url }) {
  const host = hostOf(url)
  const [failed, setFailed] = useState(false)
  if (host && !failed) {
    return (
      <img
        className="provider-icon"
        src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`}
        alt=""
        width="20"
        height="20"
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    )
  }
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)
  return (
    <span className="provider-icon fallback" style={{ background: `hsl(${hue} 50% 40%)` }} aria-hidden="true">
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

export default function WhereToWatch({ imdbID }) {
  const [state, setState] = useState({ status: 'loading', sources: [], error: null })
  const [region, setRegion] = useState('')

  useEffect(() => {
    const ctrl = new AbortController()
    setState({ status: 'loading', sources: [], error: null })
    getWhereToWatch(imdbID, ctrl.signal).then(
      (sources) => setState({ status: 'done', sources, error: null }),
      (error) => error.name !== 'AbortError' && setState({ status: 'error', sources: [], error }),
    )
    return () => ctrl.abort()
  }, [imdbID])

  const regions = useMemo(() => [...new Set(state.sources.map((s) => s.region))].sort(), [state.sources])

  // Default to the browser's country, then US, then whatever is first.
  useEffect(() => {
    if (!regions.length || regions.includes(region)) return
    const browser = navigator.language?.split('-')[1]?.toUpperCase()
    setRegion(regions.includes(browser) ? browser : regions.includes('US') ? 'US' : regions[0])
  }, [regions, region])

  let body
  if (state.status === 'loading') {
    body = <p className="muted small">Loading…</p>
  } else if (state.error?.code === 'NO_WM_KEY') {
    body = (
      <p className="muted small">
        Add a free Watchmode key as <code>WATCHMODE_API_KEY</code> in <code>.env</code> (get one at{' '}
        <a href="https://api.watchmode.com/" target="_blank" rel="noreferrer">api.watchmode.com</a>) and restart the
        server to see where to watch.
      </p>
    )
  } else if (state.error) {
    body = <p className="muted small">Availability unavailable: {state.error.message}</p>
  } else if (!state.sources.length) {
    body = <p className="muted small">No streaming availability found.</p>
  } else {
    const inRegion = state.sources.filter((s) => s.region === region)
    body = (
      <>
        {regions.length > 1 && (
          <label className="small muted">
            Region{' '}
            <select value={region} onChange={(e) => setRegion(e.target.value)}>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        )}
        {GROUPS.map(([type, label]) => {
          const list = inRegion.filter((s) => s.type === type)
          if (!list.length) return null
          return (
            <div key={type} className="provider-group">
              <span className="muted small">{label}</span>
              <div className="providers">
                {list.map((s) => {
                  const text = `${s.name}${s.price != null ? ` · ${money(s.price, s.region)}` : ''}`
                  const content = (
                    <>
                      <ServiceIcon name={s.name} url={s.url} />
                      {text}
                    </>
                  )
                  return s.url ? (
                    <a key={s.name} className="provider" href={s.url} target="_blank" rel="noreferrer">{content}</a>
                  ) : (
                    <span key={s.name} className="provider">{content}</span>
                  )
                })}
              </div>
            </div>
          )
        })}
        {!inRegion.length && <p className="muted small">Not available in {region}.</p>}
        <p className="muted small">Availability data by Watchmode.</p>
      </>
    )
  }

  return (
    <>
      <h3>Where to watch</h3>
      {body}
    </>
  )
}
