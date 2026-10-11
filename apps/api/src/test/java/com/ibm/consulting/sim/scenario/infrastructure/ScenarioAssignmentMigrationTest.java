package com.ibm.consulting.sim.scenario.infrastructure;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V64 as it will run on the shared database: migrate to V63, add users the
 * way production already has them, then apply V64 and check the backfill.
 */
@Testcontainers(disabledWithoutDocker = true)
class ScenarioAssignmentMigrationTest {

    @Container
    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
            DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));

    @Test
    void v64AssignsExistingLearnersToEveryLiveScenarioAndNoOneElse() throws SQLException {
        flywayUpTo("63").migrate();

        UUID learner = UUID.randomUUID();
        UUID secondLearner = UUID.randomUUID();
        UUID author = UUID.randomUUID();
        UUID administrator = UUID.randomUUID();
        int liveLineages;
        try (Connection connection = connect()) {
            insertUser(connection, learner, "LEARNER");
            insertUser(connection, secondLearner, "LEARNER");
            insertUser(connection, author, "SCENARIO_AUTHOR");
            insertUser(connection, administrator, "ADMINISTRATOR");
            liveLineages = count(connection,
                    "SELECT count(DISTINCT scenario_lineage_id) FROM scenarios WHERE status = 'ACTIVE'");
        }

        assertThat(liveLineages).as("the seed migrations publish demo scenarios").isPositive();

        flywayUpTo("64").migrate();

        try (Connection connection = connect()) {
            assertThat(assignmentsFor(connection, learner)).isEqualTo(liveLineages);
            assertThat(assignmentsFor(connection, secondLearner)).isEqualTo(liveLineages);
            assertThat(assignmentsFor(connection, author)).isZero();
            assertThat(assignmentsFor(connection, administrator)).isZero();
            assertThat(count(connection, """
                    SELECT count(*) FROM scenario_assignments a
                    WHERE NOT EXISTS (SELECT 1 FROM scenarios s
                                      WHERE s.scenario_lineage_id = a.scenario_lineage_id AND s.status = 'ACTIVE')
                    """)).as("no assignment points at a lineage without a live revision").isZero();
            assertThat(count(connection, "SELECT count(*) FROM scenario_assignments WHERE assigned_by IS NOT NULL"))
                    .as("migrated rows have no assigning administrator").isZero();
        }
        flywayUpTo("67").migrate();
        UUID newLearner = UUID.randomUUID();
        UUID anotherNewLearner = UUID.randomUUID();
        int originalAssignments;
        try (Connection connection = connect()) {
            insertUser(connection, newLearner, "LEARNER");
            insertUser(connection, anotherNewLearner, "LEARNER");
            originalAssignments = assignmentsFor(connection, learner);
        }
        flywayUpTo("68").migrate();
        try (Connection connection = connect()) {
            assertThat(assignmentsFor(connection, newLearner)).isEqualTo(1);
            assertThat(assignmentsFor(connection, anotherNewLearner)).isEqualTo(1);
            assertThat(assignmentsFor(connection, learner)).isEqualTo(originalAssignments);
            assertThat(assignmentsFor(connection, author)).isZero();
            assertThat(count(connection, """
                    SELECT count(*) FROM scenario_assignments a
                    WHERE NOT EXISTS (SELECT 1 FROM scenarios s
                                      WHERE s.scenario_lineage_id = a.scenario_lineage_id AND s.status = 'ACTIVE')
                    """)).isZero();
        }
    }

    private static Flyway flywayUpTo(String version) {
        return Flyway.configure()
                .dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .locations("classpath:db/migration")
                .target(version)
                .load();
    }

    private static Connection connect() throws SQLException {
        return DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
    }

    private static void insertUser(Connection connection, UUID id, String role) throws SQLException {
        try (PreparedStatement insert = connection.prepareStatement("""
                INSERT INTO users (id, email, password_hash, display_name, role, created_at, updated_at)
                VALUES (?, ?, 'hash', ?, ?, ?, ?)
                """)) {
            Timestamp now = Timestamp.from(Instant.now());
            insert.setObject(1, id);
            insert.setString(2, id + "@example.com");
            insert.setString(3, role + " " + id.toString().substring(0, 8));
            insert.setString(4, role);
            insert.setTimestamp(5, now);
            insert.setTimestamp(6, now);
            insert.executeUpdate();
        }
    }

    private static int assignmentsFor(Connection connection, UUID userId) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement(
                "SELECT count(*) FROM scenario_assignments WHERE user_id = ?")) {
            query.setObject(1, userId);
            try (ResultSet result = query.executeQuery()) {
                result.next();
                return result.getInt(1);
            }
        }
    }

    private static int count(Connection connection, String sql) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement(sql); ResultSet result = query.executeQuery()) {
            result.next();
            return result.getInt(1);
        }
    }
}
