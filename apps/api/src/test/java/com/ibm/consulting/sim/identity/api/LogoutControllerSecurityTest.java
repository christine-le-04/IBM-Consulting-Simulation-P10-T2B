package com.ibm.consulting.sim.identity.api;

import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.identity.domain.UserRepository;
import com.ibm.consulting.sim.identity.domain.UserRole;
import com.ibm.consulting.sim.identity.infrastructure.JwtTokenProvider;
import com.ibm.consulting.sim.identity.infrastructure.SecurityConfig;
import com.ibm.consulting.sim.identity.application.RefreshSessionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(LogoutController.class)
@Import(SecurityConfig.class)
class LogoutControllerSecurityTest {
    @Autowired MockMvc mvc;
    @MockBean JwtTokenProvider tokens;
    @MockBean UserRepository users;
    @MockBean RefreshSessionService sessions;
    @MockBean RefreshCookieSupport cookies;

    @Test
    void anonymousLogoutIsUnauthorized() throws Exception {
        mvc.perform(post("/api/v1/auth/logout")).andExpect(status().isUnauthorized());
        verify(sessions, never()).logout(anyString(), any());
    }

    @Test
    void authenticatedLogoutRevokesPresentedToken() throws Exception {
        authenticate();
        mvc.perform(post("/api/v1/auth/logout").header("Authorization", "Bearer valid-token"))
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        verify(sessions).logout("valid-token", null);
    }

    @Test
    void failedRevocationDoesNotPretendLogoutSucceededOrExposeDetails() throws Exception {
        authenticate();
        doThrow(new IllegalStateException("sensitive backend detail")).when(sessions).logout("valid-token", null);
        mvc.perform(post("/api/v1/auth/logout").header("Authorization", "Bearer valid-token"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.detail").value("An unexpected error occurred"));
    }

    private void authenticate() {
        User user = User.create("learner@example.test", "hash", "Learner", UserRole.LEARNER);
        when(tokens.extractUserId("valid-token")).thenReturn(user.getId());
        when(users.findById(user.getId())).thenReturn(Optional.of(user));
        when(tokens.isValidForUser("valid-token", user)).thenReturn(true);
    }
}
