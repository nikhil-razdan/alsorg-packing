package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowRequisitionDtos.CreateRequisitionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowRequisitionDtos.RequisitionActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowRequisitionDtos.RequisitionDetailResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowRequisitionDtos.SaveRequisitionLineRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowRequisitionDtos.UpdateRequisitionRequest;
import com.alsorg.packing.domain.matflow.MatFlowLine;
import com.alsorg.packing.domain.matflow.MatFlowLineStatus;
import com.alsorg.packing.domain.matflow.MatFlowRelease;
import com.alsorg.packing.domain.matflow.MatFlowReleaseStatus;
import com.alsorg.packing.domain.matflow.MatFlowRequisition;
import com.alsorg.packing.domain.matflow.MatFlowRequisitionLine;
import com.alsorg.packing.domain.matflow.MatFlowRequisitionStatus;
import com.alsorg.packing.controller.dto.matflow.MatFlowRequisitionDtos.UpdateRequisitionRequest;
import com.alsorg.packing.repository.matflow.MatFlowLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowReleaseRepository;
import com.alsorg.packing.repository.matflow.MatFlowRequisitionLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowRequisitionRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
@Transactional
public class MatFlowRequisitionService {

    private final MatFlowReleaseRepository releaseRepo;
    private final MatFlowLineRepository matFlowLineRepo;

    private final MatFlowRequisitionRepository requisitionRepo;
    private final MatFlowRequisitionLineRepository requisitionLineRepo;

    private final MatFlowAccessService access;
    private final MatFlowNumberService numberService;
    private final MatFlowAuditService auditService;
    private final MatFlowRequisitionMapper mapper;

    public MatFlowRequisitionService(
            MatFlowReleaseRepository releaseRepo,
            MatFlowLineRepository matFlowLineRepo,
            MatFlowRequisitionRepository requisitionRepo,
            MatFlowRequisitionLineRepository requisitionLineRepo,
            MatFlowAccessService access,
            MatFlowNumberService numberService,
            MatFlowAuditService auditService,
            MatFlowRequisitionMapper mapper) {

        this.releaseRepo = releaseRepo;
        this.matFlowLineRepo = matFlowLineRepo;

        this.requisitionRepo = requisitionRepo;
        this.requisitionLineRepo = requisitionLineRepo;

        this.access = access;
        this.numberService = numberService;
        this.auditService = auditService;
        this.mapper = mapper;
    }

    /*
     * =========================================================
     * CREATE REQUISITION DRAFT
     * =========================================================
     */

    public RequisitionDetailResponse createDraft(
            CreateRequisitionRequest req) {

        access.requireProduction();

        require(
                req,
                "Requisition request body is required.");

        require(
                req.releaseId(),
                "MatFlow release ID is required.");

        require(
                req.releaseRowVersion(),
                "MatFlow release rowVersion is required.");

        require(
                req.requiredByDate(),
                "Required By Date is required.");

        requireText(
                req.productionDepartment(),
                "Production Department is required.");

        requireText(
                req.requestedFor(),
                "Requested For / Responsible Person is required.");

        /*
         * Today is allowed.
         * A past date is not valid for a new requirement.
         */
        if (req.requiredByDate()
                .isBefore(LocalDate.now())) {

            throw badRequest(
                    "Required By Date cannot be in the past.");
        }

        MatFlowRelease release = releaseRepo
                .findByIdForUpdate(
                        req.releaseId())
                .orElseThrow(() -> notFound(
                        "MatFlow release not found."));

        access.assertPlantAccess(
                release.plantCode);

        assertVersion(
                release.rowVersion,
                req.releaseRowVersion(),
                "MatFlow release");

        if (release.status != MatFlowReleaseStatus.ACTIVE) {

            throw badRequest(
                    "A requisition can be created only "
                            + "against an ACTIVE MatFlow release.");
        }

        String actor = access.currentUsername();

        MatFlowRequisition requisition = new MatFlowRequisition();

        requisition.requisitionNo = numberService.nextRequisitionNo();

        requisition.releaseId = release.id;

        /*
         * Permanent release snapshot.
         */
        requisition.plantCode = cleanUpper(release.plantCode);

        requisition.pdNo = clean(release.pdNo);

        requisition.drawingNo = clean(release.drawingNo);

        requisition.projectCode = clean(release.projectCode);

        requisition.clientName = clean(release.clientName);

        requisition.productName = clean(release.productName);

        requisition.productCode = clean(release.productCode);

        requisition.requiredByDate = req.requiredByDate();

        requisition.productionDepartment = cleanUpper(
                req.productionDepartment());

        requisition.requestedFor = clean(req.requestedFor());

        requisition.status = MatFlowRequisitionStatus.DRAFT;

        requisition.remarks = clean(req.remarks());

        requisition.createdBy = actor;

        requisition.updatedBy = actor;

        MatFlowRequisition saved = requisitionRepo.save(
                requisition);

        auditService.record(
                release.id,
                "MATFLOW_REQUISITION",
                saved.id,
                "REQUISITION_DRAFT_CREATED",
                null,
                "Requisition="
                        + saved.requisitionNo
                        + ", Required By="
                        + saved.requiredByDate
                        + ", Department="
                        + saved.productionDepartment,
                actor);

        return mapper.toDetailResponse(
                saved,
                List.of());
    }

