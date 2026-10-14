package com.ibm.consulting.sim.achievement.infrastructure;

import com.ibm.consulting.sim.achievement.application.AchievementFactSheetBuilder;
import com.ibm.consulting.sim.achievement.application.ScenarioLineageLookup;
import com.ibm.consulting.sim.scenario.domain.ScenarioStatus;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * JPQL lookups over scenarios and engagements, kept inside the achievement
 * module so the shared Scenario and Engagement repositories stay unchanged.
 */
@Component
class JpaScenarioLineageLookup implements ScenarioLineageLookup {

    private final EntityManager entityManager;

    JpaScenarioLineageLookup(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    @Override
    public Optional<UUID> lineageOf(UUID scenarioId) {
        return entityManager.createQuery(
                        "select s.scenarioLineageId from Scenario s where s.id = :id", UUID.class)
                .setParameter("id", scenarioId)
                .getResultStream().findFirst();
    }

    @Override
    public Optional<CurrentRevision> current(UUID scenarioLineageId) {
        return entityManager.createQuery("""
                        select s.id, s.title, s.status from Scenario s
                        where s.scenarioLineageId = :lineage
                        order by case when s.status = :live then 0 else 1 end, s.contentVersion desc
                        """, Object[].class)
                .setParameter("lineage", scenarioLineageId)
                .setParameter("live", ScenarioStatus.ACTIVE)
                .setMaxResults(1)
                .getResultStream().findFirst()
                .map(row -> new CurrentRevision((UUID) row[0], (String) row[1], row[2] == ScenarioStatus.ACTIVE));
    }

    @Override
    public Set<UUID> revisionIds(UUID scenarioLineageId) {
        return new HashSet<>(entityManager.createQuery(
                        "select s.id from Scenario s where s.scenarioLineageId = :lineage", UUID.class)
                .setParameter("lineage", scenarioLineageId)
                .getResultList());
    }

    @Override
    public List<UUID> usersWithCompletedRuns(UUID scenarioLineageIdOrNull) {
        if (scenarioLineageIdOrNull == null) {
            return entityManager.createQuery(
                            "select distinct e.userId from Engagement e where e.state in :states", UUID.class)
                    .setParameter("states", AchievementFactSheetBuilder.COMPLETED_STATES)
                    .getResultList();
        }
        return entityManager.createQuery("""
                        select distinct e.userId from Engagement e
                        where e.state in :states
                          and e.scenarioId in (select s.id from Scenario s where s.scenarioLineageId = :lineage)
                        """, UUID.class)
                .setParameter("states", AchievementFactSheetBuilder.COMPLETED_STATES)
                .setParameter("lineage", scenarioLineageIdOrNull)
                .getResultList();
    }
}
