package com.alsorg.packing.service.matflow;

import static com.alsorg.packing.controller.matflow.MatFlowApiContract.API_VERSION;

import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.MaterialRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.MaterialResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.ProjectDrawingRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.ProjectDrawingResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowMetadataDtos.MetadataResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.ProcessingUnitRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.ProcessingUnitResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.VendorRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.VendorResponse;

import com.alsorg.packing.domain.matflow.MatFlowBomStatus;
import com.alsorg.packing.domain.matflow.MatFlowLocation;
import com.alsorg.packing.domain.matflow.MatFlowMaterial;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.GoodsReceiptStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.IndentStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.LocationType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MaterialReturnReason;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MaterialReturnStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MovementType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.OwnershipType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ProcessingJobStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ProjectProductApprovalStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.PartialAvailabilityDecision;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.PurchaseOrderStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcDispositionStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcDispositionType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcInspectionStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcRoutingDecision;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcSourceType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RequisitionStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RequisitionLineStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ReservationStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RouteStepType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.StoreAvailabilityDecision;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.TransferPurpose;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.TransferStatus;
import com.alsorg.packing.domain.matflow.MatFlowProject;
import com.alsorg.packing.domain.matflow.MatFlowProjectDrawing;
import com.alsorg.packing.domain.matflow.MatFlowVendor;

import com.alsorg.packing.repository.matflow.MatFlowBomRepository;
import com.alsorg.packing.repository.matflow.MatFlowLocationRepository;
import com.alsorg.packing.repository.matflow.MatFlowMaterialRepository;
import com.alsorg.packing.repository.matflow.MatFlowProjectDrawingRepository;
import com.alsorg.packing.repository.matflow.MatFlowProjectRepository;
import com.alsorg.packing.repository.matflow.MatFlowVendorRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Consolidated MatFlow master-data service.
 *
 * Owns the relatively small, strongly-related master/reference concerns:
 * materials, project/drawing masters, Processing Units, Processing Unit master, vendors and UI metadata. Store/Production routing is derived from Plant + requester. Physical Store stock remains authoritative in Tally.
 */
@Service
public class MatFlowMasterDataService {

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

        private final MasterModule master;
        private final InventoryModule inventory;
        private final VendorModule vendors;
        private final MatFlowAccessService accessService;

        public MatFlowMasterDataService(
                        MatFlowMaterialRepository materialRepository,
                        MatFlowProjectDrawingRepository projectRepository,
                        MatFlowProjectRepository projectHeaderRepository,
                        MatFlowLocationRepository locationRepository,
                        MatFlowVendorRepository vendorRepository,
                        MatFlowBomRepository bomRepository,
                        MatFlowAccessService accessService,
                        MatFlowAuditService auditService) {
                this.accessService = accessService;
                this.master = new MasterModule(
                                materialRepository,
                                projectRepository,
                                projectHeaderRepository,
                                bomRepository,
                                accessService,
                                auditService);
                this.inventory = new InventoryModule(
                                locationRepository, accessService);
                this.vendors = new VendorModule(vendorRepository, accessService);
        }

        @Transactional(readOnly = true)
        public List<MaterialResponse> listMaterials(String search, Boolean active) {
                return master.listMaterials(search, active);
        }

        @Transactional
        public MaterialResponse createMaterial(MaterialRequest request) {
                return master.createMaterial(request);
        }

        @Transactional
        public MaterialResponse updateMaterial(UUID id, MaterialRequest request) {
                return master.updateMaterial(id, request);
        }

        @Transactional(readOnly = true)
        public List<ProjectDrawingResponse> listProjects(String search, Boolean active) {
                return master.listProjects(search, active);
        }

        @Transactional
        public ProjectDrawingResponse createProject(ProjectDrawingRequest request) {
                return master.createProject(request);
        }

        @Transactional
        public ProjectDrawingResponse updateProject(UUID id, ProjectDrawingRequest request) {
                return master.updateProject(id, request);
        }

        @Transactional(readOnly = true)
        public MatFlowMaterial requireMaterial(UUID id) {
                return master.requireMaterial(id);
        }

        @Transactional(readOnly = true)
        public MatFlowProjectDrawing requireProject(UUID id) {
                return master.requireProject(id);
        }

        public ProjectDrawingResponse toProjectResponse(MatFlowProjectDrawing project) {
                return master.toProjectResponse(project);
        }

        @Transactional(readOnly = true)
        public List<ProcessingUnitResponse> listProcessingUnits(String search, Boolean active) {
                return inventory.listProcessingUnits(search, active);
        }

        @Transactional
        public ProcessingUnitResponse createProcessingUnit(ProcessingUnitRequest request) {
                return inventory.createProcessingUnit(request);
        }

        @Transactional
        public ProcessingUnitResponse updateProcessingUnit(UUID id, ProcessingUnitRequest request) {
                return inventory.updateProcessingUnit(id, request);
        }

