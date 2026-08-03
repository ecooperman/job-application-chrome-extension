// Orchestrates one "Fill this page" run: find fields, match them to the
// profile, fill what we're confident about, and leave everything else
// clearly marked. Never touches file inputs or submit/button controls.

var HIGHLIGHT_COLORS = { profile: "#16a34a", snippet: "#2563eb", ai: "#d97706" };
var SKIP_INPUT_TYPES = new Set(["hidden", "submit", "button", "file", "image", "reset"]);
var TEXT_INPUT_TYPES = new Set(["text", "email", "tel", "url", "number", "search", "date", ""]);
var AI_FALLBACK_MAX_CALLS = 8;

function setNativeValue(el, value) {
  const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
  if (descriptor && descriptor.set) {
    descriptor.set.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function isAffirmative(v) {
  return /^(yes|y|true)$/i.test(String(v || "").trim());
}

function isNegative(v) {
  return /^(no|n|false)$/i.test(String(v || "").trim());
}

function optionMatchesValue(optionText, value) {
  const o = normalizeText(optionText);
  const v = normalizeText(value);
  if (!o || !v) return false;
  if (o === v || o.includes(v) || v.includes(o)) return true;
  if (isAffirmative(value) && /^(yes\b|i am\b|i do\b|i have\b)/.test(o)) return true;
  if (isNegative(value) && /^(no\b|i am not\b|i do not\b|i have not\b|i don't\b)/.test(o)) return true;
  return false;
}

function fillSelect(el, value) {
  const option = Array.from(el.options).find((o) => optionMatchesValue(o.textContent, value));
  if (!option) return false;
  el.value = option.value;
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function fillCheckbox(el, value) {
  if (el.checked || !isAffirmative(value)) return false;
  el.click();
  return true;
}

function fillRadioGroup(radios, value) {
  const target = radios.find((r) => optionMatchesValue(getLabelText(r), value));
  if (!target || target.checked) return false;
  target.click();
  return true;
}

function highlight(el, source) {
  el.style.outline = `2px solid ${HIGHLIGHT_COLORS[source] || HIGHLIGHT_COLORS.profile}`;
  el.style.outlineOffset = "1px";
  el.setAttribute("data-jobfill-source", source);
  if (source === "ai") {
    el.title = "AI-drafted answer - review before submitting";
  }
}

function buildProfileSummary(profile) {
  const lines = [];
  lines.push(`Name: ${profile.personal.firstName} ${profile.personal.lastName}`.trim());
  if (profile.workHistory && profile.workHistory.length) {
    lines.push("Work history:");
    for (const job of profile.workHistory) {
      const dates = `${job.startDate || "?"} - ${job.current ? "present" : job.endDate || "?"}`;
      lines.push(`- ${job.title} at ${job.company} (${dates}): ${job.description || ""}`.trim());
    }
  }
  if (profile.education && profile.education.length) {
    lines.push("Education:");
    for (const ed of profile.education) {
      lines.push(`- ${ed.degree} in ${ed.field} from ${ed.school} (${ed.startDate || "?"} - ${ed.endDate || "?"})`.trim());
    }
  }
  return lines.join("\n");
}

function classifyControl(el) {
  const type = (el.type || "").toLowerCase();
  return {
    type,
    isTextLike: el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && TEXT_INPUT_TYPES.has(type)),
    isSelect: el.tagName === "SELECT",
    isCheckbox: type === "checkbox"
  };
}

async function fillPage() {
  const profile = await loadProfile();
  const site = findSiteModule(location.hostname);
  const root = resolveRoot(site);

  const radioGroups = new Map();
  const singleControls = [];

  for (const el of root.querySelectorAll("input, select, textarea")) {
    if (el.disabled) continue;
    const type = (el.type || "").toLowerCase();
    if (SKIP_INPUT_TYPES.has(type)) continue;
    if (type === "radio") {
      const key = el.name || `noname-${el.id}`;
      if (!radioGroups.has(key)) radioGroups.set(key, []);
      radioGroups.get(key).push(el);
    } else {
      singleControls.push(el);
    }
  }

  const summary = { filled: 0, snippet: 0, ai: 0, skipped: 0, skippedLabels: [] };
  const pendingAI = [];

  for (const el of singleControls) {
    const { isTextLike, isSelect, isCheckbox } = classifyControl(el);
    const currentlyFilled = isCheckbox ? el.checked : Boolean(el.value && el.value.trim());
    if (currentlyFilled) continue;

    const labelText = getLabelText(el);
    const rule = matchFieldRule(labelText);

    if (rule) {
      const value = rule.get(profile);
      if (!value) {
        summary.skipped++;
        summary.skippedLabels.push(labelText);
        continue;
      }
      let ok = false;
      if (isSelect) ok = fillSelect(el, value);
      else if (isCheckbox) ok = fillCheckbox(el, value);
      else if (isTextLike) {
        setNativeValue(el, value);
        ok = true;
      }
      if (ok) {
        highlight(el, "profile");
        summary.filled++;
      } else {
        summary.skipped++;
        summary.skippedLabels.push(labelText);
      }
      continue;
    }

    const isCustomQuestionCandidate = isTextLike && (el.tagName === "TEXTAREA" || labelText.length > 25) && looksLikeQuestion(labelText);
    if (!isCustomQuestionCandidate) continue;

    const snippet = findBestSnippet(profile.snippetBank, labelText);
    if (snippet) {
      setNativeValue(el, snippet.answer);
      highlight(el, "snippet");
      summary.snippet++;
    } else if (profile.settings.llmFallbackEnabled && profile.settings.anthropicApiKey) {
      pendingAI.push({ el, question: labelText });
    } else {
      summary.skipped++;
      summary.skippedLabels.push(labelText);
    }
  }

  for (const radios of radioGroups.values()) {
    if (radios.some((r) => r.checked)) continue;
    const questionText = getGroupQuestionText(radios);
    const rule = matchFieldRule(questionText);
    if (!rule) continue;
    const value = rule.get(profile);
    if (!value) {
      summary.skipped++;
      summary.skippedLabels.push(questionText);
      continue;
    }
    if (fillRadioGroup(radios, value)) {
      radios.forEach((r) => highlight(r, "profile"));
      summary.filled++;
    } else {
      summary.skipped++;
      summary.skippedLabels.push(questionText);
    }
  }

  if (pendingAI.length) {
    const profileSummary = buildProfileSummary(profile);
    for (const item of pendingAI.slice(0, AI_FALLBACK_MAX_CALLS)) {
      try {
        const answer = await draftAnswerViaBackground(item.question, profileSummary, profile.settings.anthropicApiKey);
        if (answer) {
          setNativeValue(item.el, answer);
          highlight(item.el, "ai");
          summary.ai++;
        } else {
          summary.skipped++;
          summary.skippedLabels.push(item.question);
        }
      } catch (err) {
        summary.skipped++;
        summary.skippedLabels.push(`${item.question} (${err.message})`);
      }
    }
  }

  return summary;
}
