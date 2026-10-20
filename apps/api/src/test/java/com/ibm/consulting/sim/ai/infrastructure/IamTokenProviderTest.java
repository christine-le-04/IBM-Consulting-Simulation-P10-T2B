package com.ibm.consulting.sim.ai.infrastructure;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class IamTokenProviderTest {
    @Test
    void stopsWaitingWhenAnotherRequestHoldsTheRefreshLock() {
        IamTokenProvider provider = new IamTokenProvider("unused");
        ReentrantLock lock = (ReentrantLock) ReflectionTestUtils.getField(provider, "tokenLock");
        var executor = Executors.newVirtualThreadPerTaskExecutor();
        lock.lock();
        try {
            var waiting = executor.submit(provider::resolveAccessToken);
            assertThatThrownBy(() -> waiting.get(7, TimeUnit.SECONDS))
                    .isInstanceOf(java.util.concurrent.ExecutionException.class)
                    .hasCauseInstanceOf(IllegalStateException.class)
                    .hasRootCauseMessage("IBM IAM token refresh is busy; please retry");
        } finally {
            executor.shutdownNow();
            lock.unlock();
        }
    }
}
