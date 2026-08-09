package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RouteStepRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RouteStepResponse;

import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.ApprovalHistoryResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.BomActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.BomCreateRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.BomDetailResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.BomLineRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.BomLineResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.BomSummaryResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.BomUpdateRequest;

import com.alsorg.packing.domain.matflow.*;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.LocationType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ProjectProductApprovalStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RouteStepType;
import com.alsorg.packing.repository.matflow.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * BOM aggregate service: Engineering BOM authoring, approved material routes,
 * revision control and direct Production review/approval.
 *
 * The former HOD intermediate service step is intentionally removed from the
 * public service contract: SUBMITTED -> APPROVED/RETURNED is now a Production
 * decision, matching the agreed MatFlow workflow.
 */
@Service
public class MatFlowBomService {

        private final BomModule bom;
        private final RoutingModule routing;

        public MatFlowBomService(
                        MatFlowBomRepository bomRepository,
                        MatFlowBomLineRepository lineRepository,
                        MatFlowMaterialRepository materialRepository,
                        MatFlowProjectDrawingRepository projectRepository,
                        MatFlowBomApprovalHistoryRepository historyRepository,
                        MatFlowBomRouteStepRepository routeRepository,
                        MatFlowLocationRepository locationRepository,
                        MatFlowAccessService accessService,
                        MatFlowMasterDataService masterService,
                        MatFlowAuditService auditService) {

                this.routing = new RoutingModule(
                                bomRepository, lineRepository, routeRepository, locationRepository, accessService);

                this.bom = new BomModule(
                                bomRepository,
                                lineRepository,
                                materialRepository,
                                projectRepository,
                                historyRepository,
                                auditService,
                                accessService,
                                masterService,
                                routing);
        }

        @Transactional(readOnly = true)
        public List<BomSummaryResponse> list(String search, MatFlowBomStatus status, Boolean latestOnly) {
                return bom.list(search, status, latestOnly);
        }

        @Transactional(readOnly = true)
        public BomDetailResponse get(UUID id) {
                return bom.get(id);
        }

        @Transactional
        public BomDetailResponse create(BomCreateRequest request) {
                return bom.create(request);
        }

        @Transactional
        public BomDetailResponse update(UUID id, BomUpdateRequest request) {
                return bom.update(id, request);
        }

        @Transactional
        public BomDetailResponse addLine(UUID bomId, BomLineRequest request) {
                return bom.addLine(bomId, request);
        }

        @Transactional
        public BomDetailResponse updateLine(UUID bomId, UUID lineId, BomLineRequest request) {
                return bom.updateLine(bomId, lineId, request);
        }

        @Transactional
        public BomDetailResponse deleteLine(UUID bomId, UUID lineId, Long rowVersion) {
                return bom.deleteLine(bomId, lineId, rowVersion);
        }

        @Transactional
        public BomDetailResponse submit(UUID id, BomActionRequest request) {
                return bom.submit(id, request);
        }

        @Transactional
        public BomDetailResponse approveByProduction(UUID id, BomActionRequest request) {
                return bom.productionApprove(id, request);
        }

        @Transactional
        public BomDetailResponse returnByProduction(UUID id, BomActionRequest request) {
                return bom.productionReturn(id, request);
        }

        @Transactional
        public BomDetailResponse createRevision(UUID id, BomActionRequest request) {
                return bom.createRevision(id, request);
        }

        @Transactional(readOnly = true)
        public List<RouteStepResponse> listRoutes(UUID bomId) {
                return routing.listBomRoutes(bomId);
        }

        @Transactional
        public RouteStepResponse addRouteStep(UUID bomId, UUID lineId, RouteStepRequest request) {
                return routing.addStep(bomId, lineId, request);
        }

        @Transactional
        public RouteStepResponse updateRouteStep(
                        UUID bomId, UUID lineId, UUID stepId, RouteStepRequest request) {
                return routing.updateStep(bomId, lineId, stepId, request);
        }

        @Transactional
        public void deleteRouteStep(UUID bomId, UUID lineId, UUID stepId, Long rowVersion) {
                routing.deleteStep(bomId, lineId, stepId, rowVersion);
        }

        @Transactional(readOnly = true)
        public void validateBomForSubmission(MatFlowBom bomEntity) {
                routing.validateBomForSubmission(bomEntity);
        }

        @Transactional(readOnly = true)
        public List<MatFlowBomRouteStep> routeForLine(UUID bomLineId) {
                return routing.routeForLine(bomLineId);
        }

        private static final class BomModule {

                private final MatFlowBomRepository bomRepository;
                private final MatFlowBomLineRepository lineRepository;
                private final MatFlowMaterialRepository materialRepository;
                private final MatFlowProjectDrawingRepository projectRepository;
                private final MatFlowBomApprovalHistoryRepository historyRepository;
                private final MatFlowAuditService auditService;
                private final MatFlowAccessService accessService;
                private final MatFlowMasterDataService masterService;
                private final RoutingModule routingService;

                BomModule(
                                MatFlowBomRepository bomRepository,
                                MatFlowBomLineRepository lineRepository,
                                MatFlowMaterialRepository materialRepository,
                                MatFlowProjectDrawingRepository projectRepository,
                                MatFlowBomApprovalHistoryRepository historyRepository,
                                MatFlowAuditService auditService,
                                MatFlowAccessService accessService,
                                MatFlowMasterDataService masterService,
                                RoutingModule routingService) {
                        this.bomRepository = bomRepository;
                        this.lineRepository = lineRepository;
                        this.materialRepository = materialRepository;
                        this.projectRepository = projectRepository;
                        this.historyRepository = historyRepository;
                        this.auditService = auditService;
                        this.accessService = accessService;
                        this.masterService = masterService;
                        this.routingService = routingService;
                }

                @Transactional(readOnly = true)
                public List<BomSummaryResponse> list(
                                String search,
                                MatFlowBomStatus status,
                                Boolean latestOnly) {
                        accessService.requireRead();

                        String query = normalizeSearch(search);

                        return bomRepository
                                        .findAllByOrderByUpdatedAtDesc()
                                        .stream()
                                        .filter(bom -> accessService.canAccessPlant(
                                                        bom.getProjectDrawing()
                                                                        .getPlantCode()))
                                        .filter(bom -> status == null ||
                                                        bom.getStatus() == status)
                                        .filter(bom -> latestOnly == null ||
                                                        !latestOnly ||
                                                        bom.isLatestRevision())
                                        .filter(bom -> query.isBlank() ||
                                                        contains(
                                                                        bom.getBomNumber(),
                                                                        query)
                                                        ||
                                                        contains(
                                                                        bom.getProjectDrawing()
                                                                                        .getProjectCode(),
                                                                        query)
                                                        ||
                                                        contains(
                                                                        bom.getProjectDrawing()
                                                                                        .getDrawingNo(),
                                                                        query)
                                                        ||
                                                        contains(
                                                                        bom.getProjectDrawing()
                                                                                        .getProductName(),
                                                                        query)
                                                        ||
                                                        contains(
                                                                        bom.getProjectDrawing()
                                                                                        .getClientName(),
                                                                        query))
                                        .map(this::toSummary)
                                        .toList();
                }

                @Transactional(readOnly = true)
                public BomDetailResponse get(
                                UUID id) {
                        accessService.requireRead();

                        MatFlowBom bom = requireBom(id);

                        return toDetail(bom);
                }

