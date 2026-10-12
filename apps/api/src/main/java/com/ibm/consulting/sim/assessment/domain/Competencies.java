package com.ibm.consulting.sim.assessment.domain;

import java.util.List;

/** The competencies every assessment scores, whatever the scenario. */
public final class Competencies {

    public static final String OUTREACH_EFFECTIVENESS = "Outreach Effectiveness";
    public static final String RELATIONSHIP_BUILDING = "Relationship Building";
    public static final String SOLUTION_ALIGNMENT = "Solution Alignment";

    public static final List<String> ALL = List.of(OUTREACH_EFFECTIVENESS, RELATIONSHIP_BUILDING, SOLUTION_ALIGNMENT);

    private Competencies() {}
}
