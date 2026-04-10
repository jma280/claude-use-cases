# Insurance Advisor

An AI-powered household insurance coverage checker built in a single evening session. Designed for family members who are comfortable with Google but not with insurance policy language.

## The Problem

Insurance policies are written for lawyers, not families. When something happens like a fender bender, a fallen tree, or a lost ring, the average person has no idea what's covered, what the deductible is, or which policy even applies. Calling an insurance company for a quick question takes 20 minutes. Reading a 50-page policy document is not realistic.

The goal was to build something a non-technical family member could use in under 30 seconds without any AI experience.

## What Was Built

**Google Form + Apps Script automation**

A Google Form with two fields (situation description, email address) wired to a Google Apps Script trigger. On submission, the script calls the Anthropic API, passes the situation against policy details embedded in the system prompt, and emails a plain-English response back to the submitter within 30 seconds. No Claude account required for the end user.

## How It Works

```
User fills out Google Form
        ↓
Google Apps Script triggers on form submit
        ↓
Script calls Anthropic API with policy context in system prompt
        ↓
Claude analyzes situation against active policies
        ↓
Plain-English response emailed back to user
```

## PM Takeaways

**Build for the actual user, not yourself.** The in-chat widget was faster to build and more capable, but it required a Claude account and comfort with AI interfaces. The Google Form required more setup but met the real users where they already were. Distribution is part of the product.

**Policy context as the prompt is surprisingly effective.** Rather than fine-tuning or RAG, embedding the key policy details directly in the system prompt was sufficient for accurate, useful answers. For a household use case with a small number of relatively simple policies, this was the right level of complexity.

**The build was fast and the friction was in platform quirks.** Core logic took minutes. Most of the session time was navigating Google Form publish settings and Apps Script trigger configuration, not the AI layer.

## Security and Risk Notes

- API key stored in Apps Script source. This is acceptable for private personal use but not appropriate for shared or organizational scripts. Google Script Properties would be the next step for better key hygiene.
- Form is accessible to anyone with the link. This was intentional for family use but would need authentication for broader deployment.
- Policy data is embedded in the system prompt rather than stored in a database. This is simple and effective for static policies but would need a different architecture if policies change frequently.
- No PII collected beyond the user-provided email address for response routing.

## Stack

- Google Forms (front end)
- Google Apps Script (automation layer)
- Anthropic API / Claude (analysis)
- Gmail (response delivery)

## Files

| File | Description |
|------|-------------|
| `README.md` | This file |
| `code.gs` | Google Apps Script source with placeholder API key |

## Reuse Notes

To adapt this for your own policies:
1. Replace the system prompt in `code.gs` with your own policy details
2. Create a Google Form with the same two fields
3. Wire the Apps Script trigger to fire on form submit
4. Drop in your Anthropic API key

Cost is negligible for personal use, roughly $0.01 per submission.
