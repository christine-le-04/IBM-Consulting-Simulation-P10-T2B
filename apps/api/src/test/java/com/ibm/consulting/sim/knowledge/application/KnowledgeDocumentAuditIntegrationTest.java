package com.ibm.consulting.sim.knowledge.application;

import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.identity.domain.UserRole;
import com.ibm.consulting.sim.knowledge.domain.*;
import com.ibm.consulting.sim.scenario.domain.Scenario;
import com.ibm.consulting.sim.shared.domain.NotFoundException;
import com.ibm.consulting.sim.shared.infrastructure.observability.AdminAuditEventRepository;
import com.ibm.consulting.sim.shared.infrastructure.observability.AuditAction;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
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
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "app.jwt.secret=document-audit-test-only-secret-at-least-sixty-four-bytes-long-1234567890",
        "app.ai.mock-mode=true", "app.watsonx.mock-mode=true", "app.cos.mock-mode=true",
        "app.cache.provider=caffeine", "app.admin.seed.email=", "app.admin.seed.password="
})
@ActiveProfiles("test")
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class KnowledgeDocumentAuditIntegrationTest {
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

    @Autowired KnowledgeIngestionService ingestion;
    @Autowired KnowledgeDocumentRepository documents;
    @Autowired AdminAuditEventRepository audits;
    @Autowired EntityManager entities;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactions;
    private User actor;
    private UUID scenarioId;
    private UUID otherScenarioId;
    private UUID personaId;
    private UUID foreignPersonaId;
    private UUID documentId;

    enum Operation {
        ADD(AuditAction.ADMIN_SCENARIO_DOCUMENT_ADDED),
        UPDATE(AuditAction.ADMIN_SCENARIO_DOCUMENT_UPDATED),
        DELETE(AuditAction.ADMIN_SCENARIO_DOCUMENT_DELETED);

        final AuditAction action;
        Operation(AuditAction action) { this.action = action; }
    }

    @BeforeEach
    void prepare() {
        audits.deleteAllInBatch();
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            actor = User.create(UUID.randomUUID() + "@example.test", "fixture-hash", "Document administrator", UserRole.ADMINISTRATOR);
            entities.persist(actor);
            Scenario scenario = Scenario.create("Document scenario", "Technology", "Description", 3);
            personaId = scenario.addPersona("Client", "CIO", "Example", "Direct", "Risk", "Budget", "Modernise").getId();
            entities.persist(scenario);
            scenarioId = scenario.getId();
            Scenario other = Scenario.create("Other scenario", "Retail", "Description", 3);
            foreignPersonaId = other.addPersona("Other client", "CFO", "Other", "Direct", "Costs", "Budget", "Save").getId();
            entities.persist(other);
            otherScenarioId = other.getId();
            KnowledgeDocument document = KnowledgeDocument.create(scenarioId, null, KnowledgeCollection.SCENARIO_TRUTH, "Original document", "Original passage");
            entities.persist(document);
            documentId = document.getId();
            entities.persist(DocumentChunk.create(documentId, scenarioId, null, KnowledgeCollection.SCENARIO_TRUTH, 0, "Original passage", new float[]{1, 0}));
        });
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(actor, null,
                List.of(new SimpleGrantedAuthority("ROLE_ADMINISTRATOR"))));
    }

    @AfterEach void clearIdentity() { SecurityContextHolder.clearContext(); }

    @ParameterizedTest
    @EnumSource(Operation.class)
    void documentOperationPersistsItsMatchingAuditRecordAndChunks(Operation operation) {
        UUID target = perform(operation);
        if (operation == Operation.DELETE) {
            assertThat(documents.findById(target)).isEmpty();
            assertThat(chunkContents(target)).isEmpty();
        } else {
            var document = documents.findById(target).orElseThrow();
            assertThat(document.getTitle()).isEqualTo("Changed document");
            assertThat(document.getPersonaId()).isEqualTo(personaId);
            assertThat(document.getCollection()).isEqualTo(KnowledgeCollection.CONSULTING_PRACTICE);
            assertThat(document.getSourceText()).isEqualTo("First passage\n\nSecond passage");
            assertThat(chunkContents(target)).containsExactly("First passage", "Second passage");
            assertThat(jdbc.queryForObject("SELECT count(*) FROM document_chunks WHERE document_id = ? AND scenario_id = ? AND persona_id = ? AND collection = 'CONSULTING_PRACTICE'",
                    Long.class, target, scenarioId, personaId)).isEqualTo(2);
        }
        assertThat(audits.findAll()).singleElement().satisfies(event -> {
            assertThat(event.getAction()).isEqualTo(operation.action);
            assertThat(event.getTargetType()).isEqualTo("KNOWLEDGE_DOCUMENT");
            assertThat(event.getTargetId()).isEqualTo(target.toString());
            assertThat(event.getDetails()).isEqualTo("scenario " + scenarioId + ", title: " + (operation == Operation.DELETE ? "Original document" : "Changed document"));
            assertThat(event.getActorId()).isEqualTo(actor.getId());
            assertThat(event.getActorDisplayName()).isEqualTo(actor.getDisplayName());
            assertThat(event.getActorEmail()).isEqualTo(actor.getEmail());
            assertThat(event.getActorRole()).isEqualTo("ADMINISTRATOR");
            assertThat(event.getOccurredAt()).isNotNull();
        });
    }

    @ParameterizedTest
    @EnumSource(Operation.class)
    void rollbackRestoresDocumentsAndChunksAndRemovesAudit(Operation operation) {
        UUID[] target = new UUID[1];
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            target[0] = perform(operation);
            entities.flush();
            assertThat(audits.count()).isEqualTo(1);
            status.setRollbackOnly();
        });
        assertOriginalDocument();
        if (operation == Operation.ADD) {
            assertThat(documents.findById(target[0])).isEmpty();
            assertThat(chunkContents(target[0])).isEmpty();
        }
        assertThat(audits.count()).isZero();
    }

    @ParameterizedTest
    @EnumSource(Operation.class)
    void publishedScenarioRejectsChangesWithoutAudit(Operation operation) {
        new TransactionTemplate(transactions).executeWithoutResult(status -> entities.find(Scenario.class, scenarioId).publish());
        assertThatThrownBy(() -> perform(operation)).isInstanceOf(KnowledgeIngestionService.ScenarioContentLockedException.class);
        assertOriginalDocument();
        assertThat(audits.count()).isZero();
    }

    @ParameterizedTest
    @EnumSource(value = Operation.class, names = {"UPDATE", "DELETE"})
    void documentFromAnotherScenarioCannotBeChanged(Operation operation) {
        assertThatThrownBy(() -> {
            if (operation == Operation.DELETE) ingestion.delete(otherScenarioId, documentId);
            else ingestion.update(otherScenarioId, documentId, null, KnowledgeCollection.SCENARIO_TRUTH, "Invalid", "Invalid");
        }).isInstanceOf(NotFoundException.class);
        assertOriginalDocument();
        assertThat(audits.count()).isZero();
    }

    @ParameterizedTest
    @EnumSource(value = Operation.class, names = {"ADD", "UPDATE"})
    void foreignPersonaIsRejectedWithoutChangingDocumentsOrAudits(Operation operation) {
        assertThatThrownBy(() -> {
            if (operation == Operation.ADD) ingestion.ingest(scenarioId, foreignPersonaId, KnowledgeCollection.SCENARIO_TRUTH, "Invalid", "Invalid");
            else ingestion.update(scenarioId, documentId, foreignPersonaId, KnowledgeCollection.SCENARIO_TRUTH, "Invalid", "Invalid");
        }).isInstanceOf(IllegalArgumentException.class);
        assertOriginalDocument();
        assertThat(ingestion.list(scenarioId)).hasSize(1);
        assertThat(audits.count()).isZero();
    }

    private UUID perform(Operation operation) {
        if (operation == Operation.ADD) return ingestion.ingest(scenarioId, personaId, KnowledgeCollection.CONSULTING_PRACTICE, "Changed document", "First passage\n\nSecond passage");
        if (operation == Operation.UPDATE) ingestion.update(scenarioId, documentId, personaId, KnowledgeCollection.CONSULTING_PRACTICE, "Changed document", "First passage\n\nSecond passage");
        else ingestion.delete(scenarioId, documentId);
        return documentId;
    }

    private List<String> chunkContents(UUID id) {
        return jdbc.queryForList("SELECT content FROM document_chunks WHERE document_id = ? ORDER BY chunk_index", String.class, id);
    }

    private void assertOriginalDocument() {
        var document = documents.findById(documentId).orElseThrow();
        assertThat(document.getTitle()).isEqualTo("Original document");
        assertThat(document.getSourceText()).isEqualTo("Original passage");
        assertThat(document.getPersonaId()).isNull();
        assertThat(document.getCollection()).isEqualTo(KnowledgeCollection.SCENARIO_TRUTH);
        assertThat(chunkContents(documentId)).containsExactly("Original passage");
    }
}
