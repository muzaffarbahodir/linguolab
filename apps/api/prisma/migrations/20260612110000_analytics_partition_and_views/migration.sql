-- ============================================================
-- Stage 13.5: analytics_events monthly partitioning + 6 materialized views
-- ============================================================

-- ─── 1. Convert analytics_events to a partitioned table ────

ALTER TABLE analytics_events RENAME TO analytics_events_legacy;

CREATE TABLE analytics_events (
  id          TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  event_type  TEXT        NOT NULL,
  user_id     TEXT,
  user_role   TEXT,
  entity_id   TEXT,
  entity_type TEXT,
  properties  JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- ─── 2. Monthly partitions 2025-01 → 2027-06 ───────────────

CREATE TABLE analytics_events_2025_01 PARTITION OF analytics_events FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE analytics_events_2025_02 PARTITION OF analytics_events FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE analytics_events_2025_03 PARTITION OF analytics_events FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE analytics_events_2025_04 PARTITION OF analytics_events FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE analytics_events_2025_05 PARTITION OF analytics_events FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE analytics_events_2025_06 PARTITION OF analytics_events FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE analytics_events_2025_07 PARTITION OF analytics_events FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE analytics_events_2025_08 PARTITION OF analytics_events FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE analytics_events_2025_09 PARTITION OF analytics_events FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE analytics_events_2025_10 PARTITION OF analytics_events FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE analytics_events_2025_11 PARTITION OF analytics_events FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE analytics_events_2025_12 PARTITION OF analytics_events FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE TABLE analytics_events_2026_01 PARTITION OF analytics_events FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE analytics_events_2026_02 PARTITION OF analytics_events FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE analytics_events_2026_03 PARTITION OF analytics_events FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE analytics_events_2026_04 PARTITION OF analytics_events FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE analytics_events_2026_05 PARTITION OF analytics_events FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE analytics_events_2026_06 PARTITION OF analytics_events FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE analytics_events_2026_07 PARTITION OF analytics_events FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE analytics_events_2026_08 PARTITION OF analytics_events FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE analytics_events_2026_09 PARTITION OF analytics_events FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE analytics_events_2026_10 PARTITION OF analytics_events FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE analytics_events_2026_11 PARTITION OF analytics_events FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE analytics_events_2026_12 PARTITION OF analytics_events FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

CREATE TABLE analytics_events_2027_01 PARTITION OF analytics_events FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
CREATE TABLE analytics_events_2027_02 PARTITION OF analytics_events FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');
CREATE TABLE analytics_events_2027_03 PARTITION OF analytics_events FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');
CREATE TABLE analytics_events_2027_04 PARTITION OF analytics_events FOR VALUES FROM ('2027-04-01') TO ('2027-05-01');
CREATE TABLE analytics_events_2027_05 PARTITION OF analytics_events FOR VALUES FROM ('2027-05-01') TO ('2027-06-01');
CREATE TABLE analytics_events_2027_06 PARTITION OF analytics_events FOR VALUES FROM ('2027-06-01') TO ('2027-07-01');

-- Default partition catches anything outside the explicit ranges
CREATE TABLE analytics_events_default PARTITION OF analytics_events DEFAULT;

-- ─── 3. Indexes (inherited by all partitions) ───────────────

CREATE INDEX ON analytics_events (event_type, created_at);
CREATE INDEX ON analytics_events (user_id, created_at) WHERE user_id IS NOT NULL;
CREATE INDEX ON analytics_events (entity_type, entity_id)  WHERE entity_type IS NOT NULL;

-- ─── 4. FK back to users (PG 12+ supports FK on partition parent) ─

ALTER TABLE analytics_events
  ADD CONSTRAINT analytics_events_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES "User"(id) ON DELETE SET NULL;

-- ─── 5. Copy existing data ──────────────────────────────────

INSERT INTO analytics_events (id, event_type, user_id, user_role, entity_id, entity_type, properties, created_at)
SELECT id, event_type, user_id, user_role, entity_id, entity_type,
       CASE WHEN properties IS NOT NULL THEN properties::jsonb ELSE NULL END,
       created_at
FROM analytics_events_legacy;

DROP TABLE analytics_events_legacy;

-- ─── 6. Function: ensure next month's partition exists ─────

CREATE OR REPLACE FUNCTION ensure_analytics_partition(for_month DATE)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  pname      TEXT;
  start_date DATE;
  end_date   DATE;
BEGIN
  start_date := date_trunc('month', for_month)::date;
  end_date   := (start_date + INTERVAL '1 month')::date;
  pname      := 'analytics_events_' || to_char(start_date, 'YYYY_MM');

  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = pname) THEN
    EXECUTE format(
      'CREATE TABLE %I PARTITION OF analytics_events FOR VALUES FROM (%L::timestamptz) TO (%L::timestamptz)',
      pname, start_date, end_date
    );
  END IF;
END;
$$;

-- ─── 7. Materialized view 1: daily event counts ────────────

CREATE MATERIALIZED VIEW mv_daily_event_counts AS
SELECT
  date_trunc('day', created_at)::date AS day,
  event_type,
  COUNT(*)::int                        AS cnt
FROM analytics_events
GROUP BY 1, 2
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_daily_event_counts (day, event_type);

-- ─── 8. Materialized view 2: monthly revenue ───────────────

