package com.ibm.consulting.sim.outreach.application;

import com.ibm.consulting.sim.engagement.domain.Engagement;
import com.ibm.consulting.sim.engagement.domain.EngagementRepository;
import com.ibm.consulting.sim.engagement.domain.EngagementState;
import com.ibm.consulting.sim.outreach.domain.OutreachAttempt;
import com.ibm.consulting.sim.outreach.domain.OutreachNextAction;
import com.ibm.consulting.sim.outreach.domain.OutreachOutcome;
import com.ibm.consulting.sim.outreach.domain.OutreachRepository;
import com.ibm.consulting.sim.scenario.domain.Persona;
import com.ibm.consulting.sim.scenario.domain.Scenario;
import com.ibm.consulting.sim.scenario.domain.ScenarioRepository;
import com.ibm.consulting.sim.shared.domain.NotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Choose contact: listing contacts and choosing who to email. */
class ContactServiceTest {

    private final UUID userId = UUID.randomUUID();
    private final EngagementRepository engagements = mock(EngagementRepository.class);
    private final ScenarioRepository scenarios = mock(ScenarioRepository.class);
    private final OutreachRepository outreach = mock(OutreachRepository.class);
    private final List<OutreachAttempt> sent = new ArrayList<>();

    private final Persona elena = Persona.create(null, "Elena Vargas", "VP Asset Operations", "AeroVector Aviation",
            "Direct", "Dispatch reliability is under executive review.", "Hidden", "Goals");
    private final Persona dan = Persona.createDistractor(null, "Dan Whitaker", "Head of Line Maintenance",
            "AeroVector Aviation", "Technicians lose shift time chasing parts.",
            "Not something I can take forward.", "That sits with Elena Vargas in Asset Operations.");

    private Engagement engagement;
    private ContactService service;

    @BeforeEach
    void setUp() {
        UUID scenarioId = UUID.randomUUID();
        engagement = Engagement.start(userId, scenarioId, elena.getId());
        engagement.selectLead(UUID.randomUUID());
        engagement.transitionTo(EngagementState.HYPOTHESIS_READY, "Research complete");

        Scenario scenario = mock(Scenario.class);
        when(scenario.getPersonas()).thenReturn(List.of(dan, elena));
        when(scenarios.findById(scenarioId)).thenReturn(Optional.of(scenario));
        when(engagements.findByIdAndUserId(engagement.getId(), userId)).thenReturn(Optional.of(engagement));
        when(engagements.findByIdAndUserIdForUpdate(engagement.getId(), userId)).thenReturn(Optional.of(engagement));
        when(outreach.findByEngagementId(engagement.getId())).thenAnswer(invocation -> List.copyOf(sent));

        service = new ContactService(engagements, scenarios, outreach);
    }

    private void email(Persona contact, OutreachOutcome... outcomes) {
        Arrays.stream(outcomes).forEach(outcome -> {
            OutreachAttempt attempt = OutreachAttempt.create(engagement.getId(), sent.size() + 1, "Subject", "Body");
            attempt.assignContact(contact.getId(), engagement.getOutreachRound());
            attempt.resolve("Reply", outcome, OutreachNextAction.NONE, 50, 50, 50, 50);
            sent.add(attempt);
        });
    }

    @Test
    void listsEveryContactWithNoEmailsSentYet() {
        ContactsResponse response = service.list(engagement.getId(), userId);

        assertThat(response.outreachRound()).isEqualTo(1);
        assertThat(response.currentContactId()).isNull();
        assertThat(response.canChangeContact()).isTrue();
        assertThat(response.contacts()).extracting(ContactsResponse.Contact::name)
                .containsExactly("Dan Whitaker", "Elena Vargas");
        assertThat(response.contacts()).allSatisfy(contact -> {
            assertThat(contact.emailsSent()).isZero();
            assertThat(contact.emailsLeft()).isEqualTo(3);
            assertThat(contact.usedUp()).isFalse();
            assertThat(contact.current()).isFalse();
        });
    }

    @Test
    void theResponseHasNoFieldThatRevealsTheDecisionMaker() {
        assertThat(ContactsResponse.Contact.class.getRecordComponents())
                .extracting(component -> component.getName())
                .doesNotContain("contactRole", "role", "declineReply", "hintReply", "decisionMaker");
    }