        /**
         * Internal/legacy custody read only. No public MatFlow stock endpoint exposes this
         * in the Tally-authoritative workflow.
         */
        /**
         * Internal/legacy compatibility only. The controller intentionally does not expose
         * manual stock adjustments; physical stock changes belong in Tally.
         */
        @Transactional(readOnly = true)
        public List<VendorResponse> listVendors(String search, Boolean active) {
                return vendors.list(search, active);
        }

        @Transactional
        public VendorResponse createVendor(VendorRequest request) {
                return vendors.create(request);
        }

        @Transactional
        public VendorResponse updateVendor(UUID id, VendorRequest request) {
                return vendors.update(id, request);
        }

        @Transactional(readOnly = true)
        public MetadataResponse metadata() {
                accessService.requireRead();

                Map<String, List<String>> enums = new LinkedHashMap<>();
                enums.put(
                                "bomStatus",
                                namesExcluding(
                                                MatFlowBomStatus.class,
                                                Set.of("PRODUCTION_REVIEW_PENDING")));
                enums.put("routeStepType", List.of(RouteStepType.PROCESSING.name()));
                enums.put(
                                "requisitionStatus",
                                namesExcluding(
                                                RequisitionStatus.class,
                                                Set.of("SUBMITTED", "PLANNED", "ISSUED", "COMPLETED")));
                enums.put("requisitionLineStatus", names(RequisitionLineStatus.class));
                enums.put("storeAvailabilityDecision", names(StoreAvailabilityDecision.class));
                enums.put("reservationStatus", names(ReservationStatus.class));
                enums.put("indentStatus", names(IndentStatus.class));
                enums.put("purchaseOrderStatus", names(PurchaseOrderStatus.class));
                enums.put("goodsReceiptStatus", names(GoodsReceiptStatus.class));
                enums.put("qcInspectionStatus", names(QcInspectionStatus.class));
                enums.put("qcSourceType", names(QcSourceType.class));
                enums.put("qcDispositionType", names(QcDispositionType.class));
                enums.put("qcDispositionStatus", names(QcDispositionStatus.class));
                enums.put("processingJobStatus", names(ProcessingJobStatus.class));
                enums.put("materialReturnStatus", names(MaterialReturnStatus.class));
                enums.put("materialReturnReason", names(MaterialReturnReason.class));
                enums.put("movementType", names(MovementType.class));

                return new MetadataResponse(
                                API_VERSION,
                                LocalDateTime.now(),
                                accessService.allowedPlants(),
                                MATFLOW_ROLES,
                                enums);
        }

        private List<String> names(Class<? extends Enum<?>> enumType) {
                return Arrays.stream(enumType.getEnumConstants()).map(Enum::name).toList();
        }

        private List<String> namesExcluding(
                        Class<? extends Enum<?>> enumType,
                        Set<String> excludedNames) {
                Set<String> excluded = excludedNames == null ? Set.of() : excludedNames;
                return Arrays.stream(enumType.getEnumConstants())
                                .map(Enum::name)
                                .filter(name -> !excluded.contains(name))
                                .toList();
        }

        private static final class MasterModule {

                private final MatFlowMaterialRepository materialRepository;
                private final MatFlowProjectDrawingRepository projectRepository;
                private final MatFlowProjectRepository projectHeaderRepository;
                private final MatFlowBomRepository bomRepository;
                private final MatFlowAccessService accessService;
                private final MatFlowAuditService auditService;

                MasterModule(
                                MatFlowMaterialRepository materialRepository,
                                MatFlowProjectDrawingRepository projectRepository,
                                MatFlowProjectRepository projectHeaderRepository,
                                MatFlowBomRepository bomRepository,
                                MatFlowAccessService accessService,
                                MatFlowAuditService auditService) {
                        this.materialRepository = materialRepository;
                        this.projectRepository = projectRepository;
                        this.projectHeaderRepository = projectHeaderRepository;
                        this.bomRepository = bomRepository;
                        this.accessService = accessService;
                        this.auditService = auditService;
                }

                @Transactional(readOnly = true)
                public List<MaterialResponse> listMaterials(
                                String search,
                                Boolean active) {
                        accessService.requireRead();

                        String query = normalizeSearch(search);

                        return materialRepository
                                        .findAll(
                                                        Sort.by(
                                                                        Sort.Direction.ASC,
                                                                        "materialCode"))
                                        .stream()
                                        .filter(material -> active == null ||
                                                        material.isActive() == active)
                                        .filter(material -> query.isBlank() ||
                                                        contains(
                                                                        material.getMaterialCode(),
                                                                        query)
                                                        ||
                                                        contains(
                                                                        material.getMaterialName(),
                                                                        query)
                                                        ||
                                                        contains(
                                                                        material.getCategory(),
                                                                        query)
                                                        ||
                                                        contains(
                                                                        material.getSpecification(),
                                                                        query))
                                        .map(this::toMaterialResponse)
                                        .toList();
                }

