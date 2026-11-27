const TYPE_LABEL = { movie: 'Movie', series: 'TV Show', episode: 'Episode', game: 'Game' }
const has = (v) => v && v !== 'N/A'

// `info` holds OMDb details for titles the user chose to load; cards show genre/IMDb when present.
export default function Results({ items, info = {}, onSelect }) {
  if (!items.length) return null
  return (
    <ul className="grid">
      {items.map((item) => {
        const d = info[item.imdbID]
        return (
          <li key={item.imdbID}>
            <button className="card" onClick={() => onSelect(item.imdbID)}>
              {has(item.Poster) ? (
                <img src={item.Poster} alt="" loading="lazy" referrerPolicy="no-referrer" />
              ) : (
                <div className="noposter">No poster</div>
              )}
              <div className="card-body">
                <span className="card-title">{item.Title}</span>
                <span className="muted">
                  {item.Year} · {TYPE_LABEL[item.Type] ?? item.Type}
                </span>
                {d && (has(d.Genre) || has(d.imdbRating)) && (
                  <span className="muted small">
                    {[has(d.Genre) && d.Genre, has(d.imdbRating) && `IMDb ${d.imdbRating}`].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
