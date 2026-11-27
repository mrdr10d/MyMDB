import { useEffect, useState } from 'react'
import { getDetails } from '../api/titles'
import ErrorNotice from './ErrorNotice'
import WhereToWatch from './WhereToWatch'

const tone = (score) => (score >= 75 ? 'good' : score >= 50 ? 'mid' : 'bad')
const has = (v) => v && v !== 'N/A'

function RatingCard({ r }) {
  return (
    <div className="rating">
      <span className="rating-label">{r.label}</span>
      <span className="rating-value">{r.display}</span>
      <div className="bar" aria-hidden="true">
        <div className={`bar-fill ${tone(r.score)}`} style={{ width: `${Math.min(100, r.score)}%` }} />
      </div>
      {r.votes && <span className="muted small">{r.votes} votes</span>}
    </div>
  )
}

function Fact({ label, value }) {
  if (!has(value)) return null
  return (
    <p className="fact">
      <span className="muted">{label}: </span>
      {value}
    </p>
  )
}

export default function Details({ imdbID, onClose }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const ctrl = new AbortController()
    setData(null)
    setError(null)
    getDetails(imdbID, ctrl.signal).then(setData, (e) => e.name !== 'AbortError' && setError(e))
    return () => ctrl.abort()
  }, [imdbID])

  // Stop the page behind the modal from scrolling (matters on phones).
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const ratings = data?.ratings ?? []
  const average = ratings.length ? Math.round(ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length) : null

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Title details" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close">×</button>

        {error && <ErrorNotice error={error} />}
        {!data && !error && <p className="muted center">Loading…</p>}

        {data && (
          <div className="detail">
            {has(data.Poster) && <img className="poster" src={data.Poster} alt={`${data.Title} poster`} referrerPolicy="no-referrer" />}

            <div className="detail-main">
              <h2>
                {data.Title} <span className="muted">({data.Year})</span>
              </h2>
              <p className="muted">
                {[data.Rated, data.Runtime, data.Genre, has(data.totalSeasons) && `${data.totalSeasons} seasons`]
                  .filter(has)
                  .join(' · ')}
              </p>

              <h3>Ratings</h3>
              {ratings.length ? (
                <>
                  <div className="ratings">
                    {ratings.map((r) => <RatingCard key={r.key} r={r} />)}
                  </div>
                  {ratings.length > 1 && (
                    <p className="muted small">Average across {ratings.length} sources: <strong>{average}/100</strong></p>
                  )}
                </>
              ) : (
                <p className="muted">No ratings available yet for this title.</p>
              )}

              <WhereToWatch imdbID={data.imdbID} />

              {has(data.Plot) && <p className="plot">{data.Plot}</p>}

              <Fact label="Director" value={data.Director} />
              <Fact label="Writer" value={data.Writer} />
              <Fact label="Cast" value={data.Actors} />
              <Fact label="Released" value={data.Released} />
              <Fact label="Language" value={data.Language} />
              <Fact label="Country" value={data.Country} />
              <Fact label="Awards" value={data.Awards} />
              <Fact label="Box office" value={data.BoxOffice} />

              <p>
                <a href={`https://www.imdb.com/title/${data.imdbID}/`} target="_blank" rel="noreferrer">
                  Open on IMDb ↗
                </a>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
