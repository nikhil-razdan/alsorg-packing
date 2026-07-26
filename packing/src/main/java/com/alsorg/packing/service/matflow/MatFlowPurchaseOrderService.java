package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowPurchaseDtos.CreatePurchaseOrderRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPurchaseDtos.PurchaseOrderActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPurchaseDtos.PurchaseOrderResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPurchaseDtos.SavePurchaseOrderLineRequest;

import com.alsorg.packing.domain.matflow.MatFlowIndent;
import com.alsorg.packing.domain.matflow.MatFlowIndentLine;
import com.alsorg.packing.domain.matflow.MatFlowIndentLineStatus;
import com.alsorg.packing.domain.matflow.MatFlowIndentStatus;
import com.alsorg.packing.domain.matflow.MatFlowLine;
import com.alsorg.packing.domain.matflow.MatFlowLineStatus;
import com.alsorg.packing.domain.matflow.MatFlowPurchaseOrder;
import com.alsorg.packing.domain.matflow.MatFlowPurchaseOrderLine;
import com.alsorg.packing.domain.matflow.MatFlowPurchaseOrderLineStatus;
import com.alsorg.packing.domain.matflow.MatFlowPurchaseOrderStatus;
import com.alsorg.packing.domain.matflow.MatFlowVendorQuote;
import com.alsorg.packing.domain.matflow.MatFlowVendorQuoteLine;
import com.alsorg.packing.domain.matflow.MatFlowVendorQuoteLineStatus;
import com.alsorg.packing.domain.matflow.MatFlowVendorQuoteStatus;

import com.alsorg.packing.repository.matflow.MatFlowIndentLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowIndentRepository;
import com.alsorg.packing.repository.matflow.MatFlowLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowPurchaseOrderLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowPurchaseOrderRepository;
import com.alsorg.packing.repository.matflow.MatFlowVendorQuoteLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowVendorQuoteRepository;

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
public class MatFlowPurchaseOrderService {

    private final MatFlowIndentRepository indentRepo;
    private final MatFlowIndentLineRepository indentLineRepo;
    private final MatFlowLineRepository matFlowLineRepo;

    private final MatFlowVendorQuoteRepository quoteRepo;
    private final MatFlowVendorQuoteLineRepository quoteLineRepo;

    private final MatFlowPurchaseOrderRepository purchaseOrderRepo;
    private final MatFlowPurchaseOrderLineRepository purchaseOrderLineRepo;

    private final MatFlowAccessService access;
    private final MatFlowPurchaseOrderNumberService numberService;
    private final MatFlowPurchaseMapper mapper;
    private final MatFlowAuditService auditService;

    public MatFlowPurchaseOrderService(
            MatFlowIndentRepository indentRepo,
            MatFlowIndentLineRepository indentLineRepo,
            MatFlowLineRepository matFlowLineRepo,
            MatFlowVendorQuoteRepository quoteRepo,
            MatFlowVendorQuoteLineRepository quoteLineRepo,
            MatFlowPurchaseOrderRepository purchaseOrderRepo,
            MatFlowPurchaseOrderLineRepository purchaseOrderLineRepo,
            MatFlowAccessService access,
            MatFlowPurchaseOrderNumberService numberService,
            MatFlowPurchaseMapper mapper,
            MatFlowAuditService auditService) {

        this.indentRepo = indentRepo;
        this.indentLineRepo = indentLineRepo;
        this.matFlowLineRepo = matFlowLineRepo;

        this.quoteRepo = quoteRepo;
        this.quoteLineRepo = quoteLineRepo;

        this.purchaseOrderRepo = purchaseOrderRepo;
        this.purchaseOrderLineRepo = purchaseOrderLineRepo;

        this.access = access;
        this.numberService = numberService;
        this.mapper = mapper;
        this.auditService = auditService;
    }

