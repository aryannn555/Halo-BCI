/**
 * Lightweight English Language Model for Assistive BCI Text Entry.
 * 
 * Word frequencies derived from Peter Norvig's English Web Corpus frequency list (Public Domain / CC0).
 * Provides character unigram/bigram predictions and prefix-based word suggestions.
 */

// Top English word frequencies (Public Domain / CC0)
export const COMMON_WORDS: string[] = [
  "THE", "BE", "TO", "OF", "AND", "A", "IN", "THAT", "HAVE", "I",
  "IT", "FOR", "NOT", "ON", "WITH", "HE", "AS", "YOU", "DO", "AT",
  "THIS", "BUT", "HIS", "BY", "FROM", "THEY", "WE", "SAY", "HER", "SHE",
  "OR", "AN", "WILL", "MY", "ONE", "ALL", "WOULD", "THERE", "THEIR", "WHAT",
  "SO", "UP", "OUT", "IF", "ABOUT", "WHO", "GET", "WHICH", "GO", "ME",
  "WHEN", "MAKE", "CAN", "LIKE", "TIME", "NO", "JUST", "HIM", "KNOW", "TAKE",
  "PEOPLE", "INTO", "YEAR", "YOUR", "GOOD", "SOME", "COULD", "THEM", "SEE", "OTHER",
  "THAN", "THEN", "NOW", "LOOK", "ONLY", "COME", "ITS", "OVER", "THINK", "ALSO",
  "BACK", "AFTER", "USE", "TWO", "HOW", "OUR", "WORK", "FIRST", "WELL", "WAY",
  "EVEN", "NEW", "WANT", "BECAUSE", "ANY", "THESE", "GIVE", "DAY", "MOST", "US",
  "WATER", "HELP", "PLEASE", "YES", "FOOD", "PAIN", "COLD", "WARM", "TIRED", "NEED",
  "HELLO", "THANKS", "NURSE", "FAMILY", "LIGHTS", "CALL", "DONE", "SLEEP", "REST", "MORE"
];

// Base English letter unigram frequencies (percentages)
export const UNIGRAM_WEIGHTS: Record<string, number> = {
  E: 12.02, T: 9.10, A: 8.12, O: 7.68, I: 7.31, N: 6.95, S: 6.28, R: 6.02, H: 5.92,
  D: 4.32, L: 3.98, U: 2.88, C: 2.71, M: 2.61, F: 2.30, Y: 2.11, W: 2.09, G: 2.03,
  P: 1.82, B: 1.49, V: 1.11, K: 0.69, X: 0.17, Q: 0.11, J: 0.10, Z: 0.07,
  " ": 15.0, // Space is very common
  ".": 3.0,
  BACKSPACE: 4.5,
};

// Common English bigram associations (prior letter -> likely next letters)
export const BIGRAM_ASSOCIATIONS: Record<string, Record<string, number>> = {
  T: { H: 25, O: 12, E: 10, I: 9, A: 7, R: 5, U: 4, " ": 8 },
  H: { E: 30, A: 15, I: 12, O: 10, U: 6, Y: 3, " ": 10 },
  E: { " ": 22, R: 12, N: 9, S: 8, D: 7, A: 6, L: 5, T: 5, M: 4 },
  I: { N: 20, S: 12, T: 10, L: 8, C: 6, G: 5, R: 5, O: 4 },
  A: { N: 15, T: 14, R: 10, S: 9, L: 8, D: 5, C: 4, M: 4 },
  O: { N: 16, U: 14, R: 12, F: 8, W: 7, T: 6, M: 5, " ": 10 },
  N: { " ": 20, D: 14, T: 10, G: 9, S: 6, E: 5, C: 4 },
  S: { T: 16, " ": 18, E: 10, P: 8, H: 8, I: 7, O: 6, A: 5 },
  R: { E: 18, " ": 16, O: 10, A: 8, I: 7, Y: 6, D: 5, T: 4 },
  D: { " ": 28, A: 8, E: 12, O: 8, I: 7, U: 4 },
  L: { E: 15, L: 12, Y: 10, " ": 14, I: 8, A: 7, O: 6 },
  W: { A: 20, E: 18, I: 16, H: 14, O: 12 },
  C: { H: 24, O: 18, A: 14, E: 10, L: 8, I: 8, K: 6 },
  M: { E: 20, A: 18, O: 14, " ": 16, I: 8, P: 6, U: 6 },
  F: { O: 20, " ": 18, I: 12, E: 10, A: 8, R: 8 },
  P: { E: 20, L: 16, A: 14, O: 12, R: 12, I: 8 },
  B: { E: 22, U: 16, A: 14, O: 12, I: 8, L: 8, R: 8 },
  G: { " ": 24, E: 16, O: 14, H: 12, A: 10, R: 8 },
  Y: { " ": 35, O: 15, E: 10, S: 8 },
  U: { R: 20, S: 16, T: 14, N: 12, P: 8, L: 8 },
  V: { E: 45, I: 20, A: 10, O: 8 },
  K: { " ": 30, E: 20, I: 15, S: 10 },
  Q: { U: 80, " ": 5 },
  J: { U: 30, O: 25, A: 20, E: 15 },
  X: { " ": 30, T: 25, P: 15, I: 10 },
  Z: { E: 40, " ": 20, A: 15, O: 10 },
  " ": { T: 15, A: 12, I: 10, W: 8, S: 7, H: 7, B: 6, M: 5, O: 5, F: 4, C: 4, P: 4 },
};

/**
 * Returns top 3 word suggestions matching the current typed prefix.
 */
export function getWordSuggestions(currentText: string): string[] {
  const words = currentText.trim().split(/\s+/);
  const lastWord = (words[words.length - 1] || "").toUpperCase();

  if (!lastWord) {
    // Default contextual assistive words
    return ["YES", "HELP", "WATER"];
  }

  const matches = COMMON_WORDS.filter(
    (w) => w.startsWith(lastWord) && w !== lastWord
  );

  if (matches.length >= 3) {
    return matches.slice(0, 3);
  }

  // Fallback defaults if fewer than 3 prefix matches
  const fallbacks = ["PLEASE", "THANKS", "DONE", "MORE"];
  const combined = Array.from(new Set([...matches, ...fallbacks]));
  return combined.slice(0, 3);
}

/**
 * Computes weight for each character leaf conditioned on text history.
 */
export function getCharacterWeights(currentText: string): Record<string, number> {
  const lastChar = currentText.length > 0 ? currentText[currentText.length - 1].toUpperCase() : " ";
  const bigramMap = BIGRAM_ASSOCIATIONS[lastChar] || {};

  const weights: Record<string, number> = {};

  // Standard alphabet A-Z
  for (let c = 65; c <= 90; c++) {
    const ch = String.fromCharCode(c);
    const unigram = UNIGRAM_WEIGHTS[ch] || 1.0;
    const bigramBoost = bigramMap[ch] ? bigramMap[ch] * 1.5 : 0;
    weights[ch] = Math.max(0.5, unigram + bigramBoost);
  }

  // Space
  const spaceBigram = bigramMap[" "] ? bigramMap[" "] * 1.5 : 0;
  weights[" "] = (UNIGRAM_WEIGHTS[" "] || 12.0) + spaceBigram;

  // Period
  weights["."] = UNIGRAM_WEIGHTS["."] || 3.0;

  // Backspace (always reachable and weighted higher if text is non-empty)
  weights["BACKSPACE"] = currentText.length > 0 ? 8.0 : 1.0;

  return weights;
}
