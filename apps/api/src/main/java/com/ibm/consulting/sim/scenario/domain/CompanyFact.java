package com.ibm.consulting.sim.scenario.domain;

import com.ibm.consulting.sim.shared.domain.BaseEntity;
import jakarta.persistence.*;
import org.hibernate.annotations.Immutable;

import java.util.UUID;

/**
 * One line of a scenario's company profile, shown from the start: company size
 * or financial summary. The numbers show what is happening; the research
 * sources explain why. Written by migrations, so read-only here.
 */
@Entity
@Immutable
@Table(name = "company_facts")
public class CompanyFact extends BaseEntity {

    public enum Section { SIZE, FINANCIAL }

    /** NORMAL, or highlighted as WARNING (amber) or ALERT (red). */
    public enum Tone { NORMAL, WARNING, ALERT }

    @Column(name = "scenario_id", nullable = false)
    private UUID scenarioId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Section section;

    @Column(nullable = false)
    private String label;

    @Column(nullable = false)
    private String value;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Tone tone;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    protected CompanyFact() {}

    public UUID getScenarioId() { return scenarioId; }
    public Section getSection() { return section; }
    public String getLabel() { return label; }
    public String getValue() { return value; }
    public Tone getTone() { return tone; }
    public int getSortOrder() { return sortOrder; }
}
