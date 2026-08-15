-- DEV-REV-01: Administrative/support device credential revocation.
--
-- Adds the authoritative revocation markers to Device. When revokedAt is set
-- the stored device credential is revoked: DeviceTokenGuard rejects EVERY
-- request presenting it with HTTP 401 / DEVICE_CREDENTIAL_REVOKED, and the
-- shared findByToken lookup stops matching revoked devices (fail-closed for
-- body-token transports). The deviceTokenHash verifier is retained so the
-- revoked credential remains identifiable; it can never authenticate again
-- while revokedAt is set. A same-organization re-enrollment (register-public)
-- clears these fields explicitly and issues a fresh credential.
--
-- No backfill: existing rows are not revoked.
ALTER TABLE "Device" ADD COLUMN "revokedAt" TIMESTAMP(3),
  ADD COLUMN "revokedReason" TEXT;
