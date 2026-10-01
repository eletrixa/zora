---
category: http-api
scope: [zorasocial]
priority: recommended
> **Overrides**: Where this rule contradicts AGENTS.md, AGENTS.md wins.
applies-to: [typescript, rust, go]
---

# SDK Patterns

Rules for building typed HTTP client libraries (SDKs) that wrap an HTTP API.

The SDK is the single source of truth for server communication across all clients. It provides typed methods, unified error handling, connection pooling, and retry logic.

## Architecture

```
+------------------+     +-----------+     +--------+
| App A (native)   |---->|           |     |        |
|                  |     |           |     |        |
+------------------+     |           |     |        |
                         |  client   |---->| Server |
+------------------+     |    SDK    |     |        |
| App B (CLI)      |---->|           |     |        |
|                  |     |           |     |        |
+------------------+     +-----------+     +--------+
                               |
+------------------+           |
| App C (SSR)      |-----------+
| (TS wrapper)     |   (TypeScript HTTP
+------------------+    client mirroring SDK)
```

---

## Client Construction (Rust)

```rust
use reqwest::Client;
use std::time::Duration;

pub struct ApiClient {
    http: Client,
    server_url: String,
    auth_token: String,
}

impl ApiClient {
    /// Create a new SDK client.
    ///
    /// - `server_url`: Base URL of the server (e.g., "https://api.example.com")
    /// - `auth_token`: Bearer token for authentication
    pub fn new(server_url: impl Into<String>, auth_token: impl Into<String>) -> Result<Self, ClientError> {
        let http = Client::builder()
            .timeout(Duration::from_secs(30))
            .connect_timeout(Duration::from_secs(10))
            .user_agent(format!("my-sdk/{}", env!("CARGO_PKG_VERSION")))
            .pool_max_idle_per_host(5)
            .pool_idle_timeout(Duration::from_secs(90))
            .build()
            .map_err(ClientError::HttpClient)?;

        Ok(Self {
            http,
            server_url: server_url.into().trim_end_matches('/').to_string(),
            auth_token: auth_token.into(),
        })
    }

    /// Create a client with a pre-configured reqwest::Client (for custom TLS, proxies, etc.)
    pub fn with_client(
        http: Client,
        server_url: impl Into<String>,
        auth_token: impl Into<String>,
    ) -> Self {
        Self {
            http,
            server_url: server_url.into().trim_end_matches('/').to_string(),
            auth_token: auth_token.into(),
        }
    }

    /// Update the auth token (e.g., after token refresh).
    pub fn set_auth_token(&mut self, token: impl Into<String>) {
        self.auth_token = token.into();
    }
}
```

### Connection Pooling

Create one client instance per application lifetime. `reqwest::Client` uses `Arc` internally — cloning is cheap and shares the connection pool.

```rust
// ONE client at startup — shared across all calls
let client = ApiClient::new("https://api.example.com", token)?;

// All of these share the same connection pool:
let events = client.query_events(filters).await?;
let health = client.get_health().await?;
let config = client.get_config().await?;
```

---

## Typed Methods (Rust)

