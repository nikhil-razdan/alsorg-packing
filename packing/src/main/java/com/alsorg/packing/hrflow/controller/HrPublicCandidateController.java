package com.alsorg.packing.hrflow.controller;

import com.alsorg.packing.hrflow.dto.HrCandidateDtos;
import com.alsorg.packing.hrflow.service.HrCandidateService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/hrflow/public/applications")
public class HrPublicCandidateController {

    private final HrCandidateService service;

    public HrPublicCandidateController(HrCandidateService service) {
        this.service = service;
    }

    @GetMapping("/{token}")
    public HrCandidateDtos.PublicCandidateApplicationResponse get(@PathVariable String token) {
        return service.getPublicApplication(token);
    }

    @PutMapping("/{token}")
    public HrCandidateDtos.PublicCandidateApplicationResponse saveDraft(
            @PathVariable String token,
            @Valid @RequestBody HrCandidateDtos.CandidateApplicationRequest request) {
        return service.savePublicDraft(token, request);
    }

    @PostMapping("/{token}/submit")
    public HrCandidateDtos.PublicCandidateApplicationResponse submit(
            @PathVariable String token,
            @Valid @RequestBody HrCandidateDtos.CandidateApplicationRequest request) {
        return service.submitPublicApplication(token, request);
    }
}