    public PurchaseOrderResponse createDraft(
            CreatePurchaseOrderRequest req) {

        access.requirePurchase();

        require(req, "Purchase Order request body is required.");
        require(req.indentId(), "Indent ID is required.");
        require(req.indentRowVersion(), "Indent rowVersion is required.");

        MatFlowIndent indent = indentRepo.findByIdForUpdate(req.indentId())
                .orElseThrow(() -> notFound("Material Indent not found."));

        access.assertPlantAccess(indent.plantCode);

        assertVersion(
                indent.rowVersion,
                req.indentRowVersion(),
                "Material Indent");

        assertPurchaseOpen(indent);

        MatFlowVendorQuote quote = null;

        if (req.quoteId() != null) {

            require(
                    req.quoteRowVersion(),
                    "Vendor Quote rowVersion is required.");

            quote = quoteRepo.findByIdForUpdate(req.quoteId())
                    .orElseThrow(() -> notFound("Vendor Quote not found."));

            assertVersion(
                    quote.rowVersion,
                    req.quoteRowVersion(),
                    "Vendor Quote");

            if (!Objects.equals(
                    quote.indentId,
                    indent.id)) {

                throw badRequest(
                        "The Vendor Quote does not belong to this Indent.");
            }

            boolean quoteUsable = quote.status == MatFlowVendorQuoteStatus.SUBMITTED
                    || quote.status == MatFlowVendorQuoteStatus.PARTIALLY_SELECTED;

            if (!quoteUsable) {
                throw badRequest(
                        "Only a submitted or partially selected Vendor "
                                + "Quote can be used for a Purchase Order.");
            }
        }

        String vendorName = quote != null
                ? quote.vendorName
                : clean(req.vendorName());

        requireText(
                vendorName,
                "Vendor Name is required.");

        String actor = access.currentUsername();

        MatFlowPurchaseOrder purchaseOrder = new MatFlowPurchaseOrder();

        purchaseOrder.poNo = numberService.nextPoNo(
                indent.plantCode);

        purchaseOrder.indentId = indent.id;

        purchaseOrder.releaseId = indent.releaseId;

        purchaseOrder.requisitionId = indent.requisitionId;

        purchaseOrder.quoteId = quote == null
                ? null
                : quote.id;

        purchaseOrder.indentNo = indent.indentNo;

        purchaseOrder.plantCode = indent.plantCode;

        purchaseOrder.pdNo = indent.pdNo;

        purchaseOrder.vendorId = quote != null
                ? quote.vendorId
                : req.vendorId();

        purchaseOrder.vendorName = vendorName;

        purchaseOrder.vendorGstin = quote != null
                ? quote.vendorGstin
                : clean(req.vendorGstin());

        purchaseOrder.vendorAddress = quote != null
                ? quote.vendorAddress
                : clean(req.vendorAddress());

        purchaseOrder.poDate = req.poDate();

        purchaseOrder.expectedDeliveryDate = req.expectedDeliveryDate();

        purchaseOrder.currencyCode = quote != null
                ? quote.currencyCode
                : hasText(req.currencyCode())
                        ? cleanUpper(req.currencyCode())
                        : "INR";

        purchaseOrder.paymentTerms = hasText(req.paymentTerms())
                ? clean(req.paymentTerms())
                : quote == null
                        ? null
                        : quote.paymentTerms;

        purchaseOrder.deliveryTerms = hasText(req.deliveryTerms())
                ? clean(req.deliveryTerms())
                : quote == null
                        ? null
                        : quote.deliveryTerms;

        purchaseOrder.deliveryAddress = clean(req.deliveryAddress());

        purchaseOrder.poAttachmentId = req.poAttachmentId();

        purchaseOrder.freightAmount = nonNegativeMoney(
                req.freightAmount());

        purchaseOrder.otherChargesAmount = nonNegativeMoney(
                req.otherChargesAmount());

        purchaseOrder.status = MatFlowPurchaseOrderStatus.DRAFT;

        purchaseOrder.remarks = clean(req.remarks());

        purchaseOrder.createdBy = actor;

        purchaseOrder.updatedBy = actor;

        MatFlowPurchaseOrder saved = purchaseOrderRepo.save(
                purchaseOrder);

        if (indent.status == MatFlowIndentStatus.SUBMITTED_TO_PURCHASE) {

            indent.status = MatFlowIndentStatus.PURCHASE_REVIEW_IN_PROGRESS;

            indent.updatedBy = actor;

            indentRepo.save(indent);
        }

        auditService.record(
                indent.releaseId,
                "MATFLOW_PURCHASE_ORDER",
                saved.id,
                "PURCHASE_ORDER_DRAFT_CREATED",
                null,
                "PO="
                        + saved.poNo
                        + ", Vendor="
                        + saved.vendorName,
                actor);

        return mapper.toPurchaseOrderResponse(
                saved,
                List.of());
    }

