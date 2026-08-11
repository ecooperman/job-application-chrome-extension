const SIMPLE_FIELD_IDS = [
  "personal.firstName", "personal.lastName", "personal.currentTitle", "personal.email", "personal.phone",
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
    const sourceTag = snippet.source === "resume-import" ? '<div class="snippet-source-tag">From resume import</div>' : "";
    row.innerHTML = `
      ${sourceTag}
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

async function refreshScoreCount() {
  const entries = await listCachedScores();
  document.getElementById("score-count").textContent = String(entries.length);
  document.getElementById("score-count-plural").textContent = entries.length === 1 ? "" : "s";
  return entries;
}

document.addEventListener("DOMContentLoaded", async () => {
  currentProfile = await loadProfile();
  populateSimpleFields();
  renderWorkHistory();
  renderEducation();
  renderSnippetBank();
  refreshScoreCount();

  document.getElementById("export-csv-btn").addEventListener("click", async () => {
    const exportStatus = document.getElementById("export-status");
    exportStatus.textContent = "";
    try {
      const entries = await refreshScoreCount();
      if (!entries.length) {
        exportStatus.textContent = "No scored jobs yet.";
        return;
      }
      const csv = scoresToCsv(entries);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scored-jobs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoke on the next tick, not synchronously - revoking immediately
      // can race the browser's download handling of the blob: URL and
      // silently no-op the download in some cases.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      exportStatus.textContent = `Downloaded ${entries.length} job${entries.length === 1 ? "" : "s"}.`;
      setTimeout(() => { exportStatus.textContent = ""; }, 3000);
    } catch (err) {
      console.error("CSV export failed:", err);
      exportStatus.textContent = `Export failed: ${err.message}`;
    }
  });

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

  document.getElementById("import-yaml-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    const importStatus = document.getElementById("import-status");
    if (!file) return;
    importStatus.innerHTML = "Importing...";
    try {
      const text = await file.text();
      const { mapped, warnings } = parseResumeYaml(text);
      applyImportToProfile(currentProfile, mapped);
      populateSimpleFields();
      renderWorkHistory();
      renderEducation();
      renderSnippetBank();

      const warningsHtml = warnings.length
        ? `<ul>${warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul>`
        : "";
      importStatus.innerHTML = `<span class="import-ok">Imported ${mapped.workHistory.length} job${mapped.workHistory.length === 1 ? "" : "s"} and ${mapped.education.length} school${mapped.education.length === 1 ? "" : "s"} from "${escapeHtml(file.name)}". Review below, then click "Save profile".</span>${warningsHtml}`;
    } catch (err) {
      importStatus.innerHTML = `<span class="import-error">Import failed: ${escapeHtml(err.message)}</span>`;
    } finally {
      e.target.value = ""; // allow re-importing the same filename later
    }
  });
});
