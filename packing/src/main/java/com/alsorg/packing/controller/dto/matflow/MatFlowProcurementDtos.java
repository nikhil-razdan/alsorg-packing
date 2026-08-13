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

/** Purchase, GRN, QC and vendor contracts used by MatFlow. */
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

        /**
         * Purchase creates and places the PO directly against one Store PI and vendor.
         * poNumber is retained only for old-client wire compatibility; the backend
         * always generates PO/yyyy/MM/dd/n.
         */
        public record PurchaseOrderRequest(
                        String poNumber,
                        @NotNull LocalDate poDate,
                        @NotNull UUID vendorId,
                        @NotNull UUID indentId,
                        @NotNull UUID deliveryLocationId,
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

        /** No approval fields are exposed because MatFlow has no PO approval desk. */
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
                        UUID deliveryLocationId,
                        String deliveryLocationCode,
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

        /** GRN always inwards vendor material into Store stock. */
        public record GoodsReceiptRequest(
                        @NotNull UUID purchaseOrderId,
                        @NotNull UUID receiptLocationId,
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
                        UUID receiptLocationId,
                        String receiptLocationCode,
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

        /** QC is a simple completion/tick against the MR material lot. */
        public record QcDecisionRequest(
                        @NotNull Long rowVersion,
                        String remarks) {
        }

        /**
         * QC is not a standalone numbered business document.
         * The UUID remains the technical action key, while the user-facing identity
         * is the linked MR and, when applicable, its PI / PO / GRN procurement chain.
         */
        public record QcInspectionResponse(
                        UUID id,
                        UUID requisitionId,
                        String requisitionNumber,
                        String pdNo,
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
                        UUID fromLocationId,
                        String fromLocationCode,
                        BigDecimal returnQty,
                        VendorReturnStatus status,
                        String dispatchedBy,
                        LocalDateTime dispatchedAt,
                        String remarks,
                        Long rowVersion) {
        }
}
