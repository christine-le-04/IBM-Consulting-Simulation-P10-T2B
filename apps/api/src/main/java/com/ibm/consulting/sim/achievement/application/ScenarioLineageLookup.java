package com.ibm.consulting.sim.achievement.application;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * What the achievement module needs to know about scenarios. Exclusive badges
 * are scoped to a scenario lineage (every revision), never one revision row, so
 * publishing a new revision neither archives the badge nor drops older runs.
 */
public interface ScenarioLineageLookup {

    /** The lineage a scenario revision belongs to. */
    Optional<UUID> lineageOf(UUID scenarioId);

    /** The lineage's current revision: the Live one if any, otherwise the latest. */
    Optional<CurrentRevision> current(UUID scenarioLineageId);

    /** Every revision id in the lineage. */
    Set<UUID> revisionIds(UUID scenarioLineageId);

    /** Learners with at least one completed run; only runs of this lineage when it is not null. */
    List<UUID> usersWithCompletedRuns(UUID scenarioLineageIdOrNull);

    record CurrentRevision(UUID scenarioId, String title, boolean live) {}
}
