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
    private final JdbcTemplate jdbc;
    private final ApplicationEventPublisher events;

    public AnnouncementService(JdbcTemplate jdbc, ApplicationEventPublisher events) {
        this.jdbc = jdbc;
        this.events = events;
    }

    public enum Kind { SCENARIO_PUBLISHED, SCENARIO_ARCHIVED }
    public record Created(UUID id) {}
    public record Item(UUID id, UUID scenarioId, Kind kind, String scenarioTitle, Instant createdAt, boolean read) {}
    public record Feed(List<Item> items, long totalElements, long unreadCount, int page, int size) {}

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
        var items = jdbc.query("""
                SELECT a.*, (r.user_id IS NOT NULL) AS is_read
                FROM announcements a LEFT JOIN announcement_reads r
                  ON r.announcement_id = a.id AND r.user_id = ?
                ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?
                """, (rs, row) -> new Item(rs.getObject("id", UUID.class), rs.getObject("scenario_id", UUID.class),
                Kind.valueOf(rs.getString("kind")), rs.getString("scenario_title"),
                rs.getTimestamp("created_at").toInstant(), rs.getBoolean("is_read")), userId, size, (long) page * size);
        long total = jdbc.queryForObject("SELECT count(*) FROM announcements", Long.class);
        long unread = jdbc.queryForObject("""
                SELECT count(*) FROM announcements a WHERE NOT EXISTS (
                  SELECT 1 FROM announcement_reads r WHERE r.announcement_id = a.id AND r.user_id = ?)
                """, Long.class, userId);
        return new Feed(items, total, unread, page, size);
    }

    @Transactional
    public void markRead(UUID userId, List<UUID> ids) {
        // Insert only existing announcements; duplicates and repeated requests are harmless.
        for (UUID id : ids.stream().distinct().toList()) {
            jdbc.update("""
                    INSERT INTO announcement_reads (user_id, announcement_id)
                    SELECT ?, id FROM announcements WHERE id = ? ON CONFLICT DO NOTHING
                    """, userId, id);
        }
    }
}
