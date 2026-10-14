package com.ibm.consulting.sim.admin.api;

import com.ibm.consulting.sim.admin.application.AdminAuditService;
import com.ibm.consulting.sim.identity.domain.UserRepository;
import com.ibm.consulting.sim.identity.infrastructure.JwtTokenProvider;
import com.ibm.consulting.sim.identity.infrastructure.SecurityConfig;
import com.ibm.consulting.sim.shared.infrastructure.observability.AuditAction;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import java.util.List;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AdminAuditController.class)
@Import(SecurityConfig.class)
class AdminAuditControllerTest {
    @Autowired MockMvc mvc;
    @MockBean AdminAuditService service;
    @MockBean JwtTokenProvider tokens;
    @MockBean UserRepository users;

    @Test void requiresAuthentication() throws Exception {
        mvc.perform(get("/api/v1/admin/audit-events")).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }
    @Test @WithMockUser(roles = "LEARNER") void rejectsLearners() throws Exception { assertForbidden(); }
    @Test @WithMockUser(roles = "REVIEWER") void rejectsReviewers() throws Exception { assertForbidden(); }
    @Test @WithMockUser(roles = "SCENARIO_AUTHOR") void rejectsAuthors() throws Exception { assertForbidden(); }
    private void assertForbidden() throws Exception {
        mvc.perform(get("/api/v1/admin/audit-events")).andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }

    @Test @WithMockUser(roles = "ADMINISTRATOR") void returnsBoundedPageWithoutBrowserCaching() throws Exception {
        when(service.list(isNull(), isNull(), isNull(), isNull(), isNull(), eq(0), eq(25)))
                .thenReturn(new AdminAuditService.AuditPage(List.of(), 0, 0, 25, 0, List.of(AuditAction.values())));
        mvc.perform(get("/api/v1/admin/audit-events")).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.items").isArray()).andExpect(jsonPath("$.size").value(25))
                .andExpect(jsonPath("$.actions").isArray());
    }

    @Test @WithMockUser(roles = "ADMINISTRATOR") void rejectsInvalidFiltersBeforeCallingService() throws Exception {
        for (String query : List.of("size=101", "page=-1", "page=100001", "action=UNKNOWN", "targetType=OTHER", "from=invalid", "search=" + "x".repeat(101))) {
            mvc.perform(get("/api/v1/admin/audit-events?" + query)).andExpect(status().isBadRequest());
        }
        verifyNoInteractions(service);
    }
}
