package com.ibm.consulting.sim.scenario.infrastructure;

import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.identity.domain.UserRole;
import com.ibm.consulting.sim.lead.domain.EvidenceType;
import com.ibm.consulting.sim.lead.domain.Lead;
import com.ibm.consulting.sim.lead.domain.LeadDifficulty;
import com.ibm.consulting.sim.scenario.application.*;
import com.ibm.consulting.sim.scenario.domain.*;
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
import org.springframework.jdbc.core.JdbcTemplate;
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
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "app.jwt.secret=scenario-audit-test-only-secret-at-least-sixty-four-bytes-long-1234567890",
        "app.ai.mock-mode=true", "app.watsonx.mock-mode=true", "app.cos.mock-mode=true",
        "app.cache.provider=caffeine", "app.admin.seed.email=", "app.admin.seed.password="
})
@ActiveProfiles("test")
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class ScenarioAuditIntegrationTest {
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

    @Autowired ScenarioService scenarios;
    @Autowired ScenarioAssignmentService assignments;
    @Autowired ScenarioAuthoringConfigService authoring;
    @Autowired AdminAuditEventRepository audits;
    @Autowired EntityManager entities;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactions;
    private User actor;
    private User learner;
    private UUID scenarioId;
    private UUID leadId;

    @BeforeEach
    void prepare() {
        audits.deleteAllInBatch();
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            actor = User.create(UUID.randomUUID() + "@example.test", "fixture-hash", "Scenario administrator", UserRole.ADMINISTRATOR);
            learner = User.create(UUID.randomUUID() + "@example.test", "fixture-hash", "Assigned learner", UserRole.LEARNER);
            entities.persist(actor); entities.persist(learner);
            Scenario scenario = Scenario.create("Original scenario", "Technology", "Original description", 3);
            scenario.updateBriefing("Consultant", "Deliver a grounded recommendation", List.of("Evidence used"), 10);
            scenario.updateProblemBriefing("Modernise a workflow", "Delivery delays", "Validate causes", List.of("What causes delays?"));
            scenario.updateRubricWeights(Map.of("Communication", 100));
            scenario.addPersona("Client", "CIO", "Example Corp", "Direct", "Delivery risk", "Budget", "Modernise");
            authoring.update(scenario, config("original-fact"));
            entities.persist(scenario);
            scenarioId = scenario.getId();
            Lead lead = Lead.create(scenarioId, "Example Corp", "Technology", "Modernisation", LeadDifficulty.MEDIUM);
            lead.configure("Example Corp", "Technology", "Modernisation", LeadDifficulty.MEDIUM, "$100K-$250K", "CIO", "Cloud", "Funding available", "High",
                    List.of(new Lead.SignalInput("Programme announced", "OPPORTUNITY")));
            entities.persist(lead);
            leadId = lead.getId();
        });
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(actor, null,
                List.of(new SimpleGrantedAuthority("ROLE_ADMINISTRATOR"))));
    }

    @AfterEach void clearIdentity() { SecurityContextHolder.clearContext(); }

    @ParameterizedTest
    @EnumSource(value = AuditAction.class, names = {
            "ADMIN_SCENARIO_CREATED", "ADMIN_SCENARIO_PUBLISHED", "ADMIN_SCENARIO_ARCHIVED", "ADMIN_SCENARIO_PERSONA_ADDED",
            "ADMIN_SCENARIO_RUBRIC_CHANGED", "ADMIN_SCENARIO_DIFFICULTY_CHANGED", "ADMIN_SCENARIO_BLUEPRINT_UPDATED",
            "ADMIN_SCENARIO_AUTHORING_CONFIG_CHANGED", "ADMIN_SCENARIO_REVISION_CREATED", "ADMIN_SCENARIO_LEAD_DELETED",
            "ADMIN_SCENARIO_ASSIGNMENTS_UPDATED"
    })
    void actualScenarioOperationPersistsItsMatchingAuditRecord(AuditAction action) throws Exception {
        UUID target = scenarioId;
        String type = "SCENARIO";
        String details = null;
        switch (action) {
            case ADMIN_SCENARIO_CREATED -> {
                target = scenarios.create(new CreateScenarioRequest("New scenario", "Retail", "New description", 2)).id();
                assertThat(jdbc.queryForObject("SELECT title FROM scenarios WHERE id = ?", String.class, target)).isEqualTo("New scenario");
            }
            case ADMIN_SCENARIO_PUBLISHED -> {
                scenarios.publish(scenarioId);
                assertStatus(scenarioId, "ACTIVE");
                assertThat(jdbc.queryForObject("SELECT count(*) FROM announcements WHERE scenario_id = ? AND kind = 'SCENARIO_PUBLISHED'", Long.class, scenarioId)).isEqualTo(1);
            }
            case ADMIN_SCENARIO_ARCHIVED -> {
                activateFixture();
                scenarios.archive(scenarioId);
                assertStatus(scenarioId, "ARCHIVED");
                assertThat(jdbc.queryForObject("SELECT count(*) FROM announcements WHERE scenario_id = ? AND kind = 'SCENARIO_ARCHIVED'", Long.class, scenarioId)).isEqualTo(1);
            }
            case ADMIN_SCENARIO_PERSONA_ADDED -> {
                scenarios.addPersona(scenarioId, new CreatePersonaRequest("Extra contact", "CFO", "Example Corp", "Direct", "Costs", "Budget", "Modernise"));
                details = jdbc.queryForObject("SELECT id FROM personas WHERE scenario_id = ? AND name = 'Extra contact'", UUID.class, scenarioId).toString();
                assertThat(jdbc.queryForObject("SELECT count(*) FROM personas WHERE scenario_id = ?", Long.class, scenarioId)).isEqualTo(2);
            }
            case ADMIN_SCENARIO_RUBRIC_CHANGED -> {
                var weights = Map.of("Communication", 75, "Analysis", 25);
                scenarios.updateRubricWeights(scenarioId, weights);
                details = weights.toString();
                assertThat(scenarios.authoringView(scenarioId).scenario().rubricWeights()).isEqualTo(weights);
            }
            case ADMIN_SCENARIO_DIFFICULTY_CHANGED -> {
                var request = new UpdateDifficultyProfileRequest(new UpdateDifficultyProfileRequest.Profile(
                        DifficultyLevel.HARD, 6, 2, 2, 35, 40, 45, 12, false, 10, 5, 70, 75, 70, 75, 100));
                scenarios.updateDifficultyProfile(scenarioId, request);
                details = request.toDomain().toString();
                assertThat(scenarios.authoringView(scenarioId).scenario().gameplayDifficulty().level()).isEqualTo("HARD");
            }
            case ADMIN_SCENARIO_BLUEPRINT_UPDATED -> {
                scenarios.updateBlueprint(scenarioId, blueprint());
                assertThat(jdbc.queryForObject("SELECT title FROM scenarios WHERE id = ?", String.class, scenarioId)).isEqualTo("Updated scenario");
            }
            case ADMIN_SCENARIO_AUTHORING_CONFIG_CHANGED -> {
                scenarios.updateAuthoringConfig(scenarioId, config("changed-fact"));
                assertThat(scenarios.authoringView(scenarioId).config()).isEqualTo(config("changed-fact"));
            }
            case ADMIN_SCENARIO_REVISION_CREATED -> {
                target = scenarios.createRevision(scenarioId).scenario().id();
                details = "forked from " + scenarioId;
                assertStatus(target, "DRAFT");
                assertThat(jdbc.queryForObject("SELECT content_version FROM scenarios WHERE id = ?", Integer.class, target)).isEqualTo(2);
                assertThat(jdbc.queryForObject("SELECT scenario_lineage_id FROM scenarios WHERE id = ?", UUID.class, target)).isEqualTo(scenarioId);
                assertThat(jdbc.queryForObject("SELECT count(*) FROM leads WHERE scenario_id = ?", Long.class, target)).isEqualTo(1);
            }
            case ADMIN_SCENARIO_LEAD_DELETED -> {
                scenarios.deleteLead(scenarioId, leadId);
                target = leadId; type = "LEAD"; details = "scenario " + scenarioId;
                assertThat(jdbc.queryForObject("SELECT count(*) FROM leads WHERE id = ?", Long.class, leadId)).isZero();
            }
            case ADMIN_SCENARIO_ASSIGNMENTS_UPDATED -> {
                activateFixture();
                assignments.replaceAssignments(scenarioId, List.of(learner.getId()), actor.getId());
                assertThat(jdbc.queryForObject("SELECT count(*) FROM scenario_assignments WHERE scenario_lineage_id = ? AND user_id = ?",
                        Long.class, scenarioId, learner.getId())).isEqualTo(1);
            }
            default -> throw new AssertionError("Unexpected scenario operation: " + action);
        }
        var records = audits.findAll();
        assertThat(records).hasSize(1);
        var event = records.getFirst();
        assertThat(event.getAction()).isEqualTo(action);
        assertThat(event.getTargetType()).isEqualTo(type);
        assertThat(event.getTargetId()).isEqualTo(target.toString());
        if (action == AuditAction.ADMIN_SCENARIO_ASSIGNMENTS_UPDATED) {
            var assignmentDetails = new com.fasterxml.jackson.databind.ObjectMapper().readTree(event.getDetails());
            assertThat(assignmentDetails.path("scenario").asText()).isEqualTo("Original scenario");
            assertThat(assignmentDetails.path("assigned").size()).isEqualTo(1);
            assertThat(assignmentDetails.path("assigned").get(0).path("displayName").asText()).isEqualTo("Assigned learner");
            assertThat(assignmentDetails.path("assigned").get(0).path("email").asText()).isEqualTo(learner.getEmail());
            assertThat(assignmentDetails.path("unassigned").size()).isZero();
        } else {
            assertThat(event.getDetails()).isEqualTo(details);
        }
        assertThat(event.getActorId()).isEqualTo(actor.getId());
        assertThat(event.getActorDisplayName()).isEqualTo("Scenario administrator");
        assertThat(event.getActorEmail()).isEqualTo(actor.getEmail());
        assertThat(event.getActorRole()).isEqualTo("ADMINISTRATOR");
        assertThat(event.getOccurredAt()).isNotNull();
    }

    @Test
    void rejectedPublicationAndAssignmentsLeaveNoAuditOrAnnouncement() {
        UUID incomplete = new TransactionTemplate(transactions).execute(status -> {
            Scenario scenario = Scenario.create("Incomplete", "Retail", "Missing required content", 3);
            entities.persist(scenario);
            return scenario.getId();
        });
        long announcementsBefore = jdbc.queryForObject("SELECT count(*) FROM announcements", Long.class);
        assertThatThrownBy(() -> scenarios.publish(incomplete)).isInstanceOf(ScenarioNotReadyException.class);
        assertThatThrownBy(() -> assignments.replaceAssignments(scenarioId, List.of(actor.getId()), actor.getId()))
                .isInstanceOf(ScenarioAssignmentService.InvalidAssigneeException.class);
        assertStatus(incomplete, "DRAFT");
        assertThat(audits.count()).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM announcements", Long.class)).isEqualTo(announcementsBefore);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM scenario_assignments WHERE scenario_lineage_id = ?", Long.class, scenarioId)).isZero();
    }

    @Test
    void rolledBackBlueprintChangeRemovesBothTheChangeAndAuditRecord() {
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            scenarios.updateBlueprint(scenarioId, blueprint());
            assertThat(audits.count()).isEqualTo(1);
            status.setRollbackOnly();
        });
        assertThat(jdbc.queryForObject("SELECT title FROM scenarios WHERE id = ?", String.class, scenarioId)).isEqualTo("Original scenario");
        assertThat(audits.count()).isZero();
    }

    private void activateFixture() {
        new TransactionTemplate(transactions).executeWithoutResult(status -> entities.find(Scenario.class, scenarioId).publish());
    }

    private void assertStatus(UUID id, String expected) {
        assertThat(jdbc.queryForObject("SELECT status FROM scenarios WHERE id = ?", String.class, id)).isEqualTo(expected);
    }

    private static ScenarioAuthoringConfig config(String id) {
        return new ScenarioAuthoringConfig(
                List.of(new CanonicalFact(id, "Constraint", "Budget is capped", EvidenceType.FINANCIAL_SIGNAL, true)),
                List.of(new RevealRule(RevealTarget.BUDGET_SIGNAL, Set.of(EvidenceType.FINANCIAL_SIGNAL), 1)));
    }

    private static UpdateScenarioBlueprintRequest blueprint() {
        return new UpdateScenarioBlueprintRequest("Updated scenario", "Retail", "Updated description", 4, "Consultant", "Updated objective",
                List.of("Updated criteria"), 12, "Business situation", "Observed delays", "Validate causes", List.of("What causes delays?"), 4, 3, 2);
    }
}
