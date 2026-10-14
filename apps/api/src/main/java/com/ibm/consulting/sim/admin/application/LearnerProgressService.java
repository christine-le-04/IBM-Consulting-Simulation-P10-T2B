package com.ibm.consulting.sim.admin.application;

import com.ibm.consulting.sim.assessment.domain.Assessment;
import com.ibm.consulting.sim.assessment.domain.AssessmentRepository;
import com.ibm.consulting.sim.engagement.domain.Engagement;
import com.ibm.consulting.sim.engagement.domain.EngagementRepository;
import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.identity.domain.UserRepository;
import com.ibm.consulting.sim.scenario.domain.Scenario;
import com.ibm.consulting.sim.scenario.domain.ScenarioRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Read-only, per-learner view of every engagement for authorised administrators. */
@Service
public class LearnerProgressService {
    private final EngagementRepository engagementRepository;
    private final AssessmentRepository assessmentRepository;
    private final ScenarioRepository scenarioRepository;
    private final UserRepository userRepository;

    public LearnerProgressService(EngagementRepository engagementRepository, AssessmentRepository assessmentRepository,
                                  ScenarioRepository scenarioRepository, UserRepository userRepository) {
        this.engagementRepository = engagementRepository;
        this.assessmentRepository = assessmentRepository;
        this.scenarioRepository = scenarioRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<LearnerProgressEntry> getProgress() {
        List<Engagement> engagements = engagementRepository.findAll();
        if (engagements.isEmpty()) return List.of();
        Map<UUID, Assessment> assessments = assessmentRepository.findAllByEngagementIdIn(
                        engagements.stream().map(Engagement::getId).toList()).stream()
                .collect(Collectors.toMap(Assessment::getEngagementId, Function.identity()));
        Map<UUID, Scenario> scenarios = scenarioRepository.findByIdIn(
                        engagements.stream().map(Engagement::getScenarioId).distinct().toList()).stream()
                .collect(Collectors.toMap(Scenario::getId, Function.identity()));
        Map<UUID, User> users = userRepository.findAll().stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        return engagements.stream()
                .map(engagement -> entry(engagement, users.get(engagement.getUserId()),
                        scenarios.get(engagement.getScenarioId()), assessments.get(engagement.getId())))
                .sorted(Comparator.comparing(LearnerProgressEntry::lastActivityAt).reversed())
                .toList();
    }

    private LearnerProgressEntry entry(Engagement engagement, User user, Scenario scenario, Assessment assessment) {
        return new LearnerProgressEntry(
                engagement.getId().toString(),
                engagement.getUserId().toString(),
                user == null ? "Removed learner" : user.getDisplayName(),
                user == null ? "" : user.getEmail(),
                engagement.getScenarioId().toString(),
                scenario == null ? "Retired scenario" : scenario.getTitle(),
                engagement.getState().name(),
                assessment == null ? null : assessment.getOverallScore(),
                engagement.getUpdatedAt(),
                engagement.getCompletedAt());
    }
}
