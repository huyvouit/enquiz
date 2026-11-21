/**
 * After a new deploy, an open tab may ask for a page file that no longer
 * exists (old hash). One reload fetches the new version (launch B1).
 */
const RELOADED_KEY = 'enquiz.chunkReload'

export function isStaleChunk(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /dynamically imported module|Importing a module script failed|Loading chunk/i.test(message)
}

/** Reloads once per tab; false if it already did (avoids a reload loop). */
export function reloadOnce(): boolean {
  try {
    if (sessionStorage.getItem(RELOADED_KEY)) return false
    sessionStorage.setItem(RELOADED_KEY, '1')
  } catch {
    return false
  }
  window.location.reload()
  return true
}

/** A reload the user asked for: always allowed. */
export function reloadNow() {
  try {
    sessionStorage.removeItem(RELOADED_KEY)
  } catch {
    // storage blocked: reload anyway
  }
  window.location.reload()
}

/**
 * Called once the app has run for a while without crashing: the next
 * deploy may then reload this tab once again.
 */
export function forgetChunkReload() {
  setTimeout(() => {
    try {
      sessionStorage.removeItem(RELOADED_KEY)
    } catch {
      // storage blocked: nothing to forget
    }
  }, 15_000)
}
