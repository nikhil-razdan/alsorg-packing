package com.alsorg.packing.service.bomflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowReleaseDtos.MatFlowReleaseDetailResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowReleaseDtos.ReleaseToMatFlowRequest;

import com.alsorg.packing.domain.bomflow.BomFlowBom;
import com.alsorg.packing.domain.bomflow.BomFlowItem;
import com.alsorg.packing.domain.bomflow.BomFlowRevision;
import com.alsorg.packing.domain.bomflow.BomFlowStatus;

import com.alsorg.packing.domain.matflow.MatFlowLine;
import com.alsorg.packing.domain.matflow.MatFlowLineStatus;
import com.alsorg.packing.domain.matflow.MatFlowRelease;
import com.alsorg.packing.domain.matflow.MatFlowReleaseStatus;

import com.alsorg.packing.repository.bomflow.BomFlowBomRepository;
import com.alsorg.packing.repository.bomflow.BomFlowItemRepository;
import com.alsorg.packing.repository.bomflow.BomFlowRevisionRepository;

import com.alsorg.packing.repository.matflow.MatFlowLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowReleaseRepository;

import com.alsorg.packing.service.matflow.MatFlowAuditService;
import com.alsorg.packing.service.matflow.MatFlowReleaseMapper;

import org.springframework.http.HttpStatus;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
@Transactional
public class BomFlowReleaseService {

    private final BomFlowBomRepository bomRepo;
    private final BomFlowRevisionRepository revisionRepo;
    private final BomFlowItemRepository itemRepo;

    private final MatFlowReleaseRepository releaseRepo;
    private final MatFlowLineRepository lineRepo;

    private final BomFlowAccessService access;
    private final BomFlowAuditService bomAuditService;
    private final MatFlowAuditService matFlowAuditService;
    private final MatFlowReleaseMapper mapper;

    public BomFlowReleaseService(
            BomFlowBomRepository bomRepo,
            BomFlowRevisionRepository revisionRepo,
            BomFlowItemRepository itemRepo,
            MatFlowReleaseRepository releaseRepo,
            MatFlowLineRepository lineRepo,
            BomFlowAccessService access,
            BomFlowAuditService bomAuditService,
            MatFlowAuditService matFlowAuditService,
            MatFlowReleaseMapper mapper) {

        this.bomRepo = bomRepo;
        this.revisionRepo = revisionRepo;
        this.itemRepo = itemRepo;

        this.releaseRepo = releaseRepo;
        this.lineRepo = lineRepo;

        this.access = access;
        this.bomAuditService = bomAuditService;
        this.matFlowAuditService = matFlowAuditService;
        this.mapper = mapper;
    }

    /*
     * =========================================================
     * RELEASE APPROVED BOM REVISION TO MATFLOW
     * =========================================================
     */

