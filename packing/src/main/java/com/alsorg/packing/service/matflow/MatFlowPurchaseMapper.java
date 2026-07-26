package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowPurchaseDtos.PurchaseOrderLineResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPurchaseDtos.PurchaseOrderResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPurchaseDtos.VendorQuoteLineResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPurchaseDtos.VendorQuoteResponse;

import com.alsorg.packing.domain.matflow.MatFlowPurchaseOrder;
import com.alsorg.packing.domain.matflow.MatFlowPurchaseOrderLine;
import com.alsorg.packing.domain.matflow.MatFlowVendorQuote;
import com.alsorg.packing.domain.matflow.MatFlowVendorQuoteLine;

import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class MatFlowPurchaseMapper {

    public VendorQuoteResponse toQuoteResponse(
            MatFlowVendorQuote quote,
            List<MatFlowVendorQuoteLine> lines) {

        return new VendorQuoteResponse(
                quote.id,
                quote.indentId,
                quote.releaseId,
                quote.requisitionId,

                quote.indentNo,
                quote.plantCode,
                quote.pdNo,

                quote.vendorId,
                quote.vendorName,
                quote.vendorGstin,
                quote.vendorAddress,

                quote.quoteNo,
                quote.quoteDate,
                quote.validUntil,

                quote.currencyCode,
                quote.quoteAttachmentId,

                quote.paymentTerms,
                quote.deliveryTerms,

                quote.freightAmount,
                quote.otherChargesAmount,
                quote.subtotalAmount,
                quote.discountAmount,
                quote.taxAmount,
                quote.grandTotal,

                quote.status,

                quote.remarks,
                quote.createdBy,
                quote.createdAt,
                quote.submittedBy,
                quote.submittedAt,

                quote.rowVersion,

                lines.stream()
                        .map(this::toQuoteLineResponse)
                        .toList());
    }

    public VendorQuoteLineResponse toQuoteLineResponse(
            MatFlowVendorQuoteLine line) {

        return new VendorQuoteLineResponse(
                line.id,
                line.indentLineId,
                line.requisitionLineId,
                line.matFlowLineId,

                line.sourceLineNo,
                line.itemCode,
                line.itemName,
                line.itemDescription,
                line.specification,

                line.quotedQty,
                line.selectedQty,
                line.unit,

                line.unitRate,
                line.discountPercent,
                line.taxPercent,

                line.lineSubtotal,
                line.discountAmount,
                line.taxableAmount,
                line.taxAmount,
                line.lineTotal,

                line.leadTimeDays,
                line.promisedDeliveryDate,

                line.status,
                line.remarks,
                line.rowVersion);
    }

    public PurchaseOrderResponse toPurchaseOrderResponse(
            MatFlowPurchaseOrder purchaseOrder,
            List<MatFlowPurchaseOrderLine> lines) {

        return new PurchaseOrderResponse(
                purchaseOrder.id,
                purchaseOrder.poNo,

                purchaseOrder.indentId,
                purchaseOrder.releaseId,
                purchaseOrder.requisitionId,
                purchaseOrder.quoteId,

                purchaseOrder.indentNo,
                purchaseOrder.plantCode,
                purchaseOrder.pdNo,

                purchaseOrder.vendorId,
                purchaseOrder.vendorName,
                purchaseOrder.vendorGstin,
                purchaseOrder.vendorAddress,

                purchaseOrder.poDate,
                purchaseOrder.expectedDeliveryDate,

                purchaseOrder.currencyCode,
                purchaseOrder.paymentTerms,
                purchaseOrder.deliveryTerms,
                purchaseOrder.deliveryAddress,

                purchaseOrder.poAttachmentId,

                purchaseOrder.freightAmount,
                purchaseOrder.otherChargesAmount,
                purchaseOrder.subtotalAmount,
                purchaseOrder.discountAmount,
                purchaseOrder.taxAmount,
                purchaseOrder.grandTotal,

                purchaseOrder.status,

                purchaseOrder.remarks,

                purchaseOrder.createdBy,
                purchaseOrder.createdAt,

                purchaseOrder.submittedBy,
                purchaseOrder.submittedAt,

                purchaseOrder.approvedBy,
                purchaseOrder.approvedAt,

                purchaseOrder.returnedBy,
                purchaseOrder.returnedAt,
                purchaseOrder.returnRemarks,

                purchaseOrder.rowVersion,

                lines.stream()
                        .map(this::toPurchaseOrderLineResponse)
                        .toList());
    }

    public PurchaseOrderLineResponse toPurchaseOrderLineResponse(
            MatFlowPurchaseOrderLine line) {

        return new PurchaseOrderLineResponse(
                line.id,
                line.indentLineId,
                line.requisitionLineId,
                line.matFlowLineId,
                line.quoteLineId,

                line.sourceLineNo,
                line.itemCode,
                line.itemName,
                line.itemDescription,
                line.specification,

                line.orderedQty,
                line.receivedQty,
                line.acceptedQty,
                line.rejectedQty,
                line.holdQty,

                line.unit,

                line.unitRate,
                line.discountPercent,
                line.taxPercent,

                line.lineSubtotal,
                line.discountAmount,
                line.taxableAmount,
                line.taxAmount,
                line.lineTotal,

                line.status,
                line.remarks,
                line.rowVersion);
    }
}