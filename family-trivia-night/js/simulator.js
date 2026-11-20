"use strict";
/* Stands in for Firebase when testing on one laptop. Relays messages between the
   TV frame and the phone frames on this page. */
(function () {
  let pub = null, teams = {};
  const down = (op, data, from) => document.querySelectorAll("iframe").forEach(f => f.contentWindow.postMessage({ ftn: "down", op, data, from }, "*"));
  window.addEventListener("message", e => {
    const m = e.data;
    if (!m || m.ftn !== "up") return;
    if (m.op === "reset") { pub = null; teams = {}; down("public", null); down("teams", teams); }
    else if (m.op === "hello") { down("public", pub); down("teams", teams); }
    else if (m.op === "public") { pub = m.data; down("public", pub); }
    else if (m.op === "team") { teams[m.from] = m.data; down("teams", teams); }
    else if (m.op === "input") down("input", m.data, m.from);
  });
})();
