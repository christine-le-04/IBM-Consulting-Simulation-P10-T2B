package com.ibm.consulting.sim.admin.application;

import com.ibm.consulting.sim.shared.infrastructure.observability.*;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class AdminAuditService {
    private final AdminAuditEventRepository repository;
    private final AdminAuditRetention retention;
    public AdminAuditService(AdminAuditEventRepository repository, AdminAuditRetention retention) {
        this.repository = repository;
        this.retention = retention;
    }

    @Transactional(readOnly = true)
    public AuditPage list(String search, AuditAction action, String targetType, LocalDate from, LocalDate to, int page, int size) {
        if (from != null && to != null && from.isAfter(to)) throw new IllegalArgumentException("Start date must be on or before end date.");
        Instant cutoff = retention.cutoff();
        Specification<AdminAuditEvent> specification = (root, query, builder) -> {
            List<Predicate> filters = new ArrayList<>();
            filters.add(builder.greaterThanOrEqualTo(root.get("occurredAt"), cutoff));
            if (action != null) filters.add(builder.equal(root.get("action"), action));
            if (targetType != null && !targetType.isBlank()) filters.add(builder.equal(root.get("targetType"), targetType));
            if (from != null) filters.add(builder.greaterThanOrEqualTo(root.get("occurredAt"), from.atStartOfDay(ZoneOffset.UTC).toInstant()));
            if (to != null) filters.add(builder.lessThan(root.get("occurredAt"), to.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant()));
            if (search != null && !search.isBlank()) {
                String escaped = search.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
                String pattern = "%" + escaped + "%";
                filters.add(builder.or(
                        builder.like(builder.lower(root.get("actorDisplayName")), pattern, '\\'),
                        builder.like(builder.lower(root.get("actorEmail")), pattern, '\\'),
                        builder.like(builder.lower(root.get("targetDisplayName")), pattern, '\\'),
                        builder.like(builder.lower(root.get("targetEmail")), pattern, '\\'),
                        builder.like(builder.lower(root.get("targetId")), pattern, '\\'),
                        builder.like(builder.lower(root.get("details")), pattern, '\\')));
            }
            return builder.and(filters.toArray(Predicate[]::new));
        };
        var results = repository.findAll(specification, PageRequest.of(page, size,
                Sort.by(Sort.Direction.DESC, "occurredAt", "id")));
        return new AuditPage(results.getContent().stream().map(AuditItem::from).toList(), results.getTotalElements(),
                page, size, results.getTotalPages(), List.of(AuditAction.values()), retention.days());
    }

    public record AuditPage(List<AuditItem> items, long totalElements, int page, int size, int totalPages, List<AuditAction> actions, int retentionDays) {}
    public record AuditItem(UUID id, Instant occurredAt, UUID actorId, String actorDisplayName, String actorEmail,
                            String actorRole, AuditAction action, String targetType, String targetId,
                            String targetDisplayName, String targetEmail, String targetRole, String details) {
        static AuditItem from(AdminAuditEvent event) {
            return new AuditItem(event.getId(), event.getOccurredAt(), event.getActorId(), event.getActorDisplayName(),
                    event.getActorEmail(), event.getActorRole(), event.getAction(), event.getTargetType(), event.getTargetId(),
                    event.getTargetDisplayName(), event.getTargetEmail(), event.getTargetRole(), event.getDetails());
        }
    }
}
