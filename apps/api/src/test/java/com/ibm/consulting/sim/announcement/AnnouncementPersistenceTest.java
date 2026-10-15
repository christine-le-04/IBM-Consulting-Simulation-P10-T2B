package com.ibm.consulting.sim.announcement;

import com.ibm.consulting.sim.announcement.application.AnnouncementService;
import com.ibm.consulting.sim.announcement.application.AnnouncementService.Kind;
import com.ibm.consulting.sim.announcement.infrastructure.AnnouncementBroadcaster;
import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.identity.domain.UserRole;
import com.ibm.consulting.sim.scenario.domain.Scenario;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

@DataJpaTest
@Import({AnnouncementService.class, AnnouncementBroadcaster.class})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class AnnouncementPersistenceTest {
    @Container static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
            DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }
    @Autowired AnnouncementService service;
    @Autowired PlatformTransactionManager manager;
    @Autowired JdbcTemplate jdbc;
    @Autowired EntityManager entities;
    @MockBean SimpMessagingTemplate messaging;

    @BeforeEach void clear() {
        jdbc.update("DELETE FROM announcement_reads");
        jdbc.update("DELETE FROM announcements");
    }

    @Test void rollbackRemovesAnnouncementAndDoesNotBroadcast() {
        new TransactionTemplate(manager).executeWithoutResult(status -> {
            service.record(scenario(), Kind.SCENARIO_PUBLISHED);
            verifyNoInteractions(messaging);
            status.setRollbackOnly();
        });
        assertThat(service.list(UUID.randomUUID(), 0, 20).items()).isEmpty();
        verifyNoInteractions(messaging);
    }

    @Test void committedAnnouncementSurvivesDeliveryFailureAndReadStateIsPerUser() {
        User first = user();
        User second = user();
        doThrow(new IllegalStateException("broker unavailable")).when(messaging)
                .convertAndSend(eq("/topic/announcements"), any(Object.class));
        new TransactionTemplate(manager).executeWithoutResult(status -> service.record(scenario(), Kind.SCENARIO_PUBLISHED));
        var feed = service.list(first.getId(), 0, 20);
        assertThat(feed.unreadCount()).isEqualTo(1);
        UUID id = feed.items().getFirst().id();
        service.markRead(first.getId(), List.of(id, id, UUID.randomUUID()));
        service.markRead(first.getId(), List.of(id));
        assertThat(service.list(first.getId(), 0, 20).unreadCount()).isZero();
        assertThat(service.list(first.getId(), 0, 20).items().getFirst().read()).isTrue();
        assertThat(service.list(second.getId(), 0, 20).unreadCount()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM announcement_reads", Long.class)).isEqualTo(1);
    }

    @Test void paginationAndMarkingOnePageDoesNotMarkUnseenAnnouncements() {
        User user = user();
        new TransactionTemplate(manager).executeWithoutResult(status -> {
            service.record(scenario(), Kind.SCENARIO_PUBLISHED);
            service.record(scenario(), Kind.SCENARIO_ARCHIVED);
        });
        var first = service.list(user.getId(), 0, 1);
        var second = service.list(user.getId(), 1, 1);
        assertThat(first.totalElements()).isEqualTo(2);
        assertThat(first.items().getFirst().id()).isNotEqualTo(second.items().getFirst().id());
        service.markRead(user.getId(), List.of(first.items().getFirst().id()));
        assertThat(service.list(user.getId(), 0, 1).unreadCount()).isEqualTo(1);
    }

    private Scenario scenario() { return Scenario.create("Public scenario", "Retail", "Description", 3); }
    private User user() {
        User user = User.create(UUID.randomUUID() + "@example.test", "hash", "Learner", UserRole.LEARNER);
        new TransactionTemplate(manager).executeWithoutResult(status -> entities.persist(user));
        return user;
    }
}
