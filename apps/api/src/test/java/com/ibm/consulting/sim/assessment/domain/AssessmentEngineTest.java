package com.ibm.consulting.sim.assessment.domain;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class AssessmentEngineTest {

    @Test
    void producesFourCompetencyScores() {
        List<CompetencyScore> scores = AssessmentEngine.score(3, 70, 60, 65, 55, 75);
        assertThat(scores).hasSize(4);
        assertThat(scores).extracting(CompetencyScore::getCompetencyName)
                .containsExactly("Research & Discovery", "Outreach Effectiveness",
                        "Relationship Building", "Solution Alignment");
    }

    @Test
    void discoveryScoreCapsAtOneHundredWithSufficientEvidence() {
        List<CompetencyScore> scores = AssessmentEngine.score(10, 50, 50, 50, 50, 50);
        CompetencyScore discovery = scores.get(0);
        assertThat(discovery.getScore()).isEqualTo(100);
    }

    @Test
    void discoveryScoreIsZeroWithNoEvidence() {
        List<CompetencyScore> scores = AssessmentEngine.score(0, 50, 50, 50, 50, 50);
        assertThat(scores.get(0).getScore()).isZero();
    }

    @Test
    void relationshipScoreIsAverageOfTrustInterestPatience() {
        List<CompetencyScore> scores = AssessmentEngine.score(3, 50, 90, 60, 30, 50);
        CompetencyScore relationship = scores.get(2);
        assertThat(relationship.getScore()).isEqualTo(60); // (90+60+30)/3
    }

    @Test
    void overallIsAverageOfAllCompetencyScores() {
        List<CompetencyScore> scores = AssessmentEngine.score(5, 100, 100, 100, 100, 100);
        assertThat(AssessmentEngine.overall(scores)).isEqualTo(100);
    }

    @Test
    void overallIsZeroForEmptyScoreList() {
        assertThat(AssessmentEngine.overall(List.of())).isZero();
    }

    @Test
    void overallUsesTheScenarioRubricWeights() {
        List<CompetencyScore> scores = List.of(
                new CompetencyScore("Outreach Effectiveness", 80, "Outreach evidence"),
                new CompetencyScore("Solution Alignment", 40, "Proposal evidence"));

        assertThat(AssessmentEngine.overall(scores,
                Map.of("Outreach Effectiveness", 75, "Solution Alignment", 25))).isEqualTo(70);
    }

    @Test
    void unknownRubricNamesFallBackToTheEqualWeightAverage() {
        List<CompetencyScore> scores = List.of(
                new CompetencyScore("Outreach Effectiveness", 81, "Outreach evidence"),
                new CompetencyScore("Solution Alignment", 40, "Proposal evidence"));

        assertThat(AssessmentEngine.overall(scores, Map.of("Unknown competency", 100))).isEqualTo(61);
        assertThat(AssessmentEngine.overall(scores, null)).isEqualTo(61);
    }

    @Test
    void anExplicitZeroWeightExcludesTheCompetencyFromTheOverallScore() {
        List<CompetencyScore> scores = List.of(
                new CompetencyScore("Outreach Effectiveness", 90, "Outreach evidence"),
                new CompetencyScore("Solution Alignment", 10, "Proposal evidence"));

        assertThat(AssessmentEngine.overall(scores,
                Map.of("Outreach Effectiveness", 0, "Solution Alignment", 100))).isEqualTo(10);
    }

    @Test
    void scoringIsReproducibleForTheSamePersistedInputs() {
        List<CompetencyScore> first = AssessmentEngine.score(3, 71, 60, 65, 55, 75);
        List<CompetencyScore> replay = AssessmentEngine.score(3, 71, 60, 65, 55, 75);

        assertThat(replay).extracting(CompetencyScore::getScore)
                .containsExactlyElementsOf(first.stream().map(CompetencyScore::getScore).toList());
        assertThat(AssessmentEngine.overall(replay)).isEqualTo(AssessmentEngine.overall(first));
    }
}
