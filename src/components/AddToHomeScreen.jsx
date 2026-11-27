import { useEffect, useState } from 'react'

// Capture Chrome/Android's install prompt as early as possible (module load), because the event
// can fire before React has mounted anything.
let deferredPrompt = null
const listeners = new Set()
const notify = () => listeners.forEach((fn) => fn())
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // stop the mini-infobar; we trigger it from our own button
    deferredPrompt = e
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })
}

function detectPlatform() {
  const ua = navigator.userAgent
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (isIOS) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return null // desktop: no button
}

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

const ShareGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-label="Share" role="img" style={{ verticalAlign: '-3px' }}>
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
  </svg>
)

function Instructions({ platform, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Add to Home Screen" onClick={(e) => e.stopPropagation()}>
        <h2>Add MyMDB to your Home Screen</h2>
        {platform === 'ios' ? (
          <ol>
            <li>Tap the <strong>Share</strong> button <ShareGlyph /> in Safari’s toolbar.</li>
            <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
            <li>Tap <strong>Add</strong>. MyMDB now opens like an app.</li>
          </ol>
        ) : (
          <ol>
            <li>Tap the browser menu <strong>⋮</strong> (top right in Chrome).</li>
            <li>Tap <strong>Add to Home screen</strong> (or <strong>Install app</strong>).</li>
            <li>Confirm. MyMDB now opens like an app.</li>
          </ol>
        )}
        {platform === 'ios' && <p className="muted small">Don’t see it? Open this page in Safari first.</p>}
        {!window.isSecureContext && (
          <p className="muted small">
            This page is served over plain HTTP, so your browser can only add a basic shortcut, not an installable app.
            Hosting it on HTTPS gives the full app experience.
          </p>
        )}
        <button className="btn" onClick={onClose}>Got it</button>
      </div>
    </div>
  )
}

// "Add to Home Screen" button. Only shown on phones/tablets, and not once the app is already installed.
export default function AddToHomeScreen() {
  const [, force] = useState(0)
  const [showHelp, setShowHelp] = useState(false)
  const [platform] = useState(detectPlatform)

  useEffect(() => {
    const update = () => force((n) => n + 1)
    listeners.add(update)
    return () => listeners.delete(update)
  }, [])

  if (!platform || isStandalone()) return null

  async function onClick() {
    if (deferredPrompt) {
      // Android/Chrome: native install dialog.
      deferredPrompt.prompt()
      await deferredPrompt.userChoice.catch(() => {})
      deferredPrompt = null
      notify()
    } else {
      // iOS (no API exists) or Android without a prompt available: show manual steps.
      setShowHelp(true)
    }
  }

  return (
    <>
      <button type="button" className="a2hs" onClick={onClick}>
        <span aria-hidden="true">📲</span> Add to Home Screen
      </button>
      {showHelp && <Instructions platform={platform} onClose={() => setShowHelp(false)} />}
    </>
  )
}
