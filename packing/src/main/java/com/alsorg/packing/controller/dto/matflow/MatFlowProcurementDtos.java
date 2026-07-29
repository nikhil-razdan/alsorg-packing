package com.alsorg.packing.controller.dto.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.GoodsReceiptStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.PurchaseOrderStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcInspectionStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcSourceType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.VendorReturnStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class MatFlowProcurementDtos {

    private MatFlowProcurementDtos() {
    }

    public record VendorRequest(
            String vendorCode,
            String vendorName,
            String gstin,
            String contactPerson,
            String phone,
            String email,
            String address,
            Boolean active,
            Long rowVersion) {
    }

    public record VendorResponse(
            UUID id,
            String vendorCode,
            String vendorName,
            String gstin,
            String contactPerson,
            String phone,
            String email,
            String address,
            boolean active,
            Long rowVersion) {
    }

    public record PurchaseOrderLineRequest(
            UUID indentLineId,
            BigDecimal orderedQty,
            String remarks) {
    }

    public record PurchaseOrderRequest(
            String poNumber,
            LocalDate poDate,
            UUID vendorId,
            UUID indentId,
            UUID deliveryLocationId,
            String remarks,
            List<PurchaseOrderLineRequest> lines) {
    }

    public record PurchaseOrderLineResponse(
            UUID id,
            UUID indentLineId,
            UUID materialId,
            String materialCode,
            String materialName,
            BigDecimal orderedQty,
            BigDecimal receivedQty,
            String uom,
            Long rowVersion) {
    }

    public record PurchaseOrderResponse(
            UUID id,
            String poNumber,
            LocalDate poDate,
            UUID vendorId,
            String vendorCode,
            String vendorName,
            UUID indentId,
            String indentNumber,
            UUID deliveryLocationId,
            String deliveryLocationCode,
            String deliveryPlantCode,
            PurchaseOrderStatus status,
            String remarks,
            Long rowVersion,
            List<PurchaseOrderLineResponse> lines) {
    }

    public record GoodsReceiptLineRequest(
            UUID purchaseOrderLineId,
            BigDecimal receivedQty,
            String batchNo) {
    }

    public record GoodsReceiptRequest(
            UUID purchaseOrderId,
            UUID receiptLocationId,
            String vendorChallanNo,
            String vendorInvoiceNo,
            String remarks,
            List<GoodsReceiptLineRequest> lines) {
    }

    public record GoodsReceiptLineResponse(
            UUID id,
            UUID purchaseOrderLineId,
            UUID materialId,
            String materialCode,
            String materialName,
            BigDecimal receivedQty,
            BigDecimal acceptedQty,
            BigDecimal rejectedQty,
            BigDecimal returnedQty,
            String uom,
            String batchNo,
            Long rowVersion) {
    }

    public record GoodsReceiptResponse(
            UUID id,
            String grnNumber,
            UUID purchaseOrderId,
            String poNumber,
            UUID receiptLocationId,
            String receiptLocationCode,
            String receiptPlantCode,
            String vendorChallanNo,
            String vendorInvoiceNo,
            GoodsReceiptStatus status,
            String receivedBy,
            LocalDateTime receivedAt,
            String remarks,
            Long rowVersion,
            List<GoodsReceiptLineResponse> lines) {
    }

    public record QcDecisionRequest(
            Long rowVersion,
            BigDecimal acceptedQty,
            BigDecimal rejectedQty,
            String remarks) {
    }

    public record QcInspectionResponse(
            UUID id,
            String inspectionNumber,
            QcSourceType sourceType,
            UUID sourceId,
            UUID sourceLineId,
            UUID materialId,
            String materialCode,
            String materialName,
            UUID locationId,
            String locationCode,
            String plantCode,
            BigDecimal inspectionQty,
            BigDecimal acceptedQty,
            BigDecimal rejectedQty,
            QcInspectionStatus status,
            String inspectedBy,
            LocalDateTime inspectedAt,
            String remarks,
            Long rowVersion) {
    }

    public record VendorReturnRequest(
            Long rowVersion,
            BigDecimal returnQty,
            String remarks) {
    }

    public record VendorReturnResponse(
            UUID id,
            String returnNumber,
            UUID qcInspectionId,
            UUID vendorId,
            String vendorName,
            UUID materialId,
            String materialCode,
            UUID fromLocationId,
            String fromLocationCode,
            BigDecimal returnQty,
            VendorReturnStatus status,
            String dispatchedBy,
            LocalDateTime dispatchedAt,
            String remarks,
            Long rowVersion) {
    }

    public record PurchaseOrderActionRequest(
            Long rowVersion,
            String remarks) {
    }
}