    /*
     * =========================================================
     * ADD OR UPDATE DRAFT LINE
     * =========================================================
     */

    public RequisitionDetailResponse saveLine(
            UUID requisitionId,
            SaveRequisitionLineRequest req) {

        access.requireProduction();

        require(
                req,
                "Requisition line request body is required.");

        require(
                req.matFlowLineId(),
                "MatFlow line ID is required.");

        require(
                req.matFlowLineRowVersion(),
                "MatFlow line rowVersion is required.");

        BigDecimal requestedQty = positiveQuantity(
                req.requestedQty(),
                "Requested Qty must be greater than zero.");

        MatFlowRequisition requisition = getEditableForUpdate(
                requisitionId);

        MatFlowLine sourceLine = matFlowLineRepo
                .findActiveByIdForUpdate(
                        requisition.releaseId,
                        req.matFlowLineId())
                .orElseThrow(() -> notFound(
                        "Active MatFlow material line not found."));

        assertVersion(
                sourceLine.rowVersion,
                req.matFlowLineRowVersion(),
                "MatFlow material line");

        if (!sourceLine.storeIssueRequired) {
            throw badRequest(
                    "This BOM material line does not require "
                            + "Store issue and cannot be requisitioned.");
        }

        require(
                req.requisitionRowVersion(),
                "Requisition rowVersion is required.");

        assertVersion(
                requisition.rowVersion,
                req.requisitionRowVersion(),
                "Requisition");

        /*
         * requiredQty represents total demand from the released BOM.
         * requisitionedQty represents quantity already committed to
         * active requisitions.
         */
        BigDecimal releasedRequired = quantityZero(
                sourceLine.requiredQty);

        BigDecimal currentlyRequisitioned = quantityZero(
                sourceLine.requisitionedQty);

        MatFlowRequisitionLine existingLine = requisitionLineRepo
                .findByRequisitionIdAndMatFlowLineIdAndActiveTrue(
                        requisition.id,
                        sourceLine.id)
                .orElse(null);

        BigDecimal existingRequested = existingLine == null
                ? BigDecimal.ZERO.setScale(3)
                : quantityZero(
                        existingLine.requestedQty);

        /*
         * Remove the existing value from the aggregate before
         * validating the replacement value.
         */
        BigDecimal requisitionedOutsideThisLine = currentlyRequisitioned
                .subtract(existingRequested);

        if (requisitionedOutsideThisLine
                .signum() < 0) {

            requisitionedOutsideThisLine = BigDecimal.ZERO.setScale(3);
        }

        BigDecimal availableToRequest = releasedRequired
                .subtract(
                        requisitionedOutsideThisLine);

        if (availableToRequest.signum() < 0) {
            availableToRequest = BigDecimal.ZERO.setScale(3);
        }

        if (requestedQty.compareTo(
                availableToRequest) > 0) {

            throw badRequest(
                    "Requested Qty cannot exceed the remaining "
                            + "released requirement: "
                            + availableToRequest
                            + " "
                            + sourceLine.unit
                            + ".");
        }

        String actor = access.currentUsername();

        MatFlowRequisitionLine requisitionLine;

        if (existingLine == null) {

            requisitionLine = new MatFlowRequisitionLine();

            requisitionLine.requisitionId = requisition.id;

            requisitionLine.matFlowLineId = sourceLine.id;

            requisitionLine.sourceBomItemId = sourceLine.sourceBomItemId;

            requisitionLine.sourceLineNo = sourceLine.sourceLineNo;

            requisitionLine.itemCode = sourceLine.itemCode;

            requisitionLine.itemName = sourceLine.itemName;

            requisitionLine.itemDescription = sourceLine.itemDescription;

            requisitionLine.specification = sourceLine.specification;

            requisitionLine.unit = sourceLine.unit;

            requisitionLine.createdBy = actor;

            requisitionLine.active = true;

        } else {
            requisitionLine = existingLine;
        }

        BigDecimal oldRequestedQty = quantityZero(
                requisitionLine.requestedQty);

        requisitionLine.requestedQty = requestedQty;

        requisitionLine.productionRemarks = clean(req.productionRemarks());

        requisitionLine.status = MatFlowLineStatus.REQUISITIONED;

        requisitionLine.updatedBy = actor;

        requisitionLineRepo.save(
                requisitionLine);

        /*
         * Recalculate from the permanent aggregate:
         *
         * requisitioned outside this line + new requested value.
         */
        sourceLine.requisitionedQty = requisitionedOutsideThisLine
                .add(requestedQty);

        sourceLine.status = MatFlowLineStatus.REQUISITIONED;

        sourceLine.updatedBy = actor;

        matFlowLineRepo.save(
                sourceLine);

        requisition.updatedBy = actor;

        requisitionRepo.save(
                requisition);

        auditService.record(
                requisition.releaseId,
                "MATFLOW_REQUISITION_LINE",
                requisitionLine.id,
                existingLine == null
                        ? "REQUISITION_LINE_ADDED"
                        : "REQUISITION_LINE_UPDATED",
                "Requested Qty="
                        + oldRequestedQty,
                "Requested Qty="
                        + requestedQty
                        + ", MatFlow Line="
                        + sourceLine.id,
                actor);

        return detail(
                requisition.id);

    }

