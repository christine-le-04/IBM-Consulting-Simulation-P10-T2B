package com.ibm.consulting.sim.admin.api;

import com.ibm.consulting.sim.admin.application.LearnerProgressEntry;
import com.ibm.consulting.sim.admin.application.LearnerProgressService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/learners")
@PreAuthorize("hasRole('ADMINISTRATOR')")
public class AdminLearnerController {
    private final LearnerProgressService progressService;

    public AdminLearnerController(LearnerProgressService progressService) { this.progressService = progressService; }

    @GetMapping("/progress")
    List<LearnerProgressEntry> progress() { return progressService.getProgress(); }
}
