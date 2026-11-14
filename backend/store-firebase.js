// Production store — writes to the SAME Firestore the planner already uses, so
// all existing farms stay exactly where they are. Nothing is migrated.
// Needs the FIREBASE_SERVICE_ACCOUNT env var (the JSON of a service-account key
// from the Firebase console: Project settings -> Service accounts -> Generate key).
const admin = require('firebase-admin');

function init() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
  let cred;
  try { cred = JSON.parse(raw); }
  catch (e) { throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON'); }
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(cred) });
  return admin.firestore();
}

const db = init();

module.exports = {
  kind: 'firestore',
  async getDoc(path) {
    const snap = await db.doc(path).get();
    return { exists: snap.exists, data: snap.exists ? snap.data() : null };
  },
  async setDoc(path, data) {
    await db.doc(path).set(data);
  },
  async updateDoc(path, partial) {
    await db.doc(path).update(partial);
  },
  async deleteDoc(path) {
    await db.doc(path).delete();
  },
  async listCollection(path) {
    const snap = await db.collection(path).get();
    return snap.docs.map(d => ({ id: d.id, data: d.data() }));
  }
};
