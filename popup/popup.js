const FILL_SCRIPT_FILES = [
  "lib/profileSchema.js",
  "lib/storage.js",
  "lib/textUtils.js",
  "lib/genericDetectors.js",
  "lib/sites.js",
  "lib/snippetMatch.js",
  "lib/llmClient.js",
  "lib/fillEngine.js",
  "lib/banner.js",
  "content/content.js"
];

const SCORE_SCRIPT_FILES = [
  "lib/profileSchema.js",
  "lib/storage.js",
  "lib/fillEngine.js", // only used here for buildProfileSummary()
  "lib/llmClient.js",
  "lib/banner.js",
  "lib/scoreEngine.js",
  "lib/scoreCache.js",
  "lib/jobsApp.js",
  "content/scoreContent.js"
];

const SCORE_LISTING_SCRIPT_FILES = [
  "lib/profileSchema.js",
  "lib/storage.js",
  "lib/fillEngine.js",
  "lib/llmClient.js",
  "lib/banner.js",
  "lib/scoreEngine.js",
  "lib/scoreCache.js",
  "lib/jobsApp.js",
  "lib/linkedinJobsList.js",
  "content/scoreListingContent.js"
];

const SCORE_TRACKER_SCRIPT_FILES = [
  "lib/profileSchema.js",
  "lib/storage.js",
  "lib/fillEngine.js",
  "lib/llmClient.js",
  "lib/banner.js",
  "lib/scoreEngine.js",
  "lib/scoreCache.js",
  "lib/jobsApp.js",
  "lib/linkedinTracker.js",
  "content/scoreTrackerContent.js"
];

const EXPORT_PROFILE_SCRIPT_FILES = ["lib/banner.js", "lib/linkedinProfile.js", "content/exportProfileContent.js"];

// Kept in sync with isLinkedInJobsListingPage() in lib/linkedinJobsList.js -
// duplicated here because that file isn't loaded in the popup's own
// context, only injected into the page.
function looksLikeLinkedInJobsListing(url) {
  try {
    const u = new URL(url);
    return /(^|\.)linkedin\.com$/.test(u.hostname) && /^\/jobs\//.test(u.pathname);
  } catch (e) {
    return false;
  }
}

// Kept in sync with isLinkedInJobsTrackerPage() in lib/linkedinTracker.js -
// same reason as above. Checked separately (and first) from the listing
// check below since /jobs-tracker/ doesn't match /^\/jobs\//.
function looksLikeLinkedInJobsTracker(url) {
  try {
    const u = new URL(url);
    return /(^|\.)linkedin\.com$/.test(u.hostname) && /^\/jobs-tracker\//.test(u.pathname);
  } catch (e) {
    return false;
  }
}

// Kept in sync with isLinkedInProfilePage() in lib/linkedinProfile.js -
// same reason as above.
function looksLikeLinkedInProfile(url) {
  try {
    const u = new URL(url);
    return /(^|\.)linkedin\.com$/.test(u.hostname) && /^\/in\/[^/]+\/?$/.test(u.pathname);
  } catch (e) {
    return false;
  }
}

async function runInActiveTab(files, onDone) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) throw new Error("No active tab");
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files });
  onDone();
}

