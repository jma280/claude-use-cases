# Family Trivia Night: Party Edition

A game-show style trivia night for the living room. The TV is the board, each team's phone is its controller, and Claude does the work.

![A question on the TV while two teams have locked in steal attempts on their phones](docs/steal.png)

## The Problem

Holiday trivia with a mixed crowd usually goes one of two ways. Someone reads questions off a phone and half the room checks out, or you buy a boxed game whose questions are ten years stale.

I wanted something that felt like a real game show: teams, a board on the TV, everyone holding a controller, and a reason to pay attention when it is not your turn. I also wanted fresh questions every time, in categories I pick, without writing any of them myself.

## What Was Built

A browser game in three pieces: a host page for the TV, a controller page for each team's phone, and Claude behind the scenes.

- **Pick a card.** The team that is up chooses one of four categories worth 100 to 400. The value is the difficulty.
- **Steal.** Every other team can secretly lock in an answer and take half the points if the active team misses.
- **Wager the final.** Teams bet in secret and type an answer, and Claude judges it.

The phones run the game, so nobody has to play quizmaster. The full rules are in [SPEC.md](SPEC.md).

![The active team choosing between four category cards](docs/pick.png)

![The final round reveal with wagers and an overrule button for each team](docs/final.png)

## Where Claude Does the Work

The game makes three kinds of calls to the Claude API.

1. **Question writing.** One call per turn writes the questions for all four cards, each at its card's difficulty, while the team is still getting ready. The prompt sets a target for each value (a 100 is something about 75% of adults know, a 400 about 15%) and nudges each card toward a random decade so questions range across generations.
2. **The final question.** One call writes a hard question with a single short answer, plus the alternate answers that should also count.
3. **Judging.** One call grades every team's typed answer against the correct one. Team answers are passed as data, and the judge is told to ignore any instructions inside them. The host can overrule any ruling.

Every request also carries the game's memory: questions already shown and answers already used, with an instruction not to reuse them.

A full game for three teams is about 17 calls and costs a few cents on Claude Haiku.

## How It Works

1. The host laptop opens the host page, takes an Anthropic API key, and creates a room.
2. The TV shows a QR code and a four-letter code. Each team scans it and picks a team name and avatar.
3. The laptop is the brain. It calls Claude, keeps score and holds the answers.
4. Phones send taps ("picked card 2", "answered B") and show whatever the laptop publishes.
5. Firebase Realtime Database relays messages between the laptop and the phones. There is no server code.

A correct answer never leaves the laptop before the reveal, so nobody can peek by inspecting their phone's browser.

## Try It in Two Minutes

Open `simulator.html` in a browser. It shows the TV and three team phones on one screen and needs no accounts.

- With no API key it plays with a small built-in question bank.
- Paste an Anthropic API key on the TV's setup screen and Claude writes the questions.

## Run a Real Game

Phones need a web address and a relay. Firebase provides both on its free Spark plan, with no credit card.

1. **Create a Firebase project** at console.firebase.google.com.
2. **Create a Realtime Database** (Databases & Storage > Realtime Database) in locked mode.
3. **Turn on anonymous sign-in** (Security > Authentication > Sign-in method > Anonymous).
4. **Add a web app** (Add app > Web on the project overview). Copy `js/config.example.js` to `js/config.js` and paste the config values in.
5. **Deploy** from this folder (needs Node.js):
   ```
   npx firebase-tools login
   npx firebase-tools use --add
   npx firebase-tools deploy
   ```
6. **Play.** Open `https://your-project.web.app/tv.html` on the laptop, create a game, and have each team scan the QR code.

### Taking it offline between game nights

- `bash go-private.sh` locks the database so nothing can read or write it, then takes the website offline.
- `bash go-public.sh` publishes the game's rules and the website again.

## Security and Risk Notes

- **API key.** It lives in one browser tab on the host laptop, goes only to Anthropic, and is gone when the tab closes. Phones never see it.
- **Access control.** Firebase rules let a phone write only its own team's moves.
- **Untrusted input.** Typed answers and model output are rendered as plain text, and the judge is told to grade an answer, not obey it.
- **Exposure.** The site is public while deployed. `go-private.sh` locks the database and takes the site offline between game nights.

## PM Takeaways

**Requirements before build.** I wrote the spec before any code, one decision at a time: turn-based or simultaneous, how steals pay, who runs the game. Each answer narrowed the next question. The first build matched the spec because nothing was left open to interpretation.

**Cut scope, not quality.** Custom avatar art became emoji, and player sign-up became just a team name. Players lose nothing they would notice, and both cuts made the game faster to build and faster to join.

**Prototype before committing to infrastructure.** A simulator that runs the TV and three phones on one screen came before any backend. It let me judge the experience and change the rules while changes were still cheap. The backend came last and only had to relay messages.

**Iterate on real usage.** The first build gave other teams a few extra seconds to steal after the active team answered. Playing it showed a better rule: steals close the moment the active team answers, which gives that team a defense. That change came from using the product, not from reviewing the spec.

**User testing finds what reviews miss.** Two test games in a row ended on the same final answer. Nothing in the spec or the code review would have caught it. The root cause was the model returning to a favorite, and the fix was in the product logic, not the prompt: the game now draws categories itself and tracks what it has already asked.

**Security is a requirement, not a feature.** The trust boundary was set during requirements: players' phones are the least trusted devices in the room, so they hold no key and no answers. Deciding that up front shaped the architecture and cost nothing extra to build.

## What's in the Folder

| File | What it is |
|---|---|
| `tv.html`, `js/tv.js` | The host page and game engine. |
| `play.html`, `js/play.js` | The phone controller. |
| `simulator.html` | TV plus three phones on one screen, for testing. |
| `js/claude.js` | The three Claude API calls and the demo question bank. |
| `js/transport.js` | Message relay: Firebase for real games, a local relay for the simulator. |
| `database.rules.json` | Firebase access rules. |
| `firebase.json` | Hosting settings and security headers. |
| `go-private.sh`, `go-public.sh` | Take the game offline and bring it back. |
| `js/vendor/` | Firebase SDK 13.4.0 (Apache 2.0) and qrcode-generator 2.0.4 (MIT), stored locally so nothing loads from a CDN. |
| `SPEC.md` | The product spec. |
