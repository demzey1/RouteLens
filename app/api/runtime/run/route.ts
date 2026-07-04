const DEFAULT_BTL_BASE_URL = "https://api.badtheorylabs.com/v1"
const DEFAULT_MODEL = "btl-2"
const DEFAULT_MAX_TOKENS = 512
const MAX_MAX_TOKENS = 1000
const DEFAULT_TEMPERATURE = 0.4

const RUNTIME_HEADER_NAMES = [
  "x-btl-request-id",
  "x-btl-cache-tier",
  "x-btl-benchmark-cost",
  "x-btl-customer-charge",
  "x-btl-saved",
] as const

type RuntimeHeaderName = (typeof RUNTIME_HEADER_NAMES)[number]

type RuntimeHeaders = Record<RuntimeHeaderName, string | null>

type RuntimeRunRequest = {
  model?: unknown
  systemPrompt?: unknown
  userPrompt?: unknown
  maxTokens?: unknown
  temperature?: unknown
}

export async function POST(request: Request) {
  let body: RuntimeRunRequest

  try {
    body = (await request.json()) as RuntimeRunRequest
  } catch {
    return Response.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    )
  }

  const userPrompt =
    typeof body.userPrompt === "string" ? body.userPrompt.trim() : ""

  if (!userPrompt) {
    return Response.json(
      { error: "userPrompt is required." },
      { status: 400 }
    )
  }

  const apiKey = process.env.GATEWAY_API_KEY

  if (!apiKey) {
    return Response.json(
      { error: "Server is missing required runtime configuration." },
      { status: 500 }
    )
  }

  const baseUrl = process.env.BTL_BASE_URL || DEFAULT_BTL_BASE_URL
  const endpoint = buildChatCompletionsEndpoint(baseUrl)
  const model = normalizeString(body.model, DEFAULT_MODEL)
  const systemPrompt = normalizeOptionalString(body.systemPrompt)
  const maxTokens = normalizeMaxTokens(body.maxTokens)
  const temperature = normalizeNumber(body.temperature, DEFAULT_TEMPERATURE)

  const messages = [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
    { role: "user", content: userPrompt },
  ]

  try {
    const btlResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
    })

    const runtimeHeaders = captureRuntimeHeaders(btlResponse.headers)
    const responseBody = await parseResponseBody(btlResponse)

    if (!btlResponse.ok) {
      return Response.json(
        {
          error: "BTL Runtime request failed.",
          endpoint,
          model,
          status: btlResponse.status,
          responseBody,
          runtimeHeaders,
        },
        { status: btlResponse.status }
      )
    }

    return Response.json({
      endpoint,
      model,
      output: extractOutput(responseBody),
      usage: extractUsage(responseBody),
      runtimeHeaders,
      rawResponse: responseBody,
    })
  } catch {
    return Response.json(
      {
        error: "Unable to reach BTL Runtime.",
        endpoint,
        model,
        runtimeHeaders: emptyRuntimeHeaders(),
      },
      { status: 502 }
    )
  }
}

function buildChatCompletionsEndpoint(baseUrl: string) {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "")

  if (normalizedBaseUrl.endsWith("/chat/completions")) {
    return normalizedBaseUrl
  }

  return `${normalizedBaseUrl}/chat/completions`
}

function normalizeString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeNumber(value: unknown, fallback: number) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

function normalizeMaxTokens(value: unknown) {
  const numberValue = Number(value)

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return DEFAULT_MAX_TOKENS
  }

  return Math.min(Math.trunc(numberValue), MAX_MAX_TOKENS)
}

function captureRuntimeHeaders(headers: Headers): RuntimeHeaders {
  return RUNTIME_HEADER_NAMES.reduce((captured, headerName) => {
    captured[headerName] = headers.get(headerName)
    return captured
  }, emptyRuntimeHeaders())
}

function emptyRuntimeHeaders(): RuntimeHeaders {
  return {
    "x-btl-request-id": null,
    "x-btl-cache-tier": null,
    "x-btl-benchmark-cost": null,
    "x-btl-customer-charge": null,
    "x-btl-saved": null,
  }
}

async function parseResponseBody(response: Response) {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function extractOutput(responseBody: unknown) {
  if (!isRecord(responseBody)) {
    return null
  }

  if (typeof responseBody.output_text === "string") {
    return responseBody.output_text
  }

  const choices = responseBody.choices

  if (!Array.isArray(choices)) {
    return null
  }

  const firstChoice = choices[0]

  if (!isRecord(firstChoice)) {
    return null
  }

  if (typeof firstChoice.text === "string") {
    return firstChoice.text
  }

  const message = firstChoice.message

  if (!isRecord(message)) {
    return null
  }

  if (typeof message.content === "string") {
    return message.content
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => {
        if (!isRecord(part)) {
          return ""
        }

        if (typeof part.text === "string") {
          return part.text
        }

        return ""
      })
      .join("")
  }

  return null
}

function extractUsage(responseBody: unknown) {
  if (!isRecord(responseBody) || !isRecord(responseBody.usage)) {
    return null
  }

  return responseBody.usage
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