    /*
     * =========================================================
     * REMOVE DRAFT LINE
     * =========================================================
     */

    public RequisitionDetailResponse removeLine(
            UUID requisitionId,
            UUID requisitionLineId,
            Long requisitionRowVersion) {

        access.requireProduction();

        require(
                requisitionRowVersion,
                "Requisition rowVersion is required.");

        MatFlowRequisition requisition = getEditableForUpdate(
                requisitionId);

        assertVersion(
                requisition.rowVersion,
                requisitionRowVersion,
                "Requisition");

        MatFlowRequisitionLine line = requisitionLineRepo
                .findActiveLineForUpdate(
                        requisitionId,
                        requisitionLineId)
                .orElseThrow(() -> notFound(
                        "Active requisition line not found."));

        MatFlowLine sourceLine = matFlowLineRepo
                .findActiveByIdForUpdate(
                        requisition.releaseId,
                        line.matFlowLineId)
                .orElseThrow(() -> notFound(
                        "Source MatFlow line not found."));

        String actor = access.currentUsername();

        BigDecimal removedQty = quantityZero(
                line.requestedQty);

        line.active = false;

        line.updatedBy = actor;

        requisitionLineRepo.save(
                line);

        sourceLine.requisitionedQty = maxZero(
                quantityZero(
                        sourceLine.requisitionedQty)
                        .subtract(removedQty));

        if (sourceLine.requisitionedQty.signum() == 0) {
            sourceLine.status = MatFlowLineStatus.NOT_REQUISITIONED;
        }

        sourceLine.updatedBy = actor;

        matFlowLineRepo.save(
                sourceLine);

        requisition.updatedBy = actor;

        requisitionRepo.save(
                requisition);

        auditService.record(
                requisition.releaseId,
                "MATFLOW_REQUISITION_LINE",
                line.id,
                "REQUISITION_LINE_REMOVED",
                "Active=true, Requested Qty="
                        + removedQty,
                "Active=false",
                actor);

        return detail(
                requisition.id);
    }

