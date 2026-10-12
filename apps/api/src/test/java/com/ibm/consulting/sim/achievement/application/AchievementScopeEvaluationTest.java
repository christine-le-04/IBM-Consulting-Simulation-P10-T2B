package com.ibm.consulting.sim.achievement.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
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
import com.ibm.consulting.sim.achievement.domain.UserAchievementRepository;
import com.ibm.consulting.sim.achievement.infrastructure.AchievementRuleCodec;

/** Generic vs Exclusive evaluation, live scenario availability, attribution and backfill. */
class AchievementScopeEvaluationTest {

    private final AchievementRepository achievements = mock(AchievementRepository.class);
    private final UserAchievementRepository unlocks = mock(UserAchievementRepository.class);
    private final AchievementFactSheetBuilder facts = mock(AchievementFactSheetBuilder.class);
    private final ScenarioLineageLookup scenarios = mock(ScenarioLineageLookup.class);
    private final AchievementRuleCodec codec = new AchievementRuleCodec(new ObjectMapper());
    private AchievementEvaluationService service;

    private final UUID learner = UUID.randomUUID();
    private final UUID lineage = UUID.randomUUID();
    private final AchievementFactSheet fiveRunsAnywhere = new AchievementFactSheet(5, 2, 80, 75.0, 3, 40.0, Map.of());

    @BeforeEach
    void setUp() {
        service = new AchievementEvaluationService(achievements, unlocks, facts, codec, new AchievementRuleMapper(), scenarios);
        when(unlocks.insertIfAbsent(any(), any(), any(), any())).thenReturn(true);
        when(facts.build(learner)).thenReturn(fiveRunsAnywhere);
    }

    private Achievement completeRuns(String name, int runs) {
        return Achievement.create(name, "", "trophy",
                codec.encode(ConditionNode.leaf(ConditionType.MIN_ENGAGEMENTS_COMPLETED, null, runs)));
    }

    private Achievement exclusive(String name, int runs, boolean scenarioLive) {
        Achievement achievement = completeRuns(name, runs);
        achievement.assignToScenario(lineage, "Crew rostering");
        when(scenarios.current(lineage)).thenReturn(Optional.of(
                new ScenarioLineageLookup.CurrentRevision(UUID.randomUUID(), "Crew rostering", scenarioLive)));
        return achievement;
    }

    @Test
    void anExclusiveBadgeOnlyCountsRunsOfItsOwnScenario() {
        Achievement generic = completeRuns("Five anywhere", 5);
        Achievement exclusive = exclusive("One here", 1, true);
        when(facts.build(learner, lineage)).thenReturn(AchievementFactSheet.empty());
        when(achievements.findAllActive()).thenReturn(List.of(generic, exclusive));

        List<Achievement> unlocked = service.evaluateForUser(learner);

        assertThat(unlocked).containsExactly(generic);
    }

    @Test
    void anExclusiveBadgeUnlocksFromRunsOfAnyRevisionOfItsScenario() {
        Achievement exclusive = exclusive("One here", 1, true);
        when(facts.build(learner, lineage)).thenReturn(new AchievementFactSheet(1, 0, 60, 60.0, 1, 0.0, Map.of()));
        when(achievements.findAllActive()).thenReturn(List.of(exclusive));

        assertThat(service.evaluateForUser(learner)).containsExactly(exclusive);
    }

    @Test
    void anExclusiveBadgeIsNotAwardedWhileItsScenarioHasNoLiveRevision() {
        Achievement exclusive = exclusive("One here", 1, false);
        when(achievements.findAllActive()).thenReturn(List.of(exclusive));

        assertThat(service.evaluateForUser(learner)).isEmpty();
        verify(facts, never()).build(learner, lineage);
        verify(unlocks, never()).insertIfAbsent(any(), any(), any(), any());
    }

    @Test
    void anUnlockRecordsTheRunThatTriggeredIt() {
        Achievement generic = completeRuns("Five anywhere", 5);
        UUID engagement = UUID.randomUUID();
        when(achievements.findAllActive()).thenReturn(List.of(generic));

        service.evaluateAfterEngagement(learner, engagement);

        verify(unlocks).insertIfAbsent(eq(learner), eq(generic.getId()), any(), eq(engagement));
    }

    @Test
    void anAlreadyEarnedBadgeIsNotEvaluatedAgain() {
        Achievement generic = completeRuns("Five anywhere", 5);
        when(achievements.findAllActive()).thenReturn(List.of(generic));
        when(unlocks.existsByUserIdAndAchievementId(learner, generic.getId())).thenReturn(true);

        assertThat(service.evaluateForUser(learner)).isEmpty();
        verify(unlocks, never()).insertIfAbsent(any(), any(), any(), any());
    }

    @Test
    void backfillAwardsOnlyLearnersWhosePastRunsQualify() {
        Achievement generic = completeRuns("Five anywhere", 5);
        UUID beginner = UUID.randomUUID();
        when(scenarios.usersWithCompletedRuns(null)).thenReturn(List.of(learner, beginner));
        when(facts.build(beginner)).thenReturn(new AchievementFactSheet(1, 0, 50, 50.0, 1, 0.0, Map.of()));

        assertThat(service.backfill(generic)).isEqualTo(1);
        verify(unlocks).insertIfAbsent(eq(learner), eq(generic.getId()), any(), eq(null));
        verify(unlocks, never()).insertIfAbsent(eq(beginner), any(), any(), any());
    }

    @Test
    void backfillOfAnExclusiveBadgeOnlyChecksLearnersWhoPlayedItsScenario() {
        Achievement exclusive = exclusive("One here", 1, true);
        when(scenarios.usersWithCompletedRuns(lineage)).thenReturn(List.of(learner));
        when(facts.build(learner, lineage)).thenReturn(new AchievementFactSheet(1, 0, 60, 60.0, 1, 0.0, Map.of()));

        assertThat(service.backfill(exclusive)).isEqualTo(1);
        verify(scenarios, never()).usersWithCompletedRuns(null);
    }

    @Test
    void backfillIgnoresInactiveBadges() {
        Achievement generic = completeRuns("Five anywhere", 5);
        generic.deactivate();

        assertThat(service.backfill(generic)).isZero();
        verify(scenarios, never()).usersWithCompletedRuns(any());
    }
}
