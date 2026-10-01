---
category: http-api
scope: [zorasocial]
priority: recommended
> **Overrides**: Where this rule contradicts AGENTS.md, AGENTS.md wins.
applies-to: [typescript, rust, go]
---

# API Design

Rules for designing and implementing HTTP APIs consistently across services.

## Endpoints

### Typical Resource Patterns

`GET /resources` — query/list with filtering and pagination
`GET /resources/stream` — real-time event stream (SSE)
`POST /resources` — create or submit
`POST /resources/ingest` — receive events from external webhooks
`GET /health` — aggregate health status
`GET /config` — read server config
`PUT /config` — update server config

### Query Parameters (GET /resources)

- `source` — filter by source/origin
- `level` — filter by severity (info, warning, error, fatal)
- `project` — filter by project/tenant identifier
- `q` — full-text search across message and details
- `since` — ISO 8601 timestamp lower bound
- `until` — ISO 8601 timestamp upper bound
- `limit` — max results (default 100, max 1000)
- `cursor` — pagination cursor from previous response
- `category` — filter by event category

### Query Response Shape

```json
{
  "events": [...],
  "cursor": "eyJ0cyI6...",
  "has_more": true,
  "total_estimate": 1247
}
```

---

## Response Format

All responses use a consistent envelope.

Success:
```json
{
  "data": { ... },
  "meta": { "request_id": "req_abc123" }
}
```

Error:
```json
{
  "error": {
    "code": "not_found",
    "message": "Resource not found",
    "details": null
  },
  "meta": { "request_id": "req_abc123" }
}
```

---

## Authentication

All endpoints require `Authorization: Bearer <token>` header.

- Tokens are validated at the edge/gateway and server-side
- Different token scopes: admin (full access), read-only (query + stream), relay (limited)

---

## Rate Limiting

- Query endpoints: 100 req/min per token
- Streaming connections: 1 per token per client type
- Config writes: 10 req/min per token
- Rate limit headers on every response: `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## Pagination

Prefer cursor-based pagination for large, frequently-updated datasets (events, logs, feeds). Offset pagination is acceptable for small, stable datasets with predictable sorting (admin lists, search results).

- Server returns opaque `cursor` string with each response
- Client passes `cursor` to get the next page
- Cursors encode timestamp + resource ID for stable ordering
- Offset pagination produces inconsistent results with continuously-written data

---

## Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `bad_request` | 400 | Invalid query parameters or malformed request body |
| `unauthorized` | 401 | Missing or invalid bearer token |
| `forbidden` | 403 | Token lacks required scope |
| `not_found` | 404 | Requested resource does not exist |
| `rate_limited` | 429 | Rate limit exceeded, check `X-RateLimit-Reset` header |
| `internal_error` | 500 | Unexpected server error |
| `service_unavailable` | 503 | Server starting up or a dependency is down |

---

## Hard Rules

- All responses include `request_id` for debugging
- All timestamps are ISO 8601 UTC
- All field names are camelCase
- No breaking changes without API version bump
- Rate limit headers on every response

---

## Implementation (axum / Rust)

### Router Setup

```rust
use axum::{Router, routing::{get, put, post}, middleware};

pub fn api_router() -> Router<AppState> {
    Router::new()
        .route("/events", get(handlers::query_events))
        .route("/events/stream", get(handlers::stream_events))
        .route("/events/ingest", post(handlers::ingest_event))
        .route("/health", get(handlers::get_health))
        .route("/config", get(handlers::get_config))
        .route("/config", put(handlers::update_config))
        .layer(middleware::from_fn(auth::require_bearer_token))
        .layer(middleware::from_fn(rate_limit::check_rate_limit))
        .layer(middleware::from_fn(request_id::inject_request_id))
}
```

### Query Handler

```rust
use axum::{extract::{Query, State}, Json};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventQuery {
    pub source: Option<String>,
    pub level: Option<String>,
    pub project: Option<String>,
    pub q: Option<String>,
    pub since: Option<String>,
    pub until: Option<String>,
    pub limit: Option<u32>,
    pub cursor: Option<String>,
    pub category: Option<String>,
}

pub async fn query_events(
    State(state): State<AppState>,
    Query(params): Query<EventQuery>,
) -> Result<Json<EventsResponse>, ApiError> {
    let limit = params.limit.unwrap_or(100).min(1000);
    let events = state.event_store
        .query(params.into_filter(), limit, params.cursor)
        .await?;
    Ok(Json(events))
}
```

### Response Envelope Types

```rust
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiResponse<T: Serialize> {
    pub data: T,
    pub meta: ResponseMeta,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiError {
    pub error: ErrorBody,
    pub meta: ResponseMeta,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorBody {
    pub code: String,
    pub message: String,
    pub details: Option<serde_json::Value>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResponseMeta {
    pub request_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventsResponse {
    pub events: Vec<Event>,
    pub cursor: Option<String>,
    pub has_more: bool,
    pub total_estimate: u64,
}
```

---

## DO / DON'T

### DO

Use the envelope format for every response:

```rust
Json(ApiResponse {
    data: events_response,
    meta: ResponseMeta { request_id },
})
```

Include rate limit headers on every response:

```rust
// Middleware adds these to every response
response.headers_mut().insert("X-RateLimit-Remaining", remaining.into());
response.headers_mut().insert("X-RateLimit-Reset", reset_timestamp.into());
```

Validate query parameters before accessing the database:

```rust
if let Some(ref level) = params.level {
    if !["info", "warning", "error", "fatal"].contains(&level.as_str()) {
        return Err(ApiError::bad_request("Invalid level filter"));
    }
}
```

Use cursor-based pagination:

```rust
// Cursor encodes the last seen timestamp + ID
let cursor = base64::encode(format!("{}:{}", last_event.timestamp, last_event.id));
```

### DON'T

Never use offset/page-number pagination with continuously-ingested data:

```rust
// NEVER
pub struct EventQuery {
    pub page: u32,     // Results shift as new data arrives
    pub per_page: u32,
}
```

Never return errors outside the envelope format:

```rust
// NEVER: Raw string error
return Err("something went wrong".into());

// CORRECT: Structured error with code and request_id
return Err(ApiError::internal("something went wrong", request_id));
```

Never expose internal details in error messages:

```rust
// NEVER: Leaking database internals
ApiError { message: "PostgreSQL error: relation 'events' does not exist" }

// CORRECT: Generic message, log details server-side
ApiError { message: "Failed to query events" }
```

Never introduce breaking changes without versioning:

```
// /v1/events (current)
// /v2/events (new format)
```

---

## Checklist

- [ ] All endpoints require `Authorization: Bearer <token>` header
- [ ] All responses use the `{ data, meta }` or `{ error, meta }` envelope
- [ ] Every response includes `request_id` in `meta`
- [ ] Rate limit headers (`X-RateLimit-Remaining`, `X-RateLimit-Reset`) on every response
- [ ] Cursor-based pagination on list endpoints (no offset/page)
- [ ] Query parameters validated before database access
- [ ] All field names are camelCase
- [ ] All timestamps are ISO 8601 UTC
- [ ] Error codes match the documented table
- [ ] `GET /health` returns aggregate status
- [ ] Ingest endpoints validate webhook signatures before processing
- [ ] No internal error details leak in API responses