                @Transactional
                public MaterialResponse createMaterial(
                                MaterialRequest request) {
                        accessService
                                        .requireMaterialMasterWrite();

                        validateMaterialRequest(request);

                        String materialCode = upper(request.materialCode());

                        if (materialRepository
                                        .existsByMaterialCodeIgnoreCase(
                                                        materialCode)) {
                                throw conflict(
                                                "Material code already exists: " +
                                                                materialCode);
                        }

                        String actor = accessService.actor();

                        MatFlowMaterial material = new MatFlowMaterial();

                        applyMaterial(
                                        material,
                                        request);

                        material.setCreatedBy(actor);
                        material.setUpdatedBy(actor);

                        material = materialRepository.save(material);

                        auditService.record(
                                        "MATERIAL_MASTER",
                                        material.getId(),
                                        "MATERIAL_CREATED",
                                        null,
                                        null,
                                        null,
                                        auditService.details(
                                                        "materialCode", material.getMaterialCode(),
                                                        "materialName", material.getMaterialName(),
                                                        "category", material.getCategory(),
                                                        "uom", material.getUom(),
                                                        "active", material.isActive()));

                        return toMaterialResponse(material);
                }

                @Transactional
                public MaterialResponse updateMaterial(
                                UUID id,
                                MaterialRequest request) {
                        accessService
                                        .requireMaterialMasterWrite();

                        validateMaterialRequest(request);

                        MatFlowMaterial material = requireMaterial(id);

                        assertVersion(
                                        request.rowVersion(),
                                        material.getRowVersion(),
                                        "Material");

                        String materialCode = upper(request.materialCode());

                        if (materialRepository
                                        .existsByMaterialCodeIgnoreCaseAndIdNot(
                                                        materialCode,
                                                        id)) {
                                throw conflict(
                                                "Material code already exists: " +
                                                                materialCode);
                        }

                        applyMaterial(
                                        material,
                                        request);

                        String actor = accessService.actor();
                        material.setUpdatedBy(actor);
                        material = materialRepository.save(material);

                        auditService.record(
                                        "MATERIAL_MASTER",
                                        material.getId(),
                                        "MATERIAL_UPDATED",
                                        null,
                                        null,
                                        null,
                                        auditService.details(
                                                        "materialCode", material.getMaterialCode(),
                                                        "materialName", material.getMaterialName(),
                                                        "category", material.getCategory(),
                                                        "uom", material.getUom(),
                                                        "active", material.isActive(),
                                                        "updatedBy", actor));

                        return toMaterialResponse(material);
                }

                @Transactional(readOnly = true)
                public List<ProjectDrawingResponse> listProjects(
                                String search,
                                Boolean active) {
                        accessService.requireRead();

                        String query = normalizeSearch(search);

                        return projectRepository
                                        .findAll(
                                                        Sort.by(
                                                                        Sort.Direction.DESC,
                                                                        "updatedAt"))
                                        .stream()
                                        .filter(project -> accessService.canAccessPlant(
                                                        project.getPlantCode()))
                                        .filter(project -> active == null ||
                                                        project.isActive() == active)
                                        .filter(project -> query.isBlank() ||
                                                        contains(
                                                                        project.getProjectCode(),
                                                                        query)
                                                        ||
                                                        contains(
                                                                        project.getProjectName(),
                                                                        query)
                                                        ||
                                                        contains(
                                                                        project.getClientName(),
                                                                        query)
                                                        ||
                                                        contains(
                                                                        project.getDrawingNo(),
                                                                        query)
                                                        ||
                                                        contains(
                                                                        project.getProductName(),
                                                                        query))
                                        .map(this::toProjectResponse)
                                        .toList();
                }

                @Transactional
                public ProjectDrawingResponse createProject(
                                ProjectDrawingRequest request) {
                        accessService.requireProjectWrite();

                        validateProjectRequest(request);

                        String plantCode = upper(request.plantCode());

                        accessService.requirePlantAccess(
                                        plantCode);

                        String projectCode = upper(request.projectCode());

                        String drawingNo = upper(request.drawingNo());

                        String drawingRevision = normalizedRevision(
                                        request.drawingRevision());

                        if (projectRepository.existsDuplicate(
                                        plantCode,
                                        projectCode,
                                        drawingNo,
                                        drawingRevision)) {
                                throw conflict(
                                                "Project drawing revision already exists");
                        }

                        String actor = accessService.actor();

                        MatFlowProjectDrawing project = new MatFlowProjectDrawing();

                        applyProject(
                                        project,
                                        request,
                                        plantCode);

                        /*
                         * Compatibility endpoint: /projects historically created a flat
                         * Project+Product row. After the Project aggregate migration it
                         * still works, but always attaches the new Product to a real parent
                         * Project header so project_id can remain NOT NULL.
                         */
                        MatFlowProject parent = projectHeaderRepository
                                        .findByPlantCodeIgnoreCaseAndProjectCodeIgnoreCase(
                                                        plantCode,
                                                        projectCode)
                                        .orElseGet(() -> {
                                                MatFlowProject created = new MatFlowProject();
                                                created.setProjectCode(projectCode);
                                                created.setProjectName(request.projectName());
                                                created.setClientName(request.clientName());
                                                created.setPlantCode(plantCode);
                                                created.setRequiredDate(request.requiredDate());
                                                created.setPriority("NORMAL");
                                                created.setActive(request.active() == null || request.active());
                                                created.setCreatedBy(actor);
                                                created.setUpdatedBy(actor);
                                                return projectHeaderRepository.save(created);
                                        });

                        if (!Objects.equals(clean(parent.getProjectName()), clean(request.projectName()))
                                        || !Objects.equals(clean(parent.getClientName()),
                                                        clean(request.clientName()))) {
                                throw conflict(
                                                "Project header already exists with different Project/Client data. "
                                                                + "Use Project Portfolio to add the product under the existing Project.");
                        }

                        project.setProject(parent);
                        resetProductApproval(project);

                        project.setCreatedBy(actor);
                        project.setUpdatedBy(actor);

                        project = projectRepository.save(project);

                        auditService.record(
                                        "PROJECT_PRODUCT",
                                        project.getId(),
                                        "PROJECT_PRODUCT_CREATED",
                                        project.getPlantCode(),
                                        project.getProjectCode(),
                                        project.getDrawingNo(),
                                        auditService.details(
                                                        "projectName", project.getProjectName(),
                                                        "productName", project.getProductName(),
                                                        "drawingRevision", project.getDrawingRevision()));

                        return toProjectResponse(project);
                }

