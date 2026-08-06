# Session location tracking

## Behavior

- The saved location is device-wide and applies to every user on that device.
- The app never prompts on launch. It refreshes automatically only when the saved
  mode is `automatic` and the browser reports geolocation permission as `granted`.
- **Use current location** requests a fresh high-accuracy GPS fix with an 8-second
  timeout. The coordinates are sent directly to the Worker for reverse geocoding.
- **Search for a location** uses Geoapify forward geocoding and stores the selected
  canonical result as a fixed manual override.
- **Clear location** removes the saved location and disables automatic refresh.
- Starting a workout snapshots the currently displayed saved location. A refresh
  in progress never delays or changes that session.
- Pushup and plank sessions use the same location behavior. Existing sessions are
  left untouched.

## Privacy boundary

Raw latitude and longitude are transient. They are never written to localStorage,
the client cache, the pending session queue, or `data.json`. The Worker returns and
accepts only this sanitized shape:

```json
{
  "provider": "geoapify",
  "sourceId": "provider-place-id",
  "neighborhood": { "id": "neighborhood:...", "name": "Montrose" },
  "city": { "id": "city:...", "name": "Houston" },
  "country": { "id": "country:us", "name": "United States", "code": "US" },
  "accuracyM": 24,
  "resolvedAt": "2026-08-02T12:00:00.000Z"
}
```

Unavailable levels are omitted. Automatic fixes with accuracy worse than 500
meters omit the neighborhood even if Geoapify returns one. The Worker validates
and rebuilds the allowed location fields before writing a session.

## Cloudflare setup

1. Enable Geoapify's Geocoding API. It covers both `/v1/geocode/search` and
   `/v1/geocode/reverse`; no map product is needed.
2. Add the Geoapify key in the Worker dashboard as an encrypted secret named
   `GEOAPIFY_API_KEY`.
3. Paste the current `worker/index.js` into Cloudflare Quick Edit and deploy it.

Never place the Geoapify key in `app.js`, source control, or a client-side config
file.
