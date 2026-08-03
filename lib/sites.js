// Per-ATS hints: which hostnames to recognize and which part of the page
// actually holds the application form, so we don't go filling random
// fields elsewhere on the page (e.g. a site header search box).
// Add more entries here as you run into new platforms.
// var (see the comment in genericDetectors.js) - this file is re-injected
// on every "Fill this page" click, and const would throw on redeclaration.
var SITE_MODULES = [
  {
    name: "greenhouse",
    matches: (hostname) => /(^|\.)greenhouse\.io$/.test(hostname),
    rootSelector: "#application_form, .application--form, form"
  },
  {
    name: "lever",
    matches: (hostname) => /(^|\.)lever\.co$/.test(hostname),
    rootSelector: ".application-form, form"
  },
  {
    name: "workday",
    matches: (hostname) => /myworkdayjobs\.com$/.test(hostname),
    rootSelector: "[data-automation-id='jobApplication'], form"
  },
  {
    name: "linkedin",
    matches: (hostname) => /(^|\.)linkedin\.com$/.test(hostname),
    rootSelector: ".jobs-easy-apply-modal, .jobs-easy-apply-content, form"
  }
];

function findSiteModule(hostname) {
  return SITE_MODULES.find((site) => site.matches(hostname)) || null;
}

function resolveRoot(siteModule) {
  if (siteModule) {
    const root = document.querySelector(siteModule.rootSelector);
    if (root) return root;
  }
  return document.body;
}
