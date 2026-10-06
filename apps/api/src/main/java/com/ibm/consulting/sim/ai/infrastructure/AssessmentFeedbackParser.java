package com.ibm.consulting.sim.ai.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ibm.consulting.sim.ai.domain.AiResponseParser;
import com.ibm.consulting.sim.ai.domain.AiValidationException;
import com.ibm.consulting.sim.ai.domain.AssessmentFeedback;
import com.ibm.consulting.sim.proposal.domain.ClientDecisionOutcome;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class AssessmentFeedbackParser implements AiResponseParser<AssessmentFeedback> {

    private final ObjectMapper mapper;

    public AssessmentFeedbackParser(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public AssessmentFeedback parse(String rawJson) throws AiValidationException {
        JsonNode root;
        try {
            root = mapper.readTree(rawJson);
        } catch (Exception e) {
            throw new AiValidationException("Response is not valid JSON", e);
        }

        String summary = root.path("feedbackSummary").asText(null);
        if (summary == null || summary.isBlank()) {
            throw new AiValidationException("Missing required field: feedbackSummary");
        }

        List<String> strengths = new ArrayList<>();
        root.path("strengths").forEach(n -> strengths.add(n.asText()));

        List<String> improvementAreas = new ArrayList<>();
        root.path("improvementAreas").forEach(n -> improvementAreas.add(n.asText()));

        return new AssessmentFeedback(readableOutcome(summary),
                strengths.stream().map(this::readableOutcome).toList(),
                improvementAreas.stream().map(this::readableOutcome).toList());
    }

    private String readableOutcome(String text) {
        for (var outcome : ClientDecisionOutcome.values()) {
            text = text.replace(outcome.name(), outcome.name().replace('_', ' ').toLowerCase(Locale.ROOT));
        }
        return text;
    }
}