document.addEventListener("DOMContentLoaded", async () => {
  const fillBtn = document.getElementById("fill-btn");
  const scoreBtn = document.getElementById("score-btn");
  const scoreListingBtn = document.getElementById("score-listing-btn");
  const exportProfileBtn = document.getElementById("export-profile-btn");
  const optionsLink = document.getElementById("options-link");
  const fillStatus = document.getElementById("fill-status");
  const scoreStatus = document.getElementById("score-status");
  const exportProfileStatus = document.getElementById("export-profile-status");

  optionsLink.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  // Feedback goes to the Jobs app's own Send feedback page (at the address set in the options, the default one otherwise).
  document.getElementById("feedback-link").addEventListener("click", async (e) => {
    e.preventDefault();
    let base = "https://jobs.evancooperman.com";
    try {
      const profile = await loadProfile();
      if (profile.settings.jobsAppUrl) base = profile.settings.jobsAppUrl;
    } catch (err) {
      /* the default address */
    }
    chrome.tabs.create({ url: `${base.replace(/\/+$/, "")}/contact.html` });
  });

  // A newer version is out (the Jobs app said so the last time this extension talked to it).
  showUpdateBanner(document.getElementById("update-banner"), await pendingUpdate());

  // In Send to Jobs mode (see lib/jobsApp.js) these buttons send what they read to the Jobs app instead of scoring it here, so say so.
  try {
    const profile = await loadProfile(); // merged with the defaults, so a fresh install (nothing saved yet) gets the default mode too
    if (profile.settings.scoreMode !== "jobs-app") {
      // The original way: score here with an Anthropic key (the buttons and the hint above them are written for sending to the Jobs app).
      scoreBtn.textContent = "Score this job";
      scoreListingBtn.textContent = "Score all jobs on this page";
      document.getElementById("jobs-hint").textContent = "Reads the job posting on this page and scores how well it fits your saved profile, here in the extension.";
    }
  } catch (err) {
    /* the buttons keep their usual labels */
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // Tracker page checked first since /jobs-tracker/ would also need to be
  // excluded from the listing check if order were reversed - keeping both
  // checks independent instead reads clearer.
  let scoreListingFiles = null;
  if (tab && tab.url && looksLikeLinkedInJobsTracker(tab.url)) {
    scoreListingFiles = SCORE_TRACKER_SCRIPT_FILES;
  } else if (tab && tab.url && looksLikeLinkedInJobsListing(tab.url)) {
    scoreListingFiles = SCORE_LISTING_SCRIPT_FILES;
  }
  if (scoreListingFiles) {
    scoreListingBtn.classList.remove("hidden");
  }
  if (tab && tab.url && looksLikeLinkedInProfile(tab.url)) {
    exportProfileBtn.classList.remove("hidden");
  }

  fillBtn.addEventListener("click", async () => {
    fillStatus.textContent = "";
    fillBtn.disabled = true;
    try {
      await runInActiveTab(FILL_SCRIPT_FILES, () => {
        fillStatus.textContent = "Done - check the page for a summary.";
        window.setTimeout(() => window.close(), 900);
      });
    } catch (err) {
      fillStatus.textContent = `Couldn't fill this page: ${err.message}`;
      fillBtn.disabled = false;
    }
  });

  scoreBtn.addEventListener("click", async () => {
    scoreStatus.textContent = "";
    scoreBtn.disabled = true;
    try {
      await runInActiveTab(SCORE_SCRIPT_FILES, () => {
        scoreStatus.textContent = "Done - check the page for the result.";
        window.setTimeout(() => window.close(), 900);
      });
    } catch (err) {
      scoreStatus.textContent = `Couldn't score this page: ${err.message}`;
      scoreBtn.disabled = false;
    }
  });

  scoreListingBtn.addEventListener("click", async () => {
    scoreStatus.textContent = "";
    scoreListingBtn.disabled = true;
    try {
      await runInActiveTab(scoreListingFiles || SCORE_LISTING_SCRIPT_FILES, () => {
        scoreStatus.textContent = "Scoring started - check the page for live progress.";
        window.setTimeout(() => window.close(), 900);
      });
    } catch (err) {
      scoreStatus.textContent = `Couldn't start scoring: ${err.message}`;
      scoreListingBtn.disabled = false;
    }
  });

  exportProfileBtn.addEventListener("click", async () => {
    exportProfileStatus.textContent = "";
    exportProfileBtn.disabled = true;
    try {
      await runInActiveTab(EXPORT_PROFILE_SCRIPT_FILES, () => {
        exportProfileStatus.textContent = "Done - check your downloads.";
        window.setTimeout(() => window.close(), 900);
      });
    } catch (err) {
      exportProfileStatus.textContent = `Couldn't export this page: ${err.message}`;
      exportProfileBtn.disabled = false;
    }
  });
});
