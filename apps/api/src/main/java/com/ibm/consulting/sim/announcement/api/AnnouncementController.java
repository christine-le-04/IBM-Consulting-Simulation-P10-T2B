package com.ibm.consulting.sim.announcement.api;

import com.ibm.consulting.sim.announcement.application.AnnouncementService;
import com.ibm.consulting.sim.identity.domain.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/announcements")
@Validated
public class AnnouncementController {
    private final AnnouncementService service;
    public AnnouncementController(AnnouncementService service) { this.service = service; }

    @GetMapping
    public ResponseEntity<AnnouncementService.Feed> list(@AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") @Min(0) @Max(100000) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size,
            @RequestParam(defaultValue = "false") boolean unreadOnly) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.list(user.getId(), page, size, unreadOnly));
    }

    public record ReadRequest(@NotEmpty @Size(max = 50) List<@NotNull UUID> ids) {}
    public record ReadAllRequest(@NotNull java.time.Instant through) {}

    @PostMapping("/read-all")
    public ResponseEntity<Void> markAllRead(@AuthenticationPrincipal User user, @Valid @RequestBody ReadAllRequest request) {
        service.markAllRead(user.getId(), request.through());
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    @PostMapping("/read")
    public ResponseEntity<Void> markRead(@AuthenticationPrincipal User user, @Valid @RequestBody ReadRequest request) {
        service.markRead(user.getId(), request.ids());
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }
}
