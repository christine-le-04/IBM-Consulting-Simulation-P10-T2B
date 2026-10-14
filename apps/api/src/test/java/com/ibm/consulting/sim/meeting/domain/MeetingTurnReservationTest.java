package com.ibm.consulting.sim.meeting.domain;

import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

class MeetingTurnReservationTest {
    @Test void reservationExpiresAndOldOwnerCannotReleaseItsReplacement() {
        Meeting meeting = Meeting.start(UUID.randomUUID(), UUID.randomUUID());
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        Instant start = Instant.parse("2026-01-01T00:00:00Z");
        assertThat(meeting.reserveTurn(first, start)).isTrue();
        assertThat(meeting.reserveTurn(second, start.plusSeconds(299))).isFalse();
        assertThat(meeting.ownsTurn(first, start.plusSeconds(299))).isTrue();
        assertThat(meeting.ownsTurn(first, start.plusSeconds(300))).isFalse();
        assertThat(meeting.reserveTurn(second, start.plusSeconds(300))).isTrue();
        assertThat(meeting.releaseTurn(first)).isFalse();
        assertThat(meeting.ownsTurn(second, start.plusSeconds(300))).isTrue();
        assertThat(meeting.releaseTurn(second)).isTrue();
        assertThat(meeting.reserveTurn(first, start.plusSeconds(301))).isTrue();
    }
}
