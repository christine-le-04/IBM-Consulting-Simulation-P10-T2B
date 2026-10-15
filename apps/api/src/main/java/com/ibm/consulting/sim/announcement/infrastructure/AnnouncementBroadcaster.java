package com.ibm.consulting.sim.announcement.infrastructure;

import com.ibm.consulting.sim.announcement.application.AnnouncementService.Created;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class AnnouncementBroadcaster {
    private static final Logger log = LoggerFactory.getLogger(AnnouncementBroadcaster.class);
    private final SimpMessagingTemplate messaging;
    public AnnouncementBroadcaster(SimpMessagingTemplate messaging) { this.messaging = messaging; }

    @TransactionalEventListener
    public void afterCommit(Created event) {
        try {
            // An invalidation hint only: clients fetch authoritative, user-specific read state over HTTP.
            messaging.convertAndSend("/topic/announcements", event);
        } catch (RuntimeException failure) {
            // The saved announcement remains available through polling/reconnect; do not fail the admin's response.
            log.warn("Real-time announcement delivery failed for {}", event.id(), failure);
        }
    }
}
