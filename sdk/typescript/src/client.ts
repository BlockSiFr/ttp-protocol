/**
 * TTPClient — Agent-side SDK for requesting and caching trust tokens.
 */

import {
  TTPClientOptions,
  GetTrustTokenOptions,
  TrustToken,
  TTPTokenClaims,
  TTPUnavailableError
} from "./types"

interface CachedToken {
  token: TrustToken
  fetchedAt: number
}

export class TTPClient {
  private readonly options: Required<Omit<TTPClientOptions, "domains">> & { domains: NonNullable<TTPClientOptions["domains"]> }
  private readonly tokenCache = new Map<string, CachedToken>()
  private readonly refreshThresholdS = 30 // refresh when ≤30s to expiry

  constructor(options: TTPClientOptions) {
    this.options = {
      agentId: options.agentId,
      apiKey: options.apiKey,
      authorityUrl: options.authorityUrl.replace(/\/$/, ""),
      domains: options.domains ?? {},
      fetch: options.fetch ?? globalThis.fetch
    }
  }

  /**
   * Get a trust token for the given domain.
   *
   * Returns a cached token if one exists and is not near expiry.
   * Fetches a new token from the Trust Authority otherwise.
   */
  async getTrustToken(options: GetTrustTokenOptions): Promise<TrustToken> {
    const { domain, requestedTtl, forceRefresh = false } = options

    // Return cached token if valid and not forced refresh
    if (!forceRefresh) {
      const cached = this.tokenCache.get(domain)
      if (cached && this.isTokenFresh(cached.token)) {
        return cached.token
      }
    }

    // Fetch new token
    const token = await this.fetchToken(domain, requestedTtl)
    this.tokenCache.set(domain, { token, fetchedAt: Date.now() })
    return token
  }

  /**
   * Get a trust token and return just the JWT string (for use in headers).
   */
  async getTrustTokenValue(domain: string): Promise<string> {
    const token = await this.getTrustToken({ domain })
    return token.value
  }

  /**
   * Invalidate cached token for a domain, forcing the next call to fetch fresh.
   */
  invalidateToken(domain: string): void {
    this.tokenCache.delete(domain)
  }

  /**
   * Invalidate all cached tokens.
   */
  invalidateAll(): void {
    this.tokenCache.clear()
  }

  private isTokenFresh(token: TrustToken): boolean {
    const nowS = Math.floor(Date.now() / 1000)
    return (token.expiresAt - nowS) > this.refreshThresholdS
  }

  private async fetchToken(domain: string, requestedTtl?: number): Promise<TrustToken> {
    const url = `${this.options.authorityUrl}/v1/tokens`

    let response: Response
    try {
      response = await this.options.fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.options.apiKey}`
        },
        body: JSON.stringify({
          agent_id: this.options.agentId,
          domain,
          ...(requestedTtl !== undefined && { requested_ttl: requestedTtl })
        })
      })
    } catch (err) {
      throw new TTPUnavailableError(
        `Trust Authority unavailable at ${this.options.authorityUrl}`,
        err
      )
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as Record<string, unknown>
      throw new TTPUnavailableError(
        `Trust Authority returned ${response.status}: ${body.error ?? "Unknown error"} — ${body.message ?? ""}`,
        body
      )
    }

    const data = await response.json() as {
      token: string
      expires_at: number
      score: number
      issuer_count: number
    }

    // Decode the JWT payload (without verification — we trust the TA here)
    const claims = decodeJwtPayload(data.token) as TTPTokenClaims

    return {
      value: data.token,
      claims,
      expiresAt: data.expires_at,
      domain: claims.ttp_domain,
      score: data.score,
      issuerCount: data.issuer_count
    }
  }
}

function decodeJwtPayload(jwt: string): unknown {
  const parts = jwt.split(".")
  if (parts.length !== 3) throw new Error("Invalid JWT format")
  const payload = parts[1]
  const padded = payload.replace(/-/g, "+").replace(/_/g, "/")
  const padding = (4 - (padded.length % 4)) % 4
  const json = Buffer.from(padded + "=".repeat(padding), "base64").toString("utf8")
  return JSON.parse(json)
}
