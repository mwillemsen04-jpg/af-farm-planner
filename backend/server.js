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

// Only the planner's own page may call this API from a browser.
app.use(cors({
  origin: function (origin, cb) {
    if (!origin) return cb(null, true);            // curl / server-to-server
    if (!ORIGINS.length) return cb(null, true);    // not locked down yet
    return cb(null, ORIGINS.includes(origin));
  },
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

app.get('/healthz', (req, res) => res.json({ ok: true, store: store.kind }));

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AF farm backend on :${PORT} (store: ${store.kind})`));
