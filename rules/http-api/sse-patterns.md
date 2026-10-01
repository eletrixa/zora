---
category: http-api
scope: [zorasocial]
priority: recommended
> **Overrides**: Where this rule contradicts AGENTS.md, AGENTS.md wins.
applies-to: [typescript, rust, go]
---

# SSE Patterns

Rules for implementing Server-Sent Events (SSE) across server and client layers.

Applies to: server SSE handler, Rust SSE client (SDK), TypeScript EventSource clients, CLI streaming clients.

---

## Event Format

All SSE events follow this structure:

```
id: evt_01HX9ABC123
event: event.new
data: {"id":"evt_01HX9ABC123","source":"railway","level":"error","message":"Process exited with code 1","timestamp":"2025-01-15T14:30:00Z","category":"deploy"}

```

Fields:
- `id` — unique event ID, used for `Last-Event-ID` reconnection
- `event` — event type (see table below)
- `data` — JSON payload, always a single line (never pretty-printed)

### Event Types

| Type | Payload | When emitted |
|------|---------|-------------|
| `event.new` | Full event object | New event ingested from any source |
| `event.batch` | Array of event objects | Multiple events in a single batch window |
| `health.update` | Health status object | Source health status changes |
| `config.update` | Config diff object | Server configuration changed |
| `heartbeat` | `{}` | Keepalive, every 15 seconds |

---

## Server Side (axum / Rust)

### SSE Handler

```rust
use axum::{
    extract::{Query, State},
    response::sse::{Event, Sse},
};
use futures::stream::Stream;
use std::time::Duration;
use tokio::sync::broadcast;

pub async fn stream_events(
    State(state): State<AppState>,
    Query(filters): Query<EventStreamFilter>,
    headers: axum::http::HeaderMap,
) -> Sse<impl Stream<Item = Result<Event, axum::Error>>> {
    // Resume from Last-Event-ID if provided
    let last_id = headers
        .get("Last-Event-ID")
        .and_then(|v| v.to_str().ok())
        .map(String::from);

    let rx = state.event_bus.subscribe();
    let stream = create_event_stream(rx, filters, last_id, state.event_store.clone());

    Sse::new(stream)
        .keep_alive(
            axum::response::sse::KeepAlive::new()
                .interval(Duration::from_secs(15))
                .event(
                    Event::default()
                        .event("heartbeat")
                        .data("{}")
                )
        )
}
```

### Event Batching (250-500ms window)

Batch events to reduce SSE message frequency under high load:

```rust
use tokio::time::{interval, Duration};

async fn create_event_stream(
    mut rx: broadcast::Receiver<AppEvent>,
    filters: EventStreamFilter,
    last_id: Option<String>,
    store: EventStore,
) -> impl Stream<Item = Result<Event, axum::Error>> {
    // Replay missed events first on reconnection
    if let Some(ref last_id) = last_id {
        let missed = store.events_since(last_id).await;
        for event in missed {
            yield Ok(Event::default()
                .id(event.id.clone())
                .event("event.new")
                .data(serde_json::to_string(&event)?));
        }
    }

    let mut batch: Vec<AppEvent> = Vec::new();
    let mut batch_timer = interval(Duration::from_millis(250));

    loop {
        tokio::select! {
            Ok(event) = rx.recv() => {
                if filters.matches(&event) {
                    batch.push(event);
                }
            }
            _ = batch_timer.tick() => {
                if batch.is_empty() { continue; }
                if batch.len() == 1 {
                    let event = batch.remove(0);
                    yield Ok(Event::default()
                        .id(event.id.clone())
                        .event("event.new")
                        .data(serde_json::to_string(&event)?));
                } else {
                    let last_id = batch.last().map(|e| e.id.clone());
                    yield Ok(Event::default()
                        .id(last_id.unwrap_or_default())
                        .event("event.batch")
                        .data(serde_json::to_string(&batch)?));
                    batch.clear();
                }
            }
        }
    }
}
```

### Broadcast Channel (fan-out to multiple clients)

```rust
pub struct AppState {
    pub event_bus: broadcast::Sender<AppEvent>,
    pub event_store: EventStore,
}

impl AppState {
    pub fn new() -> Self {
        // Buffer 1024 events — slow clients will miss events and reconnect via Last-Event-ID
        let (tx, _) = broadcast::channel(1024);
        Self { event_bus: tx, .. }
    }

    /// Called by ingestion layer when new events arrive
    pub fn publish(&self, event: AppEvent) {
        let _ = self.event_bus.send(event); // Ignore "no subscribers" errors
    }
}
```

---

## TypeScript Client (EventSource)

### EventSource Connection with Reconnection

