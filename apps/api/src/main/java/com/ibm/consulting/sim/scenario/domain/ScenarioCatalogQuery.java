package com.ibm.consulting.sim.scenario.domain;

import java.util.Locale;
import java.util.UUID;

/**
 * Bounded query contract for the learner-facing scenario catalogue.
 * {@code assigneeId} limits results to scenarios assigned to that consultant;
 * null means no assignment filter (authors and administrators).
 */
public record ScenarioCatalogQuery(String search, String industry, Integer difficulty, int page, int size,
                                   UUID assigneeId) {
    private static final int MAX_PAGE_SIZE = 24;

    public ScenarioCatalogQuery {
        search = normalise(search);
        industry = normalise(industry);
        difficulty = difficulty == null ? null : Math.max(1, Math.min(5, difficulty));
        page = Math.max(0, page);
        size = Math.max(1, Math.min(MAX_PAGE_SIZE, size));
    }

    public ScenarioCatalogQuery(String search, String industry, Integer difficulty, int page, int size) {
        this(search, industry, difficulty, page, size, null);
    }

    public ScenarioCatalogQuery forAssignee(UUID assignee) {
        return new ScenarioCatalogQuery(search, industry, difficulty, page, size, assignee);
    }

    public String cacheKey() {
        return "%s|%s|%s|%d|%d|%s".formatted(search, industry, difficulty, page, size, assigneeId);
    }

    private static String normalise(String value) {
        return value == null || value.isBlank() ? null : value.strip().toLowerCase(Locale.ROOT);
    }
}
