package com.ibm.consulting.sim.admin.application;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/** Bounded read model: no engagement events, account credentials or scenario graphs are loaded. */
@Service
public class LearnerProgressService {
    private final JdbcTemplate jdbc;
    private final NamedParameterJdbcTemplate queries;

    public LearnerProgressService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
        this.queries = new NamedParameterJdbcTemplate(jdbc);
    }

    private static final String PROGRESS = """
            WITH progress AS (
                SELECT e.id, e.user_id, e.scenario_id, e.state, e.updated_at, e.completed_at,
                    COALESCE(u.display_name, 'Removed learner') AS display_name,
                    COALESCE(u.email, '') AS email, COALESCE(s.title, 'Retired scenario') AS scenario_title,
                    a.overall_score,
                    CASE WHEN e.state IN ('QUALIFYING', 'CLIENT_INTELLIGENCE', 'HYPOTHESIS_READY') THEN 'Research'
                         WHEN e.state = 'OUTREACHING' THEN 'Outreach'
                         WHEN e.state IN ('MEETING_SECURED', 'PREPARING') THEN 'Preparation'
                         WHEN e.state IN ('IN_MEETING', 'MEETING_FAILED') THEN 'Meeting'
                         WHEN e.state IN ('REVIEW', 'COMPLETED') THEN 'Review'
                         ELSE 'Proposal' END AS stage,
                    CASE WHEN e.state = 'COMPLETED' OR e.completed_at IS NOT NULL THEN 'COMPLETED'
                         WHEN e.state = 'MEETING_FAILED' THEN 'MEETING_FAILED'
                         WHEN e.updated_at <= :cutoff THEN 'STUCK'
                         ELSE 'IN_PROGRESS' END AS status
                FROM engagements e
                LEFT JOIN users u ON u.id = e.user_id
                LEFT JOIN scenarios s ON s.id = e.scenario_id
                LEFT JOIN assessments a ON a.engagement_id = e.id
            )
            """;

    private static final RowMapper<LearnerProgressEntry> ENTRY = (rs, row) -> new LearnerProgressEntry(
            rs.getString("id"), rs.getString("user_id"), rs.getString("display_name"), rs.getString("email"),
            rs.getString("scenario_id"), rs.getString("scenario_title"), rs.getString("state"),
            rs.getObject("overall_score", Integer.class), rs.getTimestamp("updated_at").toInstant(),
            rs.getTimestamp("completed_at") == null ? null : rs.getTimestamp("completed_at").toInstant());

    public record Summary(long inProgress, long stuck, long completed, long meetingFailed, Integer averageScore, long totalRuns) {}
    public record ScenarioOption(UUID id, String title) {}
    public record ProgressPage(List<LearnerProgressEntry> items, long totalElements, int page, int size,
                               int totalPages, Summary summary, List<ScenarioOption> scenarios, Instant asOf) {}

    // A consistent snapshot keeps table counts, summary and status boundaries aligned.
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ProgressPage getProgress(String search, UUID scenarioId, String stage, String status, int page, int size) {
        Instant now = jdbc.queryForObject("SELECT CURRENT_TIMESTAMP", Timestamp.class).toInstant();
        var parameters = new MapSqlParameterSource("cutoff", Timestamp.from(now.minus(3, ChronoUnit.DAYS)));
        StringBuilder where = new StringBuilder(" WHERE 1 = 1");
        if (search != null && !search.isBlank()) {
            where.append(" AND (strpos(lower(display_name), :search) > 0 OR strpos(lower(email), :search) > 0)");
            parameters.addValue("search", search.strip().toLowerCase(Locale.ROOT));
        }
        if (scenarioId != null) {
            where.append(" AND scenario_id = :scenarioId");
            parameters.addValue("scenarioId", scenarioId);
        }
        if (stage != null && !stage.isBlank()) {
            where.append(" AND stage = :stage");
            parameters.addValue("stage", stage);
        }
        if (status != null && !status.isBlank()) {
            where.append(" AND status = :status");
            parameters.addValue("status", status);
        }
        long total = queries.queryForObject(PROGRESS + "SELECT count(*) FROM progress" + where, parameters, Long.class);
        int totalPages = (int) ((total + size - 1) / size);
        // Deletions or status changes can remove the last page during a refresh.
        int effectivePage = totalPages == 0 ? 0 : Math.min(page, totalPages - 1);
        parameters.addValue("size", size).addValue("offset", (long) effectivePage * size);
        var items = queries.query(PROGRESS + "SELECT * FROM progress" + where
                + " ORDER BY updated_at DESC, id DESC LIMIT :size OFFSET :offset", parameters, ENTRY);
        var summary = queries.queryForObject(PROGRESS + """
                SELECT count(*) FILTER (WHERE status = 'IN_PROGRESS') AS in_progress,
                    count(*) FILTER (WHERE status = 'STUCK') AS stuck,
                    count(*) FILTER (WHERE status = 'COMPLETED') AS completed,
                    count(*) FILTER (WHERE status = 'MEETING_FAILED') AS meeting_failed,
                    round(avg(overall_score) FILTER (WHERE status = 'COMPLETED'))::integer AS average_score,
                    count(*) AS total_runs FROM progress
                """, parameters, (rs, row) -> new Summary(rs.getLong("in_progress"), rs.getLong("stuck"),
                rs.getLong("completed"), rs.getLong("meeting_failed"), rs.getObject("average_score", Integer.class), rs.getLong("total_runs")));
        var scenarios = jdbc.query("""
                SELECT DISTINCT e.scenario_id, COALESCE(s.title, 'Retired scenario') AS title
                FROM engagements e LEFT JOIN scenarios s ON s.id = e.scenario_id ORDER BY title, e.scenario_id
                """, (rs, row) -> new ScenarioOption(rs.getObject("scenario_id", UUID.class), rs.getString("title")));
        return new ProgressPage(items, total, effectivePage, size, totalPages, summary, scenarios, now);
    }

    @Transactional(readOnly = true)
    public LearnerProgressEntry getRun(UUID engagementId) {
        var parameters = new MapSqlParameterSource("cutoff", Timestamp.from(Instant.now().minus(3, ChronoUnit.DAYS)))
                .addValue("id", engagementId);
        return queries.query(PROGRESS + "SELECT * FROM progress WHERE id = :id", parameters, ENTRY)
                .stream().findFirst().orElse(null);
    }
}
