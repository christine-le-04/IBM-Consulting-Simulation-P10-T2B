package com.ibm.consulting.sim.identity.infrastructure;

import com.ibm.consulting.sim.identity.application.AdminUserService;
import com.ibm.consulting.sim.identity.application.EmailVerificationService;
import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.identity.domain.UserAlreadyExistsException;
import com.ibm.consulting.sim.identity.domain.UserRepository;
import com.ibm.consulting.sim.identity.domain.UserRole;
import com.ibm.consulting.sim.shared.domain.NotFoundException;
import com.ibm.consulting.sim.shared.infrastructure.observability.AdminAuditEventRepository;
import com.ibm.consulting.sim.shared.infrastructure.observability.AuditAction;
import com.ibm.consulting.sim.shared.infrastructure.observability.AuditLogger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
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
import java.util.Locale;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;

@DataJpaTest
@Import({JpaUserRepository.class, AdminUserService.class, AuditLogger.class, AdminUserAuditIntegrationTest.Encoding.class})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class AdminUserAuditIntegrationTest {
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
    static class Encoding {
        @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }
    }

    @Autowired AdminUserService service;
    @Autowired UserRepository users;
    @Autowired AdminAuditEventRepository audits;
    @Autowired PlatformTransactionManager transactions;
    @MockBean EmailVerificationService emailVerification;
    private User actor;

    @BeforeEach
    void prepare() {
        audits.deleteAllInBatch();
        actor = save(User.create(UUID.randomUUID() + "@example.test", "fixture-hash", "Audit administrator", UserRole.ADMINISTRATOR));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(actor, null,
                List.of(new SimpleGrantedAuthority("ROLE_ADMINISTRATOR"))));
    }

    @AfterEach void clearIdentity() { SecurityContextHolder.clearContext(); }

    @ParameterizedTest
    @EnumSource(value = AuditAction.class, names = {"ADMIN_USER_CREATED", "ADMIN_USER_DELETED", "ADMIN_USER_ROLE_CHANGED",
            "ADMIN_USER_DEACTIVATED", "ADMIN_USER_REACTIVATED"})
    void actualUserOperationPersistsItsAuditRecordAndIdentitySnapshots(AuditAction action) {
        String email = UUID.randomUUID() + "@example.test";
        UUID targetId;
        if (action == AuditAction.ADMIN_USER_CREATED) {
            targetId = service.createUser(" " + email.toUpperCase(Locale.ROOT) + " ", "Test-password-123!",
                    "  Audit target  ", UserRole.LEARNER, true).id();
        } else {
            User target = User.create(email, "fixture-hash", "Audit target", UserRole.LEARNER);
            if (action == AuditAction.ADMIN_USER_REACTIVATED) target.deactivate();
            targetId = save(target).getId();
            switch (action) {
                case ADMIN_USER_DELETED -> service.deleteUser(targetId, actor.getId());
                case ADMIN_USER_ROLE_CHANGED -> service.changeRole(targetId, UserRole.REVIEWER);
                case ADMIN_USER_DEACTIVATED -> service.deactivate(targetId);
                case ADMIN_USER_REACTIVATED -> service.reactivate(targetId);
                default -> throw new AssertionError("Unexpected user operation: " + action);
            }
        }

        assertThat(audits.findAll()).singleElement().satisfies(event -> {
            assertThat(event.getAction()).isEqualTo(action);
            assertThat(event.getActorId()).isEqualTo(actor.getId());
            assertThat(event.getActorDisplayName()).isEqualTo("Audit administrator");
            assertThat(event.getActorEmail()).isEqualTo(actor.getEmail());
            assertThat(event.getActorRole()).isEqualTo("ADMINISTRATOR");
            assertThat(event.getTargetType()).isEqualTo("USER");
            assertThat(event.getTargetId()).isEqualTo(targetId.toString());
            assertThat(event.getTargetDisplayName()).isEqualTo("Audit target");
            assertThat(event.getTargetEmail()).isEqualTo(email);
            assertThat(event.getTargetRole()).isEqualTo(action == AuditAction.ADMIN_USER_ROLE_CHANGED ? "REVIEWER" : "LEARNER");
            assertThat(event.getOccurredAt()).isNotNull();
            String details = switch (action) {
                case ADMIN_USER_CREATED, ADMIN_USER_DELETED -> email;
                case ADMIN_USER_ROLE_CHANGED -> "REVIEWER";
                default -> null;
            };
            assertThat(event.getDetails()).isEqualTo(details);
        });
        if (action == AuditAction.ADMIN_USER_DELETED) {
            assertThat(users.findById(targetId)).isEmpty();
        } else {
            User saved = users.findById(targetId).orElseThrow();
            assertThat(saved.isActive()).isEqualTo(action != AuditAction.ADMIN_USER_DEACTIVATED);
            assertThat(saved.getRole()).isEqualTo(action == AuditAction.ADMIN_USER_ROLE_CHANGED ? UserRole.REVIEWER : UserRole.LEARNER);
        }
        verifyNoInteractions(emailVerification);
    }

    @Test
    void rejectedOperationsDoNotCreateMisleadingAuditRecords() {
        User target = save(User.create(UUID.randomUUID() + "@example.test", "fixture-hash", "Existing user", UserRole.LEARNER));
        assertThatThrownBy(() -> service.createUser(target.getEmail(), "Test-password-123!", "Duplicate", UserRole.LEARNER, true))
                .isInstanceOf(UserAlreadyExistsException.class);
        assertThatThrownBy(() -> service.deleteUser(actor.getId(), actor.getId()))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("own account");
        assertThatThrownBy(() -> service.changeRole(UUID.randomUUID(), UserRole.REVIEWER)).isInstanceOf(NotFoundException.class);
        assertThat(audits.count()).isZero();
        assertThat(users.findById(target.getId()).orElseThrow().getRole()).isEqualTo(UserRole.LEARNER);
        assertThat(users.findById(actor.getId())).isPresent();
        verifyNoInteractions(emailVerification);
    }

    @Test
    void rollingBackAnActualRoleChangeRemovesBothTheChangeAndItsAudit() {
        User target = save(User.create(UUID.randomUUID() + "@example.test", "fixture-hash", "Rollback target", UserRole.LEARNER));
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            service.changeRole(target.getId(), UserRole.REVIEWER);
            assertThat(audits.count()).isEqualTo(1);
            status.setRollbackOnly();
        });
        assertThat(users.findById(target.getId()).orElseThrow().getRole()).isEqualTo(UserRole.LEARNER);
        assertThat(audits.count()).isZero();
    }

    private User save(User user) {
        return new TransactionTemplate(transactions).execute(status -> users.save(user));
    }
}
