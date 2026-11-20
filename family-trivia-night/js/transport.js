"use strict";
/* Message relay between the host laptop and the team phones.

   Two interchangeable implementations with the same interface:
   - Firebase Realtime Database, for real games.
   - A local simulator (postMessage through simulator.html), for testing on one laptop.

   Host:   createRoom(code), setPublic(state), onTeams(cb), onInput(cb), closeRoom()
   Client: join(code), setTeam(info), onPublic(cb), send(input)
   Both:   id (stable per device, so a phone that reloads gets its team back)
*/
(function (FTN) {

  /* ---------------- local simulator ---------------- */
  function simTransport() {
    const id = FTN.params.get("id") || "tv";
    const subs = { public: [], teams: [], input: [] };
    const up = (op, data) => window.parent.postMessage({ ftn: "up", op, from: id, data }, "*");
    window.addEventListener("message", e => {
      const m = e.data;
      if (!m || m.ftn !== "down" || !subs[m.op]) return;
      subs[m.op].forEach(cb => m.op === "input" ? cb(m.from, m.data) : cb(m.data));
    });
    return {
      id, kind: "sim",
      async createRoom() { up("reset"); },
      setPublic(state) { up("public", JSON.stringify(state)); },
      onTeams(cb) { subs.teams.push(cb); up("hello"); },
      onInput(cb) { subs.input.push(cb); },
      closeRoom() { up("reset"); },
      async join() {},
      setTeam(info) { up("team", info); },
      onPublic(cb) { subs.public.push(json => cb(json ? JSON.parse(json) : null)); up("hello"); },
      send(input) { up("input", input); }
    };
  }

  /* ---------------- Firebase ---------------- */
  async function firebaseTransport() {
    const cfg = window.FTN_FIREBASE_CONFIG;
    if (!cfg || !cfg.databaseURL || typeof firebase === "undefined") {
      throw new Error("Firebase is not set up yet. Copy js/config.example.js to js/config.js and fill it in, or open simulator.html to test without it.");
    }
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    // Anonymous sign-in gives every device a stable ID that the database rules can check.
    await firebase.auth().signInAnonymously();
    const id = firebase.auth().currentUser.uid;
    const db = firebase.database();
    let room = null;
    return {
      id, kind: "firebase",
      async createRoom(code) {
        room = db.ref("rooms/" + code);
        const snap = await room.child("host").get();
        if (snap.exists() && snap.val() !== id) throw new Error("That room code is taken. Try again.");
        if (!snap.exists()) await room.set({ host: id, created: firebase.database.ServerValue.TIMESTAMP });
      },
      setPublic(state) { room.child("public").set(JSON.stringify(state)); },
      onTeams(cb) { room.child("teams").on("value", s => cb(s.val() || {})); },
      onInput(cb) {
        const fire = s => cb(s.key, s.val());
        room.child("inputs").on("child_added", fire);
        room.child("inputs").on("child_changed", fire);
      },
      closeRoom() { if (room) room.remove(); },
      async join(code) {
        room = db.ref("rooms/" + code);
        const snap = await room.child("host").get();
        if (!snap.exists()) throw new Error("No game found with that code.");
      },
      setTeam(info) { return room.child("teams/" + id).set(info); },
      onPublic(cb) { room.child("public").on("value", s => cb(s.val() ? JSON.parse(s.val()) : null)); },
      // "n" makes every write unique so the host is notified even for a repeated tap.
      send(input) { return room.child("inputs/" + id).set(Object.assign({ n: Date.now() }, input)); }
    };
  }

  FTN.connect = async function () { return FTN.SIM ? simTransport() : firebaseTransport(); };
  FTN.firebaseReady = function () { return !!(window.FTN_FIREBASE_CONFIG && window.FTN_FIREBASE_CONFIG.databaseURL); };
})(window.FTN);
