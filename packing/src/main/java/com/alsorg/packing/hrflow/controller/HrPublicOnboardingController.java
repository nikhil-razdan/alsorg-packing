package com.alsorg.packing.hrflow.controller;

import com.alsorg.packing.hrflow.domain.HrCandidate;
import com.alsorg.packing.hrflow.dto.HrOnboardingDtos;
import com.alsorg.packing.hrflow.service.HrCandidateTokenService;
import com.alsorg.packing.hrflow.service.HrOnboardingService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/hrflow/public/onboarding")
public class HrPublicOnboardingController {

    private final HrCandidateTokenService tokenService;
    private final HrOnboardingService onboardingService;

    public HrPublicOnboardingController(
            HrCandidateTokenService tokenService,
            HrOnboardingService onboardingService
    ) {
        this.tokenService = tokenService;
        this.onboardingService = onboardingService;
    }

    @GetMapping("/{token}")
    public HrOnboardingDtos.OnboardingPortalResponse portal(@PathVariable String token) {
        HrCandidate candidate = tokenService.resolveOnboardingToken(token);
        return onboardingService.publicPortal(candidate);
    }

    @GetMapping(value = "/{token}/form-pdf/{formKey}", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> formPdf(
            @PathVariable String token,
            @PathVariable String formKey
    ) {
        HrCandidate candidate = tokenService.resolveOnboardingToken(token);
        HrOnboardingService.FormPdf pdf = onboardingService.publicFormPdf(candidate, formKey);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + pdf.fileName().replace("\"", "") + "\"")
                .body(pdf.bytes());
    }

    @GetMapping("/{token}/joining-report")
    public HrOnboardingDtos.JoiningReportResponse joiningReport(@PathVariable String token) {
        HrCandidate candidate = tokenService.resolveOnboardingToken(token);
        return onboardingService.publicJoiningReport(candidate);
    }

    @PostMapping("/{token}/joining-report/acknowledge")
    public HrOnboardingDtos.JoiningReportResponse acknowledgeJoining(@PathVariable String token) {
        HrCandidate candidate = tokenService.resolveOnboardingToken(token);
        return onboardingService.acknowledgeJoining(candidate);
    }

    @PostMapping("/{token}/policy/acknowledge")
    public HrOnboardingDtos.AgreementAcceptanceResponse acknowledgePolicy(
            @PathVariable String token,
            @RequestBody HrOnboardingDtos.AcceptanceRequest request
    ) {
        HrCandidate candidate = tokenService.resolveOnboardingToken(token);
        return onboardingService.acknowledgePolicy(candidate, request);
    }

    @PostMapping("/{token}/nda/accept")
    public HrOnboardingDtos.AgreementAcceptanceResponse acceptNda(
            @PathVariable String token,
            @RequestBody HrOnboardingDtos.AcceptanceRequest request
    ) {
        HrCandidate candidate = tokenService.resolveOnboardingToken(token);
        return onboardingService.acceptNda(candidate, request);
    }

    @PostMapping("/{token}/declaration/accept")
    public HrOnboardingDtos.AgreementAcceptanceResponse acceptDeclaration(
            @PathVariable String token,
            @RequestBody HrOnboardingDtos.AcceptanceRequest request
    ) {
        HrCandidate candidate = tokenService.resolveOnboardingToken(token);
        return onboardingService.acceptDeclaration(candidate, request);
    }

    @GetMapping("/{token}/orientation")
    public HrOnboardingDtos.OrientationResponse orientation(@PathVariable String token) {
        HrCandidate candidate = tokenService.resolveOnboardingToken(token);
        return onboardingService.publicPortal(candidate).orientation();
    }

    @PostMapping("/{token}/orientation/acknowledge")
    public HrOnboardingDtos.OrientationResponse acknowledgeOrientation(
            @PathVariable String token,
            @RequestBody HrOnboardingDtos.OrientationAcknowledgeRequest request
    ) {
        HrCandidate candidate = tokenService.resolveOnboardingToken(token);
        return onboardingService.acknowledgeOrientation(candidate, request);
    }

    @GetMapping("/{token}/feedback/questions")
    public List<HrOnboardingDtos.FeedbackQuestion> feedbackQuestions(@PathVariable String token) {
        tokenService.resolveOnboardingToken(token);
        return onboardingService.feedbackQuestions();
    }

    @PostMapping("/{token}/feedback")
    public HrOnboardingDtos.FeedbackSubmissionResponse submitFeedback(
            @PathVariable String token,
            @RequestBody HrOnboardingDtos.FeedbackSubmissionRequest request
    ) {
        HrCandidate candidate = tokenService.resolveOnboardingToken(token);
        return onboardingService.submitFeedback(candidate, request);
    }
}
