# Hospital Scan Tracker

**A Claude-powered billing watchdog for hospital stays. Built in real time during a Labor & Delivery admission.**

## What it does

Every time a nurse scans a medication or supply, that scan will eventually appear as a line item on your hospital bill. This tool helps you log every scan in real time so you can verify your itemized bill at discharge and catch errors before you pay.

Built specifically for L&D but works for any hospital stay.

---

## Features

- **Scan log** - log every item scanned by a nurse with auto-classification (medication vs. supply) and billing notes
- **Dose tracker** - automatically tracks multi-dose medications (e.g. penicillin loading dose + maintenance doses) with a running total
- **Labs & Orders tab** - separate tracker for lab tests ordered, with auto-description of what each test checks and a "mark completed" status
- **L&D Watch List** - built-in checklist of common L&D billing line items and the most frequent billing errors (duplicate delivery charges, nursery fees, etc.)
- **Date & time grouping** - entries grouped by day, pre-filled to current date/time
- **Notes field** - log exactly what the nurse said for each scan
- **Export** - export everything as CSV or plain text to compare against your itemized bill

---

## How it works

This tracker is **Claude-updated**. Instead of typing entries yourself, you narrate what you observe to Claude in the chat ("nurse just scanned a Pitocin bag") and Claude writes directly to `hospital_data.json`. You refresh the browser to see updates.

```
hospital_data.json         ← Claude writes here
hospital_scan_tracker.html ← reads JSON, displays in browser
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
   http://localhost:8080/hospital_scan_tracker.html
   ```
4. Leave Terminal running. Hit **Cmd+R** after Claude makes any update.

> **Why a local server?** Browsers block local HTML files from reading other local files for security reasons. The Python server bypasses this without any install required.

---

## Data structure (`hospital_data.json`)

```json
{
  "entries": [
    {
      "text": "Pitocin 5mg",
      "type": "medication",
      "note": "Auto-generated billing note",
      "date": "YYYY-MM-DD",
      "time": "11:20 AM",
      "userNote": "Loading dose — 2 more at 2.5mg expected"
    }
  ],
  "labs": [
    {
      "text": "CBC",
      "guess": "Complete blood count — checks red/white cells and platelets",
      "date": "YYYY-MM-DD",
      "time": "",
      "userNote": "",
      "status": "ordered"
    }
  ],
  "ld_watchlist": [ ... ]
}
```

---


## L&D billing tips

- **Request an itemized bill** at discharge — hospitals are required to provide one
- **Baby gets a separate bill** — don't forget to request itemized for the newborn too
- **Most common errors**: duplicate delivery charge (billed for both vaginal + C-section), nursery fees when baby rooms in, excessive saline bag charges
- **Pitocin**: each bag is a separate billable line item — log every new bag
- **Penicillin**: each dose billed separately regardless of size

---

## Built with

- Plain HTML + CSS + JavaScript (no frameworks)
- `hospital_data.json` as the data layer
- Claude (Sonnet) as the real-time updater via Claude.ai with filesystem access
- Python's built-in HTTP server for local serving