```typescript
export type SSEState = 'connecting' | 'connected' | 'disconnected' | 'error';

export function createEventStream(
  serverUrl: string,
  token: string,
  filters: EventFilter,
  callbacks: {
    onEvent: (event: AppEvent) => void;
    onBatch: (events: AppEvent[]) => void;
    onHealth: (status: HealthStatus) => void;
    onStateChange: (state: SSEState) => void;
  },
): { close: () => void } {
  const params = buildFilterParams(filters);
  const url = `${serverUrl}/events/stream?${params}`;

  let eventSource: EventSource | null = null;
  let reconnectAttempt = 0;
  let closed = false;

  function connect() {
    if (closed) return;

    callbacks.onStateChange('connecting');

    // EventSource does not support custom headers natively.
    // Use a polyfill that supports headers, or pass the token as a query param over HTTPS.
    eventSource = new EventSource(`${url}&token=${token}`);

    eventSource.onopen = () => {
      callbacks.onStateChange('connected');
      reconnectAttempt = 0;
    };

    eventSource.addEventListener('event.new', (e: MessageEvent) => {
      callbacks.onEvent(JSON.parse(e.data));
    });

    eventSource.addEventListener('event.batch', (e: MessageEvent) => {
      callbacks.onBatch(JSON.parse(e.data));
    });

    eventSource.addEventListener('health.update', (e: MessageEvent) => {
      callbacks.onHealth(JSON.parse(e.data));
    });

    // heartbeat events keep the connection alive — no action needed

    eventSource.onerror = () => {
      callbacks.onStateChange('error');
      eventSource?.close();
      scheduleReconnect();
    };
  }

  function scheduleReconnect() {
    if (closed) return;
    callbacks.onStateChange('disconnected');
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 30000);
    reconnectAttempt++;
    setTimeout(connect, delay);
  }

  connect();

  return {
    close() {
      closed = true;
      eventSource?.close();
      eventSource = null;
    },
  };
}
```

### Svelte 5 Integration Example

```svelte
<script lang="ts">
  import { createEventStream, type SSEState } from '$lib/sse';
  import type { AppEvent } from '$lib/types';

  interface Props {
    serverUrl: string;
    token: string;
  }
  let { serverUrl, token }: Props = $props();

  let events = $state<AppEvent[]>([]);
  let connectionState = $state<SSEState>('disconnected');

  $effect(() => {
    const stream = createEventStream(serverUrl, token, {}, {
      onEvent(event) {
        events = [event, ...events].slice(0, 500); // Keep last 500
      },
      onBatch(batch) {
        events = [...batch.reverse(), ...events].slice(0, 500);
      },
      onHealth(_status) {
        // Update health indicators
      },
      onStateChange(state) {
        connectionState = state;
      },
    });

    return () => stream.close();
  });
</script>
```

---

## Rust Client (SDK)

### reqwest SSE Parsing with Reconnection

```rust
pub struct SseStream {
    client: Client,
    server_url: String,
    token: String,
    last_event_id: Option<String>,
}

impl SseStream {
    /// Connect and stream events. Reconnects automatically with exponential backoff.
    pub async fn stream(
        &mut self,
        filters: &EventFilter,
        mut callback: impl FnMut(SseMessage),
    ) -> Result<(), ClientError> {
        let mut backoff = ExponentialBackoff::new();

        loop {
            match self.connect_and_read(filters, &mut callback).await {
                Ok(()) => backoff.reset(),
                Err(e) => tracing::warn!("SSE connection error: {e}, reconnecting..."),
            }

            let delay = backoff.next_delay();
            tokio::time::sleep(delay).await;
        }
    }

    async fn connect_and_read(
        &mut self,
        filters: &EventFilter,
        callback: &mut impl FnMut(SseMessage),
    ) -> Result<(), ClientError> {
        let mut request = self.client
            .get(format!("{}/events/stream?{}", self.server_url, filters.to_query()))
            .header("Authorization", format!("Bearer {}", self.token))
            .header("Accept", "text/event-stream");

        if let Some(ref last_id) = self.last_event_id {
            request = request.header("Last-Event-ID", last_id);
        }

        let response = request.send().await?;

        if !response.status().is_success() {
            return Err(ClientError::Http(response.status()));
        }

        let mut stream = response.bytes_stream();
        let mut parser = SseParser::new();

        while let Some(chunk) = stream.next().await {
            let bytes = chunk.map_err(ClientError::from)?;
            for message in parser.feed(&bytes) {
                if let Some(ref id) = message.id {
                    self.last_event_id = Some(id.clone());
                }
                if message.event != "heartbeat" {
                    callback(message);
                }
            }
        }

        Ok(())
    }
}
```

### SSE Parser

