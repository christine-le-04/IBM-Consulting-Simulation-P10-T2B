package com.ibm.consulting.sim.ai.infrastructure;

import com.ibm.consulting.sim.ai.domain.AiProviderException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.net.SocketTimeoutException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class GeminiProviderTest {
    private final RestClient.Builder builder = RestClient.builder().baseUrl("https://gemini.test");
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private final GeminiProvider provider = new GeminiProvider("https://gemini.test", "test-key", "test-model", 20_000);

    @Test
    void sendsALongConversationPromptWithoutTruncatingIt() {
        ReflectionTestUtils.setField(provider, "restClient", builder.build());
        String prompt = "p".repeat(436);
        server.expect(requestTo("https://gemini.test/v1beta/models/test-model:generateContent"))
                .andExpect(header("x-goog-api-key", "test-key"))
                .andExpect(content().string(org.hamcrest.Matchers.containsString(prompt)))
                .andRespond(withSuccess("{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"reply\"}]}}]}", MediaType.APPLICATION_JSON));

        assertThat(provider.complete("persona_dialogue", prompt)).isEqualTo("reply");
        server.verify();
    }

    @Test
    void identifiesTimeoutHiddenInsideAResponseExtractionFailure() {
        ReflectionTestUtils.setField(provider, "restClient", builder.build());
        server.expect(requestTo("https://gemini.test/v1beta/models/test-model:generateContent"))
                .andRespond(request -> {
                    throw new RestClientException("Error extracting octet-stream response",
                            new SocketTimeoutException("Read timed out"));
                });

        assertThatThrownBy(() -> provider.complete("persona_dialogue", "prompt"))
                .isInstanceOf(AiProviderException.class)
                .hasMessageContaining("request timed out")
                .hasRootCauseInstanceOf(SocketTimeoutException.class);
        server.verify();
    }

    @Test
    void upstreamOverloadRemainsAProviderFailureForFailover() {
        ReflectionTestUtils.setField(provider, "restClient", builder.build());
        server.expect(requestTo("https://gemini.test/v1beta/models/test-model:generateContent"))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));

        assertThatThrownBy(() -> provider.complete("persona_dialogue", "prompt"))
                .isInstanceOf(AiProviderException.class)
                .hasMessageContaining("Gemini call failed");
        server.verify();
    }
}