    public PurchaseOrderResponse saveLine(
            UUID purchaseOrderId,
            SavePurchaseOrderLineRequest req) {

        access.requirePurchase();

        require(req, "Purchase Order line body is required.");
        require(req.indentLineId(), "Indent Line ID is required.");
        require(req.purchaseOrderRowVersion(), "PO rowVersion is required.");
        require(req.indentLineRowVersion(), "Indent line rowVersion is required.");
        require(req.matFlowLineRowVersion(), "MatFlow line rowVersion is required.");

        BigDecimal orderedQty = positiveQuantity(
                req.orderedQty(),
                "Ordered Qty must be greater than zero.");

        MatFlowPurchaseOrder purchaseOrder = getEditablePurchaseOrderForUpdate(
                purchaseOrderId);

        assertVersion(
                purchaseOrder.rowVersion,
                req.purchaseOrderRowVersion(),
                "Purchase Order");

        MatFlowIndentLine indentLine = indentLineRepo.findActiveLineForUpdate(
                purchaseOrder.indentId,
                req.indentLineId())
                .orElseThrow(() -> notFound("Active Material Indent line not found."));

        assertVersion(
                indentLine.rowVersion,
                req.indentLineRowVersion(),
                "Material Indent line");

        MatFlowLine matFlowLine = matFlowLineRepo.findActiveByIdForUpdate(
                purchaseOrder.releaseId,
                indentLine.matFlowLineId)
                .orElseThrow(() -> notFound("Source MatFlow line not found."));

        assertVersion(
                matFlowLine.rowVersion,
                req.matFlowLineRowVersion(),
                "MatFlow material line");

        MatFlowPurchaseOrderLine existing = purchaseOrderLineRepo
                .findByPurchaseOrderIdAndIndentLineIdAndActiveTrue(
                        purchaseOrder.id,
                        indentLine.id)
                .orElse(null);

        if (existing != null) {

            require(
                    req.purchaseOrderLineRowVersion(),
                    "PO Line rowVersion is required when updating "
                            + "an existing line.");

            assertVersion(
                    existing.rowVersion,
                    req.purchaseOrderLineRowVersion(),
                    "Purchase Order line");
        }

        BigDecimal existingQty = existing == null
                ? zeroQuantity()
                : quantityZero(
                        existing.orderedQty);

        BigDecimal committedQty = quantityZero(
                purchaseOrderLineRepo
                        .sumCommittedQtyByIndentLineId(
                                indentLine.id));

        BigDecimal committedOutsideThisLine = maxZero(
                committedQty.subtract(existingQty));

        BigDecimal remainingIndentQty = maxZero(
                indentLine.indentQty
                        .subtract(
                                committedOutsideThisLine));

        if (orderedQty.compareTo(
                remainingIndentQty) > 0) {

            throw badRequest(
                    "Ordered Qty cannot exceed remaining Indent Qty: "
                            + remainingIndentQty
                            + " "
                            + indentLine.unit
                            + ".");
        }

        MatFlowVendorQuoteLine quoteLine = null;

        if (req.quoteLineId() != null) {

            require(
                    purchaseOrder.quoteId,
                    "This Purchase Order is not linked to a Vendor Quote.");

            require(
                    req.quoteLineRowVersion(),
                    "Vendor Quote Line rowVersion is required.");

            quoteLine = quoteLineRepo.findActiveLineForUpdate(
                    purchaseOrder.quoteId,
                    req.quoteLineId())
                    .orElseThrow(() -> notFound("Vendor Quote line not found."));

            assertVersion(
                    quoteLine.rowVersion,
                    req.quoteLineRowVersion(),
                    "Vendor Quote line");

            if (!Objects.equals(
                    quoteLine.indentLineId,
                    indentLine.id)) {

                throw badRequest(
                        "Vendor Quote line does not match the "
                                + "selected Indent line.");
            }

            BigDecimal quoteSelectedQty = quantityZero(
                    purchaseOrderLineRepo
                            .sumSelectedQtyByQuoteLineId(
                                    quoteLine.id));

            BigDecimal existingQuoteQty = existing != null
                    && Objects.equals(
                            existing.quoteLineId,
                            quoteLine.id)
                                    ? existingQty
                                    : zeroQuantity();

            BigDecimal selectedOutsideThisLine = maxZero(
                    quoteSelectedQty
                            .subtract(existingQuoteQty));

            BigDecimal availableQuoteQty = maxZero(
                    quoteLine.quotedQty
                            .subtract(
                                    selectedOutsideThisLine));

            if (orderedQty.compareTo(
                    availableQuoteQty) > 0) {

                throw badRequest(
                        "Ordered Qty cannot exceed remaining quoted "
                                + "quantity: "
                                + availableQuoteQty
                                + " "
                                + quoteLine.unit
                                + ".");
            }
        }

        BigDecimal unitRate = quoteLine != null
                ? quoteLine.unitRate
                : nonNegativeRate(
                        req.unitRate());

        BigDecimal discountPercent = quoteLine != null
                ? quoteLine.discountPercent
                : percentage(
                        req.discountPercent(),
                        "Discount Percent");

        BigDecimal taxPercent = quoteLine != null
                ? quoteLine.taxPercent
                : percentage(
                        req.taxPercent(),
                        "Tax Percent");

        String actor = access.currentUsername();

        MatFlowPurchaseOrderLine line = existing == null
                ? new MatFlowPurchaseOrderLine()
                : existing;

        if (existing == null) {

            line.purchaseOrderId = purchaseOrder.id;

            line.indentLineId = indentLine.id;

            line.requisitionLineId = indentLine.requisitionLineId;

            line.matFlowLineId = indentLine.matFlowLineId;

            line.sourceLineNo = indentLine.sourceLineNo;

            line.itemCode = indentLine.itemCode;

            line.itemName = indentLine.itemName;

            line.itemDescription = indentLine.itemDescription;

            line.specification = indentLine.specification;

            line.unit = indentLine.unit;

            line.createdBy = actor;

            line.active = true;
        }

        line.quoteLineId = quoteLine == null
                ? null
                : quoteLine.id;

        line.orderedQty = orderedQty;

        line.unitRate = unitRate;

        line.discountPercent = discountPercent;

        line.taxPercent = taxPercent;

        line.status = MatFlowPurchaseOrderLineStatus.DRAFT;

        line.remarks = clean(req.remarks());

        line.updatedBy = actor;

        calculatePurchaseOrderLineAmounts(
                line);

        MatFlowPurchaseOrderLine savedLine = purchaseOrderLineRepo.save(
                line);

        recalculatePurchaseOrderTotals(
                purchaseOrder,
                actor);

        if (quoteLine != null) {
            reconcileQuoteSelection(
                    quoteLine,
                    actor);
        }

        auditService.record(
                purchaseOrder.releaseId,
                "MATFLOW_PURCHASE_ORDER_LINE",
                savedLine.id,
                existing == null
                        ? "PURCHASE_ORDER_LINE_ADDED"
                        : "PURCHASE_ORDER_LINE_UPDATED",
                null,
                "Ordered Qty="
                        + savedLine.orderedQty
                        + ", Unit Rate="
                        + savedLine.unitRate
                        + ", Line Total="
                        + savedLine.lineTotal,
                actor);

        return detail(
                purchaseOrder.id);
    }

