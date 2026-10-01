package com.ibm.consulting.sim.engagement.application;

import com.ibm.consulting.sim.engagement.domain.Engagement;
import com.ibm.consulting.sim.engagement.domain.EngagementRepository;
import com.ibm.consulting.sim.lead.domain.EvidenceOrigin;
import com.ibm.consulting.sim.lead.domain.EvidenceType;
import com.ibm.consulting.sim.lead.domain.Lead;
import com.ibm.consulting.sim.lead.domain.LeadRepository;
import com.ibm.consulting.sim.lead.domain.LeadSignal;
import com.ibm.consulting.sim.lead.domain.ResearchEvidence;
import com.ibm.consulting.sim.lead.domain.ResearchEvidenceRepository;
import com.ibm.consulting.sim.scenario.domain.Persona;
import com.ibm.consulting.sim.scenario.domain.Scenario;
import com.ibm.consulting.sim.scenario.domain.ScenarioRepository;
import com.ibm.consulting.sim.scenario.domain.ScenarioStatus;
import com.ibm.consulting.sim.scenario.application.DifficultyProfileService;
import com.ibm.consulting.sim.shared.domain.DomainException;
import com.ibm.consulting.sim.shared.domain.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;


@Service
public class StartEngagementUseCase {

    private final EngagementRepository engagementRepository;
    private final ScenarioRepository scenarioRepository;
    private final DifficultyProfileService difficultyProfileService;
    private final LeadRepository leadRepository;
    private final ResearchEvidenceRepository evidenceRepository;

    public StartEngagementUseCase(EngagementRepository engagementRepository,
                                  ScenarioRepository scenarioRepository,
                                  DifficultyProfileService difficultyProfileService,
                                  LeadRepository leadRepository,
                                  ResearchEvidenceRepository evidenceRepository) {
        this.engagementRepository = engagementRepository;
        this.scenarioRepository = scenarioRepository;
        this.difficultyProfileService = difficultyProfileService;
        this.leadRepository = leadRepository;
        this.evidenceRepository = evidenceRepository;
    }

    /** Starts an engagement using the first persona defined for the scenario. */
    @Transactional
    public EngagementResponse execute(UUID userId, UUID scenarioId) {
        return execute(userId, scenarioId, null);
    }

    /**
     * Starts a scenario straight into research: there is no "choose a lead" step.
     * The scenario's company profile is opened automatically and
     * its public signals become starting evidence. The AI client is the scenario's
     * decision maker; the learner chooses who to contact after research.
     * {@code personaId} is only honoured for older clients that still send it.
     */
    @Transactional
    public EngagementResponse execute(UUID userId, UUID scenarioId, UUID personaId) {
        var scenario = scenarioRepository.findById(scenarioId)
                .orElseThrow(() -> new NotFoundException("Scenario", scenarioId));
        if (scenario.getStatus() != ScenarioStatus.ACTIVE) {
            throw new ScenarioUnavailableException(scenarioId);
        }

        Persona persona = resolveClient(scenario, personaId);

        Engagement engagement = Engagement.start(userId, scenarioId, persona.getId(),
                difficultyProfileService.snapshot(difficultyProfileService.forScenario(scenario)));

        Optional<Lead> companyProfile = companyProfileOf(scenario);
        companyProfile.ifPresent(lead -> engagement.selectLead(lead.getId()));
        engagementRepository.save(engagement);
        companyProfile.ifPresent(lead -> addStartingEvidence(engagement.getId(), lead));
        return EngagementResponse.from(engagement);
    }

    /** The decision maker, unless an older client asked for a specific persona. */
    private Persona resolveClient(Scenario scenario, UUID personaId) {
        if (personaId != null) {
            return scenario.getPersonas().stream()
                    .filter(p -> p.getId().equals(personaId))
                    .findFirst()
                    .orElseThrow(() -> new PersonaNotInScenarioException(personaId, scenario.getId()));
        }
        return scenario.decisionMaker()
                .or(() -> scenario.getPersonas().stream().findFirst())
                .orElseThrow(() -> new NotFoundException("Persona for scenario", scenario.getId()));
    }

    /** Each scenario has exactly one company profile (enforced by the database since V53). */
    private Optional<Lead> companyProfileOf(Scenario scenario) {
        return leadRepository.findByScenarioId(scenario.getId()).stream().findFirst();
    }

    /** The briefing's public signals, as citable evidence that doesn't count toward completing research. */
    private void addStartingEvidence(UUID engagementId, Lead lead) {
        List<LeadSignal> signals = lead.getSignals();
        for (int i = 0; i < signals.size(); i++) {
            LeadSignal signal = signals.get(i);
            evidenceRepository.save(ResearchEvidence.builder()
                    .engagementId(engagementId)
                    .leadId(lead.getId())
                    .note(signal.getLabel())
                    .evidenceType("BUSINESS_TRIGGER".equals(signal.getCategory())
                            ? EvidenceType.COMPANY_NEWS : EvidenceType.OTHER)
                    .sourceTitle("Scenario briefing")
                    .origin(EvidenceOrigin.SCENARIO_GIVEN)
                    .sequenceNo(i + 1)
                    .build());
        }
    }

    /**
     * Starts from a catalogue lead in one atomic operation. The selected lead
     * remains scenario-bound, so catalogue browsing cannot bypass canonical
     * scenario truth or the engagement state machine.
     */
    @Transactional
    public EngagementResponse executeForLead(UUID userId, UUID leadId, UUID personaId) {
        var lead = leadRepository.findById(leadId).orElseThrow(() -> new NotFoundException("Lead", leadId));
        var scenario = scenarioRepository.findById(lead.getScenarioId())
                .orElseThrow(() -> new NotFoundException("Scenario", lead.getScenarioId()));
        if (scenario.getStatus() != ScenarioStatus.ACTIVE) {
            throw new ScenarioUnavailableException(scenario.getId());
        }

        Persona persona = resolveClient(scenario, personaId);

        Engagement engagement = Engagement.start(userId, scenario.getId(), persona.getId(),
            difficultyProfileService.snapshot(difficultyProfileService.forLeadDifficulty(
                difficultyProfileService.forScenario(scenario), lead.getDifficulty())));
        engagement.selectLead(lead.getId());
        engagementRepository.save(engagement);
        return EngagementResponse.from(engagement);
    }

    public static class PersonaNotInScenarioException extends DomainException {
        public PersonaNotInScenarioException(UUID personaId, UUID scenarioId) {
            super("Persona " + personaId + " does not belong to scenario " + scenarioId);
        }
    }

    public static class ScenarioUnavailableException extends DomainException {
        public ScenarioUnavailableException(UUID scenarioId) {
            super("Scenario " + scenarioId + " is not published for new engagements");
        }
    }
}
