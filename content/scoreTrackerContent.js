// Entry point for "Score all jobs on this page" on LinkedIn's saved-jobs
// tracker page (linkedin.com/jobs-tracker/). Mirrors
// content/scoreListingContent.js's shape (live-updating results panel,
// score cache with per-row re-score) but reads rows via
// lib/linkedinTracker.js instead of lib/linkedinJobsList.js, and instead
// of reading an in-page detail pane (this page doesn't have one), each
// miss is scored by asking background.js to briefly bring the job's own
// page to the front, read it, and score it there (see scoreTrackerJob in
// background.js) - kept as its own file rather than sharing code with
// scoreListingContent.js, matching this codebase's existing pattern of
// small self-contained per-entry-point content scripts.
//
// var, not const: this file gets re-injected into the page each time the
// user clicks the button, and a top-level const would throw a
// duplicate-declaration error on the second injection into the same tab
// (see the same note in lib/genericDetectors.js).

var TRACKER_PANEL_ID = "jobfill-tracker-panel";

var TRACKER_TIER_RANK = { Strong: 0, Good: 1, Possible: 2, Unclear: 3, Weak: 4 };

// Shared across the initial scoring pass and any later per-row re-score,
// so both read/write the same list and re-render from the same state.
var trackerResults = [];

// Between finishing one job and starting the next - keeps this reading as
// someone working through their list, not a tight loop, and gives each
// LinkedIn page a moment before the next request lands.
var TRACKER_BETWEEN_JOBS_DELAY_MS = 900;

function trackerTierColor(tier) {
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

function sortedTrackerResults(results) {
  return results.slice().sort((a, b) => {
    if (a.error && !b.error) return 1;
    if (b.error && !a.error) return -1;
    if (a.error && b.error) return 0;
    return (TRACKER_TIER_RANK[a.tier] ?? 5) - (TRACKER_TIER_RANK[b.tier] ?? 5);
  });
}

function renderTrackerResultRow(entry) {
  if (entry.error) {
    return `
      <div style="padding:8px 0;border-top:1px solid #374151;">
        <div style="font-weight:600;">${escapeHtml(entry.title || "(untitled)")}</div>
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
        <button type="button" data-tracker-rescore-job-id="${escapeHtml(entry.jobId)}" style="margin-left:6px;font-size:11px;padding:2px 8px;border-radius:5px;border:1px solid #374151;background:transparent;color:#9ca3af;cursor:pointer;">Re-score</button>
      </div>`
    : "";

  return `
    <div style="padding:8px 0;border-top:1px solid #374151;">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;">
        <a href="${escapeHtml(entry.url)}" target="_blank" rel="noopener" style="color:#f9fafb;font-weight:600;text-decoration:none;">${escapeHtml(entry.title || "(untitled)")}</a>
        <span style="flex-shrink:0;display:inline-block;padding:1px 8px;border-radius:999px;background:${trackerTierColor(entry.tier)};font-size:11px;font-weight:600;">${escapeHtml(entry.tier)}</span>
      </div>
      ${entry.salary ? `<div style="color:#9ca3af;">${escapeHtml(entry.salary)}</div>` : ""}
      ${gapHtml}
      ${cachedHtml}
    </div>`;
}

function wireTrackerRescoreButtons() {
  document.querySelectorAll(`#${TRACKER_PANEL_ID} [data-tracker-rescore-job-id]`).forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.disabled = true;
      btn.textContent = "Re-scoring…";
      rescoreTrackerOne(btn.getAttribute("data-tracker-rescore-job-id"));
    });
  });
}

