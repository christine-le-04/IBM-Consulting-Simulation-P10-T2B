package com.ibm.consulting.sim.admin.application;

import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.identity.domain.UserRole;
import com.ibm.consulting.sim.shared.infrastructure.observability.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
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
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@DataJpaTest
@Import({AuditLogger.class, AdminAuditService.class, AdminAuditRetention.class})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class AdminAuditPersistenceTest {
    @Container static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
            DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }
    @Autowired AdminAuditEventRepository repository;
    @Autowired AuditLogger logger;
    @Autowired AdminAuditService service;
    @Autowired PlatformTransactionManager manager;
    @Autowired EntityManager entityManager;
    @Autowired JdbcTemplate jdbc;
    @org.springframework.boot.test.mock.mockito.MockBean com.ibm.consulting.sim.identity.domain.UserRepository users;
    @BeforeEach void clearEvents() { repository.deleteAllInBatch(); }
    @AfterEach void clearIdentity() { SecurityContextHolder.clearContext(); }

    @Test void auditRecordRollsBackWithItsAdministrativeChange() {
        new TransactionTemplate(manager).executeWithoutResult(status -> {
            logger.recordAdmin(AuditAction.ADMIN_USER_CREATED, "USER", UUID.randomUUID().toString());
            status.setRollbackOnly();
        });
        assertThat(repository.count()).isZero();
        logger.recordAdmin(AuditAction.ADMIN_USER_CREATED, "USER", UUID.randomUUID().toString());
        assertThat(repository.count()).isEqualTo(1);
    }

    @Test void actorSnapshotSurvivesAccountDeletion() {
        User actor = User.create(UUID.randomUUID() + "@example.com", "private-hash", "Original Administrator", UserRole.ADMINISTRATOR);
        new TransactionTemplate(manager).executeWithoutResult(status -> entityManager.persist(actor));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(actor, null));
        logger.recordAdmin(AuditAction.ADMIN_USER_DELETED, "USER", UUID.randomUUID().toString(), "deleted@example.com");
        new TransactionTemplate(manager).executeWithoutResult(status -> entityManager.remove(entityManager.find(User.class, actor.getId())));
        var item = service.list(null, null, null, null, null, 0, 25).items().getFirst();
        assertThat(item.actorId()).isEqualTo(actor.getId());
        assertThat(item.actorDisplayName()).isEqualTo("Original Administrator");
        assertThat(item.actorEmail()).isEqualTo(actor.getEmail());
        assertThat(item.details()).isEqualTo("deleted@example.com");
    }

    @Test void filtersEscapeWildcardsAndUseInclusiveUtcDateBounds() {
        logger.recordAdmin(AuditAction.ADMIN_USER_CREATED, "USER", "one", "100% complete");
        logger.recordAdmin(AuditAction.ADMIN_USER_CREATED, "USER", "two", "100X complete");
        logger.recordAdmin(AuditAction.ADMIN_SCENARIO_ARCHIVED, "SCENARIO", "three", "100% complete");
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        var filtered = service.list("100%", AuditAction.ADMIN_USER_CREATED, "USER", today, today, 0, 25);
        assertThat(filtered.totalElements()).isEqualTo(1);
        assertThat(filtered.items().getFirst().targetId()).isEqualTo("one");
        jdbc.update("UPDATE admin_audit_events SET occurred_at = ? WHERE target_id = ?",
                java.sql.Timestamp.from(today.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant()), "two");
        assertThat(service.list(null, AuditAction.ADMIN_USER_CREATED, "USER", today, today, 0, 25).totalElements()).isEqualTo(1);
        assertThat(service.list(null, null, null, null, null, 0, 1).items()).hasSize(1);
        assertThatThrownBy(() -> service.list(null, null, null, today.plusDays(1), today, 0, 25))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test void deletedUserTargetKeepsItsNameAndEmail() {
        User target = User.create(UUID.randomUUID() + "@example.com", "private-hash", "Target Account", UserRole.LEARNER);
        new TransactionTemplate(manager).executeWithoutResult(status -> entityManager.persist(target));
        org.mockito.Mockito.when(users.findById(target.getId())).thenAnswer(ignored ->
                java.util.Optional.ofNullable(entityManager.find(User.class, target.getId())));
        new TransactionTemplate(manager).executeWithoutResult(status -> {
            logger.recordAdmin(AuditAction.ADMIN_USER_DELETED, "USER", target.getId().toString(), target.getEmail());
            entityManager.remove(entityManager.find(User.class, target.getId()));
        });
        var page = service.list("Target Account", null, null, null, null, 0, 25);
        assertThat(page.totalElements()).isEqualTo(1);
        assertThat(page.items().getFirst().targetDisplayName()).isEqualTo("Target Account");
        assertThat(page.items().getFirst().targetEmail()).isEqualTo(target.getEmail());
        assertThat(page.items().getFirst().targetRole()).isEqualTo("LEARNER");
    }

    @Test void hidesExpiredEventsAndDeletesOnlyThoseBeforeTheCutoff() {
        java.time.Instant now = java.time.Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        var policy = new AdminAuditRetention(repository, 90, java.time.Clock.fixed(now, ZoneOffset.UTC));
        var limited = new AdminAuditService(repository, policy);
        logger.recordAdmin(AuditAction.ADMIN_USER_CREATED, "USER", "expired");
        logger.recordAdmin(AuditAction.ADMIN_USER_CREATED, "USER", "boundary");
        logger.recordAdmin(AuditAction.ADMIN_USER_CREATED, "USER", "recent");
        jdbc.update("UPDATE admin_audit_events SET occurred_at = ? WHERE target_id = 'expired'",
                java.sql.Timestamp.from(policy.cutoff().minusSeconds(1)));
        jdbc.update("UPDATE admin_audit_events SET occurred_at = ? WHERE target_id = 'boundary'",
                java.sql.Timestamp.from(policy.cutoff()));
        assertThat(limited.list(null, null, null, null, null, 0, 25).items())
                .extracting(AdminAuditService.AuditItem::targetId).containsExactlyInAnyOrder("boundary", "recent");
        Integer removed = new TransactionTemplate(manager).execute(status -> policy.purgeExpired());
        assertThat(removed).isEqualTo(1);
        assertThat(repository.count()).isEqualTo(2);
    }

    @Test void cleanupLimitsEachBatchToOneThousandAndDrainsTheBacklogWithoutDeletingCurrentEvents() {
        java.time.Instant now = java.time.Instant.parse("2026-10-16T12:00:00Z");
        var policy = new AdminAuditRetention(repository, 90, java.time.Clock.fixed(now, ZoneOffset.UTC));
        jdbc.update("""
                INSERT INTO admin_audit_events (id, occurred_at, action, target_type, target_id)
                SELECT gen_random_uuid(), CAST(? AS timestamptz) - n * INTERVAL '1 microsecond',
                    'ADMIN_USER_CREATED', 'USER', 'expired-' || n
                FROM generate_series(1, 2505) AS n
                """, java.sql.Timestamp.from(policy.cutoff()));
        for (String target : new String[]{"boundary", "recent", "future"}) {
            logger.recordAdmin(AuditAction.ADMIN_USER_CREATED, "USER", target);
        }
        jdbc.update("UPDATE admin_audit_events SET occurred_at = ? WHERE target_id = 'boundary'", java.sql.Timestamp.from(policy.cutoff()));
        jdbc.update("UPDATE admin_audit_events SET occurred_at = ? WHERE target_id = 'recent'", java.sql.Timestamp.from(now));
        jdbc.update("UPDATE admin_audit_events SET occurred_at = ? WHERE target_id = 'future'", java.sql.Timestamp.from(now.plusSeconds(86400)));

        long remaining = 2505;
        for (int expected : new int[]{1000, 1000, 505, 0}) {
            Integer removed = new TransactionTemplate(manager).execute(status -> policy.purgeExpired());
            assertThat(removed).isEqualTo(expected);
            remaining -= expected;
            assertThat(jdbc.queryForObject("SELECT count(*) FROM admin_audit_events WHERE occurred_at < ?",
                    Long.class, java.sql.Timestamp.from(policy.cutoff()))).isEqualTo(remaining);
            assertThat(repository.count()).isEqualTo(remaining + 3);
            assertThat(jdbc.queryForList("SELECT target_id FROM admin_audit_events WHERE occurred_at >= ?", String.class,
                    java.sql.Timestamp.from(policy.cutoff()))).containsExactlyInAnyOrder("boundary", "recent", "future");
        }
    }
}
