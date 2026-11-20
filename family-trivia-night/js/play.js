"use strict";
/* The phone page: one per team. It is a thin controller. It shows buttons, sends taps
   to the host, and displays whatever public state the host publishes. It never holds
   the API key or a correct answer before the reveal. */
(function (FTN) {
  const { h, store } = FTN;
  const app = document.getElementById("app");
  let T = null, S = null, me = null, room = "", connectError = "", connecting = false;
  let hadGame = false;
  let viewKey = "", sent = { step: -1 }, form = { name: "", emoji: "" }, pendingJoin = false;

  const send = m => { sent = Object.assign({ step: S.step }, m); T.send(Object.assign({ step: S.step }, m)); renderNow(); };
  const mine = () => S && S.teams && S.teams[me];
  const team = id => (S.teams && S.teams[id]) || { name: "?", emoji: "❓", color: "#445", score: 0 };
  const didSend = t => sent.step === S.step && sent.t === t;
  const isFull = () => !!S && S.phase === "lobby" && !mine() && (S.order || []).length >= (S.max || 8);

  async function connect(code) {
    connecting = true; connectError = ""; renderNow();
    try {
      T = await FTN.connect();
      me = T.id;
      await T.join(code);
      room = code; store.set("ftn2.room", code);
      T.onPublic(s => { if (s) hadGame = true; else if (hadGame) { pendingJoin = false; store.del("ftn2.room"); } S = s; render(); });
    } catch (e) { connectError = e.message; T = null; }
    connecting = false; renderNow();
  }

  /* ---------- screens ---------- */
  function viewEnterCode() {
    const input = h("input", { type: "text", maxlength: "4", placeholder: "ABCD", autocapitalize: "characters", autocomplete: "off", class: "codein", value: room });
    const goBtn = () => { const c = input.value.trim().toUpperCase(); if (c.length === 4) connect(c); };
    input.addEventListener("keydown", e => { if (e.key === "Enter") goBtn(); });
    return h("div", { class: "pcard center" }, h("h1", {}, "Join the game"), h("p", { class: "dim" }, "Enter the four-letter code on the TV."),
      input, connectError && h("div", { class: "error" }, connectError),
      h("button", { class: "btn gold big wide", disabled: connecting, onclick: goBtn }, connecting ? "Connecting..." : "Join"));
  }

  function viewJoin() {
    const taken = () => Object.entries(S.teams || {}).filter(([id]) => id !== me).map(([, t]) => t.emoji);
    const err = h("div", { class: "error", hidden: true });
    const grid = h("div", { class: "emoji-grid", id: "emojiGrid" }, FTN.EMOJI.map(e => h("button", { class: "emoji" + (form.emoji === e ? " sel" : ""), "data-e": e, disabled: taken().includes(e), onclick() {
      form.emoji = e; grid.querySelectorAll(".emoji").forEach(b => b.classList.toggle("sel", b.dataset.e === e));
    } }, e)));
    return h("div", { class: "pcard" },
      h("h1", {}, "Sign up your team"),
      h("label", { class: "lbl" }, "Team name"),
      h("input", { type: "text", maxlength: "24", placeholder: "The Quizzly Bears", value: form.name, oninput() { form.name = this.value; } }),
      h("label", { class: "lbl" }, "Pick your avatar"),
      grid, err,
      h("button", { class: "btn gold big wide", onclick() {
        const fail = m => { err.textContent = m; err.hidden = false; };
        if (!form.name.trim()) return fail("Give your team a name.");
        if (!form.emoji || taken().includes(form.emoji)) return fail("Pick an avatar that is still free.");
        pendingJoin = true;
        T.setTeam({ name: form.name.trim(), emoji: form.emoji, at: Date.now() });
        renderNow();
      } }, "Join the game"));
  }
  // Other teams joining must not wipe what this team is typing, so the join form is patched in place.
  function patchJoin() {
    const grid = document.getElementById("emojiGrid");
    if (!grid) return false;
    const taken = Object.entries(S.teams || {}).filter(([id]) => id !== me).map(([, t]) => t.emoji);
    grid.querySelectorAll(".emoji").forEach(b => { b.disabled = taken.includes(b.dataset.e); if (b.disabled) b.classList.remove("sel"); });
    if (taken.includes(form.emoji)) form.emoji = "";
    return true;
  }

  const wait = (title, sub) => h("div", { class: "pcard center" }, h("h1", {}, title), sub && h("p", { class: "dim lead" }, sub));
  const bigBtn = (label, onclick, cls) => h("button", { class: "btn big wide " + (cls || "gold"), onclick }, label);

  function viewGame() {
    const p = S.phase, my = mine();
    if (p === "lobby") {
      if (my) return wait("You're in!", "Watch the TV. The game starts when everyone has joined.");
      if (isFull()) return wait("This game is full", `All ${S.max || 8} team spots are taken. Team up with someone who is already in.`);
      if (pendingJoin) return wait("Joining...");
      return viewJoin();
    }
    if (!my) return wait("Game in progress", "This game has already started. Catch the next one.");
    const active = S.turn && S.turn.team, isActive = active === me, a = active && team(active);

    if (p === "intro") return isActive
      ? h("div", { class: "pcard center" }, h("h1", {}, "You're up!"), h("p", { class: "dim lead" }, "Huddle up, then tap when ready."), didSend("ready") ? h("p", { class: "lead" }, "Here we go...") : bigBtn("We're ready", () => send({ t: "ready" })))
      : wait(`${a.emoji} ${a.name} is up`, "Get ready to steal.");

    if (p === "pick") return isActive
      ? h("div", { class: "pcard" }, h("h1", { class: "center" }, "Pick a category"),
        didSend("pick") ? h("p", { class: "lead center" }, "Locked in.") : (S.cards || []).map((c, i) => h("button", { class: "btn pick wide", onclick: () => send({ t: "pick", i }) }, h("span", {}, c.cat), h("b", { class: "gold" }, c.value))))
      : wait(`${a.emoji} ${a.name} is choosing`, "Get ready to steal.");

    if (p === "writing") return wait("Question coming up", "Eyes on the TV.");

    if (p === "question") {
      const q = S.q, sd = q.mode === "sd";
      if (!q.eligible.includes(me)) return wait("Sudden death", "You're out of this one. Watch the TV.");
      if ((S.locked || []).includes(me) || didSend("answer")) return wait("Locked in ✓", sd || isActive ? "Fingers crossed." : "If they miss, the points are yours.");
      return h("div", { class: "pcard" },
        h("h1", { class: "center" }, sd ? "Sudden death" : isActive ? "Your answer" : "Steal attempt"),
        h("p", { class: "dim center" }, sd ? "Read the TV and answer." : isActive ? `For ${q.value} points. Answering closes the steals.` : `Worth ${q.value / 2} if ${a.name} misses. Lock in before they answer.`),
        h("div", { class: "abcd" }, FTN.LETTERS.split("").map((L, i) => h("button", { class: "btn letter l" + i, onclick: () => send({ t: "answer", i }) }, L))));
    }

    if (p === "reveal") {
      const r = S.reveal || {}, delta = (r.deltas || {})[me] || 0;
      if (r.sd) return wait((r.right || []).includes(me) ? "Correct!" : S.q.eligible.includes(me) ? "Not this time" : "Sudden death", "Watch the TV.");
      const late = !isActive && !(S.locked || []).includes(me);
      return h("div", { class: "pcard center" },
        h("h1", { class: delta ? "gold" : "" }, delta ? `+${delta}` : isActive ? "No points" : r.ok ? "No steal" : "No points"),
        h("p", { class: "dim lead" }, delta ? (isActive ? "Nicely done." : "Stolen!") : isActive ? "Shake it off." : late ? `${a.name} answered before you locked in.` : r.ok ? `${a.name} got it.` : "Nobody's perfect."),
        isActive && (didSend("next") ? null : bigBtn("Next", () => send({ t: "next" }))));
    }

    if (p === "final_loading" || p === "sd_loading" || p === "final_judging") return wait(p === "sd_loading" ? "Sudden death" : "Final round", "Eyes on the TV.");

    if (p === "final_wager") {
      const f = S.final, max = f.max[me] || 400;
      if (f.wagered.includes(me) || didSend("wager")) return wait("Wager locked ✓", "Waiting for the other teams.");
      let val = Math.min(max, Math.round(max / 2 / 50) * 50);
      const out = h("div", { class: "wager gold" }, val);
      const slider = h("input", { type: "range", min: "0", max: String(max), step: "10", value: String(val), oninput() { val = Number(this.value); out.textContent = val; } });
      const set = v => { val = v; slider.value = String(v); out.textContent = v; };
      return h("div", { class: "pcard center" },
        h("div", { class: "dim" }, "Final category"), h("h1", {}, f.cat),
        h("p", { class: "dim" }, `You have ${my.score}. Wager up to ${max}.`),
        out, slider,
        h("div", { class: "row center-row" }, h("button", { class: "btn small", onclick: () => set(0) }, "0"), h("button", { class: "btn small", onclick: () => set(Math.round(max / 2)) }, "Half"), h("button", { class: "btn small", onclick: () => set(max) }, "All in")),
        bigBtn("Lock in wager", () => send({ t: "wager", n: val })));
    }

    if (p === "final_question") {
      const f = S.final;
      if (f.answered.includes(me) || didSend("final")) return wait("Answer locked ✓", "Waiting for the other teams.");
      const input = h("input", { type: "text", maxlength: "80", placeholder: "Type your answer", autocomplete: "off", autocapitalize: "sentences" });
      const submit = () => { if (input.value.trim()) send({ t: "final", text: input.value.trim() }); };
      input.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
      return h("div", { class: "pcard" }, h("h1", { class: "center" }, "Final answer"), h("p", { class: "dim center" }, "Read the question on the TV. Spelling doesn't have to be perfect."), input, bigBtn("Lock in answer", submit));
    }

    if (p === "final_reveal") return wait("The reveal", "Watch the TV.");
    if (p === "final_done") return h("div", { class: "pcard center" }, h("h1", {}, "That's the game"), h("p", { class: "dim lead" }, "Any disputes? Settle them at the laptop."), didSend("next") ? null : bigBtn("See the winner", () => send({ t: "next" })));

    if (p === "winner") {
      const won = (S.winners || []).includes(me);
      const rank = S.order.slice().sort((x, y) => team(y).score - team(x).score).indexOf(me) + 1;
      return h("div", { class: "pcard center" }, h("h1", { class: won ? "gold" : "" }, won ? "🏆 You won!" : `You finished #${rank}`), h("p", { class: "lead" }, `${my.score} points`), h("p", { class: "dim" }, "Rematch or new game? Choose on the laptop."));
    }
    return wait("Hang on...");
  }

  function header() {
    const my = mine();
    const rules = h("button", { class: "btn small rulesbtn", onclick: FTN.showRules }, "Rules");
    if (!my) return h("header", { class: "pbar" }, h("div", { class: "logo" }, "Family Trivia Night"), room && h("span", { class: "roomtag" }, room), rules);
    return h("header", { class: "pbar", style: `border-color:${my.color}` }, FTN.avatar(my), h("div", { class: "nm" }, my.name), h("div", { class: "pts gold" }, my.score), rules);
  }

  // Only rebuild the screen when something that matters to this phone changed, so typing is never interrupted.
  function render() {
    if (S && S.phase === "lobby" && !mine() && !pendingJoin && !isFull() && patchJoin()) return;
    if (S && mine()) pendingJoin = false;
    const my = mine();
    const key = !S ? "none" + hadGame : [S.phase, S.step, !!my, my && my.score, (S.locked || []).includes(me), S.final && S.final.wagered.includes(me), S.final && S.final.answered.includes(me), pendingJoin, isFull()].join("|");
    if (key === viewKey) return;
    viewKey = key; renderNow();
  }
  function renderNow() {
    let body;
    if (!T) body = viewEnterCode();
    else if (!S) body = hadGame ? wait("That game has ended", "For the next one, scan the new code on the TV.") : wait("Connecting...", "Looking for the game.");
    else body = viewGame();
    app.replaceChildren(header(), body);
  }

  const start = FTN.SIM ? "SIMS" : (FTN.params.get("room") || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
  if (start.length === 4) connect(start); else { room = store.get("ftn2.room", ""); renderNow(); }
})(window.FTN);
