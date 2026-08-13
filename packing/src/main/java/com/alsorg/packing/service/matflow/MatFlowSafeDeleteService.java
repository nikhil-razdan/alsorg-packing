package com.alsorg.packing.service.matflow;

import com.alsorg.packing.domain.matflow.MatFlowBom;
import com.alsorg.packing.domain.matflow.MatFlowBomLine;
import com.alsorg.packing.domain.matflow.MatFlowBomRouteStep;
import com.alsorg.packing.domain.matflow.MatFlowMaterialRequisition;
import com.alsorg.packing.domain.matflow.MatFlowMaterialReturn;
import com.alsorg.packing.domain.matflow.MatFlowMaterialReturnLine;
import com.alsorg.packing.domain.matflow.MatFlowProjectDrawing;
import com.alsorg.packing.domain.matflow.MatFlowRequisitionLine;
import com.alsorg.packing.domain.matflow.MatFlowBomStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MaterialReturnStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RequisitionStatus;
import com.alsorg.packing.repository.matflow.MatFlowBomApprovalHistoryRepository;
import com.alsorg.packing.repository.matflow.MatFlowBomLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowBomRepository;
import com.alsorg.packing.repository.matflow.MatFlowBomRouteStepRepository;
import com.alsorg.packing.repository.matflow.MatFlowMaterialRequisitionRepository;
import com.alsorg.packing.repository.matflow.MatFlowMaterialReturnLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowMaterialReturnRepository;
import com.alsorg.packing.repository.matflow.MatFlowRequisitionLineRepository;

import jakarta.persistence.EntityManager;

import java.util.List;
import java.util.UUID;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * MatFlow-only controlled hard-delete boundary.
 *
 * <p>
 * Hard delete is intentionally limited to records that are still setup/draft
 * records and have not started physical material execution. Historical or
 * stock-affecting records must use their normal workflow action (cancel,
 * release, return, etc.) so MatFlow's custody/audit trail is not destroyed.
 * </p>
 *
 * <p>
 * This service is deliberately isolated from PackFlow and BOMFlow.
 * </p>
 */
@Service
public class MatFlowSafeDeleteService {

    private final MatFlowBomRepository bomRepository;
    private final MatFlowBomLineRepository bomLineRepository;
    private final MatFlowBomRouteStepRepository bomRouteRepository;
    private final MatFlowBomApprovalHistoryRepository bomHistoryRepository;

    private final MatFlowMaterialRequisitionRepository requisitionRepository;
    private final MatFlowRequisitionLineRepository requisitionLineRepository;

    private final MatFlowMaterialReturnRepository materialReturnRepository;
    private final MatFlowMaterialReturnLineRepository materialReturnLineRepository;

    private final MatFlowAccessService accessService;
    private final MatFlowAuditService auditService;
    private final EntityManager entityManager;

    public MatFlowSafeDeleteService(
            MatFlowBomRepository bomRepository,
            MatFlowBomLineRepository bomLineRepository,
            MatFlowBomRouteStepRepository bomRouteRepository,
            MatFlowBomApprovalHistoryRepository bomHistoryRepository,
            MatFlowMaterialRequisitionRepository requisitionRepository,
            MatFlowRequisitionLineRepository requisitionLineRepository,
            MatFlowMaterialReturnRepository materialReturnRepository,
            MatFlowMaterialReturnLineRepository materialReturnLineRepository,
            MatFlowAccessService accessService,
            MatFlowAuditService auditService,
            EntityManager entityManager) {

        this.bomRepository = bomRepository;
        this.bomLineRepository = bomLineRepository;
        this.bomRouteRepository = bomRouteRepository;
        this.bomHistoryRepository = bomHistoryRepository;
        this.requisitionRepository = requisitionRepository;
        this.requisitionLineRepository = requisitionLineRepository;
        this.materialReturnRepository = materialReturnRepository;
        this.materialReturnLineRepository = materialReturnLineRepository;
        this.accessService = accessService;
        this.auditService = auditService;
        this.entityManager = entityManager;
    }

