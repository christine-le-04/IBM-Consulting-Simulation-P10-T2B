package com.ibm.consulting.sim.portfolio.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ibm.consulting.sim.scenario.domain.DifficultyLevel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.ibm.consulting.sim.assessment.domain.Assessment;
import com.ibm.consulting.sim.assessment.domain.AssessmentRepository;
import com.ibm.consulting.sim.assessment.domain.CompetencyScore;
import com.ibm.consulting.sim.engagement.domain.Engagement;
import com.ibm.consulting.sim.engagement.domain.EngagementRepository;
import com.ibm.consulting.sim.engagement.domain.EngagementState;
import com.ibm.consulting.sim.portfolio.application.PortfolioSummaryResponse.CompetencyTrend;
import com.ibm.consulting.sim.portfolio.application.PortfolioSummaryResponse.CompetencyTrend.TrendPoint;
import com.ibm.consulting.sim.portfolio.application.PortfolioSummaryResponse.CompletedEngagementView;
import com.ibm.consulting.sim.portfolio.application.ReplayComparisonResponse.CompetencyScoreView;
import com.ibm.consulting.sim.portfolio.application.ReplayComparisonResponse.EngagementSnapshot;
import com.ibm.consulting.sim.scenario.domain.Persona;
import com.ibm.consulting.sim.scenario.domain.PersonaRepository;
import com.ibm.consulting.sim.scenario.domain.Scenario;
import com.ibm.consulting.sim.scenario.domain.ScenarioRepository;
import com.ibm.consulting.sim.shared.domain.DomainException;
import com.ibm.consulting.sim.shared.domain.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static com.ibm.consulting.sim.shared.config.CacheConfig.PORTFOLIO_SUMMARY_CACHE;

/**
 * Read-only aggregation service for the learner Portfolio & Progression view
 * (Phase 4). Combines {@link Engagement} lifecycle data with {@link Assessment}
 * competency scores — every figure is derived from real persisted records,
 * never mocked or estimated.
 */
@Service
public class PortfolioService {
    private static final Logger log = LoggerFactory.getLogger(PortfolioService.class);

    private static final Set<String> WON_OUTCOMES = Set.of(
            "PILOT_APPROVED", "PROPOSAL_ACCEPTED", "STRATEGIC_PARTNERSHIP", "WON");

    private static final Set<String> LOST_OUTCOMES = Set.of(
            "REJECTED", "PROPOSAL_REJECTED", "LOST");

    private final EngagementRepository engagementRepository;
    private final AssessmentRepository assessmentRepository;
    private final ScenarioRepository scenarioRepository;
    private final PersonaRepository personaRepository;
    private final ObjectMapper objectMapper;

