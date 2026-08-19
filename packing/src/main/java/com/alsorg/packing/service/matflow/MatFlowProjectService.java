package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowProjectDtos.ProductPortfolioRow;
import com.alsorg.packing.controller.dto.matflow.MatFlowProjectDtos.ProductRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProjectDtos.ProjectPortfolioResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowProjectDtos.ProjectRequest;
import com.alsorg.packing.domain.matflow.MatFlowBom;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ProjectProductApprovalStatus;
import com.alsorg.packing.domain.matflow.MatFlowProject;
import com.alsorg.packing.domain.matflow.MatFlowProjectDrawing;
import com.alsorg.packing.repository.matflow.MatFlowBomRepository;
import com.alsorg.packing.repository.matflow.MatFlowMaterialRequisitionRepository;
import com.alsorg.packing.repository.matflow.MatFlowProjectDrawingRepository;
import com.alsorg.packing.repository.matflow.MatFlowProjectRepository;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/**
 * First-class Project aggregate boundary.
 *
 * Project/Product creation is immediate and approval-free. The legacy
 * field/property name projectCode is retained for compatibility, but its
 * business meaning is PD No. / Project No. Existing material execution foreign
 * keys
 * attached to MatFlowProjectDrawing (the Product/Item child). The parent
 * Project
 * is a portfolio/ownership aggregate, while every BOM/requisition/stock
 * movement
 * remains traceable to the exact product and drawing that consumed it.
 */
@Service
public class MatFlowProjectService {

    private static final long PRODUCT_IMAGE_MAX_BYTES = 8L * 1024L * 1024L;
    private static final long DRAWING_MAX_BYTES = 20L * 1024L * 1024L;

    private static final List<String> PRODUCT_IMAGE_EXTENSIONS = List.of("jpg", "jpeg", "png", "webp");
    private static final List<String> PRODUCT_DRAWING_EXTENSIONS = List.of("pdf", "jpg", "jpeg", "png", "webp", "dwg",
            "dxf");

    private static final Set<String> PRODUCT_IMAGE_EXTENSION_SET = Set.copyOf(PRODUCT_IMAGE_EXTENSIONS);
    private static final Set<String> PRODUCT_DRAWING_EXTENSION_SET = Set.copyOf(PRODUCT_DRAWING_EXTENSIONS);

    private final MatFlowProjectRepository projectRepository;
    private final MatFlowProjectDrawingRepository productRepository;
    private final MatFlowBomRepository bomRepository;
    private final MatFlowMaterialRequisitionRepository requisitionRepository;
    private final MatFlowAccessService accessService;
    private final MatFlowAuditService auditService;
    private final Path attachmentRoot;

