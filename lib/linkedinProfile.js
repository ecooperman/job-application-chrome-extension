// LinkedIn profile-page export, feeding the resume app's self-service
// resume.yaml generation (see resume/app/generate.py). Unlike
// linkedinTracker.js/linkedinJobsList.js, which parse the DOM into precise
// structured fields because the fill/score engines need exact values, this
// deliberately does NOT try to split each section into title/company/dates
// - LinkedIn's profile DOM uses build-time-hashed classes that change
// often, and any per-field parser here would be the most fragile part of
// the whole feature. Instead this just pulls each section's visible text
// as one block and lets Claude (which already has to do this kind of
// messy-source-material parsing for old-resume uploads anyway - see
// generate.py) structure it server-side. Far more resilient to LinkedIn
// changing its markup, at the cost of a slightly bigger prompt.
//
// var/function, not const/let: re-injected into the page on every export
// click - see the note in sites.js about why.

function isLinkedInProfilePage(url) {
  try {
    const u = new URL(url);
    return /(^|\.)linkedin\.com$/.test(u.hostname) && /^\/in\/[^/]+\/?$/.test(u.pathname);
  } catch (e) {
    return false;
  }
}

// LinkedIn anchors each profile section with an empty `<div id="...">`
// right before the actual `<section>` that holds it, e.g.
// `<div id="experience"></div><section>...</section>`. closest("section")
// walks up from the anchor itself first (in case the id ever moves onto
// the section directly), and getting there via nextElementSibling covers
// the more common current layout where the anchor is a preceding sibling,
// not an ancestor.
function sectionTextById(id) {
  const anchor = document.getElementById(id);
  if (!anchor) return "";
  const section = anchor.closest("section") || anchor.nextElementSibling || anchor.parentElement;
  const text = section ? section.innerText : "";
  return text ? text.trim() : "";
}

// The top card (name/headline/location/etc.) has no id anchor to key off
// of - it's just whatever comes before the first section with an id. Take
// the first <main> section's text minus anything also captured by the
// named sections below, so name/headline/location survive without
// duplicating experience/education text into "topCard" too.
function topCardText() {
  const main = document.querySelector("main");
  if (!main) return "";
  const firstSection = main.querySelector("section");
  return firstSection ? firstSection.innerText.trim() : "";
}

function buildLinkedInProfileExport() {
  return {
    exportedAt: new Date().toISOString(),
    sourceUrl: location.href.split("?")[0],
    topCard: topCardText(),
    about: sectionTextById("about"),
    experience: sectionTextById("experience"),
    education: sectionTextById("education"),
    skills: sectionTextById("skills"),
    certifications: sectionTextById("licenses_and_certifications"),
    projects: sectionTextById("projects")
  };
}

function triggerJsonDownload(filename, obj) {
  const json = JSON.stringify(obj, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
