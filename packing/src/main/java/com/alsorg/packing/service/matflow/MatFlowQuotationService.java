package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowPurchaseDtos.CreateVendorQuoteRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPurchaseDtos.PurchaseQueueResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPurchaseDtos.QuoteActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPurchaseDtos.QuoteComparisonResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPurchaseDtos.SaveVendorQuoteLineRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPurchaseDtos.VendorQuoteResponse;

import com.alsorg.packing.domain.matflow.MatFlowIndent;
import com.alsorg.packing.domain.matflow.MatFlowIndentLine;
import com.alsorg.packing.domain.matflow.MatFlowIndentStatus;
import com.alsorg.packing.domain.matflow.MatFlowVendorQuote;
import com.alsorg.packing.domain.matflow.MatFlowVendorQuoteLine;
import com.alsorg.packing.domain.matflow.MatFlowVendorQuoteLineStatus;
import com.alsorg.packing.domain.matflow.MatFlowVendorQuoteStatus;

import com.alsorg.packing.repository.matflow.MatFlowIndentLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowIndentRepository;
import com.alsorg.packing.repository.matflow.MatFlowPurchaseOrderLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowVendorQuoteLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowVendorQuoteRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
@Transactional
public class MatFlowQuotationService {

    private final MatFlowIndentRepository indentRepo;
    private final MatFlowIndentLineRepository indentLineRepo;

    private final MatFlowVendorQuoteRepository quoteRepo;
    private final MatFlowVendorQuoteLineRepository quoteLineRepo;

    private final MatFlowPurchaseOrderLineRepository purchaseOrderLineRepo;

    private final MatFlowAccessService access;
    private final MatFlowAuditService auditService;
    private final MatFlowPurchaseMapper mapper;

    public MatFlowQuotationService(
            MatFlowIndentRepository indentRepo,
            MatFlowIndentLineRepository indentLineRepo,
            MatFlowVendorQuoteRepository quoteRepo,
            MatFlowVendorQuoteLineRepository quoteLineRepo,
            MatFlowPurchaseOrderLineRepository purchaseOrderLineRepo,
            MatFlowAccessService access,
            MatFlowAuditService auditService,
            MatFlowPurchaseMapper mapper) {

        this.indentRepo = indentRepo;
        this.indentLineRepo = indentLineRepo;

        this.quoteRepo = quoteRepo;
        this.quoteLineRepo = quoteLineRepo;

        this.purchaseOrderLineRepo =
                purchaseOrderLineRepo;

        this.access = access;
        this.auditService = auditService;
        this.mapper = mapper;
    }