    /*
     * =========================================================
     * SUBMIT REQUISITION TO STORE
     * =========================================================
     */

    public RequisitionDetailResponse submitToStore(
            UUID requisitionId,
            RequisitionActionRequest req) {

        access.requireProduction();

        require(
                req,
                "Submit requisition request body is required.");

        require(
                req.requisitionRowVersion(),
                "Requisition rowVersion is required.");

        MatFlowRequisition requisition = getEditableForUpdate(
                requisitionId);

        assertVersion(
                requisition.rowVersion,
                req.requisitionRowVersion(),
                "Requisition");

        List<MatFlowRequisitionLine> lines = requisitionLineRepo
                .findActiveForUpdate(
                        requisition.id);

        if (lines.isEmpty()) {
            throw badRequest(
                    "Add at least one material line "
                            + "before submitting the requisition.");
        }

        for (MatFlowRequisitionLine line : lines) {

            if (line.requestedQty == null
                    || line.requestedQty.compareTo(
                            BigDecimal.ZERO) <= 0) {

                throw badRequest(
                        "Every requisition line must have "
                                + "Requested Qty greater than zero.");
            }

            if (line.unit == null) {
                throw badRequest(
                        "Every requisition line must have "
                                + "a Material Unit.");
            }
        }

        String actor = access.currentUsername();

        LocalDateTime now = LocalDateTime.now();

        requisition.status = MatFlowRequisitionStatus.SUBMITTED_TO_STORE;

        requisition.submittedBy = actor;

        requisition.submittedAt = now;

        requisition.returnedBy = null;

        requisition.returnedAt = null;

        requisition.returnRemarks = null;

        if (hasText(req.remarks())) {
            requisition.remarks = clean(req.remarks());
        }

        requisition.updatedBy = actor;

        MatFlowRequisition saved = requisitionRepo.save(
                requisition);

        for (MatFlowRequisitionLine line : lines) {

            line.status = MatFlowLineStatus.STORE_REVIEW_PENDING;

            line.updatedBy = actor;

            requisitionLineRepo.save(
                    line);

            MatFlowLine sourceLine = matFlowLineRepo
                    .findActiveByIdForUpdate(
                            requisition.releaseId,
                            line.matFlowLineId)
                    .orElseThrow(() -> notFound(
                            "Source MatFlow line not found."));

            sourceLine.status = MatFlowLineStatus.STORE_REVIEW_PENDING;

            sourceLine.updatedBy = actor;

            matFlowLineRepo.save(
                    sourceLine);
        }

        auditService.record(
                requisition.releaseId,
                "MATFLOW_REQUISITION",
                saved.id,
                "REQUISITION_SUBMITTED_TO_STORE",
                "Status=DRAFT",
                "Status=SUBMITTED_TO_STORE, Lines="
                        + lines.size(),
                actor);

        return mapper.toDetailResponse(
                saved,
                lines);
    }

    /*
     * =========================================================
     * CANCEL DRAFT OR RETURNED REQUISITION
     * =========================================================
     */