                @Transactional
                public BomDetailResponse create(
                                BomCreateRequest request) {
                        accessService.requireEngineeringWrite();

                        if (request == null ||
                                        request.projectDrawingId() == null) {
                                throw badRequest(
                                                "Project drawing is required");
                        }

                        MatFlowProjectDrawing project = requireProject(
                                        request.projectDrawingId());

                        if (!project.isActive()) {
                                throw badRequest(
                                                "Inactive project drawing cannot be used");
                        }

                        requireApprovedProduct(project);

                        String actor = accessService.actor();

                        UUID revisionGroupId = UUID.randomUUID();

                        MatFlowBom bom = new MatFlowBom();

                        bom.setBomNumber(
                                        generateBomNumber());

                        bom.setRevisionGroupId(
                                        revisionGroupId);

                        bom.setRevisionNo(0);
                        bom.setProjectDrawing(project);
                        bom.setStatus(
                                        MatFlowBomStatus.DRAFT);
                        bom.setLatestRevision(true);
                        bom.setEffective(false);
                        bom.setRemarks(request.remarks());
                        bom.setCreatedBy(actor);
                        bom.setUpdatedBy(actor);

                        bom = bomRepository.save(bom);

                        saveHistory(
                                        bom,
                                        MatFlowApprovalAction.CREATED,
                                        null,
                                        MatFlowBomStatus.DRAFT,
                                        request.remarks(),
                                        actor);

                        saveAudit(
                                        bom,
                                        "BOM_CREATED",
                                        auditDetails(
                                                        "bomNumber",
                                                        bom.getBomNumber(),
                                                        "revisionNo",
                                                        bom.getRevisionNo()),
                                        actor);

                        return toDetail(bom);
                }

                @Transactional
                public BomDetailResponse update(
                                UUID id,
                                BomUpdateRequest request) {
                        accessService.requireEngineeringWrite();

                        MatFlowBom bom = requireBom(id);

                        requireEditable(bom);

                        if (request == null) {
                                throw badRequest(
                                                "BOM update request is required");
                        }

                        assertVersion(
                                        request.rowVersion(),
                                        bom.getRowVersion(),
                                        "BOM");

                        if (request.projectDrawingId() != null &&
                                        !request.projectDrawingId()
                                                        .equals(
                                                                        bom.getProjectDrawing()
                                                                                        .getId())) {
                                MatFlowProjectDrawing project = requireProject(
                                                request.projectDrawingId());

                                if (!project.isActive()) {
                                        throw badRequest(
                                                        "Inactive project drawing cannot be used");
                                }

                                requireApprovedProduct(project);
                                bom.setProjectDrawing(project);
                        }

                        bom.setRemarks(
                                        request.remarks());

                        String actor = accessService.actor();

                        bom.setUpdatedBy(actor);

                        bom = bomRepository.save(bom);

                        saveHistory(
                                        bom,
                                        MatFlowApprovalAction.UPDATED,
                                        bom.getStatus(),
                                        bom.getStatus(),
                                        request.remarks(),
                                        actor);

                        saveAudit(
                                        bom,
                                        "BOM_UPDATED",
                                        auditDetails(
                                                        "revisionNo",
                                                        bom.getRevisionNo()),
                                        actor);

                        return toDetail(bom);
                }

                @Transactional
                public BomDetailResponse addLine(
                                UUID bomId,
                                BomLineRequest request) {

                        accessService.requireEngineeringWrite();

                        MatFlowBom bom = requireBom(bomId);

                        requireEditable(bom);
                        validateLineRequest(request);

                        MatFlowMaterial material = materialRepository
                                        .findById(request.materialId())
                                        .orElseThrow(() -> notFound(
                                                        "Material not found"));

                        if (!material.isActive()) {
                                throw badRequest(
                                                "Inactive material cannot be added");
                        }

                        /*
                         * Protect old or incomplete material-master records.
                         * New material creation already validates these values,
                         * but old database records may still be incomplete.
                         */
                        if (clean(material.getMaterialCode()) == null) {
                                throw conflict(
                                                "Selected material has no material code. " +
                                                                "Correct the material master and try again.");
                        }

                        if (clean(material.getMaterialName()) == null) {
                                throw conflict(
                                                "Selected material has no material name. " +
                                                                "Correct the material master and try again.");
                        }

                        if (clean(material.getUom()) == null) {
                                throw conflict(
                                                "Selected material has no UOM. " +
                                                                "Correct the material master and try again.");
                        }

                        String actor = accessService.actor();

                        MatFlowBomLine line = new MatFlowBomLine();

                        line.setBom(bom);
                        line.setMaterial(material);
                        line.setLineNo(nextLineNo(bomId));

                        applyLineValues(
                                        line,
                                        material,
                                        request);

                        line.setCreatedBy(actor);
                        line.setUpdatedBy(actor);

                        /*
                         * Always retain the object returned by save().
                         * It is the managed entity and is the safest object
                         * from which to read the generated identifier/version.
                         */
                        MatFlowBomLine savedLine = lineRepository.save(line);

                        bom.setUpdatedBy(actor);

                        MatFlowBom savedBom = bomRepository.save(bom);

                        saveHistory(
                                        savedBom,
                                        MatFlowApprovalAction.LINE_ADDED,
                                        savedBom.getStatus(),
                                        savedBom.getStatus(),
                                        material.getMaterialCode(),
                                        actor);

                        /*
                         * Do not use Map.of(...) here.
                         * Map.of rejects null values and can therefore crash
                         * the whole transaction while only creating audit data.
                         */
                        saveAudit(
                                        savedBom,
                                        "BOM_LINE_ADDED",
                                        auditDetails(
                                                        "lineId",
                                                        savedLine.getId(),

                                                        "materialId",
                                                        material.getId(),

                                                        "materialCode",
                                                        material.getMaterialCode(),

                                                        "netRequiredQty",
                                                        savedLine.getNetRequiredQty()),
                                        actor);

                        return toDetail(savedBom);
                }

                @Transactional
                public BomDetailResponse updateLine(
                                UUID bomId,
                                UUID lineId,
                                BomLineRequest request) {
                        accessService.requireEngineeringWrite();

                        MatFlowBom bom = requireBom(bomId);

                        requireEditable(bom);
                        validateLineRequest(request);

                        MatFlowBomLine line = lineRepository
                                        .findById(lineId)
                                        .orElseThrow(() -> notFound(
                                                        "BOM line not found"));

                        if (!line.getBom()
                                        .getId()
                                        .equals(bomId)) {
                                throw badRequest(
                                                "BOM line does not belong to this BOM");
                        }

                        assertVersion(
                                        request.rowVersion(),
                                        line.getRowVersion(),
                                        "BOM line");

                        MatFlowMaterial material = materialRepository
                                        .findById(
                                                        request.materialId())
                                        .orElseThrow(() -> notFound(
                                                        "Material not found"));

                        if (!material.isActive()) {
                                throw badRequest(
                                                "Inactive material cannot be used");
                        }

                        applyLineValues(
                                        line,
                                        material,
                                        request);

                        String actor = accessService.actor();

                        line.setUpdatedBy(actor);
                        lineRepository.save(line);

                        bom.setUpdatedBy(actor);
                        bomRepository.save(bom);

                        saveHistory(
                                        bom,
                                        MatFlowApprovalAction.LINE_UPDATED,
                                        bom.getStatus(),
                                        bom.getStatus(),
                                        material.getMaterialCode(),
                                        actor);

                        saveAudit(
                                        bom,
                                        "BOM_LINE_UPDATED",
                                        auditDetails(
                                                        "lineId",
                                                        line.getId(),

                                                        "materialId",
                                                        material.getId(),

                                                        "materialCode",
                                                        material.getMaterialCode(),

                                                        "materialCategory",
                                                        line.getMaterialCategorySnapshot(),

                                                        "netRequiredQty",
                                                        line.getNetRequiredQty()),
                                        actor);

                        return toDetail(bom);
                }