    public VendorQuoteResponse createDraft(
            CreateVendorQuoteRequest req) {

        access.requirePurchase();

        require(req, "Vendor Quote request body is required.");
        require(req.indentId(), "Indent ID is required.");
        require(req.indentRowVersion(), "Indent rowVersion is required.");

        requireText(req.vendorName(), "Vendor Name is required.");
        requireText(req.quoteNo(), "Vendor Quote No. is required.");
        require(req.quoteDate(), "Quote Date is required.");

        MatFlowIndent indent =
                indentRepo.findByIdForUpdate(req.indentId())
                        .orElseThrow(() ->
                                notFound("Material Indent not found.")
                        );

        access.assertPlantAccess(indent.plantCode);

        assertVersion(
                indent.rowVersion,
                req.indentRowVersion(),
                "Material Indent"
        );

        assertPurchaseOpen(indent);

        if (req.validUntil() != null
                && req.validUntil().isBefore(req.quoteDate())) {

            throw badRequest(
                    "Quote Valid Until date cannot be before Quote Date."
            );
        }

        String actor =
                access.currentUsername();

        MatFlowVendorQuote quote =
                new MatFlowVendorQuote();

        quote.indentId = indent.id;
        quote.releaseId = indent.releaseId;
        quote.requisitionId = indent.requisitionId;

        quote.indentNo = indent.indentNo;
        quote.plantCode = indent.plantCode;
        quote.pdNo = indent.pdNo;

        quote.vendorId = req.vendorId();
        quote.vendorName = clean(req.vendorName());
        quote.vendorGstin = clean(req.vendorGstin());
        quote.vendorAddress = clean(req.vendorAddress());

        quote.quoteNo = clean(req.quoteNo());
        quote.quoteDate = req.quoteDate();
        quote.validUntil = req.validUntil();

        quote.currencyCode =
                hasText(req.currencyCode())
                        ? cleanUpper(req.currencyCode())
                        : "INR";

        quote.quoteAttachmentId =
                req.quoteAttachmentId();

        quote.paymentTerms =
                clean(req.paymentTerms());

        quote.deliveryTerms =
                clean(req.deliveryTerms());

        quote.freightAmount =
                nonNegativeMoney(req.freightAmount());

        quote.otherChargesAmount =
                nonNegativeMoney(req.otherChargesAmount());

        quote.status =
                MatFlowVendorQuoteStatus.DRAFT;

        quote.remarks =
                clean(req.remarks());

        quote.createdBy = actor;
        quote.updatedBy = actor;

        MatFlowVendorQuote saved =
                quoteRepo.save(quote);

        if (indent.status
                == MatFlowIndentStatus.SUBMITTED_TO_PURCHASE) {

            indent.status =
                    MatFlowIndentStatus.PURCHASE_REVIEW_IN_PROGRESS;

            indent.updatedBy =
                    actor;

            indentRepo.save(indent);
        }

        auditService.record(
                indent.releaseId,
                "MATFLOW_VENDOR_QUOTE",
                saved.id,
                "VENDOR_QUOTE_DRAFT_CREATED",
                null,
                "Vendor="
                        + saved.vendorName
                        + ", Quote="
                        + saved.quoteNo,
                actor
        );

        return mapper.toQuoteResponse(
                saved,
                List.of()
        );
    }

