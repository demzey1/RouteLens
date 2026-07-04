# RouteLens

RouteLens is an open-source web app for evaluating and comparing AI model routes through BTL Runtime before shipping them into production.

It is not just a chatbot.

A chatbot gives you an answer.

RouteLens helps you understand the route behind that answer: which model responded, how many tokens were used, what the request cost, what runtime proof was returned, and which route makes more sense for production.

GitHub:  
https://github.com/demzey1/RouteLens

Live demo:  
https://route-lens-silk.vercel.app/

---

## What is RouteLens?

RouteLens is a runtime route evaluator for AI builders.

It lets developers run prompts through BTL Runtime, compare model routes side by side, inspect runtime proof, and export production-ready OpenAI-compatible code.

The main idea is simple:

> Before shipping an AI feature, developers should be able to see what their AI route costs, how it behaves, and whether another route is better.

Most AI apps hide this part.

RouteLens makes it visible.

---

## Why this exists

When building AI apps, developers often pick a model route blindly.

They write a prompt, send it to a model, get a response, and move on.

But for real products, that is not enough.

You also need to know:

- Which model route generated the response?
- How many prompt tokens were used?
- How many completion tokens were used?
- What was the total token usage?
- What did the request cost?
- Was there a saved amount?
- Did another route produce a similar result for less?
- Is this route practical for production?
- What code do I actually ship?

RouteLens was built to answer those questions in one workflow.

---

## Core idea

RouteLens follows this flow:

```text
Prompt
→ BTL Runtime call
→ Runtime proof
→ Model route comparison
→ Production recommendation
→ Export code
```

Instead of only asking:

```text
What did the model say?
```

RouteLens also asks:

```text
Was this the right route to use?
```

That is the difference.

---

## What the app does

RouteLens has four main sections:

### 1. Prompt Composer

The Prompt Composer lets you enter:

- system instruction
- user prompt
- model route
- max tokens
- temperature

This gives you a controlled way to test a prompt before using it inside an app.

---

### 2. Runtime Proof

The Runtime Proof panel shows response metadata from the BTL Runtime call.

It displays:

- endpoint used
- model route
- request ID
- cache tier
- benchmark cost
- customer charge
- saved amount
- prompt tokens
- completion tokens
- total tokens

This is the main value of RouteLens.

The response is not treated as a black box. You can see what happened under the hood.

---

### 3. Model Compare

Model Compare lets you run the same prompt through two different BTL Runtime model routes.

This makes it easier to compare:

- output quality
- cost
- token usage
- route behavior
- production suitability

A normal chatbot gives one answer.

RouteLens lets you compare routes and inspect tradeoffs.

---

### 4. Recommendation + Export

After comparing routes, RouteLens recommends a production route based on visible signals such as:

- usable output
- customer charge
- saved amount
- total token usage
- selected model route

Then it generates exportable OpenAI-compatible BTL Runtime code using server-side environment variables.

This helps bridge the gap between experimentation and actual implementation.

---

## AI models available

RouteLens currently supports the following model routes:

```text
btl-2
gpt-4o-mini-2024-07-18
deepseek-v4-pro
```

Default single-run model:

```text
btl-2
```

Default comparison setup:

```text
Model A: btl-2
Model B: gpt-4o-mini-2024-07-18
```

`deepseek-v4-pro` is included as an optional stronger route for deeper reasoning or larger-context evaluations.

The app is designed so more BTL Runtime model routes can be added later.

---

## BTL Runtime usage

RouteLens uses BTL Runtime through the OpenAI-compatible chat completions endpoint.

Endpoint used:

```text
/v1/chat/completions
```

Base URL:

```text
https://api.badtheorylabs.com/v1
```

Inside the app, the frontend does not call BTL Runtime directly.

Instead, the browser calls a secure Next.js server route:

```text
/api/runtime/run
```

That server route calls BTL Runtime using environment variables.

This keeps the API key server-side and out of the browser.

---

## Runtime request flow

The request flow looks like this:

```text
Browser
→ /api/runtime/run
→ BTL Runtime /v1/chat/completions
→ response + runtime metadata
→ RouteLens UI
```

The frontend only talks to the internal Next.js API route.

The BTL API key is never exposed to the browser.

---

## Environment variables