    /**
     * Deletes only the latest, non-effective DRAFT BOM revision.
     * Submitted/Returned/Approved/Superseded revisions remain immutable history.
     */
    @Transactional
    public void deleteDraftBom(UUID bomId, Long rowVersion) {
        accessService.requireEngineeringWrite();

        MatFlowBom bom = bomRepository.findById(bomId)
                .orElseThrow(() -> notFound("BOM not found"));

        MatFlowProjectDrawing product = bom.getProjectDrawing();
        if (product != null) {
            accessService.requirePlantAccess(product.getPlantCode());
        }

        assertVersion(rowVersion, bom.getRowVersion(), "BOM");

        if (bom.getStatus() != MatFlowBomStatus.DRAFT) {
            throw conflict(
                    "Only a Draft BOM can be permanently deleted. Submitted, Returned, Approved and Superseded BOM revisions are retained for audit history.");
        }

        if (!bom.isLatestRevision() || bom.isEffective()) {
            throw conflict("Only the latest non-effective Draft BOM revision can be deleted");
        }

        String actor = accessService.actor();
        UUID revisionGroupId = bom.getRevisionGroupId();
        Integer revisionNo = bom.getRevisionNo();
        String bomNumber = bom.getBomNumber();
        String projectCode = product == null ? null : product.getProjectCode();
        String drawingNo = product == null ? null : product.getDrawingNo();
        String plantCode = product == null ? null : product.getPlantCode();

        auditService.record(
                "BOM",
                bom.getId(),
                "DRAFT_BOM_DELETED",
                plantCode,
                projectCode,
                drawingNo,
                auditService.details(
                        "bomNumber", bomNumber,
                        "revisionNo", revisionNo,
                        "deletedBy", actor,
                        "deletePolicy", "DRAFT_ONLY"));

        try {
            List<MatFlowBomLine> lines = bomLineRepository
                    .findByBom_IdOrderByLineNoAsc(bom.getId());

            for (MatFlowBomLine line : lines) {
                List<MatFlowBomRouteStep> steps = bomRouteRepository
                        .findByBomLine_IdOrderBySequenceNoAsc(line.getId());
                if (!steps.isEmpty()) {
                    bomRouteRepository.deleteAll(steps);
                }
            }

            var history = bomHistoryRepository.findByBomIdOrderByActionAtAsc(bom.getId());
            if (!history.isEmpty()) {
                bomHistoryRepository.deleteAll(history);
            }

            if (!lines.isEmpty()) {
                bomLineRepository.deleteAll(lines);
            }

            bomRepository.delete(bom);
            entityManager.flush();

            /*
             * A draft revision created from an approved BOM temporarily owns the
             * "latest revision" flag. If that draft is discarded, restore the
             * previous revision as latest so the approved BOM chain remains usable.
             */
            if (revisionGroupId != null && revisionNo != null && revisionNo > 0) {
                bomRepository
                        .findFirstByRevisionGroupIdOrderByRevisionNoDesc(revisionGroupId)
                        .ifPresent(previous -> {
                            if (!previous.isLatestRevision()) {
                                previous.setLatestRevision(true);
                                previous.setUpdatedBy(actor);
                                bomRepository.save(previous);
                            }
                        });
                entityManager.flush();
            }
        } catch (DataIntegrityViolationException ex) {
            throw conflict(
                    "This Draft BOM is already referenced by another MatFlow record and cannot be deleted. Refresh the workflow and retain it for traceability.");
        }
    }

