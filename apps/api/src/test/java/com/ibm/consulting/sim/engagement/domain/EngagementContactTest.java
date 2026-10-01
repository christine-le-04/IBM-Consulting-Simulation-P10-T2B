package com.ibm.consulting.sim.engagement.domain;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Choose contact on the engagement: the chosen contact, the meeting client and outreach rounds. */
class EngagementContactTest {

    private static Engagement researchComplete() {
        Engagement engagement = Engagement.start(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID());
        engagement.selectLead(UUID.randomUUID());
        engagement.transitionTo(EngagementState.HYPOTHESIS_READY, "Research complete");
        return engagement;
    }

    @Test
    void startsWithNoContactInRoundOne() {
        Engagement engagement = researchComplete();

        assertThat(engagement.getContactPersonaId()).isNull();
        assertThat(engagement.getOutreachRound()).isEqualTo(1);
    }

    @Test
    void choosingAContactRecordsItAndLogsAnEvent() {
        Engagement engagement = researchComplete();
        UUID contact = UUID.randomUUID();
        int eventsBefore = engagement.getEvents().size();

        engagement.chooseContact(contact);

        assertThat(engagement.getContactPersonaId()).isEqualTo(contact);
        assertThat(engagement.getEvents()).hasSize(eventsBefore + 1);
        assertThat(engagement.getEvents().getLast().getDescription()).contains(contact.toString());
    }

    @Test
    void theContactWhoAcceptsBecomesTheMeetingClient() {
        Engagement engagement = researchComplete();
        UUID contact = UUID.randomUUID();

        engagement.meetWith(contact);

        assertThat(engagement.getPersonaId()).isEqualTo(contact);
    }

    @Test
    void aNewRoundReturnsToResearchWithNoContactAndTheNextRoundNumber() {
        Engagement engagement = researchComplete();
        engagement.chooseContact(UUID.randomUUID());
        engagement.transitionTo(EngagementState.OUTREACHING, "Outreach started");

        engagement.startNewOutreachRound();

        assertThat(engagement.getState()).isEqualTo(EngagementState.HYPOTHESIS_READY);
        assertThat(engagement.getContactPersonaId()).isNull();
        assertThat(engagement.getOutreachRound()).isEqualTo(2);
    }

    @Test
    void aNewRoundCannotStartOnceAMeetingIsSecured() {
        Engagement engagement = researchComplete();
        engagement.transitionTo(EngagementState.OUTREACHING, "Outreach started");
        engagement.transitionTo(EngagementState.MEETING_SECURED, "Meeting secured");

        assertThatThrownBy(engagement::startNewOutreachRound)
                .isInstanceOf(InvalidTransitionException.class);
        assertThat(engagement.getOutreachRound()).isEqualTo(1);
    }
}