CREATE MATERIALIZED VIEW mv_monthly_revenue AS
SELECT
  date_trunc('month', paid_at)::date AS month,
  SUM(amount_tiyin / 100)::bigint    AS revenue_uzs,
  COUNT(*)::int                      AS payments_count
FROM payments
WHERE status = 'PAID' AND paid_at IS NOT NULL
GROUP BY 1
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_monthly_revenue (month);

-- ─── 9. Materialized view 3: student activity (rolling 30d) ─

CREATE MATERIALIZED VIEW mv_student_activity AS
SELECT
  user_id,
  COUNT(*) FILTER (WHERE event_type = 'lesson_attend')::int    AS lessons_attended,
  COUNT(*) FILTER (WHERE event_type = 'homework_submit')::int  AS hw_submitted,
  COUNT(*) FILTER (WHERE event_type = 'login')::int            AS login_count,
  COUNT(DISTINCT date_trunc('day', created_at))::int           AS active_days,
  MAX(created_at)                                              AS last_active_at
FROM analytics_events
WHERE user_id IS NOT NULL
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY user_id
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_student_activity (user_id);

-- ─── 10. Materialized view 4: monthly funnel ───────────────

CREATE MATERIALIZED VIEW mv_funnel_monthly AS
SELECT
  date_trunc('month', created_at)::date                                  AS month,
  COUNT(*) FILTER (WHERE event_type = 'trial_request')::int              AS trials,
  COUNT(*) FILTER (WHERE event_type = 'enroll')::int                     AS enrollments,
  COUNT(*) FILTER (WHERE event_type = 'payment_paid')::int               AS payments
FROM analytics_events
GROUP BY 1
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_funnel_monthly (month);

-- ─── 11. Materialized view 5: class stats ──────────────────

CREATE MATERIALIZED VIEW mv_class_stats AS
WITH lesson_agg AS (
  SELECT
    l.class_id,
    COUNT(l.id) FILTER (WHERE l.status = 'COMPLETED')::int AS lessons_completed,
    COUNT(la.id) FILTER (WHERE la.status IN ('PRESENT','LATE'))::int AS attended,
    COUNT(la.id)::int AS attendance_total
  FROM lessons l
  LEFT JOIN lesson_attendances la ON la.lesson_id = l.id
  GROUP BY l.class_id
),
enroll_agg AS (
  SELECT
    class_id,
    COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS enrolled_active,
    COUNT(*)::int AS enrolled_total
  FROM "Enrollment"
  GROUP BY class_id
)
SELECT
  c.id                                                              AS class_id,
  c.title,
  c.language_id,
  c.teacher_id,
  c.price_uzs,
  c.level::text,
  COALESCE(ea.enrolled_active, 0)                                   AS enrolled_active,
  COALESCE(ea.enrolled_total, 0)                                    AS enrolled_total,
  COALESCE(la.lessons_completed, 0)                                 AS lessons_completed,
  (COALESCE(ea.enrolled_active, 0) * c.price_uzs)::bigint           AS monthly_revenue_uzs,
  ROUND(COALESCE(
    100.0 * la.attended / NULLIF(la.attendance_total, 0), 0
  ))::int                                                            AS avg_attendance_pct
FROM "Class" c
LEFT JOIN enroll_agg ea ON ea.class_id = c.id
LEFT JOIN lesson_agg la ON la.class_id = c.id
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_class_stats (class_id);

-- ─── 12. Materialized view 6: teacher performance ──────────

CREATE MATERIALIZED VIEW mv_teacher_performance AS
WITH lesson_agg AS (
  SELECT
    l.class_id,
    COUNT(l.id) FILTER (WHERE l.status = 'COMPLETED')::int          AS lessons_completed,
    COUNT(la.id) FILTER (WHERE la.status IN ('PRESENT','LATE'))::int AS attended,
    COUNT(la.id)::int                                                AS attendance_total
  FROM lessons l
  LEFT JOIN lesson_attendances la ON la.lesson_id = l.id
  GROUP BY l.class_id
),
enroll_agg AS (
  SELECT class_id, COUNT(DISTINCT student_id)::int AS students
  FROM "Enrollment" WHERE status = 'ACTIVE'
  GROUP BY class_id
)
SELECT
  t.user_id,
  u.first_name,
  u.last_name,
  COUNT(DISTINCT c.id)::int                                           AS classes_count,
  COALESCE(SUM(la.lessons_completed), 0)::int                        AS lessons_conducted,
  COALESCE(SUM(ea.students), 0)::int                                 AS students_total,
  ROUND(COALESCE(
    100.0 * SUM(la.attended) / NULLIF(SUM(la.attendance_total), 0), 0
  ))::int                                                             AS avg_attendance_pct
FROM "Teacher" t
JOIN "User" u ON u.id = t.user_id
LEFT JOIN "Class" c ON c.teacher_id = t.id
LEFT JOIN lesson_agg la ON la.class_id = c.id
LEFT JOIN enroll_agg ea ON ea.class_id = c.id
GROUP BY t.user_id, u.first_name, u.last_name
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_teacher_performance (user_id);

-- ─── 13. Initial population of all views ───────────────────

REFRESH MATERIALIZED VIEW mv_daily_event_counts;
REFRESH MATERIALIZED VIEW mv_monthly_revenue;
REFRESH MATERIALIZED VIEW mv_student_activity;
REFRESH MATERIALIZED VIEW mv_funnel_monthly;
REFRESH MATERIALIZED VIEW mv_class_stats;
REFRESH MATERIALIZED VIEW mv_teacher_performance;
