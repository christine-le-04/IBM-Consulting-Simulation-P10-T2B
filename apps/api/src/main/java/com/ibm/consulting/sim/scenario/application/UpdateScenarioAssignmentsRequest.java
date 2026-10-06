package com.ibm.consulting.sim.scenario.application;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

/** Replaces the full set of consultants assigned to a scenario. An empty list unassigns everyone. */
public record UpdateScenarioAssignmentsRequest(@NotNull @Size(max = 1000) List<@NotNull UUID> userIds) {
}