    public VendorQuoteResponse saveLine(
            UUID quoteId,
            SaveVendorQuoteLineRequest req) {

        access.requirePurchase();

        require(req, "Vendor Quote line request body is required.");
        require(req.indentLineId(), "Indent Line ID is required.");
        require(req.quoteRowVersion(), "Quote rowVersion is required.");
        require(req.indentLineRowVersion(), "Indent line rowVersion is required.");

        BigDecimal quotedQty =
                positiveQuantity(
                        req.quotedQty(),
                        "Quoted Qty must be greater than zero."
                );

        BigDecimal unitRate =
                nonNegativeRate(req.unitRate());

        BigDecimal discountPercent =
                percentage(req.discountPercent(), "Discount Percent");

        BigDecimal taxPercent =
                percentage(req.taxPercent(), "Tax Percent");

        MatFlowVendorQuote quote =
                getEditableQuoteForUpdate(quoteId);

        assertVersion(
                quote.rowVersion,
                req.quoteRowVersion(),
                "Vendor Quote"
        );

        MatFlowIndentLine indentLine =
                indentLineRepo.findActiveLineForUpdate(
                                quote.indentId,
                                req.indentLineId()
                        )
                        .orElseThrow(() ->
                                notFound("Active Material Indent line not found.")
                        );

        assertVersion(
                indentLine.rowVersion,
                req.indentLineRowVersion(),
                "Material Indent line"
        );

        if (quotedQty.compareTo(indentLine.indentQty) > 0) {
            throw badRequest(
                    "Quoted Qty cannot exceed Indent Qty: "
                            + indentLine.indentQty
                            + " "
                            + indentLine.unit
                            + "."
            );
        }

        if (req.leadTimeDays() != null
                && req.leadTimeDays() < 0) {

            throw badRequest(
                    "Lead Time Days cannot be negative."
            );
        }

        MatFlowVendorQuoteLine existing =
                quoteLineRepo
                        .findByQuoteIdAndIndentLineIdAndActiveTrue(
                                quote.id,
                                indentLine.id
                        )
                        .orElse(null);

        if (existing != null) {

            require(
                    req.quoteLineRowVersion(),
                    "Quote Line rowVersion is required when "
                            + "updating an existing line."
            );

            assertVersion(
                    existing.rowVersion,
                    req.quoteLineRowVersion(),
                    "Vendor Quote line"
            );

            if (quantityZero(existing.selectedQty).signum() > 0) {
                throw badRequest(
                        "A quotation line already selected in a Purchase "
                                + "Order cannot be edited."
                );
            }
        }

        String actor =
                access.currentUsername();

        MatFlowVendorQuoteLine line =
                existing == null
                        ? new MatFlowVendorQuoteLine()
                        : existing;

        if (existing == null) {

            line.quoteId = quote.id;
            line.indentLineId = indentLine.id;
            line.requisitionLineId =
                    indentLine.requisitionLineId;

            line.matFlowLineId =
                    indentLine.matFlowLineId;

            line.sourceLineNo =
                    indentLine.sourceLineNo;

            line.itemCode =
                    indentLine.itemCode;

            line.itemName =
                    indentLine.itemName;

            line.itemDescription =
                    indentLine.itemDescription;

            line.specification =
                    indentLine.specification;

            line.unit =
                    indentLine.unit;

            line.createdBy =
                    actor;

            line.active =
                    true;
        }

        line.quotedQty =
                quotedQty;

        line.unitRate =
                unitRate;

        line.discountPercent =
                discountPercent;

        line.taxPercent =
                taxPercent;

        line.leadTimeDays =
                req.leadTimeDays();

        line.promisedDeliveryDate =
                req.promisedDeliveryDate();

        line.status =
                MatFlowVendorQuoteLineStatus.DRAFT;

        line.remarks =
                clean(req.remarks());

        line.updatedBy =
                actor;

        calculateQuoteLineAmounts(line);

        MatFlowVendorQuoteLine savedLine =
                quoteLineRepo.save(line);

        recalculateQuoteTotals(
                quote,
                actor
        );

        auditService.record(
                quote.releaseId,
                "MATFLOW_VENDOR_QUOTE_LINE",
                savedLine.id,
                existing == null
                        ? "VENDOR_QUOTE_LINE_ADDED"
                        : "VENDOR_QUOTE_LINE_UPDATED",
                null,
                "Quoted Qty="
                        + savedLine.quotedQty
                        + ", Unit Rate="
                        + savedLine.unitRate
                        + ", Line Total="
                        + savedLine.lineTotal,
                actor
        );

        return detail(quote.id);
    }

    public VendorQuoteResponse submit(
            UUID quoteId,
            QuoteActionRequest req) {

        access.requirePurchase();

        require(req, "Submit Vendor Quote request body is required.");
        require(req.quoteRowVersion(), "Quote rowVersion is required.");

        MatFlowVendorQuote quote =
                getEditableQuoteForUpdate(quoteId);

        assertVersion(
                quote.rowVersion,
                req.quoteRowVersion(),
                "Vendor Quote"
        );

        List<MatFlowVendorQuoteLine> lines =
                quoteLineRepo.findActiveByQuoteIdForUpdate(
                        quote.id
                );

        if (lines.isEmpty()) {
            throw badRequest(
                    "Add at least one quotation line before submission."
            );
        }

        String actor =
                access.currentUsername();

        for (MatFlowVendorQuoteLine line : lines) {

            if (line.quotedQty == null
                    || line.quotedQty.signum() <= 0) {

                throw badRequest(
                        "Every quotation line must have Quoted Qty "
                                + "greater than zero."
                );
            }

            line.status =
                    MatFlowVendorQuoteLineStatus.SUBMITTED;

            line.updatedBy =
                    actor;

            quoteLineRepo.save(line);
        }

        quote.status =
                MatFlowVendorQuoteStatus.SUBMITTED;

        quote.submittedBy =
                actor;

        quote.submittedAt =
                LocalDateTime.now();

        if (hasText(req.remarks())) {
            quote.remarks =
                    clean(req.remarks());
        }

        quote.updatedBy =
                actor;

        MatFlowVendorQuote saved =
                quoteRepo.save(quote);

        auditService.record(
                quote.releaseId,
                "MATFLOW_VENDOR_QUOTE",
                quote.id,
                "VENDOR_QUOTE_SUBMITTED",
                "Status=DRAFT",
                "Status=SUBMITTED, Lines="
                        + lines.size(),
                actor
        );

        return mapper.toQuoteResponse(
                saved,
                lines
        );
    }

