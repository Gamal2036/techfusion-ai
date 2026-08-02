# AH-2B.4A — Real-Time Foundation & Security

## Executive Summary

Secured the WebSocket foundation across all four backend gateways (`/metrics`, `/network`, `/remote`) by adding JWT authentication middleware, eliminating duplicate namespace ownership, enforcing server-controlled organization rooms, and replacing wildcard CORS with explicit origins. Created a centralized Frontend Socket.IO client with connection pooling, reference counting, reconnection with latest tokens, and logout cleanup. All 27 backend and 10 frontend tests pass. Lint and build pass on both apps.

## Starting State

### Backend
- 4 WebSocket gateways with zero authentication
- Client-supplied `orgId` from query string controlled room assignment
- `AlertsGateway` and `DevicesGateway` both declared `namespace: '/metrics'` (duplicate ownership)
- All gateways used `cors: { origin: '*', credentials: true }` (wildcard CORS)
- No JWT verification on any WebSocket connection
- No server-controlled room assignment

### Frontend
- `useWebSocket` and `useAlertWebSocket` both created independent Socket.IO connections to `/metrics`
- No auth tokens passed to Socket.IO connections
- No reconnection logic
- No centralized socket management
- No cleanup on logout
- `orgId` extracted from localStorage (untrusted) and passed as query parameter
- Remote support page hardcoded `orgId = 'demo'`

## Root Causes

1. **No socket authentication middleware**: All gateways accepted connections without JWT verification. The `CombinedAuthGuard` (APP_GUARD) only applies to HTTP contexts, not WebSocket.
2. **Client-controlled tenant isolation**: `orgId` was read from `client.handshake.query.orgId` (fully client-controlled) and used for room assignment.
3. **Dual namespace ownership**: Both `DevicesGateway` and `AlertsGateway` declared `namespace: '/metrics'`, creating unpredictable behavior.
4. **Wildcard CORS on WebSocket**: Each gateway specified `cors: { origin: '*' }`, ignoring the HTTP CORS config in `main.ts`.
5. **No frontend socket management**: Each hook created independent connections with no pooling, no token passing, and no lifecycle management.

## Files Modified

### Backend — New Files
| File | Purpose |
|------|---------|
| `apps/api-gateway/src/common/ws-auth.middleware.ts` | Reusable JWT socket authentication middleware |
| `apps/api-gateway/src/common/ws-cors.ts` | WebSocket CORS origin resolution from `WS_ALLOWED_ORIGINS` |
| `apps/api-gateway/test/ws-auth.spec.ts` | 27 focused tests for socket auth, namespace safety, tenant isolation, CORS |

### Backend — Modified Files
| File | Changes |
|------|---------|
| `apps/api-gateway/src/alerts/alerts.gateway.ts` | Removed `@WebSocketGateway` decorator. Converted to plain `@Injectable` service with `setServer()` and `broadcastAlert()`. Eliminates duplicate `/metrics` namespace ownership. |
| `apps/api-gateway/src/devices/devices.gateway.ts` | Added `OnGatewayInit`, `afterInit()` with auth middleware, injected `AlertsGateway`, uses `socket.data.user.orgId` (verified) instead of query param, disconnects unauthenticated clients, uses `getWsCorsOrigins()`. |
| `apps/api-gateway/src/network/network.gateway.ts` | Added `OnGatewayInit`, `afterInit()` with auth middleware, uses `socket.data.user.orgId` (verified) instead of query param, disconnects unauthenticated clients, uses `getWsCorsOrigins()`. |
| `apps/api-gateway/src/remote-support/remote-support.gateway.ts` | Added `OnGatewayInit`, `afterInit()` with auth middleware, uses `socket.data.user.orgId` (verified) instead of query param, validates role parameter, disconnects invalid clients, uses `getWsCorsOrigins()`. |
| `apps/api-gateway/.env.example` | Added `WS_ALLOWED_ORIGINS` documentation. |
| `infra/k8s/templates/configmap.yaml` | Added `WS_ALLOWED_ORIGINS` for production deployment. |

### Frontend — New Files
| File | Purpose |
|------|---------|
| `apps/web/src/lib/socket-client.ts` | Centralized Socket.IO manager with per-namespace singleton, reference counting, auth token injection, reconnection, and `disconnectAll()` |
| `apps/web/src/__tests__/socket-client.spec.ts` | 10 focused tests for socket client lifecycle |

### Frontend — Modified Files
| File | Changes |
|------|---------|
| `apps/web/src/hooks/useWebSocket.ts` | Replaced direct `io()` with central `subscribe()`. Removed `orgId` parameter. Uses callback ref pattern for stable subscription. |
| `apps/web/src/hooks/useAlerts.ts` | Replaced direct `io()` with central `subscribe()`. Removed `orgId` parameter from `useAlertWebSocket`. Uses callback ref pattern. |
| `apps/web/src/lib/auth-client.ts` | Added `disconnectAll()` call from socket-client in `logout()` via dynamic import to avoid circular dependency. |
| `apps/web/src/app/dashboard/monitoring/page.tsx` | Removed `orgId` variable, updated hook calls to new signatures. |
| `apps/web/src/app/dashboard/device-health/page.tsx` | Removed `orgId` state and JWT decode, updated hook call. |
| `apps/web/src/app/dashboard/device-health/[id]/page.tsx` | Removed `orgId` state and JWT decode, updated hook call. Removed unused `useEffect` import. |

