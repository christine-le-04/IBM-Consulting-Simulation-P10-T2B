package com.ibm.consulting.sim.admin.api;

import com.ibm.consulting.sim.admin.application.LearnerProgressEntry;
import com.ibm.consulting.sim.admin.application.LearnerProgressService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.validation.annotation.Validated;
import jakarta.validation.constraints.*;
import java.util.UUID;


@RestController
@RequestMapping("/api/v1/admin/learners")
@PreAuthorize("hasRole('ADMINISTRATOR')")
@Validated
public class AdminLearnerController {
    private final LearnerProgressService progressService;

    public AdminLearnerController(LearnerProgressService progressService) { this.progressService = progressService; }

    @GetMapping("/progress")
    LearnerProgressService.ProgressPage progress(
            @RequestParam(required = false) @Size(max = 100) String search,
            @RequestParam(required = false) UUID scenarioId,
            @RequestParam(required = false) @Pattern(regexp = "Research|Outreach|Preparation|Meeting|Proposal|Review") String stage,
            @RequestParam(required = false) @Pattern(regexp = "IN_PROGRESS|STUCK|COMPLETED|MEETING_FAILED") String status,
            @RequestParam(defaultValue = "0") @Min(0) @Max(100000) int page,
            @RequestParam(defaultValue = "25") @Min(1) @Max(100) int size) {
        return progressService.getProgress(search, scenarioId, stage, status, page, size);
    }

    @GetMapping("/{engagementId}")
    LearnerProgressEntry run(@PathVariable UUID engagementId) { return progressService.getRun(engagementId); }
}
