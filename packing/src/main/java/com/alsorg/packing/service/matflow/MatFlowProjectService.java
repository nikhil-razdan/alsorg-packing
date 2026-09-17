package com.alsorg.packing.service.matflow;

import static com.alsorg.packing.controller.dto.matflow.MatFlowProjectDtos.*;

import com.alsorg.packing.domain.matflow.MatFlowControlTypes.EngineeringDecision;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.ProductionFileStage;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.ReleaseHealth;
import com.alsorg.packing.domain.matflow.MatFlowProductionFile;
import com.alsorg.packing.domain.matflow.MatFlowProject;
import com.alsorg.packing.domain.matflow.MatFlowProjectDrawing;
import com.alsorg.packing.repository.matflow.MatFlowProductionFileRepository;
import com.alsorg.packing.repository.matflow.MatFlowProjectDrawingRepository;
import com.alsorg.packing.repository.matflow.MatFlowProjectRepository;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/** Project/PD and Product/Drawing master. A Production File is created automatically for every Product. */
@Service
public class MatFlowProjectService {
    private static final long IMAGE_MAX_BYTES = 8L * 1024L * 1024L;
    private static final String LEGACY_MIGRATION_ACTOR = "SYSTEM_MATFLOW_MIGRATION";
    private final MatFlowProjectRepository projectRepository;
    private final MatFlowProjectDrawingRepository productRepository;
    private final MatFlowProductionFileRepository productionFileRepository;
    private final MatFlowAccessService accessService;
    private final MatFlowAuditService auditService;
    private final MatFlowWorkflowTemplateService templateService;
    private final Path imageRoot;

    public MatFlowProjectService(
            MatFlowProjectRepository projectRepository,
            MatFlowProjectDrawingRepository productRepository,
            MatFlowProductionFileRepository productionFileRepository,
            MatFlowAccessService accessService,
            MatFlowAuditService auditService,
            MatFlowWorkflowTemplateService templateService,
            @Value("${matflow.product-image-dir:}") String configuredImageDir) {
        this.projectRepository = projectRepository;
        this.productRepository = productRepository;
        this.productionFileRepository = productionFileRepository;
        this.accessService = accessService;
        this.auditService = auditService;
        this.templateService = templateService;
        this.imageRoot = resolveRoot(configuredImageDir);
        try { Files.createDirectories(imageRoot); }
        catch (IOException ex) { throw new IllegalStateException("Unable to initialize MatFlow product-image directory", ex); }
    }

    /**
     * Backfills the new Production File identity for project/product rows created
     * by the previous MatFlow design. This runs once after startup so Dashboard,
     * Production Control and the later Engineering/BOM flow can see legacy data
     * without requiring users to edit or recreate projects.
     */
    @Order(100)
    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void reconcileLegacyProductionFilesOnStartup() {
        reconcileLegacyProductionFilesInternal(LEGACY_MIGRATION_ACTOR, null);
    }

    @Transactional
    public List<ProjectResponse> list(String search, Boolean active, String plantCode) {
        accessService.requireRead();
        String rawSearch = clean(search);
        final String q = rawSearch == null ? "" : rawSearch.toLowerCase(Locale.ROOT);
        String plant = upperOrNull(plantCode);
        if (plant != null) accessService.requirePlantAccess(plant);
        List<MatFlowProject> visibleProjects = projectRepository.findAllByOrderByUpdatedAtDesc().stream()
                .filter(p -> accessService.canAccessPlant(p.getPlantCode()))
                .filter(p -> plant == null || plant.equalsIgnoreCase(p.getPlantCode()))
                .toList();

        String actor = accessService.actor();
        for (MatFlowProject project : visibleProjects) {
            ensureProjectProductionFiles(project, actor);
        }

        return visibleProjects.stream()
                .filter(p -> active == null || p.isActive() == active)
                .filter(p -> q.isBlank() || contains(p.getProjectCode(), q) || contains(p.getProjectName(), q)
                        || contains(p.getClientName(), q) || productsOf(p.getId()).stream().anyMatch(x -> contains(x.getProductName(), q) || contains(x.getDrawingNo(), q)))
                .map(this::toProject).toList();
    }

