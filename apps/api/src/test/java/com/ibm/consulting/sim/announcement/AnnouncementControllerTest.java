package com.ibm.consulting.sim.announcement;

import com.ibm.consulting.sim.announcement.api.AnnouncementController;
import com.ibm.consulting.sim.announcement.application.AnnouncementService;
import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.identity.domain.UserRepository;
import com.ibm.consulting.sim.identity.domain.UserRole;
import com.ibm.consulting.sim.identity.infrastructure.JwtTokenProvider;
import com.ibm.consulting.sim.identity.infrastructure.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import java.util.List;
import java.util.UUID;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AnnouncementController.class)
@Import(SecurityConfig.class)
class AnnouncementControllerTest {
    @Autowired MockMvc mvc;
    @MockBean AnnouncementService service;
    @MockBean JwtTokenProvider tokens;
    @MockBean UserRepository users;
    private final User learner = User.create("learner@example.test", "hash", "Learner", UserRole.LEARNER);

    @Test void anonymousClientsCannotReadOrMarkAnnouncements() throws Exception {
        mvc.perform(get("/api/v1/announcements")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/announcements/read").contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[]}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/announcements/unread").contentType(MediaType.APPLICATION_JSON).content("{\"ids\":[]}"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }

    @Test void allRolesCanReadTheirFeedWithoutCaching() throws Exception {
        for (UserRole role : UserRole.values()) {
            User user = User.create(role + "@example.test", "hash", role.name(), role);
            var auth = new UsernamePasswordAuthenticationToken(user, null, List.of());
            when(service.list(user.getId(), 0, 20, false)).thenReturn(new AnnouncementService.Feed(List.of(), 0, 0, 0, 20));
            mvc.perform(get("/api/v1/announcements").with(authentication(auth)))
                    .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"));
            verify(service).list(user.getId(), 0, 20, false);
        }
    }

    @Test void validatesRequestsAndUsesAuthenticatedIdentityForReadState() throws Exception {
        var auth = new UsernamePasswordAuthenticationToken(learner, null, List.of());
        mvc.perform(get("/api/v1/announcements?size=51").with(authentication(auth))).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/announcements?page=-1").with(authentication(auth))).andExpect(status().isBadRequest());
        for (String body : List.of("{\"ids\":[]}", "{\"ids\":[null]}", "{\"ids\":[\"invalid\"]}")) {
            mvc.perform(post("/api/v1/announcements/read").with(authentication(auth)).contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
        verifyNoInteractions(service);
        UUID id = UUID.randomUUID();
        mvc.perform(post("/api/v1/announcements/read").with(authentication(auth)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"ids\":[\"" + id + "\"],\"userId\":\"" + UUID.randomUUID() + "\"}"))
                .andExpect(status().isNoContent());
        verify(service).markRead(learner.getId(), List.of(id));
        mvc.perform(post("/api/v1/announcements/unread").with(authentication(auth)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"ids\":[\"" + id + "\"]}"))
                .andExpect(status().isNoContent()).andExpect(header().string("Cache-Control", "no-store"));
        verify(service).markUnread(learner.getId(), List.of(id));
    }
}
