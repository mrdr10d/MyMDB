export default function ErrorNotice({ error }) {
  if (!error) return null

  if (error.code === 'NO_KEY') {
    return (
      <div className="notice" role="alert">
        <strong>OMDb API key missing or invalid.</strong>
        <ol>
          <li>
            Get a free key at{' '}
            <a href="https://www.omdbapi.com/apikey.aspx" target="_blank" rel="noreferrer">omdbapi.com/apikey.aspx</a>{' '}
            (activate it from the email they send).
          </li>
          <li>Copy <code>.env.example</code> to <code>.env</code> and set <code>OMDB_API_KEY=your_key</code>.</li>
          <li>Restart <code>npm run dev</code>.</li>
        </ol>
      </div>
    )
  }

  return (
    <div className="notice" role="alert">
      {error.message || 'Something went wrong.'}
    </div>
  )
}
