package com.ibm.consulting.sim.scenario.api;

import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.scenario.application.ScenarioService;
import com.ibm.consulting.sim.scenario.application.ScenarioCatalogResponse;
import com.ibm.consulting.sim.scenario.application.ScenarioSummary;
import com.ibm.consulting.sim.scenario.domain.ScenarioCatalogQuery;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.validation.annotation.Validated;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import java.util.List;
import java.util.UUID;

/**
 * Learner-facing catalogue: every signed-in learner can browse all Live scenarios.
 */
@RestController
@RequestMapping("/api/v1/scenarios")
@Validated
public class ScenarioController {

    private final ScenarioService scenarioService;

    public ScenarioController(ScenarioService scenarioService) {
        this.scenarioService = scenarioService;
    }

    /** Publicly reachable; anonymous callers see nothing. */
    @GetMapping
    List<ScenarioSummary> listActive(@AuthenticationPrincipal User viewer) {
        if (viewer == null) return List.of();
        return scenarioService.listActive();
    }

    /** Paged learner catalogue. The original collection endpoint stays available for existing clients. */
    @GetMapping("/catalog")
    ScenarioCatalogResponse listCatalog(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String industry,
            @RequestParam(required = false) @Min(1) @Max(5) Integer difficulty,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "9") @Min(1) @Max(24) int size,
            @AuthenticationPrincipal User viewer) {
        return scenarioService.listCatalog(new ScenarioCatalogQuery(search, industry, difficulty, page, size));
    }

    @GetMapping("/catalog/industries")
    List<String> listCatalogIndustries(@AuthenticationPrincipal User viewer) {
        return scenarioService.listCatalogIndustries();
    }

    /**
     * Scenario detail used throughout an engagement. Not filtered by assignment,
     * so a run in progress keeps working if the consultant is later unassigned.
     */
    @GetMapping("/{id}")
    ScenarioSummary getById(@PathVariable UUID id, @AuthenticationPrincipal User user) {
        return scenarioService.getForLearner(id, user.getId());
    }
}
