package com.ibm.consulting.sim.achievement.application;

import com.ibm.consulting.sim.achievement.domain.Achievement;
import com.ibm.consulting.sim.achievement.domain.AchievementCondition;
import com.ibm.consulting.sim.achievement.domain.AchievementFactSheet;
import com.ibm.consulting.sim.achievement.domain.AchievementRepository;
import com.ibm.consulting.sim.achievement.domain.AchievementRuleEvaluator;
import com.ibm.consulting.sim.achievement.domain.UserAchievementRepository;
import com.ibm.consulting.sim.achievement.infrastructure.AchievementRuleCodec;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Evaluates achievements against a learner's progress and unlocks the ones now
 * satisfied. Runs right after an assessment is generated (see
 * {@code AssessmentService}), and retroactively when an admin publishes or
 * changes an achievement ({@link #backfill}).
 *
 * <p>A Generic achievement is judged on every scenario the learner has played;
 * an Exclusive one only on runs of its own scenario, and is skipped while that
 * scenario has no Live revision.
 */
@Service
public class AchievementEvaluationService {

    private final AchievementRepository achievementRepository;
    private final UserAchievementRepository userAchievementRepository;
    private final AchievementFactSheetBuilder factSheetBuilder;
    private final AchievementRuleCodec ruleCodec;
    private final AchievementRuleMapper ruleMapper;
    private final ScenarioLineageLookup scenarioLineageLookup;

    public AchievementEvaluationService(AchievementRepository achievementRepository,
                                         UserAchievementRepository userAchievementRepository,
                                         AchievementFactSheetBuilder factSheetBuilder,
                                         AchievementRuleCodec ruleCodec,
                                         AchievementRuleMapper ruleMapper,
                                         ScenarioLineageLookup scenarioLineageLookup) {
        this.achievementRepository = achievementRepository;
        this.userAchievementRepository = userAchievementRepository;
        this.factSheetBuilder = factSheetBuilder;
        this.ruleCodec = ruleCodec;
        this.ruleMapper = ruleMapper;
        this.scenarioLineageLookup = scenarioLineageLookup;
    }

    /**
     * Re-evaluates every active achievement for the learner and unlocks any that
     * are newly satisfied. Returns the achievements unlocked by this call.
     */
    @Transactional
    public List<Achievement> evaluateForUser(UUID userId) {
        return evaluateAfterEngagement(userId, null);
    }

    /**
     * As {@link #evaluateForUser}, recording {@code engagementId} as the run whose
     * completion unlocked each badge so the Review screen can announce it.
     */
    @Transactional
    public List<Achievement> evaluateAfterEngagement(UUID userId, UUID engagementId) {
        Evaluation evaluation = new Evaluation(userId);
        List<Achievement> newlyUnlocked = new ArrayList<>();
        for (Achievement achievement : achievementRepository.findAllActive()) {
            if (evaluation.unlockIfSatisfied(achievement, engagementId)) {
                newlyUnlocked.add(achievement);
            }
        }
        return newlyUnlocked;
    }

    /**
     * Awards one achievement to every learner whose existing progress already
     * satisfies it. Only learners with a completed run are checked (only runs of
     * its scenario for an Exclusive one). Returns how many were newly awarded.
     */
    @Transactional
    public int backfill(Achievement achievement) {
        if (!achievement.isActive()) return 0;
        int awarded = 0;
        for (UUID userId : scenarioLineageLookup.usersWithCompletedRuns(achievement.getScenarioLineageId())) {
            if (new Evaluation(userId).unlockIfSatisfied(achievement, null)) awarded++;
        }
        return awarded;
    }

    /**
     * Who would earn an achievement now, without awarding anything. Uses the same
     * candidates and rule check as {@link #backfill}. {@code existingAchievementId}
     * (when editing) also counts learners who already hold it.
     */
    @Transactional(readOnly = true)
    public AchievementPreview preview(Achievement achievement, UUID existingAchievementId) {
        List<UUID> candidates = scenarioLineageLookup.usersWithCompletedRuns(achievement.getScenarioLineageId());
        int qualifying = 0;
        int alreadyEarned = 0;
        for (UUID userId : candidates) {
            if (!new Evaluation(userId).satisfies(achievement)) continue;
            qualifying++;
            if (existingAchievementId != null
                    && userAchievementRepository.existsByUserIdAndAchievementId(userId, existingAchievementId)) {
                alreadyEarned++;
            }
        }
        boolean live = !achievement.isExclusive() || scenarioLineageLookup.current(achievement.getScenarioLineageId())
                .map(ScenarioLineageLookup.CurrentRevision::live).orElse(false);
        return new AchievementPreview(qualifying, alreadyEarned, candidates.size(), live);
    }

    /** One learner's evaluation pass; fact sheets are built once per scope and reused. */
    private final class Evaluation {
        private final UUID userId;
        private AchievementFactSheet allScenarios;
        private final Map<UUID, AchievementFactSheet> byScenario = new HashMap<>();
        private final Map<UUID, Boolean> scenarioLive = new HashMap<>();

        private Evaluation(UUID userId) {
            this.userId = userId;
        }

        boolean unlockIfSatisfied(Achievement achievement, UUID engagementId) {
            if (!achievement.isAwardable(isLive(achievement))) return false;
            if (userAchievementRepository.existsByUserIdAndAchievementId(userId, achievement.getId())) return false;
            return satisfies(achievement)
                    && userAchievementRepository.insertIfAbsent(userId, achievement.getId(), Instant.now(), engagementId);
        }

        /** The rule check alone: no availability, no existing unlock, nothing written. */
        boolean satisfies(Achievement achievement) {
            AchievementCondition rule = ruleMapper.toDomain(ruleCodec.decode(achievement.getRuleJson()));
            return AchievementRuleEvaluator.isSatisfied(rule, factsFor(achievement));
        }

        private boolean isLive(Achievement achievement) {
            if (!achievement.isExclusive()) return true;
            return scenarioLive.computeIfAbsent(achievement.getScenarioLineageId(), lineage ->
                    scenarioLineageLookup.current(lineage).map(ScenarioLineageLookup.CurrentRevision::live).orElse(false));
        }

        private AchievementFactSheet factsFor(Achievement achievement) {
            if (achievement.isExclusive()) {
                return byScenario.computeIfAbsent(achievement.getScenarioLineageId(),
                        lineage -> factSheetBuilder.build(userId, lineage));
            }
            if (allScenarios == null) allScenarios = factSheetBuilder.build(userId);
            return allScenarios;
        }
    }
}
