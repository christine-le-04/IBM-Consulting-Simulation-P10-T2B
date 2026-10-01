package com.ibm.consulting.sim.meeting.domain;

import com.ibm.consulting.sim.scenario.domain.DifficultyLevel;

/** Learner input contract. All difficulties use free text; GUIDED is retained for compatibility. */
public enum MeetingInteractionMode {
    GUIDED,
    FREEFORM;

    public static MeetingInteractionMode forDifficulty(DifficultyLevel difficulty) {
        return FREEFORM;
    }
}
