package com.ibm.consulting.sim.announcement.application;

import com.ibm.consulting.sim.scenario.domain.Scenario;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;

@Service
public class AssignmentAnnouncementService {
    private final JdbcTemplate jdbc;
    private final ApplicationEventPublisher events;
    public AssignmentAnnouncementService(JdbcTemplate jdbc, ApplicationEventPublisher events) {
        this.jdbc = jdbc;
        this.events = events;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(Scenario scenario, List<UUID> newAssignees) {
        if (newAssignees.isEmpty()) return;
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO announcements (id, scenario_id, kind, scenario_title, message, audience)
                VALUES (?, ?, 'SCENARIO_ASSIGNED', ?, ?, 'USERS')
                """, id, scenario.getId(), scenario.getTitle(),
                "You have been assigned \"" + scenario.getTitle() + "\". Find it in your Office when it is available.");
        for (UUID userId : newAssignees.stream().distinct().toList()) {
            jdbc.update("INSERT INTO announcement_recipients (announcement_id, user_id) VALUES (?, ?)", id, userId);
        }
        // Only an ID is broadcast. Each authenticated client fetches its own filtered feed.
        events.publishEvent(new AnnouncementService.Created(id));
    }
}
