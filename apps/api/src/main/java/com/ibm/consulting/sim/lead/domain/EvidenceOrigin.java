package com.ibm.consulting.sim.lead.domain;

public enum EvidenceOrigin {
    SCENARIO_CURATED,
    AI_SYNTHESIZED,
    USER_SUPPLIED,
    MEETING_DISCOVERY,
    /** Given at the start from the scenario briefing: citable, but doesn't count toward completing research. */
    SCENARIO_GIVEN
}
