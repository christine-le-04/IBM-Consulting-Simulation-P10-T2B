package com.ibm.consulting.sim.identity.infrastructure;

import com.ibm.consulting.sim.identity.application.CredentialTokenService;
import com.ibm.consulting.sim.identity.application.RefreshSessionService;
import com.ibm.consulting.sim.identity.application.TokenResponse;
import com.ibm.consulting.sim.identity.domain.RefreshSessionRepository;
import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.identity.domain.UserRepository;
import com.ibm.consulting.sim.identity.domain.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.BadCredentialsException;
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

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.*;

@DataJpaTest
@Import({JpaUserRepository.class, JpaRefreshSessionRepository.class, JdbcAccessTokenRevocationStore.class,
        JwtTokenProvider.class, RefreshSessionService.class, CredentialTokenService.class})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class RefreshSessionConcurrencyIntegrationTest {
    @Container
    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
            DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("app.jwt.secret", () -> "test-secret-with-at-least-thirty-two-bytes");
    }

    @Autowired RefreshSessionService service;
    @Autowired UserRepository users;
    @Autowired RefreshSessionRepository sessions;
    @Autowired JwtTokenProvider tokens;
    @Autowired PlatformTransactionManager transactions;

    @Test
    void concurrentTabsRotateOnceAndBothReceiveUsableAccessTokens() throws Exception {
        User user = createUser();
        var original = open(user);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try (var workers = Executors.newFixedThreadPool(2)) {
            java.util.concurrent.Callable<RefreshSessionService.IssuedSession> work = () -> {
                ready.countDown();
                assertThat(start.await(20, TimeUnit.SECONDS)).isTrue();
                return service.refresh(original.refreshCookie());
            };
            var first = workers.submit(work);
            var second = workers.submit(work);
            assertThat(ready.await(20, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            var results = List.of(first.get(20, TimeUnit.SECONDS), second.get(20, TimeUnit.SECONDS));
            assertThat(results.stream().filter(result -> result.refreshCookie() != null).count()).isEqualTo(1);
            for (var result : results) assertThat(tokens.isValidForUser(result.access().accessToken(), user)).isTrue();
        }
    }

    @Test
    void failedReplayCommitsRevocationDespiteReturningAnAuthenticationException() {
        User user = createUser();
        var original = open(user);
        new TransactionTemplate(transactions).executeWithoutResult(ignored -> {
            var session = sessions.findByIdForUpdate(UUID.fromString(original.access().sessionId())).orElseThrow();
            session.rotate(new CredentialTokenService().issue().hash(), Instant.now().minusSeconds(10));
            sessions.saveAndFlush(session);
        });
        assertThatThrownBy(() -> service.refresh(original.refreshCookie())).isInstanceOf(BadCredentialsException.class);
        assertThat(tokens.isValidForUser(original.access().accessToken(), user)).isFalse();
    }

    @Test
    void olderReplayPersistsFamilyRevocationAcrossMultipleRotations() {
        User user = createUser();
        var original = open(user);
        var first = service.refresh(original.refreshCookie());
        var second = service.refresh(first.refreshCookie());
        assertThatThrownBy(() -> service.refresh(original.refreshCookie())).isInstanceOf(BadCredentialsException.class);
        assertThat(tokens.isValidForUser(second.access().accessToken(), user)).isFalse();
    }

    private User createUser() {
        return users.saveAndFlush(User.create(UUID.randomUUID() + "@example.test", "hash", "Learner", UserRole.LEARNER));
    }

    private RefreshSessionService.IssuedSession open(User user) {
        return service.open(new TokenResponse(tokens.generateToken(user), user.getId().toString(), "Learner", "LEARNER", false));
    }
}
