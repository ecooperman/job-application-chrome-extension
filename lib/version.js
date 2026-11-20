// Version helpers for the "a newer version is available" notice. Loaded by the popup and the options page.
//
// The Jobs app answers every call the extension makes with the newest version posted on its install page (background.js keeps that answer in
// chrome.storage.local under "jobsAppUpdate"). The extension compares it with its own manifest version HERE, rather than trusting a stored
// "update_available" flag, so the banner goes away as soon as the extension is updated, without waiting for another call.

function parseVersion(text) {
  const m = /^\d+(?:\.\d+){0,3}$/.exec(String(text || "").trim());
  return m ? String(text).trim().split(".").map(Number) : null;
}

// True when `latest` is a higher version than `current` (0.10.0 is newer than 0.9.0). Anything that is not a plain dotted version is never "newer".
function isNewerVersion(latest, current) {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

// Reads the stored answer and, if a newer version is out, returns {latest, current, url}; otherwise null.
async function pendingUpdate() {
  try {
    const { jobsAppUpdate } = await chrome.storage.local.get("jobsAppUpdate");
    const current = chrome.runtime.getManifest().version;
    if (jobsAppUpdate && isNewerVersion(jobsAppUpdate.latest, current)) return { latest: jobsAppUpdate.latest, current, url: jobsAppUpdate.url };
  } catch (err) {
    /* no notice */
  }
  return null;
}

// Fills a banner element (a hidden <div> holding nothing) with the notice, or hides it.
function showUpdateBanner(el, update) {
  if (!update) {
    el.classList.add("hidden");
    return;
  }
  el.replaceChildren();
  el.append(`A newer version (${update.latest}) is available; you have ${update.current}. `);
  const link = document.createElement("a");
  link.href = update.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "How to update";
  el.append(link);
  el.classList.remove("hidden");
}
