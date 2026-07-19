---
title: "The Mascot Test: a walrus playing a cello"
date: 2026-07-19
description: "Every model gets the same prompt: draw our mascot as an SVG. Pick a model and judge the result with your own eyes."
ShowToc: false
---

Most AI benchmarks are numbers. A model scores 88.7 on some acronym, another scores 91.2 — and unless you work in the field, neither number tells you anything about what these models can actually do.

This is the first task in a series of **human-friendly benchmarks**: small, real tasks where you don't need a leaderboard to understand the result — you can just look at it.

## The task

Every model gets the exact same prompt, once, with no retries and no cherry-picking:

> Generate an SVG of a walrus playing a cello. The walrus must have its two long tusks and visible whiskers. The cello must have a correctly shaped curved body with two f-holes, four strings, and a bridge, standing upright on its endpin. The walrus must be clearly drawing a bow across the strings with its flipper.

Why this is hard: the model writes SVG markup — shapes and coordinates — as text, without seeing what it draws. Getting a recognizable walrus, a structurally correct cello, *and* a plausible interaction between them is a surprisingly honest test of whether a model can reason about space it cannot see. (The idea of a fixed absurd drawing task owes a debt to Simon Willison's famous [pelican on a bicycle](https://github.com/simonw/pelican-bicycle).)

The checklist, if you want to score along: two tusks · whiskers · curved cello body · two f-holes · four strings and a bridge · cello upright on its endpin · bow in flipper, across the strings.

## The results

Pick a model — the drawing below is its actual, unedited output. New models are added as they come out.
