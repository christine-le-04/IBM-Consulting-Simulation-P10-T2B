package com.ibm.consulting.sim.admin.api;

import com.ibm.consulting.sim.admin.application.AdminAuditService;
import com.ibm.consulting.sim.shared.infrastructure.observability.AuditAction;
import jakarta.validation.constraints.*;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/admin/audit-events")
@PreAuthorize("hasRole('ADMINISTRATOR')")
@Validated
public class AdminAuditController {
    private final AdminAuditService service;
    public AdminAuditController(AdminAuditService service) { this.service = service; }

    @GetMapping
    ResponseEntity<AdminAuditService.AuditPage> list(
            @RequestParam(required = false) @Size(max = 100) String search,
            @RequestParam(required = false) AuditAction action,
            @RequestParam(required = false) @Pattern(regexp = "USER|SCENARIO|LEAD|KNOWLEDGE_DOCUMENT|ACHIEVEMENT|ANNOUNCEMENT") String targetType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") @Min(0) @Max(100000) int page,
            @RequestParam(defaultValue = "25") @Min(1) @Max(100) int size) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(service.list(search, action, targetType, from, to, page, size));
    }
}
