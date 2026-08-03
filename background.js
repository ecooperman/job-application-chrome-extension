// Service worker: the only place that talks to the Anthropic API, so the
// API key and the request never touch the job site's own page context.

const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action !== "draftAnswer") return false;
  draftAnswer(message.question, message.profileSummary, message.apiKey)
    .then((answer) => sendResponse({ ok: true, answer }))
    .catch((err) => sendResponse({ ok: false, error: err.message }));
  return true; // keep the message channel open for the async response
});

async function draftAnswer(question, profileSummary, apiKey) {
  if (!apiKey) throw new Error("No Anthropic API key set (add one in the extension options)");

  const prompt = [
    "You are helping a job applicant fill out an application form.",
    "Draft a concise, honest, first-person answer to the application question below, based only on the candidate background provided.",
    "Keep it appropriately brief for a form field - a few sentences, unless the question clearly calls for a longer response.",
    "Do not invent facts, employers, or experience that aren't in the background.",
    "",
    "Candidate background:",
    profileSummary || "(no background provided)",
    "",
    `Question: ${question}`,
    "",
    "Answer:"
  ].join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const answer = data.content && data.content[0] && data.content[0].text;
  return (answer || "").trim();
}
