package com.ibm.consulting.sim.engagement.domain;

import com.ibm.consulting.sim.shared.domain.BaseEntity;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "engagements")
public class Engagement extends BaseEntity {

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private UUID scenarioId;

    @Column(nullable = false)
    private UUID personaId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EngagementState state;

    private UUID selectedLeadId;

    private Instant completedAt;

    /** Immutable JSON snapshot of the resolved gameplay profile for this run. */
    @Column(name = "difficulty_profile_snapshot", columnDefinition = "text")
    private String difficultyProfileSnapshot;

    /** Immutable lineage link when this run was restarted after a failed meeting. */
    @Column(name = "retry_of_engagement_id")
    private UUID retryOfEngagementId;

    /** The contact the learner is emailing now; null until they choose one. */
    @Column(name = "contact_persona_id")
    private UUID contactPersonaId;

    /** Starts at 1. Goes up each time every contact fails and the learner returns to research. */
    @Column(name = "outreach_round", nullable = false)
    private int outreachRound = 1;

    @OneToMany(mappedBy = "engagement", cascade = CascadeType.ALL, orphanRemoval = true,
            fetch = FetchType.LAZY)
    @OrderBy("occurredAt ASC")
    private List<EngagementEvent> events = new ArrayList<>();

    protected Engagement() {}

    public static Engagement start(UUID userId, UUID scenarioId, UUID personaId) {
        return start(userId, scenarioId, personaId, null);
    }

    public static Engagement start(UUID userId, UUID scenarioId, UUID personaId, String difficultyProfileSnapshot) {
        return start(userId, scenarioId, personaId, difficultyProfileSnapshot, null);
    }

    public static Engagement start(UUID userId, UUID scenarioId, UUID personaId, String difficultyProfileSnapshot,
                                   UUID retryOfEngagementId) {
        Engagement e = new Engagement();
        e.userId = userId;
        e.scenarioId = scenarioId;
        e.personaId = personaId;
        e.difficultyProfileSnapshot = difficultyProfileSnapshot;
        e.retryOfEngagementId = retryOfEngagementId;
        e.state = EngagementState.QUALIFYING;
        e.recordEvent(retryOfEngagementId == null
                ? "Engagement started"
                : "Retry started from failed engagement: " + retryOfEngagementId);
        return e;
    }

    public void transitionTo(EngagementState newState, String reason) {
        EngagementPolicy.assertValidTransition(this.state, newState);
        this.state = newState;
        if (newState == EngagementState.COMPLETED) {
            this.completedAt = Instant.now();
        }
        recordEvent(reason);
    }

    public void selectLead(UUID leadId) {
        this.selectedLeadId = leadId;
        transitionTo(EngagementState.CLIENT_INTELLIGENCE, "Lead selected: " + leadId);
    }

    /** The selected lead defines the run's tier before client work begins. */
    public void selectLead(UUID leadId, String difficultyProfileSnapshot) {
        this.difficultyProfileSnapshot = difficultyProfileSnapshot;
        selectLead(leadId);
    }

    /** Choose contact: the learner decides who to email. Rules live in ContactService. */
    public void chooseContact(UUID personaId) {
        this.contactPersonaId = personaId;
        recordEvent("Contact chosen: " + personaId);
    }

    /** The contact who accepted becomes the client the meeting is held with. */
    public void meetWith(UUID personaId) {
        this.personaId = personaId;
    }

    /**
     * Every contact used their emails without a meeting: back to research, with
     * research kept and every contact given fresh attempts in a new round.
     */
    public void startNewOutreachRound() {
        // Transition first: if the move isn't allowed, nothing else changes.
        transitionTo(EngagementState.HYPOTHESIS_READY,
                "No contact agreed to meet; back to research for outreach round " + (outreachRound + 1));
        this.outreachRound += 1;
        this.contactPersonaId = null;
    }

    /** Records a failed attempt without changing the engagement's lifecycle state. */
    public void recordActivity(String description) {
        recordEvent(description);
    }

    private void recordEvent(String description) {
        events.add(EngagementEvent.create(this, state, description));
    }

    public UUID getUserId() { return userId; }
    public UUID getScenarioId() { return scenarioId; }
    public UUID getPersonaId() { return personaId; }
    public EngagementState getState() { return state; }
    public UUID getSelectedLeadId() { return selectedLeadId; }
    public Instant getCompletedAt() { return completedAt; }
    public List<EngagementEvent> getEvents() { return Collections.unmodifiableList(events); }
    public String getDifficultyProfileSnapshot() { return difficultyProfileSnapshot; }
    public UUID getRetryOfEngagementId() { return retryOfEngagementId; }
    public UUID getContactPersonaId() { return contactPersonaId; }
    public int getOutreachRound() { return outreachRound; }
}