    @Transactional
    public ProjectResponse get(UUID projectId) {
        accessService.requireRead();
        MatFlowProject project = requireProject(projectId);
        accessService.requirePlantAccess(project.getPlantCode());
        ensureProjectProductionFiles(project, accessService.actor());
        return toProject(project);
    }

    @Transactional
    public ProjectResponse create(ProjectRequest request) {
        accessService.requireProjectWrite();
        String plant = upper(request.plantCode());
        accessService.requirePlantAccess(plant);
        String code = upper(request.projectCode());
        if (projectRepository.existsByPlantCodeIgnoreCaseAndProjectCodeIgnoreCase(plant, code)) {
            throw conflict("PD / Project No. already exists for this plant: " + code);
        }
        MatFlowProject row = new MatFlowProject();
        applyProject(row, request);
        row.setCreatedBy(accessService.actor()); row.setUpdatedBy(accessService.actor());
        row = projectRepository.save(row);
        auditService.log("PROJECT", row.getId(), "PROJECT_CREATED", null,
                auditService.details("projectCode", row.getProjectCode(), "plantCode", row.getPlantCode()));
        return toProject(row);
    }

    @Transactional
    public ProjectResponse update(UUID projectId, ProjectRequest request) {
        accessService.requireProjectWrite();
        MatFlowProject row = requireProject(projectId);
        accessService.requirePlantAccess(row.getPlantCode());
        requireVersion(row.getRowVersion(), request.rowVersion());
        String plant = upper(request.plantCode());
        accessService.requirePlantAccess(plant);
        String code = upper(request.projectCode());
        if (projectRepository.existsByPlantCodeIgnoreCaseAndProjectCodeIgnoreCaseAndIdNot(plant, code, row.getId())) {
            throw conflict("PD / Project No. already exists for this plant: " + code);
        }
        applyProject(row, request); row.setUpdatedBy(accessService.actor());
        projectRepository.save(row);
        List<MatFlowProjectDrawing> projectProducts = productsOf(row.getId());
        for (int index = 0; index < projectProducts.size(); index++) {
            MatFlowProjectDrawing product = projectProducts.get(index);
            product.setProject(row);
            product.setUpdatedBy(accessService.actor());
            productRepository.save(product);

            int ordinal = index + 1;
            MatFlowProductionFile file = productionFileRepository.findByProduct_Id(product.getId()).orElse(null);
            if (file == null) file = createProductionFile(row, product, accessService.actor(), ordinal);
            String previousFileNo = file.getProductionFileNo();
            syncSnapshots(file, row, product);
            syncOrdinalProductionFileNo(file, row, product, ordinal, true);
            file.setUpdatedBy(accessService.actor());
            productionFileRepository.save(file);
            auditFileRenumber(previousFileNo, file, accessService.actor());
        }
        auditService.log("PROJECT", row.getId(), "PROJECT_UPDATED", null, auditService.details("projectCode", row.getProjectCode()));
        return toProject(row);
    }

    @Transactional
    public ProjectResponse deactivateProject(UUID projectId, Long rowVersion) {
        accessService.requireProjectWrite();
        MatFlowProject row = requireProject(projectId); accessService.requirePlantAccess(row.getPlantCode()); requireVersion(row.getRowVersion(), rowVersion);
        row.setActive(false); row.setUpdatedBy(accessService.actor()); projectRepository.save(row);
        for (MatFlowProjectDrawing product : productsOf(row.getId())) { product.setActive(false); product.setUpdatedBy(accessService.actor()); productRepository.save(product); }
        auditService.log("PROJECT", row.getId(), "PROJECT_DEACTIVATED", null, auditService.details("projectCode", row.getProjectCode()));
        return toProject(row);
    }

    @Transactional
    public ProjectResponse addProduct(UUID projectId, ProductRequest request) {
        return addProducts(projectId, new ProductBulkCreateRequest(List.of(request)));
    }

