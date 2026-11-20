"use strict";
/* The host page. It runs on the laptop connected to the TV and is the brain of the game:
   it holds the API key, calls Claude, keeps score and knows the answers.
   G is the private game state. pub() builds the public state that phones are allowed to see. */
(function (FTN) {
  const { h, store, shuffle, ai } = FTN;
  const app = document.getElementById("app");

  const TIMER = 30000, WAGER_TIME = 60000, FINAL_TIME = 45000, REVEAL_STEP = 3500, SD_ROUNDS = 3;
  const MAX_TEAMS = (FTN.SIM && Number(FTN.params.get("max"))) || 8, MIN_WAGER_CAP = 400;   // ?max= is a simulator-only test hook
  const ERAS = ["1950s", "1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s", "any", "any"];
  const TEST_FAST = FTN.params.get("fast") === "1";           // shortens timers for automated tests
  const ms = n => TEST_FAST ? Math.min(n, 400) : n;

  let cfg = Object.assign({ turns: 5, cats: FTN.CATEGORIES.slice() }, store.get("ftn2.cfg", {}));
  // If the category list has changed since this browser last saved its picks, start again with all of them on.
  if (cfg.known !== FTN.CATEGORIES.join("|")) { cfg.cats = FTN.CATEGORIES.slice(); cfg.known = FTN.CATEGORIES.join("|"); }
  let T = null, G = null, rawTeams = {}, timer = null, stopClock = null, setupError = "", busy = false;

  // Questions and answers that have been shown are remembered in this browser between game nights,
  // so the same friends do not get the same questions next month. Models return to the same favorites otherwise.
  // Only trivia text is kept: no team names, no scores, no key. The setup screen has a button to clear it.
  const KEEP = { asked: 300, answers: 400, finals: 80 };
  const memory = {
    get(k) { const v = store.get(k, []); return Array.isArray(v) ? v : []; },
    set(k, v) { store.set(k, v); },
    clear() { ["ftn2.asked", "ftn2.answers", "ftn2.finals"].forEach(k => store.del(k)); }
  };
  // Only questions that were actually shown on the TV are remembered. Each turn Claude writes four and
  // the team sees one, so remembering all four would fill the list with questions nobody saw.
  function remember(question, answer) {
    G.asked.push(question);
    G.usedAnswers = G.usedAnswers || [];
    if (answer) G.usedAnswers.push(answer);
    if (!G.demo) { memory.set("ftn2.asked", G.asked.slice(-KEEP.asked)); memory.set("ftn2.answers", G.usedAnswers.slice(-KEEP.answers)); }
  }

  /* ================= engine ================= */
  const activeId = () => G.order[G.turnIdx % G.order.length];
  const eligible = () => G.mode === "sd" ? G.sd.ids : G.order;
  const totalTurns = () => G.order.length * G.cfg.turns;
  const maxWager = id => Math.max(G.teams[id].score, MIN_WAGER_CAP);
  const rand = a => a[Math.floor(Math.random() * a.length)];

  function setTimer(n, fn) { clearTimeout(timer); G.deadline = Date.now() + ms(n); timer = setTimeout(fn, ms(n)); }
  function clearTimer() { clearTimeout(timer); timer = null; if (G) G.deadline = null; }
  // Every phase change bumps "step". Phones echo it back, so a late tap from an old screen is ignored.
  function go(phase) { G.phase = phase; G.step++; }

  function rebuildTeams() {
    // Spots go to teams in the order the host first saw them, so a late phone can never bump a team that is already in.
    const valid = id => rawTeams[id] && typeof rawTeams[id].name === "string";
    G.joinOrder = (G.joinOrder || []).filter(valid);
    Object.keys(rawTeams).filter(id => valid(id) && !G.joinOrder.includes(id))
      .sort((a, b) => (rawTeams[a].at || 0) - (rawTeams[b].at || 0)).forEach(id => G.joinOrder.push(id));
    const ids = G.joinOrder.slice(0, MAX_TEAMS);
    const used = new Set(), teams = {};
    ids.forEach((id, i) => {
      const r = rawTeams[id];
      let emoji = FTN.EMOJI.includes(r.emoji) && !used.has(r.emoji) ? r.emoji : FTN.EMOJI.find(e => !used.has(e));
      used.add(emoji);
      teams[id] = { name: r.name.trim().slice(0, 24) || "Team " + (i + 1), emoji, color: FTN.COLORS[i % FTN.COLORS.length], score: 0 };
    });
    G.teams = teams; G.order = ids;
  }

  function startGame() {
    if (G.order.length < 2) return;
    G.order = shuffle(G.order); G.turnIdx = 0;
    beginTurn();
  }

  function beginTurn() {
    clearTimer();
    G.mode = "turn"; G.pick = null; G.q = null; G.reveal = null; G.error = null;
    if (G.demo) { G.cards = ai.demoCards(); G.cardsReady = true; }
    else {
      const cats = shuffle(G.cfg.cats).slice(0, 4), vals = shuffle(FTN.VALUES);
      G.cards = cats.map((cat, i) => ({ cat, value: vals[i], era: rand(ERAS), q: null }));
      G.cardsReady = false;
    }
    G.cards.sort((a, b) => a.value - b.value);
    go("intro"); publish();
    if (!G.cardsReady) loadCards();
  }
  // Claude writes all four questions while the team is getting ready, so the pick feels instant.
  function loadCards() {
    const token = G.loadToken = (G.loadToken || 0) + 1;
    G.error = null;
    ai.turnQuestions(G.cards, G.asked, G.usedAnswers).then(qs => {
      if (!G || token !== G.loadToken) return;
      qs.forEach((q, i) => { G.cards[i].q = q; });
      G.cardsReady = true;
      if (G.phase === "writing") startQuestion(); else save();
    }).catch(e => { if (G && token === G.loadToken) { G.error = e.message; publish(); } });
  }

  function startQuestion() {
    const c = G.cards[G.pick];
    askQuestion({ cat: c.cat, value: c.value, question: c.q.question, correct: c.q.correct, wrong: c.q.wrong, fact: c.q.fact });
  }
  function askQuestion(q) {
    // Answer order is shuffled here, so the correct position never depends on the model.
    const options = shuffle([q.correct, ...q.wrong]);
    G.q = { cat: q.cat, value: q.value, text: q.question, options, answer: options.indexOf(q.correct), fact: q.fact };
    remember(q.question, q.correct);
    G.answers = {}; G.error = null;
    go("question"); setTimer(TIMER, resolveQuestion); publish();
  }

  function resolveQuestion() {
    clearTimer();
    const q = G.q;
    if (G.mode === "sd") {
      const right = G.sd.ids.filter(id => G.answers[id] === q.answer);
      G.reveal = { answer: q.answer, sd: true, right, fact: q.fact, deltas: {} };
      go("reveal"); publish();
      setTimer(6000, afterSuddenDeath);
      return;
    }
    const active = activeId(), choice = G.answers[active], ok = choice === q.answer;
    const deltas = {}, steals = [];
    if (ok) deltas[active] = q.value;
    else for (const id of G.order) if (id !== active && G.answers[id] === q.answer) { steals.push(id); deltas[id] = q.value / 2; }
    for (const id in deltas) G.teams[id].score += deltas[id];
    G.reveal = { answer: q.answer, choice: choice == null ? null : choice, ok, steals, deltas, fact: q.fact };
    go("reveal"); publish();
  }
  function nextTurn() {
    if (G.phase !== "reveal" || G.mode !== "turn") return;
    G.turnIdx++;
    if (G.turnIdx >= totalTurns()) startFinal(); else beginTurn();
  }

  /* ----- final round ----- */
  function startFinal() {
    clearTimer();
    G.final = { q: null, wagers: {}, answers: {}, results: [], shown: 0 };
    G.error = null; G.reveal = null; G.q = null;
    go("final_loading"); publish(); loadFinal();
  }
  function loadFinal() {
    const token = G.loadToken = (G.loadToken || 0) + 1;
    G.error = null;
    // The category and era are drawn here, at random, so the final does not converge on the same subject every game.
    (G.demo ? Promise.resolve(ai.demoFinal()) : ai.finalQuestion(rand(G.cfg.cats), rand(ERAS), G.asked, memory.get("ftn2.finals"))).then(q => {
      if (!G || token !== G.loadToken) return;
      G.final.q = q;
      if (!G.demo) { remember(q.question, q.answer); memory.set("ftn2.finals", memory.get("ftn2.finals").concat(q.answer).slice(-KEEP.finals)); }
      go("final_wager"); setTimer(WAGER_TIME, startFinalQuestion); publish();
    }).catch(e => { if (G && token === G.loadToken) { G.error = e.message; publish(); } });
  }
  function startFinalQuestion() {
    clearTimer();
    for (const id of G.order) if (!(id in G.final.wagers)) G.final.wagers[id] = 0;
    go("final_question"); setTimer(FINAL_TIME, judgeFinal); publish();
  }
  function judgeFinal() {
    clearTimer();
    for (const id of G.order) if (!(id in G.final.answers)) G.final.answers[id] = "";
    go("final_judging"); publish();
    const f = G.final, list = G.order.map(id => ({ id, text: f.answers[id] })), typed = list.filter(a => a.text);
    const verdicts = (G.demo || !typed.length) ? Promise.resolve(ai.localJudge(f.q, list))
      : ai.judge(f.q, typed).catch(() => { f.fallback = true; return ai.localJudge(f.q, list); });   // never strand the game on a judging error
    verdicts.then(v => {
      if (!G || G.phase !== "final_judging") return;
      // Reveal order: last place first.
      f.results = G.order.slice().sort((a, b) => G.teams[a].score - G.teams[b].score).map(id => {
        const r = { id, answer: f.answers[id], wager: f.wagers[id], correct: !!v[id], before: G.teams[id].score };
        r.after = r.before + (r.correct ? r.wager : -r.wager);
        return r;
      });
      f.shown = 0;
      go("final_reveal"); publish(); stepReveal();
    });
  }
  // Two beats per team: first the answer, then the verdict with the wager and new score.
  function stepReveal() {
    setTimer(REVEAL_STEP, () => {
      G.final.shown++;
      if (G.final.shown >= 2 * G.final.results.length) { clearTimer(); go("final_done"); publish(); }
      else { publish(); stepReveal(); }
    });
  }
  function overrule(i) {
    if (G.phase !== "final_done") return;
    const r = G.final.results[i];
    r.correct = !r.correct; r.overruled = !r.overruled;
    r.after = r.before + (r.correct ? r.wager : -r.wager);
    publish();
  }
  function finish() {
    if (G.phase !== "final_done") return;
    for (const r of G.final.results) G.teams[r.id].score = r.after;
    const top = Math.max(...G.order.map(id => G.teams[id].score));
    const tied = G.order.filter(id => G.teams[id].score === top);
    if (tied.length > 1) { G.sd = { ids: tied, round: 1 }; startSuddenDeath(); } else win(tied);
  }

  /* ----- sudden death ----- */
  function startSuddenDeath() {
    clearTimer();
    G.mode = "sd"; G.error = null; G.reveal = null;
    go("sd_loading"); publish();
    const token = G.loadToken = (G.loadToken || 0) + 1;
    const cat = rand(G.cfg.cats);
    (G.demo ? Promise.resolve(ai.demoSuddenDeath())
      : ai.turnQuestions([{ cat, value: 400, era: "any" }], G.asked, G.usedAnswers).then(qs => Object.assign({ cat }, qs[0]))).then(q => {
      if (!G || token !== G.loadToken) return;
      setTimeout(() => { if (G && token === G.loadToken) askQuestion(Object.assign({ value: 400 }, q)); }, ms(2500));
    }).catch(e => { if (G && token === G.loadToken) { G.error = e.message; publish(); } });
  }
  function afterSuddenDeath() {
    const right = G.reveal.right;
    if (right.length === 1) return win(right);
    if (right.length > 1) G.sd.ids = right;
    G.sd.round++;
    if (G.sd.round > SD_ROUNDS) win(G.sd.ids); else startSuddenDeath();
  }
  function win(ids) { clearTimer(); G.winners = ids; go("winner"); publish(); confetti(); }

  // Rematch: same room, same teams and phones, scores back to zero, new turn order.
  // Questions already asked tonight stay on the avoid list, so the rematch gets fresh ones.
  function rematch() {
    if (G.phase !== "winner") return;
    clearTimer();
    for (const id of G.order) G.teams[id].score = 0;
    G.order = shuffle(G.order); G.turnIdx = 0;
    G.final = null; G.sd = null; G.winners = null;
    G.demo = !ai.hasKey();
    beginTurn();
  }

  function retry() {
    if (G.phase === "final_loading") loadFinal();
    else if (G.phase === "sd_loading") startSuddenDeath();
    else loadCards();
    publish();
  }

  /* ----- input from phones ----- */
  function onInput(id, m) {
    if (!G || !m || typeof m !== "object" || !G.teams[id] || m.step !== G.step) return;
    const active = activeId();
    switch (G.phase) {
      case "intro":
        if (m.t === "ready" && id === active) { go("pick"); publish(); }
        break;
      case "pick":
        if (m.t === "pick" && id === active && Number.isInteger(m.i) && G.cards[m.i]) {
          G.pick = m.i;
          if (G.cardsReady) startQuestion(); else { go("writing"); publish(); }
        }
        break;
      case "question":
        if (m.t === "answer" && [0, 1, 2, 3].includes(m.i) && eligible().includes(id) && !(id in G.answers)) {
          G.answers[id] = m.i;
          // The moment the active team answers, steals close. Answering fast is the active team's defense.
          if (G.mode === "turn" && id === active) return resolveQuestion();
          if (G.mode === "sd" && eligible().every(t => t in G.answers)) return resolveQuestion();
          publish();
        }
        break;
      case "reveal":
        if (m.t === "next" && G.mode === "turn" && id === active) nextTurn();
        break;
      case "final_wager":
        if (m.t === "wager" && !(id in G.final.wagers)) {
          G.final.wagers[id] = Math.min(maxWager(id), Math.max(0, Math.round(Number(m.n) || 0)));
          if (G.order.every(t => t in G.final.wagers)) startFinalQuestion(); else publish();
        }
        break;
      case "final_question":
        if (m.t === "final" && !(id in G.final.answers)) {
          G.final.answers[id] = String(m.text == null ? "" : m.text).slice(0, 80).trim();
          if (G.order.every(t => t in G.final.answers)) judgeFinal(); else publish();
        }
        break;
      case "final_done":
        if (m.t === "next") finish();
        break;
    }
  }

  /* ----- public state: everything phones are allowed to know, and nothing else ----- */
  function pub() {
    const p = G.phase, f = G.final;
    const S = { code: G.code, phase: p, step: G.step, demo: G.demo, order: G.order, teams: {}, turns: G.cfg.turns, max: MAX_TEAMS, error: G.error || null,
      tLeft: G.deadline ? Math.max(0, G.deadline - Date.now()) : null };
    const revealed = {};
    if (f && (p === "final_reveal" || p === "final_done")) f.results.forEach((r, i) => { if (f.shown >= 2 * i + 2) revealed[r.id] = r.after; });
    for (const id of G.order) {
      const t = G.teams[id];
      S.teams[id] = { name: t.name, emoji: t.emoji, color: t.color, score: id in revealed ? revealed[id] : t.score };
    }
    if (["intro", "pick", "writing", "question", "reveal"].includes(p) && G.mode === "turn") S.turn = { n: G.turnIdx + 1, total: totalTurns(), team: activeId() };
    if (p === "pick" || p === "writing") { S.cards = G.cards.map(c => ({ cat: c.cat, value: c.value })); S.pick = G.pick; }
    if (p === "question" || p === "reveal") {
      S.q = { cat: G.q.cat, value: G.q.value, text: G.q.text, options: G.q.options, mode: G.mode, eligible: eligible() };
      S.locked = Object.keys(G.answers);
      if (p === "reveal") S.reveal = G.reveal;                       // the correct answer leaves the laptop only here
    }
    if (G.mode === "sd" && G.sd) S.sd = { ids: G.sd.ids, round: G.sd.round };
    if (f && p.startsWith("final_") && f.q) {
      S.final = { cat: f.q.cat, wagered: Object.keys(f.wagers), answered: Object.keys(f.answers), max: {} };
      for (const id of G.order) S.final.max[id] = maxWager(id);
      if (p !== "final_wager") S.final.question = f.q.question;
      if (p === "final_reveal" || p === "final_done") {
        S.final.answer = f.q.answer; S.final.fact = f.q.fact; S.final.shown = f.shown; S.final.fallback = !!f.fallback;
        S.final.results = f.results.map((r, i) => Object.assign({ id: r.id, before: r.before },
          f.shown >= 2 * i + 1 ? { answer: r.answer } : null,
          f.shown >= 2 * i + 2 ? { correct: r.correct, wager: r.wager, after: r.after, overruled: !!r.overruled } : null));
      }
    }
    if (p === "winner") S.winners = G.winners;
    return S;
  }
  function publish() {
    const S = pub();
    T.setPublic(S);
    render(S);
    save();
  }
  function save() { if (!FTN.SIM) store.set("ftn2.host", { at: Date.now(), G }); }

  /* ----- create, resume, end ----- */
  const CODE_LETTERS = "BCDFGHJKLMNPQRSTVWXZ";                    // no vowels, so no accidental words
  const newCode = () => Array.from({ length: 4 }, () => rand(CODE_LETTERS.split(""))).join("");

  async function createGame() {
    if (busy) return;
    setupError = "";
    if (cfg.cats.length < 4) { setupError = "Pick at least four categories."; return render(); }
    busy = true; render();
    try {
      T = await FTN.connect();
      const code = FTN.SIM ? "SIMS" : newCode();
      await T.createRoom(code);
      G = { code, phase: "lobby", step: 0, demo: !ai.hasKey(), cfg: { turns: cfg.turns, cats: cfg.cats.slice() }, teams: {}, order: [], turnIdx: 0, asked: ai.hasKey() ? memory.get("ftn2.asked") : [], usedAnswers: ai.hasKey() ? memory.get("ftn2.answers") : [], mode: "turn" };
      wire(); publish();
    } catch (e) { setupError = e.message; T = null; }
    busy = false; if (!G) render();
  }
  function wire() {
    T.onTeams(t => { rawTeams = t || {}; if (G && G.phase === "lobby") { rebuildTeams(); publish(); } });
    T.onInput(onInput);
  }
  async function resumeGame(saved) {
    if (busy) return;
    if (!saved.G.demo && !ai.hasKey()) { setupError = "Paste your API key first, then resume."; return render(); }
    busy = true; setupError = ""; render();
    try {
      T = await FTN.connect();
      await T.createRoom(saved.G.code);
      G = saved.G; G.loadToken = 0; G.deadline = null; G.error = null;
      wire();
      const p = G.phase;
      if (["intro", "pick", "writing"].includes(p) && !G.cardsReady) loadCards();
      else if (p === "question") setTimer(TIMER, resolveQuestion);
      else if (p === "reveal" && G.mode === "sd") setTimer(3000, afterSuddenDeath);
      else if (p === "final_loading") loadFinal();
      else if (p === "final_wager") setTimer(WAGER_TIME, startFinalQuestion);
      else if (p === "final_question") setTimer(FINAL_TIME, judgeFinal);
      else if (p === "final_judging") judgeFinal();
      else if (p === "final_reveal") stepReveal();
      else if (p === "sd_loading") startSuddenDeath();
      publish();
    } catch (e) { setupError = e.message; T = null; G = null; }
    busy = false; if (!G) render();
  }
  function endGame() {
    clearTimer();
    if (T) T.closeRoom();
    store.del("ftn2.host");
    G = null; rawTeams = {};
    render();
  }

  /* ================= TV screens ================= */
  const team = (S, id) => S.teams[id] || { name: "?", emoji: "❓", color: "#445", score: 0 };

  function viewSetup() {
    const saved = store.get("ftn2.host", null);
    const canResume = !FTN.SIM && saved && saved.G && saved.G.phase !== "winner" && Date.now() - saved.at < 6 * 3600 * 1000;
    const s = ai.settings;
    const known = ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"];
    return h("div", { class: "setup" },
      h("h1", { class: "title" }, "Family Trivia Night", h("span", { class: "gold" }, " Party Edition")),
      h("p", { style: "margin:-10px 0 18px" }, h("button", { class: "btn small", onclick: FTN.showRules }, "How to play")),
      canResume && h("div", { class: "panel row spread" },
        h("span", {}, `A game is in progress in room ${saved.G.code}.`),
        h("div", { class: "row" }, h("button", { class: "btn gold", onclick: () => resumeGame(saved) }, "Resume it"),
          h("button", { class: "btn", onclick() { store.del("ftn2.host"); render(); } }, "Discard"))),
      h("div", { class: "panel" },
        h("h2", {}, "1. Claude API key"),
        h("input", { type: "password", id: "key", placeholder: "sk-ant-...", autocomplete: "off", spellcheck: "false", value: s.apiKey,
          oninput() { s.apiKey = this.value.trim(); ai.saveSettings(); } }),
        h("p", { class: "dim small" }, "Kept only until you close this tab, and sent only to api.anthropic.com. Phones never see it. Leave it empty to play with the built-in demo questions."),
        h("label", { class: "lbl" }, "Model"),
        h("select", { onchange() { s.model = this.value; ai.saveSettings(); } },
          [...new Set([...known, s.model])].map(m => h("option", { value: m, selected: m === s.model }, m)))),
      h("div", { class: "panel" },
        h("h2", {}, "2. Game options"),
        h("label", { class: "lbl" }, "Turns per team"),
        h("div", { class: "seg" }, [3, 4, 5, 6, 8].map(n => h("button", { "aria-pressed": String(cfg.turns === n), onclick() { cfg.turns = n; store.set("ftn2.cfg", cfg); render(); } }, n))),
        h("label", { class: "lbl" }, "Categories in play (four are drawn each turn)"),
        h("div", { class: "chips" }, FTN.CATEGORIES.map(c => h("button", { class: "chip", "aria-pressed": String(cfg.cats.includes(c)), onclick() {
          cfg.cats = cfg.cats.includes(c) ? cfg.cats.filter(x => x !== c) : cfg.cats.concat(c);
          store.set("ftn2.cfg", cfg); this.setAttribute("aria-pressed", String(cfg.cats.includes(c)));
        } }, c)))),
      setupError && h("div", { class: "error" }, setupError),
      !FTN.SIM && !FTN.firebaseReady() && h("div", { class: "panel dim" }, "Firebase is not set up yet, so phones cannot join. Open ", h("a", { href: "simulator.html" }, "simulator.html"), " to test the full game on this laptop."),
      h("button", { class: "btn gold big", disabled: busy, onclick: createGame }, busy ? "Creating..." : "Create game"),
      (() => {
        const n = memory.get("ftn2.asked").length;
        return h("p", { class: "dim small", style: "margin-top:18px" },
          n ? `This browser remembers ${n} past question${n === 1 ? "" : "s"} so new games do not repeat them. ` : "Questions you play are remembered in this browser so later games do not repeat them. ",
          n ? h("button", { class: "btn small ghost", onclick() { if (confirm("Forget all remembered questions? Future games may repeat old ones.")) { memory.clear(); render(); } } }, "Clear question history") : null);
      })());
  }

  function scoreboard(S) {
    const active = S.turn && S.turn.team, locked = S.locked || [];
    const fin = S.final || {};
    return h("div", { class: "scores" }, S.order.map(id => {
      const t = team(S, id);
      const tick = (S.phase === "question" && locked.includes(id)) || (S.phase === "final_wager" && (fin.wagered || []).includes(id)) || (S.phase === "final_question" && (fin.answered || []).includes(id));
      const out = S.q && S.q.mode === "sd" && !S.q.eligible.includes(id);
      return h("div", { class: "score" + (id === active ? " active" : "") + (out ? " out" : ""), style: `border-color:${t.color}` },
        FTN.avatar(t), h("div", { class: "who" }, h("div", { class: "nm" }, t.name), h("div", { class: "pts" }, t.score)),
        tick && h("span", { class: "tick" }, "✓ locked"));
    }));
  }
  const clock = () => h("div", { class: "clock", id: "clock" }, "");
  const errorBox = () => G.error && h("div", { class: "error" }, G.error, " ", h("button", { class: "btn small", onclick: retry }, "Retry"));

  function viewLobby(S) {
    const joinUrl = location.href.replace(/[^/]*$/, "") + "play.html?room=" + S.code;
    let qrImg = null;
    if (!FTN.SIM && typeof qrcode === "function") {
      try { const q = qrcode(0, "M"); q.addData(joinUrl); q.make(); qrImg = h("img", { class: "qr", alt: "QR code to join", src: q.createDataURL(8, 2) }); } catch {}
    }
    const n = S.order.length;
    return h("div", { class: "lobby" },
      h("div", { class: "join" },
        h("div", { class: "kicker" }, "Join on one phone per team"),
        qrImg,
        h("div", { class: "code" }, S.code),
        h("p", {}, "New here? Tap ", h("b", { class: "gold" }, "Rules"), " on your phone."),
        FTN.SIM ? h("p", { class: "dim" }, "Simulator: use the three phones on this page.") : h("p", { class: "dim small url" }, joinUrl),
        S.demo && h("p", { class: "dim small" }, "Demo questions (no API key set).")),
      h("div", { class: "roster" },
        h("div", { class: "kicker" }, n >= S.max ? `All ${S.max} team spots are taken` : n ? `${n} team${n === 1 ? "" : "s"} in` : "Waiting for teams..."),
        S.order.map(id => { const t = team(S, id); return h("div", { class: "rteam", style: `border-color:${t.color}` }, FTN.avatar(t, "lg"), h("div", { class: "nm" }, t.name)); }),
        h("button", { class: "btn gold big", disabled: n < 2, onclick: startGame }, n < 2 ? "Need at least 2 teams" : "Start the game")));
  }

  function viewIntro(S) {
    const t = team(S, S.turn.team);
    return h("div", { class: "stage center" },
      h("div", { class: "kicker" }, `Turn ${S.turn.n} of ${S.turn.total}`),
      h("div", { class: "spot" }, FTN.avatar(t, "xl")),
      h("h1", { class: "big-name", style: `color:${t.color}` }, t.name),
      h("p", { class: "lead" }, "You're up. Tap ", h("b", {}, "We're ready"), " on your phone."),
      errorBox());
  }
  function viewPick(S) {
    const t = team(S, S.turn.team), writing = S.phase === "writing";
    return h("div", { class: "stage center" },
      h("div", { class: "kicker" }, FTN.avatar(t), ` ${t.name}, `, writing ? "good choice" : "pick a category"),
      h("div", { class: "cards" }, S.cards.map((c, i) => h("div", { class: "card" + (S.pick === i ? " picked" : "") + (writing && S.pick !== i ? " faded" : "") },
        h("div", { class: "cat" }, c.cat), h("div", { class: "val" }, c.value)))),
      writing && !G.error && h("p", { class: "lead pulse" }, "Writing your question..."),
      errorBox());
  }
  function viewQuestion(S) {
    const q = S.q, r = S.reveal, sd = q.mode === "sd";
    const options = h("div", { class: "opts" }, q.options.map((o, i) => {
      let cls = "opt";
      if (r) cls += i === r.answer ? " right" : (!sd && i === r.choice ? " wrong" : " faded");
      return h("div", { class: cls }, h("span", { class: "key" }, FTN.LETTERS[i]), h("span", {}, o));
    }));
    let verdict = null;
    if (r && sd) {
      verdict = h("div", { class: "verdict" }, r.right.length ? ["Correct: ", r.right.map(id => team(S, id).name).join(", ")] : "Nobody got it. Again!");
    } else if (r) {
      const a = team(S, S.turn.team);
      verdict = h("div", { class: "verdict" },
        r.ok ? [h("b", { style: `color:${a.color}` }, a.name), ` nailed it: +${q.value}`]
          : [h("b", { style: `color:${a.color}` }, a.name), r.choice == null ? " ran out of time. " : " missed. ",
            r.steals.length ? ["Stolen by ", r.steals.map((id, i) => [i ? ", " : "", h("b", { style: `color:${team(S, id).color}` }, team(S, id).name)]), ` for +${q.value / 2}`] : "No steals."]);
    }
    return h("div", { class: "stage" },
      h("div", { class: "row spread" },
        h("div", { class: "kicker" }, sd ? `Sudden death, round ${S.sd.round}` : [q.cat, " · ", h("span", { class: "gold" }, q.value)]),
        !r && clock()),
      h("div", { class: "qtext" }, q.text),
      options,
      verdict,
      r && r.fact && h("p", { class: "fact" }, "💡 ", r.fact),
      r && !sd && h("p", { class: "dim center" }, `${team(S, S.turn.team).name}: tap Next on your phone. `, h("button", { class: "btn small", onclick: nextTurn }, "Next ▸")));
  }
  function viewFinal(S) {
    const p = S.phase, f = S.final;
    if (p === "final_loading" || !f) return h("div", { class: "stage center" }, h("h1", { class: "mega gold" }, "Final Round"), h("p", { class: "lead pulse" }, G.error ? "" : "Preparing the final question..."), errorBox());
    if (p === "final_wager") return h("div", { class: "stage center" },
      h("div", { class: "kicker" }, "Final round · the category is"), h("h1", { class: "mega gold" }, f.cat),
      h("p", { class: "lead" }, "Place your wagers on your phone."), clock());
    if (p === "final_question") return h("div", { class: "stage" },
      h("div", { class: "row spread" }, h("div", { class: "kicker" }, "Final · ", f.cat), clock()),
      h("div", { class: "qtext" }, f.question), h("p", { class: "lead center" }, "Type your answer on your phone."));
    if (p === "final_judging") return h("div", { class: "stage center" }, h("div", { class: "kicker" }, "Final · ", f.cat), h("div", { class: "qtext" }, f.question), h("p", { class: "lead pulse" }, "The judges are conferring..."));
    const done = p === "final_done";
    return h("div", { class: "stage" },
      h("div", { class: "kicker" }, "Final · ", f.cat),
      h("div", { class: "qsmall" }, f.question),
      h("div", { class: "answerline" }, "Answer: ", h("b", { class: "gold" }, f.answer)),
      h("div", { class: "results" }, f.results.map((r, i) => {
        const t = team(S, r.id), seen = "answer" in r, judged = "correct" in r;
        return h("div", { class: "result" + (seen ? "" : " hidden") + (judged ? (r.correct ? " ok" : " bad") : ""), style: `border-color:${t.color}` },
          FTN.avatar(t), h("div", { class: "nm" }, t.name),
          h("div", { class: "ans" }, seen ? (r.answer || "(no answer)") : "?"),
          h("div", { class: "wag" }, judged ? `${r.correct ? "+" : "−"}${r.wager}` : ""),
          h("div", { class: "pts" }, judged ? r.after : r.before),
          done && h("button", { class: "btn small", onclick: () => overrule(i) }, r.overruled ? "Undo overrule" : "Overrule"));
      })),
      done && h("div", { class: "center" },
        f.fallback && h("p", { class: "dim small" }, "Claude could not be reached for judging, so answers were matched by text. Check the rulings."),
        f.fact && h("p", { class: "fact" }, "💡 ", f.fact),
        h("button", { class: "btn gold big", onclick: finish }, "Crown the champion")));
  }
  function viewSdLoading(S) {
    return h("div", { class: "stage center" }, h("h1", { class: "mega gold" }, "Sudden Death"),
      h("p", { class: "lead" }, "Tied: ", S.sd.ids.map(id => team(S, id).name).join(" vs ")),
      h("p", { class: "dim lead" }, "One question. Miss it and you're out."), errorBox());
  }
  function viewWinner(S) {
    const sorted = S.order.slice().sort((a, b) => team(S, b).score - team(S, a).score);
    const w = S.winners.map(id => team(S, id));
    return h("div", { class: "stage center" },
      h("div", { class: "spot" }, w.map(t => FTN.avatar(t, "xl"))),
      h("div", { class: "kicker" }, w.length > 1 ? "Co-champions" : "Champions"),
      h("h1", { class: "mega gold" }, "🏆 ", w.map(t => t.name).join(" & ")),
      h("div", { class: "results narrow" }, sorted.map((id, i) => { const t = team(S, id); return h("div", { class: "result", style: `border-color:${t.color}` }, h("div", { class: "pos" }, i + 1), FTN.avatar(t), h("div", { class: "nm" }, t.name), h("div", { class: "pts" }, t.score)); })),
      h("div", { class: "row center-row" },
        h("button", { class: "btn gold big", onclick: rematch }, "Rematch with the same teams"),
        h("button", { class: "btn big", onclick: endGame }, "New game with new teams")),
      h("p", { class: "dim small" }, "A rematch keeps everyone's phones connected. A new game makes a new code for teams to scan."));
  }

  function render(S) {
    if (stopClock) { stopClock(); stopClock = null; }
    if (!G) { app.replaceChildren(viewSetup()); return; }
    S = S || pub();
    const p = S.phase;
    const view = p === "lobby" ? viewLobby(S) : p === "intro" ? viewIntro(S) : (p === "pick" || p === "writing") ? viewPick(S)
      : (p === "question" || p === "reveal") ? viewQuestion(S) : p === "sd_loading" ? viewSdLoading(S) : p === "winner" ? viewWinner(S) : viewFinal(S);
    app.replaceChildren(
      h("header", { class: "bar" },
        h("div", { class: "logo" }, "Family Trivia Night"),
        h("div", { class: "row" }, p !== "lobby" && h("span", { class: "roomtag" }, "Room ", S.code),
          h("button", { class: "btn small ghost", onclick: FTN.showRules }, "Rules"),
          h("button", { class: "btn small ghost", onclick() { if (confirm("End this game for everyone?")) endGame(); } }, "End game"))),
      view,
      ...(p !== "lobby" && p !== "winner" ? [scoreboard(S)] : []));
    const c = document.getElementById("clock");
    if (c && G.deadline) stopClock = FTN.countdown(G.deadline - Date.now(), s => { c.textContent = s; c.classList.toggle("low", s <= 5); });
  }

  // Laptop backup for the phone's Next button.
  document.addEventListener("keydown", e => {
    if (!G || /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(e.target.tagName)) return;
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); nextTurn(); }
  });

  function confetti() {
    const c = document.getElementById("confetti");
    let ctx; try { ctx = c.getContext("2d"); } catch { return; }
    if (!ctx || (window.matchMedia && matchMedia("(prefers-reduced-motion:reduce)").matches)) return;
    const W = c.width = innerWidth, H = c.height = innerHeight;
    const cols = ["#FFC940", "#FF5A5F", "#3DA5FF", "#2BD4A4", "#B18CFF", "#FFFFFF"];
    const bits = Array.from({ length: 180 }, () => ({ x: Math.random() * W, y: -20 - Math.random() * H * .6, w: 6 + Math.random() * 8, h: 8 + Math.random() * 10,
      vx: -2 + Math.random() * 4, vy: 2 + Math.random() * 4, r: Math.random() * 6, vr: -.2 + Math.random() * .4, c: rand(cols) }));
    const t0 = performance.now();
    (function frame(t) {
      ctx.clearRect(0, 0, W, H);
      for (const b of bits) { b.x += b.vx; b.y += b.vy; b.r += b.vr; b.vy += .03; ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.c; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.restore(); }
      if (t - t0 < 6000 && G && G.phase === "winner") requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
    })(t0);
  }

  render();
})(window.FTN);