```rust
impl ApiClient {
    /// Query historical events with filtering and pagination.
    pub async fn query_events(
        &self,
        filter: EventFilter,
    ) -> Result<EventsResponse, ClientError> {
        let url = format!("{}/events", self.server_url);
        let response = self.http
            .get(&url)
            .bearer_auth(&self.auth_token)
            .query(&filter.to_query_params())
            .send()
            .await
            .map_err(ClientError::Network)?;

        self.handle_response(response).await
    }

    /// Fetch the next page of events using a cursor.
    pub async fn query_events_next(
        &self,
        filter: EventFilter,
        cursor: &str,
    ) -> Result<EventsResponse, ClientError> {
        let url = format!("{}/events", self.server_url);
        let mut params = filter.to_query_params();
        params.push(("cursor".to_string(), cursor.to_string()));

        let response = self.http
            .get(&url)
            .bearer_auth(&self.auth_token)
            .query(&params)
            .send()
            .await
            .map_err(ClientError::Network)?;

        self.handle_response(response).await
    }

    /// Open an SSE connection for real-time events.
    pub async fn stream_events(
        &self,
        filter: EventFilter,
        last_event_id: Option<&str>,
    ) -> Result<SseStream, ClientError> {
        SseStream::connect(
            self.http.clone(),
            format!("{}/events/stream", self.server_url),
            self.auth_token.clone(),
            filter,
            last_event_id.map(String::from),
        ).await
    }

    /// Get aggregate health status.
    pub async fn get_health(&self) -> Result<HealthStatus, ClientError> {
        let url = format!("{}/health", self.server_url);
        let response = self.http
            .get(&url)
            .bearer_auth(&self.auth_token)
            .send()
            .await
            .map_err(ClientError::Network)?;

        self.handle_response(response).await
    }

    /// Read server configuration.
    pub async fn get_config(&self) -> Result<ServerConfig, ClientError> {
        let url = format!("{}/config", self.server_url);
        let response = self.http
            .get(&url)
            .bearer_auth(&self.auth_token)
            .send()
            .await
            .map_err(ClientError::Network)?;

        self.handle_response(response).await
    }

    /// Update server configuration. Requires admin token scope.
    pub async fn update_config(&self, config: &ServerConfigUpdate) -> Result<ServerConfig, ClientError> {
        let url = format!("{}/config", self.server_url);
        let response = self.http
            .put(&url)
            .bearer_auth(&self.auth_token)
            .json(config)
            .send()
            .await
            .map_err(ClientError::Network)?;

        self.handle_response(response).await
    }
}
```

---

## Response Handling (Rust)

```rust
impl ApiClient {
    async fn handle_response<T: serde::de::DeserializeOwned>(
        &self,
        response: reqwest::Response,
    ) -> Result<T, ClientError> {
        let status = response.status();

        if status == reqwest::StatusCode::UNAUTHORIZED {
            return Err(ClientError::Auth("Token expired or invalid".into()));
        }

        if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
            let retry_after = response
                .headers()
                .get("X-RateLimit-Reset")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.parse::<u64>().ok());
            return Err(ClientError::RateLimited { retry_after });
        }

        if !status.is_success() {
            let error_body: Option<ApiErrorResponse> = response.json().await.ok();
            return Err(ClientError::Api {
                status: status.as_u16(),
                code: error_body.as_ref().map(|e| e.error.code.clone()).unwrap_or_default(),
                message: error_body
                    .map(|e| e.error.message)
                    .unwrap_or_else(|| format!("HTTP {status}")),
            });
        }

        let envelope: ApiSuccessResponse<T> = response
            .json()
            .await
            .map_err(ClientError::Deserialization)?;

        Ok(envelope.data)
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ApiSuccessResponse<T> {
    data: T,
    meta: ResponseMeta,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ApiErrorResponse {
    error: ErrorBody,
    meta: ResponseMeta,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ErrorBody {
    code: String,
    message: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ResponseMeta {
    request_id: String,
}
```

---

## Error Handling (Rust)

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ClientError {
    #[error("HTTP client initialization failed: {0}")]
    HttpClient(reqwest::Error),

    #[error("Network error: {0}")]
    Network(reqwest::Error),

    #[error("API error (HTTP {status}): [{code}] {message}")]
    Api {
        status: u16,
        code: String,
        message: String,
    },

    #[error("Authentication failed: {0}")]
    Auth(String),

    #[error("Rate limited")]
    RateLimited {
        retry_after: Option<u64>,
    },

    #[error("Response deserialization failed: {0}")]
    Deserialization(reqwest::Error),

    #[error("SSE connection error: {0}")]
    Sse(String),
}

impl ClientError {
    /// Returns true if the error is transient and the request should be retried.
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            ClientError::Network(_)
                | ClientError::RateLimited { .. }
                | ClientError::Api { status: 500..=599, .. }
        )
    }
}
```

---

## Retry Logic (Rust)

```rust
impl ApiClient {
    /// Execute a request with automatic retry for transient errors.
    pub async fn with_retry<T, F, Fut>(
        &self,
        max_attempts: u32,
        operation: F,
    ) -> Result<T, ClientError>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = Result<T, ClientError>>,
    {
        let mut attempt = 0;
        loop {
            match operation().await {
                Ok(value) => return Ok(value),
                Err(e) if e.is_retryable() && attempt < max_attempts - 1 => {
                    attempt += 1;
                    let delay = match &e {
                        ClientError::RateLimited { retry_after: Some(ts) } => {
                            let now = std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs();
                            Duration::from_secs(ts.saturating_sub(now).max(1))
                        }
                        _ => {
                            // Exponential backoff: 1s, 2s, 4s, 8s...
                            Duration::from_millis(1000 * 2u64.pow(attempt - 1))
                        }
                    };
                    tracing::warn!(
                        "Request failed (attempt {attempt}/{max_attempts}): {e}. Retrying in {delay:?}"
                    );
                    tokio::time::sleep(delay).await;
                }
                Err(e) => return Err(e),
            }
        }
    }
}

