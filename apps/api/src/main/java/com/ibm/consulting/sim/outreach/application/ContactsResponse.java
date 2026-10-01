package com.ibm.consulting.sim.outreach.application;

import java.util.List;
import java.util.UUID;

/**
 * Learner-facing view of Choose contact. Deliberately has no contact role or
 * pre-written replies: those would reveal who the decision maker is.
 */
public record ContactsResponse(
        int outreachRound,
        UUID currentContactId,
        boolean canChangeContact,
        List<Contact> contacts) {

    public record Contact(
            UUID id,
            String name,
            String jobTitle,
            String organisation,
            String visibleConcerns,
            int emailsSent,
            int emailsLeft,
            boolean usedUp,
            boolean current) {}
}
