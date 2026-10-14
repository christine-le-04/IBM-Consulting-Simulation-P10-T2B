package com.ibm.consulting.sim.identity.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ibm.consulting.sim.shared.infrastructure.cache.UpstashRestClient;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

class AuthRequestLimitFilterTest {
    private final AuthRequestLimitProperties properties = new AuthRequestLimitProperties();
    private final MutableClock clock = new MutableClock();
    private final AuthRequestLimitFilter filter = new AuthRequestLimitFilter(properties, new ObjectMapper(), null, clock);

    @Test void quotaExpiresAndFailuresStillConsumeBudget() throws Exception {
        properties.setLogin(2);
        assertThat(call(filter, "login", "192.0.2.1", null).getStatus()).isEqualTo(422);
        assertThat(call(filter, "login", "192.0.2.1", null).getStatus()).isEqualTo(422);
        var denied = call(filter, "login", "192.0.2.1", null);
        assertThat(denied.getStatus()).isEqualTo(429);
        assertThat(denied.getHeader("Retry-After")).isEqualTo("60");
        assertThat(denied.getContentAsString()).contains("Too many authentication requests");
        assertThat(call(filter, "login", "192.0.2.2", null).getStatus()).isEqualTo(422);
        clock.millis += 60_000;
        assertThat(call(filter, "login", "192.0.2.1", null).getStatus()).isEqualTo(422);
    }

    @Test void recoveryEndpointsShareBudget() throws Exception {
        properties.setRecovery(1);
        assertThat(call(filter, "password-reset/request", "192.0.2.1", null).getStatus()).isEqualTo(422);
        assertThat(call(filter, "email-verification/resend", "192.0.2.1", null).getStatus()).isEqualTo(429);
    }

    @Test void forwardedHeadersCannotBypassDefaultLimits() throws Exception {
        properties.setLogin(1);
        call(filter, "login", "192.0.2.1", "198.51.100.1");
        assertThat(call(filter, "login", "192.0.2.1", "198.51.100.2").getStatus()).isEqualTo(429);
    }

    @Test void explicitRailwayModeCanonicalizesIpAndRequiresValidHeader() throws Exception {
        properties.setTrustRailwayRealIp(true);
        properties.setLogin(1);
        call(filter, "login", "192.0.2.1", "2001:db8::1");
        assertThat(call(filter, "login", "192.0.2.1", "2001:0db8:0:0:0:0:0:1").getStatus()).isEqualTo(429);
        for (String header : new String[]{"example.com", "127.1", "192.0.2.1, 192.0.2.2", "::1%eth0"}) {
            assertThat(call(filter, "login", "192.0.2.1", header).getStatus()).isEqualTo(503);
        }
        assertThat(call(filter, "login", "192.0.2.1", null).getStatus()).isEqualTo(503);
    }

    @Test void globalBudgetAndCapacityCannotBeBypassedByRotatingClients() throws Exception {
        properties.setGlobal(2);
        call(filter, "login", "192.0.2.1", null);
        call(filter, "register", "192.0.2.2", null);
        assertThat(call(filter, "refresh", "192.0.2.3", null).getStatus()).isEqualTo(429);
        clock.millis += 60_000;
        properties.setMaximumTrackedClients(1);
        call(filter, "login", "192.0.2.1", null);
        assertThat(call(filter, "login", "192.0.2.2", null).getStatus()).isEqualTo(429);
        clock.millis += 60_000;
        assertThat(call(filter, "login", "192.0.2.2", null).getStatus()).isEqualTo(422);
    }

    @Test void concurrentRequestsCannotOverbookBudget() {
        properties.setLogin(5);
        AtomicInteger admitted = new AtomicInteger();
        IntStream.range(0, 100).parallel().forEach(i -> {
            try {
                if (call(filter, "login", "192.0.2.1", null).getStatus() == 422) admitted.incrementAndGet();
            } catch (Exception exception) { throw new RuntimeException(exception); }
        });
        assertThat(admitted.get()).isEqualTo(5);
    }

    @Test void logoutPreflightAndOtherRoutesAreUnaffected() throws Exception {
        properties.setGlobal(1);
        call(filter, "login", "192.0.2.1", null);
        assertThat(call(filter, "logout", "192.0.2.1", null).getStatus()).isEqualTo(422);
        var request = request("login", "192.0.2.1", null);
        request.setMethod("OPTIONS");
        var response = new MockHttpServletResponse();
        filter.doFilter(request, response, (req, res) -> res.getWriter().write("preflight"));
        assertThat(response.getContentAsString()).isEqualTo("preflight");
    }

    @Test void redisDenialsAndOutagesNeverFallBackToUnrestrictedAdmission() throws Exception {
        var redis = mock(UpstashRestClient.class);
        var distributed = new AuthRequestLimitFilter(properties, new ObjectMapper(), redis, clock);
        when(redis.execute(anyList())).thenReturn(new ObjectMapper().readTree("0"));
        assertThat(call(distributed, "login", "192.0.2.1", null).getStatus()).isEqualTo(429);
        when(redis.execute(anyList())).thenThrow(new IllegalStateException("private provider details"));
        var unavailable = call(distributed, "login", "192.0.2.1", null);
        assertThat(unavailable.getStatus()).isEqualTo(503);
        assertThat(unavailable.getContentAsString()).doesNotContain("private provider details");
        doReturn(new ObjectMapper().readTree("1")).when(redis).execute(anyList());
        assertThat(call(distributed, "login", "192.0.2.1", null).getStatus()).isEqualTo(422);
        verify(redis, times(3)).execute(argThat(command -> command.contains("identity:{auth-admission}:global")
                && command.stream().noneMatch(value -> value.contains("192.0.2.1"))));
    }

    private static MockHttpServletResponse call(AuthRequestLimitFilter filter, String route, String ip, String header)
            throws Exception {
        var response = new MockHttpServletResponse();
        filter.doFilter(request(route, ip, header), response, (req, res) -> ((MockHttpServletResponse) res).setStatus(422));
        return response;
    }

    private static MockHttpServletRequest request(String route, String ip, String header) {
        var request = new MockHttpServletRequest("POST", "/api/v1/auth/" + route);
        request.setServletPath("/api/v1/auth/" + route);
        request.setRemoteAddr(ip);
        if (header != null) request.addHeader("X-Real-IP", header);
        return request;
    }

    private static class MutableClock extends Clock {
        long millis = 1_000_000;
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return Instant.ofEpochMilli(millis); }
        public long millis() { return millis; }
    }
}
