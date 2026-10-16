package com.ibm.consulting.sim.scenario.infrastructure;

import com.ibm.consulting.sim.announcement.application.AnnouncementService;
import com.ibm.consulting.sim.announcement.application.AssignmentAnnouncementService;
import com.ibm.consulting.sim.announcement.infrastructure.AnnouncementBroadcaster;
import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.identity.domain.UserRepository;
import com.ibm.consulting.sim.identity.domain.UserRole;
import com.ibm.consulting.sim.scenario.application.ScenarioAssignmentService;
import com.ibm.consulting.sim.scenario.domain.Scenario;
import com.ibm.consulting.sim.shared.infrastructure.observability.AuditLogger;
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
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

@DataJpaTest
@Import({JpaScenarioRepository.class, JpaScenarioAssignmentRepository.class, ScenarioAssignmentService.class,
        AssignmentAnnouncementService.class, AnnouncementService.class, AnnouncementBroadcaster.class, AuditLogger.class})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class AssignmentAnnouncementIntegrationTest {
    @Container static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
            DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }
    @Autowired ScenarioAssignmentService assignments;
    @Autowired AnnouncementService feed;
    @Autowired EntityManager entities;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactions;
    @MockBean UserRepository users;
    @MockBean SimpMessagingTemplate messaging;
    private User assignee;
    private User outsider;
    private User admin;
    private Scenario scenario;

    @BeforeEach void prepare() {
        jdbc.update("DELETE FROM scenario_assignments");
        jdbc.update("DELETE FROM announcements");
        jdbc.update("DELETE FROM admin_audit_events");
        assignee = User.create(UUID.randomUUID() + "@example.test", "hash", "Assignee", UserRole.LEARNER);
        outsider = User.create(UUID.randomUUID() + "@example.test", "hash", "Other learner", UserRole.LEARNER);
        admin = User.create(UUID.randomUUID() + "@example.test", "hash", "Administrator", UserRole.ADMINISTRATOR);
        scenario = Scenario.create("Assigned scenario", "Retail", "Description", 3);
        scenario.publish();
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            entities.persist(assignee); entities.persist(outsider); entities.persist(admin); entities.persist(scenario);
        });
        when(users.findById(any(UUID.class))).thenAnswer(call -> Optional.ofNullable(entities.find(User.class, call.getArgument(0))));
    }

    @Test void newlyAssignedUserSeesAPrivateNotificationAndUnchangedAssignmentsDoNotNotifyAgain() {
        assignments.replaceAssignments(scenario.getId(), List.of(assignee.getId()), admin.getId());
        var notice = feed.list(assignee.getId(), 0, 20).items().getFirst();
        assertThat(notice.kind()).isEqualTo(AnnouncementService.Kind.SCENARIO_ASSIGNED);
        assertThat(notice.scenarioId()).isEqualTo(scenario.getId());
        assertThat(notice.message()).contains(scenario.getTitle());
        assertThat(feed.list(outsider.getId(), 0, 20).totalElements()).isZero();
        assertThat(feed.list(admin.getId(), 0, 20).unreadCount()).isZero();
        feed.markRead(outsider.getId(), List.of(notice.id()));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM announcement_reads", Long.class)).isZero();
        assignments.replaceAssignments(scenario.getId(), List.of(assignee.getId(), assignee.getId()), admin.getId());
        assertThat(feed.list(assignee.getId(), 0, 20).totalElements()).isEqualTo(1);
        feed.markRead(assignee.getId(), List.of(notice.id()));
        assertThat(feed.list(assignee.getId(), 0, 20).unreadCount()).isZero();
        verify(messaging).convertAndSend(eq("/topic/announcements"), any(AnnouncementService.Created.class));
    }

    @Test void removingUsersDoesNotNotifyAndReassigningThemDoes() {
        assignments.replaceAssignments(scenario.getId(), List.of(assignee.getId()), admin.getId());
        assignments.replaceAssignments(scenario.getId(), List.of(), admin.getId());
        assertThat(feed.list(assignee.getId(), 0, 20).totalElements()).isEqualTo(1);
        assignments.replaceAssignments(scenario.getId(), List.of(assignee.getId(), outsider.getId()), admin.getId());
        assertThat(feed.list(assignee.getId(), 0, 20).totalElements()).isEqualTo(2);
        assertThat(feed.list(outsider.getId(), 0, 20).totalElements()).isEqualTo(1);
    }

    @Test void rolledBackAssignmentLeavesNoAssignmentNotificationRecipientOrAudit() {
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            assignments.replaceAssignments(scenario.getId(), List.of(assignee.getId()), admin.getId());
            verifyNoInteractions(messaging);
            status.setRollbackOnly();
        });
        for (String table : List.of("scenario_assignments", "announcements", "announcement_recipients", "admin_audit_events")) {
            assertThat(jdbc.queryForObject("SELECT count(*) FROM " + table, Long.class)).isZero();
        }
        verifyNoInteractions(messaging);
    }

    @Test void concurrentAssignmentSavesCreateOneNotification() throws Exception {
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            java.util.concurrent.Callable<Void> request = () -> {
                ready.countDown();
                if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Start timed out");
                assignments.replaceAssignments(scenario.getId(), List.of(assignee.getId()), admin.getId());
                return null;
            };
            var first = executor.submit(request);
            var second = executor.submit(request);
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            first.get(20, TimeUnit.SECONDS);
            second.get(20, TimeUnit.SECONDS);
        }
        assertThat(feed.list(assignee.getId(), 0, 20).totalElements()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM scenario_assignments", Long.class)).isEqualTo(1);
    }
}
