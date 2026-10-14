package com.ibm.consulting.sim.identity.api;

import com.ibm.consulting.sim.identity.application.RefreshSessionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import io.jsonwebtoken.JwtException;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class LogoutController {
    private final RefreshSessionService sessions;
    private final RefreshCookieSupport cookies;

    public LogoutController(RefreshSessionService sessions, RefreshCookieSupport cookies) {
        this.sessions = sessions;
        this.cookies = cookies;
    }

    @PostMapping("/api/v1/auth/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@RequestHeader("Authorization") String authorization, HttpServletRequest request, HttpServletResponse response) {
        if (!authorization.startsWith("Bearer ")) throw new BadCredentialsException("Authentication required");
        try {
            if (sessions.logout(authorization.substring(7), cookies.read(request))) cookies.clear(response);
        } catch (JwtException | IllegalArgumentException exception) {
            throw new BadCredentialsException("Authentication required");
        }
    }
}