                @Transactional
                public ProjectDrawingResponse updateProject(
                                UUID id,
                                ProjectDrawingRequest request) {
                        accessService.requireProjectWrite();

                        validateProjectRequest(request);

                        MatFlowProjectDrawing project = requireProject(id);

                        accessService.requirePlantAccess(
                                        project.getPlantCode());

                        assertVersion(
                                        request.rowVersion(),
                                        project.getRowVersion(),
                                        "Project drawing");

                        String plantCode = upper(request.plantCode());

                        accessService.requirePlantAccess(
                                        plantCode);

                        String projectCode = upper(request.projectCode());

                        /*
                         * After the vNext hierarchy migration, Project header ownership
                         * belongs to mf_projects. The legacy flat endpoint may edit the
                         * Product/Drawing child, but it must never fork Project/Client/Plant
                         * snapshots away from its parent. Header edits go through the
                         * Project Portfolio API.
                         */
                        MatFlowProject parent = project.getProject();
                        if (parent != null && (!Objects.equals(upper(parent.getProjectCode()), projectCode) ||
                                        !Objects.equals(upper(parent.getPlantCode()), plantCode) ||
                                        !Objects.equals(clean(parent.getProjectName()), clean(request.projectName())) ||
                                        !Objects.equals(clean(parent.getClientName()), clean(request.clientName())))) {
                                throw conflict(
                                                "Project/Client/Plant header fields are owned by the parent Project. " +
                                                                "Use Project Portfolio to edit the Project header; use this Product endpoint only for Product/Drawing fields.");
                        }

                        String drawingNo = upper(request.drawingNo());

                        String drawingRevision = normalizedRevision(
                                        request.drawingRevision());

                        if (projectRepository.existsDuplicateExcludingId(
                                        plantCode,
                                        projectCode,
                                        drawingNo,
                                        drawingRevision,
                                        id)) {
                                throw conflict(
                                                "Project drawing revision already exists");
                        }

                        boolean criticalChange = hasApprovalCriticalChange(
                                        project,
                                        request,
                                        plantCode);

                        if (criticalChange &&
                                        bomRepository.existsByProjectDrawing_IdAndEffectiveTrue(id)) {
                                throw conflict(
                                                "An approved/effective BOM already exists for this product/drawing. "
                                                                + "Create a new Product/Drawing revision instead of changing execution-critical identity fields.");
                        }

                        applyProject(
                                        project,
                                        request,
                                        plantCode);

                        if (parent != null) {
                                project.setProject(parent);
                        }

                        if (criticalChange ||
                                        project.getProductApprovalStatus() == ProjectProductApprovalStatus.RETURNED) {
                                resetProductApproval(project);
                        }

                        String actor = accessService.actor();
                        project.setUpdatedBy(actor);
                        project = projectRepository.save(project);

                        auditService.record(
                                        "PROJECT_PRODUCT",
                                        project.getId(),
                                        "PROJECT_PRODUCT_UPDATED",
                                        project.getPlantCode(),
                                        project.getProjectCode(),
                                        project.getDrawingNo(),
                                        auditService.details(
                                                        "productName", project.getProductName(),
                                                        "setupFieldsChanged", criticalChange,
                                                        "approvalStatus", project.getProductApprovalStatus()));

                        return toProjectResponse(project);
                }

                @Transactional(readOnly = true)
                public MatFlowMaterial requireMaterial(
                                UUID id) {
                        return materialRepository
                                        .findById(id)
                                        .orElseThrow(() -> notFound(
                                                        "Material not found"));
                }

