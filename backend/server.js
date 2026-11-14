// AF Farm Planner — backend API
// A thin, authenticated gate in front of the farm storage. The browser never
// talks to the database directly any more: it sends its request here with a
// clan password, and only then does this server read or write the store.
//
// Env vars (set on Render):
//   CLAN_PASSWORD            required  the password clan members type once
//   ALLOWED_ORIGIN           required  e.g. https://mwillemsen04-jpg.github.io
//   FIREBASE_SERVICE_ACCOUNT optional  JSON key -> use Firestore (production)
//                                      if absent, an in-memory store is used (testing only)
//   PORT                     set automatically by Render

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const PASSWORD = process.env.CLAN_PASSWORD || '';
const ORIGINS = (process.env.ALLOWED_ORIGIN || '')
  .split(',').map(s => s.trim()).filter(Boolean);

// Pick the store: Firestore if a service account is configured, else in-memory.
let store;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  store = require('./store-firebase');
} else {
  store = require('./store-memory');
  console.warn('[store] No FIREBASE_SERVICE_ACCOUNT — using in-memory store (data is lost on restart).');
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '3mb' }));

// CORS: the clan password (Bearer token) is the real gate, and we use no
// cookies, so reflecting any origin is safe. This avoids an ALLOWED_ORIGIN typo
// (a trailing slash or a path) silently blocking the planner's own page.
app.use(cors({
  origin: true,
  methods: ['GET', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// --- helpers ---------------------------------------------------------------

function timingEqual(a, b) {
  const ab = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// A path is only allowed if it looks exactly like the planner's own documents:
//   data/users/<word>/<word...>   or   data/pub
// No '..', no weird characters, limited length.
function cleanPath(p) {
  if (typeof p !== 'string') return null;
  p = p.replace(/^\/+|\/+$/g, '');
  if (p.length > 200) return null;
  if (!/^[A-Za-z0-9_][A-Za-z0-9_/-]*$/.test(p)) return null;
  if (p.indexOf('..') !== -1) return null;
  if (p === 'data/pub') return p;
  if (/^data\/users\/[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*$/.test(p)) return p;
  if (/^ava\/[A-Za-z0-9_-]+$/.test(p)) return p; // AVA viewer: ava/overview, ava/page_<id>, ava/map_<id>, ava/index
  return null;
}

// Every /api route needs the clan password.
function auth(req, res, next) {
  if (!PASSWORD) return res.status(503).json({ error: 'server has no CLAN_PASSWORD set' });
  const h = req.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!timingEqual(token, PASSWORD)) return res.status(401).json({ error: 'wrong or missing password' });
  next();
}

function wrap(fn) {
  return (req, res) => fn(req, res).catch(err => {
    console.error(err && err.message);
    res.status(500).json({ error: 'server error' });
  });
}

// --- routes ----------------------------------------------------------------

app.get('/healthz', (req, res) => res.json({ ok: true, store: store.kind, build: 'ava-1' }));

// Is the typed password correct? (used by the login box in the browser)
app.get('/api/check', auth, (req, res) => res.json({ ok: true }));

// One document
app.get('/api/doc/*', auth, wrap(async (req, res) => {
  const path = cleanPath(req.params[0]);
  if (!path) return res.status(400).json({ error: 'bad path' });
  res.json(await store.getDoc(path));
}));

app.put('/api/doc/*', auth, wrap(async (req, res) => {
  const path = cleanPath(req.params[0]);
  if (!path) return res.status(400).json({ error: 'bad path' });
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))
    return res.status(400).json({ error: 'body must be an object' });
  await store.setDoc(path, req.body);
  res.json({ ok: true });
}));

app.patch('/api/doc/*', auth, wrap(async (req, res) => {
  const path = cleanPath(req.params[0]);
  if (!path) return res.status(400).json({ error: 'bad path' });
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))
    return res.status(400).json({ error: 'body must be an object' });
  try { await store.updateDoc(path, req.body); }
  catch (e) { return res.status(404).json({ error: 'no such document' }); }
  res.json({ ok: true });
}));

app.delete('/api/doc/*', auth, wrap(async (req, res) => {
  const path = cleanPath(req.params[0]);
  if (!path) return res.status(400).json({ error: 'bad path' });
  await store.deleteDoc(path);
  res.json({ ok: true });
}));

// A collection (the list of farms)
app.get('/api/collection/*', auth, wrap(async (req, res) => {
  const path = cleanPath(req.params[0]);
  if (!path) return res.status(400).json({ error: 'bad path' });
  res.json({ docs: await store.listCollection(path) });
}));

// --- AVA maps viewer -------------------------------------------------------
// The map images and pages live in the database (not public on GitHub) and are
// served here, behind the same clan password. The upload script fills these in.
const avaId = s => /^[0-9A-Za-z_-]{1,40}$/.test(String(s || ''));

// The list of games (JSON) for the overview.
app.get('/api/ava/index', auth, wrap(async (req, res) => {
  const d = await store.getDoc('ava/index');
  res.json(d.exists ? d.data : { games: [] });
}));

// Pages can be big (the map is embedded), so the upload script may split them
// into numbered chunks. Reassemble a page that is either {html} or {chunks:N}.
async function avaHtml(name) {
  const d = await store.getDoc(name);
  if (!d.exists) return null;
  if (typeof d.data.html === 'string') return d.data.html;
  if (d.data.chunks > 0) {
    let s = '';
    for (let i = 0; i < d.data.chunks; i++) {
      const c = await store.getDoc(name + '_' + i);
      s += (c.exists && c.data.part) ? c.data.part : '';
    }
    return s;
  }
  return '';
}

// A built page: the overview, or one game's page (raw HTML).
app.get('/api/ava/overview', auth, wrap(async (req, res) => {
  const html = await avaHtml('ava/overview');
  if (html == null) return res.status(404).send('not uploaded yet');
  res.set('Content-Type', 'text/html; charset=utf-8').send(html);
}));
app.get('/api/ava/page/:id', auth, wrap(async (req, res) => {
  if (!avaId(req.params.id)) return res.status(400).send('bad id');
  const html = await avaHtml('ava/page_' + req.params.id);
  if (html == null) return res.status(404).send('no such game');
  res.set('Content-Type', 'text/html; charset=utf-8').send(html);
}));

// A game's map image (base.jpg), stored base64 in the database.
app.get('/api/ava/map/:id', auth, wrap(async (req, res) => {
  if (!avaId(req.params.id)) return res.status(400).send('bad id');
  const d = await store.getDoc('ava/map_' + req.params.id);
  if (!d.exists || !d.data.b64) return res.status(404).send('no map');
  const buf = Buffer.from(d.data.b64, 'base64');
  res.set('Content-Type', d.data.ct || 'image/jpeg');
  res.set('Cache-Control', 'no-store');
  res.send(buf);
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AF farm backend on :${PORT} (store: ${store.kind})`));
