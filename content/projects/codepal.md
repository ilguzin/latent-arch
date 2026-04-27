---
title: "CodePal — AI Training Partner for Competitive Programming"
date: 2026-04-27
draft: false
tags: ["ai", "competitive-programming", "education", "claude", "next.js"]
summary: "An AI-powered platform that prepares students for Codeforces, ICPC, and national olympiads using Socratic method — not by giving answers, but by teaching how to think."
ShowToc: false
weight: 1
---

## What is CodePal?

[CodePal](https://codepal.ru/?utm_source=latent-arch&utm_medium=project-page&utm_campaign=projects-codepal) is an AI training partner for competitive programming. It helps students prepare for Codeforces contests, ICPC regionals, and national olympiads — at a fraction of the cost of a private tutor.

Unlike ChatGPT or generic coding assistants, CodePal doesn't give answers. It uses the **Socratic method**: asking guiding questions, nudging the student toward the solution, and building real problem-solving skills.

## Key Features

- **Socratic AI tutor** — guides through problems with questions, not answers
- **Built-in code editor** — C++ and Python with syntax highlighting, runs in the browser
- **Session memory** — the tutor remembers your progress across sessions and adapts to your level
- **Contest-focused** — problems and training paths aligned with Codeforces, ICPC, and olympiad formats

## Why I Built This

This project grew out of a real need. I mentor a competitive programming student preparing for regional olympiads. He has a great teacher, but sessions are once a week. Between lessons, he needs daily practice with someone who can guide — not just check answers.

I tried general-purpose AI tools. They either give the solution outright (killing the learning) or lack the competitive programming context. So I built a specialized tutor that knows the domain and teaches through thinking.

More about the journey: [Teaching My Kid Programming with AI](/posts/teaching-kid-programming-with-ai-part-1/).

## Tech Stack

- **Frontend**: Next.js (React)
- **AI backbone**: Claude Opus 4.6 (premium tier), GPT-5 (base tier)
- **Infrastructure**: servers in Russia, browser-based code execution
- **Method**: Socratic dialogue with adaptive memory

## Try It

[codepal.ru](https://codepal.ru/?utm_source=latent-arch&utm_medium=project-page&utm_campaign=projects-codepal) — free tier available (1 session/month).
