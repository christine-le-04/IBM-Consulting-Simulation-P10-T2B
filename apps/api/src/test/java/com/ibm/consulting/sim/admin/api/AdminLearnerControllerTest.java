package com.ibm.consulting.sim.admin.api;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.when;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ibm.consulting.sim.admin.application.CohortAnalytics;
import com.ibm.consulting.sim.admin.application.CohortAnalyticsService;
import com.ibm.consulting.sim.admin.application.LearnerProgressEntry;
import com.ibm.consulting.sim.admin.application.LearnerProgressService;
import com.ibm.consulting.sim.identity.domain.UserRepository;
import com.ibm.consulting.sim.identity.infrastructure.JwtTokenProvider;
import com.ibm.consulting.sim.identity.infrastructure.SecurityConfig;

@WebMvcTest(AdminLearnerController.class)
@Import(SecurityConfig.class)
class AdminLearnerControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private LearnerProgressService progressService;

    @MockBean
    private CohortAnalyticsService cohortService;

    @MockBean
    private JwtTokenProvider jwtTokenProvider;

    @MockBean
    private UserRepository userRepository;

    // tests unauthorised access to the learner progress endpoint
    @Test
    void anonymousRequestIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/admin/learners/progress"))
                .andExpect(status().isUnauthorized());
    }

    // tests forbidden backend response for roles without learner progress access
    @Test
    @WithMockUser(roles = "REVIEWER")
    void reviewerCannotViewLearnerProgress() throws Exception {
        mockMvc.perform(get("/api/v1/admin/learners/progress"))
                .andExpect(status().isForbidden());
    }

    // tests forbidden backend response for learners
    @Test
    @WithMockUser(roles = "LEARNER")
    void learnerCannotViewLearnerProgress() throws Exception {
        mockMvc.perform(get("/api/v1/admin/learners/progress"))
                .andExpect(status().isForbidden());
    }

    // tests successful backend response for administrator role
    @Test
    @WithMockUser(roles = "ADMINISTRATOR")
    void administratorCanViewLearnerProgress() throws Exception {
        when(progressService.getProgress()).thenReturn(List.of(new LearnerProgressEntry("e1", "u1", "Ana Lee",
                "ana@example.com", "s1", "AeroVector Aviation", "OUTREACHING", null,
                Instant.parse("2026-10-13T00:00:00Z"), null)));

        mockMvc.perform(get("/api/v1/admin/learners/progress"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].displayName").value("Ana Lee"))
                .andExpect(jsonPath("$[0].state").value("OUTREACHING"));
    }

    // tests that only administrators can see cohort analytics
    @Test
    @WithMockUser(roles = "REVIEWER")
    void reviewerCannotViewCohortAnalytics() throws Exception {
        mockMvc.perform(get("/api/v1/admin/learners/cohorts"))
                .andExpect(status().isForbidden());
    }

    // tests successful cohort analytics response for administrator role
    @Test
    @WithMockUser(roles = "ADMINISTRATOR")
    void administratorCanViewCohortAnalytics() throws Exception {
        CohortAnalytics overall = new CohortAnalytics(null, "All scenarios", 1, 2, 1, 0, 82, Map.of("COMPLETED", 1, "OUTREACHING", 1),
                List.of(new CohortAnalytics.CompetencyAverage("Solution Alignment", 64, 1, 1)),
                List.of(new CohortAnalytics.RecurringFeedback("Probe budget earlier", 2)));
        when(cohortService.getCohorts()).thenReturn(new CohortAnalytics.Response(70, overall, List.of()));

        mockMvc.perform(get("/api/v1/admin/learners/cohorts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.targetScore").value(70))
                .andExpect(jsonPath("$.overall.completedCount").value(1))
                .andExpect(jsonPath("$.overall.competencies[0].name").value("Solution Alignment"))
                .andExpect(jsonPath("$.overall.commonImprovementAreas[0].runCount").value(2));
    }
}
