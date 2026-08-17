package com.alsorg.packing.controller.dto.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.GoodsReceiptStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.PurchaseOrderStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcInspectionStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcSourceType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.VendorReturnStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Purchase, GRN and QC contracts.
 *
 * PO delivery and GRN receipt are fixed to AL-P1 Main Store by the backend.
 * No client chooses or submits a Location.
 */
public final class MatFlowProcurementDtos {
        private MatFlowProcurementDtos() {
        }

        public record VendorRequest(
                        String vendorCode,
                        String vendorName,
                        String gstin,
                        String contactPerson,
                        String contactPhone,
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
                        String contactPhone,
                        String email,
                        String address,
                        boolean active,
                        Long rowVersion) {
        }

        public record PurchaseOrderLineRequest(
                        @NotNull UUID indentLineId,
                        @NotNull @DecimalMin(value = "0.001") BigDecimal orderedQty,
                        String remarks) {
        }

        public record PurchaseOrderRequest(
                        String poNumber,
                        @NotNull LocalDate poDate,
                        @NotNull UUID vendorId,
                        @NotNull UUID indentId,
                        @NotEmpty List<@Valid PurchaseOrderLineRequest> lines,
                        String remarks) {
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
                        UUID requisitionId,
                        String requisitionNumber,
                        UUID projectDrawingId,
                        String projectCode,
                        String drawingNo,
                        String productName,
                        String clientName,
                        String plantCode,
                        PurchaseOrderStatus status,
                        String remarks,
                        Long rowVersion,
                        List<PurchaseOrderLineResponse> lines) {
        }

        public record GoodsReceiptLineRequest(
                        @NotNull UUID purchaseOrderLineId,
                        @NotNull @DecimalMin(value = "0.001") BigDecimal receivedQty,
                        String batchNo) {
        }

        public record GoodsReceiptRequest(
                        @NotNull UUID purchaseOrderId,
                        String vendorChallanNo,
                        String vendorInvoiceNo,
                        @NotEmpty List<@Valid GoodsReceiptLineRequest> lines,
                        String remarks) {
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
                        UUID indentId,
                        String indentNumber,
                        UUID requisitionId,
                        String requisitionNumber,
                        UUID projectDrawingId,
                        String projectCode,
                        String drawingNo,
                        String productName,
                        String clientName,
                        String plantCode,
                        String vendorChallanNo,
                        String vendorInvoiceNo,
                        GoodsReceiptStatus status,
                        String receivedBy,
                        LocalDateTime receivedAt,
                        String remarks,
                        Long rowVersion,
                        List<GoodsReceiptLineResponse> lines) {
        }

        /**
         * Active QC is a check/tick against an MR material lot. It is not a Location.
         */
        public record QcDecisionRequest(
                        @NotNull Long rowVersion,
                        @NotNull @DecimalMin(value = "0.0") BigDecimal acceptedQty,
                        @NotNull @DecimalMin(value = "0.0") BigDecimal rejectedQty,
                        String remarks) {
        }

        public record QcInspectionResponse(
                        UUID id,
                        UUID requisitionId,
                        String requisitionNumber,
                        String projectCode,
                        String drawingNo,
                        String productName,
                        List<String> indentNumbers,
                        List<String> purchaseOrderNumbers,
                        List<String> grnNumbers,
                        QcSourceType sourceType,
                        UUID sourceId,
                        UUID sourceLineId,
                        UUID materialId,
                        String materialCode,
                        String materialName,
                        BigDecimal inspectionQty,
                        QcInspectionStatus status,
                        String inspectedBy,
                        LocalDateTime inspectedAt,
                        String remarks,
                        boolean photoAvailable,
                        Long rowVersion) {
        }

        public record VendorReturnRequest(
                        @NotNull Long rowVersion,
                        @NotNull @DecimalMin(value = "0.001") BigDecimal returnQty,
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
                        String fromPlantCode,
                        BigDecimal returnQty,
                        VendorReturnStatus status,
                        String dispatchedBy,
                        LocalDateTime dispatchedAt,
                        String remarks,
                        Long rowVersion) {
        }
}
