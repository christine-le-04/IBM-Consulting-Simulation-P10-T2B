package com.ibm.consulting.sim.identity.api;

import com.ibm.consulting.sim.identity.application.RefreshSessionService;
import com.ibm.consulting.sim.identity.application.TokenResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RefreshController {
    private final RefreshSessionService sessions;
    private final RefreshCookieSupport cookies;
    public RefreshController(RefreshSessionService sessions, RefreshCookieSupport cookies) {
        this.sessions = sessions;
        this.cookies = cookies;
    }

    @PostMapping("/api/v1/auth/refresh")
    public TokenResponse refresh(HttpServletRequest request, HttpServletResponse response) {
        cookies.requireTrustedBrowser(request);
        try {
            var issued = sessions.refresh(cookies.read(request));
            cookies.write(response, issued.refreshCookie(), issued.expiresAt());
            return issued.access();
        } catch (BadCredentialsException exception) {
            cookies.clear(response);
            throw exception;
        }
    }
}
