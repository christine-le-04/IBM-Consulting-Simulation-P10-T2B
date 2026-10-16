package com.ibm.consulting.sim.admin.application;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers(disabledWithoutDocker = true)
class AdminAuditMigrationIntegrationTest {
    @Container
    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
            DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));

    @Test
    void upgradesLegacyAuditRecordsWithoutInventingMissingIdentitiesOrLosingHistory() {
        migrateTo("75");
        var jdbc = new JdbcTemplate(new DriverManagerDataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()));
        UUID currentUser = insertUser(jdbc, "Current Learner", "current@example.test", "LEARNER");
        UUID deletedUser = insertUser(jdbc, "Deleted User", "deleted@example.test", "LEARNER");
        UUID deletedActor = insertUser(jdbc, "Former Administrator", "former-admin@example.test", "ADMINISTRATOR");
        UUID created = insertAudit(jdbc, "ADMIN_USER_CREATED", "USER", currentUser.toString(), "outdated@example.test", null);
        UUID changed = insertAudit(jdbc, "ADMIN_USER_ROLE_CHANGED", "USER", currentUser.toString(), "REVIEWER", null);
        UUID deleted = insertAudit(jdbc, "ADMIN_USER_DELETED", "USER", deletedUser.toString(), "deleted@example.test", deletedActor);
        UUID missing = insertAudit(jdbc, "ADMIN_USER_DEACTIVATED", "USER", UUID.randomUUID().toString(), null, null);
        UUID invalidRole = insertAudit(jdbc, "ADMIN_USER_ROLE_CHANGED", "USER", UUID.randomUUID().toString(), "UNKNOWN_ROLE", null);
        UUID invalidEmail = insertAudit(jdbc, "ADMIN_USER_DELETED", "USER", UUID.randomUUID().toString(), "Deleted account: hidden@example.test", null);
        UUID scenario = insertAudit(jdbc, "ADMIN_SCENARIO_ARCHIVED", "SCENARIO", currentUser.toString(), "unrelated@example.test", null);
        UUID missingId = insertAudit(jdbc, "ADMIN_USER_CREATED", "USER", "legacy-unavailable", "legacy@example.test", null);
        jdbc.update("DELETE FROM users WHERE id IN (?, ?)", deletedUser, deletedActor);

        migrateTo("76");
        assertIdentity(jdbc, created, "Current Learner", "current@example.test");
        assertIdentity(jdbc, deleted, null, "deleted@example.test");
        assertIdentity(jdbc, missingId, null, "legacy@example.test");
        for (UUID id : new UUID[]{missing, invalidRole, invalidEmail, scenario}) assertIdentity(jdbc, id, null, null);

        migrateTo("77");
        assertThat(role(jdbc, created)).isEqualTo("LEARNER");
        // Event-time role-change details take precedence over the account's current role.
        assertThat(role(jdbc, changed)).isEqualTo("REVIEWER");
        for (UUID id : new UUID[]{deleted, missing, invalidRole, invalidEmail, scenario, missingId}) assertThat(role(jdbc, id)).isNull();

        migrateTo("78");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM admin_audit_events", Long.class)).isEqualTo(8);
        var historical = jdbc.queryForMap("SELECT * FROM admin_audit_events WHERE id = ?", deleted);
        assertThat(historical).containsEntry("actor_id", deletedActor)
                .containsEntry("actor_display_name", "Former Administrator")
                .containsEntry("actor_email", "former-admin@example.test")
                .containsEntry("actor_role", "ADMINISTRATOR")
                .containsEntry("target_id", deletedUser.toString())
                .containsEntry("details", "deleted@example.test");
        assertThat(jdbc.queryForObject("SELECT actor_id FROM admin_audit_events WHERE id = ?", UUID.class, missing)).isNull();
        // V78 adds announcements without changing the audit rows or requiring a surviving scenario.
        UUID announcement = UUID.randomUUID();
        jdbc.update("INSERT INTO announcements (id, scenario_id, kind, scenario_title) VALUES (?, ?, 'SCENARIO_PUBLISHED', 'Original title')",
                announcement, UUID.randomUUID());
        jdbc.update("INSERT INTO announcement_reads (user_id, announcement_id) VALUES (?, ?)", currentUser, announcement);
        jdbc.update("DELETE FROM users WHERE id = ?", currentUser);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM announcement_reads", Long.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT scenario_title FROM announcements WHERE id = ?", String.class, announcement)).isEqualTo("Original title");
        assertIdentity(jdbc, created, "Current Learner", "current@example.test");
        assertThat(role(jdbc, created)).isEqualTo("LEARNER");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM admin_audit_events", Long.class)).isEqualTo(8);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM flyway_schema_history WHERE version IN ('76', '77', '78') AND success", Long.class)).isEqualTo(3);
    }

    private static void migrateTo(String version) {
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .locations("classpath:db/migration").target(version).load().migrate();
    }

    private static UUID insertUser(JdbcTemplate jdbc, String name, String email, String role) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO users (id, email, password_hash, display_name, role, created_at, updated_at)
                VALUES (?, ?, 'test-hash', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, id, email, name, role);
        return id;
    }

    private static UUID insertAudit(JdbcTemplate jdbc, String action, String type, String target, String details, UUID actor) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO admin_audit_events (id, occurred_at, action, target_type, target_id, details,
                    actor_id, actor_display_name, actor_email, actor_role)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, id, Timestamp.from(Instant.parse("2026-01-01T12:00:00Z")), action, type, target, details,
                actor, actor == null ? null : "Former Administrator", actor == null ? null : "former-admin@example.test", actor == null ? null : "ADMINISTRATOR");
        return id;
    }

    private static void assertIdentity(JdbcTemplate jdbc, UUID id, String name, String email) {
        var row = jdbc.queryForMap("SELECT target_display_name, target_email FROM admin_audit_events WHERE id = ?", id);
        assertThat(row.get("target_display_name")).isEqualTo(name);
        assertThat(row.get("target_email")).isEqualTo(email);
    }

    private static String role(JdbcTemplate jdbc, UUID id) {
        return jdbc.queryForObject("SELECT target_role FROM admin_audit_events WHERE id = ?", String.class, id);
    }
}
