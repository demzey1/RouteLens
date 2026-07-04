"use client"

import { useState, type ReactNode } from "react"
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Boxes,
  Braces,
  Check,
  CircleDollarSign,
  Clipboard,
  ClipboardList,
  Cpu,
  Gauge,
  KeyRound,
  Layers3,
  Loader2,
  Lock,
  Route,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type RuntimeHeaders = {
  "x-btl-request-id"?: string | null
  "x-btl-cache-tier"?: string | null
  "x-btl-benchmark-cost"?: string | null
  "x-btl-customer-charge"?: string | null
  "x-btl-saved"?: string | null
}

type RuntimeRunResponse = {
  endpoint?: string
  model?: string
  output?: string | null
  usage?: Record<string, unknown> | null
  runtimeHeaders?: RuntimeHeaders
  rawResponse?: unknown
  error?: string
  status?: number
  responseBody?: unknown
}

type CompareRouteId = "modelA" | "modelB"

type CompareRouteResult = {
  id: CompareRouteId
  label: string
  model: string
  status: "idle" | "loading" | "success" | "error"
  data: RuntimeRunResponse | null
  error: string | null
}

type RouteRecommendation = {
  ready: boolean
  winnerModel: string
  title: string
  detail: string
  signals: string[]
}

const MODEL_OPTIONS = [
  "btl-2",
  "gpt-4o-mini-2024-07-18",
  "deepseek-v4-pro",
] as const

const DEFAULT_MODEL = "btl-2"
const DEFAULT_COMPARE_MODEL_B = "gpt-4o-mini-2024-07-18"
const DEFAULT_SYSTEM_PROMPT = "You are a concise product assistant."
const DEFAULT_USER_PROMPT =
  "Draft a short launch note for a developer tool that compares AI model routes."
const DEFAULT_MAX_TOKENS = 512
const MAX_MAX_TOKENS = 1000
const DEFAULT_TEMPERATURE = 0.4

