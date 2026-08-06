const LOCATION_MODES = new Set(["unknown", "automatic", "manual"]);

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanTerritory(value) {
  if (!value || typeof value !== "object") return null;
  const id = cleanText(value.id, 180);
  const name = cleanText(value.name, 100);
  return id && name ? { id, name } : null;
}

export function normalizeTerritoryLocation(value) {
  if (!value || typeof value !== "object" || value.provider !== "geoapify") return null;
  const country = cleanTerritory(value.country);
  if (!country) return null;

  const location = {
    provider: "geoapify",
    country: {
      ...country,
      ...(cleanText(value.country.code, 2) ? { code: cleanText(value.country.code, 2).toUpperCase() } : {}),
    },
  };
  const sourceId = cleanText(value.sourceId, 180);
  const city = cleanTerritory(value.city);
  const neighborhood = cleanTerritory(value.neighborhood);
  const resolvedAt = cleanText(value.resolvedAt, 40);
  const accuracyM = Math.round(Number(value.accuracyM));
  if (sourceId) location.sourceId = sourceId;
  if (city) location.city = city;
  if (neighborhood) location.neighborhood = neighborhood;
  if (resolvedAt && Number.isFinite(new Date(resolvedAt).getTime())) location.resolvedAt = resolvedAt;
  if (Number.isFinite(accuracyM) && accuracyM >= 0 && accuracyM <= 100000) location.accuracyM = accuracyM;
  return location;
}

export function normalizeDeviceLocationProfile(value) {
  const mode = LOCATION_MODES.has(value?.mode) ? value.mode : "unknown";
  const location = normalizeTerritoryLocation(value?.location);
  if (mode === "unknown") return { mode: "unknown", location: null };
  return { mode, location };
}

export function formatTerritoryLocation(value, fallback = "Unknown location") {
  const location = normalizeTerritoryLocation(value);
  if (!location) return fallback;
  const names = [location.neighborhood?.name, location.city?.name, location.country.name]
    .filter(Boolean)
    .filter((name, index, all) => index === 0 || name.toLocaleLowerCase() !== all[index - 1].toLocaleLowerCase());
  return names.join(" · ") || fallback;
}

export function snapshotTerritoryLocation(value) {
  const location = normalizeTerritoryLocation(value);
  return location ? JSON.parse(JSON.stringify(location)) : null;
}
