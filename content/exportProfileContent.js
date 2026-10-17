// Entry point for "Export LinkedIn profile" (LinkedIn profile page only).
// Scrapes the sections defined in lib/linkedinProfile.js and downloads them
// as one JSON file, meant to be uploaded straight into the resume app's
// "Generate a resume.yaml from documents" admin screen.
//
// var, not const - see the note in sites.js about re-injection.

var PROFILE_EXPORT_BANNER_ID = "jobfill-profile-export-banner";

function renderProfileExportError(message) {
  showBanner(
    `
    <div style="font-weight:600;margin-bottom:4px;">LinkedIn Profile Export</div>
    <div>Couldn't export this page: ${escapeHtml(message)}</div>
    ${closeButtonHtml(PROFILE_EXPORT_BANNER_ID)}
  `,
    PROFILE_EXPORT_BANNER_ID
  );
  wireCloseButton(PROFILE_EXPORT_BANNER_ID);
}

function renderProfileExportSuccess(filename, payload) {
  const sections = ["about", "experience", "education", "skills", "certifications", "projects"];
  const emptySections = sections.filter((s) => !payload[s]);
  const warningHtml = emptySections.length
    ? `<div style="color:#d1d5db;margin-top:6px;">
         No content found for: ${escapeHtml(emptySections.join(", "))}. If that section actually has
         content, try expanding any "Show all" links in it and re-exporting.
       </div>`
    : "";
  showBanner(
    `
    <div style="font-weight:600;margin-bottom:4px;">LinkedIn Profile Export</div>
    <div>Downloaded <strong>${escapeHtml(filename)}</strong> - upload it to the resume app's
    "Generate a resume.yaml from documents" screen.</div>
    ${warningHtml}
    ${closeButtonHtml(PROFILE_EXPORT_BANNER_ID)}
  `,
    PROFILE_EXPORT_BANNER_ID
  );
  wireCloseButton(PROFILE_EXPORT_BANNER_ID);
}

function runProfileExport() {
  if (!isLinkedInProfilePage(location.href)) {
    throw new Error("This only works on a LinkedIn profile page (linkedin.com/in/...).");
  }
  const payload = buildLinkedInProfileExport();
  const filename = `linkedin-profile-export-${new Date().toISOString().slice(0, 10)}.json`;
  triggerJsonDownload(filename, payload);
  renderProfileExportSuccess(filename, payload);
}

showBanner(
  `
  <div style="font-weight:600;">LinkedIn Profile Export</div>
  <div style="margin-top:4px;color:#9ca3af;">Exporting…</div>
`,
  PROFILE_EXPORT_BANNER_ID
);

try {
  runProfileExport();
} catch (err) {
  renderProfileExportError(err.message);
}
