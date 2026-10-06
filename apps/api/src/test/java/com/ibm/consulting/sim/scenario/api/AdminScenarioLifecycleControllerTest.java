package com.ibm.consulting.sim.scenario.api;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.identity.domain.UserRepository;
import com.ibm.consulting.sim.identity.domain.UserRole;
import com.ibm.consulting.sim.identity.infrastructure.JwtTokenProvider;
import com.ibm.consulting.sim.identity.infrastructure.SecurityConfig;
import com.ibm.consulting.sim.scenario.application.ScenarioAssignmentService;
import com.ibm.consulting.sim.scenario.application.ScenarioAssignmentView;
import com.ibm.consulting.sim.scenario.application.ScenarioService;
import com.ibm.consulting.sim.scenario.application.ScenarioSummary;
import com.ibm.consulting.sim.scenario.domain.Scenario;
import com.ibm.consulting.sim.shared.domain.NotFoundException;

/**
 * HTTP contract for scenario lifecycle actions (publish, delete, revise) and
 * consultant assignment: who may call them, what input is accepted, and how
 * domain failures map to status codes.
 */
@WebMvcTest(AdminScenarioController.class)
@Import(SecurityConfig.class)
class AdminScenarioLifecycleControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean ScenarioService scenarioService;
    @MockBean ScenarioAssignmentService assignmentService;
    @MockBean JwtTokenProvider jwtTokenProvider;
    @MockBean UserRepository userRepository;

    private final UUID scenarioId = UUID.randomUUID();

    // ─── Role guard ───────────────────────────────────────────────────────

    @Test
    @WithMockUser(roles = "LEARNER")
    void learnersCannotPublishDeleteReviseOrAssign() throws Exception {
        List<MockHttpServletRequestBuilder> lifecycleRequests = List.of(
                patch("/api/v1/admin/scenarios/{id}/publish", scenarioId),
                patch("/api/v1/admin/scenarios/{id}/archive", scenarioId),
                post("/api/v1/admin/scenarios/{id}/revisions", scenarioId),
                get("/api/v1/admin/scenarios/{id}/authoring", scenarioId),
                get("/api/v1/admin/scenarios/{id}/assignments", scenarioId),
                put("/api/v1/admin/scenarios/{id}/assignments", scenarioId)
                        .contentType("application/json").content("{\"userIds\":[]}"));

        for (MockHttpServletRequestBuilder request : lifecycleRequests) {
            mockMvc.perform(request).andExpect(status().isForbidden());
        }
        verifyNoInteractions(scenarioService, assignmentService);
    }

    @Test
    @WithMockUser(roles = "ADMINISTRATOR")
    void administratorsCanPublishAndDelete() throws Exception {
        Scenario published = Scenario.create("Retail turnaround", "Retail", "Description", 3);
        published.publish();
        Scenario archived = Scenario.create("Retail turnaround", "Retail", "Description", 3);
        archived.archive();
        when(scenarioService.publish(scenarioId)).thenReturn(ScenarioSummary.from(published));
        when(scenarioService.archive(scenarioId)).thenReturn(ScenarioSummary.from(archived));

        mockMvc.perform(patch("/api/v1/admin/scenarios/{id}/publish", scenarioId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"));
        mockMvc.perform(patch("/api/v1/admin/scenarios/{id}/archive", scenarioId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ARCHIVED"));
    }

    @Test
    @WithMockUser(roles = "SCENARIO_AUTHOR")
    void editingALiveScenarioIsAnUnprocessableRequest() throws Exception {
        when(scenarioService.publish(scenarioId))
                .thenThrow(new Scenario.ScenarioNotEditableException(com.ibm.consulting.sim.scenario.domain.ScenarioStatus.ACTIVE));

        mockMvc.perform(patch("/api/v1/admin/scenarios/{id}/publish", scenarioId))
                .andExpect(status().isUnprocessableEntity());
    }

    // ─── Assignments: read ────────────────────────────────────────────────

    @Test
    @WithMockUser(roles = "ADMINISTRATOR")
    void administratorsCanReadTheAssignedConsultants() throws Exception {
        UUID lineageId = UUID.randomUUID();
        UUID consultantId = UUID.randomUUID();
        when(assignmentService.assignments(scenarioId)).thenReturn(new ScenarioAssignmentView(scenarioId, lineageId,
                List.of(new ScenarioAssignmentView.Assignee(consultantId, "Ada", "ada@example.com", true))));

        mockMvc.perform(get("/api/v1/admin/scenarios/{id}/assignments", scenarioId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.scenarioLineageId").value(lineageId.toString()))
                .andExpect(jsonPath("$.assignees[0].id").value(consultantId.toString()))
                .andExpect(jsonPath("$.assignees[0].displayName").value("Ada"))
                .andExpect(jsonPath("$.assignees[0].active").value(true));
    }

    @Test
    @WithMockUser(roles = "ADMINISTRATOR")
    void readingAssignmentsOfAnUnknownScenarioIsNotFound() throws Exception {
        when(assignmentService.assignments(scenarioId)).thenThrow(new NotFoundException("Scenario", scenarioId));

        mockMvc.perform(get("/api/v1/admin/scenarios/{id}/assignments", scenarioId))
                .andExpect(status().isNotFound());
    }

    // ─── Assignments: replace ─────────────────────────────────────────────

    @Test
    @WithMockUser(roles = "SCENARIO_AUTHOR")
    void authorsCanReplaceTheAssignedConsultants() throws Exception {
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        when(assignmentService.replaceAssignments(eq(scenarioId), anyList(), any()))
                .thenReturn(new ScenarioAssignmentView(scenarioId, scenarioId, List.of()));

        mockMvc.perform(put("/api/v1/admin/scenarios/{id}/assignments", scenarioId)
                        .contentType("application/json")
                        .content("{\"userIds\":[\"" + first + "\",\"" + second + "\"]}"))
                .andExpect(status().isOk());

        // @WithMockUser is not an application User, so no assigner id is recorded.
        verify(assignmentService).replaceAssignments(eq(scenarioId), eq(List.of(first, second)), isNull());
    }

    @Test
    @WithMockUser(roles = "ADMINISTRATOR")
    void anEmptyListUnassignsEveryone() throws Exception {
        when(assignmentService.replaceAssignments(eq(scenarioId), anyList(), any()))
                .thenReturn(new ScenarioAssignmentView(scenarioId, scenarioId, List.of()));

        mockMvc.perform(put("/api/v1/admin/scenarios/{id}/assignments", scenarioId)
                        .contentType("application/json").content("{\"userIds\":[]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assignees").isEmpty());

        verify(assignmentService).replaceAssignments(eq(scenarioId), eq(List.of()), isNull());
    }

    @Test
    @WithMockUser(roles = "ADMINISTRATOR")
    void aMissingOrMalformedUserListIsRejectedBeforeTheService() throws Exception {
        for (String body : List.of("{}", "{\"userIds\":null}", "{\"userIds\":[null]}", "{\"userIds\":[\"not-a-uuid\"]}")) {
            mockMvc.perform(put("/api/v1/admin/scenarios/{id}/assignments", scenarioId)
                            .contentType("application/json").content(body))
                    .andExpect(status().isBadRequest());
        }
        verify(assignmentService, never()).replaceAssignments(any(), any(), any());
    }

    @Test
    @WithMockUser(roles = "ADMINISTRATOR")
    void assigningANonConsultantIsAnUnprocessableRequest() throws Exception {
        User author = User.create("author@example.com", "hash", "Author", UserRole.SCENARIO_AUTHOR);
        when(assignmentService.replaceAssignments(eq(scenarioId), anyList(), any()))
                .thenThrow(new ScenarioAssignmentService.InvalidAssigneeException(author));

        mockMvc.perform(put("/api/v1/admin/scenarios/{id}/assignments", scenarioId)
                        .contentType("application/json")
                        .content("{\"userIds\":[\"" + author.getId() + "\"]}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("Only consultant")));
    }

    @Test
    @WithMockUser(roles = "ADMINISTRATOR")
    void assigningAnUnknownUserIsNotFound() throws Exception {
        UUID ghost = UUID.randomUUID();
        when(assignmentService.replaceAssignments(eq(scenarioId), anyList(), any()))
                .thenThrow(new NotFoundException("User", ghost));

        mockMvc.perform(put("/api/v1/admin/scenarios/{id}/assignments", scenarioId)
                        .contentType("application/json").content("{\"userIds\":[\"" + ghost + "\"]}"))
                .andExpect(status().isNotFound());
    }
}
