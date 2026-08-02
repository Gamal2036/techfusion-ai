# AH-3B.1 Execution Plan

## Step 1: Run Fixed E2E Validation Script
- Execute `/tmp/e2e-validation.sh` which covers:
  - Infrastructure health (API + Worker)
  - Auth flow (signup/login → JWT)
  - Device registration (public endpoint)
  - Backup flow (Job → Trigger → Worker processes → Prisma COMPLETED)
  - Inventory flow (deviceToken auth → Queue → Worker → Prisma persisted)
  - Security flow (deviceToken → scoring → Prisma)
  - Retention flow (Admin → Queue → Worker)
  - Worker queue health (6/6 running)
  - Removed endpoint verification (404/405)
- Capture worker logs from `/tmp/worker.log` as evidence

## Step 2: Write Closure Report
- Create `docs/AH-3/AH-3B.1_VALIDATION_OWNERSHIP_SECURITY_CLOSURE.md`
- Sections: Executive Summary, Issue Status (6 issues), Evidence Summary, Test Results, Decision Output

## Step 3: Print Final Decision Output
- Display closure verdict in terminal