    @Transactional
    public ProjectResponse addProducts(UUID projectId, ProductBulkCreateRequest request) {
        accessService.requireProjectWrite();
        MatFlowProject project = requireProject(projectId); accessService.requirePlantAccess(project.getPlantCode());
        for (ProductRequest item : request.products()) {
            String drawingNo = upper(item.drawingNo());
            if (productRepository.existsByProject_IdAndDrawingNoIgnoreCase(projectId, drawingNo)) {
                throw conflict("Drawing No. already exists in this project: " + drawingNo);
            }
        }
        int nextOrdinal = productsOf(projectId).size();
        for (ProductRequest item : request.products()) {
            MatFlowProjectDrawing product = new MatFlowProjectDrawing();
            product.setProject(project); applyProduct(product, item);
            product.setCreatedBy(accessService.actor()); product.setUpdatedBy(accessService.actor());
            product = productRepository.save(product);

            nextOrdinal++;
            MatFlowProductionFile file = createProductionFile(project, product, accessService.actor(), nextOrdinal);
            auditService.log("PRODUCTION_FILE", file.getId(), "PRODUCTION_FILE_CREATED", file,
                    auditService.details(
                            "source", "PRODUCT_CREATED",
                            "productOrdinal", nextOrdinal,
                            "productionFileNo", file.getProductionFileNo()));
        }
        return toProject(project);
    }

    @Transactional
    public ProjectResponse updateProduct(UUID projectId, UUID productId, ProductRequest request) {
        accessService.requireProjectWrite();
        MatFlowProject project = requireProject(projectId); accessService.requirePlantAccess(project.getPlantCode());
        MatFlowProjectDrawing product = requireProduct(projectId, productId); requireVersion(product.getRowVersion(), request.rowVersion());
        String drawingNo = upper(request.drawingNo());
        if (productRepository.existsByProject_IdAndDrawingNoIgnoreCaseAndIdNot(projectId, drawingNo, productId)) {
            throw conflict("Drawing No. already exists in this project: " + drawingNo);
        }
        String previousDrawing = product.getDrawingNo();
        applyProduct(product, request); product.setProject(project); product.setUpdatedBy(accessService.actor()); productRepository.save(product);
        MatFlowProductionFile file = productionFileRepository.findByProduct_Id(productId).orElseGet(() -> createProductionFile(project, product));
        syncSnapshots(file, project, product); file.setUpdatedBy(accessService.actor()); productionFileRepository.save(file);
        auditService.log("PRODUCT", product.getId(), "PRODUCT_UPDATED", file,
                auditService.details("previousDrawingNo", previousDrawing, "drawingNo", product.getDrawingNo()));
        return toProject(project);
    }

    @Transactional
    public ProjectResponse deactivateProduct(UUID projectId, UUID productId, Long rowVersion) {
        accessService.requireProjectWrite();
        MatFlowProject project = requireProject(projectId); accessService.requirePlantAccess(project.getPlantCode());
        MatFlowProjectDrawing product = requireProduct(projectId, productId); requireVersion(product.getRowVersion(), rowVersion);
        product.setActive(false); product.setUpdatedBy(accessService.actor()); productRepository.save(product);
        productionFileRepository.findByProduct_Id(productId).ifPresent(file -> { file.setActive(false); file.setUpdatedBy(accessService.actor()); productionFileRepository.save(file); });
        return toProject(project);
    }

