package com.ibm.consulting.sim.announcement.application;

import com.ibm.consulting.sim.shared.infrastructure.observability.AuditAction;
import com.ibm.consulting.sim.shared.infrastructure.observability.AuditLogger;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;
import java.util.Set;
import java.time.Instant;
import java.sql.Timestamp;
import com.ibm.consulting.sim.identity.domain.UserRole;

@Service
public class AdminAnnouncementService {
    private final JdbcTemplate jdbc;
    private final ApplicationEventPublisher events;
    private final AuditLogger audit;

    public AdminAnnouncementService(JdbcTemplate jdbc, ApplicationEventPublisher events, AuditLogger audit) {
        this.jdbc = jdbc;
        this.events = events;
        this.audit = audit;
    }

    @Transactional
    public UUID publish(String title, String message) {
        return publish(title, message, null);
    }

    @Transactional
    public UUID publish(String title, String message, Set<UserRole> targetRoles) {
        return publish(title, message, targetRoles, null, null);
    }

    @Transactional
    public UUID publish(String title, String message, Set<UserRole> targetRoles, Instant publishAt, Instant expiresAt) {
        String cleanTitle = required(title, 120, "Title");
        String cleanMessage = required(message, 4000, "Message");
        if (targetRoles != null && (targetRoles.isEmpty() || targetRoles.stream().anyMatch(java.util.Objects::isNull))) {
            throw new IllegalArgumentException("Choose at least one valid recipient role.");
        }
        UUID id = UUID.randomUUID();
        Instant now = jdbc.queryForObject("SELECT CURRENT_TIMESTAMP", Timestamp.class).toInstant();
        Instant effectivePublish = publishAt == null ? now : publishAt;
        if (publishAt != null && !publishAt.isAfter(now)) throw new IllegalArgumentException("Choose a future publication time.");
        if (expiresAt != null && !expiresAt.isAfter(effectivePublish)) throw new IllegalArgumentException("Expiry must be after publication.");
        jdbc.update("""
                INSERT INTO announcements (id, kind, title, message, audience, publish_at, expires_at, delivered_at)
                VALUES (?, 'ADMIN_MESSAGE', ?, ?, ?, ?, ?, ?)
                """, id, cleanTitle, cleanMessage, targetRoles == null ? "ALL" : "ROLES",
                Timestamp.from(effectivePublish), expiresAt == null ? null : Timestamp.from(expiresAt), publishAt == null ? Timestamp.from(now) : null);
        if (targetRoles != null) {
            for (UserRole role : targetRoles) {
                jdbc.update("INSERT INTO announcement_roles (announcement_id, role) VALUES (?, ?)", id, role.name());
            }
        }
        audit.recordAdmin(publishAt == null ? AuditAction.ADMIN_ANNOUNCEMENT_PUBLISHED : AuditAction.ADMIN_ANNOUNCEMENT_SCHEDULED, "ANNOUNCEMENT", id.toString(),
                targetRoles == null ? cleanTitle : cleanTitle + "; roles: " + targetRoles.stream().map(Enum::name).sorted().toList());
        if (publishAt == null) events.publishEvent(new AnnouncementService.Created(id));
        return id;
    }

    private static String required(String value, int limit, String name) {
        if (value == null || value.isBlank() || value.length() > limit) {
            throw new IllegalArgumentException(name + " must contain between 1 and " + limit + " characters.");
        }
        return value.strip();
    }
}
