package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.ApprovalHistoryResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.BomActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.BomCreateRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.BomDetailResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.BomLineRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.BomLineResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.BomSummaryResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.BomUpdateRequest;
import com.alsorg.packing.domain.matflow.MatFlowApprovalAction;
import com.alsorg.packing.domain.matflow.MatFlowAuditLog;
import com.alsorg.packing.domain.matflow.MatFlowBom;
import com.alsorg.packing.domain.matflow.MatFlowBomApprovalHistory;
import com.alsorg.packing.domain.matflow.MatFlowBomLine;
import com.alsorg.packing.domain.matflow.MatFlowBomStatus;
import com.alsorg.packing.domain.matflow.MatFlowMaterial;
import com.alsorg.packing.domain.matflow.MatFlowProjectDrawing;
import com.alsorg.packing.repository.matflow.MatFlowAuditLogRepository;
import com.alsorg.packing.repository.matflow.MatFlowBomApprovalHistoryRepository;
import com.alsorg.packing.repository.matflow.MatFlowBomLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowBomRepository;
import com.alsorg.packing.repository.matflow.MatFlowMaterialRepository;
import com.alsorg.packing.repository.matflow.MatFlowProjectDrawingRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MatFlowBomService {

        private final MatFlowBomRepository bomRepository;
        private final MatFlowBomLineRepository lineRepository;
        private final MatFlowMaterialRepository materialRepository;
        private final MatFlowProjectDrawingRepository projectRepository;
        private final MatFlowBomApprovalHistoryRepository historyRepository;
        private final MatFlowAuditLogRepository auditRepository;
        private final MatFlowAccessService accessService;
        private final MatFlowMasterService masterService;
        private final MatFlowRoutingService routingService;
        private final ObjectMapper objectMapper;

        public MatFlowBomService(
                        MatFlowBomRepository bomRepository,
                        MatFlowBomLineRepository lineRepository,
                        MatFlowMaterialRepository materialRepository,
                        MatFlowProjectDrawingRepository projectRepository,
                        MatFlowBomApprovalHistoryRepository historyRepository,
                        MatFlowAuditLogRepository auditRepository,
                        MatFlowAccessService accessService,
                        MatFlowMasterService masterService,
                        MatFlowRoutingService routingService,
                        ObjectMapper objectMapper) {
                this.bomRepository = bomRepository;
                this.lineRepository = lineRepository;
                this.materialRepository = materialRepository;
                this.projectRepository = projectRepository;
                this.historyRepository = historyRepository;
                this.auditRepository = auditRepository;
                this.accessService = accessService;
                this.masterService = masterService;
                this.routingService = routingService;
                this.objectMapper = objectMapper;
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
        public BomDetailResponse returnBom(
                        UUID id,
                        BomActionRequest request) {
                accessService.requireApproval();

                MatFlowBom bom = requireBom(id);

                if (bom.getStatus() != MatFlowBomStatus.SUBMITTED) {
                        throw conflict(
                                        "Only a submitted BOM can be returned");
                }

                assertActionVersion(
                                request,
                                bom);

                String remarks = request == null
                                ? null
                                : clean(request.remarks());

                if (remarks == null) {
                        throw badRequest(
                                        "Return remarks are required");
                }

                String actor = accessService.actor();

                bom.setStatus(
                                MatFlowBomStatus.RETURNED);

                bom.setReturnedBy(actor);
                bom.setReturnedAt(
                                LocalDateTime.now());

                bom.setReturnRemarks(remarks);
                bom.setUpdatedBy(actor);

                bom = bomRepository.save(bom);

                saveHistory(
                                bom,
                                MatFlowApprovalAction.RETURNED,
                                MatFlowBomStatus.SUBMITTED,
                                MatFlowBomStatus.RETURNED,
                                remarks,
                                actor);

                saveAudit(
                                bom,
                                "BOM_RETURNED",
                                auditDetails(
                                                "remarks",
                                                remarks),
                                actor);

                return toDetail(bom);
        }

        @Transactional
        public BomDetailResponse approve(
                        UUID id,
                        BomActionRequest request) {
                accessService.requireApproval();

                MatFlowBom bom = requireBom(id);

                if (bom.getStatus() != MatFlowBomStatus.SUBMITTED) {
                        throw conflict(
                                        "Only a submitted BOM can be approved");
                }

                assertActionVersion(
                                request,
                                bom);

                String actor = accessService.actor();

                bomRepository
                                .findFirstByRevisionGroupIdAndEffectiveTrue(
                                                bom.getRevisionGroupId())
                                .filter(previous -> !previous.getId()
                                                .equals(bom.getId()))
                                .ifPresent(previous -> {
                                        previous.setEffective(false);
                                        previous.setStatus(
                                                        MatFlowBomStatus.SUPERSEDED);
                                        previous.setUpdatedBy(actor);

                                        bomRepository.save(previous);

                                        saveHistory(
                                                        previous,
                                                        MatFlowApprovalAction.SUPERSEDED,
                                                        MatFlowBomStatus.APPROVED,
                                                        MatFlowBomStatus.SUPERSEDED,
                                                        "Superseded by revision " +
                                                                        bom.getRevisionNo(),
                                                        actor);
                                });

                bom.setStatus(
                                MatFlowBomStatus.APPROVED);

                bom.setEffective(true);
                bom.setApprovedBy(actor);
                bom.setApprovedAt(
                                LocalDateTime.now());
                bom.setUpdatedBy(actor);

                MatFlowBom approvedBom = bomRepository.save(bom);

                saveHistory(
                                approvedBom,
                                MatFlowApprovalAction.APPROVED,
                                MatFlowBomStatus.SUBMITTED,
                                MatFlowBomStatus.APPROVED,
                                request == null
                                                ? null
                                                : request.remarks(),
                                actor);

                saveAudit(
                                approvedBom,
                                "BOM_APPROVED",
                                auditDetails(
                                                "revisionNo",
                                                approvedBom.getRevisionNo(),
                                                "effective",
                                                true),
                                actor);

                return toDetail(approvedBom);
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

                MatFlowBom latest = bomRepository
                                .findFirstByRevisionGroupIdOrderByRevisionNoDesc(
                                                source.getRevisionGroupId())
                                .orElse(source);

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

                revision.setBomNumber(
                                source.getBomNumber());

                revision.setRevisionGroupId(
                                source.getRevisionGroupId());

                revision.setRevisionNo(
                                latest.getRevisionNo() + 1);

                revision.setProjectDrawing(
                                source.getProjectDrawing());

                revision.setStatus(
                                MatFlowBomStatus.DRAFT);

                revision.setLatestRevision(true);
                revision.setEffective(false);

                revision.setRemarks(
                                request == null
                                                ? source.getRemarks()
                                                : request.remarks());

                revision.setCreatedBy(actor);
                revision.setUpdatedBy(actor);

                revision = bomRepository.save(revision);

                List<MatFlowBomLine> sourceLines = lineRepository
                                .findByBom_IdOrderByLineNoAsc(
                                                source.getId());

                for (MatFlowBomLine sourceLine : sourceLines) {
                        MatFlowBomLine copied = new MatFlowBomLine();

                        copied.setBom(revision);
                        copied.setMaterial(
                                        sourceLine.getMaterial());
                        copied.setLineNo(
                                        sourceLine.getLineNo());
                        copied.setMaterialCodeSnapshot(
                                        sourceLine
                                                        .getMaterialCodeSnapshot());
                        copied.setMaterialNameSnapshot(
                                        sourceLine
                                                        .getMaterialNameSnapshot());
                        String copiedCategory = clean(
                                        sourceLine
                                                        .getMaterialCategorySnapshot());

                        if (copiedCategory == null &&
                                        sourceLine.getMaterial() != null) {

                                copiedCategory = normalizeMaterialCategory(
                                                sourceLine
                                                                .getMaterial()
                                                                .getCategory());
                        }

                        if (copiedCategory == null) {
                                copiedCategory = "MISCELLANEOUS";
                        }

                        copied.setMaterialCategorySnapshot(
                                        copiedCategory);
                        copied.setSpecificationSnapshot(
                                        sourceLine
                                                        .getSpecificationSnapshot());
                        copied.setUomSnapshot(
                                        sourceLine
                                                        .getUomSnapshot());
                        copied.setRequiredQty(
                                        sourceLine.getRequiredQty());
                        copied.setWastagePercent(
                                        sourceLine.getWastagePercent());
                        copied.setNetRequiredQty(
                                        sourceLine.getNetRequiredQty());
                        copied.setRemarks(
                                        sourceLine.getRemarks());
                        copied.setCreatedBy(actor);
                        copied.setUpdatedBy(actor);

                        lineRepository.save(copied);
                }

                saveHistory(
                                revision,
                                MatFlowApprovalAction.REVISION_CREATED,
                                source.getStatus(),
                                MatFlowBomStatus.DRAFT,
                                request == null
                                                ? null
                                                : request.remarks(),
                                actor);

                saveAudit(
                                revision,
                                "BOM_REVISION_CREATED",
                                auditDetails(
                                                "sourceBomId",
                                                source.getId(),
                                                "sourceRevisionNo",
                                                source.getRevisionNo(),
                                                "newRevisionNo",
                                                revision.getRevisionNo()),
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
                                requiredQty.compareTo(
                                                BigDecimal.ZERO) <= 0) {

                        throw badRequest(
                                        "Required quantity must be greater than zero");
                }

                if (wastage.compareTo(
                                BigDecimal.ZERO) < 0 ||
                                wastage.compareTo(
                                                new BigDecimal("1000")) > 0) {

                        throw badRequest(
                                        "Wastage percentage must be between 0 and 1000");
                }

                String materialCode = clean(
                                material.getMaterialCode());

                String materialName = clean(
                                material.getMaterialName());

                String materialUom = clean(
                                material.getUom());

                if (materialCode == null) {
                        throw conflict(
                                        "Selected material has no material code. " +
                                                        "Correct the material master and try again.");
                }

                if (materialName == null) {
                        throw conflict(
                                        "Selected material has no material name. " +
                                                        "Correct the material master and try again.");
                }

                if (materialUom == null) {
                        throw conflict(
                                        "Selected material has no UOM. " +
                                                        "Correct the material master and try again.");
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
                                .add(
                                                wastageQuantity)
                                .setScale(
                                                3,
                                                RoundingMode.HALF_UP);

                line.setMaterial(material);

                line.setMaterialCodeSnapshot(
                                materialCode);

                line.setMaterialNameSnapshot(
                                materialName);

                line.setMaterialCategorySnapshot(
                                materialCategory);

                line.setSpecificationSnapshot(
                                clean(
                                                material.getSpecification()));

                line.setUomSnapshot(
                                materialUom.toUpperCase(
                                                Locale.ROOT));

                line.setRequiredQty(
                                requiredQty.setScale(
                                                3,
                                                RoundingMode.HALF_UP));

                line.setWastagePercent(
                                wastage.setScale(
                                                3,
                                                RoundingMode.HALF_UP));

                line.setNetRequiredQty(
                                netRequiredQty);

                line.setRemarks(
                                clean(
                                                request.remarks()));
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
                                        entityName +
                                                        " rowVersion is required");
                }

                if (!requested.equals(current)) {
                        throw conflict(
                                        entityName +
                                                        " was modified by another user. Refresh and try again.");
                }
        }

        private MatFlowBom requireBom(
                        UUID id) {
                MatFlowBom bom = bomRepository
                                .findById(id)
                                .orElseThrow(() -> notFound(
                                                "MatFlow BOM not found"));

                accessService.requirePlantAccess(
                                bom.getProjectDrawing()
                                                .getPlantCode());

                return bom;
        }

        private MatFlowProjectDrawing requireProject(
                        UUID id) {
                MatFlowProjectDrawing project = projectRepository
                                .findById(id)
                                .orElseThrow(() -> notFound(
                                                "Project drawing not found"));

                accessService.requirePlantAccess(
                                project.getPlantCode());

                return project;
        }

        private int nextLineNo(UUID bomId) {
                return lineRepository
                                .findByBom_IdOrderByLineNoAsc(
                                                bomId)
                                .stream()
                                .map(MatFlowBomLine::getLineNo)
                                .filter(value -> value != null)
                                .max(Integer::compareTo)
                                .orElse(0) + 10;
        }

        private String generateBomNumber() {
                String random = UUID.randomUUID()
                                .toString()
                                .replace("-", "")
                                .substring(0, 8)
                                .toUpperCase();

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

                history.setBomId(
                                bom.getId());

                history.setRevisionGroupId(
                                bom.getRevisionGroupId());

                history.setRevisionNo(
                                bom.getRevisionNo());

                history.setAction(action);
                history.setFromStatus(fromStatus);
                history.setToStatus(toStatus);
                history.setRemarks(remarks);
                history.setActionBy(actor);
                history.setActionAt(
                                LocalDateTime.now());

                historyRepository.save(history);
        }

        private void saveAudit(
                        MatFlowBom bom,
                        String action,
                        Object details,
                        String actor) {

                if (bom == null) {
                        throw new IllegalArgumentException(
                                        "BOM is required for audit logging");
                }

                MatFlowProjectDrawing project = bom.getProjectDrawing();

                MatFlowAuditLog log = new MatFlowAuditLog();

                log.setEntityType(
                                "MATFLOW_BOM");

                log.setEntityId(
                                bom.getId());

                log.setAction(
                                action);

                log.setDetailsJson(
                                toJson(
                                                details == null
                                                                ? new LinkedHashMap<>()
                                                                : details));

                log.setActor(
                                actor);

                if (project != null) {
                        log.setPlantCode(
                                        project.getPlantCode());

                        log.setProjectCode(
                                        project.getProjectCode());

                        log.setDrawingNo(
                                        project.getDrawingNo());
                }

                log.setActionAt(
                                LocalDateTime.now());

                auditRepository.save(log);
        }

        private String toJson(Object value) {
                try {
                        return objectMapper
                                        .writeValueAsString(value);
                } catch (JsonProcessingException ex) {
                        return "{\"message\":\"Audit details unavailable\"}";
                }
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