                @Transactional
                public BomDetailResponse deleteLine(
                                UUID bomId,
                                UUID lineId,
                                Long rowVersion) {
                        accessService.requireEngineeringWrite();

                        MatFlowBom bom = requireBom(bomId);

                        requireEditable(bom);

                        MatFlowBomLine line = lineRepository
                                        .findById(lineId)
                                        .orElseThrow(() -> notFound(
                                                        "BOM line not found"));

                        if (!line.getBom()
                                        .getId()
                                        .equals(bomId)) {
                                throw badRequest(
                                                "BOM line does not belong to this BOM");
                        }

                        assertVersion(
                                        rowVersion,
                                        line.getRowVersion(),
                                        "BOM line");

                        String materialCode = line.getMaterialCodeSnapshot();

                        /*
                         * Routing now belongs to this aggregate service. Remove route
                         * children explicitly before deleting the BOM line so this does
                         * not depend on an implicit JPA cascade configuration.
                         */
                        routingService.deleteRoutesForLine(lineId);

                        lineRepository.delete(line);

                        String actor = accessService.actor();

                        bom.setUpdatedBy(actor);
                        bomRepository.save(bom);

                        saveHistory(
                                        bom,
                                        MatFlowApprovalAction.LINE_REMOVED,
                                        bom.getStatus(),
                                        bom.getStatus(),
                                        materialCode,
                                        actor);

                        saveAudit(
                                        bom,
                                        "BOM_LINE_REMOVED",
                                        auditDetails(
                                                        "lineId",
                                                        lineId,
                                                        "materialCode",
                                                        materialCode),
                                        actor);

                        return toDetail(bom);
                }

                @Transactional
                public BomDetailResponse submit(
                                UUID id,
                                BomActionRequest request) {
                        accessService.requireEngineeringWrite();

                        MatFlowBom bom = requireBom(id);

                        requireEditable(bom);

                        assertActionVersion(
                                        request,
                                        bom);

                        requireApprovedProduct(bom.getProjectDrawing());

                        List<MatFlowBomLine> lines = lineRepository
                                        .findByBom_IdOrderByLineNoAsc(
                                                        bom.getId());

                        if (lines.isEmpty()) {
                                throw badRequest(
                                                "At least one material line is required before submission");
                        }

                        routingService.validateBomForSubmission(
                                        bom);

                        MatFlowBomStatus previous = bom.getStatus();

                        String actor = accessService.actor();

                        bom.setStatus(
                                        MatFlowBomStatus.SUBMITTED);

                        bom.setSubmittedBy(actor);
                        bom.setSubmittedAt(
                                        LocalDateTime.now());

                        bom.setReturnedBy(null);
                        bom.setReturnedAt(null);
                        bom.setReturnRemarks(null);
                        /*
                         * A returned BOM must pass through a fresh Production review
                         * when Engineering resubmits it.
                         */
                        bom.setProductionReviewedBy(
                                        null);

                        bom.setProductionReviewedAt(
                                        null);

                        bom.setProductionReviewRemarks(
                                        null);

                        bom.setApprovedBy(
                                        null);

                        bom.setApprovedAt(
                                        null);

                        bom.setEffective(
                                        false);
                        bom.setUpdatedBy(actor);

                        bom = bomRepository.save(bom);

                        saveHistory(
                                        bom,
                                        MatFlowApprovalAction.SUBMITTED,
                                        previous,
                                        MatFlowBomStatus.SUBMITTED,
                                        request == null
                                                        ? null
                                                        : request.remarks(),
                                        actor);

                        saveAudit(
                                        bom,
                                        "BOM_SUBMITTED",
                                        auditDetails(
                                                        "lineCount",
                                                        lines.size(),
                                                        "revisionNo",
                                                        bom.getRevisionNo()),
                                        actor);

                        return toDetail(bom);
                }

                @Transactional
                public BomDetailResponse productionApprove(
                                UUID id,
                                BomActionRequest request) {

                        accessService.requireProductionBomReview();

                        MatFlowBom bom = requireBom(
                                        id);

                        if (bom.getStatus() != MatFlowBomStatus.SUBMITTED) {

                                throw conflict(
                                                "Only a submitted BOM can be approved by Production");
                        }

                        assertActionVersion(
                                        request,
                                        bom);

                        String actor = accessService.actor();

                        String reviewRemarks = request == null
                                        ? null
                                        : clean(
                                                        request.remarks());

                        /*
                         * Final Production approval is the point where the previous
                         * effective revision may safely be superseded.
                         */
                        bomRepository
                                        .findFirstByRevisionGroupIdAndEffectiveTrue(
                                                        bom.getRevisionGroupId())
                                        .filter(previous -> !previous.getId()
                                                        .equals(
                                                                        bom.getId()))
                                        .ifPresent(previous -> {

                                                MatFlowBomStatus previousStatus = previous.getStatus();

                                                previous.setEffective(
                                                                false);

                                                previous.setStatus(
                                                                MatFlowBomStatus.SUPERSEDED);

                                                previous.setLatestRevision(
                                                                false);

                                                previous.setUpdatedBy(
                                                                actor);

                                                MatFlowBom supersededBom = bomRepository.save(
                                                                previous);

                                                saveHistory(
                                                                supersededBom,
                                                                MatFlowApprovalAction.SUPERSEDED,
                                                                previousStatus,
                                                                MatFlowBomStatus.SUPERSEDED,
                                                                "Superseded by revision " +
                                                                                bom.getRevisionNo(),
                                                                actor);

                                                saveAudit(
                                                                supersededBom,
                                                                "BOM_SUPERSEDED",
                                                                auditDetails(
                                                                                "supersededByBomId",
                                                                                bom.getId(),

                                                                                "supersededByRevisionNo",
                                                                                bom.getRevisionNo()),
                                                                actor);
                                        });

                        bom.setStatus(
                                        MatFlowBomStatus.APPROVED);

                        bom.setEffective(
                                        true);

                        bom.setLatestRevision(
                                        true);

                        bom.setProductionReviewedBy(
                                        actor);

                        bom.setProductionReviewedAt(
                                        LocalDateTime.now());

                        bom.setProductionReviewRemarks(
                                        reviewRemarks);

                        /*
                         * These are the final approval fields.
                         */
                        bom.setApprovedBy(
                                        actor);

                        bom.setApprovedAt(
                                        LocalDateTime.now());

                        bom.setUpdatedBy(
                                        actor);

                        MatFlowBom approvedBom = bomRepository.saveAndFlush(
                                        bom);

                        saveHistory(
                                        approvedBom,
                                        MatFlowApprovalAction.PRODUCTION_APPROVED,
                                        MatFlowBomStatus.SUBMITTED,
                                        MatFlowBomStatus.APPROVED,
                                        reviewRemarks,
                                        actor);

                        saveAudit(
                                        approvedBom,
                                        "BOM_PRODUCTION_APPROVED",
                                        auditDetails(
                                                        "revisionNo",
                                                        approvedBom.getRevisionNo(),

                                                        "effective",
                                                        true,

                                                        "productionReviewedBy",
                                                        actor),
                                        actor);

                        return toDetail(
                                        approvedBom);
                }