function renderTrackerPanel(results, progress) {
  const header =
    progress && progress.done < progress.total
      ? `<div style="color:#9ca3af;">Scoring ${progress.done} of ${progress.total} - opening each job's page in the background…</div>`
      : `<div style="color:#9ca3af;">${results.length} job${results.length === 1 ? "" : "s"} scored, best match first.</div>`;

  const rowsHtml = sortedTrackerResults(results).map(renderTrackerResultRow).join("");

  showBanner(
    `
    <div style="font-weight:600;margin-bottom:4px;">Job Match Scores</div>
    ${header}
    <div style="margin-top:4px;">${rowsHtml}</div>
    ${closeButtonHtml(TRACKER_PANEL_ID)}
  `,
    TRACKER_PANEL_ID
  );
  wireCloseButton(TRACKER_PANEL_ID);
  wireTrackerRescoreButtons();
}

function renderTrackerError(message) {
  showBanner(
    `
    <div style="font-weight:600;margin-bottom:4px;">Job Match Scores</div>
    <div>Something went wrong: ${escapeHtml(message)}</div>
    ${closeButtonHtml(TRACKER_PANEL_ID)}
  `,
    TRACKER_PANEL_ID
  );
  wireCloseButton(TRACKER_PANEL_ID);
}

// Does the actual live scoring of one job: asks background.js to briefly
// bring the job's own page to the front, read it, and score it
// (background.js is the only context that can open/close/focus tabs),
// then persists the result to the score cache. Always hits the API - this
// is the "not cached, or the user asked to re-score" path.
async function scoreTrackerJobLive(row, profile) {
  const profileSummary = buildProfileSummary(profile);
  const response = await chrome.runtime.sendMessage({
    action: "scoreTrackerJob",
    url: row.url,
    profileSummary,
    apiKey: profile.settings.anthropicApiKey
  });
  if (!response || !response.ok) throw new Error((response && response.error) || "Scoring failed");
  let entry = Object.assign({ jobId: row.jobId, url: row.url }, response.result);
  entry = await setCachedScore(row.url, entry);
  return entry;
}

// Forces a fresh score for one job, bypassing the cache, and re-renders in
// place. Used by the per-row "Re-score" button on an already-cached row.
async function rescoreTrackerOne(jobId) {
  const idx = trackerResults.findIndex((r) => r.jobId === jobId);
  const row = { jobId, url: `https://www.linkedin.com/jobs/view/${jobId}/` };

  let entry;
  try {
    const profile = await loadProfile();
    entry = await scoreTrackerJobLive(row, profile);
  } catch (err) {
    entry = {
      jobId,
      title: idx >= 0 ? trackerResults[idx].title : "",
      url: row.url,
      error: err.message
    };
  }

  if (idx >= 0) trackerResults[idx] = entry;
  else trackerResults.push(entry);

  renderTrackerPanel(trackerResults, { done: trackerResults.length, total: trackerResults.length });
}

async function runTrackerScore() {
  if (!isLinkedInJobsTrackerPage(location.href)) {
    throw new Error("This only works on a LinkedIn jobs-tracker page.");
  }
  const profile = await loadProfile();
  if (!profile.settings.anthropicApiKey) {
    throw new Error("No Anthropic API key set - add one in the extension options.");
  }

  const rows = findTrackerJobRows();
  if (!rows.length) {
    throw new Error("Couldn't find any saved jobs on this page - see README if LinkedIn's layout has changed.");
  }

  trackerResults = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let entry;
    try {
      const cached = await getCachedScore(row.url);
      if (cached) {
        entry = Object.assign({ jobId: row.jobId }, cached, { cached: true });
      } else {
        entry = await scoreTrackerJobLive(row, profile);
      }
    } catch (err) {
      entry = { jobId: row.jobId, title: "", url: row.url, error: err.message };
    }

    trackerResults.push(entry);
    renderTrackerPanel(trackerResults, { done: i + 1, total: rows.length });
    if (!entry.cached) await new Promise((resolve) => setTimeout(resolve, TRACKER_BETWEEN_JOBS_DELAY_MS));
  }
  return trackerResults;
}

showBanner(
  `
  <div style="font-weight:600;">Job Match Scores</div>
  <div style="margin-top:4px;color:#9ca3af;">Starting…</div>
`,
  TRACKER_PANEL_ID
);

runTrackerScore().catch((err) => renderTrackerError(err.message));
