package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowIndentDtos.CreateIndentRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowIndentDtos.IndentActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowIndentDtos.IndentDetailResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowIndentDtos.SaveIndentLineRequest;

import com.alsorg.packing.domain.matflow.MatFlowIndent;
import com.alsorg.packing.domain.matflow.MatFlowIndentLine;
import com.alsorg.packing.domain.matflow.MatFlowIndentLineStatus;
import com.alsorg.packing.domain.matflow.MatFlowIndentStatus;
import com.alsorg.packing.domain.matflow.MatFlowLine;
import com.alsorg.packing.domain.matflow.MatFlowLineStatus;
import com.alsorg.packing.domain.matflow.MatFlowRequisition;
import com.alsorg.packing.domain.matflow.MatFlowRequisitionLine;
import com.alsorg.packing.domain.matflow.MatFlowRequisitionStatus;

import com.alsorg.packing.repository.matflow.MatFlowIndentLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowIndentRepository;
import com.alsorg.packing.repository.matflow.MatFlowLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowRequisitionLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowRequisitionRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
@Transactional
public class MatFlowIndentService {

    private final MatFlowIndentRepository indentRepo;
    private final MatFlowIndentLineRepository indentLineRepo;

    private final MatFlowRequisitionRepository requisitionRepo;
    private final MatFlowRequisitionLineRepository requisitionLineRepo;
    private final MatFlowLineRepository matFlowLineRepo;

    private final MatFlowAccessService access;
    private final MatFlowIndentNumberService numberService;
    private final MatFlowIndentMapper mapper;
    private final MatFlowAuditService auditService;

    public MatFlowIndentService(
            MatFlowIndentRepository indentRepo,
            MatFlowIndentLineRepository indentLineRepo,
            MatFlowRequisitionRepository requisitionRepo,
            MatFlowRequisitionLineRepository requisitionLineRepo,
            MatFlowLineRepository matFlowLineRepo,
            MatFlowAccessService access,
            MatFlowIndentNumberService numberService,
            MatFlowIndentMapper mapper,
            MatFlowAuditService auditService) {

        this.indentRepo = indentRepo;
        this.indentLineRepo = indentLineRepo;

        this.requisitionRepo = requisitionRepo;
        this.requisitionLineRepo = requisitionLineRepo;
        this.matFlowLineRepo = matFlowLineRepo;

        this.access = access;
        this.numberService = numberService;
        this.mapper = mapper;
        this.auditService = auditService;
    }

    /*
     * =========================================================
     * CREATE DRAFT
     * =========================================================
     */

    public IndentDetailResponse createDraft(
            CreateIndentRequest req) {

        access.requireStore();

        require(
                req,
                "Material Indent request body is required."
        );

        require(
                req.requisitionId(),
                "Requisition ID is required."
        );

        require(
                req.requisitionRowVersion(),
                "Requisition rowVersion is required."
        );

        MatFlowRequisition requisition =
                requisitionRepo.findByIdForUpdate(
                                req.requisitionId()
                        )
                        .orElseThrow(() ->
                                notFound(
                                        "MatFlow requisition not found."
                                )
                        );

        access.assertPlantAccess(
                requisition.plantCode
        );

        assertVersion(
                requisition.rowVersion,
                req.requisitionRowVersion(),
                "Requisition"
        );

        if (requisition.status
                != MatFlowRequisitionStatus.STORE_REVIEW_COMPLETED) {

            throw badRequest(
                    "A Material Indent can be created only after "
                            + "Store Review is completed."
            );
        }

        List<MatFlowRequisitionLine> requisitionLines =
                requisitionLineRepo
                        .findByRequisitionIdAndActiveTrueOrderBySourceLineNoAsc(
                                requisition.id
                        );

        boolean shortageExists =
                requisitionLines.stream()
                        .anyMatch(line ->
                                quantityZero(
                                        line.shortageQty
                                ).signum() > 0
                        );

        if (!shortageExists) {
            throw badRequest(
                    "This requisition has no reviewed shortage quantity."
            );
        }

        String actor =
                access.currentUsername();

        MatFlowIndent indent =
                new MatFlowIndent();

        indent.indentNo =
                numberService.nextIndentNo();

        indent.requisitionId =
                requisition.id;

        indent.releaseId =
                requisition.releaseId;

        indent.requisitionNo =
                requisition.requisitionNo;

        indent.plantCode =
                requisition.plantCode;

        indent.pdNo =
                requisition.pdNo;

        indent.drawingNo =
                requisition.drawingNo;

        indent.projectCode =
                requisition.projectCode;

        indent.clientName =
                requisition.clientName;

        indent.productName =
                requisition.productName;

        indent.productionDepartment =
                requisition.productionDepartment;

        indent.requiredByDate =
                requisition.requiredByDate;

        indent.status =
                MatFlowIndentStatus.DRAFT;

        indent.remarks =
                clean(req.remarks());

        indent.createdBy =
                actor;

        indent.updatedBy =
                actor;

        MatFlowIndent saved =
                indentRepo.save(indent);

        auditService.record(
                requisition.releaseId,
                "MATFLOW_INDENT",
                saved.id,
                "MATERIAL_INDENT_DRAFT_CREATED",
                null,
                "Indent="
                        + saved.indentNo
                        + ", Requisition="
                        + saved.requisitionNo,
                actor
        );

        return mapper.toDetailResponse(
                saved,
                List.of()
        );
    }

