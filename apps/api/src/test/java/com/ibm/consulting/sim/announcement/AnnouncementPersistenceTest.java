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
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import com.ibm.consulting.sim.shared.infrastructure.observability.AdminAuditEventRepository;
import com.ibm.consulting.sim.shared.infrastructure.observability.AuditAction;
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
        com.ibm.consulting.sim.announcement.application.AdminAnnouncementHistory.class, com.ibm.consulting.sim.announcement.application.AnnouncementSchedule.class})
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
    @Autowired com.ibm.consulting.sim.announcement.application.AnnouncementSchedule schedule;
    @Autowired AdminAuditEventRepository audits;

    enum Audience { ALL, LEARNERS, MULTIPLE_ROLES }

    @AfterEach void clearIdentity() { SecurityContextHolder.clearContext(); }

    @ParameterizedTest
    @EnumSource(Audience.class)
    void scheduledPublicationPersistsActorAudienceAndExactlyOneAuditAcrossRetries(Audience audience) {
        User actor = signInAdministrator();
        var roles = switch (audience) {
            case ALL -> (java.util.Set<UserRole>) null;
            case LEARNERS -> java.util.Set.of(UserRole.LEARNER);
            case MULTIPLE_ROLES -> java.util.Set.of(UserRole.REVIEWER, UserRole.LEARNER);
        };
        var publishAt = java.time.Instant.now().plusSeconds(3600);
        var expiresAt = publishAt.plusSeconds(3600);
        UUID request = UUID.randomUUID();
        UUID id = adminService.publishOnce(actor.getId(), request, " Scheduled update ", " Message ", roles, publishAt, expiresAt);
        assertThat(adminService.publishOnce(actor.getId(), request, "Scheduled update", "Message", roles, publishAt, expiresAt)).isEqualTo(id);
        var entry = history.list(0, 20).items().getFirst();
        assertThat(entry.id()).isEqualTo(id);
        assertThat(entry.status()).isEqualTo("SCHEDULED");
        assertThat(entry.title()).isEqualTo("Scheduled update");
        assertThat(entry.message()).isEqualTo("Message");
        assertThat(entry.publishAt()).isCloseTo(publishAt, within(1, java.time.temporal.ChronoUnit.MILLIS));
        assertThat(entry.expiresAt()).isCloseTo(expiresAt, within(1, java.time.temporal.ChronoUnit.MILLIS));
        assertThat(entry.audience()).isEqualTo(roles == null ? "ALL" : "ROLES");
        assertThat(entry.targetRoles()).containsExactlyElementsOf(roles == null ? List.of() : roles.stream().map(Enum::name).sorted().toList());
        String details = roles == null ? "Scheduled update" : "Scheduled update; roles: " + roles.stream().map(Enum::name).sorted().toList();
        assertAudit(AuditAction.ADMIN_ANNOUNCEMENT_SCHEDULED, actor, id, details);
        verifyNoInteractions(messaging);

        jdbc.update("UPDATE announcements SET publish_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE id = ?", id);
        schedule.notifyTransitions();
        schedule.notifyTransitions();
        assertThat(history.list(0, 20).items().getFirst().status()).isEqualTo("PUBLISHED");
        // Automatic delivery preserves the original administrator's scheduling audit.
        assertAudit(AuditAction.ADMIN_ANNOUNCEMENT_SCHEDULED, actor, id, details);
        verify(messaging, times(1)).convertAndSend(eq("/topic/announcements"), any(AnnouncementService.Created.class));
    }

    @Test void rolledBackScheduleRemovesAuditAudienceAndRetryClaim() {
        User actor = signInAdministrator();
        UUID request = UUID.randomUUID();
        var publishAt = java.time.Instant.now().plusSeconds(3600);
        new TransactionTemplate(manager).executeWithoutResult(status -> {
            adminService.publishOnce(actor.getId(), request, "Later", "Message", java.util.Set.of(UserRole.LEARNER), publishAt, null);
            entities.flush();
            assertThat(audits.count()).isEqualTo(1);
            status.setRollbackOnly();
        });
        assertThat(audits.count()).isZero();
        assertThat(history.list(0, 20).items()).isEmpty();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM announcement_roles", Long.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM announcement_publish_requests WHERE actor_id = ? AND request_id = ?", Long.class, actor.getId(), request)).isZero();
        UUID id = adminService.publishOnce(actor.getId(), request, "Later", "Message", java.util.Set.of(UserRole.LEARNER), publishAt, null);
        assertAudit(AuditAction.ADMIN_ANNOUNCEMENT_SCHEDULED, actor, id, "Later; roles: [LEARNER]");
        verifyNoInteractions(messaging);
    }

    @Test void withdrawalAuditRollsBackAndRetryRecordsAdministratorExactlyOnce() {
        User actor = signInAdministrator();
        UUID id = adminService.publish("Cancelled update", "Message", null, java.time.Instant.now().plusSeconds(3600), null);
        audits.deleteAllInBatch();
        new TransactionTemplate(manager).executeWithoutResult(status -> {
            history.withdraw(id);
            entities.flush();
            assertThat(audits.count()).isEqualTo(1);
            status.setRollbackOnly();
        });
        assertThat(audits.count()).isZero();
        assertThat(history.list(0, 20).items().getFirst().status()).isEqualTo("SCHEDULED");
        verifyNoInteractions(messaging);
        history.withdraw(id);
        history.withdraw(id);
        assertThat(history.list(0, 20).items().getFirst().status()).isEqualTo("WITHDRAWN");
        assertAudit(AuditAction.ADMIN_ANNOUNCEMENT_WITHDRAWN, actor, id, "Cancelled update");
        verify(messaging, times(1)).convertAndSend(eq("/topic/announcements"), any(AnnouncementService.Created.class));
    }

    @Test void invalidScheduleLeavesNoAuditAnnouncementOrRetryClaim() {
        User actor = signInAdministrator();
        UUID request = UUID.randomUUID();
        var publishAt = java.time.Instant.now().plusSeconds(3600);
        assertThatThrownBy(() -> adminService.publishOnce(actor.getId(), request, "Invalid", "Message", null, publishAt, publishAt.minusSeconds(1)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(audits.count()).isZero();
        assertThat(history.list(0, 20).items()).isEmpty();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM announcement_publish_requests WHERE actor_id = ? AND request_id = ?", Long.class, actor.getId(), request)).isZero();
        verifyNoInteractions(messaging);
    }

    private User signInAdministrator() {
        User actor = User.create(UUID.randomUUID() + "@example.test", "hash", "Announcement administrator", UserRole.ADMINISTRATOR);
        new TransactionTemplate(manager).executeWithoutResult(status -> entities.persist(actor));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(actor, null,
                List.of(new SimpleGrantedAuthority("ROLE_ADMINISTRATOR"))));
        return actor;
    }

    private void assertAudit(AuditAction action, User actor, UUID target, String details) {
        assertThat(audits.findAll()).singleElement().satisfies(event -> {
            assertThat(event.getAction()).isEqualTo(action);
            assertThat(event.getTargetType()).isEqualTo("ANNOUNCEMENT");
            assertThat(event.getTargetId()).isEqualTo(target.toString());
            assertThat(event.getDetails()).isEqualTo(details);
            assertThat(event.getActorId()).isEqualTo(actor.getId());
            assertThat(event.getActorDisplayName()).isEqualTo(actor.getDisplayName());
            assertThat(event.getActorEmail()).isEqualTo(actor.getEmail());
            assertThat(event.getActorRole()).isEqualTo("ADMINISTRATOR");
            assertThat(event.getOccurredAt()).isNotNull();
        });
    }

    @Test void repeatedAndConcurrentPublicationCreatesOnlyOneAnnouncementAndAudit() throws Exception {
        User actor = user();
        UUID key = UUID.randomUUID();
        var executor = java.util.concurrent.Executors.newFixedThreadPool(2);
        try {
            var first = executor.submit(() -> adminService.publishOnce(actor.getId(), key, "Update", "Message", null, null, null));
            var second = executor.submit(() -> adminService.publishOnce(actor.getId(), key, "Update", "Message", null, null, null));
            UUID id = first.get(15, java.util.concurrent.TimeUnit.SECONDS);
            assertThat(second.get(15, java.util.concurrent.TimeUnit.SECONDS)).isEqualTo(id);
            assertThat(adminService.publishOnce(actor.getId(), key, " Update ", " Message ", null, null, null)).isEqualTo(id);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM announcements", Long.class)).isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM admin_audit_events WHERE action = 'ADMIN_ANNOUNCEMENT_PUBLISHED'", Long.class)).isEqualTo(1);
            verify(messaging, times(1)).convertAndSend(eq("/topic/announcements"), any(AnnouncementService.Created.class));
            assertThatThrownBy(() -> adminService.publishOnce(actor.getId(), key, "Changed", "Message", null, null, null))
                    .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("different announcement");
            adminService.publishOnce(user().getId(), key, "Update", "Message", null, null, null);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM announcements", Long.class)).isEqualTo(2);
        } finally { executor.shutdownNow(); }
    }

    @Test void rolledBackPublicationCanRetryAndScheduledRetriesWorkAfterPublicationTime() {
        User actor = user(); UUID key = UUID.randomUUID();
        new TransactionTemplate(manager).executeWithoutResult(status -> {
            adminService.publishOnce(actor.getId(), key, "Retry", "Message", null, null, null);
            status.setRollbackOnly();
        });
        assertThat(jdbc.queryForObject("SELECT count(*) FROM announcement_publish_requests", Long.class)).isZero();
        adminService.publishOnce(actor.getId(), key, "Retry", "Message", null, null, null);
        UUID scheduledKey = UUID.randomUUID();
        java.time.Instant time = java.time.Instant.now().plusSeconds(3600);
        UUID scheduled = adminService.publishOnce(actor.getId(), scheduledKey, "Scheduled", "Message", null, time, null);
        jdbc.update("UPDATE announcements SET publish_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE id = ?", scheduled);
        assertThat(adminService.publishOnce(actor.getId(), scheduledKey, "Scheduled", "Message", null, time, null)).isEqualTo(scheduled);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM announcements", Long.class)).isEqualTo(2);
    }

    @Test void scheduledAndExpiredAnnouncementsStayOutOfFeedsAndTransitionsNotifyOnce() {
        User recipient = user();
        jdbc.update("UPDATE users SET created_at = CURRENT_TIMESTAMP - INTERVAL '2 minutes' WHERE id = ?", recipient.getId());
        java.time.Instant future = java.time.Instant.now().plusSeconds(3600);
        UUID id = adminService.publish("Scheduled", "Later", null, future, future.plusSeconds(3600));
        assertThat(service.list(recipient.getId(), 0, 20).items()).isEmpty();
        service.markRead(recipient.getId(), List.of(id));
        assertThat(history.list(0, 20).items().getFirst().status()).isEqualTo("SCHEDULED");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM announcement_reads", Long.class)).isZero();
        reset(messaging);
        jdbc.update("UPDATE announcements SET publish_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE id = ?", id);
        schedule.notifyTransitions(); schedule.notifyTransitions();
        verify(messaging, times(1)).convertAndSend(eq("/topic/announcements"), any(AnnouncementService.Created.class));
        assertThat(service.list(recipient.getId(), 0, 20).unreadCount()).isEqualTo(1);
        jdbc.update("UPDATE announcements SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE id = ?", id);
        schedule.notifyTransitions(); schedule.notifyTransitions();
        verify(messaging, times(2)).convertAndSend(eq("/topic/announcements"), any(AnnouncementService.Created.class));
        assertThat(service.list(recipient.getId(), 0, 20).unreadCount()).isZero();
        assertThat(history.list(0, 20).items().getFirst().status()).isEqualTo("EXPIRED");
        assertThatThrownBy(() -> adminService.publish("Bad", "Time", null, future, future.minusSeconds(1)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> adminService.publish("Bad", "Past", null, java.time.Instant.EPOCH, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test void withdrawnScheduledAnnouncementDoesNotPublish() {
        UUID id = adminService.publish("Cancelled", "Later", null, java.time.Instant.now().plusSeconds(3600), null);
        history.withdraw(id);
        reset(messaging);
        jdbc.update("UPDATE announcements SET publish_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE id = ?", id);
        schedule.notifyTransitions();
        verifyNoInteractions(messaging);
        assertThat(service.list(user().getId(), 0, 20).items()).isEmpty();
    }

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

    @Test void unreadFilterAndBulkReadRespectIdentityAudienceAndNewArrivals() {
        User learner = user();
        User other = user();
        jdbc.update("UPDATE users SET created_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE id IN (?, ?)",
                learner.getId(), other.getId());
        UUID first = adminService.publish("First", "First message");
        UUID hidden = adminService.publish("Private", "Not for learners", java.util.Set.of(UserRole.ADMINISTRATOR));
        var snapshot = service.list(learner.getId(), 0, 20);
        UUID later = adminService.publish("Later", "New arrival");
        jdbc.update("UPDATE announcements SET publish_at = ? WHERE id = ?",
                java.sql.Timestamp.from(snapshot.readThrough().minusSeconds(20)), first);
        service.markAllRead(learner.getId(), snapshot.readThrough().minusSeconds(10));
        var unread = service.list(learner.getId(), 0, 20, true);
        assertThat(unread.items()).extracting(AnnouncementService.Item::id).containsExactly(later);
        assertThat(unread.totalElements()).isEqualTo(1);
        assertThat(service.list(other.getId(), 0, 20).unreadCount()).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM announcement_reads WHERE announcement_id = ?", Long.class, hidden)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM announcement_reads WHERE announcement_id = ?", Long.class, first)).isEqualTo(1);
    }

    @Test void customAnnouncementIsSharedAndAuditedAndKeepsPlainText() {
        User first = user();
        User second = user();
        String message = "First line\n<script>example</script>";
        var id = adminService.publish(" Maintenance ", " " + message + " ");
        var item = service.list(first.getId(), 0, 20).items().getFirst();
        assertThat(item.id()).isEqualTo(id);
        assertThat(item.kind()).isEqualTo(Kind.ADMIN_MESSAGE);
        assertThat(item.title()).isEqualTo("Maintenance");
        assertThat(item.message()).isEqualTo(message);
        assertThat(item.scenarioId()).isNull();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM admin_audit_events WHERE action = 'ADMIN_ANNOUNCEMENT_PUBLISHED' AND target_id = ?",
                Long.class, id.toString())).isEqualTo(1);
        assertThat(service.list(second.getId(), 0, 20).unreadCount()).isEqualTo(1);
    }

    @ParameterizedTest
    @ValueSource(strings = {"ALL", "ROLES", "USERS"})
    void newAccountsCannotReceiveOrMarkHistoricalAnnouncements(String audience) {
        User existing = user();
        UUID old = adminService.publish("Old notice", "Historical update",
                audience.equals("ROLES") ? java.util.Set.of(UserRole.LEARNER) : null);
        User newcomer = user();
        // Establish ordering explicitly rather than depending on clock resolution or sleeps.
        jdbc.update("UPDATE users SET created_at = CURRENT_TIMESTAMP - INTERVAL '2 minutes' WHERE id = ?", existing.getId());
        jdbc.update("UPDATE announcements SET publish_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE id = ?", old);
        if (audience.equals("USERS")) {
            jdbc.update("UPDATE announcements SET audience = 'USERS' WHERE id = ?", old);
            for (User recipient : List.of(existing, newcomer)) {
                jdbc.update("INSERT INTO announcement_recipients (announcement_id, user_id) VALUES (?, ?)", old, recipient.getId());
            }
        }

        var feed = service.list(newcomer.getId(), 0, 20);
        assertThat(feed.items()).isEmpty();
        assertThat(feed.totalElements()).isZero();
        assertThat(feed.unreadCount()).isZero();
        assertThat(service.list(newcomer.getId(), 0, 20, true).items()).isEmpty();
        service.markRead(newcomer.getId(), List.of(old));
        service.markAllRead(newcomer.getId(), feed.readThrough());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM announcement_reads WHERE user_id = ?", Long.class, newcomer.getId())).isZero();
        assertThat(service.list(existing.getId(), 0, 20).items()).extracting(AnnouncementService.Item::id).containsExactly(old);

        UUID next = adminService.publish("New notice", "Current update");
        assertThat(service.list(newcomer.getId(), 0, 20).items()).extracting(AnnouncementService.Item::id).containsExactly(next);
        assertThat(service.list(newcomer.getId(), 0, 20).unreadCount()).isEqualTo(1);
        assertThat(history.list(0, 20).items()).extracting(entry -> entry.id()).contains(old, next);
    }

    @ParameterizedTest
    @EnumSource(value = Kind.class, names = {"SCENARIO_PUBLISHED", "SCENARIO_ARCHIVED"})
    void newAccountsDoNotInheritScenarioAnnouncements(Kind kind) {
        User existing = user();
        new TransactionTemplate(manager).executeWithoutResult(status -> service.record(scenario(), kind));
        User newcomer = user();
        assertThat(service.list(existing.getId(), 0, 20).unreadCount()).isEqualTo(1);
        assertThat(service.list(newcomer.getId(), 0, 20).items()).isEmpty();
        assertThat(service.list(newcomer.getId(), 0, 20).unreadCount()).isZero();
    }

    @Test void accountsCreatedAfterSchedulingButBeforePublicationReceiveTheAnnouncement() {
        UUID id = adminService.publish("Scheduled notice", "Upcoming update", null,
                java.time.Instant.now().plusSeconds(3600), null);
        User recipient = user();
        jdbc.update("UPDATE announcements SET created_at = CURRENT_TIMESTAMP - INTERVAL '3 minutes', "
                + "publish_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE id = ?", id);
        jdbc.update("UPDATE users SET created_at = CURRENT_TIMESTAMP - INTERVAL '2 minutes' WHERE id = ?", recipient.getId());
        schedule.notifyTransitions();
        assertThat(service.list(recipient.getId(), 0, 20).items()).extracting(AnnouncementService.Item::id).containsExactly(id);
        assertThat(service.list(recipient.getId(), 0, 20).unreadCount()).isEqualTo(1);
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
        service.markUnread(first.getId(), List.of(id));
        assertThat(service.list(first.getId(), 0, 20).unreadCount()).isEqualTo(1);
        assertThat(service.list(second.getId(), 0, 20).unreadCount()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM announcement_reads", Long.class)).isZero();
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