    /**
     * Deletes only a DRAFT requisition. Once submitted, use Cancel Requisition.
     */
    @Transactional
    public void deleteDraftRequisition(UUID requisitionId, Long rowVersion) {
        accessService.requireProductionRequest();

        MatFlowMaterialRequisition requisition = requisitionRepository
                .findById(requisitionId)
                .orElseThrow(() -> notFound("Requisition not found"));
        accessService.requireProductionOwnership(requisition.requestedBy);

        MatFlowProjectDrawing product = requisition.projectDrawing;
        String plantCode = product != null && product.getPlantCode() != null
                ? product.getPlantCode()
                : requisition.destinationLocation == null
                        ? null
                        : requisition.destinationLocation.getPlantCode();

        accessService.requirePlantAccess(plantCode);
        assertVersion(rowVersion, requisition.getRowVersion(), "Requisition");

        if (requisition.status != RequisitionStatus.DRAFT) {
            throw conflict(
                    "Only a Draft requisition can be permanently deleted. Use Cancel Requisition after submission so Store/Purchase history remains traceable.");
        }

        String actor = accessService.actor();
        String projectCode = product == null ? null : product.getProjectCode();
        String drawingNo = product == null ? null : product.getDrawingNo();

        auditService.record(
                "REQUISITION",
                requisition.getId(),
                "DRAFT_REQUISITION_DELETED",
                plantCode,
                projectCode,
                drawingNo,
                auditService.details(
                        "requisitionNumber", requisition.requisitionNumber,
                        "deletedBy", actor,
                        "deletePolicy", "DRAFT_ONLY"));

        try {
            List<MatFlowRequisitionLine> lines = requisitionLineRepository
                    .findByRequisition_IdOrderByLineNoAsc(requisition.getId());

            if (!lines.isEmpty()) {
                requisitionLineRepository.deleteAll(lines);
            }

            requisitionRepository.delete(requisition);
            entityManager.flush();
        } catch (DataIntegrityViolationException ex) {
            throw conflict(
                    "This Draft requisition already owns downstream MatFlow records and cannot be permanently deleted. Use the normal cancellation workflow instead.");
        }
    }

    /** Deletes only a DRAFT material return, before any dispatch/stock movement. */
    @Transactional
    public void deleteDraftMaterialReturn(UUID materialReturnId, Long rowVersion) {
        accessService.requireProductionReturnCreate();

        MatFlowMaterialReturn materialReturn = materialReturnRepository
                .findById(materialReturnId)
                .orElseThrow(() -> notFound("Material return not found"));
        if (materialReturn.requisition != null) {
            accessService.requireProductionOwnership(materialReturn.requisition.requestedBy);
        }

        String plantCode = materialReturn.fromLocation == null
                ? null
                : materialReturn.fromLocation.getPlantCode();
        accessService.requirePlantAccess(plantCode);
        assertVersion(rowVersion, materialReturn.getRowVersion(), "Material return");

        if (materialReturn.status != MaterialReturnStatus.DRAFT) {
            throw conflict(
                    "Only a Draft material return can be permanently deleted. Dispatched/received returns are physical stock movements and are retained.");
        }

        String actor = accessService.actor();
        MatFlowProjectDrawing product = materialReturn.requisition == null
                ? null
                : materialReturn.requisition.projectDrawing;

        auditService.record(
                "MATERIAL_RETURN",
                materialReturn.getId(),
                "DRAFT_MATERIAL_RETURN_DELETED",
                plantCode,
                product == null ? null : product.getProjectCode(),
                product == null ? null : product.getDrawingNo(),
                auditService.details(
                        "returnNumber", materialReturn.returnNumber,
                        "requisitionNumber", materialReturn.requisition == null
                                ? null
                                : materialReturn.requisition.requisitionNumber,
                        "deletedBy", actor,
                        "deletePolicy", "DRAFT_ONLY"));

        try {
            List<MatFlowMaterialReturnLine> lines = materialReturnLineRepository
                    .findByMaterialReturn_IdOrderByCreatedAtAsc(materialReturn.getId());

            if (!lines.isEmpty()) {
                materialReturnLineRepository.deleteAll(lines);
            }

            materialReturnRepository.delete(materialReturn);
            entityManager.flush();
        } catch (DataIntegrityViolationException ex) {
            throw conflict(
                    "This material return has already entered physical execution and cannot be deleted.");
        }
    }

    private void assertVersion(Long requested, Long current, String entity) {
        if (requested == null) {
            throw badRequest(entity + " rowVersion is required");
        }
        if (!requested.equals(current)) {
            throw conflict(entity + " was modified by another user. Refresh and retry.");
        }
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private ResponseStatusException conflict(String message) {
        return new ResponseStatusException(HttpStatus.CONFLICT, message);
    }

    private ResponseStatusException notFound(String message) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
    }
}
