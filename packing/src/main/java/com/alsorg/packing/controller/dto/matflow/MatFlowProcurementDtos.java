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
import jakarta.validation.constraints.Size;

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
                        @Size(max = 100, message = "Vendor code cannot exceed 100 characters.") String vendorCode,
                        @Size(max = 300, message = "Vendor name cannot exceed 300 characters.") String vendorName,
                        @Size(max = 50, message = "GSTIN cannot exceed 50 characters.") String gstin,
                        @Size(max = 200, message = "Contact person cannot exceed 200 characters.") String contactPerson,
                        @Size(max = 50, message = "Contact phone cannot exceed 50 characters.") String contactPhone,
                        @Size(max = 320, message = "Email cannot exceed 320 characters.") String email,
                        @Size(max = 2000, message = "Address cannot exceed 2000 characters.") String address,
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
                        @NotNull(message = "Indent line is required.") UUID indentLineId,
                        @NotNull(message = "Ordered quantity is required.")
                        @DecimalMin(value = "0.001", inclusive = true, message = "Ordered quantity must be greater than zero.")
                        BigDecimal orderedQty,
                        @Size(max = 1000, message = "Line remarks cannot exceed 1000 characters.") String remarks) {
        }

        public record PurchaseOrderRequest(
                        @Size(max = 150, message = "PO number cannot exceed 150 characters.") String poNumber,
                        @NotNull(message = "PO date is required.") LocalDate poDate,
                        @NotNull(message = "Vendor is required.") UUID vendorId,
                        @NotNull(message = "Indent is required.") UUID indentId,
                        @NotEmpty(message = "At least one PO line is required.")
                        @Size(max = 500, message = "A maximum of 500 PO lines is allowed.")
                        List<@Valid PurchaseOrderLineRequest> lines,
                        @Size(max = 2000, message = "PO remarks cannot exceed 2000 characters.") String remarks) {
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
                        @NotNull(message = "Purchase Order line is required.") UUID purchaseOrderLineId,
                        @NotNull(message = "Received quantity is required.")
                        @DecimalMin(value = "0.001", inclusive = true, message = "Received quantity must be greater than zero.")
                        BigDecimal receivedQty,
                        @Size(max = 150, message = "Batch number cannot exceed 150 characters.") String batchNo) {
        }

        public record GoodsReceiptRequest(
                        @NotNull(message = "Purchase Order is required.") UUID purchaseOrderId,
                        @Size(max = 150, message = "Vendor challan number cannot exceed 150 characters.") String vendorChallanNo,
                        @Size(max = 150, message = "Vendor invoice number cannot exceed 150 characters.") String vendorInvoiceNo,
                        @NotEmpty(message = "At least one GRN line is required.")
                        @Size(max = 500, message = "A maximum of 500 GRN lines is allowed.")
                        List<@Valid GoodsReceiptLineRequest> lines,
                        @Size(max = 2000, message = "GRN remarks cannot exceed 2000 characters.") String remarks) {
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
                        @NotNull(message = "QC row version is required.") Long rowVersion,
                        @NotNull(message = "Accepted quantity is required.")
                        @DecimalMin(value = "0.0", inclusive = true, message = "Accepted quantity cannot be negative.")
                        BigDecimal acceptedQty,
                        @NotNull(message = "Rejected quantity is required.")
                        @DecimalMin(value = "0.0", inclusive = true, message = "Rejected quantity cannot be negative.")
                        BigDecimal rejectedQty,
                        @Size(max = 2000, message = "QC remarks cannot exceed 2000 characters.") String remarks) {
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
                        @NotNull(message = "QC row version is required.") Long rowVersion,
                        @NotNull(message = "Return quantity is required.")
                        @DecimalMin(value = "0.001", inclusive = true, message = "Return quantity must be greater than zero.")
                        BigDecimal returnQty,
                        @Size(max = 2000, message = "Return remarks cannot exceed 2000 characters.") String remarks) {
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
