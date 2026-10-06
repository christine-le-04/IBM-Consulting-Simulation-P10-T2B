package com.ibm.consulting.sim.scenario.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

/**
 * The scenario state machine from the "Admin: manage scenarios" flow:
 * Draft → (publish) → Live, and Draft or Live → (delete) → Archived.
 */
class ScenarioLifecycleTest {

    @Test
    void aNewScenarioIsADraftThatStartsItsOwnLineage() {
        Scenario scenario = Scenario.create("Retail turnaround", "Retail", "Description", 3);

        assertThat(scenario.getStatus()).isEqualTo(ScenarioStatus.DRAFT);
        assertThat(scenario.getContentVersion()).isEqualTo(1);
        assertThat(scenario.getScenarioLineageId()).isEqualTo(scenario.getId());
    }

    @Test
    void publishingMovesADraftToLive() {
        Scenario scenario = Scenario.create("Retail turnaround", "Retail", "Description", 3);

        scenario.publish();

        assertThat(scenario.getStatus()).isEqualTo(ScenarioStatus.ACTIVE);
    }

    @Test
    void onlyDraftsCanBePublished() {
        Scenario live = Scenario.create("Live", "Retail", "Description", 3);
        live.publish();
        Scenario archived = Scenario.create("Archived", "Retail", "Description", 3);
        archived.archive();

        assertThatThrownBy(live::publish).isInstanceOf(Scenario.ScenarioNotEditableException.class);
        assertThatThrownBy(archived::publish).isInstanceOf(Scenario.ScenarioNotEditableException.class);
        assertThat(archived.getStatus()).isEqualTo(ScenarioStatus.ARCHIVED);
    }

    @Test
    void draftsAndLiveScenariosCanBothBeDeleted() {
        Scenario draft = Scenario.create("Draft", "Retail", "Description", 3);
        Scenario live = Scenario.create("Live", "Retail", "Description", 3);
        live.publish();

        draft.archive();
        live.archive();

        assertThat(draft.getStatus()).isEqualTo(ScenarioStatus.ARCHIVED);
        assertThat(live.getStatus()).isEqualTo(ScenarioStatus.ARCHIVED);
    }

    @Test
    void deletingAnAlreadyDeletedScenarioLeavesItArchived() {
        Scenario scenario = Scenario.create("Retail turnaround", "Retail", "Description", 3);
        scenario.archive();

        scenario.archive();

        assertThat(scenario.getStatus()).isEqualTo(ScenarioStatus.ARCHIVED);
    }

    @Test
    void archivedScenariosCannotBeEdited() {
        Scenario scenario = Scenario.create("Retail turnaround", "Retail", "Description", 3);
        scenario.archive();

        assertThatThrownBy(() -> scenario.updateMetadata("New title", "Retail", "Description", 3))
                .isInstanceOf(Scenario.ScenarioNotEditableException.class);
        assertThatThrownBy(() -> scenario.updateBriefing("Consultant", "Objective", List.of("Criterion"), 10))
                .isInstanceOf(Scenario.ScenarioNotEditableException.class);
        assertThatThrownBy(() -> scenario.updateRubricWeights(Map.of("Communication", 100)))
                .isInstanceOf(Scenario.ScenarioNotEditableException.class);
        assertThatThrownBy(() -> scenario.addPersona("Client", "CIO", "Example Corp", null, null, null, null))
                .isInstanceOf(Scenario.ScenarioNotEditableException.class);
        assertThat(scenario.getTitle()).isEqualTo("Retail turnaround");
    }

    @Test
    void aRevisionOfALiveScenarioIsAnEditableDraftInTheSameLineage() {
        Scenario live = Scenario.create("Retail turnaround", "Retail", "Description", 3);
        live.publish();

        Scenario revision = live.createRevision();
        revision.updateMetadata("Retail turnaround v2", "Retail", "Description", 3);

        assertThat(revision.getStatus()).isEqualTo(ScenarioStatus.DRAFT);
        assertThat(revision.getScenarioLineageId()).isEqualTo(live.getScenarioLineageId());
        assertThat(revision.getContentVersion()).isEqualTo(2);
        assertThat(revision.getTitle()).isEqualTo("Retail turnaround v2");
        assertThat(live.getStatus()).isEqualTo(ScenarioStatus.ACTIVE);
        assertThat(live.getTitle()).isEqualTo("Retail turnaround");
    }
}
