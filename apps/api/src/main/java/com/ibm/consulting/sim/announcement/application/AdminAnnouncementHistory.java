package com.ibm.consulting.sim.announcement.application;

import com.ibm.consulting.sim.shared.domain.NotFoundException;
import com.ibm.consulting.sim.shared.infrastructure.observability.AuditAction;
import com.ibm.consulting.sim.shared.infrastructure.observability.AuditLogger;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.ArrayList;
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
                        Instant createdAt, Instant withdrawnAt, String status, Instant publishAt, Instant expiresAt) {}
    public record Page(List<Entry> items, long totalElements, int page, int size) {}

    @Transactional(readOnly = true)
    public Page list(int page, int size) {
        return list(page, size, null, null);
    }

    @Transactional(readOnly = true)
    public Page list(int page, int size, String search, String status) {
        return list(page, size, search, status, null);
    }

    @Transactional(readOnly = true)
    public Page list(int page, int size, String search, String status, String audience) {
        StringBuilder where = new StringBuilder("a.kind = 'ADMIN_MESSAGE'");
        List<Object> filterArgs = new ArrayList<>();
        if (search != null && !search.isBlank()) {
            where.append(" AND (LOWER(a.title) LIKE ? OR LOWER(a.message) LIKE ?)");
            String pattern = "%" + search.trim().toLowerCase(java.util.Locale.ROOT) + "%";
            filterArgs.add(pattern);
            filterArgs.add(pattern);
        }
        if (status != null) {
            where.append(" AND (CASE WHEN a.withdrawn_at IS NOT NULL THEN 'WITHDRAWN' " +
                    "WHEN a.expires_at <= CURRENT_TIMESTAMP THEN 'EXPIRED' " +
                    "WHEN a.publish_at > CURRENT_TIMESTAMP THEN 'SCHEDULED' ELSE 'PUBLISHED' END) = ?");
            filterArgs.add(status);
        }
        if (audience != null) {
            if ("ALL".equals(audience)) {
                where.append(" AND a.audience = 'ALL'");
            } else {
                where.append(" AND a.audience = 'ROLES' AND EXISTS (SELECT 1 FROM announcement_roles ar " +
                        "WHERE ar.announcement_id = a.id AND ar.role = ?)");
                filterArgs.add(audience);
            }
        }
        String sqlWhere = where.toString();
        List<Object> pageArgs = new ArrayList<>(filterArgs);
        pageArgs.add(size);
        pageArgs.add((long) page * size);
        var items = jdbc.query("""
                SELECT a.*, ARRAY(SELECT ar.role FROM announcement_roles ar
                    WHERE ar.announcement_id = a.id ORDER BY ar.role) AS target_roles,
                    CASE WHEN withdrawn_at IS NOT NULL THEN 'WITHDRAWN'
                         WHEN expires_at <= CURRENT_TIMESTAMP THEN 'EXPIRED'
                         WHEN publish_at > CURRENT_TIMESTAMP THEN 'SCHEDULED' ELSE 'PUBLISHED' END AS status
                FROM announcements a WHERE %s
                ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?
                """.formatted(sqlWhere), (rs, row) -> new Entry(rs.getObject("id", UUID.class), rs.getString("title"), rs.getString("message"),
                rs.getString("audience"), Arrays.asList((String[]) rs.getArray("target_roles").getArray()),
                rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("withdrawn_at") == null ? null : rs.getTimestamp("withdrawn_at").toInstant(),
                rs.getString("status"), rs.getTimestamp("publish_at").toInstant(),
                rs.getTimestamp("expires_at") == null ? null : rs.getTimestamp("expires_at").toInstant()), pageArgs.toArray());
        long total = jdbc.queryForObject("SELECT count(*) FROM announcements a WHERE " + sqlWhere, Long.class, filterArgs.toArray());
        return new Page(items, total, page, size);
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