    public MatFlowReleaseDetailResponse releaseToMatFlow(
            UUID revisionId,
            ReleaseToMatFlowRequest req) {

        access.requireReleaser();

        require(
                revisionId,
                "BOM revision ID is required.");

        require(
                req,
                "MatFlow release request body is required.");

        require(
                req.bomRowVersion(),
                "BOM rowVersion is required.");

        require(
                req.revisionRowVersion(),
                "Revision rowVersion is required.");

        /*
         * Lock the BOM header and revision before checking
         * idempotency or changing release state.
         *
         * This prevents two simultaneous release requests from
         * creating duplicate MatFlow releases.
         */
        LockedContext context =
                lockedContext(revisionId);

        /*
         * =====================================================
         * IDEMPOTENCY
         * =====================================================
         *
         * A source revision may have only one MatFlow release.
         * Repeating the same API call returns the existing result.
         */
        MatFlowRelease existingRelease =
                releaseRepo
                        .findBySourceRevisionId(revisionId)
                        .orElse(null);

        if (existingRelease != null) {

            access.assertPlantAccess(
                    existingRelease.plantCode);

            List<MatFlowLine> existingLines =
                    lineRepo
                            .findByReleaseIdOrderBySourceLineNoAsc(
                                    existingRelease.id);

            return mapper.toDetailResponse(
                    existingRelease,
                    existingLines);
        }

        /*
         * Validate optimistic locking values only when a new
         * release must actually be created.
         */
        assertVersion(
                context.bom().rowVersion,
                req.bomRowVersion(),
                "BOM");

        assertVersion(
                context.revision().rowVersion,
                req.revisionRowVersion(),
                "BOM revision");

        if (!Objects.equals(
                context.bom().currentRevisionNo,
                context.revision().revisionNo)) {

            throw badRequest(
                    "Only the current BOM revision "
                            + "can be released to MatFlow.");
        }

        if (context.revision().status
                != BomFlowStatus.APPROVED) {

            throw badRequest(
                    "Only an Approved BOM revision "
                            + "can be released to MatFlow.");
        }

        /*
         * Load all active BOM lines.
         */
        List<BomFlowItem> activeItems =
                itemRepo
                        .findByRevisionIdAndActiveTrueOrderByLineNoAsc(
                                revisionId);

        if (activeItems.isEmpty()) {
            throw badRequest(
                    "The approved BOM revision has "
                            + "no active material lines.");
        }

        /*
         * Only lines requiring Store issue generate MatFlow demand.
         *
         * Examples of excluded informational lines may include:
         * - service-only lines
         * - non-stock notes
         * - design information
         * - externally supplied materials not handled by Store
         */
        List<BomFlowItem> eligibleItems =
                activeItems.stream()
                        .filter(item ->
                                item.storeIssueRequired)
                        .toList();

        if (eligibleItems.isEmpty()) {
            throw badRequest(
                    "The approved BOM revision has no "
                            + "Store-issue material lines.");
        }

        validateEligibleItems(
                eligibleItems);

        String actor =
                access.currentUsername();

        LocalDateTime now =
                LocalDateTime.now();

        /*
         * =====================================================
         * SUPERSEDE PREVIOUS ACTIVE RELEASE
         * =====================================================
         *
         * One BOM may have several historical releases, but only
         * one ACTIVE release.
         */
        MatFlowRelease previousRelease =
                releaseRepo
                        .findFirstBySourceBomIdAndStatusForUpdate(
                                context.bom().id,
                                MatFlowReleaseStatus.ACTIVE)
                        .orElse(null);

        if (previousRelease != null) {

            /*
             * Defensive check:
             *
             * The same revision would already have been returned
             * by the idempotency check above.
             */
            if (Objects.equals(
                    previousRelease.sourceRevisionId,
                    context.revision().id)) {

                List<MatFlowLine> previousLines =
                        lineRepo
                                .findByReleaseIdOrderBySourceLineNoAsc(
                                        previousRelease.id);

                return mapper.toDetailResponse(
                        previousRelease,
                        previousLines);
            }

            previousRelease.status =
                    MatFlowReleaseStatus.SUPERSEDED;

            previousRelease.updatedBy =
                    actor;

            /*
             * Flush this status change before inserting a new
             * ACTIVE release.
             *
             * PostgreSQL has a partial unique index permitting
             * only one ACTIVE release per source BOM.
             */
            releaseRepo.saveAndFlush(
                    previousRelease);
        }

        /*
         * =====================================================
         * CREATE NEW RELEASE SNAPSHOT
         * =====================================================
         */

        MatFlowRelease release =
                new MatFlowRelease();

        release.sourceBomId =
                context.bom().id;

        release.sourceRevisionId =
                context.revision().id;

        release.sourceRevisionNo =
                context.revision().revisionNo;

        release.bomNo =
                context.bom().bomNo;

        release.plantCode =
                context.bom().plantCode;

        release.pdNo =
                context.bom().pdNo;

        release.drawingNo =
                context.bom().drawingNo;

        release.projectCode =
                context.bom().projectCode;

        release.clientName =
                context.bom().clientName;

        release.productName =
                context.bom().productName;

        release.productCode =
                context.bom().productCode;

        release.productDescription =
                context.bom().productDescription;

        release.status =
                MatFlowReleaseStatus.ACTIVE;

        release.releasedLineCount =
                eligibleItems.size();

        release.skippedLineCount =
                activeItems.size()
                        - eligibleItems.size();

        release.previousReleaseId =
                previousRelease == null
                        ? null
                        : previousRelease.id;

        release.supersededByReleaseId =
                null;

        release.releaseRemarks =
                clean(req.remarks());

        release.releasedBy =
                actor;

        release.releasedAt =
                now;

        release.updatedBy =
                actor;

        /*
         * IMPORTANT COMPILE FIX:
         *
         * Do not reassign "release".
         *
         * The saved result is placed in a separate final variable
         * so it can be safely captured inside the stream lambda.
         */
        final MatFlowRelease savedRelease =
                releaseRepo.saveAndFlush(
                        release);

        /*
         * Link the previous release to the newly created release.
         */
        if (previousRelease != null) {

            previousRelease.supersededByReleaseId =
                    savedRelease.id;

            previousRelease.updatedBy =
                    actor;

            releaseRepo.save(
                    previousRelease);

            /*
             * Keep the previous BOM revision synchronized.
             */
            revisionRepo
                    .findByIdForUpdate(
                            previousRelease.sourceRevisionId)
                    .ifPresent(previousRevision -> {

                        if (previousRevision.status
                                == BomFlowStatus.RELEASED) {

                            previousRevision.status =
                                    BomFlowStatus.SUPERSEDED;

                            previousRevision.updatedBy =
                                    actor;

                            revisionRepo.save(
                                    previousRevision);
                        }
                    });

            matFlowAuditService.record(
                    previousRelease.id,
                    "MATFLOW_RELEASE",
                    previousRelease.id,
                    "RELEASE_SUPERSEDED",
                    "Status=ACTIVE",
                    "Status=SUPERSEDED, "
                            + "Superseded By="
                            + savedRelease.id,
                    actor);
        }

        /*
         * =====================================================
         * COPY BOM ITEMS INTO MATFLOW LINES
         * =====================================================
         */

        List<MatFlowLine> unsavedLines =
                eligibleItems.stream()
                        .map(item ->
                                createLine(
                                        savedRelease,
                                        item,
                                        actor))
                        .toList();

        List<MatFlowLine> savedLines =
                lineRepo.saveAll(
                        unsavedLines);

        /*
         * =====================================================
         * UPDATE BOMFLOW STATUS
         * =====================================================
         */

        context.revision().status =
                BomFlowStatus.RELEASED;

        context.revision().releasedBy =
                actor;

        context.revision().releasedAt =
                now;

        context.revision().updatedBy =
                actor;

        context.bom().status =
                BomFlowStatus.RELEASED;

        context.bom().updatedBy =
                actor;

        revisionRepo.save(
                context.revision());

        bomRepo.save(
                context.bom());

        /*
         * =====================================================
         * AUDIT
         * =====================================================
         */

        bomAuditService.record(
                context.bom().id,
                context.revision().id,
                null,
                "BOM_RELEASED_TO_MATFLOW",
                "Status=APPROVED",
                "Status=RELEASED, "
                        + "MatFlow Release="
                        + savedRelease.id
                        + ", Lines="
                        + savedLines.size(),
                actor);

        matFlowAuditService.record(
                savedRelease.id,
                "MATFLOW_RELEASE",
                savedRelease.id,
                "MATFLOW_RELEASE_CREATED",
                null,
                "Source BOM="
                        + savedRelease.bomNo
                        + ", Revision="
                        + savedRelease.sourceRevisionNo
                        + ", Lines="
                        + savedLines.size(),
                actor);

        return mapper.toDetailResponse(
                savedRelease,
                savedLines);
    }

