package com.ibm.consulting.sim.announcement;

import com.ibm.consulting.sim.announcement.application.AnnouncementService;
import com.ibm.consulting.sim.announcement.application.AnnouncementService.Kind;
import com.ibm.consulting.sim.announcement.infrastructure.AnnouncementBroadcaster;
import com.ibm.consulting.sim.meeting.application.MeetingServiceTestFactory;
import com.ibm.consulting.sim.scenario.domain.Scenario;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.TransactionTemplate;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SpringJUnitConfig(AnnouncementTransactionTest.Config.class)
class AnnouncementTransactionTest {
    @Configuration
    @EnableTransactionManagement
    static class Config {
        @Bean PlatformTransactionManager transactions() { return MeetingServiceTestFactory.transactions(); }
        @Bean JdbcTemplate jdbc() { return mock(JdbcTemplate.class); }
        @Bean SimpMessagingTemplate messaging() { return mock(SimpMessagingTemplate.class); }
        @Bean AnnouncementService service(JdbcTemplate jdbc, ApplicationEventPublisher publisher) {
            return new AnnouncementService(jdbc, publisher);
        }
        @Bean AnnouncementBroadcaster broadcaster(SimpMessagingTemplate messaging) { return new AnnouncementBroadcaster(messaging); }
    }
    @Autowired AnnouncementService service;
    @Autowired PlatformTransactionManager transactions;
    @Autowired SimpMessagingTemplate messaging;
    @Autowired JdbcTemplate jdbc;
    private final Scenario scenario = Scenario.create("Published title", "Retail", "Description", 3);
    @BeforeEach void clear() { reset(messaging, jdbc); }

    @Test void broadcastsOnlyAfterSuccessfulCommit() {
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            service.record(scenario, Kind.SCENARIO_PUBLISHED);
            verifyNoInteractions(messaging);
        });
        verify(messaging).convertAndSend(eq("/topic/announcements"), any(AnnouncementService.Created.class));
    }

    @Test void rollbackNeverBroadcasts() {
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            service.record(scenario, Kind.SCENARIO_ARCHIVED);
            status.setRollbackOnly();
        });
        verifyNoInteractions(messaging);
    }

    @Test void refusesRecordingOutsideTheScenarioTransaction() {
        assertThatThrownBy(() -> service.record(scenario, Kind.SCENARIO_PUBLISHED))
                .isInstanceOf(IllegalTransactionStateException.class);
        verifyNoInteractions(jdbc, messaging);
    }

    @Test void deliveryFailureDoesNotTurnCommittedScenarioChangeIntoAnError() {
        doThrow(new IllegalStateException("broker unavailable")).when(messaging)
                .convertAndSend(eq("/topic/announcements"), any(Object.class));
        assertThatCode(() -> new TransactionTemplate(transactions).executeWithoutResult(status ->
                service.record(scenario, Kind.SCENARIO_PUBLISHED))).doesNotThrowAnyException();
    }
}
