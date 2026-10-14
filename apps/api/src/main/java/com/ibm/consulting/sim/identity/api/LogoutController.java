package com.ibm.consulting.sim.identity.api;

import com.ibm.consulting.sim.identity.infrastructure.JwtTokenProvider;
import io.jsonwebtoken.JwtException;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class LogoutController {
    private final JwtTokenProvider tokens;

    public LogoutController(JwtTokenProvider tokens) {
        this.tokens = tokens;
    }

    @PostMapping("/api/v1/auth/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@RequestHeader("Authorization") String authorization) {
        if (!authorization.startsWith("Bearer ")) throw new BadCredentialsException("Authentication required");
        try {
            tokens.revokeToken(authorization.substring(7));
        } catch (JwtException | IllegalArgumentException exception) {
            throw new BadCredentialsException("Authentication required");
        }
    }
}
