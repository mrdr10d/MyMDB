import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// The browser calls /api/omdb and /api/mdblist on this server. The proxy forwards
// those calls and injects the API keys from .env, so keys never reach the browser
// bundle (note: no VITE_ prefix on the env vars) and CORS is not an issue.
const proxyTo = (target, basePath, key) => ({
  target,
  changeOrigin: true,
  rewrite: (path) => {
    const url = new URL(path, 'http://localhost')
    url.searchParams.delete('apikey')
    if (key) url.searchParams.set('apikey', key)
    return basePath + url.search
  },
})

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxy = {
    '/api/omdb': proxyTo('https://www.omdbapi.com', '/', env.OMDB_API_KEY),
    '/api/mdblist': proxyTo('https://mdblist.com', '/api/', env.MDBLIST_API_KEY),
    // Watchmode takes its key in a header rather than the query string.
    '/api/watchmode': {
      target: 'https://api.watchmode.com',
      changeOrigin: true,
      headers: env.WATCHMODE_API_KEY ? { 'X-API-Key': env.WATCHMODE_API_KEY } : {},
      rewrite: (path) => path.replace(/^\/api\/watchmode/, '/v1'),
    },
  }
  return {
    plugins: [react()],
    server: { proxy },
    preview: { proxy },
  }
})