    /*
     * =========================================================
     * ADD OR UPDATE INDENT LINE
     * =========================================================
     */

    public IndentDetailResponse saveLine(
            UUID indentId,
            SaveIndentLineRequest req) {

        access.requireStore();

        require(
                req,
                "Material Indent line body is required."
        );

        require(
                req.requisitionLineId(),
                "Requisition Line ID is required."
        );

        require(
                req.indentRowVersion(),
                "Indent rowVersion is required."
        );

        require(
                req.requisitionLineRowVersion(),
                "Requisition line rowVersion is required."
        );

        require(
                req.matFlowLineRowVersion(),
                "MatFlow line rowVersion is required."
        );

        BigDecimal indentQty =
                positiveQuantity(
                        req.indentQty(),
                        "Indent Qty must be greater than zero."
                );

        MatFlowIndent indent =
                getEditableIndentForUpdate(
                        indentId
                );

        assertVersion(
                indent.rowVersion,
                req.indentRowVersion(),
                "Material Indent"
        );

        MatFlowRequisition requisition =
                requisitionRepo.findByIdForUpdate(
                                indent.requisitionId
                        )
                        .orElseThrow(() ->
                                notFound(
                                        "Source requisition not found."
                                )
                        );

        if (requisition.status
                != MatFlowRequisitionStatus.STORE_REVIEW_COMPLETED) {

            throw badRequest(
                    "Indent lines can be added only while the "
                            + "source requisition remains Store-reviewed."
            );
        }

        MatFlowRequisitionLine requisitionLine =
                requisitionLineRepo
                        .findActiveLineForUpdate(
                                requisition.id,
                                req.requisitionLineId()
                        )
                        .orElseThrow(() ->
                                notFound(
                                        "Active requisition line not found."
                                )
                        );

        assertVersion(
                requisitionLine.rowVersion,
                req.requisitionLineRowVersion(),
                "Requisition line"
        );

        BigDecimal shortageQty =
                quantityZero(
                        requisitionLine.shortageQty
                );

        if (shortageQty.signum() <= 0) {
            throw badRequest(
                    "This requisition line has no shortage to indent."
            );
        }

        MatFlowLine matFlowLine =
                matFlowLineRepo
                        .findActiveByIdForUpdate(
                                requisition.releaseId,
                                requisitionLine.matFlowLineId
                        )
                        .orElseThrow(() ->
                                notFound(
                                        "Source MatFlow material line "
                                                + "was not found."
                                )
                        );

        assertVersion(
                matFlowLine.rowVersion,
                req.matFlowLineRowVersion(),
                "MatFlow material line"
        );

        MatFlowIndentLine existingLine =
                indentLineRepo
                        .findByIndentIdAndRequisitionLineIdAndActiveTrue(
                                indent.id,
                                requisitionLine.id
                        )
                        .orElse(null);

        BigDecimal existingQty =
                existingLine == null
                        ? zeroQuantity()
                        : quantityZero(
                                existingLine.indentQty
                        );

        BigDecimal totalAlreadyIndented =
                quantityZero(
                        indentLineRepo
                                .sumActiveIndentQtyByRequisitionLineId(
                                        requisitionLine.id
                                )
                );

        BigDecimal indentedOutsideCurrentLine =
                maxZero(
                        totalAlreadyIndented
                                .subtract(existingQty)
                );

        BigDecimal remainingIndentable =
                maxZero(
                        shortageQty
                                .subtract(
                                        indentedOutsideCurrentLine
                                )
                );

        if (indentQty.compareTo(
                remainingIndentable) > 0) {

            throw badRequest(
                    "Indent Qty cannot exceed the remaining "
                            + "shortage quantity: "
                            + remainingIndentable
                            + " "
                            + requisitionLine.unit
                            + "."
            );
        }

        String actor =
                access.currentUsername();

        MatFlowIndentLine indentLine =
                existingLine == null
                        ? new MatFlowIndentLine()
                        : existingLine;

        if (existingLine == null) {
            indentLine.indentId =
                    indent.id;

            indentLine.requisitionLineId =
                    requisitionLine.id;

            indentLine.matFlowLineId =
                    matFlowLine.id;

            indentLine.sourceBomItemId =
                    requisitionLine.sourceBomItemId;

            indentLine.sourceLineNo =
                    requisitionLine.sourceLineNo;

            indentLine.itemCode =
                    requisitionLine.itemCode;

            indentLine.itemName =
                    requisitionLine.itemName;

            indentLine.itemDescription =
                    requisitionLine.itemDescription;

            indentLine.specification =
                    requisitionLine.specification;

            indentLine.unit =
                    requisitionLine.unit;

            indentLine.createdBy =
                    actor;

            indentLine.active =
                    true;
        }

        indentLine.shortageQtySnapshot =
                shortageQty;

        indentLine.indentQty =
                indentQty;

        indentLine.status =
                MatFlowIndentLineStatus.DRAFT;

        indentLine.remarks =
                clean(req.remarks());

        indentLine.updatedBy =
                actor;

        MatFlowIndentLine savedLine =
                indentLineRepo.save(indentLine);

        reconcileQuantitiesAndStatuses(
                requisitionLine,
                matFlowLine,
                actor
        );

        indent.updatedBy =
                actor;

        indentRepo.save(indent);

        auditService.record(
                indent.releaseId,
                "MATFLOW_INDENT_LINE",
                savedLine.id,
                existingLine == null
                        ? "INDENT_LINE_ADDED"
                        : "INDENT_LINE_UPDATED",
                "Indent Qty=" + existingQty,
                "Indent Qty=" + indentQty,
                actor
        );

        return detail(indent.id);
    }

