# Family Trivia Night: Party Edition

Product spec, as decided on 2026-11-17. This is the second version of Family Trivia Night. The first version is a single-file, shared-screen game where questions are scoped to each player's age. This version is a team game played on a TV with phones as controllers.

## 1. Format

| Decision | Choice |
|---|---|
| Play style | Turn-based. One team is "up" at a time. |
| Players | Teams of 2 or more people. |
| Age | Ignored. Toddlers are not the audience for this version. |
| Devices | One TV (driven by a laptop) as the board. One phone per team as the controller. |
| Who runs the game | The phones. There is no dedicated host or quizmaster. |
| Question text | Shown on the TV only. Phones show A/B/C/D buttons, so eyes stay up. |

## 2. A turn

1. **Ready.** The TV announces whose turn it is. That team taps "We're ready" on its phone.
2. **Pick.** The team chooses one of four category cards. Each set of four always carries one 100, one 200, one 300 and one 400. Categories are drawn at random from the pool chosen at setup.
3. **Question.** The question appears on the TV with four answers and a 30-second timer. The active team talks it over and submits one answer on its phone.
4. **Steal.** While the active team is deciding, every idle team can secretly lock in its own answer. The TV shows which teams have locked in, never what they picked. The moment the active team answers, steals close. A fast answer is the active team's defense against steals.
5. **Reveal.** The TV shows the correct answer, who scored, and a fun fact. The active team taps "Next" to pass the turn.

## 3. Difficulty

The card's value is the difficulty. Claude is told to write each question at that level.

| Value | Level | Target |
|---|---|---|
| 100 | Easy, but not a giveaway | About 75% of adults know it |
| 200 | Medium | About 60% |
| 300 | Hard | About 35% |
| 400 | Very hard | About 15%, a fair stumper |

Each card also gets a hidden random era (1950s through 2020s, or timeless) so questions range across generations.

## 4. Scoring

| Event | Points |
|---|---|
| Active team answers correctly | Full card value. Steals are void. |
| Active team misses | Every idle team with the correct answer gets half the card value (50, 100, 150 or 200). |
| Wrong steal | No penalty. |
| Steal not locked in before the active team answers | No steal. |
| No answer before the timer ends | Counts as a miss. |

## 5. Ending

- Every team gets the same number of turns, set at setup. Default is 5.
- **Final round**, Jeopardy style:
  1. The TV reveals the final category.
  2. Each team secretly wagers from 0 up to its score. A team with less than 400 may wager up to 400.
  3. One hard question for everyone. Teams type their answer on the phone. 45 seconds.
  4. Claude judges the typed answers and forgives spelling and close variants.
  5. The TV reveals team by team from last place to first: answer, then wager and new score.
  6. The laptop has an "Overrule" button per team in case a ruling is wrong.
- **After the winner is crowned**, the laptop offers two choices. A rematch keeps the same teams and phones, resets scores and reshuffles the turn order. A new game ends the room and makes a new code for teams to join.
- **Tie after the final:** sudden death. Tied teams answer one 400-level multiple-choice question at once. Teams that miss are out. Up to 3 rounds, then co-champions.

## 6. Setup and join flow

1. Someone opens the host page on a laptop connected to the TV, pastes an Anthropic API key once, sets turns per team and categories, and creates the game.
2. The TV shows a QR code and a four-letter room code.
3. Each team scans it with one phone, then enters a team name and picks an emoji avatar. Member names are not collected. Each team gets a color. No two teams share an avatar.
4. The host clicks Start once at least two teams are in. Turn order is random. A game holds up to 8 teams. A phone that tries to join a full game is told so.
5. A phone that locks, reloads or drops reconnects with the same room code and gets its team and score back.

## 7. Look and feel

- Game-show style: dark stage, gold point values, a spotlight on the active team.
- Emoji avatars (the same approach as version one).
- Team color follows the team everywhere: scoreboard, steal indicator, podium.
- A Rules button on every phone and on the TV opens the rules of the game, so nobody has to read them aloud.

## 8. Architecture

- **The laptop is the brain.** It holds the API key, calls Claude, keeps score and knows the correct answers.
- **Phones are thin.** They send taps and receive what to display. A correct answer never reaches a phone before the reveal.
- **Firebase Realtime Database** relays messages between the laptop and the phones. Access rules allow a phone to write only its own team's entries. Only the host can read teams' secret answers and wagers.
- **Firebase config stays out of Git.** It lives in `js/config.js`, which is ignored. `js/config.example.js` is the blank template.
- **Simulator mode** runs the TV and three phones on one laptop with no Firebase, for testing.
- **Demo mode** uses a small built-in question bank when no API key is set.

## 9. Claude API uses

1. **Question writing.** One call per turn writes all four cards' questions at their difficulty levels, while the team is getting ready.
2. **Final question.** One call writes the final category, question, answer and accepted variants.
3. **Answer judging.** One call grades every team's typed final answer. Team answers are passed as data and the judge is told to ignore any instructions inside them.

## 10. Avoiding repeats

Left alone, a model returns to the same favorite questions. The game guards against that in four ways.

- **Random draws in code.** The game, not Claude, picks each card's category and era, and the final round's category and era.
- **Question memory.** Every question shown on the TV is saved in the host laptop's browser, up to 300. Each request tells Claude not to repeat or closely resemble the most recent 150.
- **Answer memory.** Correct answers are saved too, up to 400, and Claude is told not to reuse them. Final-round answers have their own list.
- **Only shown questions count.** Claude writes four questions a turn and the team sees one. The three unseen questions are not remembered.

The memory holds trivia text only, with no team names or scores. It lasts across game nights on the same laptop and browser, and the setup screen has a button to clear it. A rematch shares the same memory.

## 11. Not in this version

- Every player on their own phone (one phone per team only).
- Custom or generated avatars.
- Timers or turn counts that change mid-game.
- Accounts, score history, or leaderboards across game nights.
