package com.ibm.consulting.sim.admin.application;

import com.ibm.consulting.sim.assessment.domain.Assessment;
import com.ibm.consulting.sim.assessment.domain.AssessmentRepository;
import com.ibm.consulting.sim.assessment.domain.CompetencyScore;
import com.ibm.consulting.sim.engagement.domain.Engagement;
import com.ibm.consulting.sim.engagement.domain.EngagementRepository;
import com.ibm.consulting.sim.engagement.domain.EngagementState;
import com.ibm.consulting.sim.scenario.domain.Scenario;
import com.ibm.consulting.sim.scenario.domain.ScenarioRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Read-only cohort view for trainers: completion, competency averages and recurring weak areas per scenario. */
@Service
public class CohortAnalyticsService {
    /** A competency score below this counts as needing work. */
    public static final int TARGET_SCORE = 70;
    private static final int MAX_RECURRING_AREAS = 5;

    private final EngagementRepository engagementRepository;
    private final AssessmentRepository assessmentRepository;
    private final ScenarioRepository scenarioRepository;

    public CohortAnalyticsService(EngagementRepository engagementRepository, AssessmentRepository assessmentRepository,
                                  ScenarioRepository scenarioRepository) {
        this.engagementRepository = engagementRepository;
        this.assessmentRepository = assessmentRepository;
        this.scenarioRepository = scenarioRepository;
    }

    @Transactional(readOnly = true)
    public CohortAnalytics.Response getCohorts() {
        List<Engagement> engagements = engagementRepository.findAll();
        if (engagements.isEmpty()) {
            return new CohortAnalytics.Response(TARGET_SCORE, cohort(null, "All scenarios", List.of(), Map.of()), List.of());
        }
        Map<UUID, Assessment> assessments = assessmentRepository.findAllByEngagementIdIn(
                        engagements.stream().map(Engagement::getId).toList()).stream()
                .collect(Collectors.toMap(Assessment::getEngagementId, Function.identity()));
        Map<UUID, Scenario> scenarios = scenarioRepository.findByIdIn(
                        engagements.stream().map(Engagement::getScenarioId).distinct().toList()).stream()
                .collect(Collectors.toMap(Scenario::getId, Function.identity()));

        List<CohortAnalytics> perScenario = engagements.stream()
                .collect(Collectors.groupingBy(Engagement::getScenarioId, LinkedHashMap::new, Collectors.toList()))
                .entrySet().stream()
                .map(group -> {
                    Scenario scenario = scenarios.get(group.getKey());
                    return cohort(group.getKey().toString(), scenario == null ? "Retired scenario" : scenario.getTitle(),
                            group.getValue(), assessments);
                })
                .sorted(Comparator.comparing(CohortAnalytics::runCount).reversed()
                        .thenComparing(CohortAnalytics::scenarioTitle))
                .toList();
        return new CohortAnalytics.Response(TARGET_SCORE, cohort(null, "All scenarios", engagements, assessments), perScenario);
    }

    private CohortAnalytics cohort(String scenarioId, String title, List<Engagement> runs, Map<UUID, Assessment> assessments) {
        List<Assessment> assessed = runs.stream().map(run -> assessments.get(run.getId())).filter(Objects::nonNull).toList();
        Map<String, Integer> stateCounts = new TreeMap<>();
        runs.forEach(run -> stateCounts.merge(run.getState().name(), 1, Integer::sum));
        int completed = (int) runs.stream()
                .filter(run -> run.getState() == EngagementState.COMPLETED || run.getCompletedAt() != null).count();
        Integer averageScore = assessed.isEmpty() ? null
                : (int) Math.round(assessed.stream().mapToInt(Assessment::getOverallScore).average().orElse(0));
        return new CohortAnalytics(
                scenarioId,
                title,
                (int) runs.stream().map(Engagement::getUserId).distinct().count(),
                runs.size(),
                completed,
                stateCounts.getOrDefault(EngagementState.MEETING_FAILED.name(), 0),
                averageScore,
                stateCounts,
                competencies(assessed),
                recurringImprovementAreas(assessed));
    }

    private List<CohortAnalytics.CompetencyAverage> competencies(List<Assessment> assessed) {
        Map<String, List<Integer>> scoresByName = new LinkedHashMap<>();
        for (Assessment assessment : assessed) {
            for (CompetencyScore score : assessment.getCompetencyScores()) {
                scoresByName.computeIfAbsent(score.getCompetencyName(), name -> new ArrayList<>()).add(score.getScore());
            }
        }
        return scoresByName.entrySet().stream()
                .map(entry -> new CohortAnalytics.CompetencyAverage(
                        entry.getKey(),
                        (int) Math.round(entry.getValue().stream().mapToInt(Integer::intValue).average().orElse(0)),
                        (int) entry.getValue().stream().filter(score -> score < TARGET_SCORE).count(),
                        entry.getValue().size()))
                .sorted(Comparator.comparingInt(CohortAnalytics.CompetencyAverage::averageScore)
                        .thenComparing(CohortAnalytics.CompetencyAverage::name))
                .toList();
    }

    /** AI feedback is free text, so only advice repeated word for word (ignoring case and punctuation) is grouped. */
    private List<CohortAnalytics.RecurringFeedback> recurringImprovementAreas(List<Assessment> assessed) {
        Map<String, String> firstWording = new LinkedHashMap<>();
        Map<String, Integer> runCounts = new LinkedHashMap<>();
        for (Assessment assessment : assessed) {
            Set<String> seenInRun = new LinkedHashSet<>();
            for (String area : assessment.getImprovementAreas()) {
                if (area == null || area.isBlank()) continue;
                String key = area.trim().toLowerCase(Locale.ROOT).replaceAll("[\\p{Punct}\\s]+$", "").replaceAll("\\s+", " ");
                if (!seenInRun.add(key)) continue;
                firstWording.putIfAbsent(key, area.trim());
                runCounts.merge(key, 1, Integer::sum);
            }
        }
        return runCounts.entrySet().stream()
                .filter(entry -> entry.getValue() > 1)
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .limit(MAX_RECURRING_AREAS)
                .map(entry -> new CohortAnalytics.RecurringFeedback(firstWording.get(entry.getKey()), entry.getValue()))
                .toList();
    }
}
