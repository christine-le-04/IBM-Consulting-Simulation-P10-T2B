package com.ibm.consulting.sim.achievement.application;

import com.ibm.consulting.sim.achievement.domain.Achievement;
import com.ibm.consulting.sim.achievement.domain.AchievementRepository;
import com.ibm.consulting.sim.achievement.domain.ConditionType;
import com.ibm.consulting.sim.achievement.infrastructure.AchievementRuleCodec;
import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.identity.domain.UserRole;
import com.ibm.consulting.sim.shared.domain.NotFoundException;
import com.ibm.consulting.sim.shared.infrastructure.observability.AdminAuditEventRepository;
import com.ibm.consulting.sim.shared.infrastructure.observability.AuditAction;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "app.jwt.secret=achievement-audit-test-only-secret-at-least-sixty-four-bytes-long-1234567890",
        "app.ai.mock-mode=true", "app.watsonx.mock-mode=true", "app.cos.mock-mode=true",
        "app.cache.provider=caffeine", "app.admin.seed.email=", "app.admin.seed.password="
})
@ActiveProfiles("test")
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class AchievementAuditIntegrationTest {
    @Container
    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
            DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.flyway.url", postgres::getJdbcUrl);
        registry.add("spring.flyway.user", postgres::getUsername);
        registry.add("spring.flyway.password", postgres::getPassword);
    }

    @Autowired AdminAchievementService service;
    @Autowired AchievementRepository achievements;
    @Autowired AchievementRuleCodec codec;
    @Autowired AdminAuditEventRepository audits;
    @Autowired EntityManager entities;
    @Autowired PlatformTransactionManager transactions;
    private User actor;
    private UUID achievementId;

    enum Operation {
        CREATE(AuditAction.ADMIN_ACHIEVEMENT_CREATED),
        UPDATE(AuditAction.ADMIN_ACHIEVEMENT_UPDATED),
        DEACTIVATE(AuditAction.ADMIN_ACHIEVEMENT_DEACTIVATED),
        REACTIVATE(AuditAction.ADMIN_ACHIEVEMENT_REACTIVATED);

        final AuditAction action;
        Operation(AuditAction action) { this.action = action; }
    }

    @BeforeEach
    void prepare() {
        audits.deleteAllInBatch();
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            actor = User.create(UUID.randomUUID() + "@example.test", "fixture-hash", "Achievement administrator", UserRole.ADMINISTRATOR);
            entities.persist(actor);
            Achievement achievement = Achievement.create("Original achievement", "Original description", "trophy", codec.encode(rule(2)));
            entities.persist(achievement);
            achievementId = achievement.getId();
        });
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(actor, null,
                List.of(new SimpleGrantedAuthority("ROLE_ADMINISTRATOR"))));
    }

    @AfterEach void clearIdentity() { SecurityContextHolder.clearContext(); }

    @ParameterizedTest
    @EnumSource(Operation.class)
    void actualOperationPersistsMatchingAuditRecord(Operation operation) {
        prepareInactiveFixture(operation);
        UUID target = perform(operation);
        Achievement persisted = achievements.findById(target).orElseThrow();
        assertThat(persisted.isActive()).isEqualTo(operation != Operation.DEACTIVATE);
        if (operation == Operation.CREATE || operation == Operation.UPDATE) {
            assertThat(persisted.getName()).isEqualTo("Changed achievement");
            assertThat(persisted.getDescription()).isEqualTo("Changed description");
            assertThat(persisted.getIconKey()).isEqualTo("star");
            assertThat(codec.decode(persisted.getRuleJson())).isEqualTo(rule(3));
            assertThat(persisted.getScenarioLineageId()).isNull();
        }
        assertThat(audits.findAll()).singleElement().satisfies(event -> {
            assertThat(event.getAction()).isEqualTo(operation.action);
            assertThat(event.getTargetType()).isEqualTo("ACHIEVEMENT");
            assertThat(event.getTargetId()).isEqualTo(target.toString());
            assertThat(event.getDetails()).isNull();
            assertThat(event.getActorId()).isEqualTo(actor.getId());
            assertThat(event.getActorDisplayName()).isEqualTo(actor.getDisplayName());
            assertThat(event.getActorEmail()).isEqualTo(actor.getEmail());
            assertThat(event.getActorRole()).isEqualTo("ADMINISTRATOR");
            assertThat(event.getOccurredAt()).isNotNull();
        });
    }

    @ParameterizedTest
    @EnumSource(Operation.class)
    void rollbackRemovesBothAchievementChangeAndAudit(Operation operation) {
        prepareInactiveFixture(operation);
        UUID[] target = new UUID[1];
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            target[0] = perform(operation);
            entities.flush();
            assertThat(audits.count()).isEqualTo(1);
            status.setRollbackOnly();
        });
        assertOriginal(operation != Operation.REACTIVATE);
        if (operation == Operation.CREATE) assertThat(achievements.findById(target[0])).isEmpty();
        assertThat(audits.count()).isZero();
    }

    @ParameterizedTest
    @EnumSource(value = Operation.class, names = {"CREATE", "UPDATE"})
    void invalidCompetencyRejectsChangeWithoutAudit(Operation operation) {
        var invalid = new UpsertAchievementRequest("Invalid", "Invalid", "star",
                ConditionNode.leaf(ConditionType.MIN_COMPETENCY_SCORE, "Unknown competency", 80));
        assertThatThrownBy(() -> {
            if (operation == Operation.CREATE) service.create(invalid);
            else service.update(achievementId, invalid);
        }).isInstanceOf(AdminAchievementService.InvalidAchievementException.class);
        assertOriginal(true);
        assertThat(achievements.findAll()).noneMatch(achievement -> achievement.getName().equals("Invalid"));
        assertThat(audits.count()).isZero();
    }

    @Test
    void missingTargetsAndUnknownScenarioLeaveNoAuditOrChanges() {
        UUID missing = UUID.randomUUID();
        assertThatThrownBy(() -> service.update(missing, request())).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.setActive(missing, false)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.setActive(missing, true)).isInstanceOf(NotFoundException.class);
        var invalidScope = new UpsertAchievementRequest("Invalid scope", "Description", "star", rule(3), missing);
        assertThatThrownBy(() -> service.create(invalidScope)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.update(achievementId, invalidScope)).isInstanceOf(NotFoundException.class);
        assertOriginal(true);
        assertThat(achievements.findAll()).noneMatch(achievement -> achievement.getName().equals("Invalid scope"));
        assertThat(audits.count()).isZero();
    }

    private void prepareInactiveFixture(Operation operation) {
        if (operation == Operation.REACTIVATE) new TransactionTemplate(transactions).executeWithoutResult(
                status -> entities.find(Achievement.class, achievementId).deactivate());
    }

    private UUID perform(Operation operation) {
        return switch (operation) {
            case CREATE -> service.create(request()).id();
            case UPDATE -> service.update(achievementId, request()).id();
            case DEACTIVATE -> service.setActive(achievementId, false).id();
            case REACTIVATE -> service.setActive(achievementId, true).id();
        };
    }

    private void assertOriginal(boolean active) {
        Achievement original = achievements.findById(achievementId).orElseThrow();
        assertThat(original.getName()).isEqualTo("Original achievement");
        assertThat(original.getDescription()).isEqualTo("Original description");
        assertThat(original.getIconKey()).isEqualTo("trophy");
        assertThat(codec.decode(original.getRuleJson())).isEqualTo(rule(2));
        assertThat(original.isActive()).isEqualTo(active);
        assertThat(original.getScenarioLineageId()).isNull();
    }

    private static ConditionNode rule(int count) { return ConditionNode.leaf(ConditionType.MIN_ENGAGEMENTS_COMPLETED, null, count); }
    private static UpsertAchievementRequest request() {
        return new UpsertAchievementRequest("Changed achievement", "Changed description", "star", rule(3));
    }
}
