package com.ibm.consulting.sim.identity.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ibm.consulting.sim.shared.infrastructure.cache.UpstashRestClient;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

/** Admission before password hashing, JSON parsing, database lookups and email delivery. */
public final class AuthRequestLimitFilter extends OncePerRequestFilter {
    private static final long WINDOW_MS = 60_000;
    private static final String SCRIPT = """
            local global = tonumber(redis.call('GET', KEYS[1]) or '0')
            local client = tonumber(redis.call('GET', KEYS[2]) or '0')
            if global >= tonumber(ARGV[1]) or client >= tonumber(ARGV[2]) then
              return 0
            end
            for i = 1, 2 do
              if redis.call('INCR', KEYS[i]) == 1 then
                redis.call('PEXPIRE', KEYS[i], ARGV[3])
              end
            end
            return 1
            """;
    private final AuthRequestLimitProperties properties;
    private final ObjectMapper mapper;
    private final UpstashRestClient redis;
    private final Clock clock;
    private final Map<String, Window> windows = new HashMap<>();
    private long globalExpires;
    private int globalCount;

    public AuthRequestLimitFilter(AuthRequestLimitProperties properties, ObjectMapper mapper,
                                  UpstashRestClient redis) {
        this(properties, mapper, redis, Clock.systemUTC());
    }

    AuthRequestLimitFilter(AuthRequestLimitProperties properties, ObjectMapper mapper,
                           UpstashRestClient redis, Clock clock) {
        this.properties = properties;
        this.mapper = mapper;
        this.redis = redis;
        this.clock = clock;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String group = group(request);
        if (group == null) {
            chain.doFilter(request, response);
            return;
        }
        String ip = properties.isTrustRailwayRealIp()
                ? request.getHeader("X-Real-IP") : request.getRemoteAddr();
        String canonical = canonicalIp(ip);
        if (canonical == null) {
            reject(response, 503, "Authentication temporarily unavailable");
            return;
        }
        boolean admitted;
        try {
            String key = group + ":" + digest(canonical);
            admitted = redis == null ? acquireLocal(key, limit(group)) : acquireRedis(key, limit(group));
        } catch (RuntimeException exception) {
            // Never silently remove distributed protection or reveal provider error details.
            reject(response, 503, "Authentication temporarily unavailable");
            return;
        }
        if (!admitted) {
            reject(response, 429, "Too many authentication requests. Try again shortly.");
            return;
        }
        chain.doFilter(request, response);
    }

    private String group(HttpServletRequest request) {
        if (!"POST".equals(request.getMethod())) return null;
        String path = request.getServletPath();
        return switch (path) {
            case "/api/v1/auth/login" -> "login";
            case "/api/v1/auth/register" -> "register";
            case "/api/v1/auth/email-verification/resend", "/api/v1/auth/password-reset/request" -> "recovery";
            case "/api/v1/auth/email-verification/confirm", "/api/v1/auth/password-reset/confirm" -> "confirm";
            case "/api/v1/auth/refresh" -> "refresh";
            default -> null;
        };
    }

    private int limit(String group) {
        return switch (group) {
            case "login" -> properties.getLogin();
            case "register" -> properties.getRegister();
            case "recovery" -> properties.getRecovery();
            case "confirm" -> properties.getConfirm();
            case "refresh" -> properties.getRefresh();
            default -> throw new IllegalArgumentException("Unknown authentication group");
        };
    }

    private boolean acquireRedis(String key, int maximum) {
        // Hash tags keep both keys in the same slot on clustered Redis.
        JsonNode result = redis.execute(List.of("EVAL", SCRIPT, "2",
                "identity:{auth-admission}:global", "identity:{auth-admission}:" + key,
                Integer.toString(properties.getGlobal()), Integer.toString(maximum), Long.toString(WINDOW_MS)));
        if (result == null || !result.isIntegralNumber() || (result.intValue() != 0 && result.intValue() != 1)) {
            throw new IllegalStateException("Invalid admission response");
        }
        return result.intValue() == 1;
    }

    private synchronized boolean acquireLocal(String key, int maximum) {
        long now = clock.millis();
        if (now >= globalExpires) {
            globalExpires = now + WINDOW_MS;
            globalCount = 0;
        }
        if (globalCount >= properties.getGlobal()) return false;
        Window window = windows.get(key);
        if (window == null || now >= window.expires) {
            if (window == null && windows.size() >= properties.getMaximumTrackedClients()) {
                windows.values().removeIf(value -> now >= value.expires);
                // Do not evict active counters: rotating IPs must not reset another IP's budget.
                if (windows.size() >= properties.getMaximumTrackedClients()) return false;
            }
            window = new Window(now + WINDOW_MS);
            windows.put(key, window);
        }
        if (window.count >= maximum) return false;
        window.count++;
        globalCount++;
        return true;
    }

    static String canonicalIp(String ip) {
        if (ip == null || ip.length() > 45) return null;
        // Only numeric literals; never resolve attacker-supplied hostnames through DNS.
        if (ip.contains(":")) {
            if (!ip.matches("[0-9a-fA-F:.]+")) return null;
        } else {
            String[] parts = ip.split("\\.", -1);
            if (parts.length != 4) return null;
            for (String part : parts) {
                if (!part.matches("0|[1-9][0-9]{0,2}") || Integer.parseInt(part) > 255) return null;
            }
        }
        try {
            return InetAddress.getByName(ip).getHostAddress();
        } catch (Exception exception) {
            return null;
        }
    }

    private static String digest(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private void reject(HttpServletResponse response, int status, String detail) throws IOException {
        response.setStatus(status);
        response.setHeader("Retry-After", "60");
        response.setHeader("Cache-Control", "no-store");
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        mapper.writeValue(response.getOutputStream(), ProblemDetail.forStatusAndDetail(
                org.springframework.http.HttpStatus.valueOf(status), detail));
    }

    private static final class Window {
        private final long expires;
        private int count;
        private Window(long expires) { this.expires = expires; }
    }
}