    public VendorQuoteResponse cancel(
            UUID quoteId,
            QuoteActionRequest req) {

        access.requirePurchase();

        require(req, "Cancel Vendor Quote request body is required.");
        require(req.quoteRowVersion(), "Quote rowVersion is required.");
        requireText(req.remarks(), "Cancellation reason is required.");

        MatFlowVendorQuote quote =
                getEditableQuoteForUpdate(quoteId);

        assertVersion(
                quote.rowVersion,
                req.quoteRowVersion(),
                "Vendor Quote"
        );

        List<MatFlowVendorQuoteLine> lines =
                quoteLineRepo.findActiveByQuoteIdForUpdate(
                        quote.id
                );

        for (MatFlowVendorQuoteLine line : lines) {

            if (quantityZero(line.selectedQty).signum() > 0) {
                throw badRequest(
                        "The Vendor Quote cannot be cancelled because "
                                + "one or more lines are selected in a PO."
                );
            }
        }

        String actor =
                access.currentUsername();

        for (MatFlowVendorQuoteLine line : lines) {

            line.active = false;
            line.status =
                    MatFlowVendorQuoteLineStatus.CANCELLED;

            line.updatedBy =
                    actor;

            quoteLineRepo.save(line);
        }

        quote.status =
                MatFlowVendorQuoteStatus.CANCELLED;

        quote.remarks =
                clean(req.remarks());

        quote.updatedBy =
                actor;

        MatFlowVendorQuote saved =
                quoteRepo.save(quote);

        auditService.record(
                quote.releaseId,
                "MATFLOW_VENDOR_QUOTE",
                quote.id,
                "VENDOR_QUOTE_CANCELLED",
                null,
                "Reason="
                        + clean(req.remarks()),
                actor
        );

        return mapper.toQuoteResponse(
                saved,
                List.of()
        );
    }

    @Transactional(readOnly = true)
    public VendorQuoteResponse detail(
            UUID quoteId) {

        access.requireMatFlowAccess();

        MatFlowVendorQuote quote =
                quoteRepo.findById(quoteId)
                        .orElseThrow(() ->
                                notFound("Vendor Quote not found.")
                        );

        access.assertPlantAccess(
                quote.plantCode
        );

        List<MatFlowVendorQuoteLine> lines =
                quoteLineRepo
                        .findByQuoteIdAndActiveTrueOrderBySourceLineNoAsc(
                                quote.id
                        );

        return mapper.toQuoteResponse(
                quote,
                lines
        );
    }

    @Transactional(readOnly = true)
    public QuoteComparisonResponse comparison(
            UUID indentId) {

        access.requireMatFlowAccess();

        MatFlowIndent indent =
                indentRepo.findById(indentId)
                        .orElseThrow(() ->
                                notFound("Material Indent not found.")
                        );

        access.assertPlantAccess(
                indent.plantCode
        );

        List<VendorQuoteResponse> quotes =
                quoteRepo
                        .findByIndentIdOrderByGrandTotalAscCreatedAtAsc(
                                indentId
                        )
                        .stream()
                        .map(quote ->
                                mapper.toQuoteResponse(
                                        quote,
                                        quoteLineRepo
                                                .findByQuoteIdAndActiveTrueOrderBySourceLineNoAsc(
                                                        quote.id
                                                )
                                )
                        )
                        .toList();

        return new QuoteComparisonResponse(
                indent.id,
                indent.indentNo,
                quotes
        );
    }

