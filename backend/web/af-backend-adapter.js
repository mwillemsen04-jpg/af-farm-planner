/* AF Farm Planner — frontend adapter for the Render backend.
 *
 * This REPLACES the Firebase browser code. Instead of talking to Firestore
 * directly, the planner now talks to your own server (which holds the keys and
 * checks the clan password). The planner code itself is unchanged: it still
 * calls window.claude.use('db') and gets back something that looks like
 * Firestore (doc/collection with get/set/update/delete/onSnapshot). Live
 * updates between teammates are done by polling the server every few seconds.
 *
 * Activated only when window.AF_BACKEND is set to the server URL. If it is
 * empty, this file does nothing and the normal Firebase version runs.
 */
(function () {
  var BASE = (window.AF_BACKEND || '').replace(/\/+$/, '');
  if (!BASE || BASE.indexOf('PASTE') !== -1) return; // not configured -> leave the Firebase shim in charge

  var POLL_MS = 3500;          // how often teammates' changes are picked up
  var KEY = 'afp_backend_pw';  // where the clan password is remembered

  function pw() { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }
  function setPw(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  function api(method, sub, body) {
    return fetch(BASE + sub, {
      method: method,
      headers: Object.assign({ 'Authorization': 'Bearer ' + pw() },
        body ? { 'Content-Type': 'application/json' } : {}),
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      if (r.status === 401) { askLogin(true); throw new Error('unauthorized'); }
      if (!r.ok) throw new Error('http ' + r.status);
      return r.status === 204 ? null : r.json();
    });
  }

  function docSnap(path, res) {
    return { exists: !!(res && res.exists), id: path.split('/').pop(),
             data: function () { return res && res.data ? res.data : undefined; } };
  }

  // A stand-in for a Firestore document reference.
  function docRef(path) {
    var sub = '/api/doc/' + path;
    return {
      get: function () { return api('GET', sub).then(function (r) { return docSnap(path, r); }); },
      set: function (obj) { return api('PUT', sub, obj); },
      update: function (obj) { return api('PATCH', sub, obj); },
      delete: function () { return api('DELETE', sub); },
      onSnapshot: function (cb) { return poll(function () {
        return api('GET', sub).then(function (r) { return docSnap(path, r); }); }, cb); }
    };
  }

  // A stand-in for a Firestore collection reference.
  function collRef(path) {
    var sub = '/api/collection/' + path;
    function list() {
      return api('GET', sub).then(function (r) {
        var docs = (r && r.docs) || [];
        return { docs: docs.map(function (d) {
          return { id: d.id, exists: true, data: function () { return d.data; } };
        }) };
      });
    }
    return { get: list, onSnapshot: function (cb) { return poll(list, cb); } };
  }

  // Firestore's onSnapshot replaced by polling: fire now, then every POLL_MS,
  // but only call back when the data actually changed (keeps re-renders down).
  function poll(fetchOnce, cb) {
    var stop = false, last = null, timer = 0;
    function tick() {
      if (stop) return;
      fetchOnce().then(function (snap) {
        if (stop) return;
        var sig = snap.docs
          ? JSON.stringify(snap.docs.map(function (d) { return [d.id, d.data()]; }))
          : JSON.stringify([snap.exists, snap.data()]);
        if (sig !== last) { last = sig; try { cb(snap); } catch (e) {} }
      }).catch(function () {}).then(function () {
        if (!stop) timer = setTimeout(tick, POLL_MS);
      });
    }
    tick();
    return function () { stop = true; if (timer) clearTimeout(timer); };
  }

  var fakeDb = {
    doc: function (p) { return docRef(p); },
    collection: function (p) { return collRef(p); }
  };

  window.claude = { use: function (n) {
    if (n === 'db') return Promise.resolve(fakeDb);
    if (n === 'user') return Promise.resolve({
      id: function () { return Promise.resolve('team'); },
      isOwner: function () { return Promise.resolve(false); }
    });
    return Promise.resolve(null);
  } };

  // --- tiny login box (only shown if the password is missing or rejected) ---
  var loginOpen = false;
  function askLogin(force) {
    if (loginOpen) return;
    if (!force && pw()) return;
    loginOpen = true;
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(6,9,13,.82);display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif';
    ov.innerHTML = '<form style="background:#111721;border:1px solid #263243;border-radius:14px;padding:22px 20px;width:280px;max-width:90vw;box-shadow:0 10px 40px rgba(0,0,0,.6)">' +
      '<div style="color:#e9eef4;font-weight:700;font-size:16px;margin-bottom:4px">AF Farm Planner</div>' +
      '<div style="color:#9aa8b9;font-size:13px;margin-bottom:12px">Clan password</div>' +
      '<input type="password" autocomplete="current-password" style="width:100%;height:40px;border:1px solid #334256;border-radius:9px;background:#0f151e;color:#e9eef4;padding:0 10px;font-size:15px;box-sizing:border-box">' +
      '<div class="err" style="color:#ef4444;font-size:12px;min-height:15px;margin:6px 0"></div>' +
      '<button type="submit" style="width:100%;height:40px;border:0;border-radius:9px;background:#c9a24a;color:#141414;font-weight:700;font-size:15px;cursor:pointer">Open</button>' +
      '</form>';
    document.body.appendChild(ov);
    var inp = ov.querySelector('input'), err = ov.querySelector('.err');
    setTimeout(function () { inp.focus(); }, 50);
    ov.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault(); err.textContent = '';
      var v = inp.value;
      fetch(BASE + '/api/check', { headers: { 'Authorization': 'Bearer ' + v } })
        .then(function (r) {
          if (r.ok) { setPw(v); ov.remove(); loginOpen = false; location.reload(); }
          else { err.textContent = 'Wrong password'; }
        })
        .catch(function () { err.textContent = 'Cannot reach the server'; });
    });
  }

  if (!pw()) {
    if (document.body) askLogin();
    else document.addEventListener('DOMContentLoaded', function () { askLogin(); });
  }
})();
