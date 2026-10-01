package com.ibm.consulting.sim.outreach.application;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ibm.consulting.sim.ai.application.AiOrchestrationService;
import com.ibm.consulting.sim.ai.domain.AiProviderException;
import com.ibm.consulting.sim.ai.domain.OutreachEvaluationResult;
import com.ibm.consulting.sim.ai.infrastructure.OutreachEvaluationParser;
import com.ibm.consulting.sim.engagement.domain.Engagement;
import com.ibm.consulting.sim.engagement.domain.EngagementRepository;
import com.ibm.consulting.sim.engagement.domain.EngagementState;
import com.ibm.consulting.sim.lead.domain.Lead;
import com.ibm.consulting.sim.lead.domain.LeadRepository;
import com.ibm.consulting.sim.lead.domain.ResearchEvidenceRepository;
import com.ibm.consulting.sim.outreach.domain.ContactAttemptPolicy;
import com.ibm.consulting.sim.outreach.domain.OutreachAttempt;
import com.ibm.consulting.sim.outreach.domain.OutreachContentPolicy;
import com.ibm.consulting.sim.outreach.domain.OutreachNextAction;
import com.ibm.consulting.sim.outreach.domain.OutreachOutcome;
import com.ibm.consulting.sim.outreach.domain.OutreachOutcomePolicy;
import com.ibm.consulting.sim.outreach.domain.OutreachRepository;
import com.ibm.consulting.sim.outreach.domain.OutreachRequestPolicy;
import com.ibm.consulting.sim.scenario.application.DifficultyProfileService;
import com.ibm.consulting.sim.scenario.domain.DifficultyProfile;
import com.ibm.consulting.sim.scenario.domain.Persona;
import com.ibm.consulting.sim.scenario.domain.Scenario;
import com.ibm.consulting.sim.scenario.domain.ScenarioRepository;
import com.ibm.consulting.sim.shared.domain.DomainException;
import com.ibm.consulting.sim.shared.domain.NotFoundException;

@Service
public class OutreachService {

    private static final int MAX_ATTEMPTS = ContactAttemptPolicy.MAX_EMAILS_PER_CONTACT;
    private static final int PROMPT_VERSION = 1;
    private static final byte[] IDEMPOTENCY_NAMESPACE =
            "consulting-sim:outreach-attempt:v1".getBytes(StandardCharsets.UTF_8);

    private final OutreachRepository outreachRepository;
    private final EngagementRepository engagementRepository;
    private final AiOrchestrationService aiOrchestrationService;
    private final OutreachEvaluationParser parser;
    private final DifficultyProfileService difficultyProfileService;
    private final LeadRepository leadRepository;
    private final ResearchEvidenceRepository evidenceRepository;
    private final ScenarioRepository scenarioRepository;

    public OutreachService(OutreachRepository outreachRepository,
                           EngagementRepository engagementRepository,
                           AiOrchestrationService aiOrchestrationService,
                           ObjectMapper objectMapper,
                           DifficultyProfileService difficultyProfileService,
                           LeadRepository leadRepository,
                           ResearchEvidenceRepository evidenceRepository,
                           ScenarioRepository scenarioRepository) {
        this.outreachRepository = outreachRepository;
        this.engagementRepository = engagementRepository;
        this.aiOrchestrationService = aiOrchestrationService;
        this.parser = new OutreachEvaluationParser(objectMapper);
        this.difficultyProfileService = difficultyProfileService;
        this.leadRepository = leadRepository;
        this.evidenceRepository = evidenceRepository;
        this.scenarioRepository = scenarioRepository;
    }

    @Transactional
    public OutreachResponse send(UUID engagementId, UUID userId, String subject, String body) {
        return send(engagementId, userId, subject, body, null);
    }