    public PortfolioService(EngagementRepository engagementRepository,
                             AssessmentRepository assessmentRepository,
                             ScenarioRepository scenarioRepository,
                             PersonaRepository personaRepository, ObjectMapper objectMapper) {
        this.engagementRepository = engagementRepository;
        this.assessmentRepository = assessmentRepository;
        this.scenarioRepository = scenarioRepository;
        this.personaRepository = personaRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = PORTFOLIO_SUMMARY_CACHE, key = "#userId")
    public PortfolioSummaryResponse getSummary(UUID userId) {
        List<Engagement> engagements = engagementRepository.findByUserId(userId);

        List<Engagement> completed = engagements.stream()
                .filter(e -> e.getState() == EngagementState.COMPLETED)
                .toList();

        List<UUID> completedIds = completed.stream().map(Engagement::getId).toList();
        List<Assessment> assessments = completedIds.isEmpty()
                ? List.of()
                : assessmentRepository.findAllByEngagementIdIn(completedIds);

        Map<UUID, Assessment> assessmentByEngagement = assessments.stream()
                .collect(Collectors.toMap(Assessment::getEngagementId, a -> a));

        Map<UUID, Scenario> scenarioCache = new HashMap<>();

        int won = (int) assessments.stream()
                .filter(a -> WON_OUTCOMES.contains(a.getOutcome()))
                .count();
        int lost = (int) assessments.stream()
                .filter(a -> LOST_OUTCOMES.contains(a.getOutcome()))
                .count();

        Double avgScore = assessments.isEmpty() ? null
                : round1(assessments.stream().mapToInt(Assessment::getOverallScore).average().orElseThrow());
        int inProgress = (int) engagements.stream().filter(e -> !e.getState().isTerminal()).count();
        int failed = (int) engagements.stream().filter(e -> e.getState() == EngagementState.MEETING_FAILED).count();

        List<CompletedEngagementView> history = completed.stream()
                .map(e -> {
                    Scenario scenario = scenarioCache.computeIfAbsent(e.getScenarioId(), this::loadScenario);
                    Assessment assessment = assessmentByEngagement.get(e.getId());
                    return new CompletedEngagementView(
                            e.getId(), e.getScenarioId(), scenario.getTitle(), scenario.getIndustry(), recordedDifficulty(e),
                            assessment != null ? assessment.getOutcome() : "ASSESSMENT_PENDING",
                            assessment != null ? Integer.valueOf(assessment.getOverallScore()) : null,
                            e.getCompletedAt());
                })
                .sorted(Comparator.comparing(CompletedEngagementView::completedAt,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();

        List<CompetencyTrend> trends = buildCompetencyTrends(assessmentByEngagement);

        return new PortfolioSummaryResponse(
                engagements.size(), completed.size(), inProgress, failed, won, lost, avgScore, trends, history);
    }

    @Transactional(readOnly = true)
    public ReplayComparisonResponse compare(UUID userId, UUID engagementIdA, UUID engagementIdB) {
        return new ReplayComparisonResponse(
                snapshotOf(userId, engagementIdA),
                snapshotOf(userId, engagementIdB));
    }

    private EngagementSnapshot snapshotOf(UUID userId, UUID engagementId) {
        Engagement engagement = engagementRepository.findByIdAndUserId(engagementId, userId)
                .orElseThrow(() -> new NotFoundException("Engagement", engagementId));
        Assessment assessment = assessmentRepository.findByEngagementId(engagementId)
                .orElseThrow(() -> new AssessmentNotReadyException(engagementId));
        Scenario scenario = loadScenario(engagement.getScenarioId());
        Persona persona = personaRepository.findById(engagement.getPersonaId())
                .orElseThrow(() -> new NotFoundException("Persona", engagement.getPersonaId()));

        List<CompetencyScoreView> scores = assessment.getCompetencyScores().stream()
                .map(this::toView)
                .toList();

        return new EngagementSnapshot(engagementId, scenario.getTitle(), persona.getName(), recordedDifficulty(engagement),
                assessment.getOutcome(), assessment.getOverallScore(), scores);
    }

    private CompetencyScoreView toView(CompetencyScore score) {
        return new CompetencyScoreView(score.getCompetencyName(), score.getScore(), score.getEvidenceNote());
    }

    private List<CompetencyTrend> buildCompetencyTrends(Map<UUID, Assessment> assessmentByEngagement) {
        Map<String, List<TrendPoint>> byCompetency = new HashMap<>();
        assessmentByEngagement.values().forEach(assessment ->
                assessment.getCompetencyScores().forEach(score ->
                        byCompetency
                                .computeIfAbsent(score.getCompetencyName(), k -> new java.util.ArrayList<>())
                                .add(new TrendPoint(assessment.getEngagementId(), assessment.getGeneratedAt(), score.getScore()))));

        return byCompetency.entrySet().stream()
                .map(entry -> new CompetencyTrend(entry.getKey(),
                        entry.getValue().stream()
                                .sorted(Comparator.comparing(TrendPoint::generatedAt))
                                .toList()))
                .sorted(Comparator.comparing(CompetencyTrend::competencyName))
                .toList();
    }

    private Scenario loadScenario(UUID scenarioId) {
        return scenarioRepository.findById(scenarioId)
                .orElseThrow(() -> new NotFoundException("Scenario", scenarioId));
    }

    private double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    /** Historical results use the run's snapshot, never today's scenario or lead settings. */
    private DifficultyLevel recordedDifficulty(Engagement engagement) {
        String snapshot = engagement.getDifficultyProfileSnapshot();
        if (snapshot == null || snapshot.isBlank()) return null;
        try {
            var root = objectMapper.readTree(snapshot);
            String level = root == null ? null : root.path("level").asText(null);
            return level == null ? null : DifficultyLevel.valueOf(level);
        } catch (JsonProcessingException | IllegalArgumentException exception) {
            log.warn("Difficulty unavailable in historical engagement {}", engagement.getId());
            return null;
        }
    }

    public static class AssessmentNotReadyException extends DomainException {
        public AssessmentNotReadyException(UUID engagementId) {
            super("Assessment not yet available for engagement: " + engagementId);
        }
    }
}
