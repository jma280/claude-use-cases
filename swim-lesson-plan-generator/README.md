# Swim Lesson Plan Generator

A reusable AI prompt that turns a few details about a swimmer into an honest, age-appropriate, day-by-day swim plan a parent can run themselves. Built while planning a month of swim lessons for my two-year-old at the YMCA.

## The Problem

I had one month of leave, a pool membership, and a daughter who needed to get comfortable in the water again after a winter off. The obvious move was to ask an AI for a lesson plan to "have her swimming by July 31."

That request has a trap in it. A two-year-old cannot learn to swim in the stroke-and-breathe sense. Swim strokes do not develop until four or five. An AI that just says yes and generates a confident daily plan toward an impossible goal is not helping. It is setting a parent up to push a toddler toward something developmentally out of reach, which at best wastes the month and at worst builds a fear of the water.

The real goal for a toddler is different: water competency and self-rescue. The back float, breath control on cue, and a turn-back-to-the-wall reflex. The plan I actually needed was the one that corrected my goal before answering it.

## What I Built

A single parameterized prompt. You fill in the swimmer's age, current ability, any fear or developmental notes, your schedule, your setting, who is teaching, and your goal in your own words. The prompt instructs the assistant to calibrate a realistic target to the swimmer's age first, push back if the stated goal is unrealistic, bake in the water-safety non-negotiables, and output a day-by-day plan mapped to the real calendar.

It works for any age. Swap a toddler for a seven-year-old or an adult and the framework retargets the whole plan, from self-rescue basics up to stroke technique and endurance.

## How It Works

```
Parent fills in the bracketed fields (age, ability, schedule, setting, goal)
        |
Prompt forces an age-appropriate goal first, and a direct correction if the
stated goal does not fit the age
        |
Safety non-negotiables and gap-maintenance logic are baked in as hard rules
        |
Assistant outputs a day-by-day plan, success criteria, and an honest
"what this will not achieve"
```

## PM Takeaways

The stated requirement is not the real requirement. "Have her swimming by July 31" was my ask. The actual need was "help her be safer and more comfortable in the water in a month." A good product, and a good prompt, interrogates the goal before executing it. The most valuable instruction in the whole prompt is the one that tells the assistant to push back on me.

Constraints encoded once protect every future user. The safety rules, the burnout pacing, and the gap maintenance are written as non-negotiables inside the prompt, not left to the user to remember. Whoever fills out the fields gets them for free. That is the difference between a tool that depends on an expert operator and one that carries the expertise itself.

Calibration beats confidence. The failure mode of a generative tool is a fluent, confident answer to the wrong question. Forcing an explicit reality-check step up front is a cheap and reliable guard against it.

## Safety and Risk Notes

- This generates guidance for a parent, not certified instruction. The prompt states plainly that it does not replace a trained instructor and that real survival-swim self-rescue is taught by professionals.
- No plan drown-proofs a child. Touch supervision is required and is stated in every plan the prompt produces.
- The prompt deliberately excludes the controlled-submersion drills used in certified survival-swim programs, because those are not safe to run solo without training.
- The goal-correction step is the main safety feature. It exists to stop a parent from chasing an unrealistic target in a way that could build fear or false confidence around water.

## Files

| File | Description |
|------|-------------|
| `README.md` | This file |
| `prompt/swim-plan-prompt.md` | The reusable prompt, copy-paste ready, with fill-in fields and usage tips |

## Reuse Notes

1. Open `prompt/swim-plan-prompt.md`
2. Copy the prompt in the code block
3. Fill in the bracketed fields with your swimmer's details
4. Paste it into Claude or another AI tool
5. Push back conversationally to refine ("make sessions 20 minutes," "she is terrified of going under, slow it down")

No account setup or code required. Works with any capable chat assistant.
