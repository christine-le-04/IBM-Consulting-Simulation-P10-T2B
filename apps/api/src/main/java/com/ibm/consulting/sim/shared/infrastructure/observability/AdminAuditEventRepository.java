package com.ibm.consulting.sim.shared.infrastructure.observability;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import java.util.UUID;
import java.time.Instant;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AdminAuditEventRepository extends JpaRepository<AdminAuditEvent, UUID>, JpaSpecificationExecutor<AdminAuditEvent> {
    @Modifying
    @Query(value = """
            DELETE FROM admin_audit_events WHERE id IN (
                SELECT id FROM admin_audit_events WHERE occurred_at < :cutoff
                ORDER BY occurred_at, id LIMIT 1000
            )
            """, nativeQuery = true)
    int deleteExpiredBatch(@Param("cutoff") Instant cutoff);
}
