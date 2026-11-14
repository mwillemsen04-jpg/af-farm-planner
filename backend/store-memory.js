// In-memory store — used for local testing and as a fallback when no Firebase
// service account is configured. Data is lost when the process restarts, so it
// is NOT for production; set FIREBASE_SERVICE_ACCOUNT to use Firestore instead.
const docs = new Map(); // key: full path, value: data object

module.exports = {
  kind: 'memory',
  async getDoc(path) {
    const d = docs.get(path);
    return { exists: d !== undefined, data: d === undefined ? null : JSON.parse(JSON.stringify(d)) };
  },
  async setDoc(path, data) {
    docs.set(path, JSON.parse(JSON.stringify(data)));
  },
  async updateDoc(path, partial) {
    const cur = docs.get(path);
    if (cur === undefined) throw new Error('no such document');
    docs.set(path, Object.assign({}, cur, JSON.parse(JSON.stringify(partial))));
  },
  async deleteDoc(path) {
    docs.delete(path);
  },
  async listCollection(path) {
    const prefix = path + '/';
    const out = [];
    for (const [k, v] of docs) {
      if (!k.startsWith(prefix)) continue;
      const rest = k.slice(prefix.length);
      if (rest.indexOf('/') !== -1) continue; // only direct children
      out.push({ id: rest, data: JSON.parse(JSON.stringify(v)) });
    }
    return out;
  }
};