    @Transactional
    public OutreachResponse send(UUID engagementId, UUID userId, String subject, String body,
                                 String requestId) {
        Engagement engagement = engagementRepository.findByIdAndUserIdForUpdate(engagementId, userId)
                .orElseThrow(() -> new NotFoundException("Engagement", engagementId));
        String normalizedRequestId = normalizeRequestId(requestId);
        UUID idempotentAttemptId = normalizedRequestId == null
                ? null
                : idempotentAttemptId(engagementId, normalizedRequestId);

        if (idempotentAttemptId != null) {
            var existing = outreachRepository.findById(idempotentAttemptId);
            if (existing.isPresent()) {
                OutreachAttempt attempt = existing.get();
                if (!attempt.getEngagementId().equals(engagementId)
                        || !attempt.getSubject().equals(subject)
                        || !attempt.getBody().equals(body)) {
                    throw new IdempotencyKeyConflictException(normalizedRequestId);
                }
                return OutreachResponse.from(attempt);
            }
        }

        if (engagement.getState() != EngagementState.HYPOTHESIS_READY
                && engagement.getState() != EngagementState.OUTREACHING) {
            throw new InvalidOutreachStateException(engagement.getState());
        }

        // Choose contact: every email goes to the contact the learner chose.
        UUID contactId = engagement.getContactPersonaId();
        if (contactId == null) {
            throw new ContactNotChosenException();
        }
        Scenario scenario = scenarioRepository.findById(engagement.getScenarioId())
                .orElseThrow(() -> new NotFoundException("Scenario", engagement.getScenarioId()));
        Persona contact = scenario.getPersonas().stream()
                .filter(p -> p.getId().equals(contactId))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Contact", contactId));
        int round = engagement.getOutreachRound();

        List<OutreachAttempt> existingAttempts = outreachRepository.findByEngagementId(engagementId);
        List<OutreachAttempt> emailsToContact = ContactAttemptPolicy.emailsTo(existingAttempts, contactId, round);
        emailsToContact.stream()
                .max(Comparator.comparingInt(OutreachAttempt::getAttemptNumber))
                .ifPresent(this::assertFollowUpIsAllowed);

        // The limit is per contact; attempt numbers stay unique across the engagement.
        if (emailsToContact.size() >= MAX_ATTEMPTS) {
            throw new MaxOutreachAttemptsException();
        }
        int attemptNumber = existingAttempts.size() + 1;

        // Transition to in-progress
        if (engagement.getState() == EngagementState.HYPOTHESIS_READY) {
            engagement.transitionTo(EngagementState.OUTREACHING, "Outreach attempt #" + attemptNumber);
        }

        OutreachAttempt attempt = idempotentAttemptId == null
                ? OutreachAttempt.create(engagementId, attemptNumber, subject, body)
                : OutreachAttempt.createIdempotent(
                        idempotentAttemptId, engagementId, attemptNumber, subject, body);
        attempt.assignContact(contactId, round);
        DifficultyProfile profile = difficultyProfileService.forEngagement(engagement);
        Lead lead = leadRepository.findById(engagement.getSelectedLeadId())
                .orElseThrow(() -> new NotFoundException("Lead", engagement.getSelectedLeadId()));
        List<String> evidenceNotes = evidenceRepository.findByEngagementId(engagementId).stream()
                .map(evidence -> evidence.getNote())
                .toList();

        OutreachEvaluationResult evaluation = aiOrchestrationService.execute(
                "outreach_evaluation",
                engagementId,
                buildPrompt(subject, body, profile, lead, evidenceNotes),
                PROMPT_VERSION,
                parser,
                () -> { throw new AiProviderException("Client reply unavailable; no attempt was consumed"); });
        evaluation = OutreachContentPolicy.apply(evaluation, subject, body, lead.getCompanyName(),
                lead.getDecisionMaker(), evidenceNotes);

        // Every email is scored the same way, so scores never reveal who the
        // decision maker is. Only the decision maker can accept; a distractor
        // always declines with its pre-written reply.
        OutreachOutcome outcome;
        String clientReply;
        if (contact.isDecisionMaker()) {
            outcome = OutreachOutcomePolicy.decide(evaluation, profile);
            clientReply = evaluation.clientReply();
        } else {
            outcome = OutreachOutcome.REJECTED;
            clientReply = contact.distractorReply();
        }
        OutreachNextAction nextAction = OutreachRequestPolicy.nextActionFor(outcome, clientReply);
        attempt.resolve(clientReply, outcome, nextAction,
                evaluation.personalisation(), evaluation.relevance(),
                evaluation.clarity(), evaluation.callToAction());

        outreachRepository.save(attempt);

        if (outcome == OutreachOutcome.ACCEPTED) {
            // The meeting is held with the contact who accepted.
            engagement.meetWith(contactId);
            engagement.transitionTo(EngagementState.MEETING_SECURED, "Outreach outcome: " + outcome);
        } else {
            engagement.transitionTo(EngagementState.OUTREACHING, "Outreach outcome: " + outcome);
            List<OutreachAttempt> allAttempts = new java.util.ArrayList<>(existingAttempts);
            allAttempts.add(attempt);
            List<UUID> contactIds = scenario.getPersonas().stream().map(Persona::getId).toList();
            if (ContactAttemptPolicy.allExhausted(allAttempts, contactIds, round)) {
                engagement.startNewOutreachRound();
            }
        }
        engagementRepository.save(engagement);

        return OutreachResponse.from(attempt);
    }

