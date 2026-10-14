package com.ibm.consulting.sim.identity.infrastructure;

import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties("app.identity.request-limits")
public class AuthRequestLimitProperties {
    @Min(1) private int login = 20;
    @Min(1) private int register = 3;
    @Min(1) private int recovery = 5;
    @Min(1) private int confirm = 20;
    @Min(1) private int refresh = 60;
    @Min(1) private int global = 1000;
    @Min(1) private int maximumTrackedClients = 10_000;
    private boolean trustRailwayRealIp;

    public int getLogin() { return login; }
    public void setLogin(int value) { login = value; }
    public int getRegister() { return register; }
    public void setRegister(int value) { register = value; }
    public int getRecovery() { return recovery; }
    public void setRecovery(int value) { recovery = value; }
    public int getConfirm() { return confirm; }
    public void setConfirm(int value) { confirm = value; }
    public int getRefresh() { return refresh; }
    public void setRefresh(int value) { refresh = value; }
    public int getGlobal() { return global; }
    public void setGlobal(int value) { global = value; }
    public int getMaximumTrackedClients() { return maximumTrackedClients; }
    public void setMaximumTrackedClients(int value) { maximumTrackedClients = value; }
    public boolean isTrustRailwayRealIp() { return trustRailwayRealIp; }
    public void setTrustRailwayRealIp(boolean value) { trustRailwayRealIp = value; }
}
