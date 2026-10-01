package com.ibm.consulting.sim.outreach.domain;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** The Choose contact rules shared by choosing a contact and sending an email. */
class ContactAttemptPolicyTest {

    private final UUID engagementId = UUID.randomUUID();
    private final UUID elena = UUID.randomUUID();
    private final UUID dan = UUID.randomUUID();
    private final List<OutreachAttempt> attempts = new ArrayList<>();

    private void email(UUID contact, int round, OutreachOutcome outcome) {
        OutreachAttempt attempt = OutreachAttempt.create(engagementId, attempts.size() + 1, "Subject", "Body");
        attempt.assignContact(contact, round);
        attempt.resolve("Reply", outcome, OutreachNextAction.NONE, 50, 50, 50, 50);
        attempts.add(attempt);
    }

    @Test
    void countsOnlyEmailsToThatContactInThatRound() {
        email(elena, 1, OutreachOutcome.FOLLOW_UP_REQUIRED);
        email(dan, 1, OutreachOutcome.REJECTED);
        email(elena, 2, OutreachOutcome.FOLLOW_UP_REQUIRED);

        assertThat(ContactAttemptPolicy.emailsTo(attempts, elena, 1)).hasSize(1);
        assertThat(ContactAttemptPolicy.emailsTo(attempts, elena, 2)).hasSize(1);
        assertThat(ContactAttemptPolicy.emailsTo(attempts, dan, 2)).isEmpty();
    }

    @Test
    void emailsWithNoRecordedContactCountAgainstNobody() {
        OutreachAttempt older = OutreachAttempt.create(engagementId, 1, "Subject", "Body");
        older.resolve("Reply", OutreachOutcome.REJECTED, OutreachNextAction.NONE, 50, 50, 50, 50);
        attempts.add(older);

        assertThat(ContactAttemptPolicy.emailsTo(attempts, elena, 1)).isEmpty();
        assertThat(ContactAttemptPolicy.emailsTo(attempts, null, 1)).isEmpty();
    }

    @Test
    void aContactIsUsedUpAfterThreeEmailsWithoutAMeeting() {
        email(dan, 1, OutreachOutcome.REJECTED);
        email(dan, 1, OutreachOutcome.REJECTED);
        assertThat(ContactAttemptPolicy.isExhausted(ContactAttemptPolicy.emailsTo(attempts, dan, 1))).isFalse();

        email(dan, 1, OutreachOutcome.REJECTED);
        assertThat(ContactAttemptPolicy.isExhausted(ContactAttemptPolicy.emailsTo(attempts, dan, 1))).isTrue();
    }

    @Test
    void aContactWhoAgreedToMeetIsNeverUsedUp() {
        email(elena, 1, OutreachOutcome.FOLLOW_UP_REQUIRED);
        email(elena, 1, OutreachOutcome.FOLLOW_UP_REQUIRED);
        email(elena, 1, OutreachOutcome.ACCEPTED);

        List<OutreachAttempt> toElena = ContactAttemptPolicy.emailsTo(attempts, elena, 1);
        assertThat(ContactAttemptPolicy.agreedToMeet(toElena)).isTrue();
        assertThat(ContactAttemptPolicy.isExhausted(toElena)).isFalse();
    }

    @Test
    void theContactCanBeChangedBeforeTheFirstEmail() {
        assertThat(ContactAttemptPolicy.canChangeContact(attempts, null, 1)).isTrue();
        assertThat(ContactAttemptPolicy.canChangeContact(attempts, elena, 1)).isTrue();
    }

    @Test
    void theContactIsLockedAfterTheFirstEmailUntilUsedUp() {
        email(elena, 1, OutreachOutcome.FOLLOW_UP_REQUIRED);
        assertThat(ContactAttemptPolicy.canChangeContact(attempts, elena, 1)).isFalse();

        email(elena, 1, OutreachOutcome.FOLLOW_UP_REQUIRED);
        email(elena, 1, OutreachOutcome.FOLLOW_UP_REQUIRED);
        assertThat(ContactAttemptPolicy.canChangeContact(attempts, elena, 1)).isTrue();
    }

    @Test
    void aNewRoundUnlocksAContactUsedUpInTheLastRound() {
        for (int i = 0; i < 3; i++) email(elena, 1, OutreachOutcome.FOLLOW_UP_REQUIRED);

        assertThat(ContactAttemptPolicy.isExhausted(ContactAttemptPolicy.emailsTo(attempts, elena, 1))).isTrue();
        assertThat(ContactAttemptPolicy.isExhausted(ContactAttemptPolicy.emailsTo(attempts, elena, 2))).isFalse();
    }

    @Test
    void allContactsAreExhaustedOnlyWhenEveryOneIsUsedUp() {
        for (int i = 0; i < 3; i++) email(dan, 1, OutreachOutcome.REJECTED);
        assertThat(ContactAttemptPolicy.allExhausted(attempts, List.of(elena, dan), 1)).isFalse();

        for (int i = 0; i < 3; i++) email(elena, 1, OutreachOutcome.FOLLOW_UP_REQUIRED);
        assertThat(ContactAttemptPolicy.allExhausted(attempts, List.of(elena, dan), 1)).isTrue();
    }

    @Test
    void aScenarioWithNoContactsIsNeverExhausted() {
        assertThat(ContactAttemptPolicy.allExhausted(attempts, List.of(), 1)).isFalse();
    }
}