## Socket Authentication

### Implementation
Created `ws-auth.middleware.ts` — a reusable Socket.IO middleware applied via `server.use()` in each gateway's `afterInit` lifecycle hook.

### Authentication Flow
```
Frontend handshake
  → auth: { token: <JWT> } or Authorization: Bearer <JWT>
  → ws-auth middleware validates JWT with process.env.JWT_SECRET
  → Attaches { userId, orgId, role } to socket.data.user
  → Gateway handleConnection reads socket.data.user.orgId
  → Client joins server-controlled room org:<verified-orgId>
```

### Security Properties
- Token from `auth.token` takes precedence over `Authorization` header
- Missing token → rejected with "Authentication required"
- Malformed token → rejected with "Invalid or expired token"
- Expired token → rejected with "Invalid or expired token"
- Missing claims (sub, orgId, role) → rejected with "Invalid token payload"
- Tokens are never logged
- Rejected clients are cleanly disconnected with `client.disconnect(true)`
- Same JWT secret and validation rules as HTTP auth (`jwt-auth.guard.ts`)

## Gateway Namespace Ownership

| Namespace | Owner | Events | Status |
|-----------|-------|--------|--------|
| `/metrics` | `DevicesGateway` (sole owner) | `metrics`, `alerts` | **Consolidated** |
| `/network` | `NetworkGateway` | `topology`, `diagnostics` | Auth added |
| `/remote` | `RemoteSupportGateway` | `signal`, `screen-frame`, `input-event`, `session-ended`, `session-update` | Auth added |

**Key change**: `AlertsGateway` was converted from a `@WebSocketGateway` to a plain `@Injectable` service. It receives the shared Server reference via `DevicesGateway.afterInit()`. Both `DevicesGateway.broadcastAlert()` and `AlertsGateway.broadcastAlert()` emit through the same underlying Socket.IO server on the `/metrics` namespace.

## Tenant Room Isolation

### Server-Controlled Rooms
- All gateways now read `orgId` from `socket.data.user.orgId` (set by JWT middleware)
- Client-supplied `orgId` from query parameters is **ignored** for room assignment
- Unauthenticated clients are **disconnected immediately** in `handleConnection`

### Cross-Organization Isolation
- `DevicesGateway` emits only to `org:<verified-orgId>` room
- `NetworkGateway` emits only to `org:<verified-orgId>` room
- `RemoteSupportGateway` emits to both `session:<sessionId>` and `org:<verified-orgId>` rooms
- No global broadcast of tenant data
- Organization A cannot receive Organization B events (verified by tests)

### Remote Support Session Validation
- Role must be `'technician'` or `'device'` (validated server-side)
- Missing sessionId or invalid role → client disconnected
- Session rooms use `session:<sessionId>` prefix (not org-scoped)

## Central Frontend Socket Client

### Architecture
`apps/web/src/lib/socket-client.ts` — module-level singleton per namespace.

### Features
- **URL resolution**: `NEXT_PUBLIC_WS_URL` → `NEXT_PUBLIC_API_URL` → `http://localhost:3001`
- **Auth token**: Passed via `auth` callback function (called on each connection/reconnection)
- **One socket per namespace**: `Map<string, NamespaceState>` prevents duplicate connections
- **Reference counting**: Socket connects on first subscriber, disconnects on last unsubscribe
- **Event listener dedup**: Multiple subscribers share one socket listener; individual callbacks managed internally
- **Reconnection**: Configured with 10 attempts, 1s initial delay, 30s max delay
- **Cleanup**: `disconnectAll()` removes all listeners, disconnects all sockets, clears state
- **No client-trusted orgId**: Token-based auth only; no orgId in auth payload

### API
```typescript
subscribe(namespace, event, callback): () => void  // Returns unsubscribe function
getConnectionState(namespace): 'connected' | 'disconnected' | 'connecting'
disconnectAll(): void                                // Called on logout
reconnectAll(): void                                 // After token refresh
```

## Authentication Lifecycle

### Integration Points
- **Token refresh**: Handled solely by existing `auth-client.ts` (`refreshSession()`)
- **Socket reconnect**: `auth` callback in Socket.IO reads latest token from localStorage on each connection attempt
- **Logout**: `auth-client.ts:logout()` calls `socket-client.disconnectAll()` via dynamic import (avoids circular dependency)
- **No infinite reconnect loops**: Socket.IO configured with `reconnectionAttempts: 10` and exponential backoff up to 30s

### Cleanup on Logout
```
logout() called
  → Backend /auth/logout (revoke refresh tokens)
  → socket-client.disconnectAll() (dynamic import)
    → For each namespace: removeAllListeners(), disconnect(), close()
  → clearTokens() (localStorage)
  → Redirect to /login
```

