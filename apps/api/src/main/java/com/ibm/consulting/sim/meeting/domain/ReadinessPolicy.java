package com.ibm.consulting.sim.meeting.domain;

import java.util.List;

/**
 * Deterministic readiness scoring for meeting preparation (§4.3 US-05).
 * Pure domain logic — no Spring/JPA dependency.
 */
public final class ReadinessPolicy {

    public static final int READY_THRESHOLD = 70;

    private static final int MAX_AGENDA_CREDIT = 40;
    private static final int MAX_QUESTION_CREDIT = 40;
    private static final int OBJECTIVE_CREDIT = 20;
    private static final int CREDIT_PER_AGENDA_ITEM = 10;
    private static final int CREDIT_PER_QUESTION = 8;
    private static final int MIN_MEANINGFUL_LENGTH = 10;

    private ReadinessPolicy() {}

    public static int calculate(String objective, List<String> agenda, List<String> discoveryQuestions) {
        return evaluate(objective, agenda, discoveryQuestions).score();
    }

    public static ReadinessResult evaluate(
            String objective,
            List<String> agenda,
            List<String> discoveryQuestions) {

        boolean objectiveReady = objective != null && !objective.isBlank();

        int qualifyingAgendaCount = countMeaningful(agenda);
        int qualifyingQuestionCount = countMeaningful(discoveryQuestions);

        int objectiveScore = objectiveReady ? OBJECTIVE_CREDIT : 0;
        int agendaScore = Math.min(MAX_AGENDA_CREDIT, qualifyingAgendaCount * CREDIT_PER_AGENDA_ITEM);
        int questionScore = Math.min(MAX_QUESTION_CREDIT, qualifyingQuestionCount * CREDIT_PER_QUESTION);
        int score = Math.min(100, objectiveScore + agendaScore + questionScore);
        int remainingPoints = Math.max(0, READY_THRESHOLD - score);

        return new ReadinessResult(score, READY_THRESHOLD, remainingPoints, objectiveScore, agendaScore, questionScore, objectiveReady, qualifyingAgendaCount, qualifyingQuestionCount, score >= READY_THRESHOLD);
    }

    private static int countMeaningful(List<String> items) {
        if (items == null) {
            return 0;
        }
        return (int) items.stream().filter(i -> i != null && i.trim().length() >= MIN_MEANINGFUL_LENGTH).count();
    }

    public record ReadinessResult(int score, int threshold, int remainingPoints, int objectiveScore, int agendaScore, int questionScore, boolean objectiveReady, int qualifyingAgendaCount, int qualifyingQuestionCount, boolean ready) {}
}