    public RequisitionDetailResponse cancel(
            UUID requisitionId,
            RequisitionActionRequest req) {

        access.requireProduction();

        require(
                req,
                "Cancel requisition request body is required.");

        require(
                req.requisitionRowVersion(),
                "Requisition rowVersion is required.");

        requireText(
                req.remarks(),
                "Cancellation reason is required.");

        MatFlowRequisition requisition = requisitionRepo
                .findByIdForUpdate(
                        requisitionId)
                .orElseThrow(() -> notFound(
                        "MatFlow requisition not found."));

        access.assertPlantAccess(
                requisition.plantCode);

        assertVersion(
                requisition.rowVersion,
                req.requisitionRowVersion(),
                "Requisition");

        boolean cancellable = requisition.status == MatFlowRequisitionStatus.DRAFT
                || requisition.status == MatFlowRequisitionStatus.RETURNED;

        if (!cancellable) {
            throw badRequest(
                    "Only a Draft or Returned requisition "
                            + "can be cancelled by Production.");
        }

        List<MatFlowRequisitionLine> lines = requisitionLineRepo
                .findActiveForUpdate(
                        requisition.id);

        String actor = access.currentUsername();

        for (MatFlowRequisitionLine line : lines) {

            MatFlowLine sourceLine = matFlowLineRepo
                    .findActiveByIdForUpdate(
                            requisition.releaseId,
                            line.matFlowLineId)
                    .orElseThrow(() -> notFound(
                            "Source MatFlow line not found."));

            sourceLine.requisitionedQty = maxZero(
                    quantityZero(
                            sourceLine.requisitionedQty)
                            .subtract(
                                    quantityZero(
                                            line.requestedQty)));

            if (sourceLine.requisitionedQty.signum() == 0
                    && sourceLine.blockedQty.signum() == 0
                    && sourceLine.orderedQty.signum() == 0) {

                sourceLine.status = MatFlowLineStatus.NOT_REQUISITIONED;
            }

            sourceLine.updatedBy = actor;

            matFlowLineRepo.save(
                    sourceLine);

            line.status = MatFlowLineStatus.CANCELLED;

            line.active = false;

            line.updatedBy = actor;

            requisitionLineRepo.save(
                    line);
        }

        requisition.status = MatFlowRequisitionStatus.CANCELLED;

        requisition.cancelledBy = actor;

        requisition.cancelledAt = LocalDateTime.now();

        requisition.remarks = clean(req.remarks());

        requisition.updatedBy = actor;

        MatFlowRequisition saved = requisitionRepo.save(
                requisition);

        auditService.record(
                requisition.releaseId,
                "MATFLOW_REQUISITION",
                requisition.id,
                "REQUISITION_CANCELLED",
                null,
                "Reason="
                        + clean(req.remarks()),
                actor);

        return mapper.toDetailResponse(
                saved,
                List.of());
    }

    /*
     * =========================================================
     * READ
     * =========================================================
     */

    @Transactional(readOnly = true)
    public RequisitionDetailResponse detail(
            UUID requisitionId) {

        access.requireMatFlowAccess();

        MatFlowRequisition requisition = requisitionRepo
                .findById(requisitionId)
                .orElseThrow(() -> notFound(
                        "MatFlow requisition not found."));

        access.assertPlantAccess(
                requisition.plantCode);

        List<MatFlowRequisitionLine> lines = requisitionLineRepo
                .findByRequisitionIdAndActiveTrueOrderBySourceLineNoAsc(
                        requisition.id);

        return mapper.toDetailResponse(
                requisition,
                lines);
    }

    @Transactional(readOnly = true)
    public List<RequisitionDetailResponse> byRelease(
            UUID releaseId) {

        access.requireMatFlowAccess();

        MatFlowRelease release = releaseRepo
                .findById(releaseId)
                .orElseThrow(() -> notFound(
                        "MatFlow release not found."));

        access.assertPlantAccess(
                release.plantCode);

        return requisitionRepo
                .findByReleaseIdOrderByCreatedAtDesc(
                        releaseId)
                .stream()
                .map(requisition -> {

                    List<MatFlowRequisitionLine> lines = requisitionLineRepo
                            .findByRequisitionIdAndActiveTrueOrderBySourceLineNoAsc(
                                    requisition.id);

                    return mapper.toDetailResponse(
                            requisition,
                            lines);
                })
                .toList();
    }

    /*
     * =========================================================
     * INTERNAL HELPERS
     * =========================================================
     */

    private MatFlowRequisition getEditableForUpdate(
            UUID requisitionId) {

        if (requisitionId == null) {
            throw badRequest(
                    "Requisition ID is required.");
        }

        MatFlowRequisition requisition = requisitionRepo.findByIdForUpdate(
                requisitionId)
                .orElseThrow(() -> notFound(
                        "MatFlow requisition not found."));

        access.assertPlantAccess(
                requisition.plantCode);

        boolean editable = requisition.status == MatFlowRequisitionStatus.DRAFT
                || requisition.status == MatFlowRequisitionStatus.RETURNED;

        if (!editable) {
            throw badRequest(
                    "Only a Draft or Returned requisition "
                            + "can be modified.");
        }

        if (requisition.status == MatFlowRequisitionStatus.RETURNED) {

            requisition.status = MatFlowRequisitionStatus.DRAFT;

            requisition.returnedBy = null;

            requisition.returnedAt = null;

            requisition.returnRemarks = null;

            requisition.updatedBy = access.currentUsername();

            requisitionRepo.save(
                    requisition);
        }

        return requisition;
    }

