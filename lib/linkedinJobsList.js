// LinkedIn jobs-search listing traversal: click through each job card in
// the left-hand list and read the right-hand detail pane, which LinkedIn
// updates in place (no page navigation) when a card is clicked - so this
// never needs to open a new tab.
//
// Selectors below were checked against the live LinkedIn jobs-search UI,
// not guessed. LinkedIn changes its markup periodically (auto-generated
// class name suffixes, occasional layout redesigns); if "Score all jobs on
// this page" stops finding cards or the detail pane, this file - and only
// this file - is where to look. Re-inspect the live page (right-click a
// job card -> Inspect) and update the selectors below; everything else
// (scoreEngine.js, background.js's scoring call) is site-agnostic and
// shouldn't need to change.

var LINKEDIN_CARD_SELECTOR = "li.scaffold-layout__list-item[data-occludable-job-id]";
var LINKEDIN_CARD_TITLE_LINK_SELECTOR = "a.job-card-list__title--link";
var LINKEDIN_DETAIL_TITLE_SELECTOR = ".job-details-jobs-unified-top-card__job-title";
var LINKEDIN_DETAIL_COMPANY_SELECTOR = ".job-details-jobs-unified-top-card__company-name";
var LINKEDIN_DETAIL_BODY_SELECTOR = "#job-details, .jobs-description__content";
var LINKEDIN_DETAIL_UPDATE_TIMEOUT_MS = 8000;
var LINKEDIN_DETAIL_POLL_INTERVAL_MS = 200;
var LINKEDIN_CARD_RENDER_TIMEOUT_MS = 4000; // LinkedIn virtualizes the list - see waitForLinkedInCardRender
var LINKEDIN_BETWEEN_JOBS_DELAY_MS = 900; // deliberate pause - this should read as a person clicking through a list, not a tight loop

function isLinkedInJobsListingPage(url) {
  try {
    const u = new URL(url);
    return /(^|\.)linkedin\.com$/.test(u.hostname) && /^\/jobs\//.test(u.pathname);
  } catch (e) {
    return false;
  }
}

function findLinkedInJobCards() {
  return Array.from(document.querySelectorAll(LINKEDIN_CARD_SELECTOR));
}

// LinkedIn virtualizes the card list for performance: cards outside the
// range that's been scrolled through are empty placeholder <li>s (no
// children at all, no title link) until scrolled into view, at which point
// a window of nearby cards renders in. Confirmed against the live page -
// scrolling one card into view populates it and several neighbors within a
// couple seconds. Without this, cards past whatever's initially in the
// viewport fail with "couldn't find a clickable title".
async function waitForLinkedInCardRender(cardEl) {
  cardEl.scrollIntoView({ block: "center" });
  const start = Date.now();
  while (Date.now() - start < LINKEDIN_CARD_RENDER_TIMEOUT_MS) {
    if (cardEl.querySelector(LINKEDIN_CARD_TITLE_LINK_SELECTOR)) return true;
    await sleep(LINKEDIN_DETAIL_POLL_INTERVAL_MS);
  }
  return false;
}

