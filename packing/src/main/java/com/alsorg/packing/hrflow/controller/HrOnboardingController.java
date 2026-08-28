package com.alsorg.packing.hrflow.controller;

import com.alsorg.packing.hrflow.domain.HrOnboardingStatus;
import com.alsorg.packing.hrflow.dto.HrEmployeeDtos;
import com.alsorg.packing.hrflow.dto.HrOnboardingDtos;
import com.alsorg.packing.hrflow.service.HrOnboardingService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/hrflow/onboarding")
public class HrOnboardingController {

    private final HrOnboardingService onboardingService;

    public HrOnboardingController(HrOnboardingService onboardingService) {
        this.onboardingService = onboardingService;
    }

    @PostMapping("/from-candidate/{candidateId}")
    public HrOnboardingDtos.OnboardingDetailResponse createFromCandidate(
            @PathVariable UUID candidateId,
            @Valid @RequestBody(required = false) HrOnboardingDtos.CreateOnboardingRequest request
    ) {
        return onboardingService.createFromCandidate(candidateId, request);
    }

    @GetMapping
    public Page<HrOnboardingDtos.OnboardingSummaryResponse> list(
            @RequestParam(required = false) HrOnboardingStatus status,
            Pageable pageable
    ) {
        return onboardingService.list(status, pageable);
    }

    @GetMapping("/{id}")
    public HrOnboardingDtos.OnboardingDetailResponse get(@PathVariable UUID id) {
        return onboardingService.get(id);
    }

    @PatchMapping("/{id}")
    public HrOnboardingDtos.OnboardingDetailResponse update(
            @PathVariable UUID id,
            @Valid @RequestBody HrOnboardingDtos.UpdateOnboardingRequest request
    ) {
        return onboardingService.update(id, request);
    }

    @PostMapping("/{id}/portal-link")
    public HrOnboardingDtos.PortalLinkResponse createPortalLink(@PathVariable UUID id) {
        return onboardingService.createPortalLink(id);
    }

    @PostMapping("/{id}/confirm-joining")
    public HrEmployeeDtos.EmployeeDetailResponse confirmJoining(
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) HrOnboardingDtos.ConfirmJoiningRequest request
    ) {
        return onboardingService.confirmJoining(id, request);
    }

    @GetMapping(value = "/{id}/form-pdf/{formKey}", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> formPdf(
            @PathVariable UUID id,
            @PathVariable String formKey
    ) {
        HrOnboardingService.FormPdf pdf = onboardingService.formPdf(id, formKey);
        byte[] bytes = pdf.bytes() == null ? new byte[0] : pdf.bytes();
        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(safeFileName(pdf.fileName()), StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.PRAGMA, "no-cache")
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(bytes.length)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .body(bytes);
    }

    @GetMapping("/{id}/joining-report")
    public HrOnboardingDtos.JoiningReportResponse joiningReport(@PathVariable UUID id) {
        return onboardingService.joiningReport(id);
    }

    @GetMapping("/{id}/policy")
    public HrOnboardingDtos.LegalSnapshotResponse getPolicy(@PathVariable UUID id) {
        return onboardingService.getPolicy(id);
    }

    @PutMapping("/{id}/policy")
    public HrOnboardingDtos.LegalSnapshotResponse setPolicy(
            @PathVariable UUID id,
            @Valid @RequestBody HrOnboardingDtos.LegalSnapshotRequest request
    ) {
        return onboardingService.setPolicy(id, request);
    }

    @GetMapping("/{id}/nda")
    public HrOnboardingDtos.LegalSnapshotResponse getNda(@PathVariable UUID id) {
        return onboardingService.getNda(id);
    }

    @PutMapping("/{id}/nda")
    public HrOnboardingDtos.LegalSnapshotResponse setNda(
            @PathVariable UUID id,
            @Valid @RequestBody HrOnboardingDtos.LegalSnapshotRequest request
    ) {
        return onboardingService.setNda(id, request);
    }

    @PostMapping("/{id}/nda/verify")
    public HrOnboardingDtos.AgreementAcceptanceResponse verifyNda(@PathVariable UUID id) {
        return onboardingService.verifyNda(id);
    }

    @GetMapping("/{id}/declaration")
    public HrOnboardingDtos.LegalSnapshotResponse getDeclaration(@PathVariable UUID id) {
        return onboardingService.getDeclaration(id);
    }

    @PutMapping("/{id}/declaration")
    public HrOnboardingDtos.LegalSnapshotResponse setDeclaration(
            @PathVariable UUID id,
            @Valid @RequestBody HrOnboardingDtos.LegalSnapshotRequest request
    ) {
        return onboardingService.setDeclaration(id, request);
    }

    @GetMapping("/{id}/orientation")
    public HrOnboardingDtos.OrientationResponse orientation(@PathVariable UUID id) {
        return onboardingService.orientation(id);
    }

    @PatchMapping("/{id}/orientation")
    public HrOnboardingDtos.OrientationResponse updateOrientation(
            @PathVariable UUID id,
            @Valid @RequestBody HrOnboardingDtos.OrientationUpdateRequest request
    ) {
        return onboardingService.updateOrientation(id, request);
    }

    @GetMapping("/reference/feedback-questions")
    public List<HrOnboardingDtos.FeedbackQuestion> feedbackQuestions() {
        return onboardingService.feedbackQuestions();
    }

    @GetMapping("/{id}/feedback")
    public HrOnboardingDtos.FeedbackSubmissionResponse feedback(@PathVariable UUID id) {
        return onboardingService.feedback(id);
    }

    @GetMapping("/{id}/completion")
    public HrOnboardingDtos.CompletionResponse completion(@PathVariable UUID id) {
        return onboardingService.completion(id);
    }

    @PostMapping("/{id}/complete")
    public HrOnboardingDtos.CompletionResponse complete(@PathVariable UUID id) {
        return onboardingService.completeOnboarding(id);
    }
    private String safeFileName(String value) {
        if (value == null || value.isBlank()) {
            return "hrflow-onboarding-form.pdf";
        }
        String clean = value.replaceAll("[\\r\\n\\t]", "_").trim();
        return clean.isBlank() ? "hrflow-onboarding-form.pdf" : clean;
    }

}
