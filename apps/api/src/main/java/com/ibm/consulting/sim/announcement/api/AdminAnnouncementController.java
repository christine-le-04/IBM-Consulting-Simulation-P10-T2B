package com.ibm.consulting.sim.announcement.api;

import com.ibm.consulting.sim.announcement.application.AdminAnnouncementService;
import com.ibm.consulting.sim.announcement.application.AdminAnnouncementHistory;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import org.springframework.validation.annotation.Validated;
import com.ibm.consulting.sim.identity.domain.UserRole;
import java.util.Set;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/announcements")
@PreAuthorize("hasRole('ADMINISTRATOR')")
@Validated
public class AdminAnnouncementController {
    private final AdminAnnouncementService service;
    private final AdminAnnouncementHistory history;
    public AdminAnnouncementController(AdminAnnouncementService service, AdminAnnouncementHistory history) { this.service = service; this.history = history; }

    @GetMapping
    public ResponseEntity<AdminAnnouncementHistory.Page> list(@RequestParam(defaultValue = "0") @Min(0) @Max(100000) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(history.list(page, size));
    }

    @PostMapping("/{id}/withdraw")
    public ResponseEntity<Void> withdraw(@PathVariable UUID id) {
        history.withdraw(id);
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    public record PublishRequest(@NotBlank @Size(max = 120) String title,
                                 @NotBlank @Size(max = 4000) String message,
                                 @Size(min = 1, max = 4) Set<@NotNull UserRole> targetRoles) {}
    public record Published(UUID id) {}

    @PostMapping
    public ResponseEntity<Published> publish(@Valid @RequestBody PublishRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore())
                .body(new Published(service.publish(request.title(), request.message(), request.targetRoles())));
    }
}