                @Transactional(readOnly = true)
                public MatFlowProjectDrawing requireProject(
                                UUID id) {
                        MatFlowProjectDrawing project = projectRepository
                                        .findById(id)
                                        .orElseThrow(() -> notFound(
                                                        "Project drawing not found"));

                        accessService.requirePlantAccess(
                                        project.getPlantCode());

                        return project;
                }

                public ProjectDrawingResponse toProjectResponse(
                                MatFlowProjectDrawing project) {
                        return new ProjectDrawingResponse(
                                        project.getId(),
                                        project.getProjectCode(),
                                        project.getProjectName(),
                                        project.getClientName(),
                                        project.getDrawingNo(),
                                        project.getDrawingRevision(),
                                        project.getProductName(),
                                        project.getPlantCode(),
                                        project.getRequiredDate(),
                                        project.getRemarks(),
                                        project.isActive(),
                                        project.getRowVersion(),
                                        project.getCreatedBy(),
                                        project.getCreatedAt(),
                                        project.getUpdatedBy(),
                                        project.getUpdatedAt());
                }

                private void applyMaterial(
                                MatFlowMaterial material,
                                MaterialRequest request) {
                        material.setMaterialCode(
                                        request.materialCode());

                        material.setMaterialName(
                                        request.materialName());

                        material.setCategory(
                                        request.category());

                        material.setSpecification(
                                        request.specification());

                        material.setUom(
                                        request.uom());

                        material.setPreferredSupplier(
                                        request.preferredSupplier());

                        /*
                         * Legacy database columns are retained only for schema compatibility.
                         * Minimum stock and reorder level are NOT MatFlow functionality; Tally is
                         * the stock authority. Keep both inert at zero regardless of request data.
                         */
                        material.setMinimumStock(
                                        BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP));

                        material.setReorderLevel(
                                        BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP));

