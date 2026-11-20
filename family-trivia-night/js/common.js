"use strict";
/* Shared helpers for the TV and phone pages. */
window.FTN = window.FTN || {};
(function (FTN) {
  // Builds DOM nodes. Text always goes in as text nodes, never as HTML, so team names
  // and model output cannot inject markup.
  FTN.h = function (tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "style") e.style.cssText = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return e;
  };
  FTN.store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} }
  };
  FTN.shuffle = function (a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  FTN.params = new URLSearchParams(location.search);
  FTN.SIM = FTN.params.get("sim") === "1";

  FTN.EMOJI = ["🦊", "🦁", "🐙", "🦄", "🐼", "🦉", "🐸", "🐯", "🦖", "🐧", "🚀", "⚡", "🔥", "🌮", "👑", "🎸"];
  FTN.COLORS = ["#FF5A5F", "#3DA5FF", "#2BD4A4", "#FFC940", "#B18CFF", "#FF8AD1", "#FF9F45", "#7CE04A"];
  FTN.VALUES = [100, 200, 300, 400];
  FTN.CATEGORIES = ["US History", "US Geography", "Science", "Christmas Movies", "TV Shows", "Music", "Sports", "Food & Drink",
    "Books", "Animals", "Technology", "Art & Design", "Space", "Games & Toys", "Words", "Christmas"];
  FTN.LETTERS = "ABCD";

  // Countdown helper: calls onTick(secondsLeft) until the deadline passes. Returns a stop function.
  FTN.countdown = function (msLeft, onTick) {
    const end = Date.now() + msLeft;
    const tick = () => onTick(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  };
  // The rules, one tap away on every phone and on the TV, so nobody has to read them aloud.
  FTN.RULES = [
    ["The goal", ["Score the most points as a team. One phone per team. The questions appear on the TV."]],
    ["On your turn", [
      "Tap We're ready, then pick one of four categories.",
      "Each card is worth 100, 200, 300 or 400. The higher the value, the harder the question.",
      "You have 30 seconds. Talk it over and tap A, B, C or D.",
      "Get it right and you score the card's full value."]],
    ["Steals", [
      "When it is another team's turn, secretly lock in your own answer.",
      "If they miss and you are right, you steal half the card's value.",
      "Be quick: the moment the active team answers, steals are closed.",
      "A wrong steal costs nothing, so always take a shot."]],
    ["The final round", [
      "You see only the category, then secretly wager points. You can wager up to your score, or up to 400 if you have less.",
      "Everyone gets the same question and types an answer. Spelling does not have to be perfect.",
      "Right: you win your wager. Wrong: you lose it.",
      "Answers are revealed from last place to first."]],
    ["Ties", ["Tied teams go to sudden death. Miss a question and you are out."]]
  ];
  FTN.showRules = function () {
    const h = FTN.h;
    let sheet = document.getElementById("rules");
    if (sheet) { sheet.remove(); }
    const close = () => sheet.remove();
    const box = h("div", { class: "rules", role: "dialog", "aria-modal": "true", "aria-label": "How to play" },
      h("h1", {}, "How to play"),
      FTN.RULES.map(([title, lines]) => [h("h2", {}, title), h("ul", {}, lines.map(l => h("li", {}, l)))]),
      h("button", { class: "btn gold wide", onclick: close }, "Got it"));
    sheet = h("div", { id: "rules", class: "rules-backdrop", onclick(e) { if (e.target === sheet) close(); } }, box);
    document.body.append(sheet);
  };

  FTN.avatar = function (team, cls) {
    return FTN.h("span", { class: "avatar " + (cls || ""), style: `background:${team.color || "#445"}` }, team.emoji || "❓");
  };
})(window.FTN);