    @Transactional
    public ProductResponse uploadProductImage(UUID projectId, UUID productId, MultipartFile file) {
        accessService.requireProjectWrite();
        MatFlowProject project = requireProject(projectId); accessService.requirePlantAccess(project.getPlantCode());
        MatFlowProjectDrawing product = requireProduct(projectId, productId);
        if (file == null || file.isEmpty()) throw badRequest("Product image is required");
        if (file.getSize() > IMAGE_MAX_BYTES) throw badRequest("Product image cannot exceed 8 MB");
        String contentType = clean(file.getContentType());
        if (contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) throw badRequest("Only image files are allowed");
        String ext = safeExtension(file.getOriginalFilename());
        Path folder = imageRoot.resolve(projectId.toString()).normalize();
        Path target = folder.resolve(productId + (ext.isBlank() ? ".img" : "." + ext)).normalize();
        if (!target.startsWith(imageRoot)) throw badRequest("Invalid image path");
        try { Files.createDirectories(folder); Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING); }
        catch (IOException ex) { throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to save product image"); }
        product.setProductImageFileName(safeFileName(file.getOriginalFilename(), "product-image"));
        product.setProductImageContentType(contentType); product.setProductImageStoragePath(target.toString()); product.setUpdatedBy(accessService.actor()); productRepository.save(product);
        return toProduct(product);
    }

    @Transactional(readOnly = true)
    public Resource loadProductImage(UUID projectId, UUID productId) {
        MatFlowProject project = requireProject(projectId); accessService.requirePlantAccess(project.getPlantCode());
        MatFlowProjectDrawing product = requireProduct(projectId, productId);
        if (clean(product.getProductImageStoragePath()) == null) throw notFound("Product image not found");
        Path path = Path.of(product.getProductImageStoragePath()).normalize();
        if (!Files.exists(path) || !Files.isRegularFile(path)) throw notFound("Product image not found");
        return new FileSystemResource(path);
    }

    @Transactional(readOnly = true)
    public String productImageFileName(UUID projectId, UUID productId) { return requireProduct(projectId, productId).getProductImageFileName(); }
    @Transactional(readOnly = true)
    public String productImageContentType(UUID projectId, UUID productId) { String v=requireProduct(projectId, productId).getProductImageContentType(); return v == null ? "application/octet-stream" : v; }

    @Transactional
    public ProductResponse deleteProductImage(UUID projectId, UUID productId) {
        accessService.requireProjectWrite(); MatFlowProject project=requireProject(projectId); accessService.requirePlantAccess(project.getPlantCode()); MatFlowProjectDrawing product=requireProduct(projectId, productId);
        String path=product.getProductImageStoragePath(); if (path != null) try { Files.deleteIfExists(Path.of(path)); } catch (IOException ignored) {}
        product.setProductImageFileName(null); product.setProductImageContentType(null); product.setProductImageStoragePath(null); product.setUpdatedBy(accessService.actor()); productRepository.save(product); return toProduct(product);
    }

    private MatFlowProductionFile createProductionFile(MatFlowProject project, MatFlowProjectDrawing product) {
        return createProductionFile(project, product, accessService.actor(), productOrdinal(project.getId(), product.getId()));
    }

    private MatFlowProductionFile createProductionFile(MatFlowProject project, MatFlowProjectDrawing product, String actor) {
        return createProductionFile(project, product, actor, productOrdinal(project.getId(), product.getId()));
    }

    private MatFlowProductionFile createProductionFile(
            MatFlowProject project,
            MatFlowProjectDrawing product,
            String actor,
            int ordinal) {
        String effectiveActor = actor == null || actor.isBlank() ? LEGACY_MIGRATION_ACTOR : actor.trim();
        String productionFileNo = buildOrdinalFileNo(project.getProjectCode(), ordinal);
        requireProductionFileNoAvailable(productionFileNo, product.getId(), null);

        MatFlowProductionFile file = new MatFlowProductionFile();
        file.setProductionFileNo(productionFileNo);
        file.setProject(project);
        file.setProduct(product);
        syncSnapshots(file, project, product);
        file.setStage(ProductionFileStage.DESIGN_DRAFT);
        file.setReleaseHealth(ReleaseHealth.RED);
        file.setEngineeringDecision(EngineeringDecision.PENDING);
        file.setCurrentDepartment("DESIGN");
        file.setCurrentOwner(clean(project.getDesignHead()) != null ? project.getDesignHead() : project.getDesigner1());
        file.setActive(project.isActive() && product.isActive());
        file.setPlannedDispatchDate(product.getRequiredDate() != null ? product.getRequiredDate() : project.getRequiredDate());
        file.setCreatedBy(effectiveActor);
        file.setUpdatedBy(effectiveActor);
        file = productionFileRepository.save(file);
        templateService.seedDesignChecklist(file, effectiveActor);
        return file;
    }