    /*
     * =========================================================
     * REMOVE DRAFT LINE
     * =========================================================
     */

    public IndentDetailResponse removeLine(
            UUID indentId,
            UUID indentLineId,
            Long indentRowVersion) {

        access.requireStore();

        require(
                indentRowVersion,
                "Indent rowVersion is required."
        );

        MatFlowIndent indent =
                getEditableIndentForUpdate(
                        indentId
                );

        assertVersion(
                indent.rowVersion,
                indentRowVersion,
                "Material Indent"
        );

        MatFlowIndentLine indentLine =
                indentLineRepo
                        .findActiveLineForUpdate(
                                indent.id,
                                indentLineId
                        )
                        .orElseThrow(() ->
                                notFound(
                                        "Active Material Indent line "
                                                + "was not found."
                                )
                        );

        MatFlowRequisitionLine requisitionLine =
                requisitionLineRepo
                        .findActiveLineForUpdate(
                                indent.requisitionId,
                                indentLine.requisitionLineId
                        )
                        .orElseThrow(() ->
                                notFound(
                                        "Source requisition line "
                                                + "was not found."
                                )
                        );

        MatFlowLine matFlowLine =
                matFlowLineRepo
                        .findActiveByIdForUpdate(
                                indent.releaseId,
                                indentLine.matFlowLineId
                        )
                        .orElseThrow(() ->
                                notFound(
                                        "Source MatFlow line "
                                                + "was not found."
                                )
                        );

        String actor =
                access.currentUsername();

        BigDecimal removedQty =
                quantityZero(
                        indentLine.indentQty
                );

        indentLine.active =
                false;

        indentLine.status =
                MatFlowIndentLineStatus.CANCELLED;

        indentLine.updatedBy =
                actor;

        indentLineRepo.saveAndFlush(
                indentLine
        );

        reconcileQuantitiesAndStatuses(
                requisitionLine,
                matFlowLine,
                actor
        );

        indent.updatedBy =
                actor;

        indentRepo.save(indent);

        auditService.record(
                indent.releaseId,
                "MATFLOW_INDENT_LINE",
                indentLine.id,
                "INDENT_LINE_REMOVED",
                "Active=true, Indent Qty="
                        + removedQty,
                "Active=false",
                actor
        );

        return detail(indent.id);
    }

