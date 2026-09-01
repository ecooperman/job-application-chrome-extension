# Job Application Autofill

A small Chrome extension that fills in job application forms from a profile
you fill out once - name, contact info, work history, EEO answers, and a
bank of pre-written answers to common custom questions ("why do you want to
work here?", etc). For questions that don't match anything in the bank, it
can optionally ask Claude to draft an answer from your work history. It can
also score a job posting - or every posting in a LinkedIn list - against
that same profile, so you can triage postings before spending time on them
(see "Scoring job postings" below).

It never submits an application. Filling only ever touches fields on the
page you're already looking at, so you can review everything before you hit
submit yourself.

## Load it

1. Go to `chrome://extensions`
2. Turn on "Developer mode" (top right)
3. Click "Load unpacked" and select this folder
4. Click the extension icon, then "Edit profile & settings" to fill out your
   profile (personal info, work history, education, and a snippet bank of
   common answers) - or use the "Import from resume.yaml" button at the top
   of that page if you keep your resume in that format (see below)

## Use it

On a job application page, click the extension icon and hit "Fill this
page". A summary banner appears in the bottom-right corner of the page
showing what got filled in and from where:

- **Green outline** - filled directly from your profile (name, email,
  address, work authorization, etc.)
- **Blue outline** - filled from a snippet in your snippet bank
- **Orange outline** - drafted by Claude for a question nothing else
  matched. Always read these before submitting.

Fields that already had a value, and fields nothing could confidently match,
are left alone.

It only fills the current tab, and only when you click the button - there's
no background scanning of pages you're just browsing. (One scoring mode is
an exception to "current tab only" - see "Scoring job postings" below.)

## What it won't do

- **Never submits the form.** It only fills fields; you always click submit
  yourself.
- **Never attaches your resume/cover letter.** Browsers block scripts from
  setting file inputs for security, so those stay manual - drag your resume
  in as usual.
- **Won't fully handle Workday's custom dropdown widgets.** Workday often
  uses JS components instead of native `<select>` elements for things like
  location or school pickers; plain text fields on Workday still get filled
  normally.

## AI-drafted answers (optional)

If a question doesn't match anything in your snippet bank, the extension
can ask Claude to draft an answer using your saved work history and
education. This requires an Anthropic API key (get one at
[console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys))
pasted into the options page, with "Enable AI-drafted answers" turned on.
Each draft costs a small, per-call amount on your Anthropic account. You can
leave this off and rely purely on the snippet bank instead.

## Scoring job postings

Two more buttons in the popup, alongside "Fill this page":

- **"Score this job"** - works on any job posting page. Reads the page's
  visible text, sends it to Claude along with your profile background, and
  shows an on-page result: a fit tier (Strong / Good / Possible / Weak /
  Unclear), a one-line rationale, which requirements you clearly match (with
  the specific evidence), which ones you don't (flagged must-have vs.
  nice-to-have based on how the posting itself phrases it - "required" vs.
  "preferred/bonus"), notable strengths beyond what was asked for, and the
  stated salary/comp range if the posting mentions one. Claude is instructed
  to use only what's actually in your saved background, not invent
  experience, and to answer "Unclear" rather than force a confident tier
  when a posting is too vague or truncated to judge.
- **"Score all jobs on this page"** - only appears in the popup on LinkedIn,
  and covers two different LinkedIn UIs:
  - **A jobs search/listing page** (`linkedin.com/jobs/...`) - clicks
    through every job card currently rendered in the left-hand list (this
    does not scroll to load further results, just whatever's already
    rendered), reading the right-hand detail pane LinkedIn updates in place
    for each card. Paced with a deliberate ~900ms delay between jobs, same
    as someone actually clicking through the list, rather than firing
    requests as fast as possible.
  - **The saved-jobs tracker page** (`linkedin.com/jobs-tracker/`) - a
    plain table with no in-page detail pane, so each job's own page has to
    be read directly. `background.js` briefly opens each job's page in a
    new tab, activates it (LinkedIn won't render the description in a
    background tab), reads it, closes it, and restores whatever tab was
    active before - the one place this extension opens, activates, or
    closes tabs on its own, and why the manifest carries the `tabs`
    permission and `https://www.linkedin.com/*` host permission.

  Either way you get a live-updating results panel - sorted best match
  first - as each job finishes scoring, with an inline "Gap" callout per
  row and a link straight to the posting.

Results are cached locally (`lib/scoreCache.js`, one entry per normalized
job URL in `chrome.storage.local`) so revisiting a job, or re-running
"Score all jobs," reuses the cached result instantly with no API call - each
result gets its own "Re-score" button to force a fresh evaluation (useful
after you've updated your profile). The options page shows a running count
of everything scored so far and an "Export as CSV" button to download all of
it (url, title, company, salary, tier, summary, matched requirements, gaps,
strengths, when it was scored, and the raw job description text that was
used).

That CSV is also the import format the `time-management` app's Jobs page
(`/jobs.html` - "Import Jobs from CSV") expects: it upserts by `url`, so
importing after re-scoring or scoring more jobs just refreshes the scoring
fields on jobs it already knows about and adds any new ones, without
touching anything you've tracked there since (application status, notes,
generated resumes, etc.). No reformatting needed - export here, import
there.