                @Transactional
                public BomDetailResponse productionReturn(
                                UUID id,
                                BomActionRequest request) {

                        accessService.requireProductionBomReview();

                        MatFlowBom bom = requireBom(
                                        id);

                        if (bom.getStatus() != MatFlowBomStatus.SUBMITTED) {

                                throw conflict(
                                                "Only a submitted BOM can be returned by Production");
                        }

                        assertActionVersion(
                                        request,
                                        bom);

                        String remarks = request == null
                                        ? null
                                        : clean(
                                                        request.remarks());

                        if (remarks == null) {
                                throw badRequest(
                                                "Production return remarks are required");
                        }

                        String actor = accessService.actor();

                        bom.setStatus(
                                        MatFlowBomStatus.RETURNED);

                        bom.setEffective(
                                        false);

                        bom.setReturnedBy(
                                        actor);

                        bom.setReturnedAt(
                                        LocalDateTime.now());

                        bom.setReturnRemarks(
                                        remarks);

                        bom.setProductionReviewedBy(
                                        actor);

                        bom.setProductionReviewedAt(
                                        LocalDateTime.now());

                        bom.setProductionReviewRemarks(
                                        remarks);

                        bom.setApprovedBy(
                                        null);

                        bom.setApprovedAt(
                                        null);

                        bom.setUpdatedBy(
                                        actor);

                        MatFlowBom returnedBom = bomRepository.saveAndFlush(
                                        bom);

                        saveHistory(
                                        returnedBom,
                                        MatFlowApprovalAction.PRODUCTION_RETURNED,
                                        MatFlowBomStatus.SUBMITTED,
                                        MatFlowBomStatus.RETURNED,
                                        remarks,
                                        actor);

                        saveAudit(
                                        returnedBom,
                                        "BOM_RETURNED_BY_PRODUCTION",
                                        auditDetails(
                                                        "remarks",
                                                        remarks,

                                                        "returnedBy",
                                                        actor),
                                        actor);

                        return toDetail(
                                        returnedBom);
                }

                @Transactional
                public BomDetailResponse createRevision(
                                UUID id,
                                BomActionRequest request) {
                        accessService.requireEngineeringWrite();

                        MatFlowBom source = requireBom(id);

                        if (source.getStatus() != MatFlowBomStatus.APPROVED ||
                                        !source.isEffective() ||
                                        !source.isLatestRevision()) {
                                throw conflict(
                                                "A new revision can only be created from the latest effective approved BOM");
                        }

                        assertActionVersion(
                                        request,
                                        source);

                        requireApprovedProduct(source.getProjectDrawing());

                        MatFlowBom latest = bomRepository
                                        .findFirstByRevisionGroupIdOrderByRevisionNoDesc(
                                                        source.getRevisionGroupId())
                                        .orElse(source);

                        /*
                         * Direct Production-review workflow:
                         * DRAFT / RETURNED / SUBMITTED are the only open revision states.
                         * PRODUCTION_REVIEW_PENDING belongs to the removed intermediate
                         * workflow and is intentionally not used here.
                         */
                        if (latest.getStatus() == MatFlowBomStatus.DRAFT ||
                                        latest.getStatus() == MatFlowBomStatus.RETURNED ||
                                        latest.getStatus() == MatFlowBomStatus.SUBMITTED) {
                                throw conflict(
                                                "An open revision already exists for this BOM");
                        }

                        String actor = accessService.actor();

                        latest.setLatestRevision(false);
                        latest.setUpdatedBy(actor);
                        bomRepository.save(latest);

                        MatFlowBom revision = new MatFlowBom();

                        revision.setBomNumber(source.getBomNumber());
                        revision.setRevisionGroupId(source.getRevisionGroupId());
                        revision.setRevisionNo(latest.getRevisionNo() + 1);
                        revision.setProjectDrawing(source.getProjectDrawing());
                        revision.setStatus(MatFlowBomStatus.DRAFT);
                        revision.setLatestRevision(true);
                        revision.setEffective(false);
                        revision.setRemarks(
                                        request == null || clean(request.remarks()) == null
                                                        ? source.getRemarks()
                                                        : clean(request.remarks()));
                        revision.setCreatedBy(actor);
                        revision.setUpdatedBy(actor);

                        revision = bomRepository.save(revision);

                        List<MatFlowBomLine> sourceLines = lineRepository
                                        .findByBom_IdOrderByLineNoAsc(source.getId());

                        for (MatFlowBomLine sourceLine : sourceLines) {
                                MatFlowBomLine copied = new MatFlowBomLine();

                                copied.setBom(revision);
                                copied.setMaterial(sourceLine.getMaterial());
                                copied.setLineNo(sourceLine.getLineNo());
                                copied.setMaterialCodeSnapshot(sourceLine.getMaterialCodeSnapshot());
                                copied.setMaterialNameSnapshot(sourceLine.getMaterialNameSnapshot());

                                String copiedCategory = clean(
                                                sourceLine.getMaterialCategorySnapshot());

                                if (copiedCategory == null && sourceLine.getMaterial() != null) {
                                        copiedCategory = normalizeMaterialCategory(
                                                        sourceLine.getMaterial().getCategory());
                                }

                                if (copiedCategory == null) {
                                        copiedCategory = "MISCELLANEOUS";
                                }

                                copied.setMaterialCategorySnapshot(copiedCategory);
                                copied.setSpecificationSnapshot(sourceLine.getSpecificationSnapshot());
                                copied.setUomSnapshot(sourceLine.getUomSnapshot());
                                copied.setRequiredQty(sourceLine.getRequiredQty());
                                copied.setWastagePercent(sourceLine.getWastagePercent());
                                copied.setNetRequiredQty(sourceLine.getNetRequiredQty());
                                copied.setRemarks(sourceLine.getRemarks());
                                copied.setCreatedBy(actor);
                                copied.setUpdatedBy(actor);

                                MatFlowBomLine savedCopy = lineRepository.save(copied);

                                /*
                                 * A BOM revision must preserve the approved routing
                                 * snapshot. Engineering can then edit the copied route
                                 * while the new revision remains Draft.
                                 */
                                routingService.copyRoute(
                                                sourceLine.getId(),
                                                savedCopy,
                                                actor);
                        }

                        saveHistory(
                                        revision,
                                        MatFlowApprovalAction.REVISION_CREATED,
                                        source.getStatus(),
                                        MatFlowBomStatus.DRAFT,
                                        request == null ? null : request.remarks(),
                                        actor);

                        saveAudit(
                                        revision,
                                        "BOM_REVISION_CREATED",
                                        auditDetails(
                                                        "sourceBomId", source.getId(),
                                                        "sourceRevisionNo", source.getRevisionNo(),
                                                        "newRevisionNo", revision.getRevisionNo(),
                                                        "copiedLineCount", sourceLines.size()),
                                        actor);

                        return toDetail(revision);
                }

