package com.ibm.consulting.sim.achievement.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

/** "At least N runs that each…": requirements must all hold within the same run. */
class RunConditionTest {

    private static final String RELATIONSHIP = "Relationship Building";
    private static final String SOLUTION = "Solution Alignment";

    private static RunRecord run(boolean won, int overall, int relationship, int solution, String difficulty,
                                 int meetingAttempts, boolean retry, Duration duration) {
        return new RunRecord(won, overall, Map.of(RELATIONSHIP, relationship, SOLUTION, solution),
                Map.of("OUTREACH", 1, "MEETING", meetingAttempts, "PROPOSAL", 1), difficulty, retry, duration);
    }

    private static RunCriteria criteria(Boolean won, Integer minOverall, String competency, Integer minCompetency,
                                        Integer minEvery, String minDifficulty, List<String> firstTime,
                                        Boolean notARetry, Integer maxHours) {
        return new RunCriteria(won, minOverall, competency, minCompetency, minEvery, minDifficulty, firstTime,
                notARetry, maxHours);
    }

    private static boolean satisfied(RunCriteria criteria, int runsNeeded, RunRecord... runs) {
        AchievementFactSheet facts = new AchievementFactSheet(runs.length, 0, 0, 0, 1, 0, Map.of(), List.of(runs));
        return AchievementRuleEvaluator.isSatisfied(
                new LeafCondition(ConditionType.MIN_RUNS_MATCHING, null, runsNeeded, criteria), facts);
    }

    @Test
    void requirementsMetByDifferentRunsDoNotCount() {
        RunCriteria bothEighty = criteria(null, null, null, null, 80, null, null, null, null);
        RunRecord strongRelationship = run(true, 70, 85, 60, "MEDIUM", 1, false, Duration.ofHours(1));
        RunRecord strongSolution = run(true, 70, 55, 82, "MEDIUM", 1, false, Duration.ofHours(1));

        assertThat(satisfied(bothEighty, 1, strongRelationship, strongSolution)).isFalse();
        assertThat(satisfied(bothEighty, 1, run(true, 85, 81, 83, "MEDIUM", 1, false, null))).isTrue();
    }

    @Test
    void aWinOnHardOrAboveIsNotMetByAnEasyWinOrAHardLoss() {
        RunCriteria hardWin = criteria(true, null, null, null, null, "HARD", null, null, null);

        assertThat(satisfied(hardWin, 1,
                run(true, 90, 90, 90, "EASY", 1, false, null),
                run(false, 90, 90, 90, "HARD", 1, false, null))).isFalse();
        assertThat(satisfied(hardWin, 1, run(true, 60, 60, 60, "HARD", 1, false, null))).isTrue();
    }

    @Test
    void mediumMeetsAMinimumOfEasy() {
        RunCriteria easyOrHarder = criteria(true, null, null, null, null, "EASY", null, null, null);

        assertThat(satisfied(easyOrHarder, 1, run(true, 60, 60, 60, "MEDIUM", 1, false, null))).isTrue();
    }

    @Test
    void aStagePassedFirstTimeNeedsExactlyOneAttempt() {
        RunCriteria meetingFirstTime = criteria(null, null, null, null, null, null, List.of("MEETING"), null, null);

        assertThat(satisfied(meetingFirstTime, 1, run(true, 80, 80, 80, "MEDIUM", 2, false, null))).isFalse();
        assertThat(satisfied(meetingFirstTime, 1, run(true, 80, 80, 80, "MEDIUM", 1, false, null))).isTrue();
    }

    @Test
    void olderRunsWithoutAttemptHistoryNeverCountAsFirstTime() {
        RunCriteria meetingFirstTime = criteria(null, null, null, null, null, null, List.of("MEETING"), null, null);
        RunRecord noHistory = new RunRecord(true, 80, Map.of(), Map.of(), "MEDIUM", false, null);

        assertThat(satisfied(meetingFirstTime, 1, noHistory)).isFalse();
    }

    @Test
    void retriesAndSlowRunsCanBeExcluded() {
        RunCriteria quickFirstGo = criteria(true, null, null, null, null, null, null, true, 24);

        assertThat(satisfied(quickFirstGo, 1, run(true, 80, 80, 80, "MEDIUM", 1, true, Duration.ofHours(2)))).isFalse();
        assertThat(satisfied(quickFirstGo, 1, run(true, 80, 80, 80, "MEDIUM", 1, false, Duration.ofHours(30)))).isFalse();
        assertThat(satisfied(quickFirstGo, 1, run(true, 80, 80, 80, "MEDIUM", 1, false, null))).isFalse();
        assertThat(satisfied(quickFirstGo, 1, run(true, 80, 80, 80, "MEDIUM", 1, false, Duration.ofHours(20)))).isTrue();
    }

    @Test
    void theRunCountIsHowManyRunsMustMatchAndProgressCountsTowardsIt() {
        RunCriteria win = criteria(true, null, null, null, null, null, null, null, null);
        RunRecord won = run(true, 70, 70, 70, "MEDIUM", 1, false, null);
        AchievementFactSheet twoWins = new AchievementFactSheet(2, 2, 70, 70, 1, 100, Map.of(), List.of(won, won));
        LeafCondition winThreeTimes = new LeafCondition(ConditionType.MIN_RUNS_MATCHING, null, 3, win);

        assertThat(AchievementRuleEvaluator.isSatisfied(winThreeTimes, twoWins)).isFalse();
        assertThat(AchievementRuleEvaluator.progress(winThreeTimes, twoWins)).isCloseTo(66.7, org.assertj.core.data.Offset.offset(0.1));
    }

    @Test
    void aSpecificCompetencyIsCheckedWithinTheRun() {
        RunCriteria relationshipEighty = criteria(null, null, RELATIONSHIP, 80, null, null, null, null, null);

        assertThat(satisfied(relationshipEighty, 1, run(false, 50, 80, 20, "EASY", 3, true, null))).isTrue();
        assertThat(satisfied(relationshipEighty, 1, run(true, 95, 79, 99, "HARD", 1, false, null))).isFalse();
    }

    @Test
    void invalidCriteriaAreRejected() {
        assertThatThrownBy(() -> criteria(null, null, null, null, null, null, null, null, null))
                .hasMessageContaining("at least one requirement");
        assertThatThrownBy(() -> criteria(null, 101, null, null, null, null, null, null, null))
                .hasMessageContaining("between 0 and 100");
        assertThatThrownBy(() -> criteria(null, null, RELATIONSHIP, null, null, null, null, null, null))
                .hasMessageContaining("set together");
        assertThatThrownBy(() -> criteria(true, null, null, null, null, "EXTREME", null, null, null))
                .hasMessageContaining("minDifficulty");
        assertThatThrownBy(() -> criteria(null, null, null, null, null, null, List.of("RESEARCH"), null, null))
                .hasMessageContaining("firstAttemptStages");
        assertThatThrownBy(() -> new LeafCondition(ConditionType.MIN_RUNS_MATCHING, null, 0,
                criteria(true, null, null, null, null, null, null, null, null)))
                .hasMessageContaining("at least one matching run");
        assertThatThrownBy(() -> new LeafCondition(ConditionType.MIN_ENGAGEMENTS_WON, null, 1,
                criteria(true, null, null, null, null, null, null, null, null)))
                .hasMessageContaining("only for it");
    }
}