```rust
pub struct SseParser {
    buffer: String,
}

pub struct SseMessage {
    pub id: Option<String>,
    pub event: String,
    pub data: String,
}

impl SseParser {
    pub fn new() -> Self {
        Self { buffer: String::new() }
    }

    pub fn feed(&mut self, bytes: &[u8]) -> Vec<SseMessage> {
        self.buffer.push_str(&String::from_utf8_lossy(bytes));
        let mut messages = Vec::new();

        while let Some(pos) = self.buffer.find("\n\n") {
            let raw = self.buffer[..pos].to_string();
            self.buffer = self.buffer[pos + 2..].to_string();

            let mut id = None;
            let mut event = String::from("message");
            let mut data = String::new();

            for line in raw.lines() {
                if let Some(value) = line.strip_prefix("id: ") {
                    id = Some(value.to_string());
                } else if let Some(value) = line.strip_prefix("event: ") {
                    event = value.to_string();
                } else if let Some(value) = line.strip_prefix("data: ") {
                    data = value.to_string();
                }
            }

            messages.push(SseMessage { id, event, data });
        }

        messages
    }
}
```

### Exponential Backoff with Jitter

```rust
pub struct ExponentialBackoff {
    attempt: u32,
    base_ms: u64,
    max_ms: u64,
}

impl ExponentialBackoff {
    pub fn new() -> Self {
        Self { attempt: 0, base_ms: 1000, max_ms: 30_000 }
    }

    pub fn next_delay(&mut self) -> Duration {
        let delay = std::cmp::min(
            self.base_ms * 2u64.pow(self.attempt),
            self.max_ms,
        );
        self.attempt += 1;
        // Add jitter: +/- 25% to prevent thundering herd
        let jitter = (delay as f64 * 0.25 * (rand::random::<f64>() - 0.5)) as i64;
        Duration::from_millis((delay as i64 + jitter).max(100) as u64)
    }

    pub fn reset(&mut self) {
        self.attempt = 0;
    }
}
```

---

## Connection Lifecycle

```
Client                              Server
  |                                    |
  |--- GET /events/stream ----------->|
  |    Authorization: Bearer <token>   |
  |    Last-Event-ID: <id> (optional)  |
  |                                    |
  |<-- 200 OK, Content-Type: text/event-stream
  |                                    |
  |<-- event: event.new               |  (real-time events)
  |    data: {...}                     |
  |                                    |
  |<-- event: heartbeat               |  (every 15s)
  |    data: {}                        |
  |                                    |
  |<-- event: event.batch             |  (batched under high load)
  |    data: [{...}, {...}]            |
  |                                    |
  |--- (connection drops) ------------>|
  |                                    |
  |--- GET /events/stream ----------->|  (reconnect)
  |    Last-Event-ID: <last-seen-id>   |
  |                                    |
  |<-- (replay missed events) ------->|
  |<-- (resume live stream) ----------|
```

---

## DO / DON'T

### DO

Always send heartbeats — without them, proxies close idle connections:

```rust
KeepAlive::new()
    .interval(Duration::from_secs(15))
    .event(Event::default().event("heartbeat").data("{}"))
```

Always include event IDs — clients need them for `Last-Event-ID` reconnection:

```rust
Event::default()
    .id(event.id.clone())      // Required for reconnection
    .event("event.new")
    .data(serde_json::to_string(&event)?)
```

Always replay missed events on reconnection:

```rust
if let Some(ref last_id) = last_id {
    let missed = store.events_since(last_id).await;
    // Send missed events before resuming live stream
}
```

Use exponential backoff with jitter:

```typescript
const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
// Add jitter to prevent synchronized reconnects from multiple clients
```

Batch events under high load — one message with 10 events is better than 10 messages.

### DON'T

Never skip heartbeats — cloud proxies (Cloudflare, nginx) close connections idle for > 60s.

Never reconnect immediately without backoff:

```typescript
// NEVER: Immediate reconnect in a tight loop
eventSource.onerror = () => { connect(); };

// CORRECT: Schedule with backoff delay
eventSource.onerror = () => { scheduleReconnect(); };
```

Never ignore `Last-Event-ID` — clients will miss events during reconnection gaps.

Never send binary data over SSE — all payloads must be UTF-8 text (JSON).

Never embed newlines in the `data:` field — SSE uses `\n` as a field delimiter:

```rust
// NEVER: Pretty-printed JSON breaks SSE parsing
.data(serde_json::to_string_pretty(&event)?)

// CORRECT: Compact single-line JSON
.data(serde_json::to_string(&event)?)
```

---

## Checklist

- [ ] SSE handler sends heartbeat events every 15 seconds
- [ ] Every event message includes an `id:` field
- [ ] `Last-Event-ID` header is read and missed events are replayed on reconnection
- [ ] Event batching is implemented (250-500ms windows) for high-throughput periods
- [ ] TypeScript client reconnects with exponential backoff on connection loss
- [ ] TypeScript client tracks connection state (connecting, connected, disconnected, error)
- [ ] Rust client parses SSE text format and handles reconnection with backoff
- [ ] Backoff includes jitter to prevent thundering herd
- [ ] All SSE data payloads are compact single-line JSON
- [ ] `tokio::sync::broadcast` is used for fan-out to multiple SSE clients
- [ ] Broadcast channel has sufficient buffer (1024+) for burst events
- [ ] Slow clients that fall behind the broadcast buffer reconnect via `Last-Event-ID`
