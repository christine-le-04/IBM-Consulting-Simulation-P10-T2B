package com.ibm.consulting.sim.shared.infrastructure.observability;

import com.ibm.consulting.sim.identity.domain.User;
import jakarta.persistence.*;
import org.hibernate.annotations.Immutable;
import java.time.Instant;
import java.util.UUID;

/** Actor and target snapshots survive account or resource deletion. Never contains credentials. */
@Entity
@Immutable
@Table(name = "admin_audit_events")
public class AdminAuditEvent {
    @Id private UUID id;
    @Column(nullable = false) private Instant occurredAt;
    private UUID actorId;
    @Column(length = 80) private String actorDisplayName;
    @Column(length = 255) private String actorEmail;
    @Column(length = 40) private String actorRole;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 64) private AuditAction action;
    @Column(nullable = false, length = 40) private String targetType;
    @Column(nullable = false, length = 100) private String targetId;
    @Column(columnDefinition = "text") private String details;

    protected AdminAuditEvent() {}

    public static AdminAuditEvent create(AuditAction action, String targetType, String targetId, String details, User actor) {
        AdminAuditEvent event = new AdminAuditEvent();
        event.id = UUID.randomUUID();
        event.occurredAt = Instant.now();
        event.action = java.util.Objects.requireNonNull(action);
        event.targetType = bounded(java.util.Objects.requireNonNull(targetType), 40);
        event.targetId = bounded(java.util.Objects.requireNonNull(targetId), 100);
        event.details = bounded(details, 2000);
        if (actor != null) {
            event.actorId = actor.getId();
            event.actorDisplayName = bounded(actor.getDisplayName(), 80);
            event.actorEmail = bounded(actor.getEmail(), 255);
            event.actorRole = actor.getRole() == null ? null : actor.getRole().name();
        }
        return event;
    }

    private static String bounded(String value, int length) {
        return value == null ? null : value.substring(0, Math.min(value.length(), length));
    }
    public UUID getId() { return id; }
    public Instant getOccurredAt() { return occurredAt; }
    public UUID getActorId() { return actorId; }
    public String getActorDisplayName() { return actorDisplayName; }
    public String getActorEmail() { return actorEmail; }
    public String getActorRole() { return actorRole; }
    public AuditAction getAction() { return action; }
    public String getTargetType() { return targetType; }
    public String getTargetId() { return targetId; }
    public String getDetails() { return details; }
}
