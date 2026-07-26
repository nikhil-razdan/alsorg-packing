package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowStoreReviewDtos.ReturnToProductionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowStoreReviewDtos.StoreQueueResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowStoreReviewDtos.StoreReviewLineRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowStoreReviewDtos.StoreReviewLineResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowStoreReviewDtos.StoreReviewRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowStoreReviewDtos.StoreReviewResponse;

import com.alsorg.packing.domain.matflow.MatFlowLine;
import com.alsorg.packing.domain.matflow.MatFlowLineStatus;
import com.alsorg.packing.domain.matflow.MatFlowRequisition;
import com.alsorg.packing.domain.matflow.MatFlowRequisitionLine;
import com.alsorg.packing.domain.matflow.MatFlowRequisitionStatus;
import com.alsorg.packing.domain.matflow.MatFlowStockBlock;
import com.alsorg.packing.domain.matflow.MatFlowStockBlockStatus;
import com.alsorg.packing.domain.matflow.MatFlowStockSourceType;
import com.alsorg.packing.domain.matflow.MatFlowStoreDecision;

import com.alsorg.packing.repository.matflow.MatFlowLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowRequisitionLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowRequisitionRepository;
import com.alsorg.packing.repository.matflow.MatFlowStockBlockRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class MatFlowStoreReviewService {

    private final MatFlowRequisitionRepository requisitionRepo;
    private final MatFlowRequisitionLineRepository requisitionLineRepo;
    private final MatFlowLineRepository matFlowLineRepo;
    private final MatFlowStockBlockRepository stockBlockRepo;

    private final MatFlowAccessService access;
    private final MatFlowInventoryAvailabilityGateway inventoryGateway;
    private final MatFlowAuditService auditService;

    public MatFlowStoreReviewService(
            MatFlowRequisitionRepository requisitionRepo,
            MatFlowRequisitionLineRepository requisitionLineRepo,
            MatFlowLineRepository matFlowLineRepo,
            MatFlowStockBlockRepository stockBlockRepo,
            MatFlowAccessService access,
            MatFlowInventoryAvailabilityGateway inventoryGateway,
            MatFlowAuditService auditService) {

        this.requisitionRepo = requisitionRepo;
        this.requisitionLineRepo = requisitionLineRepo;
        this.matFlowLineRepo = matFlowLineRepo;
        this.stockBlockRepo = stockBlockRepo;

        this.access = access;
        this.inventoryGateway = inventoryGateway;
        this.auditService = auditService;
    }

    /*
     * =========================================================
     * STORE REVIEW
     * =========================================================
     */

    public StoreReviewResponse review(
            UUID requisitionId,
            StoreReviewRequest req) {

        access.requireStore();

        require(
                req,
                "Store review request body is required."
        );

        require(
                req.requisitionRowVersion(),
                "Requisition rowVersion is required."
        );

        if (req.lines() == null || req.lines().isEmpty()) {
            throw badRequest(
                    "At least one requisition line must be reviewed."
            );
        }

        MatFlowRequisition requisition =
                requisitionRepo.findByIdForUpdate(requisitionId)
                        .orElseThrow(() ->
                                notFound(
                                        "MatFlow requisition not found."
                                )
                        );

        access.assertPlantAccess(requisition.plantCode);

        assertVersion(
                requisition.rowVersion,
                req.requisitionRowVersion(),
                "Requisition"
        );

        boolean reviewable =
                requisition.status
                        == MatFlowRequisitionStatus.SUBMITTED_TO_STORE
                        || requisition.status
                        == MatFlowRequisitionStatus.STORE_REVIEW_IN_PROGRESS;

        if (!reviewable) {
            throw badRequest(
                    "Only a requisition submitted to Store or "
                            + "already under Store review can be reviewed."
            );
        }

        List<MatFlowRequisitionLine> requisitionLines =
                requisitionLineRepo.findActiveForUpdate(
                        requisition.id
                );

        if (requisitionLines.isEmpty()) {
            throw badRequest(
                    "The requisition has no active material lines."
            );
        }

        Map<UUID, MatFlowRequisitionLine> linesById =
                new HashMap<>();

        for (MatFlowRequisitionLine line : requisitionLines) {
            linesById.put(line.id, line);
        }

        Set<UUID> suppliedLineIds =
                new HashSet<>();

        String actor =
                access.currentUsername();

        Set<UUID> affectedMatFlowLineIds =
                new LinkedHashSet<>();

        for (StoreReviewLineRequest lineRequest : req.lines()) {

            require(
                    lineRequest,
                    "Store review line cannot be null."
            );

            require(
                    lineRequest.requisitionLineId(),
                    "Requisition Line ID is required."
            );

            if (!suppliedLineIds.add(
                    lineRequest.requisitionLineId())) {

                throw badRequest(
                        "The same requisition line was supplied "
                                + "more than once."
                );
            }

            MatFlowRequisitionLine requisitionLine =
                    linesById.get(
                            lineRequest.requisitionLineId()
                    );

            if (requisitionLine == null) {
                throw badRequest(
                        "Requisition line "
                                + lineRequest.requisitionLineId()
                                + " does not belong to this requisition."
                );
            }

            reviewLine(
                    requisition,
                    requisitionLine,
                    lineRequest,
                    actor
            );

            affectedMatFlowLineIds.add(
                    requisitionLine.matFlowLineId
            );
        }

        for (UUID matFlowLineId : affectedMatFlowLineIds) {
            reconcileMatFlowLine(
                    requisition.releaseId,
                    matFlowLineId,
                    actor
            );
        }

        requisition.status =
                deriveRequisitionStatus(
                        requisitionLines
                );

        if (hasText(req.remarks())) {
            requisition.remarks =
                    clean(req.remarks());
        }

        requisition.updatedBy =
                actor;

        MatFlowRequisition savedRequisition =
                requisitionRepo.save(
                        requisition
                );

        auditService.record(
                requisition.releaseId,
                "MATFLOW_REQUISITION",
                requisition.id,
                "STORE_REVIEW_UPDATED",
                null,
                "Status="
                        + savedRequisition.status
                        + ", Reviewed Lines="
                        + req.lines().size(),
                actor
        );

        return buildResponse(
                savedRequisition
        );
    }

    private void reviewLine(
            MatFlowRequisition requisition,
            MatFlowRequisitionLine requisitionLine,
            StoreReviewLineRequest req,
            String actor) {

        require(
                req.decision(),
                "Store Decision is required."
        );

        require(
                req.sourceType(),
                "Stock Source Type is required."
        );

        require(
                req.requisitionLineRowVersion(),
                "Requisition line rowVersion is required."
        );

        require(
                req.matFlowLineRowVersion(),
                "MatFlow line rowVersion is required."
        );

        assertVersion(
                requisitionLine.rowVersion,
                req.requisitionLineRowVersion(),
                "Requisition line"
        );

        MatFlowLine matFlowLine =
                matFlowLineRepo.findActiveByIdForUpdate(
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

        MatFlowStockBlock existingBlock =
                stockBlockRepo
                        .findActiveByRequisitionLineIdForUpdate(
                                requisitionLine.id
                        )
                        .orElse(null);

        if (existingBlock != null) {

            require(
                    req.stockBlockRowVersion(),
                    "Stock block rowVersion is required when "
                            + "updating an existing Store review."
            );

            assertVersion(
                    existingBlock.rowVersion,
                    req.stockBlockRowVersion(),
                    "Stock block"
            );

        } else if (req.stockBlockRowVersion() != null) {

            throw conflict(
                    "The supplied Stock Block no longer exists. "
                            + "Reload before continuing."
            );
        }

        BigDecimal requestedQty =
                positiveQuantity(
                        requisitionLine.requestedQty,
                        "Requested Qty must be greater than zero."
                );

        BigDecimal availableQty =
                resolveAvailableQuantity(
                        requisition,
                        matFlowLine,
                        req
                );

        BigDecimal blockedQty;
        BigDecimal shortageQty;

        if (req.decision()
                == MatFlowStoreDecision.HOLD) {

            requireText(
                    req.remarks(),
                    "Store remarks are required when placing "
                            + "a line on Hold."
            );

            blockedQty =
                    zeroQuantity();

            shortageQty =
                    zeroQuantity();

        } else {

            validateDecisionAgainstAvailability(
                    req.decision(),
                    requestedQty,
                    availableQty
            );

            blockedQty =
                    availableQty.min(
                            requestedQty
                    );

            shortageQty =
                    requestedQty
                            .subtract(blockedQty)
                            .setScale(
                                    3,
                                    RoundingMode.HALF_UP
                            );
        }

        MatFlowStockBlock block =
                existingBlock == null
                        ? new MatFlowStockBlock()
                        : existingBlock;

        block.releaseId =
                requisition.releaseId;

        block.requisitionId =
                requisition.id;

        block.requisitionLineId =
                requisitionLine.id;

        block.matFlowLineId =
                matFlowLine.id;

        block.plantCode =
                requisition.plantCode;

        block.inventoryItemId =
                matFlowLine.inventoryItemId;

        block.decision =
                req.decision();

        block.sourceType =
                req.sourceType();

        block.sourceReference =
                clean(req.sourceReference());

        block.requestedQty =
                requestedQty;

        block.availableQtySnapshot =
                availableQty;

        block.blockedQty =
                blockedQty;

        block.shortageQty =
                shortageQty;

        block.status =
                MatFlowStockBlockStatus.ACTIVE;

        block.active =
                true;

        block.reviewedBy =
                actor;

        block.reviewedAt =
                LocalDateTime.now();

        block.remarks =
                clean(req.remarks());

        block.updatedBy =
                actor;

        MatFlowStockBlock savedBlock =
                stockBlockRepo.saveAndFlush(
                        block
                );

        requisitionLine.blockedQty =
                blockedQty;

        requisitionLine.shortageQty =
                shortageQty;

        requisitionLine.status =
                deriveReviewedLineStatus(
                        req.decision(),
                        blockedQty,
                        shortageQty
                );

        requisitionLine.updatedBy =
                actor;

        requisitionLineRepo.save(
                requisitionLine
        );

        auditService.record(
                requisition.releaseId,
                "MATFLOW_STOCK_BLOCK",
                savedBlock.id,
                existingBlock == null
                        ? "STOCK_REVIEW_CREATED"
                        : "STOCK_REVIEW_UPDATED",
                existingBlock == null
                        ? null
                        : "Blocked="
                        + existingBlock.blockedQty
                        + ", Shortage="
                        + existingBlock.shortageQty,
                "Decision="
                        + savedBlock.decision
                        + ", Blocked="
                        + savedBlock.blockedQty
                        + ", Shortage="
                        + savedBlock.shortageQty,
                actor
        );
    }

    /*
     * =========================================================
     * RETURN TO PRODUCTION
     * =========================================================
     */

    public StoreReviewResponse returnToProduction(
            UUID requisitionId,
            ReturnToProductionRequest req) {

        access.requireStore();

        require(
                req,
                "Return request body is required."
        );

        require(
                req.requisitionRowVersion(),
                "Requisition rowVersion is required."
        );

        requireText(
                req.remarks(),
                "Return reason is required."
        );

        MatFlowRequisition requisition =
                requisitionRepo.findByIdForUpdate(requisitionId)
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

        boolean returnable =
                requisition.status
                        == MatFlowRequisitionStatus.SUBMITTED_TO_STORE
                        || requisition.status
                        == MatFlowRequisitionStatus.STORE_REVIEW_IN_PROGRESS;

        if (!returnable) {
            throw badRequest(
                    "Only a submitted requisition or a requisition "
                            + "under Store review can be returned."
            );
        }

        List<MatFlowRequisitionLine> lines =
                requisitionLineRepo.findActiveForUpdate(
                        requisition.id
                );

        for (MatFlowRequisitionLine line : lines) {

            if (quantityZero(line.issuedQty).signum() > 0) {
                throw badRequest(
                        "The requisition cannot be returned because "
                                + "material has already been issued."
                );
            }
        }

        List<MatFlowStockBlock> blocks =
                stockBlockRepo.findActiveByRequisitionIdForUpdate(
                        requisition.id
                );

        String actor =
                access.currentUsername();

        Set<UUID> affectedMatFlowLineIds =
                new LinkedHashSet<>();

        for (MatFlowStockBlock block : blocks) {

            block.status =
                    MatFlowStockBlockStatus.CANCELLED;

            block.active =
                    false;

            block.updatedBy =
                    actor;

            stockBlockRepo.save(
                    block
            );

            affectedMatFlowLineIds.add(
                    block.matFlowLineId
            );
        }

        stockBlockRepo.flush();

        for (MatFlowRequisitionLine line : lines) {

            line.blockedQty =
                    zeroQuantity();

            line.shortageQty =
                    zeroQuantity();

            line.status =
                    MatFlowLineStatus.REQUISITIONED;

            line.updatedBy =
                    actor;

            requisitionLineRepo.save(
                    line
            );

            affectedMatFlowLineIds.add(
                    line.matFlowLineId
            );
        }

        for (UUID matFlowLineId : affectedMatFlowLineIds) {
            reconcileMatFlowLine(
                    requisition.releaseId,
                    matFlowLineId,
                    actor
            );
        }

        requisition.status =
                MatFlowRequisitionStatus.RETURNED;

        requisition.returnedBy =
                actor;

        requisition.returnedAt =
                LocalDateTime.now();

        requisition.returnRemarks =
                clean(req.remarks());

        requisition.updatedBy =
                actor;

        MatFlowRequisition saved =
                requisitionRepo.save(
                        requisition
                );

        auditService.record(
                requisition.releaseId,
                "MATFLOW_REQUISITION",
                requisition.id,
                "REQUISITION_RETURNED_TO_PRODUCTION",
                null,
                "Reason="
                        + clean(req.remarks()),
                actor
        );

        return buildResponse(saved);
    }

    /*
     * =========================================================
     * STORE QUEUE
     * =========================================================
     */

    @Transactional(readOnly = true)
    public List<StoreQueueResponse> pendingQueue(
            String plantCode) {

        access.requireStore();

        List<MatFlowRequisitionStatus> statuses =
                List.of(
                        MatFlowRequisitionStatus.SUBMITTED_TO_STORE,
                        MatFlowRequisitionStatus.STORE_REVIEW_IN_PROGRESS
                );

        List<MatFlowRequisition> requisitions;

        if (hasText(plantCode)) {

            access.assertPlantAccess(
                    plantCode
            );

            requisitions =
                    requisitionRepo
                            .findByPlantCodeIgnoreCaseAndStatusInOrderByRequiredByDateAscSubmittedAtAsc(
                                    plantCode.trim(),
                                    statuses
                            );

        } else {

            requisitions =
                    requisitionRepo
                            .findByStatusInOrderByRequiredByDateAscSubmittedAtAsc(
                                    statuses
                            );
        }

        List<StoreQueueResponse> responses =
                new ArrayList<>();

        for (MatFlowRequisition requisition : requisitions) {

            try {
                access.assertPlantAccess(
                        requisition.plantCode
                );

                responses.add(
                        buildQueueResponse(
                                requisition
                        )
                );

            } catch (ResponseStatusException ex) {

                if (ex.getStatusCode()
                        != HttpStatus.FORBIDDEN) {

                    throw ex;
                }
            }
        }

        return responses;
    }

    @Transactional(readOnly = true)
    public StoreReviewResponse detail(
            UUID requisitionId) {

        access.requireStore();

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

        return buildResponse(
                requisition
        );
    }

    /*
     * =========================================================
     * INVENTORY AVAILABILITY
     * =========================================================
     */

    private BigDecimal resolveAvailableQuantity(
            MatFlowRequisition requisition,
            MatFlowLine matFlowLine,
            StoreReviewLineRequest req) {

        if (req.decision()
                == MatFlowStoreDecision.HOLD) {

            return zeroQuantity();
        }

        if (req.sourceType()
                == MatFlowStockSourceType.SYSTEM_INVENTORY) {

            if (matFlowLine.inventoryItemId == null) {
                throw badRequest(
                        "This material line has no Inventory Item ID "
                                + "and cannot use SYSTEM_INVENTORY."
                );
            }

            BigDecimal available =
                    inventoryGateway.getAvailableQuantity(
                            matFlowLine.inventoryItemId,
                            requisition.plantCode
                    );

            return nonNegativeQuantity(
                    available,
                    "Inventory available quantity cannot be negative."
            );
        }

        require(
                req.verifiedAvailableQty(),
                "Verified Available Qty is required for "
                        + "OFFLINE_MANUAL stock review."
        );

        requireText(
                req.sourceReference(),
                "Stock Register, Rack, Bin or Source Reference "
                        + "is required for OFFLINE_MANUAL review."
        );

        return nonNegativeQuantity(
                req.verifiedAvailableQty(),
                "Verified Available Qty cannot be negative."
        );
    }

    private void validateDecisionAgainstAvailability(
            MatFlowStoreDecision decision,
            BigDecimal requestedQty,
            BigDecimal availableQty) {

        switch (decision) {

            case AVAILABLE -> {
                if (availableQty.compareTo(
                        requestedQty) < 0) {

                    throw badRequest(
                            "AVAILABLE requires verified availability "
                                    + "greater than or equal to Requested Qty."
                    );
                }
            }

            case PARTIALLY_AVAILABLE -> {
                if (availableQty.compareTo(
                        BigDecimal.ZERO) <= 0
                        || availableQty.compareTo(
                        requestedQty) >= 0) {

                    throw badRequest(
                            "PARTIALLY_AVAILABLE requires availability "
                                    + "greater than zero and less than "
                                    + "Requested Qty."
                    );
                }
            }

            case NOT_AVAILABLE -> {
                if (availableQty.signum() != 0) {
                    throw badRequest(
                            "NOT_AVAILABLE requires Verified Available "
                                    + "Qty to be zero."
                    );
                }
            }

            case HOLD ->
                    throw badRequest(
                            "HOLD must be handled without an "
                                    + "availability calculation."
                    );
        }
    }

    /*
     * =========================================================
     * AGGREGATE RECONCILIATION
     * =========================================================
     */

    private void reconcileMatFlowLine(
            UUID releaseId,
            UUID matFlowLineId,
            String actor) {

        MatFlowLine line =
                matFlowLineRepo.findActiveByIdForUpdate(
                                releaseId,
                                matFlowLineId
                        )
                        .orElseThrow(() ->
                                notFound(
                                        "MatFlow material line not found."
                                )
                        );

        BigDecimal reviewedQty =
                quantityZero(
                        stockBlockRepo
                                .sumActiveReviewedQtyByMatFlowLineId(
                                        line.id
                                )
                );

        BigDecimal blockedQty =
                quantityZero(
                        stockBlockRepo
                                .sumActiveBlockedQtyByMatFlowLineId(
                                        line.id
                                )
                );

        BigDecimal shortageQty =
                quantityZero(
                        stockBlockRepo
                                .sumActiveShortageQtyByMatFlowLineId(
                                        line.id
                                )
                );

        BigDecimal requisitionedQty =
                quantityZero(
                        line.requisitionedQty
                );

        boolean hasHold =
                stockBlockRepo
                        .existsByMatFlowLineIdAndDecisionAndActiveTrue(
                                line.id,
                                MatFlowStoreDecision.HOLD
                        );

        line.blockedQty =
                blockedQty;

        line.shortageQty =
                shortageQty;

        if (hasHold) {

            line.status =
                    MatFlowLineStatus.ON_HOLD;

        } else if (reviewedQty.compareTo(
                requisitionedQty) < 0) {

            /*
             * Some active requisition quantities still have not
             * been reviewed.
             */
            line.status =
                    MatFlowLineStatus.STORE_REVIEW_PENDING;

        } else if (blockedQty.compareTo(
                requisitionedQty) >= 0
                && shortageQty.signum() == 0) {

            line.status =
                    MatFlowLineStatus.FULLY_BLOCKED;

        } else if (blockedQty.signum() > 0
                && shortageQty.signum() > 0) {

            line.status =
                    MatFlowLineStatus.PARTIALLY_BLOCKED;

        } else if (blockedQty.signum() == 0
                && shortageQty.signum() > 0) {

            line.status =
                    MatFlowLineStatus.SHORTAGE_IDENTIFIED;

        } else if (requisitionedQty.signum() > 0) {

            line.status =
                    MatFlowLineStatus.REQUISITIONED;

        } else {

            line.status =
                    MatFlowLineStatus.NOT_REQUISITIONED;
        }

        line.updatedBy =
                actor;

        matFlowLineRepo.save(
                line
        );
    }

    private MatFlowRequisitionStatus deriveRequisitionStatus(
            List<MatFlowRequisitionLine> lines) {

        boolean hasPendingOrHold =
                lines.stream()
                        .anyMatch(line ->
                                line.status
                                        == MatFlowLineStatus.REQUISITIONED
                                        || line.status
                                        == MatFlowLineStatus.STORE_REVIEW_PENDING
                                        || line.status
                                        == MatFlowLineStatus.ON_HOLD
                        );

        return hasPendingOrHold
                ? MatFlowRequisitionStatus.STORE_REVIEW_IN_PROGRESS
                : MatFlowRequisitionStatus.STORE_REVIEW_COMPLETED;
    }

    private MatFlowLineStatus deriveReviewedLineStatus(
            MatFlowStoreDecision decision,
            BigDecimal blockedQty,
            BigDecimal shortageQty) {

        if (decision == MatFlowStoreDecision.HOLD) {
            return MatFlowLineStatus.ON_HOLD;
        }

        if (blockedQty.signum() > 0
                && shortageQty.signum() == 0) {

            return MatFlowLineStatus.FULLY_BLOCKED;
        }

        if (blockedQty.signum() > 0
                && shortageQty.signum() > 0) {

            return MatFlowLineStatus.PARTIALLY_BLOCKED;
        }

        return MatFlowLineStatus.SHORTAGE_IDENTIFIED;
    }

    /*
     * =========================================================
     * RESPONSE MAPPING
     * =========================================================
     */

    private StoreReviewResponse buildResponse(
            MatFlowRequisition requisition) {

        List<MatFlowRequisitionLine> lines =
                requisitionLineRepo
                        .findByRequisitionIdAndActiveTrueOrderBySourceLineNoAsc(
                                requisition.id
                        );

        List<MatFlowStockBlock> blocks =
                stockBlockRepo
                        .findByRequisitionIdAndActiveTrueOrderByReviewedAtAsc(
                                requisition.id
                        );

        Map<UUID, MatFlowStockBlock> blockByLineId =
                new HashMap<>();

        for (MatFlowStockBlock block : blocks) {
            blockByLineId.put(
                    block.requisitionLineId,
                    block
            );
        }

        List<StoreReviewLineResponse> lineResponses =
                new ArrayList<>();

        BigDecimal totalRequested =
                zeroQuantity();

        BigDecimal totalBlocked =
                zeroQuantity();

        BigDecimal totalShortage =
                zeroQuantity();

        for (MatFlowRequisitionLine line : lines) {

            MatFlowStockBlock block =
                    blockByLineId.get(line.id);

            MatFlowLine sourceLine =
                    matFlowLineRepo
                            .findById(line.matFlowLineId)
                            .orElseThrow(() ->
                                    notFound(
                                            "Source MatFlow material line "
                                                    + "was not found."
                                    )
                            );

            totalRequested =
                    totalRequested.add(
                            quantityZero(
                                    line.requestedQty
                            )
                    );

            totalBlocked =
                    totalBlocked.add(
                            quantityZero(
                                    line.blockedQty
                            )
                    );

            totalShortage =
                    totalShortage.add(
                            quantityZero(
                                    line.shortageQty
                            )
                    );

            lineResponses.add(
                    new StoreReviewLineResponse(
                            line.id,
                            line.matFlowLineId,
                            line.sourceLineNo,
                            line.itemCode,
                            line.itemName,

                            quantityZero(
                                    line.requestedQty
                            ),

                            block == null
                                    ? null
                                    : block.decision,

                            block == null
                                    ? null
                                    : block.sourceType,

                            block == null
                                    ? null
                                    : block.sourceReference,

                            block == null
                                    ? zeroQuantity()
                                    : quantityZero(
                                            block.availableQtySnapshot
                                    ),

                            quantityZero(
                                    line.blockedQty
                            ),

                            quantityZero(
                                    line.shortageQty
                            ),

                            line.status,

                            block == null
                                    ? null
                                    : block.status,

                            block == null
                                    ? null
                                    : block.reviewedBy,

                            block == null
                                    ? null
                                    : block.reviewedAt,

                            block == null
                                    ? null
                                    : block.remarks,

                            line.rowVersion,
                            sourceLine.rowVersion,

                            block == null
                                    ? null
                                    : block.rowVersion
                    )
            );
        }

        return new StoreReviewResponse(
                requisition.id,
                requisition.requisitionNo,
                requisition.releaseId,

                requisition.plantCode,
                requisition.pdNo,
                requisition.drawingNo,
                requisition.projectCode,
                requisition.clientName,
                requisition.productName,

                requisition.requiredByDate,
                requisition.productionDepartment,
                requisition.requestedFor,

                requisition.status,

                totalRequested,
                totalBlocked,
                totalShortage,

                requisition.remarks,
                requisition.rowVersion,

                lineResponses
        );
    }

    private StoreQueueResponse buildQueueResponse(
            MatFlowRequisition requisition) {

        StoreReviewResponse review =
                buildResponse(requisition);

        return new StoreQueueResponse(
                requisition.id,
                requisition.requisitionNo,
                requisition.releaseId,

                requisition.plantCode,
                requisition.pdNo,
                requisition.clientName,
                requisition.productName,

                requisition.requiredByDate,
                requisition.productionDepartment,
                requisition.requestedFor,

                requisition.status,
                review.lines().size(),

                review.totalRequestedQty(),
                review.totalBlockedQty(),
                review.totalShortageQty(),

                requisition.submittedBy,
                requisition.submittedAt,

                requisition.rowVersion
        );
    }

    /*
     * =========================================================
     * VALIDATION HELPERS
     * =========================================================
     */

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

        return normalizeQuantity(value);
    }

    private BigDecimal nonNegativeQuantity(
            BigDecimal value,
            String message) {

        require(value, message);

        if (value.compareTo(BigDecimal.ZERO) < 0) {
            throw badRequest(message);
        }

        return normalizeQuantity(value);
    }

    private BigDecimal normalizeQuantity(
            BigDecimal value) {

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