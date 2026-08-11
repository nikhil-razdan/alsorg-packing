package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowProjectDtos.ProductApprovalRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProjectDtos.ProductPortfolioRow;
import com.alsorg.packing.controller.dto.matflow.MatFlowProjectDtos.ProductRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProjectDtos.ProjectPortfolioResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowProjectDtos.ProjectRequest;
import com.alsorg.packing.domain.matflow.MatFlowBom;
import com.alsorg.packing.domain.matflow.MatFlowBomStatus;
import com.alsorg.packing.domain.matflow.MatFlowMaterialRequisition;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ProjectProductApprovalStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RequisitionStatus;
import com.alsorg.packing.domain.matflow.MatFlowProject;
import com.alsorg.packing.domain.matflow.MatFlowProjectDrawing;
import com.alsorg.packing.domain.matflow.MatFlowRequisitionLine;
import com.alsorg.packing.repository.matflow.MatFlowBomRepository;
import com.alsorg.packing.repository.matflow.MatFlowMaterialRequisitionRepository;
import com.alsorg.packing.repository.matflow.MatFlowProjectProductRepository;
import com.alsorg.packing.repository.matflow.MatFlowProjectRepository;
import com.alsorg.packing.repository.matflow.MatFlowRequisitionLineRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * First-class Project aggregate boundary.
 *
 * This service intentionally leaves existing material execution foreign keys
 * attached to MatFlowProjectDrawing (the Product/Item child). The parent
 * Project
 * is a portfolio/ownership aggregate, while every BOM/requisition/stock
 * movement
 * remains traceable to the exact product and drawing that consumed it.
 */
@Service
public class MatFlowProjectService {

    private final MatFlowProjectRepository projectRepository;
    private final MatFlowProjectProductRepository productRepository;
    private final MatFlowBomRepository bomRepository;
    private final MatFlowMaterialRequisitionRepository requisitionRepository;
    private final MatFlowRequisitionLineRepository requisitionLineRepository;
    private final MatFlowAccessService accessService;
    private final MatFlowAuditService auditService;

