package com.ibm.consulting.sim.achievement.application;

import com.ibm.consulting.sim.achievement.domain.Achievement;

import java.util.Objects;
import java.util.UUID;

/**
 * Admin-facing view of an achievement definition, including its full rule tree.
 * Scenario fields are null for a Generic achievement. For an Exclusive one,
 * {@code scenarioId} is the scenario's current revision and {@code scenarioLive}
 * whether it can currently be awarded.
 */
public record AchievementAdminView(
        UUID id,
        String name,
        String description,
        String iconKey,
        boolean active,
        ConditionNode rule,
        String scope,
        UUID scenarioLineageId,
        UUID scenarioId,
        String scenarioTitle,
        Boolean scenarioLive) {

    public AchievementAdminView {
        description = Objects.requireNonNullElse(description, "");
        iconKey = Objects.requireNonNullElse(iconKey, "");
        scope = Objects.requireNonNullElse(scope, AchievementScope.GENERIC);
    }

    /** A Generic achievement. */
    public AchievementAdminView(UUID id, String name, String description, String iconKey,
                                boolean active, ConditionNode rule) {
        this(id, name, description, iconKey, active, rule, AchievementScope.GENERIC, null, null, null, null);
    }

    public static AchievementAdminView from(Achievement achievement, ConditionNode rule,
                                           ScenarioLineageLookup.CurrentRevision scenario) {
        if (!achievement.isExclusive()) {
            return new AchievementAdminView(achievement.getId(), achievement.getName(), achievement.getDescription(),
                    achievement.getIconKey(), achievement.isActive(), rule);
        }
        return new AchievementAdminView(achievement.getId(), achievement.getName(), achievement.getDescription(),
                achievement.getIconKey(), achievement.isActive(), rule, AchievementScope.EXCLUSIVE,
                achievement.getScenarioLineageId(),
                scenario == null ? null : scenario.scenarioId(),
                scenario == null ? achievement.getScenarioTitleSnapshot() : scenario.title(),
                scenario != null && scenario.live());
    }
}
