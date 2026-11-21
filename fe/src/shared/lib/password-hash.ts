/**
 * What the app sends instead of a password (owner's request, v1.1.0):
 * SHA-256("enquiz-pw-v1:" + username + ":" + password) as hex. The server
 * stores bcrypt of it and never sees the password itself. Must stay identical
 * to clientPasswordHash in be/src/common/utils/passwords.ts (same test
 * vectors in be/src/modules/auth/session-cookie.spec.ts).
 *
 * The hash still logs in to EnQuiz: it only keeps the original password
 * hidden from anyone reading decrypted traffic. Needs a secure context
 * (https or localhost) for Web Crypto.
 */
export async function passwordHash(username: string, password: string): Promise<string> {
  // NFC: Vietnamese keyboards on macOS and Windows compose accents differently.
  const text = `enquiz-pw-v1:${username.trim().toLowerCase()}:${password}`.normalize('NFC')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