                private void applyLineValues(
                                MatFlowBomLine line,
                                MatFlowMaterial material,
                                BomLineRequest request) {

                        BigDecimal requiredQty = request.requiredQty();

                        BigDecimal wastage = request.wastagePercent() == null
                                        ? BigDecimal.ZERO
                                        : request.wastagePercent();

                        if (requiredQty == null ||
                                        requiredQty.compareTo(BigDecimal.ZERO) <= 0) {
                                throw badRequest(
                                                "Required quantity must be greater than zero");
                        }

                        if (wastage.compareTo(BigDecimal.ZERO) < 0 ||
                                        wastage.compareTo(new BigDecimal("1000")) > 0) {
                                throw badRequest(
                                                "Wastage percentage must be between 0 and 1000");
                        }

                        String materialCode = clean(material.getMaterialCode());
                        String materialName = clean(material.getMaterialName());
                        String materialUom = clean(material.getUom());

                        if (materialCode == null) {
                                throw conflict(
                                                "Selected material has no material code. Correct the material master and try again.");
                        }

                        if (materialName == null) {
                                throw conflict(
                                                "Selected material has no material name. Correct the material master and try again.");
                        }

                        if (materialUom == null) {
                                throw conflict(
                                                "Selected material has no UOM. Correct the material master and try again.");
                        }

                        String materialCategory = normalizeMaterialCategory(
                                        material.getCategory());

                        BigDecimal wastageQuantity = requiredQty
                                        .multiply(wastage)
                                        .divide(
                                                        new BigDecimal("100"),
                                                        6,
                                                        RoundingMode.HALF_UP);

                        BigDecimal netRequiredQty = requiredQty
                                        .add(wastageQuantity)
                                        .setScale(
                                                        3,
                                                        RoundingMode.HALF_UP);

                        line.setMaterial(material);
                        line.setMaterialCodeSnapshot(materialCode);
                        line.setMaterialNameSnapshot(materialName);
                        line.setMaterialCategorySnapshot(materialCategory);
                        line.setSpecificationSnapshot(clean(material.getSpecification()));
                        line.setUomSnapshot(materialUom.toUpperCase(Locale.ROOT));
                        line.setRequiredQty(requiredQty.setScale(3, RoundingMode.HALF_UP));
                        line.setWastagePercent(wastage.setScale(3, RoundingMode.HALF_UP));
                        line.setNetRequiredQty(netRequiredQty);
                        line.setRemarks(clean(request.remarks()));
                }

                private void validateLineRequest(
                                BomLineRequest request) {
                        if (request == null) {
                                throw badRequest(
                                                "BOM line request is required");
                        }

                        if (request.materialId() == null) {
                                throw badRequest(
                                                "Material is required");
                        }
                }

                private void requireEditable(
                                MatFlowBom bom) {
                        if (!bom.isLatestRevision()) {
                                throw conflict(
                                                "Only the latest revision can be edited");
                        }

                        if (bom.getStatus() != MatFlowBomStatus.DRAFT &&
                                        bom.getStatus() != MatFlowBomStatus.RETURNED) {
                                throw conflict(
                                                "Only Draft or Returned BOM revisions can be edited");
                        }
                }

                private void assertActionVersion(
                                BomActionRequest request,
                                MatFlowBom bom) {
                        Long requestedVersion = request == null
                                        ? null
                                        : request.rowVersion();

                        assertVersion(
                                        requestedVersion,
                                        bom.getRowVersion(),
                                        "BOM");
                }

                private void assertVersion(
                                Long requested,
                                Long current,
                                String entityName) {
                        if (requested == null) {
                                throw badRequest(
                                                entityName + " rowVersion is required");
                        }

                        if (!requested.equals(current)) {
                                throw conflict(
                                                entityName +
                                                                " was modified by another user. Refresh and try again.");
                        }
                }

                private MatFlowBom requireBom(
                                UUID id) {
                        if (id == null) {
                                throw badRequest(
                                                "BOM ID is required");
                        }

                        MatFlowBom bom = bomRepository
                                        .findById(id)
                                        .orElseThrow(() -> notFound(
                                                        "MatFlow BOM not found"));

                        if (bom.getProjectDrawing() == null) {
                                throw conflict(
                                                "BOM project drawing is missing");
                        }

                        String projectPlantCode = requirePlantCode(
                                        bom.getProjectDrawing().getPlantCode(),
                                        "BOM " + safeLabel(bom.getBomNumber(), bom.getId()) + " project/drawing");

                        accessService.requirePlantAccess(
                                        projectPlantCode);

                        return bom;
                }

                private MatFlowProjectDrawing requireProject(
                                UUID id) {
                        if (id == null) {
                                throw badRequest(
                                                "Project drawing ID is required");
                        }

                        MatFlowProjectDrawing project = projectRepository
                                        .findById(id)
                                        .orElseThrow(() -> notFound(
                                                        "Project drawing not found"));

                        String projectPlantCode = requirePlantCode(
                                        project.getPlantCode(),
                                        "Project/drawing " + safeLabel(project.getProjectCode(), project.getId()));

                        accessService.requirePlantAccess(
                                        projectPlantCode);

                        return project;
                }

                private String requirePlantCode(
                                String value,
                                String context) {
                        String normalized = clean(value);

                        if (normalized == null) {
                                throw conflict(
                                                context +
                                                                " has no plant code. Correct the MatFlow Project/Location master record before continuing.");
                        }

                        return normalized.toUpperCase(Locale.ROOT);
                }

                private String safeLabel(
                                String value,
                                UUID id) {
                        String cleaned = clean(value);

                        if (cleaned != null) {
                                return cleaned;
                        }

                        return id == null ? "UNKNOWN" : id.toString();
                }

                private int nextLineNo(UUID bomId) {
                        return lineRepository
                                        .findByBom_IdOrderByLineNoAsc(bomId)
                                        .stream()
                                        .map(MatFlowBomLine::getLineNo)
                                        .filter(java.util.Objects::nonNull)
                                        .max(Integer::compareTo)
                                        .orElse(0) + 10;
                }

                private String generateBomNumber() {
                        String random = UUID.randomUUID()
                                        .toString()
                                        .replace("-", "")
                                        .substring(0, 8)
                                        .toUpperCase(Locale.ROOT);

                        return "MFB-" +
                                        LocalDate.now().getYear() +
                                        "-" +
                                        random;
                }

                private void saveHistory(
                                MatFlowBom bom,
                                MatFlowApprovalAction action,
                                MatFlowBomStatus fromStatus,
                                MatFlowBomStatus toStatus,
                                String remarks,
                                String actor) {
                        MatFlowBomApprovalHistory history = new MatFlowBomApprovalHistory();

                        history.setBomId(bom.getId());
                        history.setRevisionGroupId(bom.getRevisionGroupId());
                        history.setRevisionNo(bom.getRevisionNo());
                        history.setAction(action);
                        history.setFromStatus(fromStatus);
                        history.setToStatus(toStatus);
                        history.setRemarks(clean(remarks));
                        history.setActionBy(actor);
                        history.setActionAt(LocalDateTime.now());

                        historyRepository.save(history);
                }

                private void saveAudit(
                                MatFlowBom bom,
                                String action,
                                Object details,
                                String actor) {
                        if (bom == null || bom.getId() == null) {
                                throw new IllegalArgumentException(
                                                "Persisted BOM is required for audit logging");
                        }

                        MatFlowProjectDrawing project = bom.getProjectDrawing();

                        /*
                         * MatFlowAuditService is now the single audit writer.
                         * It obtains the authenticated actor itself and participates
                         * in this business transaction.
                         */
                        auditService.record(
                                        "MATFLOW_BOM",
                                        bom.getId(),
                                        action,
                                        project == null ? null : project.getPlantCode(),
                                        project == null ? null : project.getProjectCode(),
                                        project == null ? null : project.getDrawingNo(),
                                        details == null ? Map.of() : details);
                }

                private BomSummaryResponse toSummary(
                                MatFlowBom bom) {
                        MatFlowProjectDrawing project = bom.getProjectDrawing();

                        int lineCount = lineRepository
                                        .findByBom_IdOrderByLineNoAsc(
                                                        bom.getId())
                                        .size();

                        return new BomSummaryResponse(
                                        bom.getId(),
                                        bom.getBomNumber(),
                                        bom.getRevisionGroupId(),
                                        bom.getRevisionNo(),
                                        bom.getStatus(),
                                        bom.isLatestRevision(),
                                        bom.isEffective(),
                                        project.getId(),
                                        project.getProjectCode(),
                                        project.getProjectName(),
                                        project.getDrawingNo(),
                                        project.getDrawingRevision(),
                                        project.getProductName(),
                                        project.getClientName(),
                                        project.getPlantCode(),
                                        lineCount,
                                        bom.getRowVersion(),
                                        bom.getUpdatedBy(),
                                        bom.getUpdatedAt());
                }