    @Transactional(readOnly = true)
    public List<PurchaseQueueResponse> pendingPurchaseQueue(
            String plantCode) {

        access.requirePurchase();

        List<MatFlowIndentStatus> statuses =
                List.of(
                        MatFlowIndentStatus.SUBMITTED_TO_PURCHASE,
                        MatFlowIndentStatus.PURCHASE_REVIEW_IN_PROGRESS,
                        MatFlowIndentStatus.PARTIALLY_ORDERED
                );

        List<MatFlowIndent> indents;

        if (hasText(plantCode)) {

            access.assertPlantAccess(
                    plantCode
            );

            indents =
                    indentRepo
                            .findByPlantCodeIgnoreCaseAndStatusInOrderByRequiredByDateAscSubmittedAtAsc(
                                    plantCode.trim(),
                                    statuses
                            );

        } else {

            indents =
                    indentRepo
                            .findByStatusInOrderByRequiredByDateAscSubmittedAtAsc(
                                    statuses
                            );
        }

        List<PurchaseQueueResponse> result =
                new ArrayList<>();

        for (MatFlowIndent indent : indents) {

            try {
                access.assertPlantAccess(
                        indent.plantCode
                );

                List<MatFlowIndentLine> lines =
                        indentLineRepo
                                .findByIndentIdAndActiveTrueOrderBySourceLineNoAsc(
                                        indent.id
                                );

                BigDecimal totalIndentQty =
                        lines.stream()
                                .map(line ->
                                        quantityZero(
                                                line.indentQty
                                        )
                                )
                                .reduce(
                                        BigDecimal.ZERO,
                                        BigDecimal::add
                                );

                BigDecimal approvedOrderedQty =
                        lines.stream()
                                .map(line ->
                                        quantityZero(
                                                line.orderedQty
                                        )
                                )
                                .reduce(
                                        BigDecimal.ZERO,
                                        BigDecimal::add
                                );

                BigDecimal remaining =
                        maxZero(
                                totalIndentQty
                                        .subtract(
                                                approvedOrderedQty
                                        )
                        );

                result.add(
                        new PurchaseQueueResponse(
                                indent.id,
                                indent.indentNo,
                                indent.requisitionId,
                                indent.requisitionNo,

                                indent.plantCode,
                                indent.pdNo,
                                indent.clientName,
                                indent.productName,

                                indent.requiredByDate,
                                indent.status,

                                lines.size(),
                                totalIndentQty,
                                approvedOrderedQty,
                                remaining,

                                indent.submittedBy,
                                indent.submittedAt,

                                indent.rowVersion
                        )
                );

            } catch (ResponseStatusException ex) {

                if (ex.getStatusCode()
                        != HttpStatus.FORBIDDEN) {

                    throw ex;
                }
            }
        }

        return result;
    }

    private MatFlowVendorQuote getEditableQuoteForUpdate(
            UUID quoteId) {

        MatFlowVendorQuote quote =
                quoteRepo.findByIdForUpdate(quoteId)
                        .orElseThrow(() ->
                                notFound("Vendor Quote not found.")
                        );

        access.assertPlantAccess(
                quote.plantCode
        );

        if (quote.status
                != MatFlowVendorQuoteStatus.DRAFT) {

            throw badRequest(
                    "Only a Draft Vendor Quote can be modified."
            );
        }

        if (quote.validUntil != null
                && quote.validUntil.isBefore(LocalDate.now())) {

            quote.status =
                    MatFlowVendorQuoteStatus.EXPIRED;

            quote.updatedBy =
                    access.currentUsername();

            quoteRepo.save(quote);

            throw badRequest(
                    "The Vendor Quote has expired."
            );
        }

        return quote;
    }

    private void assertPurchaseOpen(
            MatFlowIndent indent) {

        boolean allowed =
                indent.status
                        == MatFlowIndentStatus.SUBMITTED_TO_PURCHASE
                        || indent.status
                        == MatFlowIndentStatus.PURCHASE_REVIEW_IN_PROGRESS
                        || indent.status
                        == MatFlowIndentStatus.PARTIALLY_ORDERED;

        if (!allowed) {
            throw badRequest(
                    "The Material Indent is not open for Purchase review."
            );
        }
    }

