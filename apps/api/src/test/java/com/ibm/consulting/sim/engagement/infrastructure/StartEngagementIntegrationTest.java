package com.ibm.consulting.sim.engagement.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ibm.consulting.sim.engagement.application.StartEngagementUseCase;
import com.ibm.consulting.sim.engagement.domain.Engagement;
import com.ibm.consulting.sim.engagement.domain.EngagementRepository;
import com.ibm.consulting.sim.engagement.domain.EngagementState;
import com.ibm.consulting.sim.lead.domain.Lead;
import com.ibm.consulting.sim.lead.domain.LeadDifficulty;
import com.ibm.consulting.sim.lead.domain.EvidenceOrigin;
import com.ibm.consulting.sim.lead.domain.LeadRepository;
import com.ibm.consulting.sim.lead.domain.ResearchEvidence;
import com.ibm.consulting.sim.lead.domain.ResearchEvidenceRepository;
import com.ibm.consulting.sim.scenario.application.DifficultyProfileService;
import com.ibm.consulting.sim.scenario.domain.DifficultyLevel;
import com.ibm.consulting.sim.scenario.domain.DifficultyProfile;
import com.ibm.consulting.sim.scenario.domain.Persona;
import com.ibm.consulting.sim.scenario.domain.Scenario;
import com.ibm.consulting.sim.scenario.domain.ScenarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import org.mockito.ArgumentCaptor;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class StartEngagementIntegrationTest {

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
    private final EngagementStore engagements = new EngagementStore();
    private final ScenarioRepository scenarios = mock(ScenarioRepository.class);
    private final LeadRepository leads = mock(LeadRepository.class);
    private final ResearchEvidenceRepository evidence = mock(ResearchEvidenceRepository.class);
    private StartEngagementUseCase useCase;

    @BeforeEach
    void setUp() {
        useCase = new StartEngagementUseCase(engagements, scenarios,
                new DifficultyProfileService(objectMapper, scenarios, leads), leads, evidence);
    }

    @Test
    void startsFromAnActiveLeadAndFreezesLeadAdjustedDifficulty() throws Exception {
        UUID userId = UUID.randomUUID();
        Scenario scenario = activeScenario("Active scenario");
        Persona persona = scenario.getPersonas().getFirst();
        Lead lead = Lead.create(scenario.getId(), "Example Co", "Technology",
                "Modernisation opportunity", LeadDifficulty.HARD);
        Engagement unrelated = Engagement.start(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID());
        engagements.seed(unrelated);
        when(leads.findById(lead.getId())).thenReturn(Optional.of(lead));
        when(scenarios.findById(scenario.getId())).thenReturn(Optional.of(scenario));

        var response = useCase.executeForLead(userId, lead.getId(), persona.getId());

        assertThat(engagements.created()).hasSize(1);
        Engagement created = engagements.created().getFirst();
        assertThat(response.id()).isEqualTo(created.getId());
        assertThat(created.getUserId()).isEqualTo(userId);
        assertThat(created.getScenarioId()).isEqualTo(lead.getScenarioId());
        assertThat(created.getSelectedLeadId()).isEqualTo(lead.getId());
        assertThat(created.getPersonaId()).isEqualTo(persona.getId());
        assertThat(scenario.getPersonas()).extracting(Persona::getId).contains(created.getPersonaId());
        assertThat(created.getState()).isEqualTo(EngagementState.CLIENT_INTELLIGENCE);
        DifficultyProfile frozen = objectMapper.readValue(
                created.getDifficultyProfileSnapshot(), DifficultyProfile.class);
        assertThat(frozen.level()).isEqualTo(DifficultyLevel.HARD);
        assertThat(created.getEvents()).extracting(event -> event.getState())
                .containsExactly(EngagementState.QUALIFYING, EngagementState.CLIENT_INTELLIGENCE);
        assertThat(created.getEvents()).extracting(event -> event.getDescription())
                .containsExactly("Engagement started", "Lead selected: " + lead.getId());
        assertThat(unrelated.getState()).isEqualTo(EngagementState.QUALIFYING);
        assertThat(unrelated.getEvents()).hasSize(1);
    }

    @Test
    void nullPersonaSelectsOnlyFromTheLeadScenario() {
        UUID userId = UUID.randomUUID();
        Scenario scenario = activeScenario("Lead scenario");
        Scenario otherScenario = activeScenario("Other scenario");
        Lead lead = Lead.create(scenario.getId(), "Example Co", "Technology",
                "Modernisation opportunity", LeadDifficulty.MEDIUM);
        when(leads.findById(lead.getId())).thenReturn(Optional.of(lead));
        when(scenarios.findById(scenario.getId())).thenReturn(Optional.of(scenario));

        useCase.executeForLead(userId, lead.getId(), null);

        Engagement created = engagements.created().getFirst();
        assertThat(scenario.getPersonas()).extracting(Persona::getId).contains(created.getPersonaId());
        assertThat(otherScenario.getPersonas()).extracting(Persona::getId)
                .doesNotContain(created.getPersonaId());
    }

    @Test
    void leadFirstStartRejectsAPersonaFromAnotherScenarioWithoutSaving() {
        Scenario leadScenario = activeScenario("Lead scenario");
        Scenario otherScenario = activeScenario("Other scenario");
        Lead lead = Lead.create(leadScenario.getId(), "Example Co", "Technology",
                "Modernisation opportunity", LeadDifficulty.MEDIUM);
        Persona unrelatedPersona = otherScenario.getPersonas().getFirst();
        when(leads.findById(lead.getId())).thenReturn(Optional.of(lead));
        when(scenarios.findById(leadScenario.getId())).thenReturn(Optional.of(leadScenario));

        assertThatThrownBy(() -> useCase.executeForLead(
                UUID.randomUUID(), lead.getId(), unrelatedPersona.getId()))
                .isInstanceOf(StartEngagementUseCase.PersonaNotInScenarioException.class);

        assertThat(engagements.created()).isEmpty();
    }

    @Test
    void scenarioFirstStartRejectsAnArchivedScenarioWithoutSaving() {
        Scenario scenario = activeScenario("Archived scenario");
        scenario.archive();
        when(scenarios.findById(scenario.getId())).thenReturn(Optional.of(scenario));

        assertThatThrownBy(() -> useCase.execute(UUID.randomUUID(), scenario.getId(), null))
                .isInstanceOf(StartEngagementUseCase.ScenarioUnavailableException.class);

        assertThat(engagements.created()).isEmpty();
    }

    @Test
    void leadFirstStartRejectsAnArchivedScenarioWithoutSaving() {
        Scenario scenario = activeScenario("Archived lead scenario");
        scenario.archive();
        Lead lead = Lead.create(scenario.getId(), "Example Co", "Technology",
                "Modernisation opportunity", LeadDifficulty.MEDIUM);
        when(leads.findById(lead.getId())).thenReturn(Optional.of(lead));
        when(scenarios.findById(scenario.getId())).thenReturn(Optional.of(scenario));

        assertThatThrownBy(() -> useCase.executeForLead(UUID.randomUUID(), lead.getId(), null))
                .isInstanceOf(StartEngagementUseCase.ScenarioUnavailableException.class);

        assertThat(engagements.created()).isEmpty();
    }

    // ─── Starting straight into research (no "Choose a lead") ───

    @Test
    void startsAScenarioStraightInResearchWithItsCompanyProfile() {
        UUID userId = UUID.randomUUID();
        Scenario scenario = activeScenario("Research first");
        Lead companyProfile = Lead.create(scenario.getId(), "Example Co", "Technology",
                "Company profile", LeadDifficulty.EASY);
        when(scenarios.findById(scenario.getId())).thenReturn(Optional.of(scenario));
        when(leads.findByScenarioId(scenario.getId())).thenReturn(List.of(companyProfile));

        useCase.execute(userId, scenario.getId(), null);

        Engagement created = engagements.created().getFirst();
        assertThat(created.getState()).isEqualTo(EngagementState.CLIENT_INTELLIGENCE);
        assertThat(created.getSelectedLeadId()).isEqualTo(companyProfile.getId());
    }

    @Test
    void addsTheCompanySignalsAsStartingEvidenceThatDoesNotCountAsResearch() {
        Scenario scenario = activeScenario("Signals");
        Lead companyProfile = Lead.create(scenario.getId(), "Example Co", "Technology",
                "Company profile", LeadDifficulty.EASY);
        companyProfile.addSignal("Board review of reliability", "BUSINESS_TRIGGER");
        companyProfile.addSignal("Dispatch delays are rising", "OPERATIONAL");
        when(scenarios.findById(scenario.getId())).thenReturn(Optional.of(scenario));
        when(leads.findByScenarioId(scenario.getId())).thenReturn(List.of(companyProfile));

        useCase.execute(UUID.randomUUID(), scenario.getId(), null);

        ArgumentCaptor<ResearchEvidence> saved = ArgumentCaptor.forClass(ResearchEvidence.class);
        verify(evidence, org.mockito.Mockito.times(2)).save(saved.capture());
        assertThat(saved.getAllValues()).extracting(ResearchEvidence::getOrigin)
                .containsOnly(EvidenceOrigin.SCENARIO_GIVEN);
        assertThat(saved.getAllValues()).extracting(ResearchEvidence::getNote)
                .containsExactly("Board review of reliability", "Dispatch delays are rising");
        assertThat(saved.getAllValues()).extracting(ResearchEvidence::getSequenceNo)
                .containsExactly(1, 2);
    }

    @Test
    void usesTheDecisionMakerAsTheClientEvenWhenADistractorIsListedFirst() {
        Scenario scenario = Scenario.create("Contacts", "Technology", "Scenario description", 3);
        Persona distractor = scenario.addDistractor("Dan Whitaker", "Head of Line Maintenance", "Example Co",
                "Shift time lost to paperwork", "Not my area.", null);
        Persona decisionMaker = scenario.addPersona("Elena Vargas", "VP Asset Operations", "Example Co",
                "Direct", "Reliability", "Budget", "Delivery");
        scenario.publish();
        when(scenarios.findById(scenario.getId())).thenReturn(Optional.of(scenario));
        when(leads.findByScenarioId(scenario.getId())).thenReturn(List.of());

        useCase.execute(UUID.randomUUID(), scenario.getId(), null);

        Engagement created = engagements.created().getFirst();
        assertThat(created.getPersonaId()).isEqualTo(decisionMaker.getId()).isNotEqualTo(distractor.getId());
    }

    // ─── Not restarting a scenario already in progress ───

    @Test
    void continuesAnEngagementAlreadyInProgressInsteadOfStartingAnother() {
        UUID userId = UUID.randomUUID();
        Scenario scenario = activeScenario("Already playing");
        Engagement inProgress = Engagement.start(userId, scenario.getId(), scenario.getPersonas().getFirst().getId());
        engagements.seed(inProgress);
        when(scenarios.findById(scenario.getId())).thenReturn(Optional.of(scenario));

        var response = useCase.execute(userId, scenario.getId(), null);

        assertThat(response.id()).isEqualTo(inProgress.getId());
        assertThat(engagements.created()).isEmpty();
        verify(evidence, never()).save(any());
    }

    @Test
    void anotherLearnersEngagementOrAnotherScenarioDoesNotBlockANewStart() {
        UUID userId = UUID.randomUUID();
        Scenario scenario = activeScenario("Fresh start");
        engagements.seed(Engagement.start(UUID.randomUUID(), scenario.getId(), UUID.randomUUID()));
        engagements.seed(Engagement.start(userId, UUID.randomUUID(), UUID.randomUUID()));
        when(scenarios.findById(scenario.getId())).thenReturn(Optional.of(scenario));
        when(leads.findByScenarioId(scenario.getId())).thenReturn(List.of());

        useCase.execute(userId, scenario.getId(), null);

        assertThat(engagements.created()).hasSize(1);
    }

    private Scenario activeScenario(String title) {
        Scenario scenario = Scenario.create(title, "Technology", "Scenario description", 3);
        scenario.addPersona("Client", "CIO", title + " Co", "Direct", "Risk", "Budget", "Delivery");
        scenario.publish();
        return scenario;
    }

    private static final class EngagementStore implements EngagementRepository {
        private final List<Engagement> seeded = new ArrayList<>();
        private final List<Engagement> created = new ArrayList<>();

        void seed(Engagement engagement) { seeded.add(engagement); }
        List<Engagement> created() { return List.copyOf(created); }

        @Override public Engagement save(Engagement engagement) {
            created.add(engagement);
            return engagement;
        }
        @Override public List<Engagement> findAll() {
            return java.util.stream.Stream.concat(seeded.stream(), created.stream()).toList();
        }
        @Override public Optional<Engagement> findById(UUID id) {
            return findAll().stream().filter(engagement -> engagement.getId().equals(id)).findFirst();
        }
        @Override public List<Engagement> findByUserId(UUID userId) {
            return findAll().stream().filter(engagement -> engagement.getUserId().equals(userId)).toList();
        }
        @Override public List<Engagement> findDashboardByUserId(UUID userId) { return findByUserId(userId); }
        @Override public Optional<Engagement> findByIdAndUserId(UUID id, UUID userId) {
            return findById(id).filter(engagement -> engagement.getUserId().equals(userId));
        }
        @Override public Optional<Engagement> findByIdAndUserIdForUpdate(UUID id, UUID userId) {
            return findByIdAndUserId(id, userId);
        }
    }
}
