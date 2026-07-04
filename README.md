# RouteLens

RouteLens is a web app for evaluating and comparing AI model routes through BTL Runtime.

## One-line pitch

RouteLens helps developers run prompts through BTL Runtime, compare model routes, inspect runtime proof, get a production route recommendation, and export production-ready BTL integration code.

## Problem

AI builders often choose model routes blindly. Before shipping an AI feature, they may not know which route is cheaper, which route produces better output, how many tokens are used, or what each runtime call costs.

## Solution

RouteLens makes the runtime visible. It lets builders evaluate prompts through BTL Runtime, compare routes like `btl-2` and `gpt-4o-mini-2024-07-18`, inspect cost/token metadata, get a production route recommendation, and export code using the BTL OpenAI-compatible API.

## What the app does

RouteLens has four main parts:

1. **Prompt Composer**  
   Enter a system instruction, user prompt, model, max tokens, and temperature.

2. **Runtime Proof**  
   Shows BTL Runtime metadata from the response, including endpoint, model, benchmark cost, customer charge, saved amount, and token usage.

3. **Model Compare**  
   Runs the same prompt through two BTL Runtime model routes and shows both outputs side by side.

4. **Recommendation + Export**  
   Recommends a production route based on comparison signals and generates copy-paste BTL/OpenAI-compatible code.

## Features

- Prompt composer
- Single BTL Runtime call
- Runtime Proof panel
- Model route comparison
- Side-by-side model outputs
- Cost, charge, saved amount, and token usage display
- Production route recommendation
- Exportable BTL/OpenAI-compatible code
- Server-side API key handling
- No API key exposed in the browser

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

Secure server route inside this app:

```text
/api/runtime/run
```

The frontend calls `/api/runtime/run`.

The server route then calls BTL Runtime at:

```text
https://api.badtheorylabs.com/v1/chat/completions
```

The API key is stored server-side as:

```text
GATEWAY_API_KEY
```

The frontend never receives the API key.

## Models available

RouteLens currently supports these model routes:

```text
btl-2
gpt-4o-mini-2024-07-18
deepseek-v4-pro
```

Default single-run model:

```text
btl-2
```

Default comparison models:

```text
Model A: btl-2
Model B: gpt-4o-mini-2024-07-18
```

`deepseek-v4-pro` is available as an optional stronger route for deeper reasoning evaluations.

## Recommendation feature

After comparing two routes, RouteLens recommends a production route based on visible comparison signals such as:

- whether the route returned a usable output
- customer charge
- saved amount
- total token usage
- model route selected

The recommendation is meant to help developers choose a practical default route before shipping an AI feature.

## Export feature

RouteLens generates production-ready BTL/OpenAI-compatible code using environment variables only.

Example export format:

```ts
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.GATEWAY_API_KEY,
  baseURL: process.env.BTL_BASE_URL ?? "https://api.badtheorylabs.com/v1",
});

const response = await client.chat.completions.create({
  model: "btl-2",
  messages: [
    {
      role: "system",
      content: "You are a concise product assistant.",
    },
    {
      role: "user",
      content:
        "Compare this product idea in one sentence: RouteLens helps developers evaluate BTL Runtime model routes.",
    },
  ],
  max_tokens: 80,
  temperature: 0.4,
});
```

The exported code does not include any real API key.

## Tech stack

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- BTL Runtime API
- Vercel

## Environment variables

Create `.env.local`:

```env
GATEWAY_API_KEY=your_btl_runtime_key
BTL_BASE_URL=https://api.badtheorylabs.com/v1
```

Never commit `.env.local`.

## Run locally

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

If port 3000 is busy, Next.js may use another port such as 3001.

## Build

```bash
npm run build
```

## Example prompt

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

## Product walkthrough

1. Enter a prompt.
2. Run a single BTL Runtime call.
3. Review the Runtime Proof panel.
4. Compare `btl-2` against `gpt-4o-mini-2024-07-18`.
5. Review both outputs.
6. Compare cost, charge, saved amount, and token differences.
7. Review the recommended production route.
8. Export BTL/OpenAI-compatible code.

## Why this matters

Most AI apps hide the runtime. RouteLens makes BTL Runtime visible, evaluable, and useful before developers ship AI features.