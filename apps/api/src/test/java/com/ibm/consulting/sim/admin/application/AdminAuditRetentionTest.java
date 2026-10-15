package com.ibm.consulting.sim.admin.application;

import com.ibm.consulting.sim.shared.infrastructure.observability.AdminAuditEventRepository;
import org.junit.jupiter.api.Test;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class AdminAuditRetentionTest {
    @Test void cleanupUsesTheConfiguredUtcRetentionCutoff() {
        var repository = mock(AdminAuditEventRepository.class);
        var policy = new AdminAuditRetention(repository, 90,
                Clock.fixed(Instant.parse("2026-10-15T12:00:00Z"), ZoneOffset.UTC));
        when(repository.deleteExpiredBatch(Instant.parse("2026-07-17T12:00:00Z"))).thenReturn(12);
        assertThat(policy.days()).isEqualTo(90);
        assertThat(policy.purgeExpired()).isEqualTo(12);
        verify(repository).deleteExpiredBatch(Instant.parse("2026-07-17T12:00:00Z"));
    }

    @Test void rejectsUnboundedOrNonpositiveRetention() {
        for (int days : new int[]{-1, 0, 3651}) {
            assertThatThrownBy(() -> new AdminAuditRetention(mock(AdminAuditEventRepository.class), days))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }
}