    public PurchaseOrderResponse removeLine(
            UUID purchaseOrderId,
            UUID purchaseOrderLineId,
            Long purchaseOrderRowVersion) {

        access.requirePurchase();

        require(
                purchaseOrderRowVersion,
                "PO rowVersion is required.");

        MatFlowPurchaseOrder purchaseOrder = getEditablePurchaseOrderForUpdate(
                purchaseOrderId);

        assertVersion(
                purchaseOrder.rowVersion,
                purchaseOrderRowVersion,
                "Purchase Order");

        MatFlowPurchaseOrderLine line = purchaseOrderLineRepo.findActiveLineForUpdate(
                purchaseOrder.id,
                purchaseOrderLineId)
                .orElseThrow(() -> notFound("Active Purchase Order line not found."));

        String actor = access.currentUsername();

        UUID quoteLineId = line.quoteLineId;

        line.active = false;

        line.status = MatFlowPurchaseOrderLineStatus.CANCELLED;

        line.updatedBy = actor;

        purchaseOrderLineRepo.saveAndFlush(
                line);

        recalculatePurchaseOrderTotals(
                purchaseOrder,
                actor);

        if (quoteLineId != null) {

            MatFlowVendorQuoteLine quoteLine = quoteLineRepo.findById(quoteLineId)
                    .orElse(null);

            if (quoteLine != null) {
                reconcileQuoteSelection(
                        quoteLine,
                        actor);
            }
        }

        auditService.record(
                purchaseOrder.releaseId,
                "MATFLOW_PURCHASE_ORDER_LINE",
                line.id,
                "PURCHASE_ORDER_LINE_REMOVED",
                "Ordered Qty="
                        + line.orderedQty,
                "Active=false",
                actor);

        return detail(
                purchaseOrder.id);
    }

    public PurchaseOrderResponse submitForApproval(
            UUID purchaseOrderId,
            PurchaseOrderActionRequest req) {

        access.requirePurchase();

        require(req, "Submit PO request body is required.");
        require(req.purchaseOrderRowVersion(), "PO rowVersion is required.");

        MatFlowPurchaseOrder purchaseOrder = getEditablePurchaseOrderForUpdate(
                purchaseOrderId);

        assertVersion(
                purchaseOrder.rowVersion,
                req.purchaseOrderRowVersion(),
                "Purchase Order");

        List<MatFlowPurchaseOrderLine> lines = purchaseOrderLineRepo
                .findActiveByPurchaseOrderIdForUpdate(
                        purchaseOrder.id);

        if (lines.isEmpty()) {
            throw badRequest(
                    "Add at least one Purchase Order line "
                            + "before submission.");
        }

        String actor = access.currentUsername();

        for (MatFlowPurchaseOrderLine line : lines) {

            if (line.orderedQty == null
                    || line.orderedQty.signum() <= 0) {

                throw badRequest(
                        "Every active PO line must have Ordered Qty "
                                + "greater than zero.");
            }

            line.status = MatFlowPurchaseOrderLineStatus.PENDING_APPROVAL;

            line.updatedBy = actor;

            purchaseOrderLineRepo.save(line);
        }

        purchaseOrder.status = MatFlowPurchaseOrderStatus.PENDING_APPROVAL;

        purchaseOrder.submittedBy = actor;

        purchaseOrder.submittedAt = LocalDateTime.now();

        purchaseOrder.returnedBy = null;

        purchaseOrder.returnedAt = null;

        purchaseOrder.returnRemarks = null;

        if (hasText(req.remarks())) {
            purchaseOrder.remarks = clean(req.remarks());
        }

        purchaseOrder.updatedBy = actor;

        MatFlowPurchaseOrder saved = purchaseOrderRepo.save(
                purchaseOrder);

        auditService.record(
                purchaseOrder.releaseId,
                "MATFLOW_PURCHASE_ORDER",
                purchaseOrder.id,
                "PURCHASE_ORDER_SUBMITTED_FOR_APPROVAL",
                "Status=DRAFT",
                "Status=PENDING_APPROVAL, Lines="
                        + lines.size(),
                actor);

        return mapper.toPurchaseOrderResponse(
                saved,
                lines);
    }

