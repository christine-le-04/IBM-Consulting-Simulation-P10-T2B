package com.ibm.consulting.sim.lead.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ibm.consulting.sim.engagement.domain.Engagement;
import com.ibm.consulting.sim.engagement.domain.EngagementRepository;
import com.ibm.consulting.sim.lead.domain.Lead;
import com.ibm.consulting.sim.lead.domain.LeadDifficulty;
import com.ibm.consulting.sim.lead.domain.LeadRepository;
import com.ibm.consulting.sim.lead.domain.ResearchEvidenceRepository;
import com.ibm.consulting.sim.scenario.application.DifficultyProfileService;
import com.ibm.consulting.sim.scenario.application.ScenarioAuthoringConfigService;
import com.ibm.consulting.sim.scenario.domain.DifficultyLevel;
import com.ibm.consulting.sim.scenario.domain.DifficultyProfile;
import com.ibm.consulting.sim.scenario.domain.Scenario;
import com.ibm.consulting.sim.scenario.domain.ScenarioRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LeadDifficultySelectionTest {
    @Test
    void selectingALeadFreezesItsNumericProfileAndReselectionDoesNotResolveAgain() throws Exception {
        UUID userId = UUID.randomUUID();
        Scenario scenario = Scenario.create("Scenario", "Technology", "Description", 3);
        Lead lead = Lead.create(scenario.getId(), "Example Co", "Technology", "Description", LeadDifficulty.HARD);
        ScenarioRepository scenarios = mock(ScenarioRepository.class);
        LeadRepository leads = mock(LeadRepository.class);
        EngagementRepository engagements = mock(EngagementRepository.class);
        ObjectMapper mapper = new ObjectMapper();
        DifficultyProfileService difficulty = new DifficultyProfileService(mapper, scenarios, leads);
        Engagement engagement = Engagement.start(userId, scenario.getId(), UUID.randomUUID(),
                difficulty.snapshot(difficulty.forScenario(scenario)));
        when(engagements.findByIdAndUserIdForUpdate(engagement.getId(), userId)).thenReturn(Optional.of(engagement));
        when(leads.findById(lead.getId())).thenReturn(Optional.of(lead));
        when(scenarios.findById(scenario.getId())).thenReturn(Optional.of(scenario));
        LeadService service = new LeadService(leads, mock(ResearchEvidenceRepository.class), engagements,
                difficulty, scenarios, mock(ScenarioAuthoringConfigService.class));

        service.selectLead(engagement.getId(), lead.getId(), userId);
        String snapshot = engagement.getDifficultyProfileSnapshot();
        service.selectLead(engagement.getId(), lead.getId(), userId);

        assertThat(mapper.readValue(snapshot, DifficultyProfile.class))
                .isEqualTo(DifficultyProfile.defaults(DifficultyLevel.HARD, 3, 3, 3));
        assertThat(engagement.getDifficultyProfileSnapshot()).isEqualTo(snapshot);
        verify(leads, times(1)).findById(lead.getId());
        verify(engagements, times(1)).save(engagement);
    }
}
