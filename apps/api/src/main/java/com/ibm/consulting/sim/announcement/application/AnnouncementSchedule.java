package com.ibm.consulting.sim.announcement.application;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;

@Service
public class AnnouncementSchedule {
    private final JdbcTemplate jdbc;
    private final ApplicationEventPublisher events;
    public AnnouncementSchedule(JdbcTemplate jdbc, ApplicationEventPublisher events) {
        this.jdbc = jdbc; this.events = events;
    }

    // Database time controls visibility even if the scheduler or a WebSocket connection is down.
    // Locking prevents two API replicas announcing the same transition concurrently.
    @Scheduled(fixedDelay = 15000)
    @Transactional
    public void notifyTransitions() {
        var published = jdbc.query("""
                SELECT id FROM announcements WHERE withdrawn_at IS NULL AND delivered_at IS NULL
                AND publish_at <= CURRENT_TIMESTAMP AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
                ORDER BY publish_at LIMIT 100 FOR UPDATE SKIP LOCKED
                """, (rs, row) -> rs.getObject("id", UUID.class));
        for (UUID id : published) {
            jdbc.update("UPDATE announcements SET delivered_at = CURRENT_TIMESTAMP WHERE id = ?", id);
            events.publishEvent(new AnnouncementService.Created(id));
        }
        var expired = jdbc.query("""
                SELECT id FROM announcements WHERE withdrawn_at IS NULL AND expiry_notified_at IS NULL
                AND expires_at <= CURRENT_TIMESTAMP ORDER BY expires_at LIMIT 100 FOR UPDATE SKIP LOCKED
                """, (rs, row) -> rs.getObject("id", UUID.class));
        for (UUID id : expired) {
            jdbc.update("UPDATE announcements SET expiry_notified_at = CURRENT_TIMESTAMP WHERE id = ?", id);
            events.publishEvent(new AnnouncementService.Created(id));
        }
    }
}
