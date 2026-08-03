const SIMPLE_FIELD_IDS = [
  "personal.firstName", "personal.lastName", "personal.email", "personal.phone",
  "personal.addressLine1", "personal.addressLine2", "personal.city", "personal.state",
  "personal.zip", "personal.country", "personal.linkedinUrl", "personal.githubUrl",
  "personal.portfolioUrl", "personal.websiteUrl",
  "workAuth.authorizedToWorkUS", "workAuth.requireSponsorship", "workAuth.visaStatus",
  "eeo.gender", "eeo.race", "eeo.hispanicOrLatino", "eeo.veteranStatus", "eeo.disabilityStatus",
  "preferences.desiredSalary", "preferences.noticePeriod", "preferences.earliestStartDate",
  "preferences.willingToRelocate", "preferences.remotePreference",
  "settings.anthropicApiKey"
];

let currentProfile = null;

function getPath(obj, path) {
  return path.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
}

function setPath(obj, path, value) {
  const keys = path.split(".");
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
  cur[keys[keys.length - 1]] = value;
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s == null ? "" : String(s);
  return div.innerHTML;
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

function populateSimpleFields() {
  for (const id of SIMPLE_FIELD_IDS) {
    const el = document.getElementById(id);
    if (el) el.value = getPath(currentProfile, id) || "";
  }
  document.getElementById("settings.llmFallbackEnabled").checked = Boolean(currentProfile.settings.llmFallbackEnabled);
}

function collectSimpleFields() {
  for (const id of SIMPLE_FIELD_IDS) {
    const el = document.getElementById(id);
    if (el) setPath(currentProfile, id, el.value.trim());
  }
  currentProfile.settings.llmFallbackEnabled = document.getElementById("settings.llmFallbackEnabled").checked;
}

function renderWorkHistory() {
  const container = document.getElementById("work-history-list");
  container.innerHTML = "";
  currentProfile.workHistory.forEach((job, i) => {
    const row = document.createElement("div");
    row.className = "list-row";
    row.innerHTML = `
      <div class="list-row-grid">
        <input type="text" placeholder="Company" data-field="company" value="${escapeAttr(job.company)}">
        <input type="text" placeholder="Title" data-field="title" value="${escapeAttr(job.title)}">
        <input type="text" placeholder="Location" data-field="location" value="${escapeAttr(job.location)}">
        <input type="text" placeholder="Start (e.g. Jan 2022)" data-field="startDate" value="${escapeAttr(job.startDate)}">
        <input type="text" placeholder="End (blank if current)" data-field="endDate" value="${escapeAttr(job.endDate)}" ${job.current ? "disabled" : ""}>
        <label class="checkbox-inline"><input type="checkbox" data-field="current" ${job.current ? "checked" : ""}> Current role</label>
      </div>
      <textarea placeholder="Brief description / achievements" data-field="description" rows="2">${escapeHtml(job.description)}</textarea>
      <button type="button" class="remove-btn">Remove</button>
    `;
    row.querySelectorAll("[data-field]").forEach((input) => {
      input.addEventListener("input", () => {
        const field = input.dataset.field;
        currentProfile.workHistory[i][field] = input.type === "checkbox" ? input.checked : input.value;
        if (field === "current") renderWorkHistory();
      });
    });
    row.querySelector(".remove-btn").addEventListener("click", () => {
      currentProfile.workHistory.splice(i, 1);
      renderWorkHistory();
    });
    container.appendChild(row);
  });
}

function renderEducation() {
  const container = document.getElementById("education-list");
  container.innerHTML = "";
  currentProfile.education.forEach((ed, i) => {
    const row = document.createElement("div");
    row.className = "list-row";
    row.innerHTML = `
      <div class="list-row-grid">
        <input type="text" placeholder="School" data-field="school" value="${escapeAttr(ed.school)}">
        <input type="text" placeholder="Degree (e.g. B.S.)" data-field="degree" value="${escapeAttr(ed.degree)}">
        <input type="text" placeholder="Field of study" data-field="field" value="${escapeAttr(ed.field)}">
        <input type="text" placeholder="GPA (optional)" data-field="gpa" value="${escapeAttr(ed.gpa)}">
        <input type="text" placeholder="Start year" data-field="startDate" value="${escapeAttr(ed.startDate)}">
        <input type="text" placeholder="End year" data-field="endDate" value="${escapeAttr(ed.endDate)}">
      </div>
      <button type="button" class="remove-btn">Remove</button>
    `;
    row.querySelectorAll("[data-field]").forEach((input) => {
      input.addEventListener("input", () => {
        currentProfile.education[i][input.dataset.field] = input.value;
      });
    });
    row.querySelector(".remove-btn").addEventListener("click", () => {
      currentProfile.education.splice(i, 1);
      renderEducation();
    });
    container.appendChild(row);
  });
}

function renderSnippetBank() {
  const container = document.getElementById("snippet-list");
  container.innerHTML = "";
  currentProfile.snippetBank.forEach((snippet, i) => {
    const row = document.createElement("div");
    row.className = "list-row";
    row.innerHTML = `
      <input type="text" placeholder="Keywords, comma-separated (e.g. why, interested, company)"
             data-field="keywords" value="${escapeAttr((snippet.keywords || []).join(", "))}">
      <textarea placeholder="Answer to insert when matched" data-field="answer" rows="3">${escapeHtml(snippet.answer)}</textarea>
      <button type="button" class="remove-btn">Remove</button>
    `;
    row.querySelector('[data-field="keywords"]').addEventListener("input", (e) => {
      currentProfile.snippetBank[i].keywords = e.target.value
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    });
    row.querySelector('[data-field="answer"]').addEventListener("input", (e) => {
      currentProfile.snippetBank[i].answer = e.target.value;
    });
    row.querySelector(".remove-btn").addEventListener("click", () => {
      currentProfile.snippetBank.splice(i, 1);
      renderSnippetBank();
    });
    container.appendChild(row);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  currentProfile = await loadProfile();
  populateSimpleFields();
  renderWorkHistory();
  renderEducation();
  renderSnippetBank();

  document.getElementById("add-work-history").addEventListener("click", () => {
    currentProfile.workHistory.push({ company: "", title: "", location: "", startDate: "", endDate: "", current: false, description: "" });
    renderWorkHistory();
  });

  document.getElementById("add-education").addEventListener("click", () => {
    currentProfile.education.push({ school: "", degree: "", field: "", startDate: "", endDate: "", gpa: "" });
    renderEducation();
  });

  document.getElementById("add-snippet").addEventListener("click", () => {
    currentProfile.snippetBank.push({ keywords: [], answer: "" });
    renderSnippetBank();
  });

  document.getElementById("save-btn").addEventListener("click", async () => {
    collectSimpleFields();
    await saveProfile(currentProfile);
    const status = document.getElementById("save-status");
    status.textContent = "Saved.";
    setTimeout(() => { status.textContent = ""; }, 2000);
  });
});
