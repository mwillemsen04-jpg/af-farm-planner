# AF Farm Planner — backend

A small server that sits **between the planner and the farm storage**. The
browser no longer talks to Firebase directly. It sends every request here with a
clan password; only then does this server read or write the farms. So:

- the Firebase keys live on the server, not in the public page;
- only people with the clan password can open or change farms;
- your existing farms stay exactly where they are (in Firebase) — nothing is moved.

Live updates between teammates are done by the planner asking the server every
few seconds (instead of Firebase's instant push).

## What you need to do (once)

1. **Make a Render account** at <https://render.com> (free). This part is yours —
   it needs your email and a password.

2. **Get a Firebase service-account key** (so the server may reach your farms):
   Firebase console → your project → ⚙ *Project settings* → *Service accounts* →
   **Generate new private key**. You get a `.json` file. Open it and copy the
   whole contents onto one line.

3. **Deploy on Render:** New + → *Blueprint* → pick the repo with this code →
   Render reads `render.yaml`. It will ask for three values:
   - `CLAN_PASSWORD` — pick a password your clan will type once.
   - `ALLOWED_ORIGIN` — `https://mwillemsen04-jpg.github.io`
   - `FIREBASE_SERVICE_ACCOUNT` — paste the one-line JSON from step 2.
   Click *Create*. After a minute you get a URL like
   `https://af-farm-backend.onrender.com`.

4. Give me that URL. I switch the planner to the backend version (obfuscated) and
   publish it. From then on the site asks for the clan password on first open.

## Good to know (free plan)

- **Cold start:** a free Render service goes to sleep after ~15 min of no use.
  The next open then takes ~30–60 s to wake up. After that it is fast until it
  sleeps again. (A paid plan removes this; or a small "ping" keeps it awake.)
- **Live sync** becomes ~3–5 s instead of instant.
- **Storage** stays in Firebase, so it is as safe as it is now.

## Run it locally (optional)

```
npm install
CLAN_PASSWORD=test ALLOWED_ORIGIN= node server.js
```
Without `FIREBASE_SERVICE_ACCOUNT` it uses an in-memory store (data is lost on
restart) — handy for testing, not for real use.

## Endpoints

All under `/api` and needing `Authorization: Bearer <CLAN_PASSWORD>`:

| Method | Path | Does |
|--------|------|------|
| GET | `/api/check` | is the password right? |
| GET | `/api/doc/<path>` | read one farm / the `last` marker |
| PUT | `/api/doc/<path>` | write one farm |
| PATCH | `/api/doc/<path>` | change fields (e.g. `done`) |
| DELETE | `/api/doc/<path>` | delete one farm |
| GET | `/api/collection/<path>` | list the farms |

`/healthz` is open (no password) so Render can check the service is up.

The planner's front-end adapter that talks to this server is in
`web/af-backend-adapter.js`.