Scoring uses the same Anthropic API key as AI-drafted answers above - no
separate key to set up, and nothing gets scored without one.

LinkedIn's markup changes periodically (auto-generated class name suffixes,
occasional layout redesigns). If "Score all jobs on this page" stops finding
job cards or rows, `lib/linkedinJobsList.js` (jobs search page) and
`lib/linkedinTracker.js` (tracker page) are where the selectors live -
everything else about scoring is site-agnostic and shouldn't need to change.

## Importing from resume.yaml

If your resume is a `basics` / `experience` / `education` / `certifications`
/ `skills` YAML file (the shape used by the `resume` project - see
`resume.yaml` there), the options page can import it directly instead of
retyping everything: "Import from resume.yaml" -> pick the file -> review
the fields it filled in -> "Save profile".

Import only ever touches personal info (name, contact, current title,
links), work history, education, certifications, and skills - it never
touches work authorization, EEO answers, salary/notice-period preferences,
your snippet bank (beyond adding one auto-generated snippet, see below), or
your API key. Re-running the import later (e.g. after updating your resume)
overwrites just those resume-derived fields again; everything else is left
as you set it.

A few notes on the mapping:

- Your resume's `summary` becomes both extra background context for the AI
  fallback *and* an auto-added snippet-bank entry (tagged "From resume
  import") that answers generic "tell us about yourself" style questions.
  Re-importing replaces that one snippet rather than duplicating it; any
  other snippets you've written by hand are left alone.
- `certifications` and `skills` don't map to any specific form field, but
  are included in the background sent to Claude for AI-drafted answers.
- Name is split on the first space ("First Last...") - if you have a
  multi-part first or last name, check the result.
- Location (e.g. "Chicago, IL (Remote)") is parsed for city/state with a
  simple "City, ST" pattern; anything it can't confidently split out of is
  left blank rather than guessed, and called out in the import summary.
- Parsing is done client-side with a vendored copy of
  [js-yaml](https://github.com/nodeca/js-yaml) (`lib/vendor/`) - nothing
  about the file leaves your machine.

## How field matching works

`lib/genericDetectors.js` has a list of regex rules that match a field's
label text (from its `<label>`, `aria-label`, placeholder, or name/id) to a
spot in your profile - e.g. anything that looks like "first name" maps to
`personal.firstName`. `lib/sites.js` has a few hostname-based hints for
Greenhouse, Lever, Workday, and LinkedIn Easy Apply, mainly to scope
scanning to the actual application form and avoid touching the rest of the
page. If you run into a site where matching doesn't work well, both files
are short and meant to be extended.

## Data storage

Your profile (including the API key, if you add one) and your scored-jobs
cache are stored only in this browser via `chrome.storage.local` - never
synced or sent anywhere except the calls to Anthropic's API when AI drafting
or scoring is enabled/used. It is **not encrypted at rest**; anyone with
access to your Chrome profile could read it from `chrome://extensions` dev
tools.

## Project layout

```
manifest.json                 Manifest V3 config
background.js                 Service worker - the only thing that calls the Anthropic API,
                               and the only place tabs get opened/activated/closed (tracker scoring)
popup/                        Toolbar popup - "Fill this page", "Score this job",
                               "Score all jobs on this page" (LinkedIn only), "Edit profile & settings"
options/                      Profile editor page (also: resume import, scored-jobs count + CSV export)
content/
  content.js                  Fill entry point - runs a fill pass, shows the on-page summary banner
  scoreContent.js              "Score this job" entry point (any site)
  scoreListingContent.js       "Score all jobs" entry point - LinkedIn jobs search/listing page
  scoreTrackerContent.js       "Score all jobs" entry point - LinkedIn saved-jobs tracker page
lib/
  profileSchema.js            Shape of the stored profile
  storage.js                  chrome.storage.local read/write helpers for the profile
  textUtils.js                 Figures out a field's label text
  genericDetectors.js          Label-text -> profile-field regex rules
  sites.js                      Per-ATS hostname/root-selector hints (fill flow)
  snippetMatch.js               Keyword matching against your snippet bank
  llmClient.js                   Content-script side of the AI calls (messages background.js)
  fillEngine.js                   Orchestrates a fill pass end to end; also buildProfileSummary(),
                                   shared by the AI fallback and every scoring entry point
  banner.js                       Shared on-page banner UI (fill summary, score result, score panels)
  scoreEngine.js                   Builds the job-description text sent for scoring
  scoreCache.js                    Scored-jobs store (chrome.storage.local) + CSV export
  linkedinJobsList.js               Card-list traversal for the LinkedIn jobs search page
  linkedinTracker.js                Row-finding for the LinkedIn jobs-tracker page
  yamlImport.js                     Parses + maps a resume.yaml import (options page only)
  vendor/                           Vendored third-party JS (see vendor/README.md)
```

No build step - it's plain JS, loaded straight into Chrome.