export default function Home() {
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT)
  const [userPrompt, setUserPrompt] = useState(DEFAULT_USER_PROMPT)
  const [maxTokensInput, setMaxTokensInput] = useState(String(DEFAULT_MAX_TOKENS))
  const [temperatureInput, setTemperatureInput] = useState(String(DEFAULT_TEMPERATURE))
  const [runtimeResult, setRuntimeResult] =
    useState<RuntimeRunResponse | null>(null)
  const [modelA, setModelA] = useState(DEFAULT_MODEL)
  const [modelB, setModelB] = useState(DEFAULT_COMPARE_MODEL_B)
  const [compareResults, setCompareResults] = useState<CompareRouteResult[]>(() =>
    createCompareResults(DEFAULT_MODEL, DEFAULT_COMPARE_MODEL_B)
  )
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCompareLoading, setIsCompareLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedExport, setCopiedExport] = useState(false)

  const safeMaxTokens = getSafeMaxTokens(maxTokensInput)
  const safeTemperature = getSafeTemperature(temperatureInput)
  const recommendation = getRouteRecommendation(compareResults)
  const exportLines = createExportLines({
    model: recommendation.winnerModel || model,
    systemPrompt,
    userPrompt,
    maxTokens: safeMaxTokens,
    temperature: safeTemperature,
  })

  const output = runtimeResult?.output || ""
  const usage = runtimeResult?.usage
  const runtimeHeaders = runtimeResult?.runtimeHeaders
  const proofRows = [
    ["Endpoint", runtimeResult?.endpoint],
    ["Model", runtimeResult?.model],
    ["Request ID", runtimeHeaders?.["x-btl-request-id"]],
    ["Cache tier", runtimeHeaders?.["x-btl-cache-tier"]],
    ["Benchmark cost", runtimeHeaders?.["x-btl-benchmark-cost"]],
    ["Customer charge", runtimeHeaders?.["x-btl-customer-charge"]],
    ["Saved amount", runtimeHeaders?.["x-btl-saved"]],
    ["Prompt tokens", getUsageValue(usage, "prompt")],
    ["Completion tokens", getUsageValue(usage, "completion")],
    ["Total tokens", getUsageValue(usage, "total")],
  ] as const

  async function runRuntime() {
    setIsLoading(true)
    setError(null)
    setCopied(false)
    setRuntimeResult(null)

    try {
      const response = await fetch("/api/runtime/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          systemPrompt,
          userPrompt,
          maxTokens: safeMaxTokens,
          temperature: safeTemperature,
        }),
      })

      const data = (await response.json()) as RuntimeRunResponse

      if (!response.ok) {
        setRuntimeResult(data)
        setError(formatRuntimeError(data, response.status))
        return
      }

      setRuntimeResult(data)
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "Unable to reach the local runtime route."))
    } finally {
      setIsLoading(false)
    }
  }

  async function runCompare() {
    setCopied(false)
    setIsCompareLoading(true)
    setCompareResults([
      createLoadingCompareResult("modelA", "Model A", modelA),
      createLoadingCompareResult("modelB", "Model B", modelB),
    ])

    try {
      await Promise.all([
        runCompareRoute("modelA", "Model A", modelA),
        runCompareRoute("modelB", "Model B", modelB),
      ])
    } finally {
      setIsCompareLoading(false)
    }
  }

  async function runCompareRoute(
    id: CompareRouteId,
    label: string,
    routeModel: string
  ) {
    try {
      const response = await fetch("/api/runtime/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: routeModel,
          systemPrompt,
          userPrompt,
          maxTokens: safeMaxTokens,
          temperature: safeTemperature,
        }),
      })

      const data = (await response.json()) as RuntimeRunResponse

      if (!response.ok) {
        updateCompareResult({
          id,
          label,
          model: routeModel,
          status: "error",
          data,
          error: formatRuntimeError(data, response.status),
        })
        return
      }

      updateCompareResult({
        id,
        label,
        model: routeModel,
        status: "success",
        data,
        error: null,
      })
    } catch (caughtError) {
      updateCompareResult({
        id,
        label,
        model: routeModel,
        status: "error",
        data: null,
        error: getErrorMessage(caughtError, "Unable to reach the local runtime route."),
      })
    }
  }

  function updateCompareResult(nextResult: CompareRouteResult) {
    setCompareResults((currentResults) =>
      currentResults.map((result) =>
        result.id === nextResult.id ? nextResult : result
      )
    )
  }

  function updateCompareModel(id: CompareRouteId, nextModel: string) {
    if (id === "modelA") {
      setModelA(nextModel)
    } else {
      setModelB(nextModel)
    }

    setCompareResults((currentResults) =>
      currentResults.map((result) =>
        result.id === id
          ? {
              ...result,
              model: nextModel,
              status: "idle",
              data: null,
              error: null,
            }
          : result
      )
    )
  }

  async function copyOutput() {
    if (!output) {
      return
    }

    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "Unable to copy output from this browser session."))
    }
  }

  async function copyExportCode() {
    try {
      await navigator.clipboard.writeText(exportLines.join("\n"))
      setCopiedExport(true)
      window.setTimeout(() => setCopiedExport(false), 1600)
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "Unable to copy export code from this browser session."))
    }
  }

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-hidden bg-muted/30 text-foreground">
      <div className="mx-auto grid w-full max-w-7xl gap-4 px-3 py-3 sm:gap-5 sm:px-6 sm:py-5 lg:px-8">
        <header className="grid min-w-0 gap-4 border-b bg-background/80 pb-4 sm:rounded-lg sm:border sm:p-4 sm:shadow-sm lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.72fr)] lg:items-center">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border bg-card text-foreground shadow-sm">
              <Route className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold leading-tight tracking-normal sm:text-3xl">
                  RouteLens
                </h1>
                <Badge
                  variant="secondary"
                  className="h-6 shrink-0 gap-1 border-sky-200 bg-sky-50 px-2 text-sky-950"
                >
                  <Cpu className="size-3" aria-hidden="true" />
                  BTL Runtime
                </Badge>
              </div>
              <p className="mt-1 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground sm:text-base">
                Prompt testing workspace for route comparison, runtime proof,
                and production export.
              </p>
            </div>
          </div>

          <div className="grid min-w-0 gap-2 sm:grid-cols-3">
            <StatusPill
              icon={<ShieldCheck className="size-4" aria-hidden="true" />}
              label="Server-side key"
              value="Protected"
            />
            <StatusPill
              icon={<Gauge className="size-4" aria-hidden="true" />}
              label="max_tokens"
              value={`${safeMaxTokens}`}
            />
            <StatusPill
              icon={<Lock className="size-4" aria-hidden="true" />}
              label="Runtime calls"
              value={runtimeResult ? "Connected" : "Ready"}
            />
          </div>
        </header>

        <section className="grid min-w-0 gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.75fr)] xl:grid-cols-[minmax(0,1.45fr)_minmax(380px,0.8fr)]">
          <Card className="order-1 min-w-0 rounded-lg shadow-sm lg:col-start-1">
            <CardHeader className="gap-3 border-b sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="text-lg">Prompt Composer</CardTitle>
                <CardDescription className="text-sm">
                  BTL Runtime request setup
                </CardDescription>
              </div>
              <CardAction className="static col-auto row-auto justify-self-start sm:justify-self-end">
                <Badge variant="outline" className="h-6 gap-1">
                  <KeyRound className="size-3" aria-hidden="true" />
                  No key in browser
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="grid min-w-0 gap-4 pt-4 md:grid-cols-[minmax(0,1fr)_260px] xl:grid-cols-[minmax(0,1fr)_300px]">
              <div className="grid min-w-0 gap-4">
                <div className="grid gap-1.5">
                  <label
                    className="text-sm font-medium"
                    htmlFor="system-instruction"
                  >
                    System instruction
                  </label>
                  <Input
                    id="system-instruction"
                    className="h-11 text-base md:text-sm"
                    value={systemPrompt}
                    onChange={(event) => setSystemPrompt(event.target.value)}
                    aria-label="System instruction"
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium" htmlFor="prompt">
                    Prompt
                  </label>
                  <Textarea
                    id="prompt"
                    className="min-h-56 resize-none text-base leading-7 [field-sizing:fixed] md:min-h-64 md:text-sm"
                    value={userPrompt}
                    onChange={(event) => setUserPrompt(event.target.value)}
                    aria-label="Prompt"
                  />
                </div>
              </div>

              <div className="grid min-w-0 content-start gap-3">
                <SettingInput
                  id="model"
                  label="Model"
                  value={model}
                  onChange={setModel}
                />
                <SettingInput
                  id="maxTokens"
                  label="maxTokens"
                  type="number"
                  min="1"
                  max={String(MAX_MAX_TOKENS)}
                  value={maxTokensInput}
                  onChange={setMaxTokensInput}
                />
                <SettingInput
                  id="temperature"
                  label="Temperature"
                  type="number"
                  step="0.1"
                  value={temperatureInput}
                  onChange={setTemperatureInput}
                />
                <SettingRow label="Route mode" value="Single runtime call" />
                <Button
                  onClick={runRuntime}
                  disabled={isLoading || isCompareLoading || !userPrompt.trim()}
                  className="mt-1 h-11 w-full min-w-0 justify-between px-3 text-sm"
                >
                  <span className="min-w-0 truncate">
                    {isLoading ? "Running through BTL Runtime" : "Run through BTL Runtime"}
                  </span>
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <ArrowRight className="size-4" aria-hidden="true" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="order-2 min-w-0 rounded-lg border-sky-200 bg-sky-50/70 shadow-sm ring-1 ring-sky-200/70 lg:col-start-2 lg:row-span-2">
            <CardHeader className="gap-3 border-b border-sky-200/80 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="text-lg text-sky-950">
                  Runtime Proof
                </CardTitle>
                <CardDescription className="text-sm text-sky-900/70">
                  BTL response metadata
                </CardDescription>
              </div>
              <CardAction className="static col-auto row-auto justify-self-start sm:justify-self-end">
                <Badge className="h-6 gap-1 bg-sky-950 text-white">
                  <BadgeCheck className="size-3" aria-hidden="true" />
                  {runtimeResult ? "Captured" : "Visible"}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-3 pt-4">
              {proofRows.map(([label, value]) => (
                <ProofRow key={label} label={label} value={value} />
              ))}
            </CardContent>
          </Card>

          <Card className="order-3 min-w-0 rounded-lg shadow-sm lg:col-start-1">
            <CardHeader className="gap-3 border-b sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="text-lg">Response</CardTitle>
                <CardDescription className="text-sm">
                  Generated output
                </CardDescription>
              </div>
              <CardAction className="static col-auto row-auto justify-self-start sm:justify-self-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyOutput}
                  disabled={!output}
                  className="h-9 gap-2"
                >
                  {copied ? (
                    <Check className="size-4" aria-hidden="true" />
                  ) : (
                    <Clipboard className="size-4" aria-hidden="true" />
                  )}
                  {copied ? "Copied" : "Copy output"}
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="pt-4">
              {error ? (
                <ErrorBlock message={error} />
              ) : isLoading ? (
                <LoadingBlock />
              ) : output ? (
                <div className="min-h-44 whitespace-pre-wrap rounded-lg border bg-background p-4 text-sm leading-7 shadow-sm">
                  {output}
                </div>
              ) : (
                <EmptyBlock
                  icon={<Sparkles className="size-5" aria-hidden="true" />}
                  title="Awaiting runtime output"
                  detail="The selected route response will appear here."
                />
              )}
            </CardContent>
          </Card>

          <Card className="order-4 min-w-0 rounded-lg shadow-sm lg:col-start-1">
            <CardHeader className="gap-3 border-b sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="text-lg">Model Compare</CardTitle>
                <CardDescription className="text-sm">
                  Same prompt, two BTL Runtime routes
                </CardDescription>
              </div>
              <CardAction className="static col-auto row-auto justify-self-start sm:justify-self-end">
                <Button
                  onClick={runCompare}
                  disabled={isCompareLoading || isLoading || !userPrompt.trim()}
                  className="h-9 gap-2"
                >
                  {isCompareLoading ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <ArrowRight className="size-4" aria-hidden="true" />
                  )}
                  Compare routes
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="grid min-w-0 gap-4 pt-4">
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                <ModelSelector
                  id="model-a"
                  label="Model A"
                  value={modelA}
                  onChange={(value) => updateCompareModel("modelA", value)}
                />
                <ModelSelector
                  id="model-b"
                  label="Model B"
                  value={modelB}
                  onChange={(value) => updateCompareModel("modelB", value)}
                />
              </div>

              <div className="grid min-w-0 gap-4 xl:grid-cols-2">
                {compareResults.map((result) => (
                  <CompareResultCard key={result.id} result={result} />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="order-5 min-w-0 rounded-lg shadow-sm lg:col-start-2">
            <CardHeader className="gap-3 border-b sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="text-lg">Export</CardTitle>
                <CardDescription className="text-sm">
                  Production BTL code
                </CardDescription>
              </div>
              <CardAction className="static col-auto row-auto justify-self-start sm:justify-self-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyExportCode}
                  className="h-9 gap-2"
                >
                  {copiedExport ? (
                    <Check className="size-4" aria-hidden="true" />
                  ) : (
                    <Clipboard className="size-4" aria-hidden="true" />
                  )}
                  {copiedExport ? "Copied" : "Copy code"}
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="min-w-0 rounded-lg border bg-background p-3 shadow-sm">
                <div className="mb-3 flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                  <Braces className="size-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 truncate">
                    OpenAI-compatible BTL Runtime client
                  </span>
                </div>
                <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 font-mono text-sm leading-6">
                  <code>{exportLines.join("\n")}</code>
                </pre>
              </div>
            </CardContent>
          </Card>

          <Card className="order-6 min-w-0 rounded-lg shadow-sm lg:col-start-2">
            <CardHeader className="border-b">
              <CardTitle className="text-lg">Recommendation</CardTitle>
              <CardDescription className="text-sm">
                Production route choice
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {recommendation.ready ? (
                <div className="grid gap-3 rounded-lg border bg-background p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground">
                      <ClipboardList className="size-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {recommendation.title}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {recommendation.detail}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    {recommendation.signals.map((signal) => (
                      <div
                        key={signal}
                        className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground"
                      >
                        {signal}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyBlock
                  icon={<ClipboardList className="size-5" aria-hidden="true" />}
                  title="No winner selected"
                  detail="Run a model comparison to generate a route recommendation."
                />
              )}
            </CardContent>
          </Card>
        </section>

        <footer className="grid gap-3 border-t py-4 text-sm text-muted-foreground md:grid-cols-3">
          <FooterItem
            icon={<Layers3 className="size-4" aria-hidden="true" />}
            title="Route comparison"
            text="Prepared for multi-route evaluation."
          />
          <FooterItem
            icon={<CircleDollarSign className="size-4" aria-hidden="true" />}
            title="Cost visibility"
            text="Ready for charge, cost, and savings proof."
          />
          <FooterItem
            icon={<Boxes className="size-4" aria-hidden="true" />}
            title="Export path"
            text="Reserved for production BTL integration."
          />
        </footer>
      </div>
    </main>
  )
}

function StatusPill({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border bg-card px-3 py-3 shadow-sm">
      <div className="text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold">{value}</p>
      </div>
    </div>
  )
}

function SettingInput({
  id,
  label,
  type = "text",
  step,
  min,
  max,
  value,
  onChange,
}: {
  id: string
  label: string
  type?: string
  step?: string
  min?: string
  max?: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="min-w-0 rounded-lg border bg-background p-3 shadow-sm">
      <label
        className="mb-1 block truncate text-sm text-muted-foreground"
        htmlFor={id}
      >
        {label}
      </label>
      <Input
        id={id}
        type={type}
        step={step}
        min={min}
        max={max}
        className="h-9 font-mono text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function ModelSelector({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="min-w-0 rounded-lg border bg-background p-3 shadow-sm">
      <label
        className="mb-1 block truncate text-sm text-muted-foreground"
        htmlFor={id}
      >
        {label}
      </label>
      <select
        id={id}
        className="h-9 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 font-mono text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {MODEL_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-background p-3 shadow-sm">
      <div className="grid min-w-0 gap-1">
        <span className="min-w-0 truncate text-sm text-muted-foreground">
          {label}
        </span>
        <span className="min-w-0 truncate font-mono text-sm text-foreground">
          {value}
        </span>
      </div>
    </div>
  )
}

function CompareResultCard({ result }: { result: CompareRouteResult }) {
  const data = result.data
  const usage = data?.usage
  const runtimeHeaders = data?.runtimeHeaders
  const output = data?.output || ""
  const proofRows = [
    ["Model", data?.model || result.model],
    ["Benchmark cost", runtimeHeaders?.["x-btl-benchmark-cost"]],
    ["Customer charge", runtimeHeaders?.["x-btl-customer-charge"]],
    ["Saved amount", runtimeHeaders?.["x-btl-saved"]],
    ["Prompt tokens", getUsageValue(usage, "prompt")],
    ["Completion tokens", getUsageValue(usage, "completion")],
    ["Total tokens", getUsageValue(usage, "total")],
  ] as const

  return (
    <div className="grid min-w-0 gap-3 rounded-lg border bg-background p-3 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{result.label}</p>
          <p className="truncate font-mono text-sm text-muted-foreground">
            {result.model}
          </p>
        </div>
        <CompareStatusBadge status={result.status} />
      </div>

      {result.status === "loading" ? (
        <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border bg-muted/20 p-4 text-center">
          <Loader2 className="mb-3 size-5 animate-spin text-muted-foreground" />
          <p className="text-sm font-medium">Running route</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Waiting for BTL Runtime output.
          </p>
        </div>
      ) : result.status === "error" ? (
        <div className="grid gap-3">
          <ErrorBlock message={result.error || "This model route failed."} />
          <RuntimeProofGrid rows={proofRows} />
        </div>
      ) : output ? (
        <div className="grid gap-3">
          <div className="min-h-40 whitespace-pre-wrap rounded-lg border bg-card p-3 text-sm leading-6">
            {output}
          </div>
          <RuntimeProofGrid rows={proofRows} />
        </div>
      ) : (
        <div className="grid gap-3">
          <EmptyBlock
            icon={<Sparkles className="size-5" aria-hidden="true" />}
            title="Awaiting comparison"
            detail="Run compare to see this model output and runtime proof."
          />
          <RuntimeProofGrid rows={proofRows} />
        </div>
      )}
    </div>
  )
}

function CompareStatusBadge({
  status,
}: {
  status: CompareRouteResult["status"]
}) {
  const labels = {
    idle: "Ready",
    loading: "Running",
    success: "Complete",
    error: "Failed",
  }

  return (
    <Badge
      variant={status === "error" ? "destructive" : "outline"}
      className="shrink-0"
    >
      {labels[status]}
    </Badge>
  )
}

function RuntimeProofGrid({
  rows,
}: {
  rows: readonly (readonly [string, unknown])[]
}) {
  return (
    <div className="grid min-w-0 gap-2">
      {rows.map(([label, value]) => (
        <ProofRow key={label} label={label} value={value} />
      ))}
    </div>
  )
}

function ProofRow({
  label,
  value,
}: {
  label: string
  value: unknown
}) {
  const displayValue = formatProofValue(value)

  return (
    <div className="grid min-w-0 gap-1 rounded-lg border border-sky-200 bg-white/80 px-3 py-3 shadow-sm sm:grid-cols-[132px_minmax(0,1fr)] sm:items-start">
      <span className="text-sm font-medium text-sky-950/70">{label}</span>
      <span
        className="min-w-0 break-words font-mono text-sm leading-6 text-sky-950 sm:text-right"
        title={displayValue}
      >
        {displayValue}
      </span>
    </div>
  )
}

function EmptyBlock({
  icon,
  title,
  detail,
}: {
  icon: ReactNode
  title: string
  detail: string
}) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-5 text-center sm:p-6">
      <div className="mb-3 flex size-11 items-center justify-center rounded-lg border bg-background text-muted-foreground shadow-sm">
        {icon}
      </div>
      <p className="text-base font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
        {detail}
      </p>
    </div>
  )
}

