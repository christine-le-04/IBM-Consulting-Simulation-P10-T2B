package com.ibm.consulting.sim.announcement;

import com.ibm.consulting.sim.announcement.api.AdminAnnouncementController;
import com.ibm.consulting.sim.announcement.application.AdminAnnouncementService;
import com.ibm.consulting.sim.identity.domain.UserRepository;
import com.ibm.consulting.sim.identity.infrastructure.JwtTokenProvider;
import com.ibm.consulting.sim.identity.infrastructure.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import java.util.List;
import java.util.UUID;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AdminAnnouncementController.class)
@Import(SecurityConfig.class)
class AdminAnnouncementControllerTest {
    @Autowired MockMvc mvc;
    @MockBean AdminAnnouncementService service;
    @MockBean JwtTokenProvider tokens;
    @MockBean UserRepository users;
    private static final String ENDPOINT = "/api/v1/admin/announcements";
    private static final String BODY = "{\"title\":\"Maintenance\",\"message\":\"The platform will restart tonight.\"}";

    @Test void anonymousUsersCannotPublish() throws Exception {
        mvc.perform(post(ENDPOINT).contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }

    @ParameterizedTest @ValueSource(strings = {"LEARNER", "SCENARIO_AUTHOR", "REVIEWER"})
    void otherRolesCannotPublish(String role) throws Exception {
        mvc.perform(post(ENDPOINT).with(user("other").roles(role)).contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }

    @Test @WithMockUser(roles = "ADMINISTRATOR") void administratorCanPublish() throws Exception {
        UUID id = UUID.randomUUID();
        when(service.publish("Maintenance", "The platform will restart tonight.", null)).thenReturn(id);
        mvc.perform(post(ENDPOINT).contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isCreated()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.id").value(id.toString()));
        verify(service).publish("Maintenance", "The platform will restart tonight.", null);
    }

    @Test @WithMockUser(roles = "ADMINISTRATOR") void acceptsSelectedRolesAndRejectsInvalidAudiences() throws Exception {
        mvc.perform(post(ENDPOINT).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Learner notice\",\"message\":\"Hello\",\"targetRoles\":[\"LEARNER\",\"REVIEWER\"]}"))
                .andExpect(status().isCreated());
        verify(service).publish("Learner notice", "Hello", java.util.Set.of(
                com.ibm.consulting.sim.identity.domain.UserRole.LEARNER, com.ibm.consulting.sim.identity.domain.UserRole.REVIEWER));
        clearInvocations(service);
        for (String roles : List.of("[]", "[null]", "[\"UNKNOWN\"]")) {
            mvc.perform(post(ENDPOINT).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"title\":\"Notice\",\"message\":\"Hello\",\"targetRoles\":" + roles + "}"))
                    .andExpect(status().isBadRequest());
        }
        verifyNoInteractions(service);
    }

    @Test @WithMockUser(roles = "ADMINISTRATOR") void blankAndOversizedContentIsRejected() throws Exception {
        for (String body : List.of("{}", "{\"title\":\" \",\"message\":\"text\"}",
                "{\"title\":\"Title\",\"message\":\"\\n\\t\"}",
                "{\"title\":\"" + "x".repeat(121) + "\",\"message\":\"text\"}",
                "{\"title\":\"Title\",\"message\":\"" + "x".repeat(4001) + "\"}")) {
            mvc.perform(post(ENDPOINT).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        }
        verifyNoInteractions(service);
    }
}