    public PurchaseOrderResponse approve(
            UUID purchaseOrderId,
            PurchaseOrderActionRequest req) {

        access.requirePurchaseApprover();

        require(req, "Approve PO request body is required.");
        require(req.purchaseOrderRowVersion(), "PO rowVersion is required.");

        MatFlowPurchaseOrder purchaseOrder = purchaseOrderRepo.findByIdForUpdate(
                purchaseOrderId)
                .orElseThrow(() -> notFound("Purchase Order not found."));

        access.assertPlantAccess(
                purchaseOrder.plantCode);

        assertVersion(
                purchaseOrder.rowVersion,
                req.purchaseOrderRowVersion(),
                "Purchase Order");

        if (purchaseOrder.status != MatFlowPurchaseOrderStatus.PENDING_APPROVAL) {

            throw badRequest(
                    "Only a Purchase Order pending approval "
                            + "can be approved.");
        }

        List<MatFlowPurchaseOrderLine> lines = purchaseOrderLineRepo
                .findActiveByPurchaseOrderIdForUpdate(
                        purchaseOrder.id);

        if (lines.isEmpty()) {
            throw badRequest(
                    "The Purchase Order has no active lines.");
        }

        String actor = access.currentUsername();

        purchaseOrder.status = MatFlowPurchaseOrderStatus.APPROVED;

        purchaseOrder.approvedBy = actor;

        purchaseOrder.approvedAt = LocalDateTime.now();

        purchaseOrder.updatedBy = actor;

        if (hasText(req.remarks())) {
            purchaseOrder.remarks = clean(req.remarks());
        }

        /*
         * Flush APPROVED status before aggregate queries.
         */
        MatFlowPurchaseOrder saved = purchaseOrderRepo.saveAndFlush(
                purchaseOrder);

        for (MatFlowPurchaseOrderLine line : lines) {

            line.status = MatFlowPurchaseOrderLineStatus.ORDERED;

            line.updatedBy = actor;

            purchaseOrderLineRepo.saveAndFlush(line);

            reconcileApprovedOrderedQuantities(
                    purchaseOrder,
                    line,
                    actor);
        }

        if (hasText(req.remarks())) {
            purchaseOrder.remarks = clean(req.remarks());
        }

        reconcileIndentStatus(
                purchaseOrder.indentId,
                actor);

        auditService.record(
                purchaseOrder.releaseId,
                "MATFLOW_PURCHASE_ORDER",
                purchaseOrder.id,
                "PURCHASE_ORDER_APPROVED",
                "Status=PENDING_APPROVAL",
                "Status=APPROVED, PO="
                        + purchaseOrder.poNo,
                actor);

        return mapper.toPurchaseOrderResponse(
                saved,
                lines);
    }

    public PurchaseOrderResponse returnForCorrection(
            UUID purchaseOrderId,
            PurchaseOrderActionRequest req) {

        access.requirePurchaseApprover();

        require(req, "Return PO request body is required.");
        require(req.purchaseOrderRowVersion(), "PO rowVersion is required.");
        requireText(req.remarks(), "Return remarks are required.");

        MatFlowPurchaseOrder purchaseOrder = purchaseOrderRepo.findByIdForUpdate(
                purchaseOrderId)
                .orElseThrow(() -> notFound("Purchase Order not found."));

        access.assertPlantAccess(
                purchaseOrder.plantCode);

        assertVersion(
                purchaseOrder.rowVersion,
                req.purchaseOrderRowVersion(),
                "Purchase Order");

        if (purchaseOrder.status != MatFlowPurchaseOrderStatus.PENDING_APPROVAL) {

            throw badRequest(
                    "Only a Purchase Order pending approval "
                            + "can be returned.");
        }

        List<MatFlowPurchaseOrderLine> lines = purchaseOrderLineRepo
                .findActiveByPurchaseOrderIdForUpdate(
                        purchaseOrder.id);

        String actor = access.currentUsername();

        for (MatFlowPurchaseOrderLine line : lines) {

            line.status = MatFlowPurchaseOrderLineStatus.DRAFT;

            line.updatedBy = actor;

            purchaseOrderLineRepo.save(line);
        }

        purchaseOrder.status = MatFlowPurchaseOrderStatus.RETURNED;

        purchaseOrder.returnedBy = actor;

        purchaseOrder.returnedAt = LocalDateTime.now();

        purchaseOrder.returnRemarks = clean(req.remarks());

        purchaseOrder.updatedBy = actor;

        MatFlowPurchaseOrder saved = purchaseOrderRepo.save(
                purchaseOrder);

        auditService.record(
                purchaseOrder.releaseId,
                "MATFLOW_PURCHASE_ORDER",
                purchaseOrder.id,
                "PURCHASE_ORDER_RETURNED",
                "Status=PENDING_APPROVAL",
                "Status=RETURNED, Reason="
                        + clean(req.remarks()),
                actor);

        return mapper.toPurchaseOrderResponse(
                saved,
                lines);
    }