// The title link contains both a visible span[aria-hidden="true"] and a
// duplicate .visually-hidden span for screen readers - .textContent on the
// link itself doubles up the text, so pull the visible span specifically.
function getLinkedInCardTitle(cardEl) {
  const link = cardEl.querySelector(LINKEDIN_CARD_TITLE_LINK_SELECTOR);
  if (!link) return "";
  const visible = link.querySelector('span[aria-hidden="true"]');
  if (visible && visible.textContent.trim()) return visible.textContent.trim();
  return (link.textContent || "").trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Polls the detail pane's title rather than using a fixed delay, since
// LinkedIn's update time varies - confirmed ~1s typical, but this doesn't
// bet on that number holding.
async function waitForLinkedInDetailUpdate(expectedTitle) {
  const start = Date.now();
  while (Date.now() - start < LINKEDIN_DETAIL_UPDATE_TIMEOUT_MS) {
    const titleEl = document.querySelector(LINKEDIN_DETAIL_TITLE_SELECTOR);
    const current = titleEl ? titleEl.textContent.trim() : "";
    if (current && current === expectedTitle) return true;
    await sleep(LINKEDIN_DETAIL_POLL_INTERVAL_MS);
  }
  return false;
}

function extractLinkedInDetailPane() {
  const titleEl = document.querySelector(LINKEDIN_DETAIL_TITLE_SELECTOR);
  const companyEl = document.querySelector(LINKEDIN_DETAIL_COMPANY_SELECTOR);
  const bodyEl = document.querySelector(LINKEDIN_DETAIL_BODY_SELECTOR);
  return {
    title: titleEl ? titleEl.textContent.trim() : "",
    company: companyEl ? companyEl.textContent.trim() : "",
    jdText: extractElementJdText(bodyEl)
  };
}

function linkedInJobUrl(jobId) {
  return jobId ? `https://www.linkedin.com/jobs/view/${jobId}/` : "";
}

// Does the actual live scoring of one card: wait for it to render, click
// it, wait for the detail pane, extract, call the API, and persist the
// result to the score cache. Always hits the API - this is the "not
// cached, or the user asked to re-score" path. Also used directly by the
// results panel's per-row "Re-score" button (see content/scoreListingContent.js).
async function scoreLinkedInCardLive(card, profile) {
  const jobId = card.getAttribute("data-occludable-job-id");
  const url = linkedInJobUrl(jobId);
  let entry = { jobId, title: "", company: "", url };

  const rendered = await waitForLinkedInCardRender(card);
  if (!rendered) throw new Error("Card didn't render in time (LinkedIn virtualizes off-screen cards)");

  const cardTitle = getLinkedInCardTitle(card);
  const link = card.querySelector(LINKEDIN_CARD_TITLE_LINK_SELECTOR);
  entry.title = cardTitle;
  if (!link) throw new Error("Couldn't find a clickable title on this card");

  link.click();
  const updated = await waitForLinkedInDetailUpdate(cardTitle);
  if (!updated) throw new Error("Job details didn't load in time");

  const detail = extractLinkedInDetailPane();
  entry.company = detail.company || entry.company;

  const profileSummary = buildProfileSummary(profile);
  const score = await scoreMatchViaBackground(detail.jdText, profileSummary, profile.settings.anthropicApiKey);
  entry = Object.assign(entry, score, { jdText: detail.jdText });

  if (url) entry = await setCachedScore(url, entry);
  return entry;
}

// Walks every job card currently rendered in the list (this does not
// scroll to load further pages/results - whatever's already on the page
// when you click "Score all jobs on this page"). For each: check the
// score cache first - a hit is used as-is, no click, no API call, no
// between-jobs delay (nothing live happened, so there's nothing to look
// human about). A miss falls through to scoreLinkedInCardLive.
//
// onProgress(index, total, entry) fires after each job so the caller can
// render live progress rather than waiting for the whole batch.
async function scoreAllLinkedInJobs(profile, onProgress) {
  const cards = findLinkedInJobCards();
  const results = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const jobId = card.getAttribute("data-occludable-job-id");
    const url = linkedInJobUrl(jobId);
    let entry;

    try {
      const cached = await getCachedScore(url);
      if (cached) {
        entry = Object.assign({ jobId }, cached, { cached: true });
      } else {
        entry = await scoreLinkedInCardLive(card, profile);
      }
    } catch (err) {
      entry = { jobId, title: "", company: "", url, error: err.message };
    }

    results.push(entry);
    if (onProgress) onProgress(i + 1, cards.length, entry);
    if (!entry.cached) await sleep(LINKEDIN_BETWEEN_JOBS_DELAY_MS);
  }

  return results;
}
