-- V1-STAGE-01-SUB-03 — remove plaintext device credential storage (S3 closure).
--
-- Device credential verification now relies EXCLUSIVELY on Device.deviceTokenHash:
--   * new devices / rotations write only the SHA-256 verifier;
--   * the 20260720130000 migration already backfilled hashes for every row that
--     existed when hashed credentials were introduced;
--   * the application writes deviceTokenHash on every register/rotate path.
--
-- No plaintext->hash backfill is performed here: there is no evidence of rows
-- with a stored plaintext but no verifier, and a one-way hash cannot be derived
-- from an unknown token. Any row that (for legacy reasons) lacks a verifier now
-- FAILS CLOSED at authentication time and is handled by the documented
-- credential-recovery / re-enrollment path (POST /devices/recover-credential
-- with an enrollment token, or agent re-enrollment).

DROP INDEX IF EXISTS "Device_deviceToken_key";
ALTER TABLE "Device" DROP COLUMN IF EXISTS "deviceToken";
