// Entry point for "Score this job": scores the current page's job
// description against the stored profile and shows an on-page result
// banner. Mirrors content/content.js's shape (render immediately, replace
// with the real result) but uses its own banner id so it can't collide
// with a fill-summary banner from the same page. Checks the score cache
// (lib/scoreCache.js) first - a cached hit is shown as-is, no API call,
// with a "Re-score" button to force a fresh one.
//
// var, not const: this file gets re-injected into the page each time the
// user clicks "Score this job", and a top-level const would throw a
// duplicate-declaration error on the second injection into the same tab
// (see the same note in lib/genericDetectors.js).

var SCORE_BANNER_ID = "jobfill-score-banner";

var TIER_COLORS = {
  Strong: "#16a34a",
  Good: "#2563eb",
  Possible: "#d97706",
  Weak: "#dc2626",
  Unclear: "#6b7280"
};

function scoreTierColor(tier) {
  return TIER_COLORS[tier] || TIER_COLORS.Unclear;
}

function renderRequirementList(title, items, render) {
  if (!items || !items.length) return "";
  return `
    <div style="margin-top:8px;">
      <strong>${escapeHtml(title)}</strong>
      <ul style="margin:4px 0 0;padding-left:18px;">
        ${items.map(render).join("")}
      </ul>
    </div>`;
}

function wireScoreRescoreButton() {
  const btn = document.getElementById(SCORE_BANNER_ID + "-rescore");
  if (!btn) return;
  btn.addEventListener("click", () => {
    btn.disabled = true;
    btn.textContent = "Re-scoring…";
    loadOrScore(true)
      .then(renderScoreResult)
      .catch((err) => renderScoreResult({ error: err.message }));
  });
}

function renderScoreResult(result) {
  if (result.error) {
    showBanner(
      `
      <div style="font-weight:600;margin-bottom:4px;">Job Match Score</div>
      <div>Something went wrong: ${escapeHtml(result.error)}</div>
      ${closeButtonHtml(SCORE_BANNER_ID)}
    `,
      SCORE_BANNER_ID
    );
    wireCloseButton(SCORE_BANNER_ID);
    return;
  }

  const matchedHtml = renderRequirementList("Matched", result.matched, (m) => `<li>${escapeHtml(m.requirement)}</li>`);
  const gapsHtml = renderRequirementList(
    "Gaps",
    result.gaps,
    (g) => `<li>${escapeHtml(g.requirement)}${g.importance === "must-have" ? " <em>(must-have)</em>" : ""}</li>`
  );
  const strengthsHtml = renderRequirementList("Beyond the ask", result.strengths, (s) => `<li>${escapeHtml(s)}</li>`);
  const salaryHtml = result.salary ? `<div style="margin-top:8px;color:#d1d5db;"><strong>Salary:</strong> ${escapeHtml(result.salary)}</div>` : "";

  const scoredDate = result.scoredAt ? new Date(result.scoredAt).toLocaleDateString() : "";
  const cachedHtml = result.cached
    ? `<div style="margin-top:8px;color:#9ca3af;">Already scored${scoredDate ? " " + escapeHtml(scoredDate) : ""} <button type="button" id="${SCORE_BANNER_ID}-rescore" style="margin-left:4px;font-size:11px;padding:2px 8px;border-radius:5px;border:1px solid #374151;background:transparent;color:#9ca3af;cursor:pointer;">Re-score</button></div>`
    : "";

  showBanner(
    `
    <div style="font-weight:600;margin-bottom:6px;">Job Match Score</div>
    <span style="display:inline-block;padding:2px 10px;border-radius:999px;background:${scoreTierColor(result.tier)};font-weight:600;">${escapeHtml(result.tier)}</span>
    <div style="margin-top:8px;color:#d1d5db;">${escapeHtml(result.summary)}</div>
    ${salaryHtml}
    ${matchedHtml}
    ${gapsHtml}
    ${strengthsHtml}
    ${cachedHtml}
    ${closeButtonHtml(SCORE_BANNER_ID)}
  `,
    SCORE_BANNER_ID
  );
  wireCloseButton(SCORE_BANNER_ID);
  wireScoreRescoreButton();
}

// forceRescore=false checks the cache first (no API key needed for a
// cache hit); true always calls the API and overwrites the cached entry.
async function loadOrScore(forceRescore) {
  if (!forceRescore) {
    const cached = await getCachedScore(location.href);
    if (cached) return Object.assign({}, cached, { cached: true });
  }
  const profile = await loadProfile();
  if (!profile.settings.anthropicApiKey) {
    throw new Error("No Anthropic API key set - add one in the extension options.");
  }
  const jdText = extractPageJdText();
  const profileSummary = buildProfileSummary(profile);
  const score = await scoreMatchViaBackground(jdText, profileSummary, profile.settings.anthropicApiKey);
  const entry = Object.assign({ title: document.title, jdText }, score);
  return setCachedScore(location.href, entry);
}

showBanner(
  `
  <div style="font-weight:600;">Job Match Score</div>
  <div style="margin-top:4px;color:#9ca3af;">Reading the job description…</div>
`,
  SCORE_BANNER_ID
);

loadOrScore(false)
  .then(renderScoreResult)
  .catch((err) => renderScoreResult({ error: err.message }));
