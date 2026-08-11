// Entry point for "Score all jobs on this page" (LinkedIn only). Walks the
// job cards currently rendered in the list (see lib/linkedinJobsList.js),
// scoring each one, and renders a live-updating results panel sorted best
// match first. Jobs already in the score cache (lib/scoreCache.js) are
// used as-is - no click, no API call - with a "Re-score" button to force
// a fresh one.
//
// var, not const: this file gets re-injected into the page each time the
// user clicks the button, and a top-level const would throw a
// duplicate-declaration error on the second injection into the same tab
// (see the same note in lib/genericDetectors.js).

var LISTING_PANEL_ID = "jobfill-listing-panel";

var TIER_RANK = { Strong: 0, Good: 1, Possible: 2, Unclear: 3, Weak: 4 };

// Shared across the initial scoring pass and any later per-row re-score,
// so both read/write the same list and re-render from the same state.
var listingResults = [];

function listingTierColor(tier) {
  return (
    {
      Strong: "#16a34a",
      Good: "#2563eb",
      Possible: "#d97706",
      Weak: "#dc2626",
      Unclear: "#6b7280"
    }[tier] || "#6b7280"
  );
}

function sortedResults(results) {
  return results.slice().sort((a, b) => {
    if (a.error && !b.error) return 1;
    if (b.error && !a.error) return -1;
    if (a.error && b.error) return 0;
    return (TIER_RANK[a.tier] ?? 5) - (TIER_RANK[b.tier] ?? 5);
  });
}

function renderResultRow(entry) {
  if (entry.error) {
    return `
      <div style="padding:8px 0;border-top:1px solid #374151;">
        <div style="font-weight:600;">${escapeHtml(entry.title || "(untitled)")}</div>
        <div style="color:#9ca3af;">${escapeHtml(entry.company || "")}</div>
        <div style="color:#dc2626;margin-top:2px;">Couldn't score: ${escapeHtml(entry.error)}</div>
      </div>`;
  }

  const topGap = (entry.gaps || []).find((g) => g.importance === "must-have") || (entry.gaps || [])[0];
  const gapHtml = topGap ? `<div style="color:#d1d5db;margin-top:2px;">Gap: ${escapeHtml(topGap.requirement)}</div>` : "";

  const scoredDate = entry.scoredAt ? new Date(entry.scoredAt).toLocaleDateString() : "";
  const cachedHtml = entry.cached
    ? `
      <div style="margin-top:2px;color:#9ca3af;">
        Already scored${scoredDate ? " " + escapeHtml(scoredDate) : ""}
        <button type="button" data-rescore-job-id="${escapeHtml(entry.jobId)}" style="margin-left:6px;font-size:11px;padding:2px 8px;border-radius:5px;border:1px solid #374151;background:transparent;color:#9ca3af;cursor:pointer;">Re-score</button>
      </div>`
    : "";

  return `
    <div style="padding:8px 0;border-top:1px solid #374151;">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;">
        <a href="${escapeHtml(entry.url)}" target="_blank" rel="noopener" style="color:#f9fafb;font-weight:600;text-decoration:none;">${escapeHtml(entry.title || "(untitled)")}</a>
        <span style="flex-shrink:0;display:inline-block;padding:1px 8px;border-radius:999px;background:${listingTierColor(entry.tier)};font-size:11px;font-weight:600;">${escapeHtml(entry.tier)}</span>
      </div>
      <div style="color:#9ca3af;">${escapeHtml(entry.company || "")}</div>
      ${gapHtml}
      ${cachedHtml}
    </div>`;
}

function wireRescoreButtons() {
  document.querySelectorAll(`#${LISTING_PANEL_ID} [data-rescore-job-id]`).forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.disabled = true;
      btn.textContent = "Re-scoring…";
      rescoreOne(btn.getAttribute("data-rescore-job-id"));
    });
  });
}

function renderListingPanel(results, progress) {
  const header =
    progress && progress.done < progress.total
      ? `<div style="color:#9ca3af;">Scoring ${progress.done} of ${progress.total}…</div>`
      : `<div style="color:#9ca3af;">${results.length} job${results.length === 1 ? "" : "s"} scored, best match first.</div>`;

  const rowsHtml = sortedResults(results).map(renderResultRow).join("");

  showBanner(
    `
    <div style="font-weight:600;margin-bottom:4px;">Job Match Scores</div>
    ${header}
    <div style="margin-top:4px;">${rowsHtml}</div>
    ${closeButtonHtml(LISTING_PANEL_ID)}
  `,
    LISTING_PANEL_ID
  );
  wireCloseButton(LISTING_PANEL_ID);
  wireRescoreButtons();
}

function renderListingError(message) {
  showBanner(
    `
    <div style="font-weight:600;margin-bottom:4px;">Job Match Scores</div>
    <div>Something went wrong: ${escapeHtml(message)}</div>
    ${closeButtonHtml(LISTING_PANEL_ID)}
  `,
    LISTING_PANEL_ID
  );
  wireCloseButton(LISTING_PANEL_ID);
}

// Forces a fresh score for one job, bypassing the cache, and re-renders in
// place. Used by the per-row "Re-score" button on an already-cached row.
async function rescoreOne(jobId) {
  const idx = listingResults.findIndex((r) => r.jobId === jobId);
  const card = document.querySelector(`li.scaffold-layout__list-item[data-occludable-job-id="${jobId}"]`);

  let entry;
  try {
    if (!card) throw new Error("Couldn't find this job's card on the page anymore - try scrolling near it and re-running.");
    const profile = await loadProfile();
    entry = await scoreLinkedInCardLive(card, profile);
  } catch (err) {
    entry = {
      jobId,
      title: idx >= 0 ? listingResults[idx].title : "",
      company: idx >= 0 ? listingResults[idx].company : "",
      url: linkedInJobUrl(jobId),
      error: err.message
    };
  }

  if (idx >= 0) listingResults[idx] = entry;
  else listingResults.push(entry);

  renderListingPanel(listingResults, { done: listingResults.length, total: listingResults.length });
}

async function runListingScore() {
  if (!isLinkedInJobsListingPage(location.href)) {
    throw new Error("This only works on a LinkedIn jobs search/listing page.");
  }
  const profile = await loadProfile();
  if (!profile.settings.anthropicApiKey) {
    throw new Error("No Anthropic API key set - add one in the extension options.");
  }

  const cards = findLinkedInJobCards();
  if (!cards.length) {
    throw new Error("Couldn't find any job cards on this page - see README if LinkedIn's layout has changed.");
  }

  listingResults = [];
  await scoreAllLinkedInJobs(profile, (done, total, entry) => {
    listingResults.push(entry);
    renderListingPanel(listingResults, { done, total });
  });
  return listingResults;
}

showBanner(
  `
  <div style="font-weight:600;">Job Match Scores</div>
  <div style="margin-top:4px;color:#9ca3af;">Starting…</div>
`,
  LISTING_PANEL_ID
);

runListingScore().catch((err) => renderListingError(err.message));
