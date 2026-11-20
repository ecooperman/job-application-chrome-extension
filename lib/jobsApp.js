// "Send to Jobs" mode (settings.scoreMode === "jobs-app"): instead of scoring a posting here with an Anthropic key, capture it and hand it to the
// Jobs app (the resume app's Jobs page), which scores it with the person's own key. The three entry points (single page, jobs-search list,
// saved-jobs tracker) call the helpers below where they would otherwise call scoreMatchViaBackground. background.js does the actual network call
// (callJobsApp), so a job site's own page rules never apply to it.
//
// The score cache keeps a "sent" entry for each job sent (sent: true, tier "Sent") so a list is not re-opened and re-sent every time it is
// scored. A cached entry only counts in the mode that made it: in send mode a locally scored entry is sent again, and in local mode a sent entry
// is scored here (getCachedFor below), so switching modes never leaves a job stuck.

function isSendMode(profile) {
  return Boolean(profile && profile.settings && profile.settings.scoreMode === "jobs-app");
}

// Throws the same sort of message the missing-Anthropic-key check does, before anything is opened or clicked.
function requireJobsAppSettings(profile) {
  if (!profile.settings.jobsAppUrl || !profile.settings.jobsAppToken) {
    throw new Error("Add your Jobs app address and token in the extension options first (Send to Jobs).");
  }
}

function jobsAppMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response || !response.ok) {
        reject(new Error((response && response.error) || "The Jobs app didn't answer"));
        return;
      }
      resolve(response.result);
    });
  });
}

// A LinkedIn job page's tab title reads "Role | Company | LinkedIn" (the saved-jobs tracker and "Score this job" only have that): split it so the
// Jobs list shows the role as the title and the company beside it, not the whole string.
function tidyPosting(posting) {
  const m = /^(.+)\s*\|\s*([^|]+?)\s*\|\s*LinkedIn$/.exec(posting.title || "");
  if (m && !posting.company) return Object.assign({}, posting, { title: m[1].trim(), company: m[2].trim() });
  return posting;
}

// Sends one captured posting ({url, title, company, jdText}) to the Jobs app and returns the cache/display entry for it.
async function sendJobToJobsApp(profile, posting) {
  posting = tidyPosting(posting);
  requireJobsAppSettings(profile);
  if (!posting.jdText || !posting.jdText.trim()) throw new Error("Couldn't find any job description text on this page");
  const result = await jobsAppMessage({
    action: "pushToJobs",
    url: profile.settings.jobsAppUrl,
    token: profile.settings.jobsAppToken,
    postings: [{ url: posting.url, title: posting.title, company: posting.company || "", jd_text: posting.jdText }]
  });
  return sentEntry(posting, result);
}

function sentEntry(posting, result) {
  let summary = result.created ? "Added to your Jobs list." : "Already in your Jobs list.";
  if (result.scoring_blocked) summary += ` Not scored yet: ${result.scoring_blocked}`;
  else if (result.queued) summary += " It is being scored there.";
  return {
    url: posting.url,
    title: posting.title || "",
    company: posting.company || "",
    jdText: posting.jdText,
    tier: "Sent",
    sent: true,
    summary,
    matched: [],
    gaps: [],
    strengths: [],
    salary: ""
  };
}

// The cached entry for this job, if it counts in the current mode (see the note at the top).
async function getCachedFor(url, profile) {
  const cached = await getCachedScore(url);
  if (!cached) return null;
  return Boolean(cached.sent) === isSendMode(profile) ? cached : null;
}
