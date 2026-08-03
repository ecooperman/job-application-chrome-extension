// Content-script side of the LLM fallback: relays the request to the
// background service worker, which actually calls the Anthropic API
// (kept out of the content script so the fetch isn't subject to the
// host page's CSP).
function draftAnswerViaBackground(question, profileSummary, apiKey) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: "draftAnswer", question, profileSummary, apiKey },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response || !response.ok) {
          reject(new Error((response && response.error) || "Unknown error drafting answer"));
          return;
        }
        resolve(response.answer);
      }
    );
  });
}