                private BomDetailResponse toDetail(
                                MatFlowBom bom) {
                        List<BomLineResponse> lines = lineRepository
                                        .findByBom_IdOrderByLineNoAsc(
                                                        bom.getId())
                                        .stream()
                                        .map(this::toLineResponse)
                                        .toList();

                        List<ApprovalHistoryResponse> history = historyRepository
                                        .findByBomIdOrderByActionAtAsc(
                                                        bom.getId())
                                        .stream()
                                        .map(item -> new ApprovalHistoryResponse(
                                                        item.getId(),
                                                        item.getAction(),
                                                        item.getFromStatus(),
                                                        item.getToStatus(),
                                                        item.getRemarks(),
                                                        item.getActionBy(),
                                                        item.getActionAt()))
                                        .toList();

                        return new BomDetailResponse(
                                        bom.getId(),
                                        bom.getBomNumber(),
                                        bom.getRevisionGroupId(),
                                        bom.getRevisionNo(),
                                        bom.getStatus(),
                                        bom.isLatestRevision(),
                                        bom.isEffective(),
                                        masterService.toProjectResponse(
                                                        bom.getProjectDrawing()),
                                        bom.getRemarks(),
                                        bom.getSubmittedBy(),
                                        bom.getSubmittedAt(),
                                        bom.getApprovedBy(),
                                        bom.getApprovedAt(),
                                        bom.getReturnedBy(),
                                        bom.getReturnedAt(),
                                        bom.getReturnRemarks(),
                                        bom.getRowVersion(),
                                        bom.getCreatedBy(),
                                        bom.getCreatedAt(),
                                        bom.getUpdatedBy(),
                                        bom.getUpdatedAt(),
                                        lines,
                                        history);
                }

                private BomLineResponse toLineResponse(
                                MatFlowBomLine line) {

                        return new BomLineResponse(
                                        line.getId(),
                                        line.getLineNo(),

                                        line.getMaterial() == null
                                                        ? null
                                                        : line.getMaterial()
                                                                        .getId(),

                                        line.getMaterialCodeSnapshot(),
                                        line.getMaterialNameSnapshot(),
                                        line.getMaterialCategorySnapshot(),
                                        line.getSpecificationSnapshot(),
                                        line.getUomSnapshot(),
                                        line.getRequiredQty(),
                                        line.getWastagePercent(),
                                        line.getNetRequiredQty(),
                                        line.getRemarks(),
                                        line.getRowVersion());
                }

                private void requireApprovedProduct(
                                MatFlowProjectDrawing project) {
                        if (project == null) {
                                throw conflict("BOM project/product context is missing");
                        }

                        if (project.getProductApprovalStatus() != ProjectProductApprovalStatus.APPROVED) {
                                throw conflict(
                                                "Director approval is required for this product/drawing before Engineering can create or submit a BOM");
                        }
                }

                private String normalizeMaterialCategory(
                                String value) {

                        String normalized = clean(value);

                        if (normalized == null) {
                                throw conflict(
                                                "Selected material has no category. " +
                                                                "Correct the material master and try again.");
                        }

                        normalized = normalized
                                        .toUpperCase(
                                                        Locale.ROOT)
                                        .replaceAll(
                                                        "[^A-Z0-9]+",
                                                        "_")
                                        .replaceAll(
                                                        "^_+|_+$",
                                                        "");

                        if (normalized.isBlank()) {
                                throw conflict(
                                                "Selected material has no valid category. " +
                                                                "Correct the material master and try again.");
                        }

                        return normalized;
                }

                private String clean(String value) {
                        if (value == null) {
                                return null;
                        }

                        String normalized = value.trim();

                        return normalized.isBlank()
                                        ? null
                                        : normalized;
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

                private Map<String, Object> auditDetails(
                                Object... keyValuePairs) {

                        if (keyValuePairs == null ||
                                        keyValuePairs.length % 2 != 0) {
                                throw new IllegalArgumentException(
                                                "Audit details must contain key/value pairs");
                        }

                        Map<String, Object> details = new LinkedHashMap<>();

                        for (int index = 0; index < keyValuePairs.length; index += 2) {

                                Object rawKey = keyValuePairs[index];

                                if (rawKey == null) {
                                        throw new IllegalArgumentException(
                                                        "Audit detail key cannot be null");
                                }

                                String key = String.valueOf(rawKey);

                                Object value = keyValuePairs[index + 1];

                                /*
                                 * LinkedHashMap permits null values.
                                 * Jackson will serialize them as JSON null instead
                                 * of crashing the operational transaction.
                                 */
                                details.put(
                                                key,
                                                value);
                        }

                        return details;
                }
        }

        private static final class RoutingModule {

                private final MatFlowBomRepository bomRepository;
                private final MatFlowBomLineRepository lineRepository;
                private final MatFlowBomRouteStepRepository routeRepository;
                private final MatFlowLocationRepository locationRepository;
                private final MatFlowAccessService accessService;

                RoutingModule(
                                MatFlowBomRepository bomRepository,
                                MatFlowBomLineRepository lineRepository,
                                MatFlowBomRouteStepRepository routeRepository,
                                MatFlowLocationRepository locationRepository,
                                MatFlowAccessService accessService) {
                        this.bomRepository = bomRepository;
                        this.lineRepository = lineRepository;
                        this.routeRepository = routeRepository;
                        this.locationRepository = locationRepository;
                        this.accessService = accessService;
                }

                @Transactional(readOnly = true)
                public List<RouteStepResponse> listBomRoutes(
                                UUID bomId) {
                        accessService.requireRead();

                        MatFlowBom bom = requireBom(bomId);

                        return routeRepository
                                        .findByBomLine_Bom_IdOrderByBomLine_LineNoAscSequenceNoAsc(
                                                        bom.getId())
                                        .stream()
                                        .map(this::toResponse)
                                        .toList();
                }

                @Transactional
                public RouteStepResponse addStep(
                                UUID bomId,
                                UUID lineId,
                                RouteStepRequest request) {
                        accessService.requireEngineeringWrite();

                        MatFlowBom bom = requireEditableBom(bomId);

                        MatFlowBomLine line = requireLine(
                                        bom,
                                        lineId);

                        validateRequest(request);

                        if (routeRepository
                                        .existsByBomLine_IdAndSequenceNo(
                                                        lineId,
                                                        request.sequenceNo())) {
                                throw conflict(
                                                "Route sequence already exists for this BOM line");
                        }

                        MatFlowLocation location = requireLocationForBom(
                                        bom,
                                        request.locationId());

                        validateLocationType(
                                        request.stepType(),
                                        location);

                        String actor = accessService.actor();

                        MatFlowBomRouteStep step = new MatFlowBomRouteStep();

                        step.bomLine = line;
                        apply(step, request, location);
                        step.setCreatedBy(actor);
                        step.setUpdatedBy(actor);

                        return toResponse(
                                        routeRepository.save(step));
                }

