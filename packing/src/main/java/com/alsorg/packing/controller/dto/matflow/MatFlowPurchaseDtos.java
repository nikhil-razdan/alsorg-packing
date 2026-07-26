package com.alsorg.packing.controller.dto.matflow;

import com.alsorg.packing.domain.bomflow.MaterialUnit;
import com.alsorg.packing.domain.matflow.MatFlowIndentLineStatus;
import com.alsorg.packing.domain.matflow.MatFlowIndentStatus;
import com.alsorg.packing.domain.matflow.MatFlowPurchaseOrderLineStatus;
import com.alsorg.packing.domain.matflow.MatFlowPurchaseOrderStatus;
import com.alsorg.packing.domain.matflow.MatFlowVendorQuoteLineStatus;
import com.alsorg.packing.domain.matflow.MatFlowVendorQuoteStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class MatFlowPurchaseDtos {

    private MatFlowPurchaseDtos() {
    }

    public record CreateVendorQuoteRequest(
            UUID indentId,

            UUID vendorId,
            String vendorName,
            String vendorGstin,
            String vendorAddress,

            String quoteNo,
            LocalDate quoteDate,
            LocalDate validUntil,

            String currencyCode,
            UUID quoteAttachmentId,

            String paymentTerms,
            String deliveryTerms,

            BigDecimal freightAmount,
            BigDecimal otherChargesAmount,

            String remarks,
            Long indentRowVersion) {
    }

    public record SaveVendorQuoteLineRequest(
            UUID indentLineId,

            BigDecimal quotedQty,
            BigDecimal unitRate,
            BigDecimal discountPercent,
            BigDecimal taxPercent,

            Integer leadTimeDays,
            LocalDate promisedDeliveryDate,

            String remarks,

            Long quoteRowVersion,
            Long indentLineRowVersion,
            Long quoteLineRowVersion) {
    }

    public record QuoteActionRequest(
            Long quoteRowVersion,
            String remarks) {
    }

    public record CreatePurchaseOrderRequest(
            UUID indentId,
            UUID quoteId,

            UUID vendorId,
            String vendorName,
            String vendorGstin,
            String vendorAddress,

            LocalDate poDate,
            LocalDate expectedDeliveryDate,

            String currencyCode,
            String paymentTerms,
            String deliveryTerms,
            String deliveryAddress,

            UUID poAttachmentId,

            BigDecimal freightAmount,
            BigDecimal otherChargesAmount,

            String remarks,

            Long indentRowVersion,
            Long quoteRowVersion) {
    }

    public record SavePurchaseOrderLineRequest(
            UUID indentLineId,
            UUID quoteLineId,

            BigDecimal orderedQty,
            BigDecimal unitRate,
            BigDecimal discountPercent,
            BigDecimal taxPercent,

            String remarks,

            Long purchaseOrderRowVersion,
            Long indentLineRowVersion,
            Long matFlowLineRowVersion,
            Long quoteLineRowVersion,
            Long purchaseOrderLineRowVersion) {
    }

    public record PurchaseOrderActionRequest(
            Long purchaseOrderRowVersion,
            String remarks) {
    }

    public record VendorQuoteLineResponse(
            UUID id,
            UUID indentLineId,
            UUID requisitionLineId,
            UUID matFlowLineId,

            Integer sourceLineNo,
            String itemCode,
            String itemName,
            String itemDescription,
            String specification,

            BigDecimal quotedQty,
            BigDecimal selectedQty,
            MaterialUnit unit,

            BigDecimal unitRate,
            BigDecimal discountPercent,
            BigDecimal taxPercent,

            BigDecimal lineSubtotal,
            BigDecimal discountAmount,
            BigDecimal taxableAmount,
            BigDecimal taxAmount,
            BigDecimal lineTotal,

            Integer leadTimeDays,
            LocalDate promisedDeliveryDate,

            MatFlowVendorQuoteLineStatus status,
            String remarks,
            Long rowVersion) {
    }

    public record VendorQuoteResponse(
            UUID id,
            UUID indentId,
            UUID releaseId,
            UUID requisitionId,

            String indentNo,
            String plantCode,
            String pdNo,

            UUID vendorId,
            String vendorName,
            String vendorGstin,
            String vendorAddress,

            String quoteNo,
            LocalDate quoteDate,
            LocalDate validUntil,

            String currencyCode,
            UUID quoteAttachmentId,

            String paymentTerms,
            String deliveryTerms,

            BigDecimal freightAmount,
            BigDecimal otherChargesAmount,
            BigDecimal subtotalAmount,
            BigDecimal discountAmount,
            BigDecimal taxAmount,
            BigDecimal grandTotal,

            MatFlowVendorQuoteStatus status,

            String remarks,
            String createdBy,
            LocalDateTime createdAt,
            String submittedBy,
            LocalDateTime submittedAt,

            Long rowVersion,
            List<VendorQuoteLineResponse> lines) {
    }

    public record PurchaseOrderLineResponse(
            UUID id,
            UUID indentLineId,
            UUID requisitionLineId,
            UUID matFlowLineId,
            UUID quoteLineId,

            Integer sourceLineNo,
            String itemCode,
            String itemName,
            String itemDescription,
            String specification,

            BigDecimal orderedQty,
            BigDecimal receivedQty,
            BigDecimal acceptedQty,
            BigDecimal rejectedQty,
            BigDecimal holdQty,

            MaterialUnit unit,

            BigDecimal unitRate,
            BigDecimal discountPercent,
            BigDecimal taxPercent,

            BigDecimal lineSubtotal,
            BigDecimal discountAmount,
            BigDecimal taxableAmount,
            BigDecimal taxAmount,
            BigDecimal lineTotal,

            MatFlowPurchaseOrderLineStatus status,
            String remarks,
            Long rowVersion) {
    }

    public record PurchaseOrderResponse(
            UUID id,
            String poNo,

            UUID indentId,
            UUID releaseId,
            UUID requisitionId,
            UUID quoteId,

            String indentNo,
            String plantCode,
            String pdNo,

            UUID vendorId,
            String vendorName,
            String vendorGstin,
            String vendorAddress,

            LocalDate poDate,
            LocalDate expectedDeliveryDate,

            String currencyCode,
            String paymentTerms,
            String deliveryTerms,
            String deliveryAddress,

            UUID poAttachmentId,

            BigDecimal freightAmount,
            BigDecimal otherChargesAmount,
            BigDecimal subtotalAmount,
            BigDecimal discountAmount,
            BigDecimal taxAmount,
            BigDecimal grandTotal,

            MatFlowPurchaseOrderStatus status,

            String remarks,

            String createdBy,
            LocalDateTime createdAt,

            String submittedBy,
            LocalDateTime submittedAt,

            String approvedBy,
            LocalDateTime approvedAt,

            String returnedBy,
            LocalDateTime returnedAt,
            String returnRemarks,

            Long rowVersion,
            List<PurchaseOrderLineResponse> lines) {
    }

    public record PurchaseQueueResponse(
            UUID indentId,
            String indentNo,
            UUID requisitionId,
            String requisitionNo,

            String plantCode,
            String pdNo,
            String clientName,
            String productName,

            LocalDate requiredByDate,
            MatFlowIndentStatus status,

            int lineCount,
            BigDecimal totalIndentQty,
            BigDecimal approvedOrderedQty,
            BigDecimal remainingToOrder,

            String submittedBy,
            LocalDateTime submittedAt,

            Long rowVersion) {
    }

    public record QuoteComparisonResponse(
            UUID indentId,
            String indentNo,
            List<VendorQuoteResponse> quotes) {
    }

    public record PurchaseIndentLineSummary(
            UUID indentLineId,
            String itemCode,
            String itemName,

            BigDecimal indentQty,
            BigDecimal orderedQty,
            BigDecimal remainingQty,

            MaterialUnit unit,
            MatFlowIndentLineStatus status) {
    }
}