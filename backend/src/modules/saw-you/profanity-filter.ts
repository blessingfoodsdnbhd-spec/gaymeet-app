/**
 * Lightweight profanity filter.
 *
 * Production recommendation: replace with a proper library such as
 * `bad-words` (npm) or a cloud moderation API.  This blocklist is
 * intentionally minimal — it's a last-resort server-side gate to
 * complement client-side warnings.
 */

const BLOCKLIST: string[] = [
  // Sexual
  'fuck', 'shit', 'ass', 'bitch', 'cunt', 'dick', 'cock', 'pussy',
  'whore', 'slut', 'faggot', 'fag', 'nigger', 'nigga',
  // Violence / threats
  'kill yourself', 'kys', 'rape', 'raped',
  // Spam patterns
  'onlyfans.com', 'telegram.me', 't.me',
];

/**
 * Returns true if the text contains any blocked phrase.
 * Comparison is case-insensitive.
 */
export function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKLIST.some((word) => lower.includes(word));
}
