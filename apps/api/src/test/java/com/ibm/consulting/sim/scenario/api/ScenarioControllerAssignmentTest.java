package com.ibm.consulting.sim.scenario.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;

import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.identity.domain.UserRepository;
import com.ibm.consulting.sim.identity.domain.UserRole;
import com.ibm.consulting.sim.identity.infrastructure.JwtTokenProvider;
import com.ibm.consulting.sim.scenario.application.ScenarioAssignmentService;
import com.ibm.consulting.sim.scenario.application.ScenarioCatalogResponse;
import com.ibm.consulting.sim.scenario.application.ScenarioService;
import com.ibm.consulting.sim.scenario.application.ScenarioSummary;
import com.ibm.consulting.sim.scenario.domain.Scenario;
import com.ibm.consulting.sim.scenario.domain.ScenarioCatalogQuery;

/**
 * The learner catalogue routes consultants to assignment-filtered queries and
 * everyone else to the unfiltered ones. The signed-in {@link User} is placed in
 * the security context directly, because filters are disabled in this slice.
 */
@WebMvcTest(ScenarioController.class)
@AutoConfigureMockMvc(addFilters = false)
class ScenarioControllerAssignmentTest {

    @Autowired MockMvc mockMvc;
    @MockBean ScenarioService scenarios;
    @MockBean ScenarioAssignmentService assignments;
    @MockBean JwtTokenProvider tokens;
    @MockBean UserRepository users;

    private final User consultant = User.create("ada@example.com", "hash", "Ada", UserRole.LEARNER);
    private final User author = User.create("author@example.com", "hash", "Author", UserRole.SCENARIO_AUTHOR);

    @AfterEach
    void signOut() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void anonymousCallersOfThePublicListSeeNothing() throws Exception {
        mockMvc.perform(get("/api/v1/scenarios"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        verifyNoInteractions(scenarios);
    }

    @Test
    void consultantsListOnlyTheirAssignedScenarios() throws Exception {
        signInAs(consultant);
        when(assignments.catalogueAssigneeFor(any(User.class))).thenReturn(consultant.getId());
        when(scenarios.listActiveAssignedTo(consultant.getId())).thenReturn(List.of(liveSummary("Assigned")));

        mockMvc.perform(get("/api/v1/scenarios"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("Assigned"));

        verify(scenarios, never()).listActive();
    }

    @Test
    void staffListEveryLiveScenario() throws Exception {
        signInAs(author);
        when(assignments.catalogueAssigneeFor(any(User.class))).thenReturn(null);
        when(scenarios.listActive()).thenReturn(List.of(liveSummary("One"), liveSummary("Two")));

        mockMvc.perform(get("/api/v1/scenarios"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));

        verify(scenarios, never()).listActiveAssignedTo(any());
    }

    @Test
    void theConsultantCatalogueQueryCarriesTheirIdAlongsideTheFilters() throws Exception {
        signInAs(consultant);
        when(assignments.catalogueAssigneeFor(any(User.class))).thenReturn(consultant.getId());
        when(scenarios.listCatalog(any())).thenReturn(new ScenarioCatalogResponse(List.of(), 0, 0, 9, 0));

        mockMvc.perform(get("/api/v1/scenarios/catalog").param("search", "Retail").param("difficulty", "3"))
                .andExpect(status().isOk());

        ArgumentCaptor<ScenarioCatalogQuery> query = ArgumentCaptor.forClass(ScenarioCatalogQuery.class);
        verify(scenarios).listCatalog(query.capture());
        assertThat(query.getValue().assigneeId()).isEqualTo(consultant.getId());
        assertThat(query.getValue().search()).isEqualTo("retail");
        assertThat(query.getValue().difficulty()).isEqualTo(3);
    }

    @Test
    void theStaffCatalogueQueryHasNoAssignmentFilter() throws Exception {
        signInAs(author);
        when(assignments.catalogueAssigneeFor(any(User.class))).thenReturn(null);
        when(scenarios.listCatalog(any())).thenReturn(new ScenarioCatalogResponse(List.of(), 0, 0, 9, 0));

        mockMvc.perform(get("/api/v1/scenarios/catalog")).andExpect(status().isOk());

        ArgumentCaptor<ScenarioCatalogQuery> query = ArgumentCaptor.forClass(ScenarioCatalogQuery.class);
        verify(scenarios).listCatalog(query.capture());
        assertThat(query.getValue().assigneeId()).isNull();
    }

    @Test
    void industryFiltersOnlyOfferTheConsultantsAssignedIndustries() throws Exception {
        signInAs(consultant);
        when(assignments.catalogueAssigneeFor(any(User.class))).thenReturn(consultant.getId());
        when(scenarios.listCatalogIndustriesAssignedTo(consultant.getId())).thenReturn(List.of("Retail"));

        mockMvc.perform(get("/api/v1/scenarios/catalog/industries"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0]").value("Retail"))
                .andExpect(jsonPath("$.length()").value(1));

        verify(scenarios, never()).listCatalogIndustries();
    }

    @Test
    void scenarioDetailUsedDuringARunIsNotFilteredByAssignment() throws Exception {
        signInAs(consultant);
        UUID scenarioId = UUID.randomUUID();
        when(scenarios.getActiveById(scenarioId)).thenReturn(liveSummary("In progress"));

        mockMvc.perform(get("/api/v1/scenarios/{id}", scenarioId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("In progress"));

        verifyNoInteractions(assignments);
    }

    private void signInAs(User user) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                user, null, List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))));
    }

    private static ScenarioSummary liveSummary(String title) {
        Scenario scenario = Scenario.create(title, "Retail", "Description", 3);
        scenario.publish();
        return ScenarioSummary.from(scenario);
    }
}