    private String normalizeRequestId(String requestId) {
        if (requestId == null || requestId.isBlank()) {
            return null;
        }
        String normalized = requestId.trim();
        if (normalized.length() > 100) {
            throw new InvalidRequestIdException();
        }
        return normalized;
    }

    private UUID idempotentAttemptId(UUID engagementId, String requestId) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update(IDEMPOTENCY_NAMESPACE);
            digest.update((byte) 0);
            digest.update(ByteBuffer.allocate(16)
                    .putLong(engagementId.getMostSignificantBits())
                    .putLong(engagementId.getLeastSignificantBits())
                    .array());
            digest.update((byte) 0);
            byte[] hash = digest.digest(requestId.getBytes(StandardCharsets.UTF_8));

            // RFC 9562 version 8 identifies an application-defined, name-based UUID.
            hash[6] = (byte) ((hash[6] & 0x0f) | 0x80);
            hash[8] = (byte) ((hash[8] & 0x3f) | 0x80);
            ByteBuffer value = ByteBuffer.wrap(hash);
            return new UUID(value.getLong(), value.getLong());
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private void assertFollowUpIsAllowed(OutreachAttempt latestAttempt) {
        OutreachNextAction requiredAction = OutreachRequestPolicy.detailsFor(
                latestAttempt.getOutcome(), latestAttempt.getClientReply(), latestAttempt.getNextAction()).nextAction();
        if (requiredAction == OutreachNextAction.SUBMIT_CAPABILITY_BRIEF) {
            throw new RequiredOutreachActionException(
                    "The client requested a capability brief. Submit the requested document before sending another email.");
        }
    }

    private String buildPrompt(String subject, String body, DifficultyProfile profile, Lead lead,
                               List<String> evidenceNotes) {
        return """
                You are evaluating a cold outreach email from a trainee consultant to a prospective client.
                Assess personalisation, relevance, clarity and call-to-action strength, then write a realistic
                client reply. Return ONLY JSON matching:
                {"clientReply": string, "outcome": "ACCEPTED"|"FOLLOW_UP_REQUIRED"|"REJECTED",
                 "scores": {"personalisation": 0-100, "relevance": 0-100, "clarity": 0-100, "callToAction": 0-100},
                 "reasonCodes": string[], "relationshipStateDelta": {"trust": int, "interest": int}}

                The deterministic engine requires an average quality score of %d/100 before a meeting can be accepted.
                You may recommend a likely outcome in the JSON, but the backend owns the final state transition.

                Client company: %s
                Named stakeholder: %s
                Client industry: %s
                Canonical client context the learner discovered (use only for relevance assessment): %s

                Subject: %s
                Body: %s
                """.formatted(profile.outreachAcceptanceThreshold(), lead.getCompanyName(),
                lead.getDecisionMaker() == null ? "Not yet identified" : lead.getDecisionMaker(), lead.getIndustry(),
                String.join(" | ", evidenceNotes.stream().limit(8).toList()), subject, body);
    }

    @Transactional(readOnly = true)
    public List<OutreachResponse> listAttempts(UUID engagementId, UUID userId) {
        engagementRepository.findByIdAndUserId(engagementId, userId)
                .orElseThrow(() -> new NotFoundException("Engagement", engagementId));
        return outreachRepository.findByEngagementId(engagementId).stream()
                .sorted(Comparator.comparingInt(OutreachAttempt::getAttemptNumber))
                .map(OutreachResponse::from)
                .toList();
    }

    public static class InvalidOutreachStateException extends DomainException {
        public InvalidOutreachStateException(EngagementState state) {
            super("Cannot send outreach in state: " + state);
        }
    }

    public static class MaxOutreachAttemptsException extends DomainException {
        public MaxOutreachAttemptsException() {
            super("You have sent %d emails to this contact. Choose someone else to contact.".formatted(MAX_ATTEMPTS));
        }
    }

    public static class ContactNotChosenException extends DomainException {
        public ContactNotChosenException() {
            super("Choose who you will contact before writing an email.");
        }
    }

    public static class RequiredOutreachActionException extends DomainException {
        RequiredOutreachActionException(String message) {
            super(message);
        }
    }

    public static class IdempotencyKeyConflictException extends DomainException {
        IdempotencyKeyConflictException(String requestId) {
            super("Outreach request ID " + requestId + " was already used with different content");
        }
    }

    public static class InvalidRequestIdException extends DomainException {
        InvalidRequestIdException() {
            super("Outreach request ID must not exceed 100 characters");
        }
    }
}
