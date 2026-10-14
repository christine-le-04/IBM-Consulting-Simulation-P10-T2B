package com.ibm.consulting.sim.identity.application;

import org.springframework.boot.context.properties.ConfigurationProperties;
import java.time.Duration;

@ConfigurationProperties(prefix = "app.identity.refresh")
public class RefreshSessionProperties {
    private Duration lifetime = Duration.ofDays(7);
    private boolean secureCookie = true;
    private String sameSite = "Lax";
    public Duration getLifetime() { return lifetime; }
    public void setLifetime(Duration lifetime) { this.lifetime = lifetime; }
    public boolean isSecureCookie() { return secureCookie; }
    public void setSecureCookie(boolean secureCookie) { this.secureCookie = secureCookie; }
    public String getSameSite() { return sameSite; }
    public void setSameSite(String sameSite) { this.sameSite = sameSite; }
}