                        if (request.active() != null) {
                                material.setActive(
                                                request.active());
                        }
                }

                private void applyProject(
                                MatFlowProjectDrawing project,
                                ProjectDrawingRequest request,
                                String plantCode) {
                        project.setProjectCode(
                                        request.projectCode());

                        project.setProjectName(
                                        request.projectName());

                        project.setClientName(
                                        request.clientName());

                        project.setDrawingNo(
                                        request.drawingNo());

                        project.setDrawingRevision(
                                        normalizedRevision(
                                                        request.drawingRevision()));

                        project.setProductName(
                                        request.productName());

                        project.setPlantCode(plantCode);

                        project.setRequiredDate(
                                        request.requiredDate());

                        project.setRemarks(
                                        request.remarks());

                        if (request.active() != null) {
                                project.setActive(
                                                request.active());
                        }
                }

                private boolean hasApprovalCriticalChange(
                                MatFlowProjectDrawing project,
                                ProjectDrawingRequest request,
                                String plantCode) {
                        return !Objects.equals(upper(project.getProjectCode()), upper(request.projectCode()))
                                        || !Objects.equals(clean(project.getProjectName()),
                                                        clean(request.projectName()))
                                        || !Objects.equals(clean(project.getClientName()), clean(request.clientName()))
                                        || !Objects.equals(upper(project.getDrawingNo()), upper(request.drawingNo()))
                                        || !Objects.equals(normalizedRevision(project.getDrawingRevision()),
                                                        normalizedRevision(request.drawingRevision()))
                                        || !Objects.equals(clean(project.getProductName()),
                                                        clean(request.productName()))
                                        || !Objects.equals(upper(project.getPlantCode()), upper(plantCode));
                }

                private void resetProductApproval(
                                MatFlowProjectDrawing project) {
                        // Product creation/addition has no approval gate in MatFlow.
                        String actor = accessService.actor();
                        project.setProductApprovalStatus(ProjectProductApprovalStatus.APPROVED);
                        project.setProductApprovedBy(actor);
                        project.setProductApprovedAt(LocalDateTime.now());
                        project.setProductReturnedBy(null);
                        project.setProductReturnedAt(null);
                        project.setProductApprovalRemarks(null);
                }

                private void validateMaterialRequest(
                                MaterialRequest request) {
                        if (request == null) {
                                throw badRequest(
                                                "Material request is required");
                        }

                        required(
                                        request.materialCode(),
                                        "Material code");

                        required(
                                        request.materialName(),
                                        "Material name");

                        required(
                                        request.category(),
                                        "Material category");

                        required(
                                        request.uom(),
                                        "Material UOM");
                }

                private void validateProjectRequest(
                                ProjectDrawingRequest request) {
                        if (request == null) {
                                throw badRequest(
                                                "Project request is required");
                        }

                        required(
                                        request.projectCode(),
                                        "Project code");

                        required(
                                        request.projectName(),
                                        "Project name");

                        required(
                                        request.clientName(),
                                        "Client name");

                        required(
                                        request.drawingNo(),
                                        "Drawing number");

                        required(
                                        request.productName(),
                                        "Product name");

                        required(
                                        request.plantCode(),
                                        "Plant code");
                }

                private MaterialResponse toMaterialResponse(
                                MatFlowMaterial material) {
                        return new MaterialResponse(
                                        material.getId(),
                                        material.getMaterialCode(),
                                        material.getMaterialName(),
                                        material.getCategory(),
                                        material.getSpecification(),
                                        material.getUom(),
                                        material.getPreferredSupplier(),
                                        material.getMinimumStock(),
                                        material.getReorderLevel(),
                                        material.isActive(),
                                        material.getRowVersion(),
                                        material.getCreatedBy(),
                                        material.getCreatedAt(),
                                        material.getUpdatedBy(),
                                        material.getUpdatedAt());
                }

                private void assertVersion(
                                Long requested,
                                Long current,
                                String entityName) {
                        if (requested == null) {
                                throw badRequest(
                                                entityName +
                                                                " rowVersion is required");
                        }

                        if (!requested.equals(current)) {
                                throw conflict(
                                                entityName +
                                                                " was modified by another user. Refresh and try again.");
                        }
                }

                private BigDecimal nonNegative(
                                BigDecimal value,
                                String field) {
                        BigDecimal result = value == null
                                        ? BigDecimal.ZERO
                                        : value;

                        if (result.compareTo(
                                        BigDecimal.ZERO) < 0) {
                                throw badRequest(
                                                field +
                                                                " cannot be negative");
                        }

                        return result;
                }

                private void required(
                                String value,
                                String field) {
                        if (value == null ||
                                        value.trim().isBlank()) {
                                throw badRequest(
                                                field + " is required");
                        }
                }

                private String normalizedRevision(
                                String value) {
                        return value == null ||
                                        value.trim().isBlank()
                                                        ? "0"
                                                        : value.trim()
                                                                        .toUpperCase();
                }

                private String clean(String value) {
                        if (value == null) {
                                return null;
                        }
                        String result = value.trim();
                        return result.isBlank() ? null : result;
                }

                private String upper(String value) {
                        String result = clean(value);
                        return result == null ? null : result.toUpperCase(Locale.ROOT);
                }

                private String normalizeSearch(
                                String value) {
                        return value == null
                                        ? ""
                                        : value.trim()
                                                        .toLowerCase(
                                                                        Locale.ROOT);
                }

                private boolean contains(
                                String value,
                                String query) {
                        return value != null &&
                                        value.toLowerCase(
                                                        Locale.ROOT).contains(query);
                }

                private ResponseStatusException badRequest(
                                String message) {
                        return new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        message);
                }

                private ResponseStatusException conflict(
                                String message) {
                        return new ResponseStatusException(
                                        HttpStatus.CONFLICT,
                                        message);
                }

                private ResponseStatusException notFound(
                                String message) {
                        return new ResponseStatusException(
                                        HttpStatus.NOT_FOUND,
                                        message);
                }
        }

        private static final class InventoryModule {

                private final MatFlowLocationRepository locationRepository;
                private final MatFlowAccessService accessService;

                InventoryModule(
                                MatFlowLocationRepository locationRepository,
                                MatFlowAccessService accessService) {
                        this.locationRepository = locationRepository;
                        this.accessService = accessService;
                }

                @Transactional(readOnly = true)
                public List<ProcessingUnitResponse> listProcessingUnits(String search, Boolean active) {
                        accessService.requireRead();
                        String query = normalizeSearch(search);
                        return locationRepository.findByPlantCodeInOrderByLocationCodeAsc(accessService.allowedPlants())
                                        .stream()
                                        .filter(unit -> unit != null)
                                        .filter(unit -> unit.getLocationType() == LocationType.PROCESSING
                                                        || unit.getLocationType() == LocationType.EXTERNAL_PROCESSOR)
                                        .filter(unit -> active == null || unit.isActive() == active)
                                        .filter(unit -> query.isBlank()
                                                        || contains(unit.getLocationCode(), query)
                                                        || contains(unit.getLocationName(), query)
                                                        || contains(unit.getPlantCode(), query))
                                        .map(this::toProcessingUnitResponse)
                                        .toList();
                }

                @Transactional
                public ProcessingUnitResponse createProcessingUnit(ProcessingUnitRequest request) {
                        validateProcessingUnit(request);
                        String plant = upper(request.plantCode());
                        accessService.requirePlantAccess(plant);
                        String code = upper(request.processingUnitCode());
                        if (locationRepository.existsByLocationCodeIgnoreCase(code)) {
                                throw conflict("Processing Unit code already exists: " + code);
                        }
                        MatFlowLocation unit = new MatFlowLocation();
                        applyProcessingUnit(unit, request, true);
                        String actor = accessService.actor();
                        unit.setCreatedBy(actor);
                        unit.setUpdatedBy(actor);
                        return toProcessingUnitResponse(locationRepository.save(unit));
                }

                @Transactional
                public ProcessingUnitResponse updateProcessingUnit(UUID id, ProcessingUnitRequest request) {
                        validateProcessingUnit(request);
                        MatFlowLocation unit = locationRepository.findById(id)
                                        .orElseThrow(() -> notFound("Processing Unit not found"));
                        if (unit.getLocationType() != LocationType.PROCESSING
                                        && unit.getLocationType() != LocationType.EXTERNAL_PROCESSOR) {
                                throw badRequest("The selected record is not a Processing Unit");
                        }
                        assertVersion(request.rowVersion(), unit.getRowVersion(), "Processing Unit");
                        accessService.requirePlantAccess(upper(request.plantCode()));
                        String code = upper(request.processingUnitCode());
                        if (locationRepository.existsByLocationCodeIgnoreCaseAndIdNot(code, id)) {
                                throw conflict("Processing Unit code already exists: " + code);
                        }
                        applyProcessingUnit(unit, request, false);
                        unit.setUpdatedBy(accessService.actor());
                        return toProcessingUnitResponse(locationRepository.save(unit));
                }

                private void validateProcessingUnit(ProcessingUnitRequest request) {
                        if (request == null) throw badRequest("Processing Unit request is required");
                        required(request.processingUnitCode(), "Processing Unit code");
                        required(request.processingUnitName(), "Processing Unit name");
                        required(request.plantCode(), "Plant code");
                }

                private void applyProcessingUnit(MatFlowLocation unit, ProcessingUnitRequest request, boolean creating) {
                        unit.setLocationCode(upper(request.processingUnitCode()));
                        unit.setLocationName(clean(request.processingUnitName()));
                        unit.setPlantCode(upper(request.plantCode()));
                        unit.setLocationType(Boolean.TRUE.equals(request.external())
                                        ? LocationType.EXTERNAL_PROCESSOR : LocationType.PROCESSING);
                        unit.setOwnershipType(Boolean.TRUE.equals(request.external())
                                        ? OwnershipType.EXTERNAL : OwnershipType.INTERNAL);
                        unit.setSupportsStock(false);
                        unit.setAddress(clean(request.address()));
                        unit.setContactPerson(clean(request.contactPerson()));
                        unit.setContactPhone(clean(request.contactPhone()));
                        if (request.active() != null) unit.setActive(request.active());
                        else if (creating) unit.setActive(true);
                }

                private ProcessingUnitResponse toProcessingUnitResponse(MatFlowLocation unit) {
                        return new ProcessingUnitResponse(
                                        unit.getId(), unit.getLocationCode(), unit.getLocationName(),
                                        unit.getPlantCode(), unit.getLocationType() == LocationType.EXTERNAL_PROCESSOR,
                                        unit.getAddress(), unit.getContactPerson(), unit.getContactPhone(),
                                        unit.isActive(), unit.getRowVersion());
                }

                private BigDecimal zero(
                                BigDecimal value) {

                        return value == null
                                        ? BigDecimal.ZERO.setScale(
                                                        3,
                                                        RoundingMode.HALF_UP)
                                        : value.setScale(
                                                        3,
                                                        RoundingMode.HALF_UP);
                }

                private void assertVersion(
                                Long requested,
                                Long current,
                                String entity) {
                        if (requested == null) {
                                throw badRequest(
                                                entity +
                                                                " rowVersion is required");
                        }

                        if (!requested.equals(current)) {
                                throw conflict(
                                                entity +
                                                                " was modified by another user. Refresh and retry.");
                        }
                }

                private BigDecimal scale(
                                BigDecimal value) {
                        return value == null
                                        ? BigDecimal.ZERO
                                        : value.setScale(
                                                        3,
                                                        RoundingMode.HALF_UP);
                }

                private void required(
                                String value,
                                String field) {
                        if (value == null ||
                                        value.trim().isBlank()) {
                                throw badRequest(
                                                field + " is required");
                        }
                }

                private String clean(String value) {
                        if (value == null) {
                                return null;
                        }

                        String result = value.trim();

                        return result.isBlank()
                                        ? null
                                        : result;
                }

                private String upper(
                                String value) {

                        String result = clean(value);

                        return result == null
                                        ? null
                                        : result.toUpperCase(
                                                        Locale.ROOT);
                }

                private String normalizeSearch(
                                String value) {
                        return value == null
                                        ? ""
                                        : value.trim()
                                                        .toLowerCase(
                                                                        Locale.ROOT);
                }

                private boolean contains(
                                String value,
                                String query) {
                        return value != null &&
                                        value.toLowerCase(
                                                        Locale.ROOT).contains(query);
                }

                private ResponseStatusException badRequest(
                                String message) {
                        return new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        message);
                }

                private ResponseStatusException conflict(
                                String message) {
                        return new ResponseStatusException(
                                        HttpStatus.CONFLICT,
                                        message);
                }

                private ResponseStatusException notFound(
                                String message) {
                        return new ResponseStatusException(
                                        HttpStatus.NOT_FOUND,
                                        message);
                }
        }

        private static final class VendorModule {

                private final MatFlowVendorRepository vendorRepository;
                private final MatFlowAccessService accessService;

                VendorModule(
                                MatFlowVendorRepository vendorRepository,
                                MatFlowAccessService accessService) {
                        this.vendorRepository = vendorRepository;

                        this.accessService = accessService;
                }

                @Transactional(readOnly = true)
                public List<VendorResponse> list(
                                String search,
                                Boolean active) {
                        accessService.requireIndentRead();

                        String query = search == null
                                        ? ""
                                        : search.trim()
                                                        .toLowerCase(Locale.ROOT);

                        return vendorRepository
                                        .findAll(
                                                        Sort.by(
                                                                        Sort.Direction.ASC,
                                                                        "vendorName"))
                                        .stream()
                                        .filter(vendor -> active == null ||
                                                        vendor.active == active)
                                        .filter(vendor -> query.isBlank() ||
                                                        contains(
                                                                        vendor.vendorCode,
                                                                        query)
                                                        ||
                                                        contains(
                                                                        vendor.vendorName,
                                                                        query)
                                                        ||
                                                        contains(
                                                                        vendor.gstin,
                                                                        query))
                                        .map(this::toResponse)
                                        .toList();
                }

                @Transactional
                public VendorResponse create(
                                VendorRequest request) {
                        accessService.requireVendorWrite();

                        validate(request);

                        String code = upper(request.vendorCode());

                        if (vendorRepository
                                        .existsByVendorCodeIgnoreCase(
                                                        code)) {
                                throw conflict(
                                                "Vendor code already exists: " +
                                                                code);
                        }

                        String actor = accessService.actor();

                        MatFlowVendor vendor = new MatFlowVendor();

                        apply(vendor, request);

                        vendor.setCreatedBy(actor);
                        vendor.setUpdatedBy(actor);

                        return toResponse(
                                        vendorRepository.save(vendor));
                }

                @Transactional
                public VendorResponse update(
                                UUID id,
                                VendorRequest request) {
                        accessService.requireVendorWrite();

                        validate(request);

                        MatFlowVendor vendor = vendorRepository
                                        .findById(id)
                                        .orElseThrow(() -> notFound(
                                                        "Vendor not found"));

                        assertVersion(
                                        request.rowVersion(),
                                        vendor.getRowVersion());

                        String code = upper(request.vendorCode());

                        if (vendorRepository
                                        .existsByVendorCodeIgnoreCaseAndIdNot(
                                                        code,
                                                        id)) {
                                throw conflict(
                                                "Vendor code already exists: " +
                                                                code);
                        }

                        apply(vendor, request);

                        vendor.setUpdatedBy(
                                        accessService.actor());

                        return toResponse(
                                        vendorRepository.save(vendor));
                }

                private void apply(
                                MatFlowVendor vendor,
                                VendorRequest request) {
                        vendor.vendorCode = upper(request.vendorCode());

                        vendor.vendorName = clean(request.vendorName());

                        vendor.gstin = upper(request.gstin());

                        vendor.contactPerson = clean(request.contactPerson());

                        vendor.phone = clean(request.contactPhone());

                        vendor.email = clean(request.email());

                        vendor.address = clean(request.address());

                        if (request.active() != null) {
                                vendor.active = request.active();
                        }
                }

                private void validate(
                                VendorRequest request) {
                        if (request == null) {
                                throw badRequest(
                                                "Vendor request is required");
                        }

                        required(
                                        request.vendorCode(),
                                        "Vendor code");

                        required(
                                        request.vendorName(),
                                        "Vendor name");
                }

                private VendorResponse toResponse(
                                MatFlowVendor vendor) {
                        return new VendorResponse(
                                        vendor.getId(),
                                        vendor.vendorCode,
                                        vendor.vendorName,
                                        vendor.gstin,
                                        vendor.contactPerson,
                                        vendor.phone,
                                        vendor.email,
                                        vendor.address,
                                        vendor.active,
                                        vendor.getRowVersion());
                }

                private boolean contains(
                                String value,
                                String query) {
                        return value != null &&
                                        value.toLowerCase(
                                                        Locale.ROOT).contains(query);
                }

                private void required(
                                String value,
                                String field) {
                        if (value == null ||
                                        value.trim().isBlank()) {
                                throw badRequest(
                                                field + " is required");
                        }
                }

                private void assertVersion(
                                Long requested,
                                Long current) {
                        if (requested == null) {
                                throw badRequest(
                                                "Vendor rowVersion is required");
                        }

                        if (!requested.equals(current)) {
                                throw conflict(
                                                "Vendor was modified by another user");
                        }
                }

                private String clean(String value) {
                        if (value == null) {
                                return null;
                        }

                        String result = value.trim();

                        return result.isBlank()
                                        ? null
                                        : result;
                }

                private String upper(String value) {
                        String result = clean(value);

                        return result == null
                                        ? null
                                        : result.toUpperCase();
                }

                private ResponseStatusException badRequest(
                                String message) {
                        return new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        message);
                }

                private ResponseStatusException conflict(
                                String message) {
                        return new ResponseStatusException(
                                        HttpStatus.CONFLICT,
                                        message);
                }

                private ResponseStatusException notFound(
                                String message) {
                        return new ResponseStatusException(
                                        HttpStatus.NOT_FOUND,
                                        message);
                }
        }
}
