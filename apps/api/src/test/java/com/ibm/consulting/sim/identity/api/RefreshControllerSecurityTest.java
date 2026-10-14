package com.ibm.consulting.sim.identity.api;

import com.ibm.consulting.sim.identity.application.*;
import com.ibm.consulting.sim.identity.domain.UserRepository;
import com.ibm.consulting.sim.identity.infrastructure.JwtTokenProvider;
import com.ibm.consulting.sim.identity.infrastructure.SecurityConfig;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest({AuthController.class, RefreshController.class})
@Import({SecurityConfig.class, RefreshCookieSupport.class})
@EnableConfigurationProperties(RefreshSessionProperties.class)
class RefreshControllerSecurityTest {
    @Autowired MockMvc mvc;
    @MockBean RefreshSessionService sessions;
    @MockBean AuthenticateUseCase authenticate;
    @MockBean RegisterUserUseCase register;
    @MockBean EmailVerificationService verification;
    @MockBean PasswordResetService reset;
    @MockBean LoginAttemptLimiter limiter;
    @MockBean JwtTokenProvider tokens;
    @MockBean UserRepository users;

    @Test
    void browserLoginSetsOnlyHttpOnlyRefreshCookieAndReturnsShortAccess() throws Exception {
        TokenResponse original = new TokenResponse("legacy-token", "user", "Learner", "LEARNER", false);
        when(authenticate.execute(anyString(), anyString())).thenReturn(original);
        when(sessions.open(original)).thenReturn(issued("refresh-secret"));
        mvc.perform(post("/api/v1/auth/login").header("Origin", "http://localhost:3000").header("X-Session-Request", "1")
                .contentType("application/json").content("{\"email\":\"learner@example.test\",\"password\":\"StrongPassword1!\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.accessToken").value("short-token"))
                .andExpect(jsonPath("$.refreshCookie").doesNotExist())
                .andExpect(header().string("Set-Cookie", containsString("HttpOnly")))
                .andExpect(header().string("Set-Cookie", containsString("Secure")))
                .andExpect(header().string("Set-Cookie", containsString("SameSite=Lax")))
                .andExpect(header().string("Set-Cookie", containsString("__Host-sim_refresh=")))
                .andExpect(header().string("Set-Cookie", containsString("Path=/")));
    }

    @Test
    void validRefreshRotatesCookieWithoutRequiringAnAccessJwt() throws Exception {
        when(sessions.refresh("previous-secret")).thenReturn(issued("rotated-secret"));
        mvc.perform(post("/api/v1/auth/refresh").header("Origin", "http://localhost:3000").header("X-Session-Request", "1")
                .cookie(new Cookie("__Host-sim_refresh", "previous-secret")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.sessionId").value("session-id"))
                .andExpect(header().string("Set-Cookie", containsString("__Host-sim_refresh=rotated-secret")));
    }

    @Test
    void missingHeaderAndUntrustedOriginsCannotRefreshOrChangeCookies() throws Exception {
        mvc.perform(post("/api/v1/auth/refresh").header("Origin", "http://localhost:3000"))
                .andExpect(status().isForbidden()).andExpect(header().doesNotExist("Set-Cookie"));
        mvc.perform(post("/api/v1/auth/refresh").header("Origin", "https://attacker.example").header("X-Session-Request", "1"))
                .andExpect(status().isForbidden()).andExpect(header().doesNotExist("Set-Cookie"));
        verifyNoInteractions(sessions);
    }

    @Test
    void invalidRefreshReturns401AndClearsItsCookie() throws Exception {
        when(sessions.refresh(null)).thenThrow(new BadCredentialsException("sensitive credential detail"));
        mvc.perform(post("/api/v1/auth/refresh").header("Origin", "http://localhost:3000").header("X-Session-Request", "1"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.detail").value("Authentication required"))
                .andExpect(header().string("Set-Cookie", containsString("Max-Age=0")));
    }

    @Test
    void concurrentRefreshDoesNotOverwriteTheNewCookie() throws Exception {
        when(sessions.refresh("previous-secret")).thenReturn(issued(null));
        mvc.perform(post("/api/v1/auth/refresh").header("Origin", "http://localhost:3000").header("X-Session-Request", "1")
                .cookie(new Cookie("__Host-sim_refresh", "previous-secret")))
                .andExpect(status().isOk()).andExpect(header().doesNotExist("Set-Cookie"));
    }

    @Test
    void cookieCannotAuthenticateOtherApiEndpoints() throws Exception {
        mvc.perform(post("/api/v1/engagements").cookie(new Cookie("__Host-sim_refresh", "secret")))
                .andExpect(status().isUnauthorized());
    }

    private RefreshSessionService.IssuedSession issued(String cookie) {
        return new RefreshSessionService.IssuedSession(new TokenResponse("short-token", "user", "Learner", "LEARNER", false,
                "session-id", System.currentTimeMillis() + 900000), cookie, Instant.now().plusSeconds(3600));
    }
}
