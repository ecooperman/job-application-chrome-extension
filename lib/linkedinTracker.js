// LinkedIn saved-jobs tracker page (linkedin.com/jobs-tracker/) support.
// This is a completely different UI from the jobs-search listing
// (lib/linkedinJobsList.js): a plain table of saved/applied jobs, no
// in-page detail pane at all - clicking a row title opens the job in a
// brand new tab instead of updating anything in place. So unlike the
// jobs-search list, this file only has to locate each job's URL; the
// actual JD text is fetched by background.js briefly bringing that job's
// own page to the front and reading it there (see fetchJobPageContent in
// background.js) - confirmed necessary by testing: an authenticated
// fetch() of a job's own page returns ~850KB of HTML with no description
// text in it anywhere (LinkedIn renders it client-side after load, not in
// the initial HTML), and a background (non-active) tab never finishes
// rendering the description either, even after a generous wait - it has
// to actually be the visible tab.

function isLinkedInJobsTrackerPage(url) {
  try {
    const u = new URL(url);
    return /(^|\.)linkedin\.com$/.test(u.hostname) && /^\/jobs-tracker\//.test(u.pathname);
  } catch (e) {
    return false;
  }
}

// The tracker table's CSS classes are build-time hashed (e.g. "_36d0853c")
// and not stable enough to select on, unlike the jobs-search list's
// readable BEM classes - so this only relies on the one thing that's
// guaranteed stable: every row links to /jobs/view/<id>/. Each job appears
// twice per row (the title link wrapping the whole row, and a separate
// "Apply" button pointing at the same URL) - keep the first link whose
// text isn't just "Apply" so each job is only scored once.
function findTrackerJobRows() {
  const links = Array.from(document.querySelectorAll("a[href*='/jobs/view/']"));
  const seen = new Set();
  const rows = [];
  for (const a of links) {
    const m = a.href.match(/\/jobs\/view\/(\d+)/);
    if (!m) continue;
    const jobId = m[1];
    if (seen.has(jobId)) continue;
    const text = (a.textContent || "").trim();
    if (!text || text === "Apply") continue;
    seen.add(jobId);
    rows.push({ jobId, url: `https://www.linkedin.com/jobs/view/${jobId}/` });
  }
  return rows;
}
