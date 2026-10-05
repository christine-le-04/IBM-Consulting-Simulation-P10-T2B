package com.ibm.consulting.sim.meeting.domain;

import com.ibm.consulting.sim.ai.domain.PersonaStateDelta;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MeetingPerformanceSnapshotTest {
    @Test
    void completedScoreSurvivesRelationshipResetAndCannotBeOverwritten() {
        UUID engagementId = UUID.randomUUID();
        PersonaState state = PersonaState.initial(engagementId);
        state.applyClampedDelta(new PersonaStateDelta(30, 20, 10));
        Meeting meeting = Meeting.start(engagementId, UUID.randomUUID());
        assertThatThrownBy(() -> meeting.snapshotPerformance(state)).isInstanceOf(IllegalStateException.class);
        meeting.complete(MeetingCompletionOutcome.PASSED, "Good discovery", List.of());
        meeting.snapshotPerformance(state);
        assertThat(meeting.getPerformanceScore()).isEqualTo(70);
        state.reset(null);
        meeting.snapshotPerformance(state);
        assertThat(meeting.getPerformanceScore()).isEqualTo(70);
    }
}
