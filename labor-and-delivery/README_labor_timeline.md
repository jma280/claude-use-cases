# Labor Timeline

**A Claude-updated real-time timeline of labor events. Built during an active L&D admission.**

## What it does

Tracks the full chronological story of labor from first contraction to delivery and beyond. Every event from water breaking, dilation checks, medication changes, contraction progress gets logged with a timestamp and category, color-coded on a visual timeline.

Useful during labor for situational awareness, and afterward as a complete record to cross-reference against your hospital bill.

---

## Features

- **Live elapsed time counter** — counts from the exact moment labor started (not midnight), updates every minute
- **Color-coded event categories** — Admission, Contractions, Medication, Procedure, Labs, Vitals, Delivery, Postpartum, Note
- **Flagged items** — events relevant to billing (e.g. each Pitocin bag, medication doses, OB office visit) are flagged for bill review
- **Day grouping** — events grouped by date for multi-day labors
- **Export** — full plain-text export of the timeline including flagged items

---

## How it works

Claude listens to your narration (written or verbal) and writes events directly to `labor_timeline_data.json`. You refresh the browser to see updates.

```
labor_timeline_data.json ← Claude writes here
labor_timeline.html      ← reads JSON, displays timeline in browser
```

---

## Setup

1. Make sure both files are in the same folder
2. Open Terminal and run:
   ```
   cd path/to/this/folder && python3 -m http.server 8080
   ```
3. Open Chrome and go to:
   ```
   http://localhost:8080/labor_timeline.html
   ```
4. Leave Terminal running. Hit **Cmd+R** after Claude makes any update.

---

## Data structure (`labor_timeline_data.json`)

```json
{
  "patient": "",
  "start_date": "YYYY-MM-DD",
  "start_time": "09:00",
  "events": [
    {
      "id": 1,
      "time": "9:00 AM",
      "date": "YYYY-MM-DD",
      "category": "contraction",
      "title": "Labor began",
      "detail": "Contractions started at home.",
      "flag": false
    }
  ],
  "categories": {
    "contraction": { "label": "Contractions", "color": "#ec4899" },
    "medication":  { "label": "Medication",   "color": "#3b82f6" },
    "procedure":   { "label": "Procedure",    "color": "#f59e0b" },
    "delivery":    { "label": "Delivery",     "color": "#ef4444" }
  }
}
```

**Event categories:**

| Key | Label | Use for |
|-----|-------|---------|
| `admission` | Admission | Check-in, room assignment |
| `contraction` | Contractions | Frequency/intensity changes |
| `medication` | Medication | Any drug administered |
| `procedure` | Procedure | Exams, AROM, epidural placement |
| `labs` | Labs | Blood draws, cultures |
| `vitals` | Vitals | BP, temp, fetal heart rate checks |
| `delivery` | Delivery | Birth event |
| `postpartum` | Postpartum | Recovery, baby events |
| `note` | Note | Anything else |

---

## Timeline progression reference

| Contraction frequency | What it typically means |
|-----------------------|------------------------|
| Every 10+ min | Early labor |
| Every 5–6 min | Active labor beginning |
| Every 3–4 min | Active labor, approaching transition |
| Every 2–3 min | Transition / near pushing |

---

## Built with

- Plain HTML + CSS + JavaScript (no frameworks)
- `labor_timeline_data.json` as the data layer
- Claude (Sonnet) as the real-time updater via Claude.ai with filesystem access
- Python's built-in HTTP server for local serving