    /*
     * =========================================================
     * SUBMIT TO PURCHASE
     * =========================================================
     */

    public IndentDetailResponse submitToPurchase(
            UUID indentId,
            IndentActionRequest req) {

        access.requireStore();

        require(
                req,
                "Submit Material Indent request body is required."
        );

        require(
                req.indentRowVersion(),
                "Indent rowVersion is required."
        );

        MatFlowIndent indent =
                getEditableIndentForUpdate(
                        indentId
                );

        assertVersion(
                indent.rowVersion,
                req.indentRowVersion(),
                "Material Indent"
        );

        List<MatFlowIndentLine> lines =
                indentLineRepo
                        .findActiveByIndentIdForUpdate(
                                indent.id
                        );

        if (lines.isEmpty()) {
            throw badRequest(
                    "Add at least one shortage line before "
                            + "submitting the Material Indent."
            );
        }

        for (MatFlowIndentLine line : lines) {
            if (quantityZero(
                    line.indentQty
            ).signum() <= 0) {

                throw badRequest(
                        "Every active Material Indent line must "
                                + "have Indent Qty greater than zero."
                );
            }
        }

        String actor =
                access.currentUsername();

        LocalDateTime now =
                LocalDateTime.now();

        for (MatFlowIndentLine line : lines) {
            line.status =
                    MatFlowIndentLineStatus.SUBMITTED_TO_PURCHASE;

            line.updatedBy =
                    actor;

            indentLineRepo.save(line);
        }

        indent.status =
                MatFlowIndentStatus.SUBMITTED_TO_PURCHASE;

        indent.submittedBy =
                actor;

        indent.submittedAt =
                now;

        indent.returnedBy =
                null;

        indent.returnedAt =
                null;

        indent.returnRemarks =
                null;

        if (hasText(req.remarks())) {
            indent.remarks =
                    clean(req.remarks());
        }

        indent.updatedBy =
                actor;

        MatFlowIndent saved =
                indentRepo.save(indent);

        auditService.record(
                indent.releaseId,
                "MATFLOW_INDENT",
                indent.id,
                "MATERIAL_INDENT_SUBMITTED_TO_PURCHASE",
                "Status=DRAFT",
                "Status=SUBMITTED_TO_PURCHASE, Lines="
                        + lines.size(),
                actor
        );

        return mapper.toDetailResponse(
                saved,
                lines
        );
    }

    /*
     * =========================================================
     * CANCEL DRAFT OR RETURNED INDENT
     * =========================================================
     */

