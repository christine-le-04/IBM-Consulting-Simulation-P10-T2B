package com.ibm.consulting.sim.identity.api;

import com.ibm.consulting.sim.identity.application.RefreshSessionProperties;
import com.ibm.consulting.sim.shared.config.CorsProperties;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.access.AccessDeniedException;
import java.util.List;
import static org.assertj.core.api.Assertions.*;

class RefreshCookieSupportTest {
    @Test
    void crossSiteCookieRequiresSecureTransport() {
        var properties = new RefreshSessionProperties();
        properties.setSameSite("None");
        properties.setSecureCookie(false);
        assertThatThrownBy(() -> new RefreshCookieSupport(properties, new CorsProperties()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void wildcardOriginsDoNotAuthorizeCookieOperations() {
        var cors = new CorsProperties();
        cors.setAllowedOrigins(List.of("https://*.example.test"));
        var cookies = new RefreshCookieSupport(new RefreshSessionProperties(), cors);
        var request = new MockHttpServletRequest();
        request.addHeader("Origin", "https://hostile.example.test");
        request.addHeader("X-Session-Request", "1");
        assertThatThrownBy(() -> cookies.requireTrustedBrowser(request)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void ambiguousCookieNamesCannotSelectAnAttackerChosenSession() {
        var cookies = new RefreshCookieSupport(new RefreshSessionProperties(), new CorsProperties());
        var request = new MockHttpServletRequest();
        request.setCookies(new Cookie("__Host-sim_refresh", "first"), new Cookie("__Host-sim_refresh", "second"));
        assertThat(cookies.read(request)).isNull();
    }
}
