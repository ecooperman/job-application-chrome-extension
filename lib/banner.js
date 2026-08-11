// Shared on-page banner UI, used by content/content.js and the score entry
// points below. Plain function declarations (not const/let) so this file
// stays safe to inject more than once into the same page - see the note in
// sites.js about var/function vs const for re-injection.
//
// bannerId lets multiple independent banners coexist (fill summary, single
// job score, listing results) without clobbering each other; it defaults
// to the original fill-summary banner's id so existing no-arg callers are
// unaffected.

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = String(s);
  return div.innerHTML;
}

function closeButtonHtml(bannerId) {
  bannerId = bannerId || "jobfill-summary-banner";
  return `<button id="${bannerId}-close" style="position:absolute;top:8px;right:10px;background:none;border:none;color:#9ca3af;font-size:16px;cursor:pointer;line-height:1;">×</button>`;
}

function wireCloseButton(bannerId) {
  bannerId = bannerId || "jobfill-summary-banner";
  const btn = document.getElementById(`${bannerId}-close`);
  if (btn) {
    btn.addEventListener("click", () => {
      const banner = document.getElementById(bannerId);
      if (banner) banner.remove();
    });
  }
}

function showBanner(html, bannerId) {
  bannerId = bannerId || "jobfill-summary-banner";
  let banner = document.getElementById(bannerId);
  if (!banner) {
    banner = document.createElement("div");
    banner.id = bannerId;
    banner.style.cssText =
      "position:fixed;bottom:16px;right:16px;z-index:2147483647;max-width:340px;max-height:80vh;overflow-y:auto;" +
      'background:#111827;color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
      "font-size:13px;line-height:1.5;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,0.35);" +
      "padding:14px 16px;";
    document.body.appendChild(banner);
  }
  banner.innerHTML = html;
}
