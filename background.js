// Service worker: the only place that talks to the Anthropic API, so the
// API key and the request never touch the job site's own page context.

const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

// Forces a structured evaluation back instead of parsing prose - more
// reliable than scraping a number/JSON blob out of free text, and the
// schema itself encodes the "don't force a percentage, don't invent
// experience" guidance from the prompt.
const SCORE_TOOL = {
  name: "record_match_score",
  description: "Record a structured evaluation of how well a candidate's background matches a job description.",
  input_schema: {
    type: "object",
    properties: {
      tier: {
        type: "string",
        enum: ["Strong", "Good", "Possible", "Weak", "Unclear"],
        description:
          'Overall fit. Use "Unclear" if the job description is too vague, truncated, or generic to judge confidently - don\'t force a confident tier onto a bad read.'
      },
      summary: { type: "string", description: "One or two sentence rationale for the tier." },
      matched: {
        type: "array",
        items: {
          type: "object",
          properties: {
            requirement: { type: "string" },
            evidence: { type: "string" }
          },
          required: ["requirement", "evidence"]
        },
        description: "Requirements from the job description the candidate's background clearly satisfies, each with the specific evidence."
      },
      gaps: {
        type: "array",
        items: {
          type: "object",
          properties: {
            requirement: { type: "string" },
            importance: { type: "string", enum: ["must-have", "nice-to-have"] }
          },
          required: ["requirement", "importance"]
        },
        description:
          'Requirements not clearly backed by the candidate\'s background. Base importance on how the posting itself frames it (explicit "required"/"must have" vs. "preferred"/"nice to have"/"bonus"); when the posting doesn\'t say, default to nice-to-have rather than inflating perceived gaps.'
      },
      strengths: {
        type: "array",
        items: { type: "string" },
        description: "Notable things the candidate has that go beyond what the posting asked for."
      }
    },
    required: ["tier", "summary", "matched", "gaps", "strengths"]
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "draftAnswer") {
    draftAnswer(message.question, message.profileSummary, message.apiKey)
      .then((answer) => sendResponse({ ok: true, answer }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // keep the message channel open for the async response
  }
  if (message.action === "scoreMatch") {
    scoreMatch(message.jdText, message.profileSummary, message.apiKey)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  if (message.action === "scoreTrackerJob") {
    scoreTrackerJob(message.url, message.profileSummary, message.apiKey)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  return false;
});

async function draftAnswer(question, profileSummary, apiKey) {
  if (!apiKey) throw new Error("No Anthropic API key set (add one in the extension options)");

  const prompt = [
    "You are helping a job applicant fill out an application form.",
    "Draft a concise, honest, first-person answer to the application question below, based only on the candidate background provided.",
    "Keep it appropriately brief for a form field - a few sentences, unless the question clearly calls for a longer response.",
    "Do not invent facts, employers, or experience that aren't in the background.",
    "",
    "Candidate background:",
    profileSummary || "(no background provided)",
    "",
    `Question: ${question}`,
    "",
    "Answer:"
  ].join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const answer = data.content && data.content[0] && data.content[0].text;
  return (answer || "").trim();
}

async function scoreMatch(jdText, profileSummary, apiKey) {
  if (!apiKey) throw new Error("No Anthropic API key set (add one in the extension options)");
  if (!jdText || !jdText.trim()) throw new Error("Couldn't find any job description text on this page");

  const prompt = [
    "You are helping a job applicant quickly triage a job posting against their own background.",
    "The job description text below was pulled from a live web page and may have some unrelated navigation or boilerplate text mixed in - focus on the actual posting content.",
    "",
    'First, identify the posting\'s actual requirements, distinguishing explicit must-haves ("required", "must have") from nice-to-haves ("preferred", "bonus", "nice to have") where the posting makes that distinction.',
    "Then compare those requirements against the candidate's background below.",
    "Only use what's actually stated in the candidate's background - never invent experience, skills, or credentials that aren't there.",
    'If the job description is too vague, truncated, or generic to judge confidently, use the "Unclear" tier rather than forcing a confident answer.',
    "",
    "Candidate background:",
    profileSummary || "(no background provided)",
    "",
    "Job description:",
    jdText,
    "",
    "Call record_match_score with your evaluation."
  ].join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1500,
      tools: [SCORE_TOOL],
      tool_choice: { type: "tool", name: "record_match_score" },
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const toolUse = (data.content || []).find((block) => block.type === "tool_use" && block.name === "record_match_score");
  if (!toolUse) throw new Error("Anthropic response didn't include a match score");
  return toolUse.input;
}

// --- LinkedIn jobs-tracker support (linkedin.com/jobs-tracker/) ---
//
// That page has no in-page detail pane (unlike the jobs-search listing),
// so the only way to read a saved job's description is to actually open
// its own page. This is the one place the extension opens/closes tabs -
// requires the "tabs" permission and linkedin.com host_permissions added
// alongside this feature.

const TRACKER_TAB_LOAD_TIMEOUT_MS = 20000;
const TRACKER_EXTRACT_POLL_INTERVAL_MS = 400;
// "Tab finished loading" only means the initial HTML/JS landed, not that
// LinkedIn's client-side rendering has populated the description yet.
// Confirmed live: by the time a job page's networking is "complete", the
// nav chrome plus the top-card (title/company/location) is already in
// document.body.innerText - comfortably past any small length threshold -
// while the actual description is still loading. A raw length check was
// exiting the poll immediately on that nav+title text every time, so
// every job got scored against boilerplate instead of its real
// description (which is exactly why every job was coming back "Unclear").
// Wait for the actual description heading LinkedIn renders once the body
// has loaded instead, with a generous length as a fallback in case some
// posting format ever omits that heading.
const TRACKER_READY_MARKER = "About the job";
const TRACKER_MIN_JD_LENGTH = 3000;

function jobPageLooksReady(jdText) {
  return jdText.includes(TRACKER_READY_MARKER) || jdText.length >= TRACKER_MIN_JD_LENGTH;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForTabComplete(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Tab didn't finish loading in time"));
    }, TRACKER_TAB_LOAD_TIMEOUT_MS);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// Mirrors extractPageJdText() in lib/scoreEngine.js (same truncation
// length) - inlined here rather than injected as a file since this only
// needs a couple lines and runs via chrome.scripting.executeScript's
// func form, which can't reference content-script files.
async function extractJobPageContent(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => ({
      title: document.title || "",
      jdText: (document.body.innerText || "").trim().slice(0, 12000)
    })
  });
  return result;
}

// Opens a LinkedIn job's own page, waits for it to actually render, reads
// it the same way the single-page "Score this job" flow reads any job
// site, and closes the tab again.
//
// active: true, not false - confirmed live that a background (active:
// false) tab never fully renders the description even after a generous
// 20s wait with the "About the job" marker check above: Chrome throttles
// rendering/scripts in tabs that are never the visible one, and/or
// LinkedIn itself defers "expensive" content until the page is actually
// visible. So this briefly activates each job's tab while it loads - the
// browser will visibly flash to each job page for a couple seconds per
// job during a batch run - then restores whatever tab was active before,
// so it doesn't leave the user's browser sitting on the last job scored.
async function fetchJobPageContent(url) {
  const [previouslyActiveTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = await chrome.tabs.create({ url, active: true });
  try {
    await waitForTabComplete(tab.id);
    const start = Date.now();
    let content = await extractJobPageContent(tab.id);
    while (!jobPageLooksReady(content.jdText) && Date.now() - start < TRACKER_TAB_LOAD_TIMEOUT_MS) {
      await sleep(TRACKER_EXTRACT_POLL_INTERVAL_MS);
      content = await extractJobPageContent(tab.id);
    }
    return content;
  } finally {
    chrome.tabs.remove(tab.id).catch(() => {});
    if (previouslyActiveTab && previouslyActiveTab.id !== tab.id) {
      chrome.tabs.update(previouslyActiveTab.id, { active: true }).catch(() => {});
    }
  }
}

async function scoreTrackerJob(url, profileSummary, apiKey) {
  if (!apiKey) throw new Error("No Anthropic API key set (add one in the extension options)");
  const { title, jdText } = await fetchJobPageContent(url);
  const score = await scoreMatch(jdText, profileSummary, apiKey);
  return Object.assign({ title, jdText }, score);
}