    private void assertVersion(
            Long actual,
            Long supplied,
            String label) {

        if (!Objects.equals(
                actual,
                supplied)) {

            throw conflict(
                    label
                            + " was updated by another user. "
                            + "Reload before continuing.");
        }
    }

    private BigDecimal positiveQuantity(
            BigDecimal value,
            String message) {

        require(
                value,
                message);

        if (value.compareTo(
                BigDecimal.ZERO) <= 0) {

            throw badRequest(
                    message);
        }

        BigDecimal stripped = value.stripTrailingZeros();

        if (stripped.scale() > 3) {
            throw badRequest(
                    "Quantity can have a maximum "
                            + "of 3 decimal places.");
        }

        return value.setScale(
                3,
                RoundingMode.UNNECESSARY);
    }

    private BigDecimal quantityZero(
            BigDecimal value) {

        return value == null
                ? BigDecimal.ZERO.setScale(3)
                : value;
    }

    private BigDecimal maxZero(
            BigDecimal value) {

        if (value == null
                || value.signum() < 0) {

            return BigDecimal.ZERO.setScale(3);
        }

        return value;
    }

    private void require(
            Object value,
            String message) {

        if (value == null) {
            throw badRequest(
                    message);
        }
    }

    private void requireText(
            String value,
            String message) {

        if (!hasText(value)) {
            throw badRequest(
                    message);
        }
    }

    private boolean hasText(
            String value) {

        return value != null
                && !value.trim().isEmpty();
    }

    private String clean(
            String value) {

        return value == null
                ? null
                : value.trim();
    }

    private String cleanUpper(
            String value) {

        return value == null
                ? null
                : value.trim().toUpperCase();
    }

    private ResponseStatusException badRequest(
            String message) {

        return new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                message);
    }

    private ResponseStatusException notFound(
            String message) {

        return new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                message);
    }

    private ResponseStatusException conflict(
            String message) {

        return new ResponseStatusException(
                HttpStatus.CONFLICT,
                message);
    }

    public RequisitionDetailResponse updateHeader(
            UUID requisitionId,
            UpdateRequisitionRequest req) {

        access.requireProduction();

        require(
                req,
                "Requisition update body is required.");

        require(
                req.requisitionRowVersion(),
                "Requisition rowVersion is required.");

        require(
                req.requiredByDate(),
                "Required By Date is required.");

        requireText(
                req.productionDepartment(),
                "Production Department is required.");

        requireText(
                req.requestedFor(),
                "Requested For is required.");

        if (req.requiredByDate()
                .isBefore(LocalDate.now())) {

            throw badRequest(
                    "Required By Date cannot be in the past.");
        }

        MatFlowRequisition requisition = getEditableForUpdate(
                requisitionId);

        assertVersion(
                requisition.rowVersion,
                req.requisitionRowVersion(),
                "Requisition");

        String actor = access.currentUsername();

        requisition.requiredByDate = req.requiredByDate();

        requisition.productionDepartment = cleanUpper(
                req.productionDepartment());

        requisition.requestedFor = clean(req.requestedFor());

        requisition.remarks = clean(req.remarks());

        requisition.updatedBy = actor;

        MatFlowRequisition saved = requisitionRepo.save(
                requisition);

        auditService.record(
                requisition.releaseId,
                "MATFLOW_REQUISITION",
                requisition.id,
                "REQUISITION_HEADER_UPDATED",
                null,
                "Required By="
                        + saved.requiredByDate
                        + ", Department="
                        + saved.productionDepartment
                        + ", Requested For="
                        + saved.requestedFor,
                actor);

        return detail(
                saved.id);
    }
}