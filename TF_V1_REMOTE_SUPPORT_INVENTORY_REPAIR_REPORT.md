# TechFusion AI V1 — Remote Support & Driver/Software Center Repair Report

## Summary

Completed the missing command-dispatch pipeline for "Refresh Inventory" on the Driver & Software Center pages. The Rust agent now polls for a pending flag every 15s and immediately runs `collect_and_send_inventory()` when triggered.

## Component Status

| Component | Status | Notes |
|---|---|---|
| Remote Support | PASS | Backend, frontend, WebSocket signaling, agent consent polling already fully implemented |
| Driver & Software Center UI | PASS | Refresh button exists, calls `POST /inventory/refresh` |
| API — Inventory Refresh Command | IMPLEMENTED | `POST /inventory/refresh` sets `metadata.inventoryPending=true` on online devices |
| API — Agent Polling Endpoints | IMPLEMENTED | `GET /inventory/pending/:deviceId`, `POST /inventory/pending/:deviceId/clear` (public, bearer-token-auth) |
| API — Auto-clear on Report | IMPLEMENTED | `POST /inventory/report` calls `clearPendingInventory(deviceId)` after queuing |
| API — Stale Flag Cleanup | IMPLEMENTED | `cleanupStalePendingInventory()` clears flags older than 10 minutes |
| Agent — Pending Check | IMPLEMENTED | `check_pending_inventory()` calls `GET /inventory/pending/:id` |
| Agent — Clear on Completion | IMPLEMENTED | `clear_pending_inventory()` calls `POST /inventory/pending/:id/clear` |
| Agent — Poll Loop | IMPLEMENTED | `poll_pending_inventory_commands()` wired into `poll_pending_commands()` (runs every 15s) |
| Agent — Compile | PASS | `cargo check` zero errors |
| Agent — Tests | PASS | 54/54 tests pass |
| API Gateway — Compile | PASS | `npx tsc --noEmit` zero errors |
| Web Frontend — Compile | PASS | `npx tsc --noEmit` zero errors |
| Web Frontend — Tests | PASS | 609/609 Jest tests pass |
| API Gateway — Tests | BLOCKED (pre-existing) | Jest 30.x `clearMocksOnScope` incompatibility — all suites fail with `TypeError: parentClassClosure.clearMock is not a function` |
| Integration — End-to-End | PASS | 3 successful refresh cycles: 200 drivers + 2187 software collected, uploaded, queued, persisted, retrieved via API. No duplicates. Pending flag lifecycle correct. |

## Design Decisions

| Decision | Rationale |
|---|---|
| Use `device.metadata` JSON field for pending flag | Avoids new DB migration; survives restarts; lightweight |
| `inventoryPending` boolean + `inventoryPendingAt` timestamp | Enables staleness detection without extra queries |
| 10-minute staleness threshold | Prevents stuck `pending=true` from blocking future refreshes |
| Auto-clear on report receipt | Agent doesn't need extra HTTP round-trip; 15s poll will see `pending=false` on next tick |

## What Was Already Working (no changes made)

- Remote Support: Full WebSocket + REST lifecycle (create, agent polling, consent, status, file transfer stubs)
- Driver & Software inventory data model and Prisma schema (`DeviceDriver`, `DeviceSoftware`)
- Periodic inventory collection (7200s interval via `inventory_ticker`)
- Frontend pages for Drivers (`/dashboard/drivers`) and Software (`/dashboard/software`)
- `useInventory()` hook and `refreshInventory()` in `api-client.ts`

## What Was Missing / Fixed

- No mechanism existed for "Refresh Inventory" button to signal the agent on demand
- The `POST /inventory/refresh` endpoint existed only as a stub
- The agent had no polling path for pending inventory commands
- **Bug: infinite loop when inventory unchanged** — `poll_pending_inventory_commands` only cleared the pending flag on error, not on success. If data was unchanged (hash matched), the agent returned early without clearing the flag, and the 15s poll would re-detect it forever. Fixed by unconditionally clearing the pending flag after every collection cycle.

## File Changes

| File | Change |
|---|---|
| `apps/api-gateway/src/inventory/inventory.controller.ts` | Rewrote `POST /inventory/refresh`; added `GET /inventory/pending/:deviceId`; added `POST /inventory/pending/:deviceId/clear`; added `clearPendingInventory` call in `ingestReport` |
| `apps/api-gateway/src/inventory/inventory.service.ts` | Added `setPendingInventory`, `getPendingInventoryFlag`, `clearPendingInventory`, `cleanupStalePendingInventory` |
| `apps/agent/src/agent.rs` | Added `poll_pending_inventory_commands`; changed `poll_pending_commands` from `&self` to `&mut self`; wired inventory polling into command loop; fixed pending flag never cleared on unchanged inventory (caused infinite poll loop) |
| `apps/agent/src/client.rs` | Added `check_pending_inventory` and `clear_pending_inventory` methods |
| `apps/agent/src/inventory.rs` | Added `CMD_TIMEOUT_SECS=15` thread + `recv_timeout` pattern to all collector commands |

## Next Steps

1. **Screen streaming** — currently documented as "V1 limitation". The Remote Support session lifecycle is complete (signaling, consent, status tracking) but bidirectional screen/input streaming requires a WebRTC or alternative transport layer.
2. **Periodic cleanup job** — add a scheduled task (e.g., cron or NestJS `@Cron`) to run `cleanupStalePendingInventory()` periodically.
3. **Improved collection delta detection** — the in-memory inventory hash is lost on agent restart, causing a full re-upload every time. Persist the hash to disk for across-restart dedup.
