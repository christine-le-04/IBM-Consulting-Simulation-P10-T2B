package com.ibm.consulting.sim.announcement.application;

import com.ibm.consulting.sim.shared.domain.NotFoundException;
import com.ibm.consulting.sim.shared.infrastructure.observability.AuditAction;
import com.ibm.consulting.sim.shared.infrastructure.observability.AuditLogger;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Service
public class AdminAnnouncementHistory {
    private final JdbcTemplate jdbc;
    private final AuditLogger audit;
    private final ApplicationEventPublisher events;
    public AdminAnnouncementHistory(JdbcTemplate jdbc, AuditLogger audit, ApplicationEventPublisher events) {
        this.jdbc = jdbc; this.audit = audit; this.events = events;
    }
    public record Entry(UUID id, String title, String message, String audience, List<String> targetRoles,
                        Instant createdAt, Instant withdrawnAt, String status) {}
    public record Page(List<Entry> items, long totalElements, int page, int size) {}

    @Transactional(readOnly = true)
    public Page list(int page, int size) {
        var items = jdbc.query("""
                SELECT a.*, ARRAY(SELECT ar.role FROM announcement_roles ar
                    WHERE ar.announcement_id = a.id ORDER BY ar.role) AS target_roles
                FROM announcements a WHERE kind = 'ADMIN_MESSAGE'
                ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?
                """, (rs, row) -> new Entry(rs.getObject("id", UUID.class), rs.getString("title"), rs.getString("message"),
                rs.getString("audience"), Arrays.asList((String[]) rs.getArray("target_roles").getArray()),
                rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("withdrawn_at") == null ? null : rs.getTimestamp("withdrawn_at").toInstant(),
                rs.getTimestamp("withdrawn_at") == null ? "PUBLISHED" : "WITHDRAWN"), size, (long) page * size);
        return new Page(items, jdbc.queryForObject("SELECT count(*) FROM announcements WHERE kind = 'ADMIN_MESSAGE'", Long.class), page, size);
    }

    @Transactional
    public void withdraw(UUID id) {
        var titles = jdbc.query("SELECT title FROM announcements WHERE id = ? AND kind = 'ADMIN_MESSAGE' FOR UPDATE",
                (rs, row) -> rs.getString("title"), id);
        if (titles.isEmpty()) throw new NotFoundException("Announcement", id);
        if (jdbc.update("UPDATE announcements SET withdrawn_at = CURRENT_TIMESTAMP WHERE id = ? AND withdrawn_at IS NULL", id) == 0) return;
        audit.recordAdmin(AuditAction.ADMIN_ANNOUNCEMENT_WITHDRAWN, "ANNOUNCEMENT", id.toString(), titles.getFirst());
        events.publishEvent(new AnnouncementService.Created(id));
    }
}
