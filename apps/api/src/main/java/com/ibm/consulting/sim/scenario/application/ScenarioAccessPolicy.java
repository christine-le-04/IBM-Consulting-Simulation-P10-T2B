package com.ibm.consulting.sim.scenario.application;

import com.ibm.consulting.sim.scenario.domain.Scenario;

import java.util.UUID;

/** Decides whether a user may start a new run of a Live scenario. */
@FunctionalInterface
public interface ScenarioAccessPolicy {
    boolean canStart(UUID userId, Scenario scenario);
}
