package com.ibm.consulting.sim.scenario.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ibm.consulting.sim.announcement.application.AnnouncementService;
import com.ibm.consulting.sim.announcement.infrastructure.AnnouncementBroadcaster;
import com.ibm.consulting.sim.engagement.domain.EngagementRepository;
import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.identity.domain.UserRepository;
import com.ibm.consulting.sim.identity.domain.UserRole;
import com.ibm.consulting.sim.knowledge.application.KnowledgeIngestionService;
import com.ibm.consulting.sim.lead.domain.LeadRepository;
import com.ibm.consulting.sim.scenario.application.DifficultyProfileService;
import com.ibm.consulting.sim.scenario.application.ScenarioAuthoringConfigService;
import com.ibm.consulting.sim.scenario.application.ScenarioService;
import com.ibm.consulting.sim.scenario.domain.Scenario;
import com.ibm.consulting.sim.scenario.domain.ScenarioRepository;
import com.ibm.consulting.sim.shared.infrastructure.observability.AuditLogger;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
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
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@DataJpaTest
@Import({JpaScenarioRepository.class, AnnouncementService.class, AnnouncementBroadcaster.class,
        AuditLogger.class, AnnouncementConcurrencyIntegrationTest.Services.class})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class AnnouncementConcurrencyIntegrationTest {
    @Container
    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
            DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class Services {
        @Bean
        ScenarioService scenarios(ScenarioRepository repository, AnnouncementService announcements, AuditLogger audit) {
            var mapper = new ObjectMapper();
            var leads = mock(LeadRepository.class);
            return new ScenarioService(repository, new DifficultyProfileService(mapper, repository, leads),
                    new ScenarioAuthoringConfigService(mapper), leads, mock(KnowledgeIngestionService.class),
                    audit, mock(EngagementRepository.class), announcements);
        }
    }

    @Autowired ScenarioService scenarios;
    @Autowired AnnouncementService announcements;
    @Autowired JdbcTemplate jdbc;
    @Autowired EntityManager entities;
    @Autowired PlatformTransactionManager transactions;
    @MockBean UserRepository users;
    @MockBean SimpMessagingTemplate messaging;
    private UUID scenarioId;
    private UUID readerId;
    private UUID otherReaderId;

    @BeforeEach
    void prepare() {
        jdbc.update("DELETE FROM announcements");
        jdbc.update("DELETE FROM admin_audit_events");
        var scenario = Scenario.create("Concurrency scenario", "Retail", "Description", 3);
        scenario.publish();
        var reader = User.create(UUID.randomUUID() + "@example.test", "hash", "Reader", UserRole.LEARNER);
        var otherReader = User.create(UUID.randomUUID() + "@example.test", "hash", "Other reader", UserRole.LEARNER);
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            entities.persist(scenario);
            entities.persist(reader);
            entities.persist(otherReader);
        });
        scenarioId = scenario.getId();
        readerId = reader.getId();
        otherReaderId = otherReader.getId();
    }

    @Test
    void simultaneousArchivesPersistExactlyOneAnnouncement() throws Exception {
        contendOn("SELECT id FROM scenarios WHERE id = ? FOR UPDATE", scenarioId, () -> {
            scenarios.archive(scenarioId);
            return null;
        });

        assertThat(jdbc.queryForObject("SELECT status FROM scenarios WHERE id = ?", String.class, scenarioId)).isEqualTo("ARCHIVED");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM announcements WHERE scenario_id = ? AND kind = 'SCENARIO_ARCHIVED'",
                Long.class, scenarioId)).isEqualTo(1);
        var feed = announcements.list(readerId, 0, 20);
        assertThat(feed.items()).hasSize(1);
        assertThat(feed.items().getFirst().kind()).isEqualTo(AnnouncementService.Kind.SCENARIO_ARCHIVED);
        assertThat(feed.unreadCount()).isEqualTo(1);
        verify(messaging, times(1)).convertAndSend(eq("/topic/announcements"), any(AnnouncementService.Created.class));
    }

    @Test
    void simultaneousReadRequestsPersistOneReceiptAndKeepOtherAccountsUnread() throws Exception {
        scenarios.archive(scenarioId);
        UUID id = announcements.list(readerId, 0, 20).items().getFirst().id();
        // Holding the reader row blocks both FK checks before either request can commit a receipt.
        contendOn("SELECT id FROM users WHERE id = ? FOR UPDATE", readerId, () -> {
            announcements.markRead(readerId, List.of(id, id));
            return null;
        });

        assertThat(jdbc.queryForObject("SELECT count(*) FROM announcement_reads WHERE user_id = ? AND announcement_id = ?",
                Long.class, readerId, id)).isEqualTo(1);
        assertThat(announcements.list(readerId, 0, 20).unreadCount()).isZero();
        assertThat(announcements.list(otherReaderId, 0, 20).unreadCount()).isEqualTo(1);
        announcements.markRead(readerId, List.of(id));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM announcement_reads", Long.class)).isEqualTo(1);
    }

    @Test
    void scenarioPersistenceFailureRollsBackArchiveAnnouncementAndAuditThenAllowsRetry() {
        // Fail the scenario UPDATE at flush, after the real operation has inserted its announcement.
        jdbc.execute("ALTER TABLE scenarios ADD CONSTRAINT test_reject_archive CHECK (id <> '" + scenarioId + "'::uuid OR status <> 'ARCHIVED')");
        try {
            assertThatThrownBy(() -> new TransactionTemplate(transactions).executeWithoutResult(status -> {
                scenarios.archive(scenarioId);
                assertThat(jdbc.queryForObject("SELECT count(*) FROM announcements WHERE scenario_id = ?", Long.class, scenarioId)).isEqualTo(1);
                verifyNoInteractions(messaging);
                entities.flush();
            })).isInstanceOf(org.hibernate.exception.ConstraintViolationException.class)
                    .satisfies(error -> assertThat(((org.hibernate.exception.ConstraintViolationException) error).getConstraintName())
                            .isEqualTo("test_reject_archive"));
            assertThat(jdbc.queryForObject("SELECT status FROM scenarios WHERE id = ?", String.class, scenarioId)).isEqualTo("ACTIVE");
            assertThat(jdbc.queryForObject("SELECT count(*) FROM announcements", Long.class)).isZero();
            assertThat(jdbc.queryForObject("SELECT count(*) FROM admin_audit_events", Long.class)).isZero();
            verifyNoInteractions(messaging);
        } finally {
            jdbc.execute("ALTER TABLE scenarios DROP CONSTRAINT test_reject_archive");
        }

        scenarios.archive(scenarioId);
        assertThat(announcements.list(readerId, 0, 20).items()).hasSize(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM admin_audit_events WHERE action = 'ADMIN_SCENARIO_ARCHIVED'", Long.class)).isEqualTo(1);
        verify(messaging, times(1)).convertAndSend(eq("/topic/announcements"), any(AnnouncementService.Created.class));
    }

    private void contendOn(String lockSql, UUID id, Callable<Void> operation) throws Exception {
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(2);
        try {
            Callable<Void> request = () -> {
                ready.countDown();
                if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Request start timed out");
                return operation.call();
            };
            var first = executor.submit(request);
            var second = executor.submit(request);
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            new TransactionTemplate(transactions).executeWithoutResult(status -> {
                jdbc.queryForObject(lockSql, UUID.class, id);
                start.countDown();
                awaitBlockedRequests();
            });
            first.get(20, TimeUnit.SECONDS);
            second.get(20, TimeUnit.SECONDS);
        } finally {
            start.countDown();
            executor.shutdownNow();
            assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
        }
    }

    private void awaitBlockedRequests() {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
        do {
            long waiting = jdbc.queryForObject("""
                    SELECT count(*) FROM pg_stat_activity
                    WHERE datname = current_database() AND pid <> pg_backend_pid() AND wait_event_type = 'Lock'
                    """, Long.class);
            if (waiting >= 2) return;
            // PostgreSQL caches activity snapshots inside a transaction; refresh before checking again.
            jdbc.execute("SELECT pg_stat_clear_snapshot()");
            try { Thread.sleep(25); }
            catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Interrupted waiting for database contention", exception);
            }
        } while (System.nanoTime() < deadline);
        throw new AssertionError("Both requests must be waiting on PostgreSQL locks before the blocker is released");
    }
}
