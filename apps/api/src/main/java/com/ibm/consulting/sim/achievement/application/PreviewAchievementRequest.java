package com.ibm.consulting.sim.achievement.application;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

/** A draft rule and scope to preview; name and description aren't needed. */
public record PreviewAchievementRequest(@NotNull @Valid ConditionNode rule, UUID scenarioId) {
}