    private void syncSnapshots(MatFlowProductionFile file, MatFlowProject project, MatFlowProjectDrawing product) {
        String previousDesigner = file.getDesigner();
        String previousHead = file.getDesignHead();
        file.setProject(project); file.setProduct(product); file.setProjectCode(project.getProjectCode()); file.setProjectName(project.getProjectName());
        file.setClientName(project.getClientName()); file.setProductName(product.getProductName()); file.setDrawingNo(product.getDrawingNo()); file.setPlantCode(project.getPlantCode());
        file.setDesigner(project.getDesigner1());
        file.setDesignHead(project.getDesignHead());
        if (Set.of(ProductionFileStage.DESIGN_DRAFT, ProductionFileStage.DESIGN_CLARIFICATION).contains(file.getStage())) {
            file.setCurrentDepartment("DESIGN");
            file.setCurrentOwner(clean(project.getDesignHead()) != null ? project.getDesignHead() : project.getDesigner1());
            if (!Objects.equals(clean(previousDesigner), clean(project.getDesigner1())) || !Objects.equals(clean(previousHead), clean(project.getDesignHead()))) {
                file.setDesignHeadDecision("PENDING");
                file.setDesignHeadReviewedBy(null);
                file.setDesignHeadReviewedAt(null);
                file.setDesignHeadRemarks(null);
            }
        }
    }

    /**
     * Business identity requested by the physical PD-file practice:
     * first Product in PD-54 => PD-54/01, tenth Product => PD-54/10.
     *
     * The ordinal is based on Product creation order and inactive Products remain
     * in that order, so deactivation never renumbers another Production File.
     */
    private String buildOrdinalFileNo(String projectCode, int ordinal) {
        String projectPart = upper(projectCode);
        if (projectPart.isBlank()) projectPart = "PROJECT";
        projectPart = projectPart.replaceAll("/+$", "");
        int safeOrdinal = Math.max(1, ordinal);
        return projectPart + "/" + String.format(Locale.ROOT, "%02d", safeOrdinal);
    }

    private int productOrdinal(UUID projectId, UUID productId) {
        List<MatFlowProjectDrawing> products = productsOf(projectId);
        for (int index = 0; index < products.size(); index++) {
            if (Objects.equals(productId, products.get(index).getId())) return index + 1;
        }
        throw new IllegalStateException("Unable to resolve Product sequence inside Project " + projectId);
    }

    private void requireProductionFileNoAvailable(String productionFileNo, UUID productId, UUID fileId) {
        productionFileRepository.findByProductionFileNoIgnoreCase(productionFileNo).ifPresent(existing -> {
            boolean sameFile = fileId != null && Objects.equals(fileId, existing.getId());
            boolean sameProduct = productId != null && existing.getProduct() != null
                    && Objects.equals(productId, existing.getProduct().getId());
            if (!sameFile && !sameProduct) {
                throw conflict("Production File No. already exists: " + productionFileNo
                        + ". PD / Project numbers must remain unique across MatFlow when using PD/NN file numbering.");
            }
        });
    }

    /**
     * Reconciles old PF-PD-DRAWING identities to the new PD/NN business identity.
     * strict=true is used for an explicit user edit; migration/list reconciliation
     * is non-strict so an old cross-plant collision can never prevent application
     * startup. The collision can then be corrected by fixing the duplicate PD No.
     */
    private boolean syncOrdinalProductionFileNo(
            MatFlowProductionFile file,
            MatFlowProject project,
            MatFlowProjectDrawing product,
            int ordinal,
            boolean strict) {
        String desired = buildOrdinalFileNo(project.getProjectCode(), ordinal);
        if (Objects.equals(clean(file.getProductionFileNo()), desired)) return false;

        MatFlowProductionFile owner = productionFileRepository.findByProductionFileNoIgnoreCase(desired).orElse(null);
        boolean numberConflict = owner != null && !Objects.equals(owner.getId(), file.getId())
                && (owner.getProduct() == null || !Objects.equals(owner.getProduct().getId(), product.getId()));
        if (numberConflict) {
            if (strict) {
                throw conflict("Production File No. already exists: " + desired
                        + ". Correct the duplicate PD / Project number before saving.");
            }
            return false;
        }

        file.setProductionFileNo(desired);
        return true;
    }

