package com.ibm.consulting.sim.assessment.domain;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class AssessmentEngineTest {

    @Test
    void overallAveragesOnlyTheThreeScoredStages() {
        List<CompetencyScore> scores = List.of(
                new CompetencyScore("Outreach Effectiveness", 90, ""),
                new CompetencyScore("Relationship Building", 60, ""),
                new CompetencyScore("Solution Alignment", 30, ""));
        assertThat(AssessmentEngine.overall(scores)).isEqualTo(60);
        assertThat(AssessmentEngine.overall(scores, Map.of("Research & Discovery", 25,
                "Outreach Effectiveness", 25, "Relationship Building", 25, "Solution Alignment", 25)))
                .isEqualTo(60);
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

}
