package com.ibm.consulting.sim.outreach.api;

import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.outreach.application.ContactService;
import com.ibm.consulting.sim.outreach.application.ContactsResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/** Choose contact: who the learner emails in outreach. */
@RestController
@RequestMapping("/api/v1/engagements/{engagementId}/contacts")
public class ContactController {

    private final ContactService contactService;

    public ContactController(ContactService contactService) {
        this.contactService = contactService;
    }

    record ChooseContactRequest(@NotNull UUID personaId) {}

    @GetMapping
    ContactsResponse list(@PathVariable UUID engagementId, @AuthenticationPrincipal User user) {
        return contactService.list(engagementId, user.getId());
    }

    @PostMapping("/choice")
    ContactsResponse choose(@PathVariable UUID engagementId,
                            @Valid @RequestBody ChooseContactRequest req,
                            @AuthenticationPrincipal User user) {
        return contactService.choose(engagementId, user.getId(), req.personaId());
    }
}
