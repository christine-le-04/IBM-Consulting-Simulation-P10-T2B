package com.ibm.consulting.sim.achievement.application;

import com.ibm.consulting.sim.achievement.domain.AchievementFactSheet;
import com.ibm.consulting.sim.achievement.domain.RunRecord;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ibm.consulting.sim.assessment.domain.Assessment;
import com.ibm.consulting.sim.assessment.domain.AssessmentRepository;
import com.ibm.consulting.sim.assessment.domain.CompetencyScore;
import com.ibm.consulting.sim.engagement.domain.Engagement;
import com.ibm.consulting.sim.engagement.domain.EngagementRepository;
import com.ibm.consulting.sim.engagement.domain.EngagementState;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Builds an {@link AchievementFactSheet} purely from real persisted engagement and
 * assessment records — the same real-data discipline used by {@code PortfolioService}.
 * Achievement rules are only ever evaluated against actual learner history.
 */
@Component
public class AchievementFactSheetBuilder {

    /** Run states that count as completed (won or lost). */
    public static final Set<EngagementState> COMPLETED_STATES = Set.of(
            EngagementState.CLIENT_DECISION, EngagementState.REVIEW, EngagementState.COMPLETED);

    private final EngagementRepository engagementRepository;
    private final AssessmentRepository assessmentRepository;
    private final ScenarioLineageLookup scenarioLineageLookup;
    private final ObjectMapper objectMapper;

    public AchievementFactSheetBuilder(EngagementRepository engagementRepository,
                                        AssessmentRepository assessmentRepository,
                                        ScenarioLineageLookup scenarioLineageLookup,
                                        ObjectMapper objectMapper) {
        this.engagementRepository = engagementRepository;
        this.assessmentRepository = assessmentRepository;
        this.scenarioLineageLookup = scenarioLineageLookup;
        this.objectMapper = objectMapper;
    }

    /** The learner's progress across every scenario (Generic achievements). */
    public AchievementFactSheet build(UUID userId) {
        return fromEngagements(engagementRepository.findByUserId(userId));
    }

    /**
     * The learner's progress within one scenario only (Exclusive achievements):
     * the same facts, computed from runs of any revision of that scenario.
     */
    public AchievementFactSheet build(UUID userId, UUID scenarioLineageId) {
        Set<UUID> revisions = scenarioLineageLookup.revisionIds(scenarioLineageId);
        return fromEngagements(engagementRepository.findByUserId(userId).stream()
                .filter(engagement -> revisions.contains(engagement.getScenarioId()))
                .toList());
    }

    private AchievementFactSheet fromEngagements(List<Engagement> engagements) {
        List<Engagement> completed = engagements.stream()
                .filter(e -> COMPLETED_STATES.contains(e.getState()))
                .toList();

        if (completed.isEmpty()) {
            return AchievementFactSheet.empty();
        }

        List<UUID> completedIds = completed.stream().map(Engagement::getId).toList();
        List<Assessment> assessments = assessmentRepository.findAllByEngagementIdIn(completedIds);

        int won = (int) assessments.stream()
                .filter(a -> "PROPOSAL_ACCEPTED".equals(a.getOutcome()))
                .count();
        int completedCount = completed.size();
        double winRate = completedCount == 0 ? 0.0 : (100.0 * won / completedCount);

        int bestOverall = assessments.stream().mapToInt(Assessment::getOverallScore).max().orElse(0);
        double avgOverall = assessments.stream().mapToInt(Assessment::getOverallScore).average().orElse(0.0);

        int distinctScenarios = (int) completed.stream().map(Engagement::getScenarioId).distinct().count();

        Map<String, Integer> bestCompetencyScores = new HashMap<>();
        for (Assessment assessment : assessments) {
            for (CompetencyScore score : assessment.getCompetencyScores()) {
                bestCompetencyScores.merge(score.getCompetencyName(), score.getScore(), Math::max);
            }
        }

        Map<UUID, Engagement> engagementById = new HashMap<>();
        completed.forEach(engagement -> engagementById.put(engagement.getId(), engagement));
        List<RunRecord> runs = assessments.stream()
                .filter(assessment -> engagementById.containsKey(assessment.getEngagementId()))
                .map(assessment -> toRun(engagementById.get(assessment.getEngagementId()), assessment))
                .toList();

        return new AchievementFactSheet(completedCount, won, bestOverall, avgOverall, distinctScenarios, winRate,
                bestCompetencyScores, runs);
    }

    /** One completed run with its assessment, for "a run that…" conditions. */
    private RunRecord toRun(Engagement engagement, Assessment assessment) {
        Map<String, Integer> competencyScores = new HashMap<>();
        Map<String, Integer> stageAttempts = new HashMap<>();
        for (CompetencyScore score : assessment.getCompetencyScores()) {
            competencyScores.merge(score.getCompetencyName(), score.getScore(), Math::max);
            if (score.getStage() != null && score.getAttemptCount() != null) {
                stageAttempts.put(score.getStage(), score.getAttemptCount());
            }
        }
        Duration duration = engagement.getCompletedAt() == null ? null
                : Duration.between(engagement.getCreatedAt(), engagement.getCompletedAt());
        return new RunRecord("PROPOSAL_ACCEPTED".equals(assessment.getOutcome()), assessment.getOverallScore(),
                competencyScores, stageAttempts, difficultyOf(engagement),
                engagement.getRetryOfEngagementId() != null, duration);
    }

    /** The tier the run was played at, from its difficulty snapshot; MEDIUM when absent (the profile default). */
    private String difficultyOf(Engagement engagement) {
        String snapshot = engagement.getDifficultyProfileSnapshot();
        if (snapshot == null || snapshot.isBlank()) return "MEDIUM";
        try {
            String level = objectMapper.readTree(snapshot).path("level").asText("");
            return level.isBlank() ? "MEDIUM" : level;
        } catch (Exception unreadable) {
            return "MEDIUM";
        }
    }
}
