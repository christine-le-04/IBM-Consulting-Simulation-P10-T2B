package com.ibm.consulting.sim.scenario.domain;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ScenarioAssignmentRepository {
    List<ScenarioAssignment> findByLineageId(UUID scenarioLineageId);
    boolean existsByLineageIdAndUserId(UUID scenarioLineageId, UUID userId);
    List<ScenarioAssignment> saveAll(Collection<ScenarioAssignment> assignments);
    void deleteAll(Collection<ScenarioAssignment> assignments);
}
