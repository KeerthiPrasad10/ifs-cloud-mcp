interface OAuth2Token {
  access_token: string
  token_type: string
  expires_in?: number
  expires_at?: number
}

interface OAuth2Config {
  tokenUrl: string
  clientId: string
  clientSecret: string
  scope?: string
}

let cachedToken: OAuth2Token | null = null

export async function getAccessToken(config: OAuth2Config): Promise<string> {
  if (cachedToken?.expires_at && cachedToken.expires_at - 60_000 > Date.now())
    return cachedToken.access_token

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
  })
  if (config.scope) params.append("scope", config.scope)

  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OAuth2 token request failed (${res.status}): ${body}`)
  }

  const token: OAuth2Token = await res.json()
  token.expires_at = Date.now() + (token.expires_in ?? 3600) * 1000
  cachedToken = token
  return token.access_token
}

export function clearToken(): void {
  cachedToken = null
}
