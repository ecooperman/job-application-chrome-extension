# Job Application Autofill

A small Chrome extension that fills in job application forms from a profile
you fill out once - name, contact info, work history, EEO answers, and a
bank of pre-written answers to common custom questions ("why do you want to
work here?", etc). For questions that don't match anything in the bank, it
can optionally ask Claude to draft an answer from your work history.

It never submits anything. It only fills fields on the page you're already
looking at, so you can review everything before you hit submit yourself.

## Load it

1. Go to `chrome://extensions`
2. Turn on "Developer mode" (top right)
3. Click "Load unpacked" and select this folder
4. Click the extension icon, then "Edit profile & settings" to fill out your
   profile (personal info, work history, education, and a snippet bank of
   common answers)

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
no background scanning of pages you're just browsing.

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

Your profile (including the API key, if you add one) is stored only in this
browser via `chrome.storage.local` - it's never synced or sent anywhere
except the optional per-question call to Anthropic's API when AI drafting
is enabled. It is **not encrypted at rest**; anyone with access to your
Chrome profile could read it from `chrome://extensions` dev tools.

## Project layout

```
manifest.json       Manifest V3 config
background.js        Service worker - the only thing that calls the Anthropic API
popup/                Toolbar popup ("Fill this page" button)
options/              Profile editor page
content/content.js    Injected on demand; runs the fill pass and shows the on-page summary banner
lib/
  profileSchema.js    Shape of the stored profile
  storage.js          chrome.storage.local read/write helpers
  textUtils.js         Figures out a field's label text
  genericDetectors.js  Label-text -> profile-field regex rules
  sites.js              Per-ATS hostname/root-selector hints
  snippetMatch.js       Keyword matching against your snippet bank
  llmClient.js           Content-script side of the AI fallback (messages background.js)
  fillEngine.js           Orchestrates a fill pass end to end
```

No build step - it's plain JS, loaded straight into Chrome.
