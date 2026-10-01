package com.ibm.consulting.sim.outreach.domain;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Choose contact rules, shared by choosing a contact and sending an email so
 * the two always agree. Attempts are counted per contact within one round.
 */
public final class ContactAttemptPolicy {

    public static final int MAX_EMAILS_PER_CONTACT = 3;

    private ContactAttemptPolicy() {}

    /** Emails sent to one contact in one round. */
    public static List<OutreachAttempt> emailsTo(Collection<OutreachAttempt> attempts, UUID personaId, int round) {
        return attempts.stream()
                .filter(a -> personaId != null && personaId.equals(a.getPersonaId()))
                .filter(a -> a.getOutreachRound() == round)
                .toList();
    }

    public static boolean agreedToMeet(List<OutreachAttempt> emailsToContact) {
        return emailsToContact.stream().anyMatch(a -> a.getOutcome() == OutreachOutcome.ACCEPTED);
    }

    /** Used all their emails without agreeing to meet. */
    public static boolean isExhausted(List<OutreachAttempt> emailsToContact) {
        return emailsToContact.size() >= MAX_EMAILS_PER_CONTACT && !agreedToMeet(emailsToContact);
    }

    /**
     * The learner may choose (or change) a contact when they have none yet,
     * when no email has gone to the current one, or when the current one is used up.
     */
    public static boolean canChangeContact(Collection<OutreachAttempt> attempts, UUID currentContactId, int round) {
        if (currentContactId == null) return true;
        List<OutreachAttempt> toCurrent = emailsTo(attempts, currentContactId, round);
        return toCurrent.isEmpty() || isExhausted(toCurrent);
    }

    /** Every contact in the scenario has used their emails this round. */
    public static boolean allExhausted(Collection<OutreachAttempt> attempts, Collection<UUID> contactIds, int round) {
        return !contactIds.isEmpty()
                && contactIds.stream().allMatch(id -> isExhausted(emailsTo(attempts, id, round)));
    }
}
