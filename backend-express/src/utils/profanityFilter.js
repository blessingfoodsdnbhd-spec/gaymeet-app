// Minimal profanity filter — extend the list as needed.
// Uses word-boundary-aware matching so "class" doesn't flag "ass".
const BANNED = [
  'fuck', 'shit', 'bitch', 'nigger', 'cunt', 'faggot', 'retard',
  'whore', 'slut', 'bastard', 'asshole',
  // Malay profanity
  'puki', 'babi', 'anjing', 'celaka', 'lancau', 'sial',
];

const pattern = new RegExp(
  `\\b(${BANNED.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'gi'
);

/**
 * Returns true if text contains profanity.
 */
function hasProfanity(text) {
  return pattern.test(text);
}

/**
 * Replaces profanity with asterisks.
 */
function censor(text) {
  return text.replace(pattern, (m) => '*'.repeat(m.length));
}

module.exports = { hasProfanity, censor };