    /*
     * =========================================================
     * CREATE MATFLOW LINE SNAPSHOT
     * =========================================================
     */

    private MatFlowLine createLine(
            MatFlowRelease release,
            BomFlowItem source,
            String actor) {

        MatFlowLine line =
                new MatFlowLine();

        line.releaseId =
                release.id;

        line.sourceBomItemId =
                source.id;

        line.sourceLineNo =
                source.lineNo;

        line.category =
                source.category;

        line.subCategory =
                source.subCategory;

        line.inventoryItemId =
                source.inventoryItemId;

        line.itemCode =
                source.itemCode;

        line.itemName =
                source.itemName;

        line.itemDescription =
                source.itemDescription;

        line.specification =
                source.specification;

        line.grade =
                source.grade;

        line.brand =
                source.brand;

        line.finish =
                source.finish;

        line.colour =
                source.colour;

        line.thickness =
                source.thickness;

        line.size =
                source.size;

        line.length =
                source.length;

        line.width =
                source.width;

        line.height =
                source.height;

        line.baseQty =
                quantityZero(
                        source.baseQty);

        line.wastagePercent =
                quantityZero(
                        source.wastagePercent);

        line.requiredQty =
                quantityZero(
                        source.requiredQty);

        line.unit =
                source.unit;

        line.unitRate =
                amountZero(
                        source.unitRate);

        line.materialAmount =
                amountZero(
                        source.materialAmount);

        line.processingAmount =
                amountZero(
                        source.processingAmount);

        line.totalAmount =
                amountZero(
                        source.totalAmount);

        line.storeIssueRequired =
                source.storeIssueRequired;

        BigDecimal zeroQuantity =
                BigDecimal.ZERO
                        .setScale(3);

        line.requisitionedQty =
                zeroQuantity;

        line.blockedQty =
                zeroQuantity;

        line.shortageQty =
                zeroQuantity;

        line.indentedQty =
                zeroQuantity;

        line.orderedQty =
                zeroQuantity;

        line.receivedQty =
                zeroQuantity;

        line.acceptedQty =
                zeroQuantity;

        line.rejectedQty =
                zeroQuantity;

        line.holdQty =
                zeroQuantity;

        line.issuedQty =
                zeroQuantity;

        line.status =
                MatFlowLineStatus.NOT_REQUISITIONED;

        line.active =
                true;

        line.createdBy =
                actor;

        line.updatedBy =
                actor;

        return line;
    }

