/** Keep in sync with CLASS_MAX_STUDENTS in be/src/modules/classes/schemas/class-room.schema.ts. */
export const CLASS_MAX_STUDENTS = 60

/** Names typed one per line: trimmed, inner spaces collapsed, blanks dropped. */
export function parseNames(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((n) => n.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
}
