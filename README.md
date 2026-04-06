# Real-World AI - A Living Portfolio

I'm a product manager and cybersecurity professional. This repo is how I document my thinking, learning, and application of AI in real situations. Not demos, not tutorials, not polished case studies.

Every entry here started as a real problem I was trying to solve. Some are tools I built with Claude. Some are PM frameworks or lessons I picked up along the way. All of it is meant to show how I think, how I work, and how I approach new technology.

---

## What's in here

| # | Entry | Type | Context |
|---|-------|------|---------|
| 1 | [Labor & Delivery Tracker](./labor-and-delivery/) | AI tool + reflection | Built during an active L&D hospital admission |

*GThis will continue to grow over time.*

---

## Why I'm building this

A few things I believe that drive this repo:

**AI is a thinking partner, not just a tool.** The most valuable thing I've found isn't using Claude to write emails or summarize documents but it's using it to build things in real time, while a situation is unfolding, with no pre-planning. The L&D tracker is a good example: it didn't exist until I needed it. I described the problem conversationally and we built it together over a few hours.

**Product thinking shows in how you respond to ambiguity.** A lot of what I do as a PM is make good decisions fast with incomplete information. This repo captures that in action: rough prompts, mid-stream pivots, and decisions made under pressure.

**Cybersecurity strategy is about more than technical controls.** It's about risk awareness, user behavior, and knowing what questions to ask. Some of that thinking shows up here too.

---

## How the AI-built tools work (i want to update this)

Each tool follows the same pattern. No manual coding required:

1. A real situation comes up
2. I describe what I need to Claude in plain English. No specs, no wireframes.
3. Claude builds it, iterates, and updates files directly on my computer via filesystem access
4. I narrate what I observe in real time. Claude classifies, logs, and flags.


**To run any tool locally:**
```bash
cd [use-case-folder]
python3 -m http.server 8080
```
Then open `http://localhost:8080/[filename].html` in Chrome. No installs, no dependencies.

---

## Connect

- *[[Linkedin](https://www.linkedin.com/in/jamesalaniz/)*

If something here is useful or you want to talk PM, security, or AI, reach out.