    private void auditFileRenumber(String previousFileNo, MatFlowProductionFile file, String actor) {
        if (Objects.equals(clean(previousFileNo), clean(file.getProductionFileNo()))) return;
        auditService.logAsActor(actor, "PRODUCTION_FILE", file.getId(), "PRODUCTION_FILE_RENUMBERED", file,
                auditService.details(
                        "previousProductionFileNo", previousFileNo,
                        "productionFileNo", file.getProductionFileNo(),
                        "reason", "PD_PRODUCT_SEQUENCE_STANDARD"));
    }

    private int reconcileLegacyProductionFilesInternal(String actor, String plantCode) {
        String plant = upperOrNull(plantCode);
        int created = 0;
        for (MatFlowProject project : projectRepository.findAllByOrderByUpdatedAtDesc()) {
            if (plant != null && !plant.equalsIgnoreCase(project.getPlantCode())) continue;
            created += ensureProjectProductionFiles(project, actor);
        }
        return created;
    }

    /**
     * Idempotent bridge from the previous Project/Product model to the new
     * Production File model. Existing workflow rows are preserved; only missing
     * Production Files/checklist templates are created.
     */
    private int ensureProjectProductionFiles(MatFlowProject project, String actor) {
        if (project == null || project.getId() == null) return 0;
        String effectiveActor = actor == null || actor.isBlank() ? LEGACY_MIGRATION_ACTOR : actor.trim();
        int created = 0;

        List<MatFlowProjectDrawing> projectProducts = productsOf(project.getId());
        for (int index = 0; index < projectProducts.size(); index++) {
            MatFlowProjectDrawing product = projectProducts.get(index);
            int ordinal = index + 1;
            MatFlowProductionFile existing = productionFileRepository.findByProduct_Id(product.getId()).orElse(null);
            if (existing == null) {
                MatFlowProductionFile file = createProductionFile(project, product, effectiveActor, ordinal);
                auditService.logAsActor(effectiveActor, "PRODUCTION_FILE", file.getId(), "LEGACY_PRODUCTION_FILE_BACKFILLED", file,
                        auditService.details(
                                "source", "LEGACY_PROJECT_PRODUCT",
                                "projectId", project.getId(),
                                "productId", product.getId(),
                                "productOrdinal", ordinal,
                                "productionFileNo", file.getProductionFileNo()));
                created++;
                continue;
            }

            String previousFileNo = existing.getProductionFileNo();
            boolean changed = synchronizeExistingProductionFile(existing, project, product, effectiveActor, ordinal);
            templateService.seedDesignChecklist(existing, effectiveActor);
            if (changed) productionFileRepository.save(existing);
            auditFileRenumber(previousFileNo, existing, effectiveActor);
        }
        return created;
    }

