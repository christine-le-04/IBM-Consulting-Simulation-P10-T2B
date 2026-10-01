package com.ibm.consulting.sim.outreach.application;

import com.ibm.consulting.sim.engagement.domain.Engagement;
import com.ibm.consulting.sim.engagement.domain.EngagementRepository;
import com.ibm.consulting.sim.engagement.domain.EngagementState;
import com.ibm.consulting.sim.outreach.domain.ContactAttemptPolicy;
import com.ibm.consulting.sim.outreach.domain.OutreachAttempt;
import com.ibm.consulting.sim.outreach.domain.OutreachRepository;
import com.ibm.consulting.sim.scenario.domain.Persona;
import com.ibm.consulting.sim.scenario.domain.Scenario;
import com.ibm.consulting.sim.scenario.domain.ScenarioRepository;
import com.ibm.consulting.sim.shared.domain.DomainException;
import com.ibm.consulting.sim.shared.domain.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Choose contact. Lists the scenario's contacts with how many emails each has
 * had this round, and lets the learner choose who to email. Never reveals who
 * the decision maker is.
 */
@Service
public class ContactService {

    private final EngagementRepository engagementRepository;
    private final ScenarioRepository scenarioRepository;
    private final OutreachRepository outreachRepository;

    public ContactService(EngagementRepository engagementRepository,
                          ScenarioRepository scenarioRepository,
                          OutreachRepository outreachRepository) {
        this.engagementRepository = engagementRepository;
        this.scenarioRepository = scenarioRepository;
        this.outreachRepository = outreachRepository;
    }

    @Transactional(readOnly = true)
    public ContactsResponse list(UUID engagementId, UUID userId) {
        Engagement engagement = engagementRepository.findByIdAndUserId(engagementId, userId)
                .orElseThrow(() -> new NotFoundException("Engagement", engagementId));
        return toResponse(engagement, outreachRepository.findByEngagementId(engagementId));
    }

    @Transactional
    public ContactsResponse choose(UUID engagementId, UUID userId, UUID personaId) {
        Engagement engagement = engagementRepository.findByIdAndUserIdForUpdate(engagementId, userId)
                .orElseThrow(() -> new NotFoundException("Engagement", engagementId));
        if (engagement.getState() != EngagementState.HYPOTHESIS_READY
                && engagement.getState() != EngagementState.OUTREACHING) {
            throw new ContactChoiceNotOpenException("Finish your research before choosing who to contact.");
        }

        Persona contact = scenarioOf(engagement).getPersonas().stream()
                .filter(p -> p.getId().equals(personaId))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Contact", personaId));

        List<OutreachAttempt> attempts = outreachRepository.findByEngagementId(engagementId);
        int round = engagement.getOutreachRound();
        if (!ContactAttemptPolicy.canChangeContact(attempts, engagement.getContactPersonaId(), round)) {
            throw new ContactChoiceNotOpenException(
                    "You are already emailing this contact. You can choose someone else after "
                            + ContactAttemptPolicy.MAX_EMAILS_PER_CONTACT + " emails without a meeting.");
        }
        if (ContactAttemptPolicy.isExhausted(ContactAttemptPolicy.emailsTo(attempts, personaId, round))) {
            throw new ContactChoiceNotOpenException("You have already used all your emails to this contact.");
        }

        if (!contact.getId().equals(engagement.getContactPersonaId())) {
            engagement.chooseContact(contact.getId());
            engagementRepository.save(engagement);
        }
        return toResponse(engagement, attempts);
    }

    private ContactsResponse toResponse(Engagement engagement, List<OutreachAttempt> attempts) {
        int round = engagement.getOutreachRound();
        List<ContactsResponse.Contact> contacts = scenarioOf(engagement).getPersonas().stream()
                .map(p -> {
                    List<OutreachAttempt> sent = ContactAttemptPolicy.emailsTo(attempts, p.getId(), round);
                    return new ContactsResponse.Contact(
                            p.getId(), p.getName(), p.getJobTitle(), p.getOrganisation(), p.getVisibleConcerns(),
                            sent.size(),
                            Math.max(0, ContactAttemptPolicy.MAX_EMAILS_PER_CONTACT - sent.size()),
                            ContactAttemptPolicy.isExhausted(sent),
                            p.getId().equals(engagement.getContactPersonaId()));
                })
                .toList();
        return new ContactsResponse(
                round,
                engagement.getContactPersonaId(),
                ContactAttemptPolicy.canChangeContact(attempts, engagement.getContactPersonaId(), round),
                contacts);
    }

    private Scenario scenarioOf(Engagement engagement) {
        return scenarioRepository.findById(engagement.getScenarioId())
                .orElseThrow(() -> new NotFoundException("Scenario", engagement.getScenarioId()));
    }

    public static class ContactChoiceNotOpenException extends DomainException {
        public ContactChoiceNotOpenException(String message) {
            super(message);
        }
    }
}
