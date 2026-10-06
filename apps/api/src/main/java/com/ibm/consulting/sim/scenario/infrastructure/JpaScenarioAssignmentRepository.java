package com.ibm.consulting.sim.scenario.infrastructure;

import com.ibm.consulting.sim.scenario.domain.ScenarioAssignment;
import com.ibm.consulting.sim.scenario.domain.ScenarioAssignmentRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
interface SpringDataScenarioAssignmentRepository extends JpaRepository<ScenarioAssignment, UUID> {
    List<ScenarioAssignment> findByScenarioLineageId(UUID scenarioLineageId);
    boolean existsByScenarioLineageIdAndUserId(UUID scenarioLineageId, UUID userId);
}

@Repository
class JpaScenarioAssignmentRepository implements ScenarioAssignmentRepository {

    private final SpringDataScenarioAssignmentRepository repo;

    JpaScenarioAssignmentRepository(SpringDataScenarioAssignmentRepository repo) {
        this.repo = repo;
    }

    @Override public List<ScenarioAssignment> findByLineageId(UUID scenarioLineageId) {
        return repo.findByScenarioLineageId(scenarioLineageId);
    }
    @Override public boolean existsByLineageIdAndUserId(UUID scenarioLineageId, UUID userId) {
        return repo.existsByScenarioLineageIdAndUserId(scenarioLineageId, userId);
    }
    @Override public List<ScenarioAssignment> saveAll(Collection<ScenarioAssignment> assignments) {
        return repo.saveAll(assignments);
    }
    @Override public void deleteAll(Collection<ScenarioAssignment> assignments) {
        // One bulk DELETE, executed immediately rather than at flush time.
        repo.deleteAllInBatch(assignments);
    }
}
