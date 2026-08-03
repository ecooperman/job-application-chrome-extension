// Thin wrapper around chrome.storage.local for the profile object.
// Everything lives under a single "profile" key, merged with defaults so
// older saved profiles pick up new fields added later without breaking.

function deepMerge(base, overrides) {
  const result = Array.isArray(base) ? base.slice() : { ...base };
  if (Array.isArray(overrides)) return overrides;
  for (const key of Object.keys(overrides || {})) {
    const baseVal = base ? base[key] : undefined;
    const overrideVal = overrides[key];
    if (
      baseVal &&
      overrideVal &&
      typeof baseVal === "object" &&
      typeof overrideVal === "object" &&
      !Array.isArray(overrideVal)
    ) {
      result[key] = deepMerge(baseVal, overrideVal);
    } else {
      result[key] = overrideVal;
    }
  }
  return result;
}

async function loadProfile() {
  const stored = await chrome.storage.local.get("profile");
  return deepMerge(defaultProfile(), stored.profile || {});
}

async function saveProfile(profile) {
  await chrome.storage.local.set({ profile });
}
