package com.ibm.consulting.sim.achievement.application;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Request payload for creating or updating an achievement definition.
 * {@code scenarioId}: null for a Generic achievement; any revision of the
 * scenario an Exclusive achievement belongs to (stored as its lineage).
 */
public record UpsertAchievementRequest(
        @NotBlank @Size(max = 150) String name,
        @Size(max = 2_000) String description,
        @Size(max = 100) String iconKey,
        @NotNull @Valid ConditionNode rule,
        java.util.UUID scenarioId) {

    /** A Generic achievement. */
    public UpsertAchievementRequest(String name, String description, String iconKey, ConditionNode rule) {
        this(name, description, iconKey, rule, null);
    }
}
