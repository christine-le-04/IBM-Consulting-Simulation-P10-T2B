package com.ibm.consulting.sim.scenario.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ibm.consulting.sim.knowledge.application.KnowledgeIngestionService;
import com.ibm.consulting.sim.lead.domain.EvidenceType;
import com.ibm.consulting.sim.lead.domain.Lead;
import com.ibm.consulting.sim.lead.domain.LeadDifficulty;
import com.ibm.consulting.sim.lead.domain.LeadRepository;
import com.ibm.consulting.sim.scenario.domain.CanonicalFact;
import com.ibm.consulting.sim.scenario.domain.DifficultyProfile;
import com.ibm.consulting.sim.scenario.domain.RevealRule;
import com.ibm.consulting.sim.scenario.domain.RevealTarget;
import com.ibm.consulting.sim.scenario.domain.Scenario;
import com.ibm.consulting.sim.scenario.domain.ScenarioAuthoringConfig;
import com.ibm.consulting.sim.scenario.domain.ScenarioRepository;
import com.ibm.consulting.sim.scenario.domain.ScenarioStatus;
import com.ibm.consulting.sim.shared.domain.NotFoundException;
import com.ibm.consulting.sim.shared.infrastructure.observability.AuditAction;
import com.ibm.consulting.sim.shared.infrastructure.observability.AuditLogger;

/**
 * Admin scenario lifecycle through {@link ScenarioService}: create → edit →
 * publish (with readiness) → delete, plus the one-company-profile rule.
 * Uses the real authoring-config service so readiness is computed exactly as
 * in production; repositories are mocks.
 */
class ScenarioLifecycleServiceTest {

    private final ScenarioRepository scenarioRepository = mock(ScenarioRepository.class);
    private final LeadRepository leadRepository = mock(LeadRepository.class);
    private final DifficultyProfileService difficultyProfileService = mock(DifficultyProfileService.class);
    private final ScenarioAuthoringConfigService authoringConfigService = new ScenarioAuthoringConfigService(new ObjectMapper());
    private final AuditLogger auditLogger = mock(AuditLogger.class);
    private ScenarioService service;