    private void calculateQuoteLineAmounts(
            MatFlowVendorQuoteLine line) {

        BigDecimal subtotal =
                line.quotedQty
                        .multiply(line.unitRate)
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal discount =
                subtotal
                        .multiply(line.discountPercent)
                        .divide(
                                BigDecimal.valueOf(100),
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal taxable =
                subtotal
                        .subtract(discount)
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal tax =
                taxable
                        .multiply(line.taxPercent)
                        .divide(
                                BigDecimal.valueOf(100),
                                2,
                                RoundingMode.HALF_UP
                        );

        line.lineSubtotal = subtotal;
        line.discountAmount = discount;
        line.taxableAmount = taxable;
        line.taxAmount = tax;
        line.lineTotal =
                taxable.add(tax)
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );
    }

    private void recalculateQuoteTotals(
            MatFlowVendorQuote quote,
            String actor) {

        List<MatFlowVendorQuoteLine> lines =
                quoteLineRepo
                        .findByQuoteIdAndActiveTrueOrderBySourceLineNoAsc(
                                quote.id
                        );

        quote.subtotalAmount =
                lines.stream()
                        .map(line -> line.lineSubtotal)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(2, RoundingMode.HALF_UP);

        quote.discountAmount =
                lines.stream()
                        .map(line -> line.discountAmount)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(2, RoundingMode.HALF_UP);

        quote.taxAmount =
                lines.stream()
                        .map(line -> line.taxAmount)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(2, RoundingMode.HALF_UP);

        BigDecimal lineTotals =
                lines.stream()
                        .map(line -> line.lineTotal)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        quote.grandTotal =
                lineTotals
                        .add(nonNegativeMoney(
                                quote.freightAmount
                        ))
                        .add(nonNegativeMoney(
                                quote.otherChargesAmount
                        ))
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        quote.updatedBy = actor;

        quoteRepo.save(quote);
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

        if (value.signum() <= 0) {
            throw badRequest(message);
        }

        return normalizeQuantity(value);
    }

    private BigDecimal normalizeQuantity(
            BigDecimal value) {

        if (value.stripTrailingZeros().scale() > 3) {
            throw badRequest(
                    "Quantity can have a maximum of 3 decimal places."
            );
        }

        return value.setScale(
                3,
                RoundingMode.UNNECESSARY
        );
    }

    private BigDecimal nonNegativeRate(
            BigDecimal value) {

        BigDecimal clean =
                value == null
                        ? BigDecimal.ZERO
                        : value;

        if (clean.signum() < 0) {
            throw badRequest(
                    "Unit Rate cannot be negative."
            );
        }

        return clean.setScale(
                4,
                RoundingMode.HALF_UP
        );
    }

    private BigDecimal nonNegativeMoney(
            BigDecimal value) {

        BigDecimal clean =
                value == null
                        ? BigDecimal.ZERO
                        : value;

        if (clean.signum() < 0) {
            throw badRequest(
                    "Amount cannot be negative."
            );
        }

        return clean.setScale(
                2,
                RoundingMode.HALF_UP
        );
    }

    private BigDecimal percentage(
            BigDecimal value,
            String label) {

        BigDecimal clean =
                value == null
                        ? BigDecimal.ZERO
                        : value;

        if (clean.signum() < 0
                || clean.compareTo(
                BigDecimal.valueOf(100)) > 0) {

            throw badRequest(
                    label
                            + " must be between 0 and 100."
            );
        }

        return clean.setScale(
                3,
                RoundingMode.HALF_UP
        );
    }

    private BigDecimal quantityZero(
            BigDecimal value) {

        return value == null
                ? BigDecimal.ZERO.setScale(3)
                : value;
    }

    private BigDecimal maxZero(
            BigDecimal value) {

        return value == null
                || value.signum() < 0
                ? BigDecimal.ZERO.setScale(3)
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