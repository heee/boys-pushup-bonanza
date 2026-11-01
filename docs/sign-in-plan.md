# Sign-in & App Store plan

**Status: parked (2026-10-31)** — waiting on Henning to create the Apple
Developer + Google OAuth accounts (see "Setup you do first"). When the IDs
exist, say "execute the sign-in plan" and build Phase 1 in one go.

## Decisions (agreed one by one, 2026-10-31)

| Question | Decision |
|---|---|
| How to ship to the App Store | Not final. Recommended: wrap the existing PWA (Capacitor) — keeps camera/pose code and one codebase; add native touches (Sign in with Apple, push, haptics) so review doesn't reject a "thin wrapper". Rewrite only if a wrapped test build shows the camera pipeline is too slow. Sign-in server design is identical either way. |
| Audience | **Public** — anyone can download, sign up, form groups. Implies: account deletion (Apple requirement), privacy controls, name/avatar moderation. |
| Sign-in methods | **Sign in with Apple + Google.** (Apple is mandatory once Google is offered in an iOS app.) No passwords. |
| Migrating the existing crew | Users open the app as today and get **prompted to sign in**; on success the **name already selected on that device is linked** to the account automatically. First link locks the name; admin can unlink to fix mistakes. |
| Cutover | **Nudge, then require.** Dismissible prompt until **2026-12-20**; after that, logging requires sign-in and unclaimed names go read-only. |
| Names | **Unique @handle + free-form display name**, both keyed to a permanent account ID (data migrates from name → ID in Phase 3). |
| Visibility | **My groups + public boards.** Full detail only for people you share a group with; public boards show handle + totals only. Worker filters per user instead of sending the whole dataset. |

## Current state (why this is needed)

- Identity = a name string picked from a list, stored in `localStorage` (`bpb-last-user`).
- The Worker (`worker/index.js`, Cloudflare + D1) accepts writes for any name with only the shared `APP_KEY`; `GET /data` returns everyone's sessions, locations and avatars.
- Site is hosted at `https://heee.github.io/boys-pushup-bonanza/` (`ALLOWED_ORIGIN = https://heee.github.io`).

## Setup you do first (one-time, ~30 min)

### Google (free)
1. console.cloud.google.com → create project "Bonanza".
2. APIs & Services → **OAuth consent screen** → External → app name "Boys Pushup Bonanza", support email, publish.
3. Credentials → **Create OAuth client ID** → *Web application*.
   - Authorized JavaScript origins: `https://heee.github.io` and `http://localhost:8080` (testing).
4. Copy the **Client ID** (`…apps.googleusercontent.com`). No client secret is needed (we only verify ID tokens).

### Apple ($99/yr Apple Developer Program — also needed for the App Store)
1. Enroll at developer.apple.com/programs (individual is fine; takes 1–2 days).
2. Certificates, IDs & Profiles → Identifiers → **App ID** (e.g. `com.bonanza.app`) with *Sign in with Apple* enabled.
3. Identifiers → **Services ID** (e.g. `com.bonanza.web`) → enable *Sign in with Apple* → Configure:
   - Primary App ID: the one above.
   - Domains: `heee.github.io`
   - Return URL: `https://heee.github.io/boys-pushup-bonanza/`
4. Copy the **Services ID**. No private key needed for Phase 1 (ID-token verification only; a key is needed later for account-deletion token revocation).

### Hand over
- Google Client ID and Apple Services ID → put in `worker/wrangler.toml` `[vars]` as `GOOGLE_CLIENT_ID`, `APPLE_SERVICES_ID` (not secret).
- Create secret `AUTH_SECRET` (any long random string) in the Cloudflare dashboard → Worker → Settings → Variables and Secrets.
- Run the Phase 1 SQL below in the Cloudflare dashboard D1 console (Claude's Cloudflare access can't run DDL — see CLAUDE.md).

## Phase 1 — Sign-in + name claiming (nothing enforced)