function LoadingBlock() {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center rounded-lg border bg-muted/20 p-5 text-center">
      <Loader2 className="mb-3 size-6 animate-spin text-muted-foreground" />
      <p className="text-base font-medium">Running prompt</p>
      <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
        RouteLens is waiting for BTL Runtime to return output and proof.
      </p>
    </div>
  )
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="flex min-h-44 flex-col justify-center rounded-lg border border-destructive/30 bg-destructive/5 p-5">
      <div className="mb-3 flex items-center gap-2 text-destructive">
        <AlertTriangle className="size-5" aria-hidden="true" />
        <p className="font-medium">Runtime request failed</p>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">{message}</p>
    </div>
  )
}

function FooterItem({
  icon,
  title,
  text,
}: {
  icon: ReactNode
  title: string
  text: string
}) {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-lg bg-background/70 p-3 shadow-sm ring-1 ring-border">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm leading-5">{text}</p>
      </div>
    </div>
  )
}

function getSafeTemperature(value: string) {
  const nextValue = Number(value)

  if (!Number.isFinite(nextValue)) {
    return DEFAULT_TEMPERATURE
  }

  return Math.max(0, Math.min(nextValue, 2))
}

function getSafeMaxTokens(value: string) {
  const nextValue = Number(value)

  if (!Number.isFinite(nextValue) || nextValue <= 0) {
    return DEFAULT_MAX_TOKENS
  }

  return Math.min(Math.max(Math.trunc(nextValue), 1), MAX_MAX_TOKENS)
}

