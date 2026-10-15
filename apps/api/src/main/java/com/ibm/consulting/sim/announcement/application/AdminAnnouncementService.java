package com.ibm.consulting.sim.announcement.application;

import com.ibm.consulting.sim.shared.infrastructure.observability.AuditAction;
import com.ibm.consulting.sim.shared.infrastructure.observability.AuditLogger;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;

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
        String cleanTitle = required(title, 120, "Title");
        String cleanMessage = required(message, 4000, "Message");
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO announcements (id, kind, title, message) VALUES (?, 'ADMIN_MESSAGE', ?, ?)",
                id, cleanTitle, cleanMessage);
        audit.recordAdmin(AuditAction.ADMIN_ANNOUNCEMENT_PUBLISHED, "ANNOUNCEMENT", id.toString(), cleanTitle);
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
