package com.ibm.consulting.sim.scenario.domain;

/**
 * A contact's part in Choose contact. Only the decision maker can accept a
 * meeting; distractors always decline with a pre-written reply.
 */
public enum ContactRole {
    DECISION_MAKER,
    DISTRACTOR
}