    private boolean synchronizeExistingProductionFile(MatFlowProductionFile file, MatFlowProject project,
            MatFlowProjectDrawing product, String actor, int ordinal) {
        boolean changed = false;

        if (!Objects.equals(file.getProject(), project)) { file.setProject(project); changed = true; }
        if (!Objects.equals(file.getProduct(), product)) { file.setProduct(product); changed = true; }
        if (!Objects.equals(clean(file.getProjectCode()), clean(project.getProjectCode()))) { file.setProjectCode(project.getProjectCode()); changed = true; }
        if (!Objects.equals(file.getProjectName(), clean(project.getProjectName()))) { file.setProjectName(project.getProjectName()); changed = true; }
        if (!Objects.equals(file.getClientName(), clean(project.getClientName()))) { file.setClientName(project.getClientName()); changed = true; }
        if (!Objects.equals(file.getProductName(), clean(product.getProductName()))) { file.setProductName(product.getProductName()); changed = true; }
        if (!Objects.equals(file.getDrawingNo(), upper(product.getDrawingNo()))) { file.setDrawingNo(product.getDrawingNo()); changed = true; }
        if (!Objects.equals(file.getPlantCode(), upper(project.getPlantCode()))) { file.setPlantCode(project.getPlantCode()); changed = true; }
        if (!Objects.equals(clean(file.getDesigner()), clean(project.getDesigner1()))) { file.setDesigner(project.getDesigner1()); changed = true; }
        if (!Objects.equals(clean(file.getDesignHead()), clean(project.getDesignHead()))) { file.setDesignHead(project.getDesignHead()); changed = true; }

        if (syncOrdinalProductionFileNo(file, project, product, ordinal, false)) changed = true;
        if (file.getStage() == null) { file.setStage(ProductionFileStage.DESIGN_DRAFT); changed = true; }
        if (file.getReleaseHealth() == null) { file.setReleaseHealth(ReleaseHealth.RED); changed = true; }
        if (file.getEngineeringDecision() == null) { file.setEngineeringDecision(EngineeringDecision.PENDING); changed = true; }
        if (clean(file.getCurrentDepartment()) == null) { file.setCurrentDepartment("DESIGN"); changed = true; }
        if (Set.of(ProductionFileStage.DESIGN_DRAFT, ProductionFileStage.DESIGN_CLARIFICATION).contains(file.getStage())) {
            String expectedOwner = clean(project.getDesignHead()) != null ? project.getDesignHead() : project.getDesigner1();
            if (!Objects.equals(clean(file.getCurrentOwner()), clean(expectedOwner))) { file.setCurrentOwner(expectedOwner); changed = true; }
            if (clean(file.getDesignHeadDecision()) == null) { file.setDesignHeadDecision("PENDING"); changed = true; }
        }

        boolean shouldBeActive = project.isActive() && product.isActive();
        if (file.isActive() != shouldBeActive) { file.setActive(shouldBeActive); changed = true; }

        if (file.getPlannedDispatchDate() == null) {
            java.time.LocalDate planned = product.getRequiredDate() != null ? product.getRequiredDate() : project.getRequiredDate();
            if (planned != null) { file.setPlannedDispatchDate(planned); changed = true; }
        }

        if (changed) file.setUpdatedBy(actor);
        return changed;
    }

    private void applyProject(MatFlowProject row, ProjectRequest request) {
        row.setProjectCode(request.projectCode()); row.setProjectName(request.projectName()); row.setClientName(request.clientName()); row.setPlantCode(request.plantCode());
        row.setRequiredDate(request.requiredDate()); row.setPriority(request.priority()); row.setProjectManager(request.projectManager());
        row.setDesigner1(request.designer1()); row.setDesignHead(request.designHead()); row.setRemarks(request.remarks());
        if (request.active() != null) row.setActive(request.active());
    }

    private void applyProduct(MatFlowProjectDrawing row, ProductRequest request) {
        row.setProductName(request.productName()); row.setProductType(request.productType()); row.setDrawingNo(request.drawingNo()); row.setDrawingRevision(request.drawingRevision());
        row.setUnitQuantity(request.unitQuantity()); row.setDimensionLength(request.dimensionLength()); row.setDimensionBreadth(request.dimensionBreadth()); row.setDimensionHeight(request.dimensionHeight());
        row.setRequiredDate(request.requiredDate()); row.setRemarks(request.remarks()); if (request.active() != null) row.setActive(request.active());
    }

