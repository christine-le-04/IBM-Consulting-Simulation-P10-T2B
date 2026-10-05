package com.ibm.consulting.sim.meeting.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ibm.consulting.sim.ai.application.AiOrchestrationService;
import com.ibm.consulting.sim.ai.domain.PersonaStateDelta;
import com.ibm.consulting.sim.ai.domain.PersonaTurnResponse;
import com.ibm.consulting.sim.engagement.domain.Engagement;
import com.ibm.consulting.sim.engagement.domain.EngagementRepository;
import com.ibm.consulting.sim.engagement.domain.EngagementState;
import com.ibm.consulting.sim.knowledge.application.KnowledgeRetrievalService;
import com.ibm.consulting.sim.lead.domain.ResearchEvidenceRepository;
import com.ibm.consulting.sim.meeting.domain.*;
import com.ibm.consulting.sim.scenario.application.DifficultyProfileService;
import com.ibm.consulting.sim.scenario.application.PersonaCatalogService;
import com.ibm.consulting.sim.scenario.domain.DifficultyProfile;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class MeetingRetryServiceTest {

    private final UUID userId = UUID.randomUUID();
    private final Engagement engagement = inMeetingEngagement();
    private final DifficultyProfile profile = DifficultyProfile.defaults(3, 3, 3, 3);
    private final List<Meeting> attempts = new ArrayList<>();
    private final MeetingRepository meetings = mock(MeetingRepository.class);
    private final EngagementRepository engagements = mock(EngagementRepository.class);
    private final PersonaStateRepository states = mock(PersonaStateRepository.class);
    private final ConversationTurnRepository turns = mock(ConversationTurnRepository.class);
    private final ResearchEvidenceRepository evidence = mock(ResearchEvidenceRepository.class);
    private final DifficultyProfileService difficulty = mock(DifficultyProfileService.class);
    private final PersonaState state = PersonaState.initial(engagement.getId(), profile);
    private MeetingService service;

    @BeforeEach
    void setUp() {
        service = new MeetingService(meetings, turns, states, mock(MeetingPreparationRepository.class),
                engagements, mock(PersonaCatalogService.class), evidence, mock(AiOrchestrationService.class),
                new ObjectMapper(), mock(TranscriptExportService.class), mock(KnowledgeRetrievalService.class),
                difficulty, mock(GuidedMeetingResponseService.class));
        when(engagements.findByIdAndUserId(engagement.getId(), userId)).thenReturn(Optional.of(engagement));
        when(engagements.findByIdAndUserIdForUpdate(engagement.getId(), userId)).thenReturn(Optional.of(engagement));
        when(engagements.findById(engagement.getId())).thenReturn(Optional.of(engagement));
        when(meetings.findAllByEngagementIdOrderByCreatedAtAsc(engagement.getId())).thenReturn(attempts);
        when(states.findByEngagementId(engagement.getId())).thenReturn(Optional.of(state));
        when(difficulty.forEngagement(engagement)).thenReturn(profile);
        when(meetings.save(any(Meeting.class))).thenAnswer(invocation -> {
            Meeting meeting = invocation.getArgument(0);
            attempts.add(meeting);
            return meeting;
        });
    }

    @Test
    void retryStartsACleanConversationAndPreservesTheFailedAttemptAndChosenContact() {
        Meeting failed = failure();
        changeRelationship();
        UUID leadId = engagement.getSelectedLeadId();
        UUID contactId = engagement.getContactPersonaId();

        MeetingResponse retry = service.retry(failed.getId(), userId);

        assertThat(retry.id()).isNotEqualTo(failed.getId());
        assertThat(retry.status()).isEqualTo("IN_PROGRESS");
        assertThat(attempts).hasSize(2);
        assertThat(failed.getStatus()).isEqualTo(MeetingStatus.COMPLETED);
        assertThat(failed.getCompletionOutcome()).isEqualTo(MeetingCompletionOutcome.FAILED);
        assertThat(state.getTrust()).isEqualTo(50);
        assertThat(state.getInterest()).isEqualTo(50);
        assertThat(state.getPatience()).isEqualTo(50);
        assertThat(state.getDisclosedFacts()).isEmpty();
        assertThat(engagement.getSelectedLeadId()).isEqualTo(leadId);
        assertThat(engagement.getContactPersonaId()).isEqualTo(contactId);
        verifyNoInteractions(turns, evidence);
    }

    @Test
    void aRepeatedRetryReturnsTheAlreadyStartedMeetingWithoutResettingItAgain() {
        Meeting failed = failure();
        MeetingResponse first = service.retry(failed.getId(), userId);
        changeRelationship();
        int trustBeforeReplay = state.getTrust();

        MeetingResponse replay = service.retry(failed.getId(), userId);

        assertThat(replay.id()).isEqualTo(first.id());
        assertThat(attempts).hasSize(2);
        assertThat(state.getTrust()).isEqualTo(trustBeforeReplay);
        assertThat(state.getDisclosedFacts()).containsExactly("decision_process");
        verify(states, times(1)).save(state);
        verify(meetings, times(1)).save(any(Meeting.class));
    }

    @Test
    void thirdFailureCannotStartAFourthMeetingInTheSameCycle() {
        failure();
        failure();
        Meeting latest = failure();

        assertThatThrownBy(() -> service.retry(latest.getId(), userId))
                .isInstanceOf(MeetingService.MeetingRetryNotAvailableException.class);

        assertThat(attempts).hasSize(3);
        verify(meetings, never()).save(any());
        verify(states, never()).save(any());
    }

    @Test
    void existingThreeFailureRunCanReturnToPreparationWithoutWaitingForAFourthAttempt() {
        failure();
        failure();
        Meeting latest = failure();
        assertThat(engagement.getState()).isEqualTo(EngagementState.IN_MEETING);

        service.returnToPreparation(latest.getId(), userId);

        assertThat(engagement.getState()).isEqualTo(EngagementState.MEETING_SECURED);
        assertThat(engagement.getMeetingRetryBaseline()).isEqualTo(3);
        assertThat(attempts).hasSize(3);
    }

    @Test
    void returningToPreparationResetsTheCycleOnceWithoutDeletingEarlierAttempts() {
        for (int index = 0; index < 3; index++) failure();
        Meeting latest = attempts.getLast();
        engagement.transitionTo(EngagementState.MEETING_FAILED, "Retries exhausted");
        changeRelationship();
        UUID leadId = engagement.getSelectedLeadId();

        service.returnToPreparation(latest.getId(), userId);
        service.returnToPreparation(latest.getId(), userId);

        assertThat(engagement.getState()).isEqualTo(EngagementState.MEETING_SECURED);
        assertThat(engagement.getMeetingRetryBaseline()).isEqualTo(3);
        assertThat(engagement.getSelectedLeadId()).isEqualTo(leadId);
        assertThat(attempts).hasSize(3).allSatisfy(attempt ->
                assertThat(attempt.getStatus()).isEqualTo(MeetingStatus.COMPLETED));
        assertThat(state.getTrust()).isEqualTo(50);
        assertThat(state.getDisclosedFacts()).isEmpty();
        verify(states, times(1)).save(state);
        verify(engagements, times(1)).save(engagement);
        verifyNoInteractions(turns, evidence);
    }

    @Test
    void preparationCannotBeUsedToSkipRemainingLiveRetries() {
        Meeting failed = failure();
        changeRelationship();
        int trustBefore = state.getTrust();

        assertThatThrownBy(() -> service.returnToPreparation(failed.getId(), userId))
                .isInstanceOf(InvalidMeetingStateException.class)
                .hasMessageContaining("remaining live meeting retries");

        assertThat(engagement.getState()).isEqualTo(EngagementState.IN_MEETING);
        assertThat(engagement.getMeetingRetryBaseline()).isZero();
        assertThat(state.getTrust()).isEqualTo(trustBefore);
        verify(states, never()).save(any());
        verify(engagements, never()).save(any());
    }

    @Test
    void anOlderFailedAttemptCannotResetTheLatestCycle() {
        Meeting older = failure();
        failure();

        assertThatThrownBy(() -> service.returnToPreparation(older.getId(), userId))
                .isInstanceOf(InvalidMeetingStateException.class)
                .hasMessageContaining("latest performance-failed meeting");

        assertThat(engagement.getMeetingRetryBaseline()).isZero();
        verify(states, never()).save(any());
        verify(engagements, never()).save(any());
    }

    private Meeting failure() {
        Meeting failed = Meeting.start(engagement.getId(), engagement.getPersonaId());
        failed.complete(MeetingCompletionOutcome.FAILED, "The client needs a clearer next step.", List.of());
        attempts.add(failed);
        when(meetings.findById(failed.getId())).thenReturn(Optional.of(failed));
        return failed;
    }

    private void changeRelationship() {
        PersonaStateEngine.apply(state, new PersonaTurnResponse("Please validate the decision process.", List.of(),
                new PersonaStateDelta(-7, -4, -6), List.of("decision_process"), null,
                List.of(), new PersonaTurnResponse.SafetyCheck(true, null)));
    }

    private Engagement inMeetingEngagement() {
        Engagement engagement = Engagement.start(userId, UUID.randomUUID(), UUID.randomUUID());
        engagement.selectLead(UUID.randomUUID());
        engagement.transitionTo(EngagementState.HYPOTHESIS_READY, "Research ready");
        engagement.chooseContact(UUID.randomUUID());
        engagement.transitionTo(EngagementState.OUTREACHING, "Outreach started");
        engagement.transitionTo(EngagementState.MEETING_SECURED, "Meeting secured");
        engagement.transitionTo(EngagementState.PREPARING, "Preparation ready");
        engagement.transitionTo(EngagementState.IN_MEETING, "Meeting started");
        return engagement;
    }
}
