package com.ibm.consulting.sim.proposal.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ibm.consulting.sim.ai.application.AiOrchestrationService;
import com.ibm.consulting.sim.engagement.domain.Engagement;
import com.ibm.consulting.sim.engagement.domain.EngagementRepository;
import com.ibm.consulting.sim.engagement.domain.EngagementState;
import com.ibm.consulting.sim.lead.domain.ResearchEvidenceRepository;
import com.ibm.consulting.sim.meeting.domain.ConversationTurnRepository;
import com.ibm.consulting.sim.meeting.domain.ConversationTurn;
import com.ibm.consulting.sim.meeting.domain.Meeting;
import com.ibm.consulting.sim.meeting.domain.MeetingCompletionOutcome;
import com.ibm.consulting.sim.meeting.domain.MeetingRepository;
import com.ibm.consulting.sim.meeting.domain.PersonaStateRepository;
import com.ibm.consulting.sim.proposal.domain.Proposal;
import com.ibm.consulting.sim.proposal.domain.ProposalDraftContent;
import com.ibm.consulting.sim.proposal.domain.ProposalRepository;
import com.ibm.consulting.sim.scenario.application.DifficultyProfileService;
import com.ibm.consulting.sim.scenario.application.PersonaCatalogService;
import com.ibm.consulting.sim.scenario.domain.DifficultyProfile;
import com.ibm.consulting.sim.shared.config.CacheConfig;
import org.junit.jupiter.api.Test;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ProposalServiceTest {

    @Test
    void workspaceExcludesProviderFallbacksAndExposesTheEngagementCoverageThreshold() {
        UUID userId = UUID.randomUUID();
        Engagement engagement = engagementInMeeting(UUID.randomUUID(), userId);
        Meeting meeting = Meeting.start(engagement.getId(), UUID.randomUUID());
        var fallback = ConversationTurn.personaTurn(meeting.getId(), 2,
                "Sorry, could you repeat that? I want to make sure I understand you correctly.", "");
        var answer = ConversationTurn.personaTurn(meeting.getId(), 4,
                "The operations director owns delivery.", "");
        EngagementRepository engagements = mock(EngagementRepository.class);
        MeetingRepository meetings = mock(MeetingRepository.class);
        ConversationTurnRepository turns = mock(ConversationTurnRepository.class);
        DifficultyProfileService difficulty = mock(DifficultyProfileService.class);
        when(engagements.findByIdAndUserId(engagement.getId(), userId)).thenReturn(Optional.of(engagement));
        when(meetings.findByEngagementId(engagement.getId())).thenReturn(Optional.of(meeting));
        when(turns.findByMeetingIdOrderBySequenceAsc(meeting.getId())).thenReturn(List.of(fallback, answer));
        when(difficulty.forEngagement(engagement)).thenReturn(
                DifficultyProfile.defaults(1, 1, 1, 1));
        ProposalService service = new ProposalService(mock(ProposalRepository.class), engagements,
                mock(ResearchEvidenceRepository.class), mock(PersonaStateRepository.class), meetings, turns,
                mock(AiOrchestrationService.class), new ObjectMapper(), mock(PersonaCatalogService.class), difficulty,
                new ConcurrentMapCacheManager(CacheConfig.PROPOSAL_REVIEW_CACHE), mock(ApplicationEventPublisher.class));

        var workspace = service.workspace(engagement.getId(), userId);

        assertThat(workspace.evidenceCoverageThreshold()).isEqualTo(50);
        assertThat(workspace.sources()).extracting(ProposalSource::content).containsExactly(answer.getContent());
    }

    @Test
    void repairsAnOlderPassedMeetingStateBeforeSavingTheDraft() {
        UUID engagementId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Engagement engagement = engagementInMeeting(engagementId, userId);
        Meeting passedMeeting = Meeting.start(engagementId, UUID.randomUUID());
        passedMeeting.complete(MeetingCompletionOutcome.PASSED, "Passed", List.of());

        ProposalRepository proposalRepository = mock(ProposalRepository.class);
        EngagementRepository engagementRepository = mock(EngagementRepository.class);
        MeetingRepository meetingRepository = mock(MeetingRepository.class);
        when(engagementRepository.findByIdAndUserIdForUpdate(engagementId, userId)).thenReturn(Optional.of(engagement));
        when(meetingRepository.findByEngagementId(nullable(UUID.class))).thenReturn(Optional.of(passedMeeting));
        when(proposalRepository.findByEngagementId(engagementId)).thenReturn(Optional.empty());
        when(proposalRepository.save(any(Proposal.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ProposalService service = new ProposalService(proposalRepository, engagementRepository,
                mock(ResearchEvidenceRepository.class), mock(PersonaStateRepository.class), meetingRepository,
                mock(ConversationTurnRepository.class), mock(AiOrchestrationService.class), new ObjectMapper(),
                mock(PersonaCatalogService.class), mock(DifficultyProfileService.class),
                new ConcurrentMapCacheManager(CacheConfig.PROPOSAL_REVIEW_CACHE),
                mock(ApplicationEventPublisher.class));

        service.saveDraft(engagementId, userId, draft());

        assertThat(engagement.getState()).isEqualTo(EngagementState.PROPOSAL_DRAFT);
    }

    private Engagement engagementInMeeting(UUID engagementId, UUID userId) {
        Engagement engagement = Engagement.start(userId, UUID.randomUUID(), UUID.randomUUID());
        engagement.selectLead(engagementId);
        engagement.transitionTo(EngagementState.HYPOTHESIS_READY, "Hypothesis submitted");
        engagement.transitionTo(EngagementState.OUTREACHING, "Outreach started");
        engagement.transitionTo(EngagementState.MEETING_SECURED, "Meeting accepted");
        engagement.transitionTo(EngagementState.PREPARING, "Preparation started");
        engagement.transitionTo(EngagementState.IN_MEETING, "Meeting started");
        return engagement;
    }

    private ProposalDraftContent draft() {
        return new ProposalDraftContent("A grounded client problem statement", "A focused pilot recommendation",
                List.of("Read-only integration pilot"), BigDecimal.valueOf(180_000), 8,
                "UNCONFIRMED", "Consultant estimate", List.of(), List.of(), List.of(), List.of(), List.of());
    }
}