RouteLens uses these environment variables:

```env
GATEWAY_API_KEY=
BTL_BASE_URL=https://api.badtheorylabs.com/v1
```

`GATEWAY_API_KEY` should contain your BTL Runtime API key.

`BTL_BASE_URL` should point to the BTL Runtime base URL.

Never commit `.env.local`.

---

## Example export code

RouteLens can generate production-ready BTL/OpenAI-compatible code.

Example:

```ts
import OpenAI from "openai"

const client = new OpenAI({
  apiKey: process.env.GATEWAY_API_KEY,
  baseURL: process.env.BTL_BASE_URL ?? "https://api.badtheorylabs.com/v1",
})

const response = await client.chat.completions.create({
  model: "btl-2",
  messages: [
    { role: "system", content: "You are a concise product assistant." },
    {
      role: "user",
      content:
        "Compare this product idea in one sentence: RouteLens helps developers evaluate BTL Runtime model routes.",
    },
  ],
  max_tokens: 80,
  temperature: 0.4,
})

console.log(response.choices[0]?.message?.content)
```

The exported code uses environment variables only.

No real API key is included in the generated snippet.

---

## Features

- Prompt composer
- Single BTL Runtime call
- Runtime Proof panel
- Model route comparison
- Side-by-side model outputs
- Cost visibility
- Token usage visibility
- Customer charge display
- Saved amount display
- Production route recommendation
- Exportable OpenAI-compatible BTL code
- Server-side API key handling
- No API key exposed in the browser

---

## Tech stack

RouteLens is built with:

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- BTL Runtime API
- Vercel

The architecture is intentionally simple.

There is no database, no auth system, and no unnecessary backend complexity.

The focus is the runtime evaluation workflow.

---

## Security

RouteLens keeps the BTL Runtime key server-side.

The browser never receives the API key.

The app uses:

```text
GATEWAY_API_KEY
```

inside the server route only.

The repository includes `.env.example` with empty placeholders, but `.env.local` should never be committed.

---

## Local setup

Clone the repo:

```bash
git clone https://github.com/demzey1/RouteLens.git
cd RouteLens
```

Install dependencies:

```bash
npm install
```

Create `.env.local`:

```env
GATEWAY_API_KEY=your_btl_runtime_key
BTL_BASE_URL=https://api.badtheorylabs.com/v1
```

Run locally:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

If port `3000` is already in use, Next.js may use another port such as `3001`.

---

## Build

Run:

```bash
npm run build
```

The app builds the main page and the runtime API route:

```text
/
 /api/runtime/run
```

---

## Example prompt

You can try RouteLens with this prompt:

```text
Compare this product idea in one sentence: RouteLens helps developers evaluate BTL Runtime model routes.
```

Recommended settings:

```text
Model A: btl-2
Model B: gpt-4o-mini-2024-07-18
maxTokens: 80
temperature: 0.4
```

---

## Product walkthrough

1. Enter a prompt in the Prompt Composer.
2. Run a single request through BTL Runtime.
3. Review the Runtime Proof panel.
4. Compare two model routes.
5. Review both model outputs.
6. Compare cost, charge, saved amount, and token usage.
7. Review the recommended production route.
8. Export OpenAI-compatible BTL Runtime code.

---

## What makes RouteLens different from a chatbot?

A chatbot is focused on conversation.

RouteLens is focused on evaluation.

A chatbot asks:

```text
What should the model say?
```

RouteLens asks:

```text
Which model route should produce this response in production?
```

That is the difference.

The model response is only one part of the app.

The real value is in the runtime proof, route comparison, recommendation, and export flow.

---

## Future improvements

Possible future improvements include:

- route history
- saved prompt experiments
- latency comparison
- richer cost charts
- cache analysis
- route scoring
- more model routes
- team workspaces
- production config export
- prompt variant comparison

The first version keeps the scope focused on the core workflow:

```text
evaluate route
compare routes
inspect proof
export code
```

---

## Why this matters

Most AI apps hide the runtime.

RouteLens makes BTL Runtime visible, measurable, and useful before developers ship AI features.

AI builders should not have to guess which route makes sense.

They should be able to inspect it, compare it, and ship with more confidence.

---

## License

Open source.

Use it, fork it, improve it.
