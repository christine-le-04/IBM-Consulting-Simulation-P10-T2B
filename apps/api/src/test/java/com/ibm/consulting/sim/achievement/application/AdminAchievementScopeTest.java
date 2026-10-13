package com.ibm.consulting.sim.achievement.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ibm.consulting.sim.achievement.domain.Achievement;
import com.ibm.consulting.sim.achievement.domain.AchievementRepository;
import com.ibm.consulting.sim.achievement.domain.ConditionType;
import com.ibm.consulting.sim.achievement.domain.LogicalOperator;
import com.ibm.consulting.sim.achievement.infrastructure.AchievementRuleCodec;
import com.ibm.consulting.sim.shared.domain.NotFoundException;
import com.ibm.consulting.sim.shared.infrastructure.observability.AuditLogger;

/** Generic/Exclusive scope, competency validation and backfill on publish. */
class AdminAchievementScopeTest {

    private final AchievementRepository achievements = mock(AchievementRepository.class);
    private final AchievementEvaluationService evaluation = mock(AchievementEvaluationService.class);
    private final ScenarioLineageLookup scenarios = mock(ScenarioLineageLookup.class);
    private AdminAchievementService service;

    private final UUID lineage = UUID.randomUUID();
    private final UUID currentRevision = UUID.randomUUID();
    private final ConditionNode oneRun = ConditionNode.leaf(ConditionType.MIN_ENGAGEMENTS_COMPLETED, null, 1);

    @BeforeEach
    void setUp() {
        service = new AdminAchievementService(achievements, new AchievementRuleMapper(),
                new AchievementRuleCodec(new ObjectMapper()), mock(AuditLogger.class), evaluation, scenarios);
        when(scenarios.lineageOf(currentRevision)).thenReturn(Optional.of(lineage));
        when(scenarios.current(lineage)).thenReturn(Optional.of(
                new ScenarioLineageLookup.CurrentRevision(currentRevision, "AeroVector: crew rostering", true)));
    }

    @Test
    void aGenericBadgeHasNoScenario() {
        AchievementAdminView view = service.create(new UpsertAchievementRequest("First run", "", "flag", oneRun));

        assertThat(view.scope()).isEqualTo(AchievementScope.GENERIC);
        assertThat(view.scenarioLineageId()).isNull();
    }

    @Test
    void anExclusiveBadgeIsStoredAgainstTheScenarioLineageAndShowsItsLiveTitle() {
        UUID olderRevision = UUID.randomUUID();
        when(scenarios.lineageOf(olderRevision)).thenReturn(Optional.of(lineage));

        AchievementAdminView view = service.create(
                new UpsertAchievementRequest("Rostering pro", "", "star", oneRun, olderRevision));

        ArgumentCaptor<Achievement> saved = ArgumentCaptor.forClass(Achievement.class);
        verify(achievements).save(saved.capture());
        assertThat(saved.getValue().getScenarioLineageId()).isEqualTo(lineage);
        assertThat(view.scope()).isEqualTo(AchievementScope.EXCLUSIVE);
        assertThat(view.scenarioId()).isEqualTo(currentRevision);
        assertThat(view.scenarioTitle()).isEqualTo("AeroVector: crew rostering");
        assertThat(view.scenarioLive()).isTrue();
    }

    @Test
    void publishingABadgeAwardsItToLearnersWhoAlreadyQualify() {
        service.create(new UpsertAchievementRequest("First run", "", "flag", oneRun));

        verify(evaluation).backfill(any(Achievement.class));
    }

    @Test
    void reactivatingABadgeBackfillsItButDeactivatingDoesNot() {
        Achievement achievement = Achievement.create("First run", "", "flag",
                new AchievementRuleCodec(new ObjectMapper()).encode(oneRun));
        when(achievements.findById(achievement.getId())).thenReturn(Optional.of(achievement));

        service.setActive(achievement.getId(), false);
        verify(evaluation, never()).backfill(any());

        service.setActive(achievement.getId(), true);
        verify(evaluation).backfill(achievement);
    }

    @Test
    void anUpdateWithoutAScenarioMakesTheBadgeGenericAgain() {
        Achievement achievement = Achievement.create("Rostering pro", "", "star",
                new AchievementRuleCodec(new ObjectMapper()).encode(oneRun));
        achievement.assignToScenario(lineage, "AeroVector: crew rostering");
        when(achievements.findById(achievement.getId())).thenReturn(Optional.of(achievement));

        service.update(achievement.getId(), new UpsertAchievementRequest("Rostering pro", "", "star", oneRun));

        assertThat(achievement.isExclusive()).isFalse();
    }

