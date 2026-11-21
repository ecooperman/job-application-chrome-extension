// Shape of the profile stored in chrome.storage.local under key "profile".
// Every field is optional - the fill engine simply skips anything blank.
function defaultProfile() {
  return {
    personal: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      zip: "",
      country: "",
      linkedinUrl: "",
      githubUrl: "",
      portfolioUrl: "",
      websiteUrl: "",
      currentTitle: "",
      summary: "" // short professional summary/bio - not filled into any field directly, just fed to the AI fallback for context
    },
    workAuth: {
      authorizedToWorkUS: "", // "yes" | "no" | ""
      requireSponsorship: "", // "yes" | "no" | ""
      visaStatus: ""
    },
    eeo: {
      gender: "",
      race: "",
      veteranStatus: "",
      disabilityStatus: "",
      hispanicOrLatino: ""
    },
    preferences: {
      desiredSalary: "",
      noticePeriod: "",
      willingToRelocate: "",
      remotePreference: "",
      earliestStartDate: ""
    },
    workHistory: [
      // { company, title, location, startDate, endDate, current, description }
    ],
    education: [
      // { school, degree, field, startDate, endDate, gpa }
    ],
    // Not filled into any field directly (no "skills" form field to match) -
    // just extra context handed to the AI fallback so drafted answers about
    // your background are more specific.
    certifications: [
      // { name, issuer }
    ],
    skills: [
      // { category, items: [...] }
    ],
    snippetBank: [
      // { keywords: ["why", "interested", "company"], answer: "...", source: "manual" | "resume-import" }
    ],
    settings: {
      anthropicApiKey: "",
      llmFallbackEnabled: true,
      // How "Score this job" / "Score all jobs" work: "jobs-app" (the default since 0.3.6, as collecting jobs is the main purpose) only captures each
      // posting and sends it to your Jobs app (the resume app's Jobs page), which scores it there - no key needed in this extension; "local" scores
      // here with the Anthropic key above (the original behavior). A profile that has already saved a mode keeps it; only a fresh install gets the default.
      scoreMode: "jobs-app", // "jobs-app" | "local"
      jobsAppUrl: "https://jobs.evancooperman.com",
      jobsAppToken: "" // made on the Jobs app's Jobs page ("Connect the Chrome extension"); only lets this extension add jobs
    },
    importMeta: {
      lastImportedAt: "", // ISO timestamp of when you last clicked import
      fileModifiedAt: "", // ISO timestamp of the imported file's own last-modified date (from the OS, via the File API)
      fileName: "",
      fileSizeBytes: 0
    }
  };
}
