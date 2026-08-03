// Helpers for figuring out what a form field is actually asking for.

function normalizeText(s) {
  return (s || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function humanizeAttr(s) {
  if (!s) return "";
  return s
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_\-.]+/g, " ")
    .replace(/\[\d+\]/g, "")
    .trim();
}

function textFromIds(idList) {
  return idList
    .split(/\s+/)
    .map((id) => document.getElementById(id))
    .filter(Boolean)
    .map((n) => n.textContent)
    .join(" ");
}

// Label text for a single control (an input/select/textarea, or one radio
// in a group) - e.g. "Email", "First Name", or an individual radio option
// like "Yes".
function getLabelText(el) {
  if (el.getAttribute("aria-label")) {
    return normalizeText(el.getAttribute("aria-label"));
  }
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = textFromIds(labelledBy);
    if (text.trim()) return normalizeText(text);
  }
  if (el.id) {
    const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label) return normalizeText(label.textContent);
  }
  const wrappingLabel = el.closest("label");
  if (wrappingLabel) {
    const clone = wrappingLabel.cloneNode(true);
    clone.querySelectorAll("input, select, textarea").forEach((n) => n.remove());
    if (clone.textContent.trim()) return normalizeText(clone.textContent);
  }
  const container = el.closest("div, li, tr, td");
  if (container) {
    const labelLike = container.querySelector("label, .label, [class*='label']");
    if (labelLike && labelLike.textContent.trim()) return normalizeText(labelLike.textContent);
  }
  if (el.placeholder) return normalizeText(el.placeholder);
  return normalizeText(humanizeAttr(el.name || el.id));
}

// The overarching question for a group of radios/checkboxes sharing a
// "name" attribute - e.g. "Are you legally authorized to work in the US?"
function getGroupQuestionText(groupEls) {
  const first = groupEls[0];
  const fieldset = first.closest("fieldset");
  if (fieldset) {
    const legend = fieldset.querySelector("legend");
    if (legend && legend.textContent.trim()) return normalizeText(legend.textContent);
  }
  const roleGroup = first.closest('[role="radiogroup"], [role="group"]');
  if (roleGroup) {
    if (roleGroup.getAttribute("aria-label")) {
      return normalizeText(roleGroup.getAttribute("aria-label"));
    }
    const labelledBy = roleGroup.getAttribute("aria-labelledby");
    if (labelledBy) {
      const text = textFromIds(labelledBy);
      if (text.trim()) return normalizeText(text);
    }
  }
  // Fall back to the nearest ancestor shared by every option in the group,
  // and look for a label-like element that is a direct-ish header of it.
  const container = first.closest("div, li")?.parentElement;
  if (container) {
    const labelLike = container.querySelector(":scope > label, :scope > legend, :scope > [class*='label']");
    if (labelLike && labelLike.textContent.trim()) return normalizeText(labelLike.textContent);
  }
  return "";
}

function looksLikeQuestion(text) {
  if (!text) return false;
  return text.trim().endsWith("?") || text.trim().length > 15;
}
