package com.ibm.consulting.sim.shared.infrastructure.observability;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.ibm.consulting.sim.identity.domain.User;

@Component
public class AuditLogger {
    private static final Logger log = LoggerFactory.getLogger(AuditLogger.class);
    private final AdminAuditEventRepository repository;
    public AuditLogger(AdminAuditEventRepository repository) { this.repository = repository; }

    // overloaded method that doesn't require details
    @Transactional
    public void recordAdmin(AuditAction action, String targetType, String targetId) {
        recordAdmin(action, targetType, targetId, null);
    }

    // for admin actions
    @Transactional
    public void recordAdmin(AuditAction action, String targetType, String targetId, String details) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        User actor = auth != null && auth.getPrincipal() instanceof User user ? user : null;
        AdminAuditEvent recorded = AdminAuditEvent.create(action, targetType, targetId, details, actor);
        repository.save(recorded);
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { writeLog(recorded); }
            });
        } else {
            writeLog(recorded);
        }
    }

    private void writeLog(AdminAuditEvent recorded) {
        var event = log.atInfo()
                .addKeyValue("event", recorded.getAction().name())
                .addKeyValue("adminUUID", recorded.getActorId())
                .addKeyValue("targetType", recorded.getTargetType())
                .addKeyValue("targetUUID", recorded.getTargetId())
                .addKeyValue("timestamp", recorded.getOccurredAt().toString());
        if (recorded.getDetails() != null) {
            event.addKeyValue("details", recorded.getDetails());
        }
        event.log("Admin audit event logged");
    }

}