                @Transactional
                public RouteStepResponse updateStep(
                                UUID bomId,
                                UUID lineId,
                                UUID stepId,
                                RouteStepRequest request) {
                        accessService.requireEngineeringWrite();

                        MatFlowBom bom = requireEditableBom(bomId);

                        requireLine(
                                        bom,
                                        lineId);

                        validateRequest(request);

                        MatFlowBomRouteStep step = routeRepository
                                        .findById(stepId)
                                        .orElseThrow(() -> notFound(
                                                        "Route step not found"));

                        if (!step.bomLine
                                        .getId()
                                        .equals(lineId)) {
                                throw badRequest(
                                                "Route step does not belong to the selected BOM line");
                        }

                        assertVersion(
                                        request.rowVersion(),
                                        step.getRowVersion());

                        if (routeRepository
                                        .existsByBomLine_IdAndSequenceNoAndIdNot(
                                                        lineId,
                                                        request.sequenceNo(),
                                                        stepId)) {
                                throw conflict(
                                                "Route sequence already exists for this BOM line");
                        }

                        MatFlowLocation location = requireLocationForBom(
                                        bom,
                                        request.locationId());

                        validateLocationType(
                                        request.stepType(),
                                        location);

                        apply(step, request, location);

                        step.setUpdatedBy(
                                        accessService.actor());

                        return toResponse(
                                        routeRepository.save(step));
                }

                @Transactional
                public void deleteStep(
                                UUID bomId,
                                UUID lineId,
                                UUID stepId,
                                Long rowVersion) {
                        accessService.requireEngineeringWrite();

                        MatFlowBom bom = requireEditableBom(bomId);

                        requireLine(
                                        bom,
                                        lineId);

                        MatFlowBomRouteStep step = routeRepository
                                        .findById(stepId)
                                        .orElseThrow(() -> notFound(
                                                        "Route step not found"));

                        if (!step.bomLine
                                        .getId()
                                        .equals(lineId)) {
                                throw badRequest(
                                                "Route step does not belong to the selected BOM line");
                        }

                        assertVersion(
                                        rowVersion,
                                        step.getRowVersion());

                        routeRepository.delete(step);
                }

                /**
                 * Called before BOM submission.
                 */
                @Transactional(readOnly = true)
                public void validateBomForSubmission(
                                MatFlowBom bom) {
                        if (bom == null || bom.getId() == null) {
                                throw badRequest(
                                                "Persisted BOM is required for route validation");
                        }

                        String bomPlantCode = requireBomPlantCode(bom);
                        accessService.requirePlantAccess(bomPlantCode);

                        List<MatFlowBomLine> lines = lineRepository
                                        .findByBom_IdOrderByLineNoAsc(
                                                        bom.getId());

                        for (MatFlowBomLine line : lines) {
                                List<MatFlowBomRouteStep> steps = routeRepository
                                                .findByBomLine_IdOrderBySequenceNoAsc(
                                                                line.getId());

                                validateRoute(
                                                bom,
                                                line,
                                                steps);
                        }
                }

                public List<MatFlowBomRouteStep> routeForLine(
                                UUID bomLineId) {
                        return routeRepository
                                        .findByBomLine_IdOrderBySequenceNoAsc(
                                                        bomLineId);
                }

                private void copyRoute(
                                UUID sourceBomLineId,
                                MatFlowBomLine targetBomLine,
                                String actor) {
                        if (sourceBomLineId == null ||
                                        targetBomLine == null ||
                                        targetBomLine.getId() == null) {
                                throw new IllegalArgumentException(
                                                "Source and target BOM lines are required for route copy");
                        }

                        List<MatFlowBomRouteStep> sourceSteps = routeRepository
                                        .findByBomLine_IdOrderBySequenceNoAsc(
                                                        sourceBomLineId);

                        for (MatFlowBomRouteStep sourceStep : sourceSteps) {
                                MatFlowBomRouteStep copied = new MatFlowBomRouteStep();

                                copied.bomLine = targetBomLine;
                                copied.sequenceNo = sourceStep.sequenceNo;
                                copied.stepType = sourceStep.stepType;
                                copied.location = sourceStep.location;
                                copied.processCode = sourceStep.processCode;
                                copied.expectedYieldPercent = sourceStep.expectedYieldPercent;
                                copied.remarks = sourceStep.remarks;
                                copied.setCreatedBy(actor);
                                copied.setUpdatedBy(actor);

                                routeRepository.save(copied);
                        }
                }

                private void deleteRoutesForLine(
                                UUID bomLineId) {
                        if (bomLineId == null) {
                                return;
                        }

                        List<MatFlowBomRouteStep> steps = routeRepository
                                        .findByBomLine_IdOrderBySequenceNoAsc(
                                                        bomLineId);

                        if (!steps.isEmpty()) {
                                routeRepository.deleteAll(steps);
                        }
                }

                private void validateRoute(
                                MatFlowBom bom,
                                MatFlowBomLine line,
                                List<MatFlowBomRouteStep> steps) {
                        String materialLabel = line == null
                                        ? "UNKNOWN MATERIAL"
                                        : safeLabel(
                                                        line.getMaterialCodeSnapshot(),
                                                        line.getId());

                        if (steps == null || steps.isEmpty()) {
                                throw badRequest(
                                                "Every BOM material line requires an approved route: QC -> optional Processing -> Production. " +
                                                                "Missing route for material " + materialLabel);
                        }

                        String bomPlantCode = requireBomPlantCode(bom);

                        int qcCount = 0;
                        int productionCount = 0;
                        boolean productionSeen = false;

                        for (int index = 0; index < steps.size(); index++) {
                                MatFlowBomRouteStep step = steps.get(index);

                                if (step == null || step.location == null || step.stepType == null) {
                                        throw badRequest(
                                                        "BOM route contains an incomplete step for material " + materialLabel);
                                }

                                MatFlowLocation location = step.location;
                                String locationLabel = safeLabel(
                                                location.getLocationCode(),
                                                location.getId());

                                String routePlantCode = requirePlantCode(
                                                location.getPlantCode(),
                                                "Route location " + locationLabel +
                                                                " used by material " + materialLabel);

                                accessService.requirePlantAccess(
                                                routePlantCode);

                                if (!bomPlantCode.equals(routePlantCode)) {
                                        throw conflict(
                                                        "Route location " + locationLabel +
                                                                        " belongs to plant " + routePlantCode +
                                                                        " but BOM " + safeLabel(bom.getBomNumber(), bom.getId()) +
                                                                        " belongs to plant " + bomPlantCode +
                                                                        ". Use a route location from the BOM plant.");
                                }

                                if (!location.active) {
                                        throw badRequest(
                                                        "Inactive location exists in BOM route: " +
                                                                        locationLabel);
                                }

                                validateLocationType(
                                                step.stepType,
                                                location);

                                if (index == 0 && step.stepType != RouteStepType.QC) {
                                        throw badRequest(
                                                        "The first material route step must be QC for material " + materialLabel);
                                }

                                if (step.stepType == RouteStepType.QC) {
                                        qcCount++;
                                        if (index != 0) {
                                                throw badRequest(
                                                                "QC must be the first and only QC route step for material " + materialLabel);
                                        }
                                }

                                if (productionSeen) {
                                        throw badRequest(
                                                        "No route step is allowed after Production for material " + materialLabel);
                                }

                                if (step.stepType == RouteStepType.PRODUCTION) {
                                        productionCount++;
                                        productionSeen = true;

                                        if (index != steps.size() - 1) {
                                                throw badRequest(
                                                                "Production must be the final route step for material " + materialLabel);
                                        }
                                }

                                if (step.stepType == RouteStepType.PROCESSING && index == 0) {
                                        throw badRequest(
                                                        "Processing cannot occur before QC for material " + materialLabel);
                                }
                        }

                        if (qcCount != 1) {
                                throw badRequest(
                                                "A material route must contain exactly one QC step as the first step for material " + materialLabel);
                        }

                        if (productionCount != 1) {
                                throw badRequest(
                                                "A material route must contain exactly one Production step as the final step for material " + materialLabel);
                        }
                }

