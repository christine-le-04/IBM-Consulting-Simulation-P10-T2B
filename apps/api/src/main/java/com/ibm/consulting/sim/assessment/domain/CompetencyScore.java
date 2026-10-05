package com.ibm.consulting.sim.assessment.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/** Value object: a single competency's deterministic score with a short evidence citation. */
@Embeddable
public class CompetencyScore {

    @Column(name = "competency_name", nullable = false)
    private String competencyName;

    @Column(name = "score", nullable = false)
    private int score;

    @Column(name = "evidence_note", columnDefinition = "text")
    private String evidenceNote;

    private String stage;
    private Integer attemptCount;
    private Integer currentCycleAttempts;
    private Integer checkpointResets;
    private Boolean scoreHistoryComplete;

    protected CompetencyScore() {}

    public CompetencyScore(String competencyName, int score, String evidenceNote) {
        this.competencyName = competencyName;
        this.score = score;
        this.evidenceNote = evidenceNote;
    }

    public String getCompetencyName() { return competencyName; }
    public int getScore() { return score; }
    public String getEvidenceNote() { return evidenceNote; }

    public static CompetencyScore stage(String name, String stage, int bestScore, int attempts,
                                        int currentCycleAttempts, int resets, boolean completeHistory) {
        CompetencyScore result = new CompetencyScore(name, bestScore,
                completeHistory ? "Best score across all completed attempts, including earlier checkpoint cycles."
                        : "Best available score; some older attempts have no saved score snapshot.");
        result.stage = stage;
        result.attemptCount = attempts;
        result.currentCycleAttempts = currentCycleAttempts;
        result.checkpointResets = resets;
        result.scoreHistoryComplete = completeHistory;
        return result;
    }

    public String getStage() { return stage; }
    public Integer getAttemptCount() { return attemptCount; }
    public Integer getCurrentCycleAttempts() { return currentCycleAttempts; }
    public Integer getCheckpointResets() { return checkpointResets; }
    public Boolean getScoreHistoryComplete() { return scoreHistoryComplete; }
}
