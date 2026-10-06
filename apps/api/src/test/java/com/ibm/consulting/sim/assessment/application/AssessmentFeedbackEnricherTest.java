package com.ibm.consulting.sim.assessment.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ibm.consulting.sim.ai.application.AiOrchestrationService;
import com.ibm.consulting.sim.ai.domain.AssessmentFeedback;
import com.ibm.consulting.sim.assessment.domain.*;
import com.ibm.consulting.sim.meeting.domain.*;
import com.ibm.consulting.sim.outreach.domain.OutreachRepository;
import com.ibm.consulting.sim.proposal.domain.ProposalRepository;
import com.ibm.consulting.sim.shared.config.CacheConfig;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AssessmentFeedbackEnricherTest {
    @Test
    void coachingUsesRecordedActionsAndOmitsFailedProviderExchanges() {
        UUID engagementId = UUID.randomUUID();
        Meeting meeting = Meeting.start(engagementId, UUID.randomUUID());
        MeetingRepository meetings = mock(MeetingRepository.class);
        ConversationTurnRepository turns = mock(ConversationTurnRepository.class);
        AssessmentRepository assessments = mock(AssessmentRepository.class);
        AiOrchestrationService ai = mock(AiOrchestrationService.class);
        List<CompetencyScore> scores = List.of(new CompetencyScore("Relationship Building", 80, "Best score"));
        Assessment assessment = Assessment.create(engagementId, scores, 80, "PILOT_APPROVED", "Pending",
                List.of(), List.of(), AssessmentFeedbackStatus.PENDING);
        when(assessments.findByEngagementId(engagementId)).thenReturn(Optional.of(assessment));
        when(meetings.findByEngagementId(engagementId)).thenReturn(Optional.of(meeting));
        when(turns.findByMeetingIdOrderBySequenceAsc(meeting.getId())).thenReturn(List.of(
                ConversationTurn.learnerTurn(meeting.getId(), 1, "An unprocessed proposal"),
                ConversationTurn.personaTurn(meeting.getId(), 2,
                        "Sorry, could you repeat that? I want to make sure I understand you correctly.", ""),
                ConversationTurn.learnerTurn(meeting.getId(), 3, "Who owns the gate turnaround metric?"),
                ConversationTurn.personaTurn(meeting.getId(), 4, "The operations lead owns that metric.", "")));
        when(ai.execute(eq("assessment_feedback"), eq(engagementId), anyString(), anyInt(), any(), any()))
                .thenReturn(new AssessmentFeedback("You asked who owns the metric.",
                        List.of("Meeting turn 3 clarified ownership."), List.of("Confirm the baseline next.")));
        var enricher = new AssessmentFeedbackEnricher(assessments, ai, new ObjectMapper(),
                new ConcurrentMapCacheManager(CacheConfig.ASSESSMENT_FEEDBACK_CACHE),
                mock(OutreachRepository.class), meetings, turns, mock(ProposalRepository.class));

        enricher.enrich(new AssessmentGeneratedEvent(engagementId, scores, 80, "PILOT_APPROVED"));

        ArgumentCaptor<String> prompt = ArgumentCaptor.forClass(String.class);
        verify(ai).execute(eq("assessment_feedback"), eq(engagementId), prompt.capture(), anyInt(), any(), any());
        assertThat(prompt.getValue()).contains("pilot approved", "Who owns the gate turnaround metric?", "Meeting turn 3")
                .doesNotContain("PILOT_APPROVED", "An unprocessed proposal", "Sorry, could you repeat that?");
        assertThat(assessment.getStrengths()).containsExactly("Meeting turn 3 clarified ownership.");
        verify(assessments).save(assessment);
    }
}
