const FILL_SCRIPT_FILES = [
  "lib/profileSchema.js",
  "lib/storage.js",
  "lib/textUtils.js",
  "lib/genericDetectors.js",
  "lib/sites.js",
  "lib/snippetMatch.js",
  "lib/llmClient.js",
  "lib/fillEngine.js",
  "content/content.js"
];

document.addEventListener("DOMContentLoaded", () => {
  const fillBtn = document.getElementById("fill-btn");
  const optionsLink = document.getElementById("options-link");
  const status = document.getElementById("status");

  optionsLink.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  fillBtn.addEventListener("click", async () => {
    status.textContent = "";
    fillBtn.disabled = true;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) throw new Error("No active tab");
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: FILL_SCRIPT_FILES });
      status.textContent = "Done - check the page for a summary.";
      window.setTimeout(() => window.close(), 900);
    } catch (err) {
      status.textContent = `Couldn't fill this page: ${err.message}`;
      fillBtn.disabled = false;
    }
  });
});