    @BeforeEach
    void setUp() {
        service = new ScenarioService(scenarioRepository, difficultyProfileService, authoringConfigService,
                leadRepository, mock(KnowledgeIngestionService.class), auditLogger);
        when(difficultyProfileService.forScenario(any(Scenario.class))).thenAnswer(invocation -> {
            Scenario scenario = invocation.getArgument(0);
            return DifficultyProfile.defaults(scenario.getDifficulty(), scenario.getInformationAmbiguity(),
                    scenario.getStakeholderComplexity(), scenario.getCommercialPressure());
        });
        when(scenarioRepository.save(any(Scenario.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(leadRepository.save(any(Lead.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(leadRepository.findByScenarioId(any())).thenReturn(List.of());
    }

    // ─── Create ───────────────────────────────────────────────────────────

    @Test
    void createSavesANewDraftAndRecordsAnAuditEntry() {
        ScenarioSummary created = service.create(new CreateScenarioRequest("Retail turnaround", "Retail", "Description", 3));

        ArgumentCaptor<Scenario> saved = ArgumentCaptor.forClass(Scenario.class);
        verify(scenarioRepository).save(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo(ScenarioStatus.DRAFT);
        assertThat(saved.getValue().getContentVersion()).isEqualTo(1);
        assertThat(created.id()).isEqualTo(saved.getValue().getId());
        assertThat(created.status()).isEqualTo("DRAFT");
        verify(auditLogger).recordAdmin(AuditAction.ADMIN_SCENARIO_CREATED, "SCENARIO", created.id().toString());
    }

    // ─── Publish ──────────────────────────────────────────────────────────

    @Test
    void publishMakesAReadyDraftLiveAndRetiresThePreviousLiveRevision() {
        Scenario previous = makeReady(Scenario.create("Retail turnaround", "Retail", "Description", 3));
        previous.publish();
        Scenario revision = makeReady(previous.createRevision());
        stubLineage(revision, List.of(previous, revision));
        when(leadRepository.findByScenarioId(revision.getId())).thenReturn(List.of(completeLead(revision.getId())));

        ScenarioSummary published = service.publish(revision.getId());

        assertThat(published.status()).isEqualTo("ACTIVE");
        assertThat(revision.getStatus()).isEqualTo(ScenarioStatus.ACTIVE);
        assertThat(previous.getStatus()).isEqualTo(ScenarioStatus.ARCHIVED);
        // The old revision must be flushed as archived before the new one is saved as
        // ACTIVE, or the "one live revision per lineage" index would reject the update.
        InOrder order = inOrder(scenarioRepository);
        order.verify(scenarioRepository).flush();
        order.verify(scenarioRepository).save(revision);
        verify(auditLogger).recordAdmin(AuditAction.ADMIN_SCENARIO_PUBLISHED, "SCENARIO", revision.getId().toString());
    }

    @Test
    void publishBlocksAnIncompleteDraftAndChangesNothing() {
        Scenario draft = Scenario.create("Empty draft", "Retail", "Description", 3);
        stubLineage(draft, List.of(draft));

        assertThatThrownBy(() -> service.publish(draft.getId()))
                .isInstanceOf(ScenarioNotReadyException.class)
                .hasMessageContaining("Add at least one client persona.")
                .hasMessageContaining("Add the company profile.");

        assertThat(draft.getStatus()).isEqualTo(ScenarioStatus.DRAFT);
        verify(scenarioRepository, never()).save(any());
        verify(auditLogger, never()).recordAdmin(eq(AuditAction.ADMIN_SCENARIO_PUBLISHED), anyString(), anyString());
    }

    @Test
    void publishingAnAlreadyLiveRevisionIsRejected() {
        Scenario live = makeReady(Scenario.create("Retail turnaround", "Retail", "Description", 3));
        live.publish();
        stubLineage(live, List.of(live));
        when(leadRepository.findByScenarioId(live.getId())).thenReturn(List.of(completeLead(live.getId())));

        assertThatThrownBy(() -> service.publish(live.getId()))
                .isInstanceOf(Scenario.ScenarioNotEditableException.class);
        verify(auditLogger, never()).recordAdmin(eq(AuditAction.ADMIN_SCENARIO_PUBLISHED), anyString(), anyString());
    }

    @Test
    void publishingAnUnknownScenarioIsNotFound() {
        UUID missing = UUID.randomUUID();
        when(scenarioRepository.findLineageIdById(missing)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.publish(missing)).isInstanceOf(NotFoundException.class);
    }

    // ─── Delete (archive) ─────────────────────────────────────────────────

    @Test
    void deletingADraftArchivesItAndRecordsAnAuditEntry() {
        Scenario draft = Scenario.create("Abandoned draft", "Retail", "Description", 3);
        when(scenarioRepository.findById(draft.getId())).thenReturn(Optional.of(draft));

        ScenarioSummary archived = service.archive(draft.getId());

        assertThat(archived.status()).isEqualTo("ARCHIVED");
        verify(scenarioRepository).save(draft);
        verify(auditLogger).recordAdmin(AuditAction.ADMIN_SCENARIO_ARCHIVED, "SCENARIO", draft.getId().toString());
    }

    @Test
    void deletingAnUnknownScenarioIsNotFoundAndNotAudited() {
        UUID missing = UUID.randomUUID();
        when(scenarioRepository.findById(missing)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.archive(missing)).isInstanceOf(NotFoundException.class);
        verify(auditLogger, never()).recordAdmin(eq(AuditAction.ADMIN_SCENARIO_ARCHIVED), anyString(), anyString());
    }

    // ─── Edit (drafts only) ───────────────────────────────────────────────

    @Test
    void blueprintUpdateEditsADraftAndFillsBlankProblemFieldsFromTheBriefing() {
        Scenario draft = Scenario.create("Old title", "Retail", "Old description", 3);
        when(scenarioRepository.findById(draft.getId())).thenReturn(Optional.of(draft));

        ScenarioAuthoringView view = service.updateBlueprint(draft.getId(), new UpdateScenarioBlueprintRequest(
                "New title", "Utilities", "New description", 4,
                "Lead consultant", "Agree a pilot", List.of("Pilot agreed"), 20,
                "  ", null, "", null,
                2, 3, 4));

        assertThat(draft.getTitle()).isEqualTo("New title");
        assertThat(draft.getIndustry()).isEqualTo("Utilities");
        assertThat(draft.getObjective()).isEqualTo("Agree a pilot");
        assertThat(draft.getSimulatedDays()).isEqualTo(20);
        assertThat(draft.getBusinessSituation()).isEqualTo("New description");
        assertThat(draft.getObservableSymptom()).isEqualTo("New description");
        assertThat(draft.getConsultingMandate()).isEqualTo("Agree a pilot");
        assertThat(draft.getUnknownsToValidate()).containsExactly("Pilot agreed");
        assertThat(draft.getInformationAmbiguity()).isEqualTo(2);
        assertThat(draft.getStakeholderComplexity()).isEqualTo(3);
        assertThat(draft.getCommercialPressure()).isEqualTo(4);
        assertThat(view.scenario().title()).isEqualTo("New title");
        verify(auditLogger).recordAdmin(AuditAction.ADMIN_SCENARIO_BLUEPRINT_UPDATED, "SCENARIO", draft.getId().toString());
    }

    @Test
    void blueprintUpdateIsRejectedForALiveScenario() {
        Scenario live = Scenario.create("Live title", "Retail", "Description", 3);
        live.publish();
        when(scenarioRepository.findById(live.getId())).thenReturn(Optional.of(live));

        assertThatThrownBy(() -> service.updateBlueprint(live.getId(), new UpdateScenarioBlueprintRequest(
                "Changed", "Retail", "Description", 3, null, "Objective", List.of(), 10,
                null, null, null, null, 3, 3, 3)))
                .isInstanceOf(Scenario.ScenarioNotEditableException.class);

        assertThat(live.getTitle()).isEqualTo("Live title");
        verify(scenarioRepository, never()).save(any());
        verify(auditLogger, never()).recordAdmin(eq(AuditAction.ADMIN_SCENARIO_BLUEPRINT_UPDATED), anyString(), anyString());
    }

    @Test
    void authoringConfigIsSavedOnADraftAndCountsTowardsReadiness() {
        Scenario draft = Scenario.create("Draft", "Retail", "Description", 3);
        when(scenarioRepository.findById(draft.getId())).thenReturn(Optional.of(draft));

        ScenarioAuthoringView view = service.updateAuthoringConfig(draft.getId(), readyConfig());

        assertThat(view.readiness().canonicalFactCount()).isEqualTo(1);
        assertThat(view.readiness().revealRuleCount()).isEqualTo(1);
        verify(scenarioRepository).save(draft);
        verify(auditLogger).recordAdmin(AuditAction.ADMIN_SCENARIO_AUTHORING_CONFIG_CHANGED, "SCENARIO", draft.getId().toString());
    }

    @Test
    void authoringConfigCannotChangeOnALiveScenario() {
        Scenario live = Scenario.create("Live", "Retail", "Description", 3);
        live.publish();
        when(scenarioRepository.findById(live.getId())).thenReturn(Optional.of(live));

        assertThatThrownBy(() -> service.updateAuthoringConfig(live.getId(), readyConfig()))
                .isInstanceOf(Scenario.ScenarioNotEditableException.class);
        verify(scenarioRepository, never()).save(any());
    }

    // ─── Readiness ────────────────────────────────────────────────────────

    @Test
    void authoringViewReportsAReadyDraftWithNoBlockers() {
        Scenario draft = makeReady(Scenario.create("Ready", "Retail", "Description", 3));
        when(scenarioRepository.findById(draft.getId())).thenReturn(Optional.of(draft));
        when(leadRepository.findByScenarioId(draft.getId())).thenReturn(List.of(completeLead(draft.getId())));

        ScenarioAuthoringView.Readiness readiness = service.authoringView(draft.getId()).readiness();

        assertThat(readiness.readyToPublish()).isTrue();
        assertThat(readiness.blockers()).isEmpty();
        assertThat(readiness.personaCount()).isEqualTo(1);
        assertThat(readiness.leadCount()).isEqualTo(1);
    }

    @Test
    void authoringViewListsEveryMissingPieceOfAnEmptyDraft() {
        Scenario draft = Scenario.create("Empty", "Retail", "Description", 3);
        when(scenarioRepository.findById(draft.getId())).thenReturn(Optional.of(draft));

        ScenarioAuthoringView.Readiness readiness = service.authoringView(draft.getId()).readiness();

        assertThat(readiness.readyToPublish()).isFalse();
        assertThat(readiness.blockers()).contains(
                "Add at least one client persona.",
                "Add the company profile.",
                "Define the learner objective.",
                "Add scenario-approved canonical facts.",
                "Define intelligence reveal rules.",
                "Save competency rubric weights.");
    }

    // ─── Company profile (lead): one per scenario, drafts only ────────────

    @Test
    void theFirstCompanyProfileIsCreatedOnADraft() {
        Scenario draft = Scenario.create("Draft", "Retail", "Description", 3);
        when(scenarioRepository.findById(draft.getId())).thenReturn(Optional.of(draft));

        service.createLead(draft.getId(), leadRequest());

        ArgumentCaptor<Lead> saved = ArgumentCaptor.forClass(Lead.class);
        verify(leadRepository).save(saved.capture());
        assertThat(saved.getValue().getScenarioId()).isEqualTo(draft.getId());
        assertThat(saved.getValue().getCompanyName()).isEqualTo("Example Corp");
        assertThat(saved.getValue().getSignals()).hasSize(1);
    }

    @Test
    void aSecondCompanyProfileIsRejected() {
        Scenario draft = Scenario.create("Draft", "Retail", "Description", 3);
        when(scenarioRepository.findById(draft.getId())).thenReturn(Optional.of(draft));
        when(leadRepository.findByScenarioId(draft.getId())).thenReturn(List.of(completeLead(draft.getId())));

        assertThatThrownBy(() -> service.createLead(draft.getId(), leadRequest()))
                .isInstanceOf(ScenarioService.CompanyProfileExistsException.class);
        verify(leadRepository, never()).save(any());
    }

    @Test
    void companyProfilesCannotBeAddedOrEditedOnALiveScenario() {
        Scenario live = Scenario.create("Live", "Retail", "Description", 3);
        live.publish();
        when(scenarioRepository.findById(live.getId())).thenReturn(Optional.of(live));

        assertThatThrownBy(() -> service.createLead(live.getId(), leadRequest()))
                .isInstanceOf(Scenario.ScenarioNotEditableException.class);
        assertThatThrownBy(() -> service.updateLead(live.getId(), UUID.randomUUID(), leadRequest()))
                .isInstanceOf(Scenario.ScenarioNotEditableException.class);
        verify(leadRepository, never()).save(any());
    }

    @Test
    void aLeadFromAnotherScenarioCannotBeEditedThroughThisOne() {
        Scenario draft = Scenario.create("Draft", "Retail", "Description", 3);
        Lead foreign = completeLead(UUID.randomUUID());
        UUID missingLead = UUID.randomUUID();
        when(scenarioRepository.findById(draft.getId())).thenReturn(Optional.of(draft));
        when(leadRepository.findById(foreign.getId())).thenReturn(Optional.of(foreign));
        when(leadRepository.findById(missingLead)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateLead(draft.getId(), foreign.getId(), leadRequest()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.updateLead(draft.getId(), missingLead, leadRequest()))
                .isInstanceOf(NotFoundException.class);
        verify(leadRepository, never()).save(any());
    }

    // ─── Fixtures ─────────────────────────────────────────────────────────

    /** Fills in everything readiness checks, except the company profile (mocked per test). */
    private Scenario makeReady(Scenario scenario) {
        scenario.updateBriefing("Consultant", "Deliver a grounded recommendation", List.of("Evidence used"), 10);
        scenario.updateProblemBriefing(
                "The client must modernise a critical workflow.",
                "Delivery delays are affecting business outcomes.",
                "Validate the causes and recommend a grounded response.",
                List.of("Which constraint is driving the delays?"));
        scenario.updateRubricWeights(Map.of("Communication", 100));
        scenario.addPersona("Client", "CIO", "Example Corp", "Direct", "Delivery risk", "Budget", "Modernise");
        authoringConfigService.update(scenario, readyConfig());
        return scenario;
    }

    private static ScenarioAuthoringConfig readyConfig() {
        return new ScenarioAuthoringConfig(
                List.of(new CanonicalFact("fact-1", "Constraint", "Budget is capped", EvidenceType.FINANCIAL_SIGNAL, true)),
                List.of(new RevealRule(RevealTarget.BUDGET_SIGNAL, Set.of(EvidenceType.FINANCIAL_SIGNAL), 1)));
    }

    private static Lead completeLead(UUID scenarioId) {
        Lead lead = Lead.create(scenarioId, "Example Corp", "Technology", "Modernisation opportunity", LeadDifficulty.MEDIUM);
        lead.configure("Example Corp", "Technology", "Modernisation opportunity", LeadDifficulty.MEDIUM,
                "$100K-$250K", "Chief Information Officer", "Cloud platform", "Funding available", "High",
                List.of(new Lead.SignalInput("Transformation programme announced", "OPPORTUNITY")));
        return lead;
    }

    private static LeadAuthoringRequest leadRequest() {
        return new LeadAuthoringRequest("Example Corp", "Technology", "Modernisation opportunity", LeadDifficulty.MEDIUM,
                "$100K-$250K", "Chief Information Officer", "Cloud platform", "Funding available", "High",
                List.of(new LeadAuthoringRequest.Signal("Transformation programme announced", "OPPORTUNITY")));
    }

    private void stubLineage(Scenario target, List<Scenario> lineage) {
        UUID lineageId = target.getScenarioLineageId();
        when(scenarioRepository.findLineageIdById(target.getId())).thenReturn(Optional.of(lineageId));
        when(scenarioRepository.findByIdForUpdate(lineageId)).thenReturn(Optional.of(lineage.getFirst()));
        when(scenarioRepository.findLineageForUpdate(lineageId)).thenReturn(lineage);
    }
}