    private ProjectResponse toProject(MatFlowProject project) {
        List<ProductResponse> products = productsOf(project.getId()).stream().map(this::toProduct).toList();
        return new ProjectResponse(project.getId(), project.getProjectCode(), project.getProjectName(), project.getClientName(), project.getPlantCode(), project.getRequiredDate(),
                project.getPriority(), project.getProjectManager(), project.getDesigner1(), project.getDesignHead(), project.getRemarks(), project.isActive(), products.size(), project.getRowVersion(), project.getCreatedAt(), project.getUpdatedAt(), products);
    }

    private ProductResponse toProduct(MatFlowProjectDrawing product) {
        MatFlowProductionFile file = productionFileRepository.findByProduct_Id(product.getId()).orElse(null);
        return new ProductResponse(product.getId(), product.getProject().getId(), product.getProductName(), product.getProductType(), product.getDrawingNo(), product.getDrawingRevision(),
                product.getUnitQuantity() == null ? 1 : product.getUnitQuantity(), product.getDimensionLength(), product.getDimensionBreadth(), product.getDimensionHeight(), product.getDimensionUom(), dimensions(product),
                product.getRequiredDate(), product.getRemarks(), product.isActive(), clean(product.getProductImageStoragePath()) != null,
                file == null ? null : file.getId(), file == null ? null : file.getProductionFileNo(), file == null ? null : file.getStage().name(), file == null ? null : file.getReleaseHealth().name(),
                product.getRowVersion(), product.getCreatedAt(), product.getUpdatedAt());
    }

    private List<MatFlowProjectDrawing> productsOf(UUID projectId) { return productRepository.findByProject_IdOrderByCreatedAtAsc(projectId); }
    private MatFlowProject requireProject(UUID id) { return projectRepository.findById(id).orElseThrow(() -> notFound("Project not found")); }
    private MatFlowProjectDrawing requireProduct(UUID projectId, UUID productId) {
        MatFlowProjectDrawing p = productRepository.findById(productId).orElseThrow(() -> notFound("Product not found"));
        if (p.getProject() == null || !projectId.equals(p.getProject().getId())) throw notFound("Product not found in this project");
        return p;
    }
    private String dimensions(MatFlowProjectDrawing p) {
        if (p.getDimensionLength() == null || p.getDimensionBreadth() == null || p.getDimensionHeight() == null) return null;
        return strip(p.getDimensionLength()) + " x " + strip(p.getDimensionBreadth()) + " x " + strip(p.getDimensionHeight()) + " " + p.getDimensionUom();
    }
    private String strip(BigDecimal value) { return value.stripTrailingZeros().toPlainString(); }
    private Path resolveRoot(String configured) {
        String c=clean(configured); Path root=c==null ? Path.of(System.getProperty("java.io.tmpdir"), "alsorg", "matflow", "product-images") : Path.of(c); return root.toAbsolutePath().normalize();
    }
    private String safeExtension(String name) { String n=clean(name); if (n==null || !n.contains(".")) return ""; String ext=n.substring(n.lastIndexOf('.')+1).toLowerCase(Locale.ROOT); return ext.matches("[a-z0-9]{1,8}") ? ext : ""; }
    private String safeFileName(String value, String fallback) { String c=clean(value); if (c==null) c=fallback; return c.replaceAll("[\\/\r\n\"]", "_"); }
    private void requireVersion(Long actual, Long supplied) { if (supplied == null || !supplied.equals(actual)) throw conflict("Record changed. Refresh and retry."); }
    private String clean(String value) { if (value==null) return null; String v=value.trim(); return v.isBlank()?null:v; }
    private String upper(String value) { String v=clean(value); return v==null?"":v.toUpperCase(Locale.ROOT); }
    private String upperOrNull(String value) { String v=clean(value); return v==null?null:v.toUpperCase(Locale.ROOT); }
    private boolean contains(String value, String q) { return value != null && value.toLowerCase(Locale.ROOT).contains(q); }
    private ResponseStatusException notFound(String m) { return new ResponseStatusException(HttpStatus.NOT_FOUND, m); }
    private ResponseStatusException conflict(String m) { return new ResponseStatusException(HttpStatus.CONFLICT, m); }
    private ResponseStatusException badRequest(String m) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, m); }
}
