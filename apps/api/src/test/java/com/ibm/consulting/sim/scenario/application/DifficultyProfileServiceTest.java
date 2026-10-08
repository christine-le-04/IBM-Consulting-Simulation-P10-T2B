package com.ibm.consulting.sim.scenario.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ibm.consulting.sim.engagement.domain.Engagement;
import com.ibm.consulting.sim.lead.domain.Lead;
import com.ibm.consulting.sim.lead.domain.LeadDifficulty;
import com.ibm.consulting.sim.lead.domain.LeadRepository;
import com.ibm.consulting.sim.scenario.domain.DifficultyLevel;
import com.ibm.consulting.sim.scenario.domain.DifficultyProfile;
import com.ibm.consulting.sim.scenario.domain.Scenario;
import com.ibm.consulting.sim.scenario.domain.ScenarioRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class DifficultyProfileServiceTest {
    private final ScenarioRepository scenarios = mock(ScenarioRepository.class);
    private final LeadRepository leads = mock(LeadRepository.class);
    private final DifficultyProfileService service = new DifficultyProfileService(new ObjectMapper(), scenarios, leads);

    @Test
    void selectedTierUsesScenarioDimensionsAndPreservesCustomTuning() {
        Scenario scenario = Scenario.create("Scenario", "Technology", "Description", 3);
        scenario.updateDifficultyDimensions(5, 5, 5);
        DifficultyProfile custom = new DifficultyProfile(DifficultyLevel.MEDIUM, 5, 2, 1,
                50, 50, 50, 16, false, 18, 3, 60, 75, 65, 50, 100);

        DifficultyProfile hard = service.forLeadDifficulty(custom, LeadDifficulty.HARD, scenario);

        assertThat(hard.meetingTurnLimit()).isEqualTo(16);
        assertThat(hard.scoringTolerance()).isEqualTo(85);
        assertThat(hard.personaResistance()).isEqualTo(75);
        assertThat(hard.contradictionCount()).isEqualTo(4);
        assertThat(hard.timelinePressureDays()).isEqualTo(10);
    }

    @Test
    void savedSnapshotIsAuthoritativeWithoutReadingTheCurrentLeadOrScenario() {
        DifficultyProfile saved = DifficultyProfile.defaults(DifficultyLevel.EASY, 3, 3, 3);
        Engagement engagement = Engagement.start(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), service.snapshot(saved));
        engagement.selectLead(UUID.randomUUID());

        assertThat(service.forEngagement(engagement)).isEqualTo(saved);
        verifyNoInteractions(scenarios, leads);
    }

    @Test
    void invalidSnapshotIsRejectedRatherThanReplacingItWithLiveSettings() {
        Engagement engagement = Engagement.start(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), "invalid json");

        assertThatThrownBy(() -> service.forEngagement(engagement))
                .isInstanceOf(DifficultyProfileService.InvalidDifficultyProfileException.class);
        verifyNoInteractions(scenarios, leads);
    }

    @Test
    void legacyRunWithoutSnapshotResolvesItsSelectedTier() {
        Scenario scenario = Scenario.create("Scenario", "Technology", "Description", 3);
        Lead lead = Lead.create(scenario.getId(), "Example Co", "Technology", "Description", LeadDifficulty.EASY);
        Engagement engagement = Engagement.start(UUID.randomUUID(), scenario.getId(), UUID.randomUUID(), " ");
        engagement.selectLead(lead.getId());
        when(scenarios.findById(scenario.getId())).thenReturn(Optional.of(scenario));
        when(leads.findById(lead.getId())).thenReturn(Optional.of(lead));

        assertThat(service.forEngagement(engagement))
                .isEqualTo(DifficultyProfile.defaults(DifficultyLevel.EASY, 3, 3, 3));
    }

    @Test
    void legacyRunWithoutASelectedLeadRetainsItsScenarioProfile() {
        Scenario scenario = Scenario.create("Scenario", "Technology", "Description", 3);
        Engagement engagement = Engagement.start(UUID.randomUUID(), scenario.getId(), UUID.randomUUID());
        when(scenarios.findById(scenario.getId())).thenReturn(Optional.of(scenario));

        assertThat(service.forEngagement(engagement)).isEqualTo(service.forScenario(scenario));
        verifyNoInteractions(leads);
    }
}
