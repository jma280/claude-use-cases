# Labor & Delivery Tracker

**Built during an active L&D hospital admission. Real-time hospital billing watchdog + labor timeline, built entirely through conversation with Claude.**

---

## The situation

A family member was admitted for labor & delivery. As someone who spends a lot of time thinking about risk, user behavior, and how systems fail. My first instinct was: hospital billing is notoriously error-prone, and L&D is one of the worst categories. Duplicate charges, phantom nursery fees, medications billed multiple times. The problem isn't malicious. It's that the systems are complex and nobody's watching.

Rather than take scattered notes or try to remember everything, I asked Claude to build a tracker while we were sitting in the room. No pre-planning. No spec. Just: "can you help me track every time a nurse scans something?"

What followed was about an hour of iterative building entirely through conversation, while actively observing what was happening in the room.

---

## What it became

### Hospital Scan Tracker
Every nurse scan gets logged with auto-classification (medication vs. supply), billing context, and your own notes. Claude writes directly to the JSON data file. You just narrate and refresh the browser.

- Auto-classifies items and flags billing concerns
- Dose tracker for multi-dose medications (loading vs. maintenance, running total)
- Labs & Orders tab with test descriptions
- L&D billing error watch list — built from research done during the build
- Export as CSV or plain text for bill comparison at discharge

### Labor Timeline
A chronological record of the full labor. From first contraction at home through delivery. Color-coded by event type, with billing-relevant events auto-flagged.

- Live elapsed time counter from exact labor start (not midnight)
- Built from a single conversational dump of everything that had happened so far
- Flags events that will appear on the bill

---

## PM takeaways

A few things this reinforced for me as a product manager:

**Requirements don't need to be written to be real.** The "spec" for this was "I don't want to get overcharged." That's a user need. Everything else: the tabs, the dose tracker, the L&D watch list, emerged from the conversation as the context got clearer. This is how most good product work actually starts.

**Context changes the product.** The moment I confirmed it was an L&D situation, the entire scope changed. A new tab appeared, billing tips got specific, the timeline became relevant. Knowing your user's context isn't just helpful. It's the product.

**Good tooling lowers the cost of paying attention.** The tracker didn't make me more observant. It made observing cheaper, so I could do more of it. That's the right frame for AI tools in most professional contexts too.

---

## Security / risk angle

Hospital bills are a surprisingly good lens for thinking about information asymmetry and adversarial complexity, two things that show up constantly in cybersecurity. The hospital has complete information. You have almost none. The billing system is complex enough that errors are plausible cover for anything. The only defense is logging what actually happened.

That's not unlike how you approach incident response, vendor risk, or any system where you're the less-informed party.

---

## Files

| File | Purpose |
|------|---------|
| `hospital_scan_tracker.html` | Scan tracker UI — reads from `hospital_data.json` |
| `hospital_data.json` | Scan, lab, and watch list data — updated by Claude |
| `labor_timeline.html` | Timeline UI — reads from `labor_timeline_data.json` |
| `labor_timeline_data.json` | Timeline events — updated by Claude |

---

## Setup

```bash
cd labor-and-delivery
python3 -m http.server 8080
```

Open in Chrome:
- `http://localhost:8080/hospital_scan_tracker.html`
- `http://localhost:8080/labor_timeline.html`

Hit **Cmd+R** after Claude updates either JSON file.

---

## Built with

- Plain HTML + CSS + JavaScript (zero frameworks, zero dependencies)
- JSON as the data layer
- Claude Sonnet via Claude.ai with filesystem access
- Python's built-in HTTP server