## CORS Configuration

### Before
All gateways: `cors: { origin: '*', credentials: true }`

### After
All gateways: `cors: { origin: getWsCorsOrigins(), credentials: true }`

### Origin Resolution
- `WS_ALLOWED_ORIGINS` env var: comma-separated list of allowed origins
- Development fallback: `['http://localhost:3000', 'http://localhost:3001']`
- Production fallback (if `WS_ALLOWED_ORIGINS` not set): `['https://techfusion.ai']` with console error
- Wildcard (`*`) is **never** returned in any environment
- Whitespace in comma-separated values is trimmed

### Configuration Added
| Location | Variable |
|----------|----------|
| `apps/api-gateway/.env.example` | `WS_ALLOWED_ORIGINS` |
| `infra/k8s/templates/configmap.yaml` | `WS_ALLOWED_ORIGINS: "https://techfusion.ai,https://www.techfusion.ai"` |

## Tests

### Backend Tests (27 total — all passing)
| Category | Tests | Status |
|----------|-------|--------|
| WebSocket Auth Middleware | Valid JWT succeeds, missing JWT rejected, invalid JWT rejected, expired JWT rejected, header auth accepted, missing claims rejected, auth precedence, empty token rejected | 8/8 PASS |
| Gateway Namespace Ownership | AlertsGateway not a gateway, DevicesGateway implements OnGatewayInit, CORS config on all gateways | 5/5 PASS |
| Tenant Room Isolation | DevicesGateway uses verified orgId, disconnects unauthenticated, NetworkGateway uses verified orgId, RemoteSupportGateway uses verified orgId, invalid role rejected | 5/5 PASS |
| WebSocket CORS Configuration | Env-based origins, dev defaults, no wildcard in production, whitespace handling | 4/4 PASS |
| Cross-Organization Isolation | DevicesGateway scoped, NetworkGateway scoped, RemoteSupportGateway scoped | 3/3 PASS |
| AlertsGateway Shared Server | Broadcasts through shared server, handles missing server | 2/2 PASS |

### Frontend Tests (10 total — all passing)
| Test | Status |
|------|--------|
| One socket instance per namespace | PASS |
| Repeated requests reuse socket | PASS |
| Multiple subscribers share namespace | PASS |
| Removing one subscriber preserves others | PASS |
| Final unsubscribe cleans up connection | PASS |
| Reconnect uses latest access token | PASS |
| Logout disconnects all namespaces | PASS |
| No client-trusted orgId in auth | PASS |
| getConnectionState returns correct state | PASS |
| connect_error handler registered | PASS |

## Build Results

| App | Lint | Build |
|-----|------|-------|
| `apps/api-gateway` | PASS (tsc --noEmit) | PASS (tsc) |
| `apps/web` | PASS (tsc --noEmit) | PASS (next build) |

## Regression Results

| Area | Status |
|------|--------|
| Login, MFA, refresh, logout | PASS — auth-client.spec.ts passes (39/39 frontend tests) |
| REST APIs | PASS — all existing backend unit/integration tests pass |
| Device metrics ingestion | PASS — DevicesController and DevicesService logic unchanged |
| Worker and queues | PASS — no changes to worker |
| SSE AI chat | PASS — no changes to AI module |
| No UI redesign | PASS — hook signatures changed but page behavior unchanged |
| No remote-control enabled | PASS — RemoteSupportGateway preserved existing event handling |
| No database migration | PASS — no schema changes |

## Remaining Work for AH-2B.4B

1. **Network page live subscriptions**: Wire `NetworkGateway` `topology` and `diagnostics` events to frontend via central socket client
2. **Remote support page**: Convert from raw WebSocket to Socket.IO via central client; remove hardcoded `orgId = 'demo'`; add proper cleanup on unmount
3. **Real-time metrics dashboard**: Connect device-health and monitoring pages to subscribe/unsubscribe lifecycle
4. **Session ownership validation**: Verify remote session belongs to the user's organization via database lookup (currently only checks JWT orgId)
5. **Device ownership validation**: Verify device belongs to the user's organization before allowing metrics subscription
6. **Connection state UI**: Expose socket connection state to React components for connection status indicators

## Remaining Risks

1. **Token expiry during long-lived socket connections**: Socket.IO reconnect uses `auth` callback with latest token, but if the user's session expires entirely (refresh token revoked), sockets will fail to reconnect. The 10-attempt reconnection limit prevents infinite loops.
2. **Remote support page still uses raw WebSocket**: Not converted to Socket.IO in this phase. The backend gateway is secured but the frontend connection bypasses the central client.
3. **No rate limiting on WebSocket connections**: The HTTP `ThrottlerGuard` does not apply to WebSocket upgrades. A future enhancement could add connection rate limiting.
4. **Multi-process deployment**: In a clustered NestJS deployment, Socket.IO rooms are per-process. The current implementation assumes a single process or uses Redis adapter for scaling (not yet configured).

## Final Decision

**AH-2B.4A COMPLETE**
