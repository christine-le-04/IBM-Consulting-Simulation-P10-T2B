package com.ibm.consulting.sim.achievement.application;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import com.ibm.consulting.sim.achievement.domain.ConditionType;

/** New rules can't use a threshold of 0: "at least 0" is met by everyone. */
class ConditionNodeThresholdTest {

    private final ConditionNodeValidator validator = new ConditionNodeValidator();

    @Test
    void aZeroThresholdIsRejected() {
        assertThat(validator.isValid(ConditionNode.leaf(ConditionType.MIN_AVERAGE_OVERALL_SCORE, null, 0), null)).isFalse();
        assertThat(validator.isValid(ConditionNode.leaf(ConditionType.MIN_ENGAGEMENTS_COMPLETED, null, 0), null)).isFalse();
    }

    @Test
    void aPositiveThresholdIsAccepted() {
        assertThat(validator.isValid(ConditionNode.leaf(ConditionType.MIN_AVERAGE_OVERALL_SCORE, null, 1), null)).isTrue();
    }
}
