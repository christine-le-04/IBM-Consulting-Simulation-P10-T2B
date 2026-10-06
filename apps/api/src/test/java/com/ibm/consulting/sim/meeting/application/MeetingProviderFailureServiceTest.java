package com.ibm.consulting.sim.meeting.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ibm.consulting.sim.ai.application.AiOrchestrationService;
import com.ibm.consulting.sim.ai.domain.AiProviderException;
import com.ibm.consulting.sim.engagement.domain.*;
import com.ibm.consulting.sim.knowledge.application.KnowledgeRetrievalService;
import com.ibm.consulting.sim.lead.domain.ResearchEvidenceRepository;
import com.ibm.consulting.sim.meeting.domain.*;
import com.ibm.consulting.sim.scenario.application.*;
import com.ibm.consulting.sim.scenario.domain.DifficultyProfile;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MeetingProviderFailureServiceTest {
    @Test
    void exhaustedProviderFallbackDoesNotPersistOrScoreATurn() {
        UUID userId = UUID.randomUUID();
        Engagement engagement = Engagement.start(userId, UUID.randomUUID(), UUID.randomUUID());
        engagement.selectLead(UUID.randomUUID());
        engagement.transitionTo(EngagementState.HYPOTHESIS_READY, "Research complete");
        engagement.transitionTo(EngagementState.OUTREACHING, "Email sent");
        engagement.transitionTo(EngagementState.MEETING_SECURED, "Booked");
        engagement.transitionTo(EngagementState.PREPARING, "Prepared");
        engagement.transitionTo(EngagementState.IN_MEETING, "Started");
        Meeting meeting = Meeting.start(engagement.getId(), engagement.getPersonaId());
        PersonaState state = PersonaState.initial(engagement.getId());
        MeetingRepository meetings = mock(MeetingRepository.class);
        ConversationTurnRepository turns = mock(ConversationTurnRepository.class);
        PersonaStateRepository states = mock(PersonaStateRepository.class);
        EngagementRepository engagements = mock(EngagementRepository.class);
        PersonaCatalogService personas = mock(PersonaCatalogService.class);
        DifficultyProfileService difficulty = mock(DifficultyProfileService.class);
        AiOrchestrationService ai = mock(AiOrchestrationService.class);
        when(meetings.findByIdForUpdate(meeting.getId())).thenReturn(Optional.of(meeting));
        when(engagements.findByIdAndUserId(engagement.getId(), userId)).thenReturn(Optional.of(engagement));
        when(states.findByEngagementId(engagement.getId())).thenReturn(Optional.of(state));
        when(personas.getPersona(engagement.getPersonaId())).thenReturn(new PersonaProfile());
        when(difficulty.forEngagement(engagement)).thenReturn(DifficultyProfile.defaults(3, 3, 3, 3));
        when(ai.execute(eq("persona_dialogue"), eq(engagement.getId()), anyString(), anyInt(), any(), any()))
                .thenAnswer(invocation -> ((Supplier<?>) invocation.getArgument(5)).get());
        MeetingService service = new MeetingService(meetings, turns, states,
                mock(MeetingPreparationRepository.class), engagements, personas,
                mock(ResearchEvidenceRepository.class), ai, new ObjectMapper(), mock(TranscriptExportService.class),
                mock(KnowledgeRetrievalService.class), difficulty, mock(GuidedMeetingResponseService.class));

        for (int attempt = 0; attempt < 2; attempt++) {
            assertThatThrownBy(() -> service.sendMessage(meeting.getId(), userId,
                    "Which delivery constraint causes the most delay?", "same-message"))
                    .isInstanceOf(AiProviderException.class);
        }
        verify(turns, never()).save(any());
        verify(states, never()).save(any());
        verify(meetings, never()).save(any());
        assertThat(state.getTrust()).isEqualTo(50);
        assertThat(state.getInterest()).isEqualTo(50);
        assertThat(state.getPatience()).isEqualTo(50);
        assertThat(meeting.getBehaviourLedger()).isEmpty();
        assertThat(engagement.getState()).isEqualTo(EngagementState.IN_MEETING);
    }
}
