// Imports the `basics` / `experience` / `education` / `certifications` /
// `skills` shape used by the resume.yaml in the sibling "resume" project
// (see ~/code/personal-projects/resume/resume.yaml). Only pulls in
// resume-derived data - work authorization, EEO, preferences, snippet
// bank, and the API key are never touched by an import.

function splitName(fullName) {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "", warning: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: "", warning: null };
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");
  const warning = parts.length > 2 ? `Split "${fullName}" into first name "${firstName}" and last name "${lastName}" - double-check this.` : null;
  return { firstName, lastName, warning };
}

function normalizeUrl(value) {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

// "Chicago, IL (Remote)" -> { city: "Chicago", state: "IL" }. Anything that
// doesn't match a plain "City, ST" pattern is left for the user to fill in
// by hand rather than guessed at.
function parseLocation(location) {
  if (!location) return { city: "", state: "", warning: null };
  const match = location.match(/^([^,(]+),\s*([A-Za-z]{2})\b/);
  if (match) {
    return { city: match[1].trim(), state: match[2].toUpperCase(), warning: null };
  }
  return { city: "", state: "", warning: `Couldn't parse a city/state out of location "${location}" - fill those in manually.` };
}

function isCurrentRole(endDate) {
  return /^present$/i.test((endDate || "").trim());
}

function mapExperience(experience) {
  return (experience || []).map((job) => ({
    company: job.company || "",
    title: job.title || "",
    location: job.location || "",
    startDate: job.start || "",
    endDate: isCurrentRole(job.end) ? "" : job.end || "",
    current: isCurrentRole(job.end),
    description: (job.bullets || []).map((b) => `- ${b}`).join("\n")
  }));
}

function mapEducation(education) {
  return (education || []).map((ed) => ({
    school: ed.school || "",
    degree: ed.degree || "",
    field: ed.field || "",
    startDate: ed.start || "",
    endDate: ed.end || "",
    gpa: ed.gpa || ""
  }));
}

// Parses resume.yaml text into the shape the profile expects. Doesn't
// touch chrome.storage or the live profile - see applyImportToProfile for
// that.
function parseResumeYaml(yamlText) {
  let raw;
  try {
    raw = jsyaml.load(yamlText);
  } catch (err) {
    throw new Error(`Couldn't parse that as YAML: ${err.message}`);
  }
  if (!raw || typeof raw !== "object" || !raw.basics) {
    throw new Error('That YAML doesn\'t look like a resume.yaml - expected a top-level "basics" section.');
  }

  const warnings = [];
  const basics = raw.basics || {};

  const { firstName, lastName, warning: nameWarning } = splitName(basics.name);
  if (nameWarning) warnings.push(nameWarning);

  const { city, state, warning: locationWarning } = parseLocation(basics.location);
  if (locationWarning) warnings.push(locationWarning);

  const mapped = {
    personal: {
      firstName,
      lastName,
      email: basics.email || "",
      phone: basics.phone || "",
      city,
      state,
      linkedinUrl: normalizeUrl(basics.linkedin),
      githubUrl: normalizeUrl(basics.github),
      websiteUrl: normalizeUrl(basics.website),
      currentTitle: basics.title || "",
      summary: basics.summary ? basics.summary.trim() : ""
    },
    workHistory: mapExperience(raw.experience),
    education: mapEducation(raw.education),
    certifications: (raw.certifications || []).map((c) => ({ name: c.name || "", issuer: c.issuer || "" })),
    skills: (raw.skills || []).map((s) => ({ category: s.category || "", items: s.items || [] }))
  };

  return { mapped, warnings };
}

// Merges parsed resume data into a live profile object in place. Only
// touches the fields resume.yaml actually has an opinion about. fileInfo is
// the imported file's { name, size, lastModified } (a browser File already
// has all three, lastModified being the OS file's own last-modified time in
// ms since epoch) - recorded so the options page can show what's currently
// loaded, when the file itself was last changed, and when it was imported.
function applyImportToProfile(profile, mapped, fileInfo) {
  Object.assign(profile.personal, mapped.personal);
  profile.workHistory = mapped.workHistory;
  profile.education = mapped.education;
  profile.certifications = mapped.certifications;
  profile.skills = mapped.skills;

  if (mapped.personal.summary) {
    const otherSnippets = profile.snippetBank.filter((s) => s.source !== "resume-import");
    otherSnippets.push({
      keywords: ["yourself", "tell", "about you", "background", "who are you"],
      answer: mapped.personal.summary,
      source: "resume-import"
    });
    profile.snippetBank = otherSnippets;
  }

  profile.importMeta = {
    lastImportedAt: new Date().toISOString(),
    fileModifiedAt: fileInfo && fileInfo.lastModified ? new Date(fileInfo.lastModified).toISOString() : "",
    fileName: (fileInfo && fileInfo.name) || "",
    fileSizeBytes: (fileInfo && fileInfo.size) || 0
  };
}