    public PurchaseOrderResponse cancel(
            UUID purchaseOrderId,
            PurchaseOrderActionRequest req) {

        access.requirePurchase();

        require(req, "Cancel PO request body is required.");
        require(req.purchaseOrderRowVersion(), "PO rowVersion is required.");
        requireText(req.remarks(), "Cancellation reason is required.");

        MatFlowPurchaseOrder purchaseOrder = getEditablePurchaseOrderForUpdate(
                purchaseOrderId);

        assertVersion(
                purchaseOrder.rowVersion,
                req.purchaseOrderRowVersion(),
                "Purchase Order");

        List<MatFlowPurchaseOrderLine> lines = purchaseOrderLineRepo
                .findActiveByPurchaseOrderIdForUpdate(
                        purchaseOrder.id);

        String actor = access.currentUsername();

        for (MatFlowPurchaseOrderLine line : lines) {

            UUID quoteLineId = line.quoteLineId;

            line.active = false;

            line.status = MatFlowPurchaseOrderLineStatus.CANCELLED;

            line.updatedBy = actor;

            purchaseOrderLineRepo.saveAndFlush(
                    line);

            if (quoteLineId != null) {

                MatFlowVendorQuoteLine quoteLine = quoteLineRepo.findById(quoteLineId)
                        .orElse(null);

                if (quoteLine != null) {
                    reconcileQuoteSelection(
                            quoteLine,
                            actor);
                }
            }
        }

        purchaseOrder.status = MatFlowPurchaseOrderStatus.CANCELLED;

        purchaseOrder.cancelledBy = actor;

        purchaseOrder.cancelledAt = LocalDateTime.now();

        purchaseOrder.remarks = clean(req.remarks());

        purchaseOrder.updatedBy = actor;

        MatFlowPurchaseOrder saved = purchaseOrderRepo.save(
                purchaseOrder);

        auditService.record(
                purchaseOrder.releaseId,
                "MATFLOW_PURCHASE_ORDER",
                purchaseOrder.id,
                "PURCHASE_ORDER_CANCELLED",
                null,
                "Reason="
                        + clean(req.remarks()),
                actor);

        return mapper.toPurchaseOrderResponse(
                saved,
                List.of());
    }

    @Transactional(readOnly = true)
    public PurchaseOrderResponse detail(
            UUID purchaseOrderId) {

        access.requireMatFlowAccess();

        MatFlowPurchaseOrder purchaseOrder = purchaseOrderRepo.findById(
                purchaseOrderId)
                .orElseThrow(() -> notFound("Purchase Order not found."));

        access.assertPlantAccess(
                purchaseOrder.plantCode);

        List<MatFlowPurchaseOrderLine> lines = purchaseOrderLineRepo
                .findByPurchaseOrderIdAndActiveTrueOrderBySourceLineNoAsc(
                        purchaseOrder.id);

        return mapper.toPurchaseOrderResponse(
                purchaseOrder,
                lines);
    }

    @Transactional(readOnly = true)
    public List<PurchaseOrderResponse> byIndent(
            UUID indentId) {

        access.requireMatFlowAccess();

        MatFlowIndent indent = indentRepo.findById(indentId)
                .orElseThrow(() -> notFound("Material Indent not found."));

        access.assertPlantAccess(
                indent.plantCode);

        return purchaseOrderRepo
                .findByIndentIdOrderByCreatedAtDesc(
                        indentId)
                .stream()
                .map(purchaseOrder -> mapper.toPurchaseOrderResponse(
                        purchaseOrder,
                        purchaseOrderLineRepo
                                .findByPurchaseOrderIdAndActiveTrueOrderBySourceLineNoAsc(
                                        purchaseOrder.id)))
                .toList();
    }

    private MatFlowPurchaseOrder getEditablePurchaseOrderForUpdate(
            UUID purchaseOrderId) {

        MatFlowPurchaseOrder purchaseOrder = purchaseOrderRepo.findByIdForUpdate(
                purchaseOrderId)
                .orElseThrow(() -> notFound("Purchase Order not found."));

        access.assertPlantAccess(
                purchaseOrder.plantCode);

        boolean editable = purchaseOrder.status == MatFlowPurchaseOrderStatus.DRAFT
                || purchaseOrder.status == MatFlowPurchaseOrderStatus.RETURNED;

        if (!editable) {
            throw badRequest(
                    "Only a Draft or Returned Purchase Order "
                            + "can be modified.");
        }

        if (purchaseOrder.status == MatFlowPurchaseOrderStatus.RETURNED) {

            purchaseOrder.status = MatFlowPurchaseOrderStatus.DRAFT;

            purchaseOrder.returnedBy = null;
            purchaseOrder.returnedAt = null;
            purchaseOrder.returnRemarks = null;

            purchaseOrder.updatedBy = access.currentUsername();

            purchaseOrderRepo.save(
                    purchaseOrder);
        }

        return purchaseOrder;
    }

