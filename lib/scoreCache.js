// Persistent record of every job that's been scored, keyed by a normalized
// job URL. New jobs get added as they're scored; an explicit re-score
// overwrites that job's existing entry. This is both the source for
// "already scored - skip it" behavior in the score entry points, and for
// the CSV export on the options page - one store serves both.
//
// Stored under a single chrome.storage.local key as { [url]: entry }.

var SCORE_CACHE_STORAGE_KEY = "scoreCache";

// LinkedIn (and most job sites) append tracking query params that vary
// per click on the exact same posting - strip query/hash so the same job
// always maps to the same cache key.
function normalizeJobUrl(url) {
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    let path = u.pathname;
    if (!path.endsWith("/")) path += "/";
    return u.origin + path;
  } catch (e) {
    return url;
  }
}

async function loadScoreCache() {
  const stored = await chrome.storage.local.get(SCORE_CACHE_STORAGE_KEY);
  return stored[SCORE_CACHE_STORAGE_KEY] || {};
}

async function saveScoreCache(cache) {
  await chrome.storage.local.set({ [SCORE_CACHE_STORAGE_KEY]: cache });
}

async function getCachedScore(url) {
  if (!url) return null;
  const cache = await loadScoreCache();
  return cache[normalizeJobUrl(url)] || null;
}

// Upserts by normalized URL - a fresh job gets added, re-scoring an
// already-cached job overwrites its entry in place. Returns the saved
// entry (with url/scoredAt filled in) so callers can render it directly.
async function setCachedScore(url, entry) {
  const cache = await loadScoreCache();
  const key = normalizeJobUrl(url);
  cache[key] = Object.assign({}, entry, { url: key, scoredAt: new Date().toISOString() });
  await saveScoreCache(cache);
  return cache[key];
}

async function listCachedScores() {
  const cache = await loadScoreCache();
  return Object.values(cache).sort((a, b) => (b.scoredAt || "").localeCompare(a.scoredAt || ""));
}

function csvEscape(value) {
  const s = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// The API's tool-use schema for record_match_score isn't validated as
// strict, so a cached entry can in principle have e.g. strengths as a bare
// string instead of an array (seen in practice) - coerce defensively
// rather than assuming any cached entry matches the schema shape exactly.
function toArray(v) {
  return Array.isArray(v) ? v : [];
}

// matched/gaps items are normally {requirement, ...} objects, but fall
// back to stringifying the item itself if one ever isn't.
function requirementText(item) {
  if (item && typeof item === "object") return item.requirement || "";
  return item == null ? "" : String(item);
}

function scoresToCsv(entries) {
  const headers = ["url", "title", "company", "tier", "summary", "matched", "gaps", "strengths", "scored_at", "jd_text"];
  const rows = entries.map((e) =>
    [
      e.url,
      e.title,
      e.company,
      e.tier,
      e.summary,
      toArray(e.matched)
        .map(requirementText)
        .join(" | "),
      toArray(e.gaps)
        .map((g) => requirementText(g) + (g && g.importance === "must-have" ? " (must-have)" : ""))
        .join(" | "),
      toArray(e.strengths)
        .map((s) => (s == null ? "" : String(s)))
        .join(" | "),
      e.scoredAt,
      e.jdText
    ]
      .map(csvEscape)
      .join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}
