package com.ibm.consulting.sim.scenario.domain;

import com.ibm.consulting.sim.shared.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.util.Objects;
import java.util.UUID;

/**
 * Grants one consultant access to a scenario. Assignments are keyed by the
 * scenario lineage, so they carry over to every new published revision.
 */
@Entity
@Table(name = "scenario_assignments", uniqueConstraints = @UniqueConstraint(
        name = "uq_scenario_assignments_lineage_user",
        columnNames = {"scenario_lineage_id", "user_id"}))
public class ScenarioAssignment extends BaseEntity {

    @Column(name = "scenario_lineage_id", nullable = false, updatable = false)
    private UUID scenarioLineageId;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    /** The administrator who made the assignment; null for migrated rows. */
    @Column(name = "assigned_by", updatable = false)
    private UUID assignedBy;

    protected ScenarioAssignment() {}

    public static ScenarioAssignment assign(UUID scenarioLineageId, UUID userId, UUID assignedBy) {
        ScenarioAssignment assignment = new ScenarioAssignment();
        assignment.scenarioLineageId = Objects.requireNonNull(scenarioLineageId, "scenarioLineageId");
        assignment.userId = Objects.requireNonNull(userId, "userId");
        assignment.assignedBy = assignedBy;
        return assignment;
    }

    public UUID getScenarioLineageId() { return scenarioLineageId; }
    public UUID getUserId() { return userId; }
    public UUID getAssignedBy() { return assignedBy; }
}
