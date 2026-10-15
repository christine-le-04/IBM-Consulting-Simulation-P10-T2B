package com.ibm.consulting.sim.achievement.api;

import com.ibm.consulting.sim.achievement.application.AchievementEvaluationService;
import com.ibm.consulting.sim.achievement.application.AchievementQueryService;
import com.ibm.consulting.sim.achievement.application.AchievementSummary;
import com.ibm.consulting.sim.identity.domain.User;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Learner-facing achievements read API: progression, badges, unlock status. */
@RestController
@RequestMapping("/api/v1/achievements")
public class AchievementController {

    private final AchievementQueryService achievementQueryService;
    private final AchievementEvaluationService achievementEvaluationService;

    public AchievementController(AchievementQueryService achievementQueryService,
                                 AchievementEvaluationService achievementEvaluationService) {
        this.achievementQueryService = achievementQueryService;
        this.achievementEvaluationService = achievementEvaluationService;
    }

    /**
     * Evaluates before listing, so a learner who already qualifies for a badge
     * (one added by a migration, or one missed earlier) receives it here. The
     * unlock is idempotent, so repeated reads are safe.
     */
    @GetMapping("/me")
    List<AchievementSummary> myAchievements(@AuthenticationPrincipal User user) {
        achievementEvaluationService.evaluateForUser(user.getId());
        return achievementQueryService.listForUser(user.getId());
    }
}
