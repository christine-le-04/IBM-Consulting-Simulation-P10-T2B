package com.ibm.consulting.sim.identity.api;

import com.ibm.consulting.sim.identity.application.RefreshSessionProperties;
import com.ibm.consulting.sim.shared.config.CorsProperties;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;

@Component
public class RefreshCookieSupport {
    public static final String COOKIE_NAME = "__Host-sim_refresh";
    public static final String SESSION_HEADER = "X-Session-Request";
    private final RefreshSessionProperties properties;
    private final CorsProperties cors;

    public RefreshCookieSupport(RefreshSessionProperties properties, CorsProperties cors) {
        if (!List.of("Strict", "Lax", "None").contains(properties.getSameSite()) || !properties.isSecureCookie()) {
            throw new IllegalArgumentException("Refresh cookies require Secure and SameSite Strict, Lax, or None");
        }
        this.properties = properties;
        this.cors = cors;
    }

    public boolean isBrowserSession(HttpServletRequest request) {
        return "1".equals(request.getHeader(SESSION_HEADER));
    }

    public void requireTrustedBrowser(HttpServletRequest request) {
        String origin = request.getHeader(HttpHeaders.ORIGIN);
        // The non-simple header forces a CORS preflight on cross-origin browser
        // requests. Exact trusted origins also reject same-site hostile hosts.
        if (!isBrowserSession(request) || origin == null || !cors.getAllowedOrigins().contains(origin)) {
            throw new AccessDeniedException("Untrusted session request");
        }
    }

    public String read(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        var matches = Arrays.stream(request.getCookies()).filter(cookie -> COOKIE_NAME.equals(cookie.getName())).toList();
        return matches.size() == 1 ? matches.getFirst().getValue() : null;
    }

    public void write(HttpServletResponse response, String credential, Instant expiresAt) {
        if (credential == null) return; // Concurrent refresh must not overwrite the newer cookie.
        response.addHeader(HttpHeaders.SET_COOKIE, cookie(credential)
                .maxAge(Duration.ofSeconds(Math.max(0, Duration.between(Instant.now(), expiresAt).toSeconds())))
                .build().toString());
    }

    public void clear(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookie("").maxAge(Duration.ZERO).build().toString());
    }

    private ResponseCookie.ResponseCookieBuilder cookie(String value) {
        return ResponseCookie.from(COOKIE_NAME, value).httpOnly(true).secure(properties.isSecureCookie())
                .sameSite(properties.getSameSite()).path("/");
    }
}
