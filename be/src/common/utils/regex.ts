/** Escapes user input so it can be used literally inside a RegExp. */
export const escapeRegex = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
