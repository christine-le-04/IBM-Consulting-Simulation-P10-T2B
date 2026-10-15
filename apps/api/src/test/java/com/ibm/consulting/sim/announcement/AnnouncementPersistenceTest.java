package com.ibm.consulting.sim.announcement;

import com.ibm.consulting.sim.announcement.application.AnnouncementService;
import com.ibm.consulting.sim.announcement.application.AdminAnnouncementService;
import com.ibm.consulting.sim.shared.infrastructure.observability.AuditLogger;
import com.ibm.consulting.sim.identity.domain.UserRepository;
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
@Import({AnnouncementService.class, AdminAnnouncementService.class, AnnouncementBroadcaster.class, AuditLogger.class,
        com.ibm.consulting.sim.announcement.application.AdminAnnouncementHistory.class})
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
    @MockBean UserRepository users;
    @Autowired AdminAnnouncementService adminService;
    @Autowired com.ibm.consulting.sim.announcement.application.AdminAnnouncementHistory history;

    @Test void adminHistoryIncludesOtherRoleMessagesAndWithdrawalPreservesHistoryWithoutUnreadCounts() {
        User learner = user();
        UUID id = adminService.publish("Learners only", "Private notice", java.util.Set.of(UserRole.LEARNER));
        assertThat(history.list(0, 20).items().getFirst().targetRoles()).containsExactly("LEARNER");
        assertThat(history.list(0, 20).items().getFirst().createdAt()).isNotNull();
        assertThat(service.list(learner.getId(), 0, 20).unreadCount()).isEqualTo(1);
        history.withdraw(id);
        history.withdraw(id);
        assertThat(service.list(learner.getId(), 0, 20).items()).isEmpty();
        assertThat(service.list(learner.getId(), 0, 20).unreadCount()).isZero();
        service.markRead(learner.getId(), List.of(id));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM announcement_reads", Long.class)).isZero();
        assertThat(history.list(0, 20).items().getFirst().status()).isEqualTo("WITHDRAWN");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM admin_audit_events WHERE action = 'ADMIN_ANNOUNCEMENT_WITHDRAWN'", Long.class)).isEqualTo(1);
        assertThatThrownBy(() -> history.withdraw(UUID.randomUUID())).isInstanceOf(com.ibm.consulting.sim.shared.domain.NotFoundException.class);
    }

    @BeforeEach void clear() {
        jdbc.update("DELETE FROM announcement_reads");
        jdbc.update("DELETE FROM announcements");
        jdbc.update("DELETE FROM admin_audit_events");
    }

    @Test void customAnnouncementIsSharedAndAuditedAndKeepsPlainText() {
        String message = "First line\n<script>example</script>";
        var id = adminService.publish(" Maintenance ", " " + message + " ");
        var item = service.list(user().getId(), 0, 20).items().getFirst();
        assertThat(item.id()).isEqualTo(id);
        assertThat(item.kind()).isEqualTo(Kind.ADMIN_MESSAGE);
        assertThat(item.title()).isEqualTo("Maintenance");
        assertThat(item.message()).isEqualTo(message);
        assertThat(item.scenarioId()).isNull();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM admin_audit_events WHERE action = 'ADMIN_ANNOUNCEMENT_PUBLISHED' AND target_id = ?",
                Long.class, id.toString())).isEqualTo(1);
        assertThat(service.list(user().getId(), 0, 20).unreadCount()).isEqualTo(1);
    }

    @Test void customAnnouncementAndAuditRollBackTogether() {
        new TransactionTemplate(manager).executeWithoutResult(status -> {
            adminService.publish("Maintenance", "Restart tonight.");
            status.setRollbackOnly();
        });
        assertThat(service.list(UUID.randomUUID(), 0, 20).items()).isEmpty();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM admin_audit_events", Long.class)).isZero();
        verifyNoInteractions(messaging);
    }

    @Test void roleAudienceFiltersFeedCountsAndReadReceiptsOnTheServer() {
        User learner = user();
        User reviewer = user();
        jdbc.update("UPDATE users SET role = 'REVIEWER' WHERE id = ?", reviewer.getId());
        UUID publicId = adminService.publish("Everyone", "Public update");
        UUID privateId = adminService.publish("Learners", "Learner update", java.util.Set.of(UserRole.LEARNER));
        assertThat(service.list(learner.getId(), 0, 20).totalElements()).isEqualTo(2);
        var reviewerFeed = service.list(reviewer.getId(), 0, 20);
        assertThat(reviewerFeed.totalElements()).isEqualTo(1);
        assertThat(reviewerFeed.unreadCount()).isEqualTo(1);
        assertThat(reviewerFeed.items()).extracting(AnnouncementService.Item::id).containsExactly(publicId);
        service.markRead(reviewer.getId(), List.of(privateId, publicId));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM announcement_reads WHERE user_id = ? AND announcement_id = ?",
                Long.class, reviewer.getId(), privateId)).isZero();
        assertThat(service.list(reviewer.getId(), 0, 20).unreadCount()).isZero();
        assertThat(service.list(learner.getId(), 0, 20).unreadCount()).isEqualTo(2);
    }

    @Test void changingRolesImmediatelyChangesAnnouncementVisibility() {
        User learner = user();
        UUID learnerNotice = adminService.publish("Learners", "Private", java.util.Set.of(UserRole.LEARNER));
        UUID staffNotice = adminService.publish("Staff", "Private", java.util.Set.of(UserRole.REVIEWER, UserRole.ADMINISTRATOR));
        assertThat(service.list(learner.getId(), 0, 20).items()).extracting(AnnouncementService.Item::id).containsExactly(learnerNotice);
        jdbc.update("UPDATE users SET role = 'REVIEWER' WHERE id = ?", learner.getId());
        assertThat(service.list(learner.getId(), 0, 20).items()).extracting(AnnouncementService.Item::id).containsExactly(staffNotice);
        service.markRead(learner.getId(), List.of(learnerNotice));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM announcement_reads", Long.class)).isZero();
    }

    @Test void targetedPublicationRollsBackItsAudienceAndRejectsAnEmptyRoleSelection() {
        assertThatThrownBy(() -> adminService.publish("Title", "Message", java.util.Set.of()))
                .isInstanceOf(IllegalArgumentException.class);
        new TransactionTemplate(manager).executeWithoutResult(status -> {
            adminService.publish("Learners", "Private", java.util.Set.of(UserRole.LEARNER));
            status.setRollbackOnly();
        });
        assertThat(jdbc.queryForObject("SELECT count(*) FROM announcement_roles", Long.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM announcements", Long.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM admin_audit_events", Long.class)).isZero();
        verifyNoInteractions(messaging);
    }

    @Test void upgradeFromV78PreservesExistingAnnouncementsAndReadReceipts() throws Exception {
        String schema = "announcement_upgrade_" + UUID.randomUUID().toString().replace("-", "");
        try (var connection = jdbc.getDataSource().getConnection(); var statement = connection.createStatement()) {
            statement.execute("CREATE SCHEMA " + schema);
            try {
                connection.setSchema(schema);
                statement.execute("CREATE TABLE users (id uuid PRIMARY KEY)");
                org.springframework.jdbc.datasource.init.ScriptUtils.executeSqlScript(connection,
                        new org.springframework.core.io.ClassPathResource("db/migration/V78__create_announcements.sql"));
                statement.execute("INSERT INTO users VALUES ('00000000-0000-0000-0000-000000000001')");
                statement.execute("INSERT INTO announcements (id, scenario_id, kind, scenario_title) VALUES "
                        + "('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'SCENARIO_PUBLISHED', 'Original title')");
                statement.execute("INSERT INTO announcement_reads VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002')");
                org.springframework.jdbc.datasource.init.ScriptUtils.executeSqlScript(connection,
                        new org.springframework.core.io.ClassPathResource("db/migration/V79__support_admin_announcements.sql"));
                try (var rows = statement.executeQuery("SELECT a.scenario_title FROM announcements a JOIN announcement_reads r ON r.announcement_id = a.id")) {
                    assertThat(rows.next()).isTrue();
                    assertThat(rows.getString(1)).isEqualTo("Original title");
                }
                // Existing scenario writers remain compatible after the new migration.
                statement.execute("INSERT INTO announcements (id, scenario_id, kind, scenario_title) VALUES "
                        + "(gen_random_uuid(), gen_random_uuid(), 'SCENARIO_ARCHIVED', 'Another scenario')");
                statement.execute("INSERT INTO announcements (id, kind, title, message) VALUES "
                        + "(gen_random_uuid(), 'ADMIN_MESSAGE', 'New notice', 'Published after upgrade')");
            } finally {
                connection.setSchema("public");
                statement.execute("DROP SCHEMA " + schema + " CASCADE");
            }
        }
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
