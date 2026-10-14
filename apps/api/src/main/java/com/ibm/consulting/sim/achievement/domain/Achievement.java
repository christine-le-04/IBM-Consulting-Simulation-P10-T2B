package com.ibm.consulting.sim.achievement.domain;

import com.ibm.consulting.sim.shared.domain.BaseEntity;
import jakarta.persistence.*;

import java.util.UUID;

/**
 * An admin-authored achievement definition. The unlock rule itself is stored as
 * an opaque serialised string ({@code ruleJson}) — encoding/decoding it into an
 * {@link AchievementCondition} tree is an infrastructure concern (Jackson), kept
 * out of this domain entity by design.
 */
@Entity
@Table(name = "achievements")
public class Achievement extends BaseEntity {

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "icon_key", nullable = false)
    private String iconKey;

    @Column(nullable = false)
    private boolean active;

    @Column(name = "rule_json", nullable = false, columnDefinition = "text")
    private String ruleJson;

    /** Null for a Generic achievement; the scenario lineage of an Exclusive one. */
    @Column(name = "scenario_lineage_id")
    private UUID scenarioLineageId;

    /** Scenario title when assigned. Display reads the live title; this is a fallback. */
    @Column(name = "scenario_title_snapshot")
    private String scenarioTitleSnapshot;

    protected Achievement() {}

    public static Achievement create(String name, String description, String iconKey, String ruleJson) {
        Achievement achievement = new Achievement();
        achievement.name = name;
        achievement.description = description;
        achievement.iconKey = (iconKey == null || iconKey.isBlank()) ? "trophy" : iconKey;
        achievement.ruleJson = ruleJson;
        achievement.active = true;
        return achievement;
    }

    public void updateRule(String ruleJson) {
        this.ruleJson = ruleJson;
    }

    public void updateDetails(String name, String description, String iconKey) {
        this.name = name;
        this.description = description;
        this.iconKey = (iconKey == null || iconKey.isBlank()) ? "trophy" : iconKey;
    }

    /** Makes the achievement Exclusive to one scenario, counting runs of any of its revisions. */
    public void assignToScenario(UUID scenarioLineageId, String scenarioTitle) {
        this.scenarioLineageId = scenarioLineageId;
        this.scenarioTitleSnapshot = scenarioTitle;
    }

    /** Makes the achievement Generic again: it counts runs of every scenario. */
    public void makeGeneric() {
        this.scenarioLineageId = null;
        this.scenarioTitleSnapshot = null;
    }

    public boolean isExclusive() { return scenarioLineageId != null; }

    /**
     * Whether the achievement can be newly awarded. Computed from the scenario's
     * current status every time, never stored: archiving a scenario pauses its
     * Exclusive badges without changing them, and an admin's own deactivation
     * is independent of the scenario.
     */
    public boolean isAwardable(boolean scenarioLive) {
        return active && (!isExclusive() || scenarioLive);
    }

    public void activate() { this.active = true; }
    public void deactivate() { this.active = false; }

    public String getName() { return name; }
    public String getDescription() { return description; }
    public String getIconKey() { return iconKey; }
    public boolean isActive() { return active; }
    public String getRuleJson() { return ruleJson; }
    public UUID getScenarioLineageId() { return scenarioLineageId; }
    public String getScenarioTitleSnapshot() { return scenarioTitleSnapshot; }
}
