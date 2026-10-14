package com.ibm.consulting.sim.proposal.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ibm.consulting.sim.ai.application.AiOrchestrationService;
import com.ibm.consulting.sim.engagement.domain.*;
import com.ibm.consulting.sim.lead.domain.ResearchEvidenceRepository;
import com.ibm.consulting.sim.meeting.application.MeetingServiceTestFactory;
import com.ibm.consulting.sim.meeting.domain.*;
import com.ibm.consulting.sim.proposal.domain.*;
import com.ibm.consulting.sim.scenario.application.*;
import com.ibm.consulting.sim.scenario.domain.DifficultyProfile;
import com.ibm.consulting.sim.shared.config.CacheConfig;
import com.ibm.consulting.sim.shared.domain.NotFoundException;
import org.junit.jupiter.api.Test;
import org.springframework.cache.Cache;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.*;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ProposalFeedbackTransactionTest {
    @Test void allFeedbackCallsReleaseTransactionsAndResumeTheCallingTransaction() {
        Fixture f = new Fixture(MeetingServiceTestFactory.transactions(), null);
        new TransactionTemplate(f.transactions).executeWithoutResult(ignored -> {
            f.service.review(f.engagement.getId(), f.userId, draft("First draft"));
            f.service.challenge(f.engagement.getId(), f.userId, draft("First draft"));
            f.service.explainDecision(f.engagement.getId(), f.userId);
            f.service.counterfactual(f.engagement.getId(), f.userId);
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue();
        });
        assertThat(f.aiCalls.get()).isEqualTo(4);
        verify(f.proposals, never()).save(any());
        verify(f.engagements, never()).save(any());
    }

    @Test void cacheHitsStillCheckOwnershipAndChangedDraftsGenerateFreshReviews() {
        Fixture f = new Fixture(MeetingServiceTestFactory.transactions(), null);
        var first = f.service.review(f.engagement.getId(), f.userId, draft("First draft"));
        assertThat(f.service.review(f.engagement.getId(), f.userId, draft("First draft"))).isEqualTo(first);
        assertThat(f.aiCalls.get()).isEqualTo(1);
        f.service.review(f.engagement.getId(), f.userId, draft("Changed draft"));
        assertThat(f.aiCalls.get()).isEqualTo(2);
        doReturn(Optional.empty()).when(f.engagements).findByIdAndUserId(f.engagement.getId(), f.userId);
        assertThatThrownBy(() -> f.service.review(f.engagement.getId(), f.userId, draft("First draft")))
                .isInstanceOf(NotFoundException.class);
        assertThat(f.aiCalls.get()).isEqualTo(2);
    }

    @Test void concurrentReviewWaitersRetainNoReadTransactionAndReuseOneAiCall() throws Exception {
        TrackingTransactions transactions = new TrackingTransactions();
        CountDownLatch cacheReads = new CountDownLatch(2);
        Fixture f = new Fixture(transactions, cacheReads);
        CountDownLatch aiStarted = new CountDownLatch(1);
        CountDownLatch releaseAi = new CountDownLatch(1);
        doAnswer(invocation -> {
            assertOutsideTransaction();
            f.aiCalls.incrementAndGet();
            aiStarted.countDown();
            assertThat(releaseAi.await(5, TimeUnit.SECONDS)).isTrue();
            return invocation.<Supplier<?>>getArgument(5).get();
        }).when(f.ai).execute(anyString(), any(), anyString(), anyInt(), any(), any());
        try (var executor = Executors.newFixedThreadPool(2)) {
            try {
                Future<ProposalReviewResponse> first = executor.submit(() ->
                        f.service.review(f.engagement.getId(), f.userId, draft("First draft")));
                assertThat(aiStarted.await(5, TimeUnit.SECONDS)).isTrue();
                Future<ProposalReviewResponse> second = executor.submit(() ->
                        f.service.review(f.engagement.getId(), f.userId, draft("First draft")));
                assertThat(cacheReads.await(5, TimeUnit.SECONDS)).isTrue();
                assertThat(transactions.activeReads.get()).isZero();
                assertThat(second.isDone()).isFalse();
                releaseAi.countDown();
                assertThat(second.get(5, TimeUnit.SECONDS)).isEqualTo(first.get(5, TimeUnit.SECONDS));
                assertThat(f.aiCalls.get()).isEqualTo(1);
            } finally {
                releaseAi.countDown();
            }
        }
    }

    @Test void failedReviewReleasesCoalescingEntryAndAllowsRetry() {
        Fixture f = new Fixture(MeetingServiceTestFactory.transactions(), null);
        doThrow(new IllegalStateException("provider failed"))
                .doReturn(new ProposalReviewNarrative("Recovered review", List.of("Review evidence")))
                .when(f.ai).execute(anyString(), any(), anyString(), anyInt(), any(), any());
        assertThatThrownBy(() -> f.service.review(f.engagement.getId(), f.userId, draft("First draft")))
                .hasMessage("provider failed");
        assertThat(f.service.review(f.engagement.getId(), f.userId, draft("First draft")).executiveFeedback())
                .isEqualTo("Recovered review");
        verify(f.ai, times(2)).execute(anyString(), any(), anyString(), anyInt(), any(), any());
    }

    @Test void decisionPromptAndFallbackAreMaterializedBeforeLeavingDatabaseSession() {
        Fixture f = new Fixture(MeetingServiceTestFactory.transactions(), null);
        doAnswer(invocation -> {
            assertOutsideTransaction();
            when(f.proposal.getDecisionRationale()).thenThrow(new IllegalStateException("entity detached"));
            return invocation.<Supplier<?>>getArgument(5).get();
        }).when(f.ai).execute(anyString(), any(), anyString(), anyInt(), any(), any());
        assertThat(f.service.explainDecision(f.engagement.getId(), f.userId).message()).contains("Original rationale");
    }

    private static void assertOutsideTransaction() {
        assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
    }

    private static ProposalDraftContent draft(String problem) {
        return new ProposalDraftContent(problem, "Focused pilot", List.of("Read-only integration"),
                BigDecimal.valueOf(100_000), 8, "UNCONFIRMED", "Estimate", List.of(), List.of(), List.of(), List.of(), List.of());
    }

    private static final class Fixture {
        final UUID userId = UUID.randomUUID();
        final Engagement engagement = Engagement.start(userId, UUID.randomUUID(), UUID.randomUUID());
        final EngagementRepository engagements = mock(EngagementRepository.class);
        final ProposalRepository proposals = mock(ProposalRepository.class);
        final Proposal proposal = mock(Proposal.class);
        final AiOrchestrationService ai = mock(AiOrchestrationService.class);
        final AtomicInteger aiCalls = new AtomicInteger();
        final PlatformTransactionManager transactions;
        final ProposalService service;

        Fixture(PlatformTransactionManager transactions, CountDownLatch cacheReads) {
            this.transactions = transactions;
            engagement.selectLead(UUID.randomUUID());
            for (EngagementState state : List.of(EngagementState.HYPOTHESIS_READY, EngagementState.OUTREACHING,
                    EngagementState.MEETING_SECURED, EngagementState.PREPARING, EngagementState.IN_MEETING,
                    EngagementState.DISCOVERY_COMPLETE)) engagement.transitionTo(state, "Test setup");
            when(engagements.findByIdAndUserId(engagement.getId(), userId)).thenAnswer(ignored -> {
                assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue();
                assertThat(TransactionSynchronizationManager.isCurrentTransactionReadOnly()).isTrue();
                return Optional.of(engagement);
            });
            when(proposals.findByEngagementId(engagement.getId())).thenReturn(Optional.of(proposal));
            when(proposal.getStatus()).thenReturn(ProposalStatus.SUBMITTED);
            when(proposal.getDecisionRationale()).thenReturn("Original rationale");
            when(proposal.getDecisionDimensions()).thenAnswer(ignored -> {
                assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue();
                return List.of();
            });
            when(proposal.getDecisionInsights()).thenAnswer(ignored -> {
                assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue();
                return List.of();
            });
            DifficultyProfileService difficulty = mock(DifficultyProfileService.class);
            when(difficulty.forEngagement(engagement)).thenReturn(DifficultyProfile.defaults(3, 3, 3, 3));
            when(ai.execute(anyString(), any(), anyString(), anyInt(), any(), any())).thenAnswer(invocation -> {
                assertOutsideTransaction();
                aiCalls.incrementAndGet();
                return invocation.<Supplier<?>>getArgument(5).get();
            });
            var cache = new ConcurrentMapCacheManager(CacheConfig.PROPOSAL_REVIEW_CACHE) {
                @Override public Cache getCache(String name) {
                    assertOutsideTransaction();
                    if (cacheReads != null) cacheReads.countDown();
                    return super.getCache(name);
                }
            };
            service = new ProposalService(proposals, engagements, mock(ResearchEvidenceRepository.class),
                    mock(PersonaStateRepository.class), mock(MeetingRepository.class), mock(ConversationTurnRepository.class),
                    ai, new ObjectMapper(), mock(PersonaCatalogService.class), difficulty, cache,
                    mock(ApplicationEventPublisher.class), transactions);
        }
    }

    private static final class TrackingTransactions implements PlatformTransactionManager {
        final PlatformTransactionManager delegate = MeetingServiceTestFactory.transactions();
        final ConcurrentMap<TransactionStatus, Boolean> reads = new ConcurrentHashMap<>();
        final AtomicInteger activeReads = new AtomicInteger();
        public TransactionStatus getTransaction(TransactionDefinition definition) {
            TransactionStatus status = delegate.getTransaction(definition);
            if (definition != null && definition.isReadOnly()) {
                reads.put(status, true);
                activeReads.incrementAndGet();
            }
            return status;
        }
        public void commit(TransactionStatus status) {
            try { delegate.commit(status); } finally { completed(status); }
        }
        public void rollback(TransactionStatus status) {
            try { delegate.rollback(status); } finally { completed(status); }
        }
        private void completed(TransactionStatus status) {
            if (reads.remove(status) != null) activeReads.decrementAndGet();
        }
    }
}
