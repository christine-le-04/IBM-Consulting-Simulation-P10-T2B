package com.ibm.consulting.sim.admin.application;

import com.ibm.consulting.sim.assessment.domain.Assessment;
import com.ibm.consulting.sim.assessment.domain.AssessmentFeedbackStatus;
import com.ibm.consulting.sim.engagement.domain.Engagement;
import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.identity.domain.UserRole;
import com.ibm.consulting.sim.scenario.domain.Scenario;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@Import(LearnerProgressService.class)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
class LearnerProgressServiceTest {
    @Container static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
            DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }
    @Autowired LearnerProgressService service;
    @Autowired EntityManager entities;
    @Autowired JdbcTemplate jdbc;
    private Scenario scenario;
    private Instant now;

    @BeforeEach void prepare() {
        scenario = scenario("Aviation");
        now = jdbc.queryForObject("SELECT CURRENT_TIMESTAMP", Timestamp.class).toInstant();
    }

    private Scenario scenario(String title) {
        Scenario value = Scenario.create(title, "Technology", "Description", 3);
        value.addPersona("Client", "CIO", "Company", "Direct", "Risk", "Budget", "Modernise");
        entities.persist(value);
        entities.flush();
        return value;
    }

    private UUID run(String name, Scenario source, String state, Instant activity) {
        User user = User.create(UUID.randomUUID() + "@example.test", "hash", name, UserRole.LEARNER);
        entities.persist(user);
        Engagement engagement = Engagement.start(user.getId(), source.getId(), source.getPersonas().getFirst().getId());
        entities.persist(engagement);
        entities.flush();
        jdbc.update("UPDATE engagements SET state = ?, updated_at = ?, completed_at = ? WHERE id = ?", state,
                Timestamp.from(activity), state.equals("COMPLETED") ? Timestamp.from(activity) : null, engagement.getId());
        return engagement.getId();
    }

    private LearnerProgressService.ProgressPage page(int page, int size) {
        return service.getProgress(null, null, null, null, page, size);
    }

    @Test void pagesInStableActivityOrderAndClampsPagesRemovedByARefresh() {
        UUID first = run("First", scenario, "OUTREACHING", now);
        UUID second = run("Second", scenario, "PREPARING", now);
        UUID older = run("Older", scenario, "IN_MEETING", now.minusSeconds(60));
        var result = page(0, 1);
        assertThat(result.items()).hasSize(1);
        assertThat(result.totalElements()).isEqualTo(3);
        assertThat(result.totalPages()).isEqualTo(3);
        // Equal timestamps use UUID as a deterministic tie breaker in the database.
        var ids = List.of(page(0, 1).items().getFirst().engagementId(), page(1, 1).items().getFirst().engagementId());
        assertThat(ids).containsExactlyInAnyOrder(first.toString(), second.toString());
        assertThat(page(2, 1).items().getFirst().engagementId()).isEqualTo(older.toString());
        assertThat(page(99, 1).page()).isEqualTo(2);
    }

    @Test void filtersBeforePaginationAndRetainsGlobalSummaryAndScenarioChoices() {
        run("Ana Lee", scenario, "OUTREACHING", now);
        run("Ana idle", scenario, "OUTREACHING", now.minus(5, ChronoUnit.DAYS));
        Scenario other = scenario("Retail");
        run("Other", other, "MEETING_FAILED", now.minus(5, ChronoUnit.DAYS));
        UUID finished = run("Finished", other, "COMPLETED", now);
        entities.persist(Assessment.create(finished, List.of(), 82, "PILOT_APPROVED", "Feedback",
                List.of(), List.of(), AssessmentFeedbackStatus.READY));
        entities.flush();
        var result = service.getProgress(" ANA ", scenario.getId(), "Outreach", "STUCK", 0, 1);
        assertThat(result.items()).extracting(LearnerProgressEntry::displayName).containsExactly("Ana idle");
        assertThat(result.totalElements()).isEqualTo(1);
        assertThat(result.summary()).isEqualTo(new LearnerProgressService.Summary(1, 1, 1, 1, 82, 4));
        assertThat(result.scenarios()).extracting(LearnerProgressService.ScenarioOption::title).containsExactly("Aviation", "Retail");
        assertThat(result.asOf()).isEqualTo(now);
        assertThat(service.getProgress("example.test", null, null, null, 0, 25).totalElements()).isEqualTo(4);
    }

    @Test void handlesLiteralSearchesAndTheExactStuckBoundary() {
        run("100% ready", scenario, "HYPOTHESIS_READY", now.minus(3, ChronoUnit.DAYS));
        run("Ordinary learner", scenario, "REVIEW", now.minus(3, ChronoUnit.DAYS).plusMillis(1));
        var percent = service.getProgress("%", null, "Research", "STUCK", 0, 25);
        assertThat(percent.items()).extracting(LearnerProgressEntry::displayName).containsExactly("100% ready");
        assertThat(percent.summary().stuck()).isEqualTo(1);
        assertThat(percent.summary().inProgress()).isEqualTo(1);
        assertThat(service.getProgress("' OR 1=1 --", null, null, null, 0, 25).items()).isEmpty();
    }

    @Test void emptyResultsStillIncludeGlobalMetadataAndSingleRunDoesNotDependOnTheCurrentPage() {
        UUID id = run("Learner", scenario, "PREPARING", now);
        var result = service.getProgress("missing", null, null, null, 5, 25);
        assertThat(result.items()).isEmpty();
        assertThat(result.totalElements()).isZero();
        assertThat(result.page()).isZero();
        assertThat(result.summary().totalRuns()).isEqualTo(1);
        assertThat(result.summary().averageScore()).isNull();
        assertThat(service.getRun(id).displayName()).isEqualTo("Learner");
        assertThat(service.getRun(UUID.randomUUID())).isNull();
    }

    @Test void emptyDirectoryHasZeroCountsAndNoScore() {
        var result = page(0, 25);
        assertThat(result.items()).isEmpty();
        assertThat(result.totalElements()).isZero();
        assertThat(result.summary()).isEqualTo(new LearnerProgressService.Summary(0, 0, 0, 0, null, 0));
        assertThat(result.scenarios()).isEmpty();
    }
}
