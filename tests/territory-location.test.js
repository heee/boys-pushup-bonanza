import assert from "node:assert/strict";
import test from "node:test";
import {
  formatTerritoryLocation,
  normalizeDeviceLocationProfile,
  normalizeTerritoryLocation,
  snapshotTerritoryLocation,
} from "../territory-location.js";
import { sanitizeGeoapifyResult, sanitizeTerritoryLocation, validateSession } from "../worker/index.js";

const location = {
  provider: "geoapify",
  sourceId: "source-1",
  neighborhood: { id: "neighborhood:us:tx:houston:montrose", name: "Montrose" },
  city: { id: "city:us:tx:houston", name: "Houston" },
  country: { id: "country:us", name: "United States", code: "US" },
  accuracyM: 18,
  resolvedAt: "2026-08-02T12:00:00.000Z",
};

test("formats the canonical hierarchy and normalizes saved device mode", () => {
  assert.equal(formatTerritoryLocation(location), "Montrose · Houston · United States");
  assert.equal(formatTerritoryLocation(null), "Unknown location");
  assert.deepEqual(normalizeDeviceLocationProfile({ mode: "manual", location }), { mode: "manual", location });
  assert.deepEqual(normalizeDeviceLocationProfile({ mode: "automatic", location: null }), { mode: "automatic", location: null });
  assert.deepEqual(normalizeDeviceLocationProfile({ mode: "bad", location }), { mode: "unknown", location: null });
});

test("session snapshots are detached and never admit coordinate fields", () => {
  const withCoordinates = { ...location, latitude: 29.74, longitude: -95.39 };
  const snapshot = snapshotTerritoryLocation(withCoordinates);
  assert.equal("latitude" in snapshot, false);
  assert.equal("longitude" in snapshot, false);
  snapshot.city.name = "Changed";
  assert.equal(location.city.name, "Houston");
  assert.deepEqual(normalizeTerritoryLocation({ provider: "other", country: location.country }), null);
});

test("Geoapify normalization omits neighborhood when GPS accuracy is coarse", () => {
  const raw = {
    place_id: "geo-place",
    suburb: "Montrose",
    city: "Houston",
    state: "Texas",
    country: "United States",
    country_code: "us",
    lat: 29.74,
    lon: -95.39,
  };
  const precise = sanitizeGeoapifyResult(raw, {
    accuracyM: 30,
    now: new Date("2026-08-02T12:00:00.000Z"),
  });
  assert.equal(precise.neighborhood.name, "Montrose");
  assert.equal(precise.city.name, "Houston");
  assert.equal("lat" in precise, false);
  assert.equal("lon" in precise, false);

  const coarse = sanitizeGeoapifyResult(raw, {
    accuracyM: 501,
    allowNeighborhood: false,
    now: new Date("2026-08-02T12:00:00.000Z"),
  });
  assert.equal(coarse.neighborhood, undefined);
  assert.equal(coarse.accuracyM, 501);
});

test("Worker session sanitizer strips unknown and raw coordinate fields", () => {
  assert.deepEqual(sanitizeTerritoryLocation({ ...location, latitude: 29.74, longitude: -95.39, secret: "nope" }), location);
  const session = validateSession({
    id: "location-session",
    user: "Nelson",
    count: 20,
    timestamp: "2026-08-02T12:05:00.000Z",
    location: { ...location, latitude: 29.74, longitude: -95.39, secret: "nope" },
  });
  assert.deepEqual(session.location, location);
});

test("Worker preserves Zen and Sharpshooter mode tags without Zen modifiers", () => {
  const zen = validateSession({ user: "Nelson", count: 20, mode: "zen", modifier: "diamond" });
  const sharpshooter = validateSession({ user: "Nelson", count: 20, mode: "sharpshooter" });
  assert.equal(zen.mode, "zen");
  assert.equal(zen.modifier, undefined);
  assert.equal(sharpshooter.mode, "sharpshooter");
});
