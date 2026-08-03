// Matches a custom application question against the user's saved snippet
// bank (see profileSchema.js: snippetBank is [{ keywords, answer }]).

function scoreSnippet(questionText, keywords) {
  if (!keywords || !keywords.length) return 0;
  let hits = 0;
  for (const kw of keywords) {
    if (questionText.includes(kw.toLowerCase().trim())) hits++;
  }
  return hits / keywords.length;
}

function findBestSnippet(snippetBank, questionText) {
  if (!snippetBank || !snippetBank.length || !questionText) return null;
  const MATCH_THRESHOLD = 0.5;
  let best = null;
  let bestScore = 0;
  for (const snippet of snippetBank) {
    const score = scoreSnippet(questionText, snippet.keywords);
    if (score > bestScore) {
      bestScore = score;
      best = snippet;
    }
  }
  return bestScore >= MATCH_THRESHOLD ? best : null;
}
