// Shared JD-scoring helpers used by both the single-page ("Score this
// job") and LinkedIn listing ("Score all jobs on this page") entry points.
// The actual Anthropic call lives in background.js; this file only builds
// the JD text to send it.

var JD_TEXT_MAX_CHARS = 12000; // keeps the request comfortably within a few thousand tokens

function truncateJdText(text) {
  return (text || "").trim().slice(0, JD_TEXT_MAX_CHARS);
}

// Single-page mode: no per-site JD selector, just grab the page's visible
// text and let Claude find the actual posting inside it - reliable enough
// across arbitrary job sites, unlike the fill engine which needs to target
// specific form fields precisely.
function extractPageJdText() {
  return truncateJdText(document.body.innerText || "");
}

function extractElementJdText(el) {
  return truncateJdText(el ? el.innerText || el.textContent || "" : "");
}