**D1 (you run):**
```sql
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,               -- uuid, permanent
  provider TEXT NOT NULL,            -- 'apple' | 'google'
  provider_sub TEXT NOT NULL,        -- provider's stable user id
  email TEXT,
  linked_name TEXT UNIQUE,           -- legacy name string this account owns
  handle TEXT UNIQUE,                -- set in Phase 3
  display_name TEXT,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (provider, provider_sub)
);
```

**Worker:**
- `POST /auth/google`, `POST /auth/apple` `{ idToken }` → verify RS256 signature against the provider JWKS (Google `https://www.googleapis.com/oauth2/v3/certs`, Apple `https://appleid.apple.com/auth/keys`, WebCrypto, cache keys), check `aud` (client ID / Services ID), `iss`, `exp` → upsert account → return `{ token, account }`. Token = HMAC-SHA256(`AUTH_SECRET`) over `{accountId, exp}` (30-day expiry, refreshed on use).
- `GET /auth/me` → current account (or 401).
- `POST /auth/link-name { name }` → link if unclaimed; 409 if another account owns it; no-op if already yours.
- `POST /auth/unlink { name }` → admin only (`is_admin = 1`; set Henning's row by DML after first sign-in).
- `GET /auth/config` → `{ google: bool, apple: bool }` so the client can hide unconfigured providers.
- Every existing endpoint *reads* an optional `Authorization: Bearer` header but still accepts requests without it.

**Client:**
- Google Identity Services (`accounts.google.com/gsi/client`) and Apple JS (`appleid.cdn-apple.com/.../appleid.auth.js`, popup mode) loaded lazily only when the prompt shows.
- **Home nudge:** dismissible card "Secure your name — sign in by Dec 20" with Apple + Google buttons; reappears every 3 days until signed in; hidden after Dec 20 (Phase 2 takes over).
- **Settings → Account:** signed-in provider + email, linked name, Sign out; unsigned → the two buttons.
- After sign-in: auto-`link-name` with `state.currentUser`; on 409 show "That name is already claimed — ask Henning".
- Token in `localStorage`; attached to every Worker request.
- Unconfigured provider → button reads "Coming soon", disabled.
- Changelog entry: "Added sign-in with Apple and Google".

## Phase 2 — Enforcement (must ship before 2026-12-20)
- From `AUTH_REQUIRED_FROM = 2026-12-20`: every write endpoint requires a valid token whose `linked_name` matches the user being written (sessions, avatars, goals, renames, challenge joins, group actions, Horse/Tug-of-war moves). Audit multi-player endpoints where one device writes on behalf of another player (Horse turns, ToW) and decide the rule per endpoint.
- Unclaimed names: read-only on boards, labelled "unclaimed".
- App: sign-in screen replaces the name picker for new users.

## Phase 3 — Accounts become the identity
- Add `account_id` to sessions/challenges/games; backfill from `accounts.linked_name`; switch all references from name → account ID.
- Onboarding: pick unique `@handle` + display name (rename allowed; handle changes rate-limited).
- Name/avatar moderation (blocklist + report button).
- **Account deletion** in Settings (Apple Guideline 5.1.1(v)): deletes account + data, revokes Apple token (needs the Apple private key).

## Phase 4 — Per-user visibility
- `GET /data` returns only: own data, data of people in shared groups, plus a public-board payload (handle + aggregate totals, no locations/timestamps).
- Locations never leave the group scope.
- Privacy policy page + App Store privacy "nutrition label" answers.

## Phase 5 — iOS app
- Capacitor wrapper around the PWA; test the camera/pose pipeline in WKWebView first (go/no-go for wrapping vs rewrite).
- Native Sign in with Apple (Capacitor plugin) + Google iOS client ID; same Worker endpoints (`aud` accepts the app's bundle ID too).
- Push notifications (APNs) for streaks, challenges, Horse/ToW turns; haptics; app icon/splash.
- TestFlight with the crew → App Store review.
