// Rules mapping a normalized field label to a spot in the profile. Checked
// in order, first match wins - so more specific patterns (address line 2)
// come before more general ones (address).
// var, not const: this file gets re-injected into the page each time the
// user clicks "Fill this page", and a top-level const would throw a
// duplicate-declaration error on the second injection into the same tab.
var FIELD_RULES = [
  { type: "fullName", pattern: /^(full\s*)?name$|^legal\s*name$/, get: (p) => `${p.personal.firstName} ${p.personal.lastName}`.trim() },
  { type: "firstName", pattern: /\b(first\s*name|given\s*name)\b/, get: (p) => p.personal.firstName },
  { type: "lastName", pattern: /\b(last\s*name|family\s*name|surname)\b/, get: (p) => p.personal.lastName },
  { type: "email", pattern: /\be-?mail\b/, get: (p) => p.personal.email },
  { type: "phone", pattern: /\b(phone|mobile|cell)\b/, get: (p) => p.personal.phone },
  { type: "linkedin", pattern: /linkedin/, get: (p) => p.personal.linkedinUrl },
  { type: "github", pattern: /github/, get: (p) => p.personal.githubUrl },
  { type: "portfolio", pattern: /portfolio|personal\s*website|^website$/, get: (p) => p.personal.portfolioUrl || p.personal.websiteUrl },
  { type: "workAuthUS", pattern: /authoriz.*work|legally\s*(authorized|eligible|permitted)/, get: (p) => p.workAuth.authorizedToWorkUS },
  { type: "sponsorship", pattern: /sponsor/, get: (p) => p.workAuth.requireSponsorship },
  { type: "addressLine2", pattern: /\baddress\s*(line\s*)?2\b|\bapt\b|\bsuite\b|\bunit\b\s*(number|#)?/, get: (p) => p.personal.addressLine2 },
  { type: "addressLine1", pattern: /\baddress\s*(line\s*)?1\b|\bstreet\s*address\b|^address$/, get: (p) => p.personal.addressLine1 },
  { type: "city", pattern: /\bcity\b/, get: (p) => p.personal.city },
  { type: "state", pattern: /\bstate\b|\bprovince\b/, get: (p) => p.personal.state },
  { type: "zip", pattern: /\bzip\b|\bpostal\s*code\b/, get: (p) => p.personal.zip },
  { type: "country", pattern: /\bcountry\b/, get: (p) => p.personal.country },
  { type: "desiredSalary", pattern: /\bsalary\b|compensation\s*expect|pay\s*expect/, get: (p) => p.preferences.desiredSalary },
  { type: "noticePeriod", pattern: /notice\s*period|when.*(can|could).*start|earliest.*start|available.*start|start\s*date/, get: (p) => p.preferences.noticePeriod || p.preferences.earliestStartDate },
  { type: "relocate", pattern: /relocat/, get: (p) => p.preferences.willingToRelocate },
  { type: "remote", pattern: /\bremote\b|\bhybrid\b|in.?office|work\s*location\s*preference/, get: (p) => p.preferences.remotePreference },
  { type: "hispanicLatino", pattern: /hispanic|latino/, get: (p) => p.eeo.hispanicOrLatino },
  { type: "gender", pattern: /\bgender\b|\bsex\b/, get: (p) => p.eeo.gender },
  { type: "race", pattern: /\brace\b|ethnicity/, get: (p) => p.eeo.race },
  { type: "veteran", pattern: /veteran/, get: (p) => p.eeo.veteranStatus },
  { type: "disability", pattern: /disabilit/, get: (p) => p.eeo.disabilityStatus }
];

function matchFieldRule(labelText) {
  if (!labelText) return null;
  return FIELD_RULES.find((rule) => rule.pattern.test(labelText)) || null;
}
