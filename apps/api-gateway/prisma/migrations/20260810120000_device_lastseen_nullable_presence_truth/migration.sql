-- V1-STAGE-02-SUB-01: Presence truthfulness.
-- A Device row must never imply ONLINE: registration alone is not verified
-- agent presence. lastSeenAt is now nullable with no default and is set ONLY
-- by an authenticated telemetry heartbeat (DevicesService.ingestMetrics).
-- Existing timestamps are preserved (they reflect real prior heartbeats).
ALTER TABLE "Device" ALTER COLUMN "lastSeenAt" DROP NOT NULL;
ALTER TABLE "Device" ALTER COLUMN "lastSeenAt" DROP DEFAULT;
