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
      llmFallbackEnabled: true
    },
    importMeta: {
      lastImportedAt: "" // ISO timestamp of the last successful resume.yaml import, if any
    }
  };
}