function createCompareResults(
  firstModel: string,
  secondModel: string
): CompareRouteResult[] {
  return [
    createIdleCompareResult("modelA", "Model A", firstModel),
    createIdleCompareResult("modelB", "Model B", secondModel),
  ]
}

function createIdleCompareResult(
  id: CompareRouteId,
  label: string,
  model: string
): CompareRouteResult {
  return {
    id,
    label,
    model,
    status: "idle",
    data: null,
    error: null,
  }
}

function createLoadingCompareResult(
  id: CompareRouteId,
  label: string,
  model: string
): CompareRouteResult {
  return {
    id,
    label,
    model,
    status: "loading",
    data: null,
    error: null,
  }
}

function getUsageValue(
  usage: Record<string, unknown> | null | undefined,
  kind: "prompt" | "completion" | "total"
) {
  if (!usage) {
    return null
  }

  const keys = {
    prompt: ["prompt_tokens", "promptTokens", "input_tokens", "inputTokens"],
    completion: [
      "completion_tokens",
      "completionTokens",
      "output_tokens",
      "outputTokens",
    ],
    total: ["total_tokens", "totalTokens"],
  }[kind]

  for (const key of keys) {
    const value = usage[key]

    if (typeof value === "number" || typeof value === "string") {
      return value
    }
  }

  return null
}

function formatProofValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Not returned"
  }

  if (typeof value === "number") {
    return String(value)
  }

  if (typeof value === "string") {
    return value
  }

  return "Not returned"
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === "string" && error.trim()) {
    return error
  }

  if (error && typeof error === "object") {
    try {
      return JSON.stringify(error)
    } catch {
      return fallback
    }
  }

  return fallback
}

function formatRuntimeError(data: RuntimeRunResponse, status: number) {
  const statusText = data.status || status
  const responseBody =
    data.responseBody && typeof data.responseBody === "object"
      ? JSON.stringify(data.responseBody)
      : data.responseBody

  return [
    getErrorMessage(data.error, "The runtime request failed."),
    `Status: ${statusText}.`,
    responseBody ? `Response: ${responseBody}` : null,
  ]
    .filter(Boolean)
    .join(" ")
}

function parseCostValue(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""))
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function getTotalTokens(result: CompareRouteResult) {
  const value = getUsageValue(result.data?.usage, "total")
  if (typeof value === "number") {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function getRouteCharge(result: CompareRouteResult) {
  return parseCostValue(
    result.data?.runtimeHeaders?.["x-btl-customer-charge"]
  )
}

function getRouteSaved(result: CompareRouteResult) {
  return parseCostValue(result.data?.runtimeHeaders?.["x-btl-saved"])
}

function getRouteRecommendation(
  compareResults: CompareRouteResult[]
): RouteRecommendation {
  const successfulRoutes = compareResults.filter(
    (result) => result.status === "success" && result.data?.output
  )

  if (successfulRoutes.length < 2) {
    return {
      ready: false,
      winnerModel: DEFAULT_MODEL,
      title: "No route selected yet",
      detail: "Run a comparison to generate a production recommendation.",
      signals: [],
    }
  }

  const [firstRoute, secondRoute] = successfulRoutes
  const firstCharge = getRouteCharge(firstRoute)
  const secondCharge = getRouteCharge(secondRoute)
  const firstTokens = getTotalTokens(firstRoute)
  const secondTokens = getTotalTokens(secondRoute)

  const winner =
    firstCharge !== null && secondCharge !== null
      ? firstCharge <= secondCharge
        ? firstRoute
        : secondRoute
      : firstTokens !== null && secondTokens !== null
        ? firstTokens <= secondTokens
          ? firstRoute
          : secondRoute
        : firstRoute

  const winnerCharge = getRouteCharge(winner)
  const winnerSaved = getRouteSaved(winner)

  return {
    ready: true,
    winnerModel: winner.model,
    title: `Recommended route: ${winner.model}`,
    detail:
      "This route currently looks best for production because it returned a usable answer with the strongest visible cost/token signal in this comparison.",
    signals: [
      winnerCharge !== null
        ? `Customer charge: ${winnerCharge}`
        : "Customer charge was not returned for the winner.",
      winnerSaved !== null ? `Saved amount: ${winnerSaved}` : "Saved amount was not returned.",
      getTotalTokens(winner) !== null
        ? `Total tokens: ${getTotalTokens(winner)}`
        : "Total tokens were not returned.",
      "Use deepseek-v4-pro only when you need deeper reasoning or larger context, not for every cheap/default call.",
    ],
  }
}

function createExportLines({
  model,
  systemPrompt,
  userPrompt,
  maxTokens,
  temperature,
}: {
  model: string
  systemPrompt: string
  userPrompt: string
  maxTokens: number
  temperature: number
}) {
  return [
    'import OpenAI from "openai"',
    "",
    "const client = new OpenAI({",
    "  apiKey: process.env.GATEWAY_API_KEY,",
    '  baseURL: process.env.BTL_BASE_URL ?? "https://api.badtheorylabs.com/v1",',
    "})",
    "",
    "const response = await client.chat.completions.create({",
    `  model: ${JSON.stringify(model)},`,
    "  messages: [",
    `    { role: "system", content: ${JSON.stringify(systemPrompt)} },`,
    `    { role: "user", content: ${JSON.stringify(userPrompt)} },`,
    "  ],",
    `  max_tokens: ${maxTokens},`,
    `  temperature: ${temperature},`,
    "})",
    "",
    "console.log(response.choices[0]?.message?.content)",
  ]
}
