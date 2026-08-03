// Entry point injected by popup.js. Runs the fill pass and shows an
// on-page summary banner (not the popup, which Chrome can tear down
// before an in-flight AI call finishes).

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = String(s);
  return div.innerHTML;
}

function closeButtonHtml() {
  return '<button id="jobfill-banner-close" style="position:absolute;top:8px;right:10px;background:none;border:none;color:#9ca3af;font-size:16px;cursor:pointer;line-height:1;">×</button>';
}

function wireCloseButton() {
  const btn = document.getElementById("jobfill-banner-close");
  if (btn) {
    btn.addEventListener("click", () => {
      const banner = document.getElementById("jobfill-summary-banner");
      if (banner) banner.remove();
    });
  }
}

function showBanner(html) {
  let banner = document.getElementById("jobfill-summary-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "jobfill-summary-banner";
    banner.style.cssText =
      "position:fixed;bottom:16px;right:16px;z-index:2147483647;max-width:320px;" +
      'background:#111827;color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
      "font-size:13px;line-height:1.5;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,0.35);" +
      "padding:14px 16px;position:fixed;";
    document.body.appendChild(banner);
  }
  banner.innerHTML = html;
}

function renderSummaryBanner(summary) {
  if (summary.error) {
    showBanner(`
      <div style="font-weight:600;margin-bottom:4px;">Job Application Autofill</div>
      <div>Something went wrong: ${escapeHtml(summary.error)}</div>
      ${closeButtonHtml()}
    `);
    wireCloseButton();
    return;
  }

  const rows = [
    ["#16a34a", "Filled from your profile", summary.filled],
    ["#2563eb", "Filled from snippet bank", summary.snippet],
    ["#d97706", "AI-drafted - review these", summary.ai],
    ["#9ca3af", "Left blank", summary.skipped]
  ];
  const rowsHtml = rows
    .map(
      ([color, label, count]) => `
      <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
        <span style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;"></span>
        <span>${label}: <strong>${count}</strong></span>
      </div>`
    )
    .join("");

  const skippedHtml = summary.skippedLabels.length
    ? `<details style="margin-top:8px;">
        <summary style="cursor:pointer;color:#9ca3af;">Skipped fields (${summary.skippedLabels.length})</summary>
        <div style="margin-top:4px;max-height:120px;overflow-y:auto;color:#d1d5db;">
          ${summary.skippedLabels.slice(0, 20).map(escapeHtml).join("<br>")}
        </div>
      </details>`
    : "";

  showBanner(`
    <div style="font-weight:600;margin-bottom:6px;">Job Application Autofill</div>
    ${rowsHtml}
    ${skippedHtml}
    <div style="margin-top:10px;padding-top:8px;border-top:1px solid #374151;color:#fbbf24;font-weight:600;">
      Review everything before you submit.
    </div>
    ${closeButtonHtml()}
  `);
  wireCloseButton();
}

showBanner(`
  <div style="font-weight:600;">Job Application Autofill</div>
  <div style="margin-top:4px;color:#9ca3af;">Filling in the page…</div>
`);

fillPage()
  .then(renderSummaryBanner)
  .catch((err) => renderSummaryBanner({ error: err.message }));