    public MatFlowProjectService(
            MatFlowProjectRepository projectRepository,
            MatFlowProjectProductRepository productRepository,
            MatFlowBomRepository bomRepository,
            MatFlowMaterialRequisitionRepository requisitionRepository,
            MatFlowRequisitionLineRepository requisitionLineRepository,
            MatFlowAccessService accessService,
            MatFlowAuditService auditService) {
        this.projectRepository = projectRepository;
        this.productRepository = productRepository;
        this.bomRepository = bomRepository;
        this.requisitionRepository = requisitionRepository;
        this.requisitionLineRepository = requisitionLineRepository;
        this.accessService = accessService;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<ProjectPortfolioResponse> list(String search, Boolean active, String plantCode) {
        accessService.requireRead();

        String query = normalizeSearch(search);
        String requestedPlant = cleanUpper(plantCode);
        if (requestedPlant != null)
            accessService.requirePlantAccess(requestedPlant);

        return projectRepository.findAllByOrderByUpdatedAtDesc().stream()
                .filter(project -> accessService.canAccessPlant(project.getPlantCode()))
                .filter(project -> requestedPlant == null || requestedPlant.equals(cleanUpper(project.getPlantCode())))
                .filter(project -> active == null || project.isActive() == active)
                .filter(project -> query.isBlank()
                        || contains(project.getProjectCode(), query)
                        || contains(project.getProjectName(), query)
                        || contains(project.getClientName(), query)
                        || productsOf(project).stream().anyMatch(product -> contains(product.getProductName(), query)
                                || contains(product.getDrawingNo(), query)))
                .map(this::toPortfolio)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProjectPortfolioResponse get(UUID id) {
        accessService.requireRead();
        return toPortfolio(requireProject(id));
    }

    @Transactional
    public ProjectPortfolioResponse create(ProjectRequest request) {
        accessService.requireProjectWrite();
        validateProjectRequest(request, false);

        String plantCode = requiredUpper(request.plantCode(), "Plant");
        String projectCode = requiredUpper(request.projectCode(), "Project code");
        accessService.requirePlantAccess(plantCode);

        if (projectRepository.existsByPlantCodeIgnoreCaseAndProjectCodeIgnoreCase(plantCode, projectCode)) {
            throw conflict("Project code already exists in plant " + plantCode + ": " + projectCode);
        }

        String actor = accessService.actor();
        MatFlowProject project = new MatFlowProject();
        applyProject(project, request, true);
        project.setCreatedBy(actor);
        project.setUpdatedBy(actor);
        project = projectRepository.save(project);

        auditService.record(
                "PROJECT",
                project.getId(),
                "PROJECT_CREATED",
                project.getPlantCode(),
                project.getProjectCode(),
                null,
                auditService.details(
                        "projectName", project.getProjectName(),
                        "clientName", project.getClientName(),
                        "priority", project.getPriority()));

        return toPortfolio(project);
    }

    @Transactional
    public ProjectPortfolioResponse update(UUID id, ProjectRequest request) {
        accessService.requireProjectWrite();
        validateProjectRequest(request, true);

        MatFlowProject project = requireProject(id);
        assertVersion(request.rowVersion(), project.getRowVersion(), "Project");

        List<MatFlowProjectDrawing> products = productsOf(project);
        String nextCode = requiredUpper(request.projectCode(), "Project code");
        String nextPlant = requiredUpper(request.plantCode(), "Plant");

        if (!products.isEmpty()
                && (!same(project.getProjectCode(), nextCode) || !same(project.getPlantCode(), nextPlant))) {
            throw conflict(
                    "Project code and plant cannot be changed after products have been created. Create a new Project instead.");
        }

        accessService.requirePlantAccess(nextPlant);
        if (projectRepository.existsByPlantCodeIgnoreCaseAndProjectCodeIgnoreCaseAndIdNot(nextPlant, nextCode,
                project.getId())) {
            throw conflict("Project code already exists in plant " + nextPlant + ": " + nextCode);
        }

        applyProject(project, request, false);
        String actor = accessService.actor();
        project.setUpdatedBy(actor);
        project = projectRepository.save(project);

        /* Keep compatibility snapshots in child Product rows synchronized. */
        for (MatFlowProjectDrawing product : products) {
            product.setProject(project);
            product.setUpdatedBy(actor);
            productRepository.save(product);
        }

        auditService.record(
                "PROJECT",
                project.getId(),
                "PROJECT_UPDATED",
                project.getPlantCode(),
                project.getProjectCode(),
                null,
                auditService.details(
                        "projectName", project.getProjectName(),
                        "clientName", project.getClientName(),
                        "active", project.isActive()));

        return toPortfolio(project);
    }

    @Transactional
    public ProjectPortfolioResponse addProduct(UUID projectId, ProductRequest request) {
        accessService.requireProjectWrite();
        validateProductRequest(request, false);

        MatFlowProject project = requireProject(projectId);
        if (!project.isActive())
            throw conflict("Cannot add a product to an inactive Project");

        String drawingNo = requiredUpper(request.drawingNo(), "Drawing number");
        String drawingRevision = defaultRevision(request.drawingRevision());

        boolean duplicate = productsOf(project).stream().anyMatch(product -> same(product.getDrawingNo(), drawingNo)
                && same(product.getDrawingRevision(), drawingRevision));
        if (duplicate) {
            throw conflict("Drawing/revision already exists in this Project: " + drawingNo + " Rev " + drawingRevision);
        }

        String actor = accessService.actor();
        MatFlowProjectDrawing product = new MatFlowProjectDrawing();
        product.setProject(project);
        applyProduct(product, request);
        product.setProductApprovalStatus(ProjectProductApprovalStatus.PENDING_DIRECTOR_APPROVAL);
        product.setProductApprovedBy(null);
        product.setProductApprovedAt(null);
        product.setProductReturnedBy(null);
        product.setProductReturnedAt(null);
        product.setProductApprovalRemarks(null);
        product.setCreatedBy(actor);
        product.setUpdatedBy(actor);
        product = productRepository.save(product);

        auditService.record(
                "PROJECT_PRODUCT",
                product.getId(),
                "PROJECT_PRODUCT_CREATED",
                project.getPlantCode(),
                project.getProjectCode(),
                product.getDrawingNo(),
                auditService.details(
                        "projectId", project.getId(),
                        "productName", product.getProductName(),
                        "drawingRevision", product.getDrawingRevision(),
                        "approvalStatus", product.getProductApprovalStatus()));

        return toPortfolio(project);
    }

    @Transactional
    public ProjectPortfolioResponse updateProduct(UUID projectId, UUID productId, ProductRequest request) {
        accessService.requireProjectWrite();
        validateProductRequest(request, true);

        MatFlowProject project = requireProject(projectId);
        MatFlowProjectDrawing product = requireProduct(project, productId);
        assertVersion(request.rowVersion(), product.getRowVersion(), "Project Product");

        String nextName = required(request.productName(), "Product name");
        String nextDrawing = requiredUpper(request.drawingNo(), "Drawing number");
        String nextRevision = defaultRevision(request.drawingRevision());

        boolean identityChanged = !same(product.getProductName(), nextName)
                || !same(product.getDrawingNo(), nextDrawing)
                || !same(product.getDrawingRevision(), nextRevision);

        boolean hasBom = !bomRepository
                .findByProjectDrawing_IdOrderByRevisionNoDesc(product.getId())
                .isEmpty();

        if (hasBom && identityChanged) {
            throw conflict(
                    "Product identity/drawing cannot be changed after a BOM exists. Create a new Product/Drawing revision instead.");
        }

        boolean duplicate = productsOf(project).stream()
                .filter(other -> !other.getId().equals(product.getId()))
                .anyMatch(other -> same(other.getDrawingNo(), nextDrawing)
                        && same(other.getDrawingRevision(), nextRevision));
        if (duplicate)
            throw conflict("Drawing/revision already exists in this Project");

        applyProduct(product, request);
        product.setProject(project);

        if (identityChanged) {
            product.setProductApprovalStatus(ProjectProductApprovalStatus.PENDING_DIRECTOR_APPROVAL);
            product.setProductApprovedBy(null);
            product.setProductApprovedAt(null);
            product.setProductReturnedBy(null);
            product.setProductReturnedAt(null);
            product.setProductApprovalRemarks("Product identity changed; Director approval is required again.");
        }

        product.setUpdatedBy(accessService.actor());
        productRepository.save(product);

        auditService.record(
                "PROJECT_PRODUCT",
                product.getId(),
                "PROJECT_PRODUCT_UPDATED",
                project.getPlantCode(),
                project.getProjectCode(),
                product.getDrawingNo(),
                auditService.details(
                        "productName", product.getProductName(),
                        "approvalStatus", product.getProductApprovalStatus(),
                        "identityChanged", identityChanged));

        return toPortfolio(project);
    }

    @Transactional
    public ProjectPortfolioResponse approveProduct(UUID projectId, UUID productId, ProductApprovalRequest request) {
        accessService.requireProjectProductApproval();
        MatFlowProject project = requireProject(projectId);
        MatFlowProjectDrawing product = requireProduct(project, productId);
        assertVersion(request == null ? null : request.rowVersion(), product.getRowVersion(), "Project Product");

        if (!product.isActive())
            throw conflict("Inactive Product cannot be approved");

        String actor = accessService.actor();
        product.setProductApprovalStatus(ProjectProductApprovalStatus.APPROVED);
        product.setProductApprovedBy(actor);
        product.setProductApprovedAt(LocalDateTime.now());
        product.setProductReturnedBy(null);
        product.setProductReturnedAt(null);
        product.setProductApprovalRemarks(request == null ? null : clean(request.remarks()));
        product.setUpdatedBy(actor);
        productRepository.save(product);

        auditService.record(
                "PROJECT_PRODUCT",
                product.getId(),
                "PROJECT_PRODUCT_DIRECTOR_APPROVED",
                project.getPlantCode(),
                project.getProjectCode(),
                product.getDrawingNo(),
                auditService.details("productName", product.getProductName(), "approvedBy", actor));

        return toPortfolio(project);
    }

    @Transactional
    public ProjectPortfolioResponse returnProduct(UUID projectId, UUID productId, ProductApprovalRequest request) {
        accessService.requireProjectProductApproval();
        MatFlowProject project = requireProject(projectId);
        MatFlowProjectDrawing product = requireProduct(project, productId);
        assertVersion(request == null ? null : request.rowVersion(), product.getRowVersion(), "Project Product");

        String remarks = request == null ? null : clean(request.remarks());
        if (remarks == null)
            throw badRequest("Director return remarks are required");

        String actor = accessService.actor();
        product.setProductApprovalStatus(ProjectProductApprovalStatus.RETURNED);
        product.setProductApprovedBy(null);
        product.setProductApprovedAt(null);
        product.setProductReturnedBy(actor);
        product.setProductReturnedAt(LocalDateTime.now());
        product.setProductApprovalRemarks(remarks);
        product.setUpdatedBy(actor);
        productRepository.save(product);

        auditService.record(
                "PROJECT_PRODUCT",
                product.getId(),
                "PROJECT_PRODUCT_DIRECTOR_RETURNED",
                project.getPlantCode(),
                project.getProjectCode(),
                product.getDrawingNo(),
                auditService.details("productName", product.getProductName(), "remarks", remarks, "returnedBy", actor));

        return toPortfolio(project);
    }

    /**
     * Permanently removes a setup-only Project aggregate.
     *
     * Historical execution is deliberately protected: once any Product owns a
     * BOM or material requisition, the Project must be deactivated instead of
     * deleted so audit and material traceability remain intact.
     */
    @Transactional
    public void deleteProject(UUID projectId, Long rowVersion) {
        accessService.requireProjectWrite();

        MatFlowProject project = requireProject(projectId);
        assertVersion(rowVersion, project.getRowVersion(), "Project");

        List<MatFlowProjectDrawing> products = productsOf(project);
        for (MatFlowProjectDrawing product : products) {
            assertProductCanBeDeleted(product);
        }

        String actor = accessService.actor();

        for (MatFlowProjectDrawing product : products) {
            auditService.record(
                    "PROJECT_PRODUCT",
                    product.getId(),
                    "PROJECT_PRODUCT_DELETED",
                    project.getPlantCode(),
                    project.getProjectCode(),
                    product.getDrawingNo(),
                    auditService.details(
                            "projectId", project.getId(),
                            "productName", product.getProductName(),
                            "drawingRevision", product.getDrawingRevision(),
                            "deletedBy", actor));
        }

        auditService.record(
                "PROJECT",
                project.getId(),
                "PROJECT_DELETED",
                project.getPlantCode(),
                project.getProjectCode(),
                null,
                auditService.details(
                        "projectName", project.getProjectName(),
                        "clientName", project.getClientName(),
                        "productCount", products.size(),
                        "deletedBy", actor));

        try {
            if (!products.isEmpty()) {
                productRepository.deleteAll(products);
                /*
                 * Force FK/constraint validation inside this service method so a
                 * protected historical reference becomes a controlled 409 rather
                 * than an uncaught transaction-commit 500.
                 */
                productRepository.flush();
            }

            projectRepository.delete(project);
            projectRepository.flush();
        } catch (DataIntegrityViolationException ex) {
            throw conflict(
                    "Cannot delete Project '" + project.getProjectCode()
                            + "' because another MatFlow record still references the Project or one of its Products. "
                            + "Deactivate it instead so historical traceability is preserved.");
        }
    }

    /**
     * Permanently removes one setup-only Product/Drawing child.
     * Products that already own BOM or material-requisition history are kept
     * immutable from a deletion perspective and should be deactivated instead.
     */
    @Transactional
    public ProjectPortfolioResponse deleteProduct(
            UUID projectId,
            UUID productId,
            Long rowVersion) {

        accessService.requireProjectWrite();

        MatFlowProject project = requireProject(projectId);
        MatFlowProjectDrawing product = requireProduct(project, productId);
        assertVersion(rowVersion, product.getRowVersion(), "Project Product");
        assertProductCanBeDeleted(product);

        String actor = accessService.actor();

        auditService.record(
                "PROJECT_PRODUCT",
                product.getId(),
                "PROJECT_PRODUCT_DELETED",
                project.getPlantCode(),
                project.getProjectCode(),
                product.getDrawingNo(),
                auditService.details(
                        "projectId", project.getId(),
                        "productName", product.getProductName(),
                        "drawingRevision", product.getDrawingRevision(),
                        "deletedBy", actor));

        try {
            productRepository.delete(product);
            /* See deleteProject(): force the physical constraint check here. */
            productRepository.flush();
        } catch (DataIntegrityViolationException ex) {
            throw conflict(
                    "Cannot delete Product '" + product.getProductName()
                            + "' because another MatFlow record still references it. "
                            + "Deactivate it instead so historical traceability is preserved.");
        }

        return toPortfolio(project);
    }

    private void assertProductCanBeDeleted(MatFlowProjectDrawing product) {
        if (product == null || product.getId() == null) {
            throw badRequest("Project Product is required");
        }

        boolean hasBom = !bomRepository
                .findByProjectDrawing_IdOrderByRevisionNoDesc(product.getId())
                .isEmpty();
        boolean hasRequisition = !requisitionRepository
                .findByProjectDrawing_IdOrderByCreatedAtDesc(product.getId())
                .isEmpty();

        if (hasBom || hasRequisition) {
            String dependencies = hasBom && hasRequisition
                    ? "BOM and material requisition history"
                    : hasBom
                            ? "BOM history"
                            : "material requisition history";

            throw conflict(
                    "Cannot delete Product '" + product.getProductName() + "' because it already has "
                            + dependencies
                            + ". Mark the Product inactive instead so MatFlow traceability is preserved.");
        }
    }

    /**
     * Project Portfolio is an administrative/master view, not the execution
     * tracker. Keep this response intentionally shallow: Project -> Product ->
     * latest BOM readiness only. Material demand, reservation, shortage, transfer,
     * QC, processing and production quantities belong to the Tracker endpoint.
     *
     * This also avoids unnecessarily traversing live requisition graphs from the
     * Projects & Products page, which makes the portfolio read faster and removes
     * Hibernate proxy sensitivity from a master-data screen.
     */
    private ProjectPortfolioResponse toPortfolio(MatFlowProject project) {
        List<ProductPortfolioRow> products = productsOf(project).stream()
                .sorted(Comparator.comparing(
                        MatFlowProjectDrawing::getCreatedAt,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .map(this::toAdministrativeProductRow)
                .toList();

        int approved = (int) products.stream()
                .filter(p -> p.approvalStatus() == ProjectProductApprovalStatus.APPROVED)
                .count();

        String portfolioStage = derivePortfolioStage(products);
        String portfolioHealth = derivePortfolioHealth(project, products);

        return new ProjectPortfolioResponse(
                project.getId(),
                project.getProjectCode(),
                project.getProjectName(),
                project.getClientName(),
                project.getPlantCode(),
                project.getRequiredDate(),
                project.getPriority(),
                project.getProjectManager(),
                project.getRemarks(),
                project.isActive(),
                products.size(),
                approved,
                0, // completedProductCount: execution lives in Tracker
                0, // shortageProductCount: execution lives in Tracker
                BigDecimal.ZERO, // materialCoveragePercent: execution lives in Tracker
                portfolioStage,
                portfolioHealth,
                project.getRowVersion(),
                project.getCreatedAt(),
                project.getUpdatedAt(),
                products);
    }

    private ProductPortfolioRow toAdministrativeProductRow(MatFlowProjectDrawing product) {
        MatFlowBom latestBom = bomRepository
                .findByProjectDrawing_IdOrderByRevisionNoDesc(product.getId())
                .stream()
                .findFirst()
                .orElse(null);

        BigDecimal zeroQty = BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP);

        return new ProductPortfolioRow(
                product.getId(),
                product.getProductName(),
                product.getDrawingNo(),
                product.getDrawingRevision(),
                product.getRequiredDate(),
                product.getProductApprovalStatus(),
                product.getProductApprovedBy(),
                product.getProductApprovedAt(),
                product.getProductReturnedBy(),
                product.getProductReturnedAt(),
                product.getProductApprovalRemarks(),
                product.isActive(),
                latestBom == null ? null : latestBom.getId(),
                latestBom == null ? null : latestBom.getBomNumber(),
                latestBom == null ? null : latestBom.getRevisionNo(),
                latestBom == null || latestBom.getStatus() == null
                        ? null
                        : latestBom.getStatus().name(),
                latestBom != null && latestBom.isEffective(),
                null, // latestRequisitionId: Tracker owns execution
                null, // latestRequisitionNumber
                null, // requisitionStatus
                deriveProductPortfolioStage(product, latestBom),
                zeroQty,
                zeroQty,
                zeroQty,
                zeroQty,
                zeroQty,
                product.getRowVersion(),
                product.getCreatedAt(),
                product.getUpdatedAt());
    }

    private String deriveProductPortfolioStage(
            MatFlowProjectDrawing product,
            MatFlowBom latestBom) {

        if (product == null || !product.isActive())
            return "INACTIVE";

        if (product.getProductApprovalStatus() != ProjectProductApprovalStatus.APPROVED) {
            return "DIRECTOR APPROVAL";
        }

        if (latestBom == null)
            return "ENGINEERING / BOM";
        if (!latestBom.isEffective())
            return "BOM REVIEW";
        return "READY FOR EXECUTION";
    }

    private String derivePortfolioStage(List<ProductPortfolioRow> products) {
        if (products == null || products.isEmpty())
            return "PROJECT SETUP";

        if (products.stream().anyMatch(
                p -> p.approvalStatus() != ProjectProductApprovalStatus.APPROVED)) {
            return "DIRECTOR APPROVAL";
        }

        if (products.stream().anyMatch(p -> p.latestBomId() == null)) {
            return "ENGINEERING / BOM";
        }

        return "BOM ADMINISTRATION";
    }

    private String derivePortfolioHealth(
            MatFlowProject project,
            List<ProductPortfolioRow> products) {

        if (project == null || !project.isActive())
            return "INACTIVE";
        if (products == null || products.isEmpty())
            return "SETUP";

        if (project.getRequiredDate() != null
                && project.getRequiredDate().isBefore(java.time.LocalDate.now())) {
            return "OVERDUE";
        }

        if (products.stream().anyMatch(
                p -> p.approvalStatus() != ProjectProductApprovalStatus.APPROVED)) {
            return "APPROVAL_PENDING";
        }

        if (products.stream().anyMatch(p -> p.latestBomId() == null)) {
            return "BOM_PENDING";
        }

        return "READY";
    }

    private List<MatFlowProjectDrawing> productsOf(MatFlowProject project) {
        UUID id = project == null ? null : project.getId();
        if (id == null)
            return List.of();
        return productRepository.findByProject_IdOrderByCreatedAtAsc(id);
    }

    private MatFlowProject requireProject(UUID id) {
        if (id == null)
            throw badRequest("Project ID is required");
        MatFlowProject project = projectRepository.findById(id)
                .orElseThrow(() -> notFound("MatFlow Project not found"));
        accessService.requirePlantAccess(project.getPlantCode());
        return project;
    }

    private MatFlowProjectDrawing requireProduct(MatFlowProject project, UUID productId) {
        if (productId == null)
            throw badRequest("Product ID is required");
        MatFlowProjectDrawing product = productRepository.findById(productId)
                .orElseThrow(() -> notFound("Project Product not found"));
        if (product.getProject() == null || !project.getId().equals(product.getProject().getId())) {
            throw conflict("Product does not belong to the selected Project");
        }
        return product;
    }

    private void applyProject(MatFlowProject project, ProjectRequest request, boolean creating) {
        project.setProjectCode(requiredUpper(request.projectCode(), "Project code"));
        project.setProjectName(required(request.projectName(), "Project name"));
        project.setClientName(required(request.clientName(), "Client name"));
        project.setPlantCode(requiredUpper(request.plantCode(), "Plant"));
        project.setRequiredDate(request.requiredDate());
        project.setPriority(request.priority());
        project.setProjectManager(request.projectManager());
        project.setRemarks(request.remarks());
        project.setActive(request.active() == null ? creating || project.isActive() : request.active());
    }

    private void applyProduct(MatFlowProjectDrawing product, ProductRequest request) {
        product.setProductName(required(request.productName(), "Product name"));
        product.setDrawingNo(requiredUpper(request.drawingNo(), "Drawing number"));
        product.setDrawingRevision(defaultRevision(request.drawingRevision()));
        product.setRequiredDate(request.requiredDate());
        product.setRemarks(request.remarks());
        product.setActive(request.active() == null || request.active());
    }

    private void validateProjectRequest(ProjectRequest request, boolean update) {
        if (request == null)
            throw badRequest("Project request is required");
        required(request.projectCode(), "Project code");
        required(request.projectName(), "Project name");
        required(request.clientName(), "Client name");
        required(request.plantCode(), "Plant");
        if (update && request.rowVersion() == null)
            throw badRequest("Project rowVersion is required");
    }

    private void validateProductRequest(ProductRequest request, boolean update) {
        if (request == null)
            throw badRequest("Product request is required");
        required(request.productName(), "Product name");
        required(request.drawingNo(), "Drawing number");
        if (update && request.rowVersion() == null)
            throw badRequest("Project Product rowVersion is required");
    }

    private void assertVersion(Long requested, Long current, String entity) {
        if (requested == null)
            throw badRequest(entity + " rowVersion is required");
        if (!requested.equals(current))
            throw conflict(entity + " was modified by another user. Refresh and retry.");
    }

    private BigDecimal zero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private BigDecimal scale(BigDecimal value) {
        return zero(value).setScale(3, RoundingMode.HALF_UP);
    }

    private boolean same(String a, String b) {
        return cleanUpper(a) != null && cleanUpper(a).equals(cleanUpper(b));
    }

    private String defaultRevision(String value) {
        String v = cleanUpper(value);
        return v == null ? "0" : v;
    }

    private String requiredUpper(String value, String field) {
        String v = cleanUpper(value);
        if (v == null)
            throw badRequest(field + " is required");
        return v;
    }

    private String required(String value, String field) {
        String v = clean(value);
        if (v == null)
            throw badRequest(field + " is required");
        return v;
    }

    private String cleanUpper(String value) {
        String v = clean(value);
        return v == null ? null : v.toUpperCase(Locale.ROOT);
    }

    private String clean(String value) {
        if (value == null)
            return null;
        String v = value.trim();
        return v.isBlank() ? null : v;
    }

    private String normalizeSearch(String value) {
        String v = clean(value);
        return v == null ? "" : v.toLowerCase(Locale.ROOT);
    }

    private boolean contains(String value, String query) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(query);
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