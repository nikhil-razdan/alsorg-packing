package com.alsorg.packing.service.matflow;

import static com.alsorg.packing.controller.dto.matflow.MatFlowDtos.MaterialRequest;
import static com.alsorg.packing.controller.dto.matflow.MatFlowDtos.MaterialResponse;
import static com.alsorg.packing.controller.dto.matflow.MatFlowDtos.ProjectDrawingRequest;
import static com.alsorg.packing.controller.dto.matflow.MatFlowDtos.ProjectDrawingResponse;

import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.MaterialRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.MaterialResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.ProjectDrawingRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.ProjectDrawingResponse;
import com.alsorg.packing.domain.matflow.MatFlowMaterial;
import com.alsorg.packing.domain.matflow.MatFlowProjectDrawing;
import com.alsorg.packing.repository.matflow.MatFlowMaterialRepository;
import com.alsorg.packing.repository.matflow.MatFlowProjectDrawingRepository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MatFlowMasterService {

        private final MatFlowMaterialRepository materialRepository;
        private final MatFlowProjectDrawingRepository projectRepository;
        private final MatFlowAccessService accessService;

        public MatFlowMasterService(
                        MatFlowMaterialRepository materialRepository,
                        MatFlowProjectDrawingRepository projectRepository,
                        MatFlowAccessService accessService) {
                this.materialRepository = materialRepository;

                this.projectRepository = projectRepository;

                this.accessService = accessService;
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

                return toMaterialResponse(
                                materialRepository.save(material));
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

                material.setUpdatedBy(
                                accessService.actor());

                return toMaterialResponse(
                                materialRepository.save(material));
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

                project.setCreatedBy(actor);
                project.setUpdatedBy(actor);

                return toProjectResponse(
                                projectRepository.save(project));
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

                String drawingNo = upper(request.drawingNo());

                String drawingRevision = normalizedRevision(
                                request.drawingRevision());

                if (projectRepository
                                .existsDuplicateExcludingId(
                                                projectCode,
                                                drawingNo,
                                                drawingRevision,
                                                id)) {
                        throw conflict(
                                        "Project drawing revision already exists");
                }

                applyProject(
                                project,
                                request,
                                plantCode);

                project.setUpdatedBy(
                                accessService.actor());

                return toProjectResponse(
                                projectRepository.save(project));
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

                material.setMinimumStock(
                                nonNegative(
                                                request.minimumStock(),
                                                "Minimum stock"));

                material.setReorderLevel(
                                nonNegative(
                                                request.reorderLevel(),
                                                "Reorder level"));

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

        private String upper(String value) {
                return value == null
                                ? null
                                : value.trim()
                                                .toUpperCase();
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