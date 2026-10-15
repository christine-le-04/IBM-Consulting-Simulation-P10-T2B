package com.ibm.consulting.sim.announcement.application;

import com.ibm.consulting.sim.scenario.domain.Scenario;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class AnnouncementService {
    // Resolve the role from the account, never from client-supplied filters or stale JWT claims.
    static final String VISIBLE = """
            (a.audience = 'ALL' OR EXISTS (SELECT 1 FROM users u WHERE u.id = ? AND (
                (a.audience = 'ROLES' AND EXISTS (SELECT 1 FROM announcement_roles ar
                    WHERE ar.announcement_id = a.id AND ar.role = u.role))
                OR (a.audience = 'USERS' AND EXISTS (SELECT 1 FROM announcement_recipients recipient
                    WHERE recipient.announcement_id = a.id AND recipient.user_id = u.id)))))
            """;
    static final String ELIGIBLE = "a.withdrawn_at IS NULL AND a.publish_at <= CURRENT_TIMESTAMP "
            + "AND (a.expires_at IS NULL OR a.expires_at > CURRENT_TIMESTAMP) AND " + VISIBLE;
    private final JdbcTemplate jdbc;
    private final ApplicationEventPublisher events;

    public AnnouncementService(JdbcTemplate jdbc, ApplicationEventPublisher events) {
        this.jdbc = jdbc;
        this.events = events;
    }

    public enum Kind { SCENARIO_PUBLISHED, SCENARIO_ARCHIVED, ADMIN_MESSAGE, SCENARIO_ASSIGNED }
    public record Created(UUID id) {}
    public record Item(UUID id, UUID scenarioId, Kind kind, String scenarioTitle, Instant createdAt, boolean read,
                       String title, String message) {}
    public record Feed(List<Item> items, long totalElements, long unreadCount, int page, int size, Instant readThrough) {
        public Feed(List<Item> items, long totalElements, long unreadCount, int page, int size) {
            this(items, totalElements, unreadCount, page, size, Instant.now());
        }
    }

    // Must join the scenario transaction: a failed publish/archive must not leave an announcement.
    @Transactional(propagation = Propagation.MANDATORY)
    public void record(Scenario scenario, Kind kind) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO announcements (id, scenario_id, kind, scenario_title) VALUES (?, ?, ?, ?)",
                id, scenario.getId(), kind.name(), scenario.getTitle());
        events.publishEvent(new Created(id));
    }

    @Transactional(readOnly = true)
    public Feed list(UUID userId, int page, int size) {
        return list(userId, page, size, false);
    }

    @Transactional(readOnly = true)
    public Feed list(UUID userId, int page, int size, boolean unreadOnly) {
        Instant readThrough = jdbc.queryForObject("SELECT CURRENT_TIMESTAMP", java.sql.Timestamp.class).toInstant();
        var items = jdbc.query("""
                SELECT a.*, (r.user_id IS NOT NULL) AS is_read,
                  COALESCE(a.title, a.scenario_title) AS display_title,
                  COALESCE(a.message, CASE WHEN a.kind = 'SCENARIO_PUBLISHED'
                    THEN 'A scenario is now available in the catalogue.'
                    ELSE 'This scenario is no longer available for new runs. Existing runs are kept.' END) AS display_message
                FROM announcements a LEFT JOIN announcement_reads r
                  ON r.announcement_id = a.id AND r.user_id = ?
                WHERE %s
                ORDER BY a.publish_at DESC, a.id DESC LIMIT ? OFFSET ?
                """.formatted(ELIGIBLE + (unreadOnly ? " AND r.user_id IS NULL" : "")), (rs, row) -> new Item(rs.getObject("id", UUID.class), rs.getObject("scenario_id", UUID.class),
                Kind.valueOf(rs.getString("kind")), rs.getString("scenario_title"),
                rs.getTimestamp("publish_at").toInstant(), rs.getBoolean("is_read"),
                rs.getString("display_title"), rs.getString("display_message")), userId, userId, size, (long) page * size);
        long total = jdbc.queryForObject("SELECT count(*) FROM announcements a WHERE " + ELIGIBLE, Long.class, userId);
        long unread = jdbc.queryForObject("""
                SELECT count(*) FROM announcements a WHERE %s AND NOT EXISTS (
                  SELECT 1 FROM announcement_reads r WHERE r.announcement_id = a.id AND r.user_id = ?)
                """.formatted(ELIGIBLE), Long.class, userId, userId);
        return new Feed(items, unreadOnly ? unread : total, unread, page, size, readThrough);
    }

    @Transactional
    public void markAllRead(UUID userId, Instant through) {
        // A feed timestamp keeps announcements arriving after the user opened it unread.
        jdbc.update("""
                INSERT INTO announcement_reads (user_id, announcement_id)
                SELECT ?, a.id FROM announcements a WHERE %s
                AND a.publish_at <= LEAST(?, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING
                """.formatted(ELIGIBLE), userId, userId, java.sql.Timestamp.from(through));
    }

    @Transactional
    public void markRead(UUID userId, List<UUID> ids) {
        // Insert only existing announcements; duplicates and repeated requests are harmless.
        for (UUID id : ids.stream().distinct().toList()) {
            jdbc.update("""
                    INSERT INTO announcement_reads (user_id, announcement_id)
                    SELECT ?, a.id FROM announcements a WHERE a.id = ? AND %s ON CONFLICT DO NOTHING
                    """.formatted(ELIGIBLE), userId, id, userId);
        }
    }
}
