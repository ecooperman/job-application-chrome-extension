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
      websiteUrl: ""
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
    snippetBank: [
      // { keywords: ["why", "interested", "company"], answer: "..." }
    ],
    settings: {
      anthropicApiKey: "",
      llmFallbackEnabled: true
    }
  };
}