// Usage:
let events = client.with_retry(3, || client.query_events(filter.clone())).await?;
```

---

## TypeScript Wrapper

For TypeScript apps, implement a thin HTTP client that mirrors the SDK's method signatures:

```typescript
export class ApiClient {
  constructor(
    private serverUrl: string,
    private token: string,
  ) {}

  async queryEvents(filter: EventFilter): Promise<EventsResponse> {
    return this.get('/events', filterToParams(filter));
  }

  async getHealth(): Promise<HealthStatus> {
    return this.get('/health');
  }

  async getConfig(): Promise<ServerConfig> {
    return this.get('/config');
  }

  async updateConfig(update: ServerConfigUpdate): Promise<ServerConfig> {
    return this.put('/config', update);
  }

  private async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.serverUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    return this.handleResponse<T>(response);
  }

  private async put<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.serverUrl}${path}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(response);
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new ApiClientError(
        response.status,
        error?.error?.code ?? 'unknown',
        error?.error?.message ?? `HTTP ${response.status}`,
      );
    }
    const envelope = await response.json();
    return envelope.data as T;
  }
}

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }

  get isRetryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}
```

---

## DO / DON'T

### DO

Use one client instance per application lifetime:

```rust
// Create once at startup, reuse everywhere
let client = ApiClient::new(server_url, token)?;
```

Use `is_retryable()` to decide whether to retry:

```rust
match client.query_events(filter).await {
    Ok(events) => process(events),
    Err(e) if e.is_retryable() => retry_later(),
    Err(e) => report_permanent_failure(e),
}
```

Set a user-agent header — helps with server-side debugging:

```rust
.user_agent(format!("my-sdk/{}", env!("CARGO_PKG_VERSION")))
```

Respect rate limit headers when rate-limited:

```rust
// Wait for the X-RateLimit-Reset time rather than retrying immediately
```

### DON'T

Never create a new client per request:

```rust
// NEVER: New client per call — new connection pool every time
async fn fetch() {
    let client = ApiClient::new(url, token)?;
    client.query_events(filter).await
}
```

Never retry non-retryable errors:

```rust
// NEVER: Auth failures will always fail again
if let Err(ClientError::Auth(_)) = result {
    retry(); // Will fail again
}
```

Never hardcode the server URL:

```rust
// NEVER
let client = ApiClient::new("https://api.example.com", token)?;

// CORRECT: From config/environment
let client = ApiClient::new(&config.server_url, token)?;
```

Never bypass the SDK to call the server directly:

```rust
// NEVER
let response = client.http.get("https://api.example.com/events").send().await?;

// CORRECT: Use typed methods
let events = client.query_events(filter).await?;
```

---

## Checklist

- [ ] `ApiClient::new()` creates one `reqwest::Client` with timeout, connect_timeout, user-agent, and pool settings
- [ ] All HTTP methods use `.bearer_auth()` for authentication
- [ ] Response handling unwraps the `{ data, meta }` envelope
- [ ] `ClientError` has variants for network, API, auth, rate-limit, deserialization, and SSE errors
- [ ] `is_retryable()` correctly identifies transient errors (network, 429, 5xx)
- [ ] Retry logic uses exponential backoff and respects `X-RateLimit-Reset`
- [ ] SSE streaming is available via `stream_events()` with `Last-Event-ID` support
- [ ] TypeScript wrapper mirrors the Rust SDK's method signatures
- [ ] TypeScript error class provides `isRetryable` for client-side retry decisions
- [ ] Server URL is configurable from environment, not hardcoded
- [ ] One client instance per application lifetime (not per request)
- [ ] `set_auth_token()` allows token refresh without recreating the client
