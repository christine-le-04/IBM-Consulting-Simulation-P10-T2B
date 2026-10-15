package com.ibm.consulting.sim.announcement.application;

import com.ibm.consulting.sim.shared.infrastructure.observability.AuditAction;
import com.ibm.consulting.sim.shared.infrastructure.observability.AuditLogger;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;
import java.util.Set;
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
        String cleanTitle = required(title, 120, "Title");
        String cleanMessage = required(message, 4000, "Message");
        if (targetRoles != null && (targetRoles.isEmpty() || targetRoles.stream().anyMatch(java.util.Objects::isNull))) {
            throw new IllegalArgumentException("Choose at least one valid recipient role.");
        }
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO announcements (id, kind, title, message, audience) VALUES (?, 'ADMIN_MESSAGE', ?, ?, ?)",
                id, cleanTitle, cleanMessage, targetRoles == null ? "ALL" : "ROLES");
        if (targetRoles != null) {
            for (UserRole role : targetRoles) {
                jdbc.update("INSERT INTO announcement_roles (announcement_id, role) VALUES (?, ?)", id, role.name());
            }
        }
        audit.recordAdmin(AuditAction.ADMIN_ANNOUNCEMENT_PUBLISHED, "ANNOUNCEMENT", id.toString(),
                targetRoles == null ? cleanTitle : cleanTitle + "; roles: " + targetRoles.stream().map(Enum::name).sorted().toList());
        events.publishEvent(new AnnouncementService.Created(id));
        return id;
    }

    private static String required(String value, int limit, String name) {
        if (value == null || value.isBlank() || value.length() > limit) {
            throw new IllegalArgumentException(name + " must contain between 1 and " + limit + " characters.");
        }
        return value.strip();
    }
}