    public IndentDetailResponse cancel(
            UUID indentId,
            IndentActionRequest req) {

        access.requireStore();

        require(
                req,
                "Cancel Material Indent request body is required."
        );

        require(
                req.indentRowVersion(),
                "Indent rowVersion is required."
        );

        requireText(
                req.remarks(),
                "Cancellation reason is required."
        );

        MatFlowIndent indent =
                getEditableIndentForUpdate(
                        indentId
                );

        assertVersion(
                indent.rowVersion,
                req.indentRowVersion(),
                "Material Indent"
        );

        List<MatFlowIndentLine> lines =
                indentLineRepo
                        .findActiveByIndentIdForUpdate(
                                indent.id
                        );

        String actor =
                access.currentUsername();

        for (MatFlowIndentLine indentLine : lines) {

            MatFlowRequisitionLine requisitionLine =
                    requisitionLineRepo
                            .findActiveLineForUpdate(
                                    indent.requisitionId,
                                    indentLine.requisitionLineId
                            )
                            .orElseThrow(() ->
                                    notFound(
                                            "Source requisition line "
                                                    + "was not found."
                                    )
                            );

            MatFlowLine matFlowLine =
                    matFlowLineRepo
                            .findActiveByIdForUpdate(
                                    indent.releaseId,
                                    indentLine.matFlowLineId
                            )
                            .orElseThrow(() ->
                                    notFound(
                                            "Source MatFlow line "
                                                    + "was not found."
                                    )
                            );

            indentLine.active =
                    false;

            indentLine.status =
                    MatFlowIndentLineStatus.CANCELLED;

            indentLine.updatedBy =
                    actor;

            indentLineRepo.saveAndFlush(
                    indentLine
            );

            reconcileQuantitiesAndStatuses(
                    requisitionLine,
                    matFlowLine,
                    actor
            );
        }

        indent.status =
                MatFlowIndentStatus.CANCELLED;

        indent.cancelledBy =
                actor;

        indent.cancelledAt =
                LocalDateTime.now();

        indent.remarks =
                clean(req.remarks());

        indent.updatedBy =
                actor;

        MatFlowIndent saved =
                indentRepo.save(indent);

        auditService.record(
                indent.releaseId,
                "MATFLOW_INDENT",
                indent.id,
                "MATERIAL_INDENT_CANCELLED",
                null,
                "Reason=" + clean(req.remarks()),
                actor
        );

        return mapper.toDetailResponse(
                saved,
                List.of()
        );
    }

    /*
     * =========================================================
     * READ
     * =========================================================
     */

    @Transactional(readOnly = true)
    public IndentDetailResponse detail(
            UUID indentId) {

        access.requireMatFlowAccess();

        MatFlowIndent indent =
                indentRepo.findById(indentId)
                        .orElseThrow(() ->
                                notFound(
                                        "Material Indent not found."
                                )
                        );

        access.assertPlantAccess(
                indent.plantCode
        );

        List<MatFlowIndentLine> lines =
                indentLineRepo
                        .findByIndentIdAndActiveTrueOrderBySourceLineNoAsc(
                                indent.id
                        );

        return mapper.toDetailResponse(
                indent,
                lines
        );
    }

    @Transactional(readOnly = true)
    public List<IndentDetailResponse> byRequisition(
            UUID requisitionId) {

        access.requireMatFlowAccess();

        MatFlowRequisition requisition =
                requisitionRepo.findById(requisitionId)
                        .orElseThrow(() ->
                                notFound(
                                        "MatFlow requisition not found."
                                )
                        );

        access.assertPlantAccess(
                requisition.plantCode
        );

        return indentRepo
                .findByRequisitionIdOrderByCreatedAtDesc(
                        requisitionId
                )
                .stream()
                .map(indent ->
                        mapper.toDetailResponse(
                                indent,
                                indentLineRepo
                                        .findByIndentIdAndActiveTrueOrderBySourceLineNoAsc(
                                                indent.id
                                        )
                        )
                )
                .toList();
    }

    /*
     * =========================================================
     * RECONCILIATION
     * =========================================================
     */

