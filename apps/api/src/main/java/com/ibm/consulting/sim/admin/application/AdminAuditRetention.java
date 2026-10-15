package com.ibm.consulting.sim.admin.application;

import com.ibm.consulting.sim.shared.infrastructure.observability.AdminAuditEventRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Component
public class AdminAuditRetention {
    private final AdminAuditEventRepository repository;
    private final int days;
    private final Clock clock;

    @Autowired
    public AdminAuditRetention(AdminAuditEventRepository repository,
                               @Value("${app.admin.audit.retention-days:90}") int days) {
        this(repository, days, Clock.systemUTC());
    }

    AdminAuditRetention(AdminAuditEventRepository repository, int days, Clock clock) {
        if (days < 1 || days > 3650) throw new IllegalArgumentException("Audit retention must be between 1 and 3650 days");
        this.repository = repository;
        this.days = days;
        this.clock = clock;
    }

    public int days() { return days; }
    public Instant cutoff() { return clock.instant().minus(days, ChronoUnit.DAYS); }

    // One bounded batch per run avoids a long transaction or blocking other scheduled work.
    @Scheduled(initialDelay = 60000, fixedDelayString = "${app.admin.audit.cleanup-interval-ms:3600000}")
    @Transactional
    public int purgeExpired() { return repository.deleteExpiredBatch(cutoff()); }
}
