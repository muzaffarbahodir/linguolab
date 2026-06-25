-- Migration: add_analytics_events
-- Adds analytics_events table for user event tracking.
-- Append-only table — never UPDATE or DELETE rows.

CREATE TABLE "analytics_events" (
    "id"          TEXT NOT NULL,
    "event_type"  TEXT NOT NULL,
    "user_id"     TEXT,
    "user_role"   TEXT,
    "entity_id"   TEXT,
    "entity_type" TEXT,
    "properties"  JSONB,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- FK to users (nullable — events survive user deletion)
ALTER TABLE "analytics_events"
    ADD CONSTRAINT "analytics_events_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes for common query patterns
CREATE INDEX "analytics_events_event_type_created_at_idx"
    ON "analytics_events"("event_type", "created_at");

CREATE INDEX "analytics_events_user_id_created_at_idx"
    ON "analytics_events"("user_id", "created_at");

CREATE INDEX "analytics_events_entity_type_entity_id_idx"
    ON "analytics_events"("entity_type", "entity_id");

CREATE INDEX "analytics_events_created_at_idx"
    ON "analytics_events"("created_at");
