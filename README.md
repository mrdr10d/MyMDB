# MyMDB

A lightweight React (Vite) app to search movies and TV shows and see IMDb, Rotten Tomatoes,
Metacritic and (optionally) TMDB / Trakt / Letterboxd / RT-audience ratings in one place.

## Run it

1. Install Node.js LTS (https://nodejs.org, or `winget install OpenJS.NodeJS.LTS`).
2. `npm install`
3. Copy `.env.example` to `.env` and add your free OMDb key (MDBList key is optional).
4. `npm run dev` and open the URL it prints.

### Using it on a phone

The layout is responsive (2-column grid, full-screen detail sheet, touch-sized controls). To open it on a
real phone on the same Wi-Fi, run `npm run dev:mobile` and open the "Network" URL it prints. Note this
exposes the dev server, and so its API-key-injecting proxy, to everyone on that network; stop it when done.
Many corporate Wi-Fi networks isolate devices from each other, in which case this won't connect.
To preview in a desktop browser instead, use the device toolbar in DevTools (F12, Ctrl+Shift+M).

### Add to Home Screen (Android + iOS)

On phones a **Add to Home Screen** button appears under the title (hidden on desktop and once installed).
- **Android / Chrome:** opens the browser's native install dialog.
- **iOS / Safari:** Apple has no install API, so the button shows the steps (Share, then Add to Home Screen).

The pieces are `public/manifest.webmanifest`, the icons in `public/`, `public/sw.js` (a do-nothing service
worker that caches nothing) and `src/components/AddToHomeScreen.jsx`.
**Full "install as app" on Android needs HTTPS** (or localhost). Over plain `http://<laptop-ip>:5173` Chrome only
offers a basic shortcut, and the app shows a note saying so. iOS adds a home-screen icon either way.
The shortcut points at wherever the app is hosted, so for daily use host it somewhere always on.

Behind a corporate proxy that re-signs HTTPS (Zscaler etc.), Node fails with
`unable to get local issuer certificate`. The npm scripts already pass `--use-system-ca` so Node
trusts the Windows certificate store. Some networks also block `mdblist.com`; the app just falls
back to the OMDb ratings (IMDb, Rotten Tomatoes, Metacritic) when that happens.

API keys live in `.env` (no `VITE_` prefix) and are injected by the Vite dev/preview proxy
(`vite.config.js`), so they are never shipped to the browser. `npm run build` + `npm run preview`
also works. For real hosting you need a tiny server or serverless function that does the same
proxying (e.g. Netlify/Vercel function), otherwise the keys would have to be exposed.

## Where the data comes from

| Source | Free tier | Gives you | Notes |
| --- | --- | --- | --- |
| **OMDb** (used, required) | 1,000 req/day, key by email | Search, details, IMDb rating + votes, Rotten Tomatoes %, Metacritic | Easiest way to get IMDb + RT legally |
| **MDBList** (used, optional) | ~1,000 req/day, free account | TMDB, Trakt, Letterboxd, RT audience, Metacritic users, Roger Ebert | One call, many sources. Check their docs for current limits |
| TMDB | Free for non-commercial | Great metadata/posters, TMDB rating only | No IMDb/RT ratings |
| TVMaze | Free, no key | TV shows only, TVMaze rating | No IMDb/RT ratings |
| IMDb official API | Paid (AWS Data Exchange) | Everything | Not free |

## Why not crawl Google?

- Google's Terms of Service prohibit automated scraping of results, and it blocks bots with CAPTCHAs / IP bans.
- Browsers can't do it anyway (CORS), so you'd need your own server, and the "rating cards" markup changes without notice.
- Scraping imdb.com / rottentomatoes.com directly is also against their terms.
- The official Google Custom Search API only returns links/snippets and is limited to 100 free queries/day.

OMDb + MDBList return the same ratings as clean JSON, so they're the better route.
