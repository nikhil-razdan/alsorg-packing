package com.alsorg.packing.service.matflow;

import static com.alsorg.packing.controller.matflow.MatFlowApiContract.API_VERSION;

import com.alsorg.packing.controller.dto.matflow.MatFlowMetadataDtos.MetadataResponse;

import com.alsorg.packing.domain.matflow.MatFlowBomStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.GoodsReceiptStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.IndentStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.LocationType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MaterialReturnReason;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MaterialReturnStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MovementType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ProcessingJobStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.PurchaseOrderStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcDispositionStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcDispositionType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcInspectionStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcSourceType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RequisitionStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ReservationStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RouteStepType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.TransferPurpose;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.TransferStatus;

import java.time.LocalDateTime;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MatFlowMetadataService {

    private static final List<String> MATFLOW_ROLES = List.of(
            "ADMIN",
            "MATFLOW_MANAGER",
            "MATFLOW_ENGINEERING",
            "MATFLOW_STORE",
            "MATFLOW_PURCHASE",
            "MATFLOW_PROCESSING",
            "MATFLOW_PRODUCTION",
            "MATFLOW_QC",
            "MATFLOW_DIRECTOR");

    private final MatFlowAccessService accessService;

    public MatFlowMetadataService(
            MatFlowAccessService accessService) {
        this.accessService = accessService;
    }

    @Transactional(readOnly = true)
    public MetadataResponse metadata() {
        accessService.requireRead();

        Map<String, List<String>> enums = new LinkedHashMap<>();

        enums.put(
                "bomStatus",
                names(MatFlowBomStatus.class));

        enums.put(
                "locationType",
                names(LocationType.class));

        enums.put(
                "routeStepType",
                names(RouteStepType.class));

        enums.put(
                "requisitionStatus",
                names(RequisitionStatus.class));

        enums.put(
                "reservationStatus",
                names(ReservationStatus.class));

        enums.put(
                "indentStatus",
                names(IndentStatus.class));

        enums.put(
                "purchaseOrderStatus",
                names(PurchaseOrderStatus.class));

        enums.put(
                "goodsReceiptStatus",
                names(GoodsReceiptStatus.class));

        enums.put(
                "transferStatus",
                names(TransferStatus.class));

        enums.put(
                "transferPurpose",
                names(TransferPurpose.class));

        enums.put(
                "qcInspectionStatus",
                names(QcInspectionStatus.class));

        enums.put(
                "qcSourceType",
                names(QcSourceType.class));

        enums.put(
                "qcDispositionType",
                names(QcDispositionType.class));

        enums.put(
                "qcDispositionStatus",
                names(QcDispositionStatus.class));

        enums.put(
                "processingJobStatus",
                names(ProcessingJobStatus.class));

        enums.put(
                "materialReturnStatus",
                names(MaterialReturnStatus.class));

        enums.put(
                "materialReturnReason",
                names(MaterialReturnReason.class));

        enums.put(
                "movementType",
                names(MovementType.class));

        Set<String> allowedPlants = accessService.allowedPlants();

        return new MetadataResponse(
                API_VERSION,
                LocalDateTime.now(),
                allowedPlants,
                MATFLOW_ROLES,
                enums);
    }

    private List<String> names(
            Class<? extends Enum<?>> enumType) {
        return Arrays.stream(
                enumType.getEnumConstants())
                .map(Enum::name)
                .toList();
    }
}