                private void validateLocationType(
                                RouteStepType stepType,
                                MatFlowLocation location) {
                        if (stepType == RouteStepType.PROCESSING &&
                                        location.locationType != LocationType.PROCESSING &&
                                        location.locationType != LocationType.EXTERNAL_PROCESSOR) {
                                throw badRequest(
                                                "Processing step requires an internal or external processing location");
                        }

                        if (stepType == RouteStepType.QC &&
                                        location.locationType != LocationType.QC) {
                                throw badRequest(
                                                "QC step requires a QC location");
                        }

                        if (stepType == RouteStepType.PRODUCTION &&
                                        location.locationType != LocationType.PRODUCTION) {
                                throw badRequest(
                                                "Production step requires a production location");
                        }
                }

                private void apply(
                                MatFlowBomRouteStep step,
                                RouteStepRequest request,
                                MatFlowLocation location) {
                        step.sequenceNo = request.sequenceNo();

                        step.stepType = request.stepType();

                        step.location = location;

                        step.processCode = cleanUpper(
                                        request.processCode());

                        step.expectedYieldPercent = request.expectedYieldPercent() == null
                                        ? new BigDecimal("100.000")
                                        : request.expectedYieldPercent()
                                                        .setScale(
                                                                        3,
                                                                        RoundingMode.HALF_UP);

                        step.remarks = clean(request.remarks());
                }

                private void validateRequest(
                                RouteStepRequest request) {
                        if (request == null) {
                                throw badRequest(
                                                "Route step request is required");
                        }

                        if (request.sequenceNo() == null ||
                                        request.sequenceNo() <= 0) {
                                throw badRequest(
                                                "Route sequence must be greater than zero");
                        }

                        if (request.stepType() == null) {
                                throw badRequest(
                                                "Route step type is required");
                        }

                        if (request.locationId() == null) {
                                throw badRequest(
                                                "Route location is required");
                        }

                        BigDecimal yield = request.expectedYieldPercent() == null
                                        ? new BigDecimal("100")
                                        : request.expectedYieldPercent();

                        if (yield.compareTo(
                                        BigDecimal.ZERO) <= 0 ||
                                        yield.compareTo(
                                                        new BigDecimal("100")) > 0) {
                                throw badRequest(
                                                "Expected yield percentage must be greater than 0 and not more than 100");
                        }

                        if (request.stepType() == RouteStepType.PROCESSING &&
                                        (request.processCode() == null ||
                                                        request.processCode()
                                                                        .trim()
                                                                        .isBlank())) {
                                throw badRequest(
                                                "Process code is required for a processing step");
                        }
                }

                private MatFlowBom requireBom(
                                UUID bomId) {
                        MatFlowBom bom = bomRepository
                                        .findById(bomId)
                                        .orElseThrow(() -> notFound(
                                                        "BOM not found"));

                        String bomPlantCode = requireBomPlantCode(bom);

                        accessService.requirePlantAccess(
                                        bomPlantCode);

                        return bom;
                }

                private MatFlowBom requireEditableBom(
                                UUID bomId) {
                        MatFlowBom bom = requireBom(bomId);

                        if (!bom.isLatestRevision()) {
                                throw conflict(
                                                "Only the latest BOM revision can be changed");
                        }

                        if (bom.getStatus() != MatFlowBomStatus.DRAFT &&
                                        bom.getStatus() != MatFlowBomStatus.RETURNED) {
                                throw conflict(
                                                "BOM route can only be changed in Draft or Returned status");
                        }

                        return bom;
                }

                private MatFlowBomLine requireLine(
                                MatFlowBom bom,
                                UUID lineId) {
                        return lineRepository
                                        .findByIdAndBom_Id(
                                                        lineId,
                                                        bom.getId())
                                        .orElseThrow(() -> notFound(
                                                        "BOM line not found"));
                }

                private MatFlowLocation requireLocationForBom(
                                MatFlowBom bom,
                                UUID id) {
                        if (id == null) {
                                throw badRequest(
                                                "Route location ID is required");
                        }

                        MatFlowLocation location = locationRepository
                                        .findById(id)
                                        .orElseThrow(() -> notFound(
                                                        "Location not found"));

                        String locationLabel = safeLabel(
                                        location.getLocationCode(),
                                        location.getId());

                        String locationPlantCode = requirePlantCode(
                                        location.getPlantCode(),
                                        "Route location " + locationLabel);

                        String bomPlantCode = requireBomPlantCode(bom);

                        accessService.requirePlantAccess(
                                        locationPlantCode);

                        if (!bomPlantCode.equals(locationPlantCode)) {
                                throw conflict(
                                                "Route location " + locationLabel +
                                                                " belongs to plant " + locationPlantCode +
                                                                " but BOM " + safeLabel(bom.getBomNumber(), bom.getId()) +
                                                                " belongs to plant " + bomPlantCode +
                                                                ". Select a route location from the BOM plant.");
                        }

                        if (!location.active) {
                                throw badRequest(
                                                "Inactive location cannot be used in a route: " + locationLabel);
                        }

                        return location;
                }

                private String requireBomPlantCode(
                                MatFlowBom bom) {
                        if (bom == null) {
                                throw conflict(
                                                "BOM context is missing while validating its route");
                        }

                        if (bom.getProjectDrawing() == null) {
                                throw conflict(
                                                "BOM " + safeLabel(bom.getBomNumber(), bom.getId()) +
                                                                " has no Project/Drawing master");
                        }

                        return requirePlantCode(
                                        bom.getProjectDrawing().getPlantCode(),
                                        "BOM " + safeLabel(bom.getBomNumber(), bom.getId()) +
                                                        " Project/Drawing " +
                                                        safeLabel(
                                                                        bom.getProjectDrawing().getProjectCode(),
                                                                        bom.getProjectDrawing().getId()));
                }

                private String requirePlantCode(
                                String value,
                                String context) {
                        String normalized = clean(value);

                        if (normalized == null) {
                                throw conflict(
                                                context +
                                                                " has no plant code. Correct the MatFlow master-data record before continuing.");
                        }

                        return normalized.toUpperCase(Locale.ROOT);
                }

                private String safeLabel(
                                String value,
                                UUID id) {
                        String cleaned = clean(value);

                        if (cleaned != null) {
                                return cleaned;
                        }

                        return id == null ? "UNKNOWN" : id.toString();
                }

                private RouteStepResponse toResponse(
                                MatFlowBomRouteStep step) {
                        MatFlowLocation location = step.location;

                        MatFlowBomLine line = step.bomLine;

                        return new RouteStepResponse(
                                        step.getId(),
                                        line.getBom().getId(),
                                        line.getId(),
                                        line.getLineNo(),
                                        step.sequenceNo,
                                        step.stepType,
                                        location.getId(),
                                        location.locationCode,
                                        location.locationName,
                                        location.plantCode,
                                        location.locationType,
                                        location.ownershipType,
                                        step.processCode,
                                        step.expectedYieldPercent,
                                        step.remarks,
                                        step.getRowVersion());
                }

                private void assertVersion(
                                Long requested,
                                Long current) {
                        if (requested == null) {
                                throw badRequest(
                                                "Route step rowVersion is required");
                        }

                        if (!requested.equals(current)) {
                                throw conflict(
                                                "Route step was modified by another user");
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

                private String cleanUpper(String value) {
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