    private void reconcileQuoteSelection(
            MatFlowVendorQuoteLine quoteLine,
            String actor) {

        BigDecimal selectedQty = quantityZero(
                purchaseOrderLineRepo
                        .sumSelectedQtyByQuoteLineId(
                                quoteLine.id));

        quoteLine.selectedQty = selectedQty;

        if (selectedQty.signum() == 0) {

            quoteLine.status = MatFlowVendorQuoteLineStatus.SUBMITTED;

        } else if (selectedQty.compareTo(
                quoteLine.quotedQty) < 0) {

            quoteLine.status = MatFlowVendorQuoteLineStatus.PARTIALLY_SELECTED;

        } else {

            quoteLine.status = MatFlowVendorQuoteLineStatus.FULLY_SELECTED;
        }

        quoteLine.updatedBy = actor;

        quoteLineRepo.save(
                quoteLine);

        MatFlowVendorQuote quote = quoteRepo.findByIdForUpdate(
                quoteLine.quoteId)
                .orElseThrow(() -> notFound("Vendor Quote not found."));

        List<MatFlowVendorQuoteLine> lines = quoteLineRepo
                .findByQuoteIdAndActiveTrueOrderBySourceLineNoAsc(
                        quote.id);

        boolean anySelected = lines.stream()
                .anyMatch(line -> quantityZero(
                        line.selectedQty).signum() > 0);

        boolean everyFullySelected = !lines.isEmpty()
                && lines.stream()
                        .allMatch(line -> quantityZero(
                                line.selectedQty).compareTo(
                                        line.quotedQty) >= 0);

        if (everyFullySelected) {
            quote.status = MatFlowVendorQuoteStatus.FULLY_SELECTED;

        } else if (anySelected) {
            quote.status = MatFlowVendorQuoteStatus.PARTIALLY_SELECTED;

        } else {
            quote.status = MatFlowVendorQuoteStatus.SUBMITTED;
        }

        quote.updatedBy = actor;

        quoteRepo.save(
                quote);
    }

    private void reconcileApprovedOrderedQuantities(
            MatFlowPurchaseOrder purchaseOrder,
            MatFlowPurchaseOrderLine purchaseOrderLine,
            String actor) {

        List<MatFlowPurchaseOrderStatus> approvedStatuses = List.of(
                MatFlowPurchaseOrderStatus.APPROVED,
                MatFlowPurchaseOrderStatus.PARTIALLY_RECEIVED,
                MatFlowPurchaseOrderStatus.FULLY_RECEIVED,
                MatFlowPurchaseOrderStatus.CLOSED);

        MatFlowIndentLine indentLine = indentLineRepo.findActiveLineForUpdate(
                purchaseOrder.indentId,
                purchaseOrderLine.indentLineId)
                .orElseThrow(() -> notFound("Material Indent line not found."));

        BigDecimal approvedIndentOrdered = quantityZero(
                purchaseOrderLineRepo
                        .sumApprovedOrderedQtyByIndentLineId(
                                indentLine.id,
                                approvedStatuses));

        indentLine.orderedQty = approvedIndentOrdered;

        if (approvedIndentOrdered.compareTo(
                indentLine.indentQty) >= 0) {

            indentLine.status = MatFlowIndentLineStatus.FULLY_ORDERED;

        } else {

            indentLine.status = MatFlowIndentLineStatus.PARTIALLY_ORDERED;
        }

        indentLine.updatedBy = actor;

        indentLineRepo.save(
                indentLine);

        MatFlowLine matFlowLine = matFlowLineRepo.findActiveByIdForUpdate(
                purchaseOrder.releaseId,
                purchaseOrderLine.matFlowLineId)
                .orElseThrow(() -> notFound("MatFlow material line not found."));

        BigDecimal approvedMatFlowOrdered = quantityZero(
                purchaseOrderLineRepo
                        .sumApprovedOrderedQtyByMatFlowLineId(
                                matFlowLine.id,
                                approvedStatuses));

        matFlowLine.orderedQty = approvedMatFlowOrdered;

        matFlowLine.status = MatFlowLineStatus.PROCUREMENT_IN_PROGRESS;

        matFlowLine.updatedBy = actor;

        matFlowLineRepo.save(
                matFlowLine);
    }

    private void reconcileIndentStatus(
            UUID indentId,
            String actor) {

        MatFlowIndent indent = indentRepo.findByIdForUpdate(indentId)
                .orElseThrow(() -> notFound("Material Indent not found."));

        List<MatFlowIndentLine> lines = indentLineRepo
                .findByIndentIdAndActiveTrueOrderBySourceLineNoAsc(
                        indent.id);

        boolean everyFullyOrdered = !lines.isEmpty()
                && lines.stream()
                        .allMatch(line -> quantityZero(
                                line.orderedQty).compareTo(
                                        line.indentQty) >= 0);

        boolean anyOrdered = lines.stream()
                .anyMatch(line -> quantityZero(
                        line.orderedQty).signum() > 0);

        if (everyFullyOrdered) {

            indent.status = MatFlowIndentStatus.FULLY_ORDERED;

        } else if (anyOrdered) {

            indent.status = MatFlowIndentStatus.PARTIALLY_ORDERED;

        } else {

            indent.status = MatFlowIndentStatus.PURCHASE_REVIEW_IN_PROGRESS;
        }

        indent.updatedBy = actor;

        indentRepo.save(
                indent);
    }