    private void reconcileQuantitiesAndStatuses(
            MatFlowRequisitionLine requisitionLine,
            MatFlowLine matFlowLine,
            String actor) {

        BigDecimal requisitionLineIndented =
                quantityZero(
                        indentLineRepo
                                .sumActiveIndentQtyByRequisitionLineId(
                                        requisitionLine.id
                                )
                );

        BigDecimal requisitionShortage =
                quantityZero(
                        requisitionLine.shortageQty
                );

        if (requisitionLineIndented.signum() == 0) {

            if (quantityZero(
                    requisitionLine.blockedQty
            ).signum() > 0) {

                requisitionLine.status =
                        MatFlowLineStatus.PARTIALLY_BLOCKED;

            } else {

                requisitionLine.status =
                        MatFlowLineStatus.SHORTAGE_IDENTIFIED;
            }

        } else if (requisitionLineIndented.compareTo(
                requisitionShortage) < 0) {

            requisitionLine.status =
                    MatFlowLineStatus.PARTIALLY_INDENTED;

        } else {

            requisitionLine.status =
                    MatFlowLineStatus.INDENT_RAISED;
        }

        requisitionLine.updatedBy =
                actor;

        requisitionLineRepo.save(
                requisitionLine
        );

        BigDecimal totalIndented =
                quantityZero(
                        indentLineRepo
                                .sumActiveIndentQtyByMatFlowLineId(
                                        matFlowLine.id
                                )
                );

        matFlowLine.indentedQty =
                totalIndented;

        BigDecimal totalShortage =
                quantityZero(
                        matFlowLine.shortageQty
                );

        if (totalIndented.signum() == 0) {

            if (quantityZero(
                    matFlowLine.blockedQty
            ).signum() > 0
                    && totalShortage.signum() > 0) {

                matFlowLine.status =
                        MatFlowLineStatus.PARTIALLY_BLOCKED;

            } else if (totalShortage.signum() > 0) {

                matFlowLine.status =
                        MatFlowLineStatus.SHORTAGE_IDENTIFIED;
            }

        } else if (totalIndented.compareTo(
                totalShortage) < 0) {

            matFlowLine.status =
                    MatFlowLineStatus.PARTIALLY_INDENTED;

        } else {

            matFlowLine.status =
                    MatFlowLineStatus.INDENT_RAISED;
        }

        matFlowLine.updatedBy =
                actor;

        matFlowLineRepo.save(
                matFlowLine
        );
    }

    /*
     * =========================================================
     * INTERNAL HELPERS
     * =========================================================
     */

    private MatFlowIndent getEditableIndentForUpdate(
            UUID indentId) {

        if (indentId == null) {
            throw badRequest(
                    "Material Indent ID is required."
            );
        }

        MatFlowIndent indent =
                indentRepo.findByIdForUpdate(indentId)
                        .orElseThrow(() ->
                                notFound(
                                        "Material Indent not found."
                                )
                        );

        access.assertPlantAccess(
                indent.plantCode
        );

        boolean editable =
                indent.status == MatFlowIndentStatus.DRAFT
                        || indent.status == MatFlowIndentStatus.RETURNED;

        if (!editable) {
            throw badRequest(
                    "Only a Draft or Returned Material Indent "
                            + "can be modified."
            );
        }

        if (indent.status == MatFlowIndentStatus.RETURNED) {
            indent.status =
                    MatFlowIndentStatus.DRAFT;

            indent.returnedBy =
                    null;

            indent.returnedAt =
                    null;

            indent.returnRemarks =
                    null;

            indent.updatedBy =
                    access.currentUsername();

            indentRepo.save(indent);
        }

        return indent;
    }

    private void assertVersion(
            Long actual,
            Long supplied,
            String label) {

        if (!Objects.equals(actual, supplied)) {
            throw conflict(
                    label
                            + " was updated by another user. "
                            + "Reload before continuing."
            );
        }
    }

    private BigDecimal positiveQuantity(
            BigDecimal value,
            String message) {

        require(value, message);

        if (value.compareTo(BigDecimal.ZERO) <= 0) {
            throw badRequest(message);
        }

        BigDecimal stripped =
                value.stripTrailingZeros();

        if (stripped.scale() > 3) {
            throw badRequest(
                    "Quantity can have a maximum of "
                            + "3 decimal places."
            );
        }

        return value.setScale(
                3,
                RoundingMode.UNNECESSARY
        );
    }

    private BigDecimal quantityZero(
            BigDecimal value) {

        return value == null
                ? zeroQuantity()
                : value;
    }

    private BigDecimal zeroQuantity() {
        return BigDecimal.ZERO.setScale(3);
    }

    private BigDecimal maxZero(
            BigDecimal value) {

        if (value == null || value.signum() < 0) {
            return zeroQuantity();
        }

        return value;
    }

    private void require(
            Object value,
            String message) {

        if (value == null) {
            throw badRequest(message);
        }
    }

    private void requireText(
            String value,
            String message) {

        if (!hasText(value)) {
            throw badRequest(message);
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

    private ResponseStatusException badRequest(
            String message) {

        return new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                message
        );
    }

    private ResponseStatusException notFound(
            String message) {

        return new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                message
        );
    }

    private ResponseStatusException conflict(
            String message) {

        return new ResponseStatusException(
                HttpStatus.CONFLICT,
                message
        );
    }
}