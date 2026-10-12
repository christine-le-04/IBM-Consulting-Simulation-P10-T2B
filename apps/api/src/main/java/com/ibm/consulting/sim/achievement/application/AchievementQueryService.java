package com.ibm.consulting.sim.achievement.application;

import com.ibm.consulting.sim.achievement.domain.Achievement;
import com.ibm.consulting.sim.achievement.domain.AchievementCondition;
import com.ibm.consulting.sim.achievement.domain.AchievementFactSheet;
import com.ibm.consulting.sim.achievement.domain.AchievementRepository;
import com.ibm.consulting.sim.achievement.domain.AchievementRuleEvaluator;
import com.ibm.consulting.sim.achievement.domain.UserAchievement;
import com.ibm.consulting.sim.achievement.domain.UserAchievementRepository;
import com.ibm.consulting.sim.achievement.infrastructure.AchievementRuleCodec;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Learner-facing read model: "my achievements" with unlock status and live progress.
 *
 * <p>Shows every active achievement, plus any the learner has earned even if an
 * admin has since deactivated it: an earned badge is never taken away. Exclusive
 * badges show their scenario's live title, progress counted on that scenario
 * only, and whether the scenario is currently Live.
 */
@Service
public class AchievementQueryService {

    private final AchievementRepository achievementRepository;
    private final UserAchievementRepository userAchievementRepository;
    private final AchievementFactSheetBuilder factSheetBuilder;
    private final AchievementRuleCodec ruleCodec;
    private final AchievementRuleMapper ruleMapper;
    private final ScenarioLineageLookup scenarioLineageLookup;

    public AchievementQueryService(AchievementRepository achievementRepository,
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

    @Transactional(readOnly = true)
    public List<AchievementSummary> listForUser(UUID userId) {
        Map<UUID, UserAchievement> unlockByAchievement = userAchievementRepository.findByUserId(userId).stream()
                .collect(Collectors.toMap(UserAchievement::getAchievementId, ua -> ua, (first, second) -> first));
        Map<UUID, Optional<ScenarioLineageLookup.CurrentRevision>> scenarios = new HashMap<>();
        Map<UUID, AchievementFactSheet> scopedFacts = new HashMap<>();
        AchievementFactSheet[] allFacts = new AchievementFactSheet[1];

        return achievementRepository.findAll().stream()
                .filter(achievement -> achievement.isActive() || unlockByAchievement.containsKey(achievement.getId()))
                .map(achievement -> {
                    Optional<ScenarioLineageLookup.CurrentRevision> scenario = achievement.isExclusive()
                            ? scenarios.computeIfAbsent(achievement.getScenarioLineageId(), scenarioLineageLookup::current)
                            : Optional.empty();
                    String scenarioTitle = achievement.isExclusive()
                            ? scenario.map(ScenarioLineageLookup.CurrentRevision::title)
                                    .orElse(achievement.getScenarioTitleSnapshot())
                            : null;
                    boolean available = !achievement.isExclusive()
                            || scenario.map(ScenarioLineageLookup.CurrentRevision::live).orElse(false);

                    UserAchievement unlock = unlockByAchievement.get(achievement.getId());
                    if (unlock != null) {
                        return AchievementSummary.unlocked(achievement, unlock, scenarioTitle, available);
                    }
                    AchievementFactSheet facts;
                    if (achievement.isExclusive()) {
                        facts = scopedFacts.computeIfAbsent(achievement.getScenarioLineageId(),
                                lineage -> factSheetBuilder.build(userId, lineage));
                    } else {
                        if (allFacts[0] == null) allFacts[0] = factSheetBuilder.build(userId);
                        facts = allFacts[0];
                    }
                    AchievementCondition rule = ruleMapper.toDomain(ruleCodec.decode(achievement.getRuleJson()));
                    return AchievementSummary.locked(achievement, AchievementRuleEvaluator.progress(rule, facts),
                            scenarioTitle, available);
                })
                .toList();
    }
}
