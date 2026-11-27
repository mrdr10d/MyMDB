import { useEffect, useRef, useState } from 'react'
import { CloseIcon, SearchIcon } from './Icons'

const TYPE_LABEL = { movie: 'Movie', series: 'TV Show', episode: 'Episode', game: 'Game' }
const MAX = 8

// Search input with a typeahead dropdown. Suggestions come from the page's own search results,
// so showing them costs no extra API requests.
export default function SearchBox({ value, onChange, suggestions, onPick }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const boxRef = useRef(null)
  const inputRef = useRef(null)

  const list = suggestions.slice(0, MAX)
  const show = open && value.trim().length >= 2 && list.length > 0

  useEffect(() => setActive(-1), [suggestions])

  useEffect(() => {
    const onDown = (e) => !boxRef.current?.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  function pick(item) {
    setOpen(false)
    onPick(item)
  }

  function onKeyDown(e) {
    if (!show) {
      if (e.key === 'ArrowDown' && list.length) setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % list.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i <= 0 ? list.length : i) - 1)
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault() // otherwise the form would run a normal search instead
      pick(list[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="searchbox" ref={boxRef}>
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search movies & TV shows…"
        aria-label="Search titles"
        role="combobox"
        aria-expanded={show}
        aria-controls="suggestions"
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `suggestion-${active}` : undefined}
        autoComplete="off"
        // Auto-focus only on devices with a real pointer; on phones it would pop the keyboard open on load.
        autoFocus={window.matchMedia?.('(hover: hover)').matches}
      />
      {value && (
        <button
          type="button"
          className="icon-btn clear-btn"
          aria-label="Clear search"
          onClick={() => {
            onChange('')
            inputRef.current?.focus()
          }}
        >
          <CloseIcon />
        </button>
      )}
      <button type="submit" className="icon-btn search-btn" aria-label="Search">
        <SearchIcon />
      </button>
      {show && (
        <ul className="suggestions" id="suggestions" role="listbox">
          {list.map((item, i) => (
            <li
              key={item.imdbID}
              id={`suggestion-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'suggestion active' : 'suggestion'}
              onMouseDown={(e) => e.preventDefault()} // keep input focus so the click isn't swallowed by blur
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(item)}
            >
              <span className="suggestion-title">{item.Title}</span>
              <span className="muted small">
                {item.Year} · {TYPE_LABEL[item.Type] ?? item.Type}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