    private void calculatePurchaseOrderLineAmounts(
            MatFlowPurchaseOrderLine line) {

        BigDecimal subtotal = line.orderedQty
                .multiply(line.unitRate)
                .setScale(
                        2,
                        RoundingMode.HALF_UP);

        BigDecimal discount = subtotal
                .multiply(line.discountPercent)
                .divide(
                        BigDecimal.valueOf(100),
                        2,
                        RoundingMode.HALF_UP);

        BigDecimal taxable = subtotal
                .subtract(discount)
                .setScale(
                        2,
                        RoundingMode.HALF_UP);

        BigDecimal tax = taxable
                .multiply(line.taxPercent)
                .divide(
                        BigDecimal.valueOf(100),
                        2,
                        RoundingMode.HALF_UP);

        line.lineSubtotal = subtotal;
        line.discountAmount = discount;
        line.taxableAmount = taxable;
        line.taxAmount = tax;

        line.lineTotal = taxable.add(tax)
                .setScale(
                        2,
                        RoundingMode.HALF_UP);
    }

    private void recalculatePurchaseOrderTotals(
            MatFlowPurchaseOrder purchaseOrder,
            String actor) {

        List<MatFlowPurchaseOrderLine> lines = purchaseOrderLineRepo
                .findByPurchaseOrderIdAndActiveTrueOrderBySourceLineNoAsc(
                        purchaseOrder.id);

        purchaseOrder.subtotalAmount = lines.stream()
                .map(line -> line.lineSubtotal)
                .reduce(
                        BigDecimal.ZERO,
                        BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        purchaseOrder.discountAmount = lines.stream()
                .map(line -> line.discountAmount)
                .reduce(
                        BigDecimal.ZERO,
                        BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        purchaseOrder.taxAmount = lines.stream()
                .map(line -> line.taxAmount)
                .reduce(
                        BigDecimal.ZERO,
                        BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        BigDecimal lineTotal = lines.stream()
                .map(line -> line.lineTotal)
                .reduce(
                        BigDecimal.ZERO,
                        BigDecimal::add);

        purchaseOrder.grandTotal = lineTotal
                .add(nonNegativeMoney(
                        purchaseOrder.freightAmount))
                .add(nonNegativeMoney(
                        purchaseOrder.otherChargesAmount))
                .setScale(
                        2,
                        RoundingMode.HALF_UP);

        purchaseOrder.updatedBy = actor;

        purchaseOrderRepo.save(
                purchaseOrder);
    }

    private void assertPurchaseOpen(
            MatFlowIndent indent) {

        boolean allowed = indent.status == MatFlowIndentStatus.SUBMITTED_TO_PURCHASE
                || indent.status == MatFlowIndentStatus.PURCHASE_REVIEW_IN_PROGRESS
                || indent.status == MatFlowIndentStatus.PARTIALLY_ORDERED;

        if (!allowed) {
            throw badRequest(
                    "The Material Indent is not open for Purchase Order creation.");
        }
    }

    private void assertVersion(
            Long actual,
            Long supplied,
            String label) {

        if (!Objects.equals(actual, supplied)) {
            throw conflict(
                    label
                            + " was updated by another user. "
                            + "Reload before continuing.");
        }
    }

    private BigDecimal positiveQuantity(
            BigDecimal value,
            String message) {

        require(value, message);

        if (value.signum() <= 0) {
            throw badRequest(message);
        }

        if (value.stripTrailingZeros().scale() > 3) {
            throw badRequest(
                    "Quantity can have a maximum of 3 decimal places.");
        }

        return value.setScale(
                3,
                RoundingMode.UNNECESSARY);
    }

    private BigDecimal nonNegativeRate(
            BigDecimal value) {

        BigDecimal clean = value == null
                ? BigDecimal.ZERO
                : value;

        if (clean.signum() < 0) {
            throw badRequest(
                    "Unit Rate cannot be negative.");
        }

        return clean.setScale(
                4,
                RoundingMode.HALF_UP);
    }

    private BigDecimal nonNegativeMoney(
            BigDecimal value) {

        BigDecimal clean = value == null
                ? BigDecimal.ZERO
                : value;

        if (clean.signum() < 0) {
            throw badRequest(
                    "Amount cannot be negative.");
        }

        return clean.setScale(
                2,
                RoundingMode.HALF_UP);
    }

    private BigDecimal percentage(
            BigDecimal value,
            String label) {

        BigDecimal clean = value == null
                ? BigDecimal.ZERO
                : value;

        if (clean.signum() < 0
                || clean.compareTo(
                        BigDecimal.valueOf(100)) > 0) {

            throw badRequest(
                    label
                            + " must be between 0 and 100.");
        }

        return clean.setScale(
                3,
                RoundingMode.HALF_UP);
    }

    private BigDecimal quantityZero(
            BigDecimal value) {

        return value == null
                ? BigDecimal.ZERO.setScale(3)
                : value;
    }

    private BigDecimal zeroQuantity() {

        return BigDecimal.ZERO.setScale(3);
    }

    private BigDecimal maxZero(
            BigDecimal value) {

        return value == null
                || value.signum() < 0
                        ? zeroQuantity()
                        : value;
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
}