package com.ibm.consulting.sim.identity.infrastructure;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers(disabledWithoutDocker = true)
class AccessTokenRevocationIntegrationTest {
    @Container
    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    void migrationAndStorePersistRevocationsAcrossInstancesAndRemoveOnlyExpiredRows() {
        DriverManagerDataSource datasource = new DriverManagerDataSource(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
        new ResourceDatabasePopulator(new ClassPathResource("db/migration/V73__add_access_token_revocations.sql"))
                .execute(datasource);
        JdbcTemplate jdbc = new JdbcTemplate(datasource);
        JdbcAccessTokenRevocationStore first = new JdbcAccessTokenRevocationStore(jdbc);
        JdbcAccessTokenRevocationStore second = new JdbcAccessTokenRevocationStore(jdbc);
        String activeHash = "a".repeat(64);
        String expiredHash = "b".repeat(64);
        String recentlyExpiredHash = "c".repeat(64);
        first.revoke(activeHash, Instant.now().plusSeconds(60));
        first.revoke(activeHash, Instant.now().plusSeconds(60));
        first.revoke(expiredHash, Instant.now().minusSeconds(600));
        first.revoke(recentlyExpiredHash, Instant.now().minusSeconds(30));
        assertThat(second.isRevoked(activeHash)).isTrue();
        assertThat(second.isRevoked(expiredHash)).isTrue();
        second.deleteExpiredRevocations();
        assertThat(second.isRevoked(expiredHash)).isFalse();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM revoked_access_tokens", Integer.class)).isEqualTo(2);
        assertThat(first.isRevoked(activeHash)).isTrue();
        assertThat(second.isRevoked(recentlyExpiredHash)).isTrue();
    }
}
