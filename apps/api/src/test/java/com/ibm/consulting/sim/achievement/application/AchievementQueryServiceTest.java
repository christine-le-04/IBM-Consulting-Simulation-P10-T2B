package com.ibm.consulting.sim.achievement.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ibm.consulting.sim.achievement.domain.Achievement;
import com.ibm.consulting.sim.achievement.domain.AchievementFactSheet;
import com.ibm.consulting.sim.achievement.domain.AchievementRepository;
import com.ibm.consulting.sim.achievement.domain.ConditionType;
import com.ibm.consulting.sim.achievement.domain.UserAchievement;
import com.ibm.consulting.sim.achievement.domain.UserAchievementRepository;
import com.ibm.consulting.sim.achievement.infrastructure.AchievementRuleCodec;

/** What a learner sees: earned badges kept, live scenario titles and availability. */
class AchievementQueryServiceTest {

    private final AchievementRepository achievements = mock(AchievementRepository.class);
    private final UserAchievementRepository unlocks = mock(UserAchievementRepository.class);
    private final AchievementFactSheetBuilder facts = mock(AchievementFactSheetBuilder.class);
    private final ScenarioLineageLookup scenarios = mock(ScenarioLineageLookup.class);
    private final AchievementRuleCodec codec = new AchievementRuleCodec(new ObjectMapper());
    private AchievementQueryService service;

    private final UUID learner = UUID.randomUUID();
    private final UUID lineage = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new AchievementQueryService(achievements, unlocks, facts, codec, new AchievementRuleMapper(), scenarios);
        when(facts.build(learner)).thenReturn(new AchievementFactSheet(2, 1, 70, 65.0, 2, 50.0, Map.of()));
        when(unlocks.findByUserId(learner)).thenReturn(List.of());
    }

    private Achievement completeRuns(String name, int runs) {
        return Achievement.create(name, "", "flag",
                codec.encode(ConditionNode.leaf(ConditionType.MIN_ENGAGEMENTS_COMPLETED, null, runs)));
    }

    @Test
    void anEarnedBadgeStaysVisibleAfterAnAdminDeactivatesIt() {
        Achievement earned = completeRuns("First run", 1);
        Achievement unearned = completeRuns("Ten runs", 10);
        earned.deactivate();
        unearned.deactivate();
        UserAchievement unlock = UserAchievement.unlock(learner, earned.getId());
        when(unlocks.findByUserId(learner)).thenReturn(List.of(unlock));
        when(achievements.findAll()).thenReturn(List.of(earned, unearned));

        List<AchievementSummary> shown = service.listForUser(learner);

        assertThat(shown).extracting(AchievementSummary::name).containsExactly("First run");
        assertThat(shown.getFirst().unlocked()).isTrue();
    }

    @Test
    void anExclusiveBadgeShowsItsScenariosLiveTitleAndScopedProgress() {
        Achievement exclusive = completeRuns("Rostering pro", 2);
        exclusive.assignToScenario(lineage, "Old title");
        when(achievements.findAll()).thenReturn(List.of(exclusive));
        when(scenarios.current(lineage)).thenReturn(Optional.of(
                new ScenarioLineageLookup.CurrentRevision(UUID.randomUUID(), "AeroVector: crew rostering", true)));
        when(facts.build(learner, lineage)).thenReturn(new AchievementFactSheet(1, 0, 60, 60.0, 1, 0.0, Map.of()));

        AchievementSummary shown = service.listForUser(learner).getFirst();

        assertThat(shown.scope()).isEqualTo(AchievementScope.EXCLUSIVE);
        assertThat(shown.scenarioTitle()).isEqualTo("AeroVector: crew rostering");
        assertThat(shown.available()).isTrue();
        assertThat(shown.progressPercent()).isEqualTo(50.0);
    }

    @Test
    void anExclusiveBadgeIsUnavailableWhileItsScenarioIsArchived() {
        Achievement exclusive = completeRuns("Rostering pro", 1);
        exclusive.assignToScenario(lineage, "AeroVector: crew rostering");
        when(achievements.findAll()).thenReturn(List.of(exclusive));
        when(scenarios.current(lineage)).thenReturn(Optional.of(
                new ScenarioLineageLookup.CurrentRevision(UUID.randomUUID(), "AeroVector: crew rostering", false)));
        when(facts.build(learner, lineage)).thenReturn(AchievementFactSheet.empty());

        assertThat(service.listForUser(learner).getFirst().available()).isFalse();
    }

    @Test
    void theTitleSnapshotIsOnlyUsedWhenTheScenarioNoLongerResolves() {
        Achievement exclusive = completeRuns("Rostering pro", 1);
        exclusive.assignToScenario(lineage, "AeroVector: crew rostering");
        when(achievements.findAll()).thenReturn(List.of(exclusive));
        when(scenarios.current(lineage)).thenReturn(Optional.empty());
        when(facts.build(learner, lineage)).thenReturn(AchievementFactSheet.empty());

        AchievementSummary shown = service.listForUser(learner).getFirst();

        assertThat(shown.scenarioTitle()).isEqualTo("AeroVector: crew rostering");
        assertThat(shown.available()).isFalse();
    }

    @Test
    void aGenericBadgeHasNoScenarioAndIsAlwaysAvailable() {
        when(achievements.findAll()).thenReturn(List.of(completeRuns("First run", 1)));

        AchievementSummary shown = service.listForUser(learner).getFirst();

        assertThat(shown.scope()).isEqualTo(AchievementScope.GENERIC);
        assertThat(shown.scenarioTitle()).isNull();
        assertThat(shown.available()).isTrue();
    }
}
