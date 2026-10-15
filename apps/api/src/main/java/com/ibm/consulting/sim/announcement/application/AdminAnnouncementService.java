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
        return publishNew(UUID.randomUUID(), title, message, targetRoles, publishAt, expiresAt);
    }

    @Transactional
    public UUID publishOnce(UUID actorId, UUID requestId, String title, String message, Set<UserRole> targetRoles,
                            Instant publishAt, Instant expiresAt) {
        if (actorId == null || requestId == null) throw new IllegalArgumentException("A publisher and request reference are required.");
        String hash = fingerprint(required(title, 120, "Title"), required(message, 4000, "Message"), targetRoles, publishAt, expiresAt);
        UUID id = UUID.randomUUID();
        // The unique key serializes concurrent retries. Both the claim and announcement roll back together.
        int claimed = jdbc.update("""
                INSERT INTO announcement_publish_requests (actor_id, request_id, payload_hash, announcement_id)
                VALUES (?, ?, ?, ?) ON CONFLICT (actor_id, request_id) DO NOTHING
                """, actorId, requestId, hash, id);
        if (claimed == 0) {
            return jdbc.queryForObject("""
                    SELECT announcement_id, payload_hash FROM announcement_publish_requests WHERE actor_id = ? AND request_id = ?
                    """, (rs, row) -> {
                if (!hash.equals(rs.getString("payload_hash"))) throw new IllegalArgumentException("This publish request was already used for a different announcement. Please preview and submit again.");
                return rs.getObject("announcement_id", UUID.class);
            }, actorId, requestId);
        }
        return publishNew(id, title, message, targetRoles, publishAt, expiresAt);
    }

    private static String fingerprint(String title, String message, Set<UserRole> roles, Instant publishAt, Instant expiresAt) {
        if (roles != null && (roles.isEmpty() || roles.stream().anyMatch(java.util.Objects::isNull)))
            throw new IllegalArgumentException("Choose at least one valid recipient role.");
        String[] fields = {title, message, roles == null ? "ALL" : roles.stream().map(Enum::name).sorted().toList().toString(),
                String.valueOf(publishAt), String.valueOf(expiresAt)};
        try {
            var digest = java.security.MessageDigest.getInstance("SHA-256");
            for (String field : fields) {
                byte[] bytes = field.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                digest.update(java.nio.ByteBuffer.allocate(4).putInt(bytes.length).array());
                digest.update(bytes);
            }
            return java.util.HexFormat.of().formatHex(digest.digest());
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }

    private UUID publishNew(UUID id, String title, String message, Set<UserRole> targetRoles, Instant publishAt, Instant expiresAt) {
        String cleanTitle = required(title, 120, "Title");
        String cleanMessage = required(message, 4000, "Message");
        if (targetRoles != null && (targetRoles.isEmpty() || targetRoles.stream().anyMatch(java.util.Objects::isNull))) {
            throw new IllegalArgumentException("Choose at least one valid recipient role.");
        }
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