    @Test
    void anUnknownScenarioIsRejected() {
        UUID missing = UUID.randomUUID();
        when(scenarios.lineageOf(missing)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(new UpsertAchievementRequest("Badge", "", "star", oneRun, missing)))
                .isInstanceOf(NotFoundException.class);
        verify(achievements, never()).save(any());
    }

    @Test
    void aCompetencyMustBeOneThatAssessmentsScore() {
        ConditionNode typo = ConditionNode.group(LogicalOperator.AND, List.of(
                oneRun, ConditionNode.leaf(ConditionType.MIN_COMPETENCY_SCORE, "relationship building", 80)));

        assertThatThrownBy(() -> service.create(new UpsertAchievementRequest("Rapport", "", "star", typo)))
                .isInstanceOf(AdminAchievementService.InvalidAchievementException.class)
                .hasMessageContaining("\"relationship building\"")
                .hasMessageContaining("Relationship Building");
        verify(achievements, never()).save(any());
    }

    @Test
    void aKnownCompetencyIsAccepted() {
        ConditionNode rapport = ConditionNode.leaf(ConditionType.MIN_COMPETENCY_SCORE, "Relationship Building", 80);

        service.create(new UpsertAchievementRequest("Rapport", "", "star", rapport));

        verify(achievements).save(any(Achievement.class));
    }

    @Test
    void anExclusiveBadgeCannotUseCareerWideConditions() {
        ConditionNode winRate = ConditionNode.leaf(ConditionType.MIN_WIN_RATE_PERCENT, null, 50);

        assertThatThrownBy(() -> service.create(new UpsertAchievementRequest("Win rate", "", "star", winRate, currentRevision)))
                .isInstanceOf(AdminAchievementService.InvalidAchievementException.class)
                .hasMessageContaining("MIN_WIN_RATE_PERCENT");
        verify(achievements, never()).save(any());
    }

    @Test
    void aGenericBadgeCanStillUseCareerWideConditions() {
        ConditionNode explorer = ConditionNode.leaf(ConditionType.MIN_DISTINCT_SCENARIOS_COMPLETED, null, 3);

        service.create(new UpsertAchievementRequest("Explorer", "", "compass", explorer));

        verify(achievements).save(any(Achievement.class));
    }

    @Test
    void bothScopesCanUseTheSingleRunCondition() {
        ConditionNode hardWin = ConditionNode.runs(1, new com.ibm.consulting.sim.achievement.domain.RunCriteria(
                true, null, null, null, null, "HARD", List.of("MEETING"), null, null));

        service.create(new UpsertAchievementRequest("Hard win", "", "star", hardWin));
        service.create(new UpsertAchievementRequest("Hard win here", "", "star", hardWin, currentRevision));

        verify(achievements, org.mockito.Mockito.times(2)).save(any(Achievement.class));
    }

    @Test
    void aCompetencyInsideARunConditionMustBeReal() {
        ConditionNode typo = ConditionNode.runs(1, new com.ibm.consulting.sim.achievement.domain.RunCriteria(
                null, null, "Rapport", 80, null, null, null, null, null));

        assertThatThrownBy(() -> service.create(new UpsertAchievementRequest("Rapport", "", "star", typo)))
                .isInstanceOf(AdminAchievementService.InvalidAchievementException.class)
                .hasMessageContaining("\"Rapport\"");
    }

    @Test
    void previewEvaluatesADraftWithoutSavingIt() {
        when(evaluation.preview(any(Achievement.class), any())).thenReturn(new AchievementPreview(3, 0, 10, true));

        AchievementPreview preview = service.preview(new PreviewAchievementRequest(oneRun, currentRevision), null);

        assertThat(preview.qualifyingLearners()).isEqualTo(3);
        ArgumentCaptor<Achievement> draft = ArgumentCaptor.forClass(Achievement.class);
        verify(evaluation).preview(draft.capture(), org.mockito.ArgumentMatchers.isNull());
        assertThat(draft.getValue().getScenarioLineageId()).isEqualTo(lineage);
        verify(achievements, never()).save(any());
        verify(evaluation, never()).backfill(any());
    }

    @Test
    void previewRejectsTheSameRulesAsSaving() {
        ConditionNode winRate = ConditionNode.leaf(ConditionType.MIN_WIN_RATE_PERCENT, null, 50);

        assertThatThrownBy(() -> service.preview(new PreviewAchievementRequest(winRate, currentRevision), null))
                .isInstanceOf(AdminAchievementService.InvalidAchievementException.class);
    }
}