    @Test
    void choosingAContactAfterResearchSavesIt() {
        ContactsResponse response = service.choose(engagement.getId(), userId, dan.getId());

        assertThat(engagement.getContactPersonaId()).isEqualTo(dan.getId());
        assertThat(response.currentContactId()).isEqualTo(dan.getId());
        assertThat(response.contacts()).filteredOn(ContactsResponse.Contact::current)
                .extracting(ContactsResponse.Contact::name).containsExactly("Dan Whitaker");
        verify(engagements).save(engagement);
    }

    @Test
    void theContactCanBeChangedBeforeTheFirstEmail() {
        service.choose(engagement.getId(), userId, dan.getId());

        service.choose(engagement.getId(), userId, elena.getId());

        assertThat(engagement.getContactPersonaId()).isEqualTo(elena.getId());
    }

    @Test
    void theContactIsLockedAfterTheFirstEmail() {
        service.choose(engagement.getId(), userId, dan.getId());
        engagement.transitionTo(EngagementState.OUTREACHING, "Outreach started");
        email(dan, OutreachOutcome.REJECTED);

        assertThatThrownBy(() -> service.choose(engagement.getId(), userId, elena.getId()))
                .isInstanceOf(ContactService.ContactChoiceNotOpenException.class);
        assertThat(engagement.getContactPersonaId()).isEqualTo(dan.getId());
        assertThat(service.list(engagement.getId(), userId).canChangeContact()).isFalse();
    }

    @Test
    void afterThreeEmailsWithoutAMeetingAnotherContactCanBeChosen() {
        service.choose(engagement.getId(), userId, dan.getId());
        engagement.transitionTo(EngagementState.OUTREACHING, "Outreach started");
        email(dan, OutreachOutcome.REJECTED, OutreachOutcome.REJECTED, OutreachOutcome.REJECTED);

        ContactsResponse response = service.choose(engagement.getId(), userId, elena.getId());

        assertThat(engagement.getContactPersonaId()).isEqualTo(elena.getId());
        assertThat(response.contacts()).filteredOn(contact -> contact.name().equals("Dan Whitaker"))
                .singleElement()
                .satisfies(contact -> {
                    assertThat(contact.emailsSent()).isEqualTo(3);
                    assertThat(contact.emailsLeft()).isZero();
                    assertThat(contact.usedUp()).isTrue();
                });
    }

    @Test
    void aContactWhoUsedAllTheirEmailsCannotBeChosenAgainThisRound() {
        service.choose(engagement.getId(), userId, dan.getId());
        engagement.transitionTo(EngagementState.OUTREACHING, "Outreach started");
        email(dan, OutreachOutcome.REJECTED, OutreachOutcome.REJECTED, OutreachOutcome.REJECTED);
        service.choose(engagement.getId(), userId, elena.getId());

        assertThatThrownBy(() -> service.choose(engagement.getId(), userId, dan.getId()))
                .isInstanceOf(ContactService.ContactChoiceNotOpenException.class);
    }

    @Test
    void choosingIsNotOpenDuringResearch() {
        Engagement researching = Engagement.start(userId, engagement.getScenarioId(), elena.getId());
        researching.selectLead(UUID.randomUUID());
        when(engagements.findByIdAndUserIdForUpdate(researching.getId(), userId)).thenReturn(Optional.of(researching));

        assertThatThrownBy(() -> service.choose(researching.getId(), userId, elena.getId()))
                .isInstanceOf(ContactService.ContactChoiceNotOpenException.class);
        assertThat(researching.getContactPersonaId()).isNull();
    }

    @Test
    void aContactFromAnotherScenarioIsNotFound() {
        assertThatThrownBy(() -> service.choose(engagement.getId(), userId, UUID.randomUUID()))
                .isInstanceOf(NotFoundException.class);
        verify(engagements, never()).save(any());
    }

    @Test
    void anotherLearnersEngagementIsNotFound() {
        UUID stranger = UUID.randomUUID();
        when(engagements.findByIdAndUserId(engagement.getId(), stranger)).thenReturn(Optional.empty());
        when(engagements.findByIdAndUserIdForUpdate(engagement.getId(), stranger)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.list(engagement.getId(), stranger)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.choose(engagement.getId(), stranger, elena.getId()))
                .isInstanceOf(NotFoundException.class);
    }
}
