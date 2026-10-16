package com.ibm.consulting.sim.announcement;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.identity.domain.UserRole;
import com.ibm.consulting.sim.lead.domain.EvidenceType;
import com.ibm.consulting.sim.lead.domain.Lead;
import com.ibm.consulting.sim.lead.domain.LeadDifficulty;
import com.ibm.consulting.sim.scenario.application.ScenarioAuthoringConfigService;
import com.ibm.consulting.sim.scenario.domain.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.broker.SimpleBrokerMessageHandler;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.WebSocket;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

/** Real HTTP, authentication, STOMP, broker, database and after-commit delivery; no transport mocks. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "app.jwt.secret=browser-delivery-test-only-secret-at-least-sixty-four-bytes-long-1234567890",
        "app.cors.allowed-origins=http://localhost:3000", "app.ai.mock-mode=true", "app.watsonx.mock-mode=true",
        "app.cos.mock-mode=true", "app.cache.provider=caffeine", "app.admin.seed.email=", "app.admin.seed.password="
})
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class AnnouncementDeliveryIntegrationTest {
    private static final String ORIGIN = "http://localhost:3000";
    private static final String PASSWORD = "Delivery-test-password-123!";
    @Container
    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
            DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.flyway.url", postgres::getJdbcUrl);
        registry.add("spring.flyway.user", postgres::getUsername);
        registry.add("spring.flyway.password", postgres::getPassword);
    }

    @LocalServerPort int port;
    @Autowired ObjectMapper mapper;
    @Autowired PasswordEncoder passwords;
    @Autowired EntityManager entities;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactions;
    @Autowired ScenarioAuthoringConfigService authoring;
    @Autowired SimpleBrokerMessageHandler broker;
    private final List<Socket> sockets = new ArrayList<>();
    private HttpClient http;
    private String adminToken;
    private String learnerToken;
    private UUID scenarioId;

    @BeforeEach
    void prepare() throws Exception {
        http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
        String suffix = UUID.randomUUID().toString();
        String adminEmail = "admin-" + suffix + "@example.test";
        String learnerEmail = "learner-" + suffix + "@example.test";
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            entities.persist(User.create(adminEmail, passwords.encode(PASSWORD), "Delivery administrator", UserRole.ADMINISTRATOR));
            entities.persist(User.create(learnerEmail, passwords.encode(PASSWORD), "Delivery learner", UserRole.LEARNER));
            scenarioId = readyScenario();
        });
        adminToken = login(adminEmail);
        learnerToken = login(learnerEmail);
    }

    @AfterEach
    void closeConnections() {
        sockets.forEach(Socket::close);
        try {
            awaitSubscriptions(0);
        } finally {
            if (http != null) http.close();
        }
    }

    @Test
    void publishAndArchiveThroughAdminApiReachAnotherSignedInClientOverTheWebSocket() throws Exception {
        Socket admin = subscribe(adminToken);
        Socket learner = subscribe(learnerToken);
        awaitSubscriptions(2);

        for (String action : List.of("publish", "archive")) {
            HttpResponse<String> response = request("PATCH", "/api/v1/admin/scenarios/" + scenarioId + "/" + action, adminToken, null);
            assertThat(response.statusCode()).as(response.body()).isEqualTo(200);
            String kind = action.equals("publish") ? "SCENARIO_PUBLISHED" : "SCENARIO_ARCHIVED";
            assertThat(mapper.readTree(response.body()).get("status").asText()).isEqualTo(action.equals("publish") ? "ACTIVE" : "ARCHIVED");
            UUID id = jdbc.queryForObject("SELECT id FROM announcements WHERE scenario_id = ? AND kind = ?", UUID.class, scenarioId, kind);
            assertNotification(admin, id);
            assertNotification(learner, id);
            JsonNode item = announcement(learnerToken, id);
            assertThat(item.get("kind").asText()).isEqualTo(kind);
            assertThat(item.get("scenarioId").asText()).isEqualTo(scenarioId.toString());
            assertThat(item.get("read").asBoolean()).isFalse();
        }
    }

    @Test
    void targetedAnnouncementsBroadcastOnlyAnOpaqueIdAndHttpEnforcesTheAudience() throws Exception {
        Socket admin = subscribe(adminToken);
        Socket learner = subscribe(learnerToken);
        awaitSubscriptions(2);
        var response = request("POST", "/api/v1/admin/announcements", adminToken,
                Map.of("title", "Private learner update", "message", "Private content", "targetRoles", List.of("LEARNER"), "requestId", UUID.randomUUID()));
        assertThat(response.statusCode()).as(response.body()).isEqualTo(201);
        UUID id = UUID.fromString(mapper.readTree(response.body()).get("id").asText());
        assertNotification(admin, id);
        assertNotification(learner, id);
        assertThat(announcement(learnerToken, id).get("message").asText()).isEqualTo("Private content");
        var adminFeed = request("GET", "/api/v1/announcements", adminToken, null);
        assertThat(adminFeed.statusCode()).isEqualTo(200);
        assertThat(mapper.readTree(adminFeed.body()).get("items").findValuesAsText("id")).doesNotContain(id.toString());
        assertThat(request("POST", "/api/v1/admin/announcements", learnerToken,
                Map.of("title", "Not allowed", "message", "Forbidden")).statusCode()).isEqualTo(403);
    }

    private String login(String email) throws Exception {
        var response = request("POST", "/api/v1/auth/login", null, Map.of("email", email, "password", PASSWORD));
        assertThat(response.statusCode()).as(response.body()).isEqualTo(200);
        return mapper.readTree(response.body()).get("accessToken").asText();
    }

    private HttpResponse<String> request(String method, String path, String token, Object body) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).timeout(Duration.ofSeconds(15))
                .header("Origin", ORIGIN).header("Content-Type", "application/json");
        if (token != null) builder.header("Authorization", "Bearer " + token);
        if (path.equals("/api/v1/auth/login")) builder.header("X-Session-Request", "1");
        return http.send(builder.method(method, body == null ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body))).build(), HttpResponse.BodyHandlers.ofString());
    }

    private JsonNode announcement(String token, UUID id) throws Exception {
        var response = request("GET", "/api/v1/announcements", token, null);
        assertThat(response.statusCode()).isEqualTo(200);
        for (JsonNode item : mapper.readTree(response.body()).get("items")) if (item.get("id").asText().equals(id.toString())) return item;
        throw new AssertionError("Delivered announcement is missing from the recipient's persisted feed: " + id);
    }

    private Socket subscribe(String token) throws Exception {
        Socket client = new Socket();
        sockets.add(client);
        client.connection = http.newWebSocketBuilder().header("Origin", ORIGIN)
                .buildAsync(URI.create("ws://localhost:" + port + "/ws"), client).get(10, TimeUnit.SECONDS);
        client.send("CONNECT\naccept-version:1.2\nhost:localhost\nheart-beat:0,0\nAuthorization:Bearer " + token + "\n\n\0");
        assertThat(client.receive()).startsWith("CONNECTED\n");
        client.send("SUBSCRIBE\nid:announcements\ndestination:/topic/announcements\nack:auto\n\n\0");
        return client;
    }

    private void awaitSubscriptions(int count) {
        var message = MessageBuilder.withPayload(new byte[0])
                .setHeader(SimpMessageHeaderAccessor.DESTINATION_HEADER, "/topic/announcements")
                .setHeader(SimpMessageHeaderAccessor.MESSAGE_TYPE_HEADER, SimpMessageType.MESSAGE).build();
        // Wait for actual broker registration rather than racing SUBSCRIBE against publication.
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() ->
                assertThat(broker.getSubscriptionRegistry().findSubscriptions(message)).hasSize(count));
    }

    private void assertNotification(Socket client, UUID id) throws Exception {
        String frame = client.receive();
        assertThat(frame).startsWith("MESSAGE\n");
        assertThat(frame).contains("\ndestination:/topic/announcements\n");
        JsonNode payload = mapper.readTree(frame.substring(frame.indexOf("\n\n") + 2));
        assertThat(payload.size()).isEqualTo(1);
        assertThat(payload.get("id").asText()).isEqualTo(id.toString());
    }

    private UUID readyScenario() {
        Scenario scenario = Scenario.create("Delivery scenario " + UUID.randomUUID(), "Technology", "Browser delivery fixture", 3);
        scenario.updateBriefing("Consultant", "Deliver a grounded recommendation", List.of("Evidence used"), 10);
        scenario.updateProblemBriefing("Modernise a critical workflow", "Delivery delays", "Validate causes", List.of("What causes delays?"));
        scenario.updateRubricWeights(Map.of("Communication", 100));
        scenario.addPersona("Client", "CIO", "Example Corp", "Direct", "Delivery risk", "Budget", "Modernise");
        authoring.update(scenario, new ScenarioAuthoringConfig(
                List.of(new CanonicalFact("fact-1", "Constraint", "Budget is capped", EvidenceType.FINANCIAL_SIGNAL, true)),
                List.of(new RevealRule(RevealTarget.BUDGET_SIGNAL, Set.of(EvidenceType.FINANCIAL_SIGNAL), 1))));
        entities.persist(scenario);
        Lead lead = Lead.create(scenario.getId(), "Example Corp", "Technology", "Modernisation", LeadDifficulty.MEDIUM);
        lead.configure("Example Corp", "Technology", "Modernisation", LeadDifficulty.MEDIUM, "$100K-$250K", "CIO", "Cloud", "Funding available", "High",
                List.of(new Lead.SignalInput("Programme announced", "OPPORTUNITY")));
        entities.persist(lead);
        return scenario.getId();
    }

    private static class Socket implements WebSocket.Listener {
        private final BlockingQueue<String> frames = new LinkedBlockingQueue<>();
        private final StringBuilder pending = new StringBuilder();
        private WebSocket connection;
        @Override public void onOpen(WebSocket socket) { socket.request(1); }
        @Override public CompletionStage<?> onText(WebSocket socket, CharSequence text, boolean last) {
            pending.append(text);
            int end;
            while ((end = pending.indexOf("\0")) >= 0) {
                frames.add(pending.substring(0, end).stripLeading().replace("\r\n", "\n"));
                pending.delete(0, end + 1);
            }
            socket.request(1);
            return null;
        }
        @Override public void onError(WebSocket socket, Throwable error) { frames.add("TRANSPORT ERROR: " + error); }
        void send(String frame) { connection.sendText(frame, true).join(); }
        String receive() throws InterruptedException {
            String frame = frames.poll(10, TimeUnit.SECONDS);
            assertThat(frame).as("Expected a STOMP frame from the real server").isNotNull();
            return frame;
        }
        void close() { if (connection != null) connection.abort(); }
    }
}
