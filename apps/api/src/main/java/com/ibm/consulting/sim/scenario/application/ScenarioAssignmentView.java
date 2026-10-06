package com.ibm.consulting.sim.scenario.application;

import com.ibm.consulting.sim.identity.domain.User;

import java.util.List;
import java.util.UUID;

/** The consultants assigned to a scenario. Shared by every revision in the lineage. */
public record ScenarioAssignmentView(UUID scenarioId, UUID scenarioLineageId, List<Assignee> assignees) {

    public record Assignee(UUID id, String displayName, String email, boolean active) {
        public static Assignee from(User user) {
            return new Assignee(user.getId(), user.getDisplayName(), user.getEmail(), user.isActive());
        }
    }
}