    /*
     * =========================================================
     * RELEASE VALIDATION
     * =========================================================
     */

    private void validateEligibleItems(
            List<BomFlowItem> items) {

        for (BomFlowItem item : items) {

            if (item.id == null) {
                throw badRequest(
                        "A BOM material line has no ID.");
            }

            if (item.lineNo == null
                    || item.lineNo < 1) {

                throw badRequest(
                        "Every released BOM line must "
                                + "have a valid Line No.");
            }

            if (item.category == null) {
                throw badRequest(
                        "Every released BOM line must "
                                + "have a Material Category.");
            }

            if (!hasText(item.itemName)) {
                throw badRequest(
                        "Every released BOM line must "
                                + "have an Item Name.");
            }

            if (item.requiredQty == null
                    || item.requiredQty.compareTo(
                    BigDecimal.ZERO) <= 0) {

                throw badRequest(
                        "Every released BOM line must "
                                + "have Required Qty greater "
                                + "than zero.");
            }

            if (item.unit == null) {
                throw badRequest(
                        "Every released BOM line must "
                                + "have a Material Unit.");
            }
        }
    }

    /*
     * =========================================================
     * LOCK BOM AND REVISION
     * =========================================================
     */

    private LockedContext lockedContext(
            UUID revisionId) {

        if (revisionId == null) {
            throw badRequest(
                    "Revision ID is required.");
        }

        BomFlowRevision initialRevision =
                revisionRepo
                        .findById(revisionId)
                        .orElseThrow(() ->
                                notFound(
                                        "BOM revision not found."));

        BomFlowBom bom =
                bomRepo
                        .findByIdForUpdate(
                                initialRevision.bomId)
                        .orElseThrow(() ->
                                notFound(
                                        "BOM not found."));

        access.assertPlantAccess(
                bom.plantCode);

        BomFlowRevision revision =
                revisionRepo
                        .findByIdForUpdate(
                                revisionId)
                        .orElseThrow(() ->
                                notFound(
                                        "BOM revision not found."));

        if (!Objects.equals(
                revision.bomId,
                bom.id)) {

            throw conflict(
                    "BOM revision ownership changed. "
                            + "Reload and try again.");
        }

        return new LockedContext(
                bom,
                revision);
    }

    /*
     * =========================================================
     * OPTIMISTIC LOCK VALIDATION
     * =========================================================
     */

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
                            + "Reload before releasing.");
        }
    }

    /*
     * =========================================================
     * VALUE HELPERS
     * =========================================================
     */

    private BigDecimal quantityZero(
            BigDecimal value) {

        if (value == null) {
            return BigDecimal.ZERO
                    .setScale(3);
        }

        return value;
    }

    private BigDecimal amountZero(
            BigDecimal value) {

        return value == null
                ? BigDecimal.ZERO
                : value;
    }

    private void require(
            Object value,
            String message) {

        if (value == null) {
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

    private record LockedContext(
            BomFlowBom bom,
            BomFlowRevision revision) {
    }
}