    public MatFlowProjectService(
            MatFlowProjectRepository projectRepository,
            MatFlowProjectDrawingRepository productRepository,
            MatFlowBomRepository bomRepository,
            MatFlowMaterialRequisitionRepository requisitionRepository,
            MatFlowAccessService accessService,
            MatFlowAuditService auditService,
            @Value("${matflow.product-attachment-dir:}") String configuredAttachmentDirectory) {
        this.projectRepository = projectRepository;
        this.productRepository = productRepository;
        this.bomRepository = bomRepository;
        this.requisitionRepository = requisitionRepository;
        this.accessService = accessService;
        this.auditService = auditService;
        this.attachmentRoot = resolveAttachmentRoot(configuredAttachmentDirectory);

        try {
            Files.createDirectories(this.attachmentRoot);
        } catch (IOException ex) {
            throw new IllegalStateException(
                    "Unable to initialize MatFlow Product attachment directory: " + this.attachmentRoot,
                    ex);
        }
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

    /**
     * Returns optional Engineering attachments for every Product in one Project.
     * Files are stored outside the transactional business tables; the Product
     * remains the durable business record and no new attachment table is needed.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> productAttachments(UUID projectId) {
        accessService.requireRead();

        MatFlowProject project = requireProject(projectId);
        return productsOf(project).stream()
                .map(product -> productAttachmentStatus(project, product))
                .toList();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> productAttachmentStatus(UUID projectId, UUID productId) {
        accessService.requireRead();

        MatFlowProject project = requireProject(projectId);
        MatFlowProjectDrawing product = requireProduct(project, productId);
        return productAttachmentStatus(project, product);
    }

    @Transactional
    public Map<String, Object> saveProductImage(
            UUID projectId,
            UUID productId,
            MultipartFile file) {

        accessService.requireProjectWrite();

        MatFlowProject project = requireProject(projectId);
        MatFlowProjectDrawing product = requireProduct(project, productId);
        saveAttachment(product, ProductAttachmentKind.PRODUCT_IMAGE, file);

        auditService.record(
                "PROJECT_PRODUCT",
                product.getId(),
                "PRODUCT_IMAGE_UPLOADED",
                project.getPlantCode(),
                project.getProjectCode(),
                product.getDrawingNo(),
                auditService.details(
                        "productName", product.getProductName(),
                        "drawingRevision", product.getDrawingRevision(),
                        "fileName", clean(file == null ? null : file.getOriginalFilename()),
                        "sizeBytes", file == null ? null : file.getSize()));

        return productAttachmentStatus(project, product);
    }

    @Transactional
    public Map<String, Object> saveProductDrawing(
            UUID projectId,
            UUID productId,
            MultipartFile file) {

        accessService.requireProjectWrite();

        MatFlowProject project = requireProject(projectId);
        MatFlowProjectDrawing product = requireProduct(project, productId);
        saveAttachment(product, ProductAttachmentKind.DRAWING, file);

        auditService.record(
                "PROJECT_PRODUCT",
                product.getId(),
                "PRODUCT_DRAWING_UPLOADED",
                project.getPlantCode(),
                project.getProjectCode(),
                product.getDrawingNo(),
                auditService.details(
                        "productName", product.getProductName(),
                        "drawingRevision", product.getDrawingRevision(),
                        "fileName", clean(file == null ? null : file.getOriginalFilename()),
                        "sizeBytes", file == null ? null : file.getSize()));

        return productAttachmentStatus(project, product);
    }

    @Transactional(readOnly = true)
    public Resource loadProductImage(UUID projectId, UUID productId) {
        accessService.requireRead();

        MatFlowProject project = requireProject(projectId);
        MatFlowProjectDrawing product = requireProduct(project, productId);
        Path path = requireAttachmentPath(product, ProductAttachmentKind.PRODUCT_IMAGE);
        return new FileSystemResource(path);
    }

    @Transactional(readOnly = true)
    public Resource loadProductDrawing(UUID projectId, UUID productId) {
        accessService.requireRead();

        MatFlowProject project = requireProject(projectId);
        MatFlowProjectDrawing product = requireProduct(project, productId);
        Path path = requireAttachmentPath(product, ProductAttachmentKind.DRAWING);
        return new FileSystemResource(path);
    }

    @Transactional(readOnly = true)
    public String productImageContentType(UUID projectId, UUID productId) {
        accessService.requireRead();

        MatFlowProject project = requireProject(projectId);
        MatFlowProjectDrawing product = requireProduct(project, productId);
        return attachmentContentType(
                requireAttachmentPath(product, ProductAttachmentKind.PRODUCT_IMAGE));
    }

    @Transactional(readOnly = true)
    public String productDrawingContentType(UUID projectId, UUID productId) {
        accessService.requireRead();

        MatFlowProject project = requireProject(projectId);
        MatFlowProjectDrawing product = requireProduct(project, productId);
        return attachmentContentType(
                requireAttachmentPath(product, ProductAttachmentKind.DRAWING));
    }

    @Transactional(readOnly = true)
    public String productImageFileName(UUID projectId, UUID productId) {
        accessService.requireRead();

        MatFlowProject project = requireProject(projectId);
        MatFlowProjectDrawing product = requireProduct(project, productId);
        Path path = requireAttachmentPath(product, ProductAttachmentKind.PRODUCT_IMAGE);
        return downloadFileName(product, ProductAttachmentKind.PRODUCT_IMAGE, path);
    }

    @Transactional(readOnly = true)
    public String productDrawingFileName(UUID projectId, UUID productId) {
        accessService.requireRead();

        MatFlowProject project = requireProject(projectId);
        MatFlowProjectDrawing product = requireProduct(project, productId);
        Path path = requireAttachmentPath(product, ProductAttachmentKind.DRAWING);
        return downloadFileName(product, ProductAttachmentKind.DRAWING, path);
    }

    @Transactional
    public Map<String, Object> deleteProductImage(UUID projectId, UUID productId) {
        return deleteProductAttachment(projectId, productId, ProductAttachmentKind.PRODUCT_IMAGE);
    }

    @Transactional
    public Map<String, Object> deleteProductDrawing(UUID projectId, UUID productId) {
        return deleteProductAttachment(projectId, productId, ProductAttachmentKind.DRAWING);
    }

    @Transactional
    public ProjectPortfolioResponse create(ProjectRequest request) {
        accessService.requireProjectWrite();
        validateProjectRequest(request, false);

        String plantCode = requiredUpper(request.plantCode(), "Plant");
        String projectCode = requiredUpper(request.projectCode(), "PD No.");
        accessService.requirePlantAccess(plantCode);

        if (projectRepository.existsByPlantCodeIgnoreCaseAndProjectCodeIgnoreCase(plantCode, projectCode)) {
            throw conflict("PD No. already exists in plant " + plantCode + ": " + projectCode);
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
        String nextCode = requiredUpper(request.projectCode(), "PD No.");
        String nextPlant = requiredUpper(request.plantCode(), "Plant");

        if (!products.isEmpty()
                && (!same(project.getProjectCode(), nextCode) || !same(project.getPlantCode(), nextPlant))) {
            throw conflict(
                    "PD No. and plant cannot be changed after products have been created. Create a new Project instead.");
        }

        accessService.requirePlantAccess(nextPlant);
        if (projectRepository.existsByPlantCodeIgnoreCaseAndProjectCodeIgnoreCaseAndIdNot(nextPlant, nextCode,
                project.getId())) {
            throw conflict("PD No. already exists in plant " + nextPlant + ": " + nextCode);
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
        product.setProductApprovalStatus(ProjectProductApprovalStatus.APPROVED);
        product.setProductApprovedBy(actor);
        product.setProductApprovedAt(LocalDateTime.now());
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
                        "executionEligible", true));

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

        String actor = accessService.actor();
        if (identityChanged) {
            product.setProductApprovalStatus(ProjectProductApprovalStatus.APPROVED);
            product.setProductApprovedBy(actor);
            product.setProductApprovedAt(LocalDateTime.now());
            product.setProductReturnedBy(null);
            product.setProductReturnedAt(null);
            product.setProductApprovalRemarks(null);
        }

        product.setUpdatedBy(actor);
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
                        "executionEligible", true,
                        "identityChanged", identityChanged));

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

            for (MatFlowProjectDrawing product : products) {
                deleteProductAttachmentDirectoryQuietly(product.getId());
            }
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
            deleteProductAttachmentDirectoryQuietly(product.getId());
        } catch (DataIntegrityViolationException ex) {
            throw conflict(
                    "Cannot delete Product '" + product.getProductName()
                            + "' because another MatFlow record still references it. "
                            + "Deactivate it instead so historical traceability is preserved.");
        }

        return toPortfolio(project);
    }

    private Map<String, Object> deleteProductAttachment(
            UUID projectId,
            UUID productId,
            ProductAttachmentKind kind) {

        accessService.requireProjectWrite();

        MatFlowProject project = requireProject(projectId);
        MatFlowProjectDrawing product = requireProduct(project, productId);
        Path path = findAttachmentPath(product.getId(), kind);

        if (path != null) {
            try {
                Files.deleteIfExists(path);
                deleteDirectoryIfEmpty(path.getParent());
            } catch (IOException ex) {
                throw new ResponseStatusException(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "Unable to remove " + kind.label,
                        ex);
            }

            auditService.record(
                    "PROJECT_PRODUCT",
                    product.getId(),
                    kind == ProductAttachmentKind.PRODUCT_IMAGE
                            ? "PRODUCT_IMAGE_REMOVED"
                            : "PRODUCT_DRAWING_REMOVED",
                    project.getPlantCode(),
                    project.getProjectCode(),
                    product.getDrawingNo(),
                    auditService.details(
                            "productName", product.getProductName(),
                            "drawingRevision", product.getDrawingRevision()));
        }

        return productAttachmentStatus(project, product);
    }

    private Map<String, Object> productAttachmentStatus(
            MatFlowProject project,
            MatFlowProjectDrawing product) {

        Path image = findAttachmentPath(product == null ? null : product.getId(),
                ProductAttachmentKind.PRODUCT_IMAGE);
        Path drawing = findAttachmentPath(product == null ? null : product.getId(),
                ProductAttachmentKind.DRAWING);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("projectId", project == null ? null : project.getId());
        response.put("productId", product == null ? null : product.getId());
        response.put("productImageAvailable", image != null);
        response.put("drawingAvailable", drawing != null);
        response.put("productImageFileName",
                image == null || product == null
                        ? null
                        : downloadFileName(product, ProductAttachmentKind.PRODUCT_IMAGE, image));
        response.put("drawingFileName",
                drawing == null || product == null
                        ? null
                        : downloadFileName(product, ProductAttachmentKind.DRAWING, drawing));
        return response;
    }

    private void saveAttachment(
            MatFlowProjectDrawing product,
            ProductAttachmentKind kind,
            MultipartFile file) {

        validateAttachment(kind, file);

        UUID productId = product == null ? null : product.getId();
        if (productId == null) {
            throw badRequest("Product ID is required before an attachment can be saved");
        }

        String ext = extension(file.getOriginalFilename());
        Path directory = productAttachmentDirectory(productId);
        Path target = directory.resolve(kind.baseName + "." + ext).normalize();

        if (!target.getParent().equals(directory)) {
            throw badRequest("Invalid Product attachment path");
        }

        Path temporary = null;
        try {
            Files.createDirectories(directory);
            temporary = directory.resolve(
                    kind.baseName + ".upload-" + UUID.randomUUID() + ".tmp");

            Files.copy(
                    file.getInputStream(),
                    temporary,
                    StandardCopyOption.REPLACE_EXISTING);

            try {
                Files.move(
                        temporary,
                        target,
                        StandardCopyOption.ATOMIC_MOVE,
                        StandardCopyOption.REPLACE_EXISTING);
            } catch (java.nio.file.AtomicMoveNotSupportedException ignored) {
                Files.move(
                        temporary,
                        target,
                        StandardCopyOption.REPLACE_EXISTING);
            }

            for (String otherExtension : kind.extensions) {
                Path old = directory.resolve(kind.baseName + "." + otherExtension);
                if (!old.equals(target)) {
                    Files.deleteIfExists(old);
                }
            }
        } catch (IOException ex) {
            if (temporary != null) {
                try {
                    Files.deleteIfExists(temporary);
                } catch (IOException ignored) {
                    // best-effort cleanup
                }
            }
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Unable to store " + kind.label,
                    ex);
        }
    }

    private void validateAttachment(
            ProductAttachmentKind kind,
            MultipartFile file) {

        if (file == null || file.isEmpty()) {
            throw badRequest("Select a " + kind.label + " to upload");
        }

        if (file.getSize() > kind.maxBytes) {
            throw badRequest(
                    kind.label + " cannot exceed " + (kind.maxBytes / (1024L * 1024L)) + " MB");
        }

        String ext = extension(file.getOriginalFilename());
        if (!kind.extensionSet.contains(ext)) {
            throw badRequest(
                    kind.label + " must be one of: " + String.join(", ", kind.extensions));
        }

        String contentType = clean(file.getContentType());
        if (kind == ProductAttachmentKind.PRODUCT_IMAGE
                && contentType != null
                && !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            throw badRequest("Product image must be an image file");
        }
    }

    private Path requireAttachmentPath(
            MatFlowProjectDrawing product,
            ProductAttachmentKind kind) {

        Path path = findAttachmentPath(product == null ? null : product.getId(), kind);
        if (path == null) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    kind.label + " not found");
        }
        return path;
    }

    private Path findAttachmentPath(
            UUID productId,
            ProductAttachmentKind kind) {

        if (productId == null) {
            return null;
        }

        Path directory = productAttachmentDirectory(productId);
        for (String ext : kind.extensions) {
            Path candidate = directory.resolve(kind.baseName + "." + ext);
            if (Files.isRegularFile(candidate)) {
                return candidate;
            }
        }
        return null;
    }

    private Path productAttachmentDirectory(UUID productId) {
        if (productId == null) {
            throw badRequest("Product ID is required");
        }
        Path directory = attachmentRoot.resolve(productId.toString()).normalize();
        if (!directory.getParent().equals(attachmentRoot)) {
            throw badRequest("Invalid Product attachment directory");
        }
        return directory;
    }

    private String attachmentContentType(Path path) {
        if (path == null) {
            return "application/octet-stream";
        }

        try {
            String detected = Files.probeContentType(path);
            if (detected != null && !detected.isBlank()) {
                return detected;
            }
        } catch (IOException ignored) {
            // fallback below
        }

        return mediaTypeForExtension(extension(path.getFileName().toString()));
    }

    private String downloadFileName(
            MatFlowProjectDrawing product,
            ProductAttachmentKind kind,
            Path path) {

        String ext = extension(path == null ? null : path.getFileName().toString());
        String stem;

        if (kind == ProductAttachmentKind.PRODUCT_IMAGE) {
            stem = safeFileStem(
                    (product == null ? "product" : product.getProductName()) + "-image");
        } else {
            stem = safeFileStem(
                    (product == null ? "drawing" : product.getDrawingNo())
                            + "-Rev-"
                            + (product == null ? "0" : defaultRevision(product.getDrawingRevision())));
        }

        return stem + (ext.isBlank() ? "" : "." + ext);
    }

    private String safeFileStem(String value) {
        String cleaned = clean(value);
        if (cleaned == null) {
            return "matflow-file";
        }

        String safe = cleaned
                .replaceAll("[^A-Za-z0-9._-]+", "_")
                .replaceAll("_+", "_")
                .replaceAll("^[_\\.]+|[_\\.]+$", "");

        return safe.isBlank() ? "matflow-file" : safe;
    }

    private String extension(String fileName) {
        String name = clean(fileName);
        if (name == null) {
            return "";
        }

        int dot = name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) {
            return "";
        }

        return name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private String mediaTypeForExtension(String ext) {
        return switch (ext) {
            case "png" -> "image/png";
            case "jpg", "jpeg" -> "image/jpeg";
            case "webp" -> "image/webp";
            case "pdf" -> "application/pdf";
            case "dwg" -> "image/vnd.dwg";
            case "dxf" -> "image/vnd.dxf";
            default -> "application/octet-stream";
        };
    }

    private Path resolveAttachmentRoot(String configured) {
        String directory = clean(configured);
        if (directory != null) {
            return Path.of(directory).toAbsolutePath().normalize();
        }

        return Path.of(
                System.getProperty("user.home"),
                ".flowsuite",
                "matflow",
                "product-attachments")
                .toAbsolutePath()
                .normalize();
    }

    private void deleteProductAttachmentDirectoryQuietly(UUID productId) {
        if (productId == null) {
            return;
        }

        Path directory;
        try {
            directory = productAttachmentDirectory(productId);
        } catch (RuntimeException ignored) {
            return;
        }

        try {
            if (!Files.isDirectory(directory)) {
                return;
            }

            try (var paths = Files.list(directory)) {
                paths.forEach(path -> {
                    try {
                        Files.deleteIfExists(path);
                    } catch (IOException ignored) {
                        // setup-record deletion must not fail because evidence cleanup failed
                    }
                });
            }
            Files.deleteIfExists(directory);
        } catch (IOException ignored) {
            // best-effort orphan cleanup
        }
    }

    private void deleteDirectoryIfEmpty(Path directory) throws IOException {
        if (directory == null || !Files.isDirectory(directory)) {
            return;
        }

        boolean empty;
        try (var paths = Files.list(directory)) {
            empty = paths.findAny().isEmpty();
        }

        if (empty) {
            Files.deleteIfExists(directory);
        }
    }

    private enum ProductAttachmentKind {
        PRODUCT_IMAGE(
                "Product image",
                "product-image",
                PRODUCT_IMAGE_MAX_BYTES,
                PRODUCT_IMAGE_EXTENSIONS,
                PRODUCT_IMAGE_EXTENSION_SET),
        DRAWING(
                "Product drawing",
                "drawing",
                DRAWING_MAX_BYTES,
                PRODUCT_DRAWING_EXTENSIONS,
                PRODUCT_DRAWING_EXTENSION_SET);

        private final String label;
        private final String baseName;
        private final long maxBytes;
        private final List<String> extensions;
        private final Set<String> extensionSet;

        ProductAttachmentKind(
                String label,
                String baseName,
                long maxBytes,
                List<String> extensions,
                Set<String> extensionSet) {
            this.label = label;
            this.baseName = baseName;
            this.maxBytes = maxBytes;
            this.extensions = extensions;
            this.extensionSet = extensionSet;
        }
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

        return new ProductPortfolioRow(
                product.getId(),
                product.getProductName(),
                product.getDrawingNo(),
                product.getDrawingRevision(),
                product.getRequiredDate(),
                product.isActive(),
                latestBom == null ? null : latestBom.getId(),
                latestBom == null ? null : latestBom.getBomNumber(),
                latestBom == null ? null : latestBom.getRevisionNo(),
                latestBom == null || latestBom.getStatus() == null
                        ? null
                        : latestBom.getStatus().name(),
                latestBom != null && latestBom.isEffective(),
                deriveProductPortfolioStage(product, latestBom),
                product.getRowVersion(),
                product.getCreatedAt(),
                product.getUpdatedAt());
    }

    private String deriveProductPortfolioStage(
            MatFlowProjectDrawing product,
            MatFlowBom latestBom) {

        if (product == null || !product.isActive())
            return "INACTIVE";

        if (latestBom == null)
            return "ENGINEERING / BOM";
        if (!latestBom.isEffective())
            return "BOM REVIEW";
        return "READY FOR EXECUTION";
    }

    private String derivePortfolioStage(List<ProductPortfolioRow> products) {
        if (products == null || products.isEmpty())
            return "PROJECT SETUP";

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
        project.setProjectCode(requiredUpper(request.projectCode(), "PD No."));
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
        required(request.projectCode(), "PD No.");
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