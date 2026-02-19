import { getAccessToken, clearToken } from "./auth.js"

export interface IFSConfig {
  baseUrl: string
  tokenUrl: string
  clientId: string
  clientSecret: string
  scope?: string
  defaultCompany?: string
  defaultSite?: string
  timeout?: number
}

interface ODataResponse<T = any> {
  value: T[]
  "@odata.count"?: number
  "@odata.nextLink"?: string
}

let config: IFSConfig | null = null

export function configure(cfg: IFSConfig): void {
  config = cfg
}

export function getConfig(): IFSConfig {
  if (!config) throw new Error("IFS not configured. Set environment variables.")
  return config
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) parts.push(`${key}=${encodeURIComponent(String(value))}`)
  }
  return parts.length ? `?${parts.join("&")}` : ""
}

async function request<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  endpoint: string,
  body?: unknown,
  headers?: Record<string, string>,
  retryAuth = true,
): Promise<T> {
  const cfg = getConfig()
  const token = await getAccessToken({
    tokenUrl: cfg.tokenUrl,
    clientId: cfg.clientId,
    clientSecret: cfg.clientSecret,
    scope: cfg.scope,
  })

  const reqHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    ...headers,
  }

  const controller = new AbortController()
  const timeout = cfg.timeout ?? 30_000
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const url = `${cfg.baseUrl}${endpoint}`
    const res = await fetch(url, {
      method,
      headers: reqHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    clearTimeout(timer)

    if ((res.status === 401 || res.status === 403) && retryAuth) {
      clearToken()
      return request<T>(method, endpoint, body, headers, false)
    }

    if (!res.ok) {
      const errBody = await res.text()
      throw new Error(`IFS ${method} ${endpoint} failed (${res.status}): ${errBody.slice(0, 500)}`)
    }

    const ct = res.headers.get("content-type")
    if (!ct?.includes("application/json")) return {} as T

    const data = await res.json()
    const etag = res.headers.get("etag")
    if (etag && typeof data === "object" && data !== null) {
      ;(data as any)._etag = etag
    }
    return data as T
  } catch (err: any) {
    clearTimeout(timer)
    if (err.name === "AbortError") throw new Error(`IFS request timed out after ${timeout}ms`)
    throw err
  }
}

export async function ifsGet<T = any>(endpoint: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const query = params ? buildQuery(params) : ""
  return request<T>("GET", `${endpoint}${query}`)
}

export async function ifsPost<T = any>(endpoint: string, body: Record<string, any>): Promise<T> {
  return request<T>("POST", endpoint, body)
}

export async function ifsPatch<T = any>(endpoint: string, body: Record<string, any>, etag?: string): Promise<T> {
  const headers: Record<string, string> = {}
  if (etag) headers["If-Match"] = etag
  return request<T>("PATCH", endpoint, body, headers)
}

export async function ifsAction<T = any>(endpoint: string, etag?: string): Promise<T> {
  const headers: Record<string, string> = {}
  if (etag) headers["If-Match"] = etag
  return request<T>("POST", endpoint, {}, headers)
}

export type { ODataResponse }
export { buildQuery }
