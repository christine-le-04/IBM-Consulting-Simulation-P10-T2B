package com.ibm.consulting.sim.identity.application;

public record TokenResponse(
        String accessToken,
        String userId,
        String displayName,
        String role,
        boolean onboardingRequired,
        String sessionId,
        long expiresAt) {
    public TokenResponse(String accessToken, String userId, String displayName, String role, boolean onboardingRequired) {
        this(accessToken, userId, displayName, role, onboardingRequired, null, 0);
    }
}
