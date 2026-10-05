package com.ibm.consulting.sim.meeting.domain;

/** Deterministic retry decision for a completed meeting attempt. */
public record MeetingRetryEligibility(boolean available, int retriesRemaining) {

    public static final int MAX_PERFORMANCE_ATTEMPTS = 3;

    public static MeetingRetryEligibility unavailable() {
        return new MeetingRetryEligibility(false, 0);
    }

    public static MeetingRetryEligibility forPerformanceFailureCount(int failureCount) {
        int remaining = Math.max(0, MAX_PERFORMANCE_ATTEMPTS - Math.max(0, failureCount));
        return new MeetingRetryEligibility(remaining > 0, remaining);
    }
}
