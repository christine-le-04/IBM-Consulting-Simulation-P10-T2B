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
@Import({AuditLogger.class, AdminAuditService.class})
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
}
