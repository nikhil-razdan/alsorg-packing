package com.alsorg.packing.service.matflow;

import static com.alsorg.packing.controller.dto.matflow.MatFlowProjectDtos.*;

import com.alsorg.packing.domain.matflow.MatFlowControlTypes.EngineeringDecision;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.ProductionFileStage;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.ReleaseHealth;
import com.alsorg.packing.domain.matflow.MatFlowDesignTask;
import com.alsorg.packing.domain.matflow.MatFlowProductionFile;
import com.alsorg.packing.domain.matflow.MatFlowProject;
import com.alsorg.packing.domain.matflow.MatFlowProjectDrawing;
import com.alsorg.packing.repository.matflow.MatFlowDesignTaskRepository;
import com.alsorg.packing.repository.matflow.MatFlowProductionFileRepository;
import com.alsorg.packing.repository.matflow.MatFlowProjectDrawingRepository;
import com.alsorg.packing.repository.matflow.MatFlowProjectRepository;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
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

/**
 * Canonical MatFlow master service.
 *
 * IMPORTANT BUSINESS MODEL:
 *   Project / PD = one Production File / one departmental handoff unit.
 *   Products     = children inside that Project; they never create Production Files.
 *   PD No.       = optional business reference and may be assigned later.
 */
@Service
public class MatFlowProjectService {
    private static final long IMAGE_MAX_BYTES = 8L * 1024L * 1024L;
    private static final String MIGRATION_ACTOR = "SYSTEM_MATFLOW_PROJECT_FILE_MIGRATION";

    private final MatFlowProjectRepository projectRepository;
    private final MatFlowProjectDrawingRepository productRepository;
    private final MatFlowProductionFileRepository productionFileRepository;
    private final MatFlowDesignTaskRepository designTaskRepository;
    private final MatFlowDesignProjectService designProjectService;
    private final MatFlowAccessService accessService;
    private final MatFlowAuditService auditService;
    private final MatFlowWorkflowTemplateService templateService;
    private final Path imageRoot;

    public MatFlowProjectService(
            MatFlowProjectRepository projectRepository,
            MatFlowProjectDrawingRepository productRepository,
            MatFlowProductionFileRepository productionFileRepository,
            MatFlowDesignTaskRepository designTaskRepository,
            MatFlowDesignProjectService designProjectService,
            MatFlowAccessService accessService,
            MatFlowAuditService auditService,
            MatFlowWorkflowTemplateService templateService,
            @Value("${matflow.product-image-dir:}") String configuredImageDir) {
        this.projectRepository = projectRepository;
        this.productRepository = productRepository;
        this.productionFileRepository = productionFileRepository;
        this.designTaskRepository = designTaskRepository;
        this.designProjectService = designProjectService;
        this.accessService = accessService;
        this.auditService = auditService;
        this.templateService = templateService;
        this.imageRoot = resolveRoot(configuredImageDir);
        try { Files.createDirectories(imageRoot); }
        catch (IOException ex) { throw new IllegalStateException("Unable to initialize MatFlow product-image directory", ex); }
    }

    /**
     * Cut-over bridge for databases that previously created one Production File
     * per Product. A new canonical Project-level Production File is created once;
     * old Product-level files are kept as historical rows but removed from the
     * active workflow queue. Legacy source/audit rows are never rewritten; the
     * separate control-BOM compatibility copy may be re-homed to the canonical file.
     */
    @Order(100)
    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void reconcileCanonicalProjectProductionFilesOnStartup() {
        for (MatFlowProject project : projectRepository.findAllByOrderByUpdatedAtDesc()) {
            /* Remove the old UI placeholder if it was ever persisted as real data. */
            if ("DIRECTOR REFERENCE".equalsIgnoreCase(clean(project.getProjectManager()))) {
                project.setProjectManager(null);
                project.setUpdatedBy(MIGRATION_ACTOR);
                projectRepository.save(project);
            }
            MatFlowProductionFile file = ensureCanonicalProductionFile(project, MIGRATION_ACTOR);
            prepareCanonicalWorkflowAfterCutover(project, file, MIGRATION_ACTOR);
            retireLegacyProductFiles(project, MIGRATION_ACTOR);
        }
    }

    @Transactional
    public List<ProjectResponse> list(String search, Boolean active, String plantCode) {
        accessService.requireRead();
        String plant = upperOrNull(plantCode);
        if (plant != null) accessService.requirePlantAccess(plant);
        String q = clean(search);
        q = q == null ? "" : q.toLowerCase(Locale.ROOT);
        final String term = q;
        String actor = accessService.actor();
        boolean junior = accessService.isJuniorDesignerOnly();

        /*
         * Projects used to issue several repository calls per Project and another
         * canonical-file lookup per Product. Preload both child collections once for
         * this request so the Projects screen remains O(1) repository round-trips.
         */
        Map<UUID, List<MatFlowProjectDrawing>> productsByProject = new LinkedHashMap<>();
        for (MatFlowProjectDrawing product : productRepository.findAll()) {
            if (product.getProject() == null || product.getProject().getId() == null) continue;
            productsByProject.computeIfAbsent(product.getProject().getId(), ignored -> new ArrayList<>()).add(product);
        }
        for (List<MatFlowProjectDrawing> products : productsByProject.values()) {
            products.sort(Comparator.comparing(MatFlowProjectDrawing::getCreatedAt,
                    Comparator.nullsLast(Comparator.naturalOrder())));
        }

        Map<UUID, MatFlowProductionFile> canonicalByProject = new LinkedHashMap<>();
        for (MatFlowProductionFile file : productionFileRepository.findAll()) {
            if (file.getProject() == null || file.getProject().getId() == null || file.getProduct() != null) continue;
            UUID projectId = file.getProject().getId();
            MatFlowProductionFile existing = canonicalByProject.get(projectId);
            if (existing == null
                    || (file.getCreatedAt() != null
                        && (existing.getCreatedAt() == null || file.getCreatedAt().isBefore(existing.getCreatedAt())))) {
                canonicalByProject.put(projectId, file);
            }
        }

        List<ProjectResponse> result = new ArrayList<>();
        for (MatFlowProject project : projectRepository.findAllByOrderByUpdatedAtDesc()) {
            if (!accessService.canAccessPlant(project.getPlantCode())) continue;
            if (plant != null && !plant.equalsIgnoreCase(project.getPlantCode())) continue;
            if (active != null && project.isActive() != active) continue;
            if (junior && !juniorDesignerCanAccessProject(project.getId())) continue;

            List<MatFlowProjectDrawing> products = productsByProject.getOrDefault(project.getId(), List.of());
            if (!term.isBlank()
                    && !contains(project.getProjectCode(), term)
                    && !contains(project.getProjectName(), term)
                    && !contains(project.getClientName(), term)
                    && products.stream().noneMatch(product ->
                            contains(product.getProductName(), term)
                                    || contains(product.getDrawingNo(), term)
                                    || contains(product.getProductType(), term))) {
                continue;
            }

            MatFlowProductionFile file = canonicalByProject.get(project.getId());
            if (file == null) {
                file = ensureCanonicalProductionFile(project, actor);
                canonicalByProject.put(project.getId(), file);
            }
            result.add(toProject(project, products, file, junior));
        }
        return result;
    }

    @Transactional
    public ProjectResponse get(UUID projectId) {
        accessService.requireRead();
        MatFlowProject project = requireProject(projectId);
        accessService.requirePlantAccess(project.getPlantCode());
        ensureCanonicalProductionFile(project, accessService.actor());
        if (accessService.isJuniorDesignerOnly() && !juniorDesignerCanAccessProject(projectId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "This PD / Project is not assigned to your Junior Designer task queue");
        }
        return toProject(project);
    }

    @Transactional
    public ProjectResponse create(ProjectRequest request) {
        accessService.requireProjectCreate();
        validateProjectRequest(request);
        String plant = upperOrNull(request.plantCode());
        accessService.requirePlantAccess(plant);
        String pdNo = upperOrNull(request.projectCode());
        requirePdNoAvailable(plant, pdNo, null);

        String actor = accessService.actor();
        boolean juniorDesigner = accessService.isJuniorDesignerOnly();
        MatFlowProject row = new MatFlowProject();
        applyProject(row, request);

        /*
         * A Junior Designer can create only for themselves. Never trust designer1
         * supplied by a Junior client; the authenticated username is authoritative.
         */
        if (juniorDesigner) {
            row.setDesigner1(actor);
            row.setDesignHead(null);
            row.setActive(true);
        }

        row.setCreatedBy(actor);
        row.setUpdatedBy(actor);
        row = projectRepository.save(row);

        /*
         * Establish the PD-level Design owner at creation. This makes a Junior's
         * self-created PD immediately visible in My Assigned PDs and lets a Design
         * Head create the same record already assigned to the requested Junior.
         */
        String initialDesignAssignee = accessService.hasAnyRole(
                "ADMIN", "MATFLOW_MANAGER", "MATFLOW_DESIGN_HEAD", "MATFLOW_DESIGNER", "MATFLOW_DESIGNER_JUNIOR")
                ? row.getDesigner1()
                : null;
        designProjectService.initializeNewProject(row, initialDesignAssignee);
        MatFlowProductionFile file = ensureCanonicalProductionFile(row, actor);
        auditService.log("PROJECT", row.getId(), "PROJECT_CREATED", file,
                auditService.details("projectCode", row.getProjectCode(), "plantCode", row.getPlantCode(),
                        "productionFileNo", file.getProductionFileNo(), "scope", "WHOLE_PD_PROJECT",
                        "assignedDesigner", row.getDesigner1(), "createdByJunior", juniorDesigner));
        return toProject(row);
    }

    @Transactional
    public ProjectResponse update(UUID projectId, ProjectRequest request) {
        accessService.requireProjectEdit();
        validateProjectRequest(request);
        MatFlowProject row = requireProject(projectId);
        accessService.requirePlantAccess(row.getPlantCode());
        requireVersion(row.getRowVersion(), request.rowVersion());

        String actor = accessService.actor();
        boolean juniorDesigner = accessService.isJuniorDesignerOnly();
        String preservedDesignHead = row.getDesignHead();
        boolean preservedActive = row.isActive();

        if (juniorDesigner) {
            if (!designProjectService.isAssignedTo(projectId, actor)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "You can edit only the Project / PD assigned to your Junior Designer account");
            }
            MatFlowProductionFile currentFile = ensureCanonicalProductionFile(row, actor);
            if (!Set.of(ProductionFileStage.DESIGN_DRAFT, ProductionFileStage.DESIGN_CLARIFICATION).contains(currentFile.getStage())) {
                throw conflict("A Junior Designer can edit the Project / PD only while it is inside Design");
            }
        }

        String plant = upperOrNull(request.plantCode());
        accessService.requirePlantAccess(plant);
        String pdNo = upperOrNull(request.projectCode());
        requirePdNoAvailable(plant, pdNo, row.getId());

        applyProject(row, request);
        if (juniorDesigner) {
            /* Ownership and Design Head control cannot be reassigned by a Junior edit. */
            row.setDesigner1(actor);
            row.setDesignHead(preservedDesignHead);
            row.setActive(preservedActive);
        }
        row.setUpdatedBy(actor);
        row = projectRepository.save(row);

        /* Keep legacy Product snapshot columns aligned with the parent Project. */
        for (MatFlowProjectDrawing product : productsOf(row.getId())) {
            product.setProject(row);
            product.setUpdatedBy(actor);
            productRepository.save(product);
        }

        MatFlowProductionFile file = ensureCanonicalProductionFile(row, actor);
        synchronizeCanonicalProductionFile(file, row, actor);
        productionFileRepository.save(file);
        auditService.log("PROJECT", row.getId(), "PROJECT_UPDATED", file,
                auditService.details("projectCode", row.getProjectCode(), "scope", "WHOLE_PD_PROJECT"));
        return toProject(row);
    }

    @Transactional
    public ProjectResponse deactivateProject(UUID projectId, Long rowVersion) {
        accessService.requireProjectWrite();
        MatFlowProject project = requireProject(projectId);
        accessService.requirePlantAccess(project.getPlantCode());
        requireVersion(project.getRowVersion(), rowVersion);
        project.setActive(false);
        project.setUpdatedBy(accessService.actor());
        projectRepository.save(project);

        for (MatFlowProjectDrawing product : productsOf(projectId)) {
            product.setActive(false);
            product.setUpdatedBy(accessService.actor());
            productRepository.save(product);
        }
        MatFlowProductionFile file = ensureCanonicalProductionFile(project, accessService.actor());
        file.setActive(false);
        file.setUpdatedBy(accessService.actor());
        productionFileRepository.save(file);
        auditService.log("PROJECT", project.getId(), "PROJECT_DEACTIVATED", file,
                auditService.details("projectCode", project.getProjectCode()));
        return toProject(project);
    }

    @Transactional
    public ProjectResponse addProduct(UUID projectId, ProductRequest request) {
        return addProducts(projectId, new ProductBulkCreateRequest(List.of(request)));
    }

    @Transactional
    public ProjectResponse addProducts(UUID projectId, ProductBulkCreateRequest request) {
        MatFlowProject project = requireProject(projectId);
        requireProductMutationAccess(project);
        MatFlowProductionFile file = ensureCanonicalProductionFile(project, accessService.actor());
        if (request == null || request.products() == null || request.products().isEmpty()) {
            throw badRequest("Add at least one Product");
        }

        for (ProductRequest item : request.products()) {
            validateProductRequest(item);
            String drawingNo = upperOrNull(item.drawingNo());
            if (drawingNo != null && productRepository.existsByProject_IdAndDrawingNoIgnoreCase(projectId, drawingNo)) {
                throw conflict("Drawing No. already exists in this Project: " + drawingNo);
            }
        }

        for (ProductRequest item : request.products()) {
            MatFlowProjectDrawing product = new MatFlowProjectDrawing();
            product.setProject(project);
            applyProduct(product, item);
            product.setCreatedBy(accessService.actor());
            product.setUpdatedBy(accessService.actor());
            product = productRepository.save(product);
            auditService.log("PRODUCT", product.getId(), "PRODUCT_CREATED", file,
                    auditService.details("productName", product.getProductName(), "drawingNo", product.getDrawingNo(),
                            "projectId", project.getId(), "productionFileScope", "SHARED_PROJECT"));
        }
        return toProject(project);
    }

    @Transactional
    public ProjectResponse updateProduct(UUID projectId, UUID productId, ProductRequest request) {
        validateProductRequest(request);
        MatFlowProject project = requireProject(projectId);
        requireProductMutationAccess(project);
        MatFlowProjectDrawing product = requireProduct(projectId, productId);
        requireVersion(product.getRowVersion(), request.rowVersion());

        String drawingNo = upperOrNull(request.drawingNo());
        if (drawingNo != null && productRepository.existsByProject_IdAndDrawingNoIgnoreCaseAndIdNot(projectId, drawingNo, productId)) {
            throw conflict("Drawing No. already exists in this Project: " + drawingNo);
        }
        String previousDrawing = product.getDrawingNo();
        applyProduct(product, request);
        product.setProject(project);
        product.setUpdatedBy(accessService.actor());
        productRepository.save(product);

        MatFlowProductionFile file = ensureCanonicalProductionFile(project, accessService.actor());
        auditService.log("PRODUCT", product.getId(), "PRODUCT_UPDATED", file,
                auditService.details("previousDrawingNo", previousDrawing, "drawingNo", product.getDrawingNo(),
                        "productionFileScope", "SHARED_PROJECT"));
        return toProject(project);
    }

    @Transactional
    public ProjectResponse deactivateProduct(UUID projectId, UUID productId, Long rowVersion) {
        accessService.requireProjectWrite();
        MatFlowProject project = requireProject(projectId);
        accessService.requirePlantAccess(project.getPlantCode());
        MatFlowProjectDrawing product = requireProduct(projectId, productId);
        requireVersion(product.getRowVersion(), rowVersion);
        product.setActive(false);
        product.setUpdatedBy(accessService.actor());
        productRepository.save(product);
        MatFlowProductionFile file = ensureCanonicalProductionFile(project, accessService.actor());
        auditService.log("PRODUCT", product.getId(), "PRODUCT_DEACTIVATED", file,
                auditService.details("productName", product.getProductName(), "drawingNo", product.getDrawingNo()));
        return toProject(project);
    }

    @Transactional
    public ProductResponse uploadProductImage(UUID projectId, UUID productId, MultipartFile upload) {
        MatFlowProject project = requireProject(projectId);
        requireProductMutationAccess(project);
        MatFlowProjectDrawing product = requireProduct(projectId, productId);
        if (upload == null || upload.isEmpty()) throw badRequest("Product image is required");
        if (upload.getSize() > IMAGE_MAX_BYTES) throw badRequest("Product image cannot exceed 8 MB");
        String contentType = clean(upload.getContentType());
        if (contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            throw badRequest("Only image files are allowed");
        }
        String ext = safeExtension(upload.getOriginalFilename());
        Path folder = imageRoot.resolve(projectId.toString()).normalize();
        Path target = folder.resolve(productId + (ext.isBlank() ? ".img" : "." + ext)).normalize();
        if (!target.startsWith(imageRoot)) throw badRequest("Invalid image path");
        try {
            Files.createDirectories(folder);
            Files.copy(upload.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to save Product image");
        }
        product.setProductImageFileName(safeFileName(upload.getOriginalFilename(), "product-image"));
        product.setProductImageContentType(contentType);
        product.setProductImageStoragePath(target.toString());
        product.setUpdatedBy(accessService.actor());
        productRepository.save(product);
        return toProduct(product);
    }

    @Transactional(readOnly = true)
    public Resource loadProductImage(UUID projectId, UUID productId) {
        MatFlowProject project = requireProject(projectId);
        accessService.requirePlantAccess(project.getPlantCode());
        MatFlowProjectDrawing product = requireProduct(projectId, productId);
        String path = clean(product.getProductImageStoragePath());
        if (path == null) throw notFound("Product image not found");
        Path target = Path.of(path).toAbsolutePath().normalize();
        if (!target.startsWith(imageRoot) || !Files.exists(target)) throw notFound("Product image not found");
        return new FileSystemResource(target);
    }

    @Transactional(readOnly = true)
    public String productImageFileName(UUID projectId, UUID productId) {
        String value = requireProduct(projectId, productId).getProductImageFileName();
        return value == null ? "product-image" : value;
    }

    @Transactional(readOnly = true)
    public String productImageContentType(UUID projectId, UUID productId) {
        String value = requireProduct(projectId, productId).getProductImageContentType();
        return value == null ? "application/octet-stream" : value;
    }

    @Transactional
    public ProductResponse deleteProductImage(UUID projectId, UUID productId) {
        MatFlowProject project = requireProject(projectId);
        requireProductMutationAccess(project);
        MatFlowProjectDrawing product = requireProduct(projectId, productId);
        String path = clean(product.getProductImageStoragePath());
        if (path != null) {
            try { Files.deleteIfExists(Path.of(path)); } catch (IOException ignored) { /* best effort */ }
        }
        product.setProductImageFileName(null);
        product.setProductImageContentType(null);
        product.setProductImageStoragePath(null);
        product.setUpdatedBy(accessService.actor());
        productRepository.save(product);
        return toProduct(product);
    }

    private MatFlowProductionFile ensureCanonicalProductionFile(MatFlowProject project, String actor) {
        if (project == null || project.getId() == null) throw new IllegalArgumentException("Saved Project is required");
        MatFlowProductionFile existing = productionFileRepository
                .findFirstByProject_IdAndProductIsNullOrderByCreatedAtAsc(project.getId())
                .orElse(null);
        String effectiveActor = clean(actor) == null ? MIGRATION_ACTOR : actor.trim();
        if (existing == null) {
            MatFlowProductionFile file = new MatFlowProductionFile();
            file.setProductionFileNo(nextInternalProductionFileNo(project));
            file.setProject(project);
            file.setProduct(null);
            synchronizeCanonicalProductionFile(file, project, effectiveActor);
            MatFlowProductionFile legacySource = conservativeLegacyWorkflowSource(project.getId());
            if (legacySource == null) {
                file.setStage(ProductionFileStage.DESIGN_DRAFT);
                file.setReleaseHealth(ReleaseHealth.RED);
                file.setEngineeringDecision(EngineeringDecision.PENDING);
                file.setDesignHeadDecision("PENDING");
                file.setCurrentDepartment("DESIGN");
                file.setCurrentOwner(clean(project.getDesigner1()) != null ? project.getDesigner1() : project.getDesignHead());
            } else {
                copyLegacyWorkflowState(file, legacySource);
            }
            file.setCreatedBy(effectiveActor);
            file.setUpdatedBy(effectiveActor);
            file = productionFileRepository.save(file);
            auditService.logAsActor(effectiveActor, "PRODUCTION_FILE", file.getId(), "PROJECT_PRODUCTION_FILE_CREATED", file,
                    auditService.details("projectId", project.getId(), "scope", "WHOLE_PD_PROJECT",
                            "officialPdNo", project.getProjectCode(), "technicalFileNo", file.getProductionFileNo(),
                            "migratedStage", file.getStage() == null ? null : file.getStage().name()));
            return file;
        }

        boolean changed = synchronizeCanonicalProductionFile(existing, project, effectiveActor);
        if (changed) productionFileRepository.save(existing);
        return existing;
    }

    private boolean synchronizeCanonicalProductionFile(MatFlowProductionFile file, MatFlowProject project, String actor) {
        boolean changed = false;
        String previousDesigner = clean(file.getDesigner());
        String previousDesignHead = clean(file.getDesignHead());
        if (!Objects.equals(file.getProject(), project)) { file.setProject(project); changed = true; }
        if (file.getProduct() != null) { file.setProduct(null); changed = true; }
        if (!Objects.equals(clean(file.getProjectCode()), clean(project.getProjectCode()))) { file.setProjectCode(project.getProjectCode()); changed = true; }
        if (!Objects.equals(clean(file.getProjectName()), clean(project.getProjectName()))) { file.setProjectName(project.getProjectName()); changed = true; }
        if (!Objects.equals(clean(file.getClientName()), clean(project.getClientName()))) { file.setClientName(project.getClientName()); changed = true; }
        /* productName is a compatibility display snapshot only; canonical identity is the Project. */
        if (!Objects.equals(clean(file.getProductName()), clean(project.getProjectName()))) { file.setProductName(project.getProjectName()); changed = true; }
        if (file.getDrawingNo() != null) { file.setDrawingNo(null); changed = true; }
        if (!Objects.equals(upperOrNull(file.getPlantCode()), upperOrNull(project.getPlantCode()))) { file.setPlantCode(project.getPlantCode()); changed = true; }
        if (!Objects.equals(previousDesigner, clean(project.getDesigner1()))) { file.setDesigner(project.getDesigner1()); changed = true; }
        if (!Objects.equals(previousDesignHead, clean(project.getDesignHead()))) { file.setDesignHead(project.getDesignHead()); changed = true; }
        if (file.getStage() == null) { file.setStage(ProductionFileStage.DESIGN_DRAFT); changed = true; }
        if (file.getReleaseHealth() == null) { file.setReleaseHealth(ReleaseHealth.RED); changed = true; }
        if (file.getEngineeringDecision() == null) { file.setEngineeringDecision(EngineeringDecision.PENDING); changed = true; }
        if (clean(file.getCurrentDepartment()) == null) { file.setCurrentDepartment("DESIGN"); changed = true; }
        if (Set.of(ProductionFileStage.DESIGN_DRAFT, ProductionFileStage.DESIGN_CLARIFICATION).contains(file.getStage())) {
            String owner = clean(project.getDesigner1()) != null ? project.getDesigner1() : project.getDesignHead();
            if (!Objects.equals(clean(file.getCurrentOwner()), clean(owner))) { file.setCurrentOwner(owner); changed = true; }
            boolean designIdentityChanged = !Objects.equals(previousDesigner, clean(project.getDesigner1()))
                    || !Objects.equals(previousDesignHead, clean(project.getDesignHead()));
            if (designIdentityChanged || clean(file.getDesignHeadDecision()) == null) {
                file.setDesignHeadDecision("PENDING");
                file.setDesignHeadReviewedBy(null);
                file.setDesignHeadReviewedAt(null);
                file.setDesignHeadRemarks(null);
                changed = true;
            }
        }
        if (file.isActive() != project.isActive()) { file.setActive(project.isActive()); changed = true; }
        if (file.getPlannedDispatchDate() == null && project.getRequiredDate() != null) {
            file.setPlannedDispatchDate(project.getRequiredDate());
            changed = true;
        }
        if (changed) file.setUpdatedBy(actor);
        return changed;
    }

    /**
     * Rebuild only the minimum shared workflow controls required by the canonical
     * Project-level Production File. Legacy Product-level rows remain historical;
     * they are never treated as parallel active handoff units after cut-over.
     *
     * Design-stage Projects use the new PD-level Design workspace. Engineering-stage
     * Projects receive fresh shared Engineering templates so a migrated Project can
     * never bypass the Project-level review merely because its old checklist/tasks
     * lived on separate Product files.
     */
    private void prepareCanonicalWorkflowAfterCutover(
            MatFlowProject project,
            MatFlowProductionFile file,
            String actor) {
        if (project == null || file == null || file.getStage() == null) return;
        ProductionFileStage stage = file.getStage();
        if (Set.of(ProductionFileStage.DESIGN_DRAFT, ProductionFileStage.DESIGN_CLARIFICATION).contains(stage)) {
            designProjectService.initializeNewProject(project);
            return;
        }
        if (Set.of(
                ProductionFileStage.ENGINEERING_REVIEW,
                ProductionFileStage.ENGINEERING_QUERY,
                ProductionFileStage.ENGINEERING_WORK,
                ProductionFileStage.REVISION_REVIEW,
                ProductionFileStage.PPC_GATE_2).contains(stage)) {
            templateService.seedEngineeringChecklist(file, actor);
        }
        if (Set.of(
                ProductionFileStage.ENGINEERING_WORK,
                ProductionFileStage.REVISION_REVIEW,
                ProductionFileStage.PPC_GATE_2).contains(stage)) {
            templateService.seedEngineeringTasks(file, actor);
        }
    }

    /**
     * When cutting over an existing database, preserve the most conservative
     * whole-Project position represented by the old Product-level files. If old
     * Products disagree, the earliest stage wins so the Project can never skip a
     * gate that one of its Products had not yet passed. Historical rows remain
     * untouched and are retired only after the canonical state is created.
     */
    private MatFlowProductionFile conservativeLegacyWorkflowSource(UUID projectId) {
        return productionFileRepository.findByProject_IdOrderByCreatedAtAsc(projectId).stream()
                .filter(file -> file.getProduct() != null)
                .min(java.util.Comparator
                        .comparingInt((MatFlowProductionFile file) -> productionStageRank(file.getStage()))
                        .thenComparing(MatFlowProductionFile::getUpdatedAt, java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder())))
                .orElse(null);
    }

    private int productionStageRank(ProductionFileStage stage) {
        if (stage == null) return 0;
        return switch (stage.name()) {
            case "DESIGN_DRAFT", "DESIGN_CLARIFICATION" -> 0;
            case "DESIGN_SUBMITTED", "PPC_GATE_1" -> 1;
            case "ENGINEERING_REVIEW", "ENGINEERING_QUERY" -> 2;
            case "ENGINEERING_WORK", "REVISION_REVIEW" -> 3;
            case "PPC_GATE_2" -> 4;
            case "PRODUCTION_RELEASED" -> 5;
            default -> 0;
        };
    }

    private void copyLegacyWorkflowState(MatFlowProductionFile target, MatFlowProductionFile source) {
        target.setStage(source.getStage());
        target.setReleaseHealth(source.getReleaseHealth());
        target.setEngineeringDecision(source.getEngineeringDecision());
        target.setCurrentDepartment(source.getCurrentDepartment());
        target.setCurrentOwner(source.getCurrentOwner());
        target.setDesigner(clean(target.getProject().getDesigner1()) != null ? target.getProject().getDesigner1() : source.getDesigner());
        target.setDesignHead(clean(target.getProject().getDesignHead()) != null ? target.getProject().getDesignHead() : source.getDesignHead());
        target.setDesignHeadDecision(source.getDesignHeadDecision());
        target.setDesignHeadReviewedBy(source.getDesignHeadReviewedBy());
        target.setDesignHeadReviewedAt(source.getDesignHeadReviewedAt());
        target.setDesignHeadRemarks(source.getDesignHeadRemarks());
        target.setDesignSubmittedBy(source.getDesignSubmittedBy());
        target.setDesignSubmittedAt(source.getDesignSubmittedAt());
        target.setPpcOwner(source.getPpcOwner());
        target.setEngineeringHead(source.getEngineeringHead());
        target.setAssignedEngineer(source.getAssignedEngineer());
        target.setControlledReleaseReason(source.getControlledReleaseReason());
        target.setPlannedProductionReleaseDate(source.getPlannedProductionReleaseDate());
        target.setPlannedDispatchDate(source.getPlannedDispatchDate());
        target.setPpcGate1Decision(source.getPpcGate1Decision());
        target.setPpcGate1By(source.getPpcGate1By());
        target.setPpcGate1At(source.getPpcGate1At());
        target.setPpcGate1Remarks(source.getPpcGate1Remarks());
        target.setEngineeringDecisionBy(source.getEngineeringDecisionBy());
        target.setEngineeringDecisionAt(source.getEngineeringDecisionAt());
        target.setEngineeringDecisionRemarks(source.getEngineeringDecisionRemarks());
        target.setPpcGate2Decision(source.getPpcGate2Decision());
        target.setPpcGate2By(source.getPpcGate2By());
        target.setPpcGate2At(source.getPpcGate2At());
        target.setPpcGate2Remarks(source.getPpcGate2Remarks());
        target.setRevisionReviewRequired(source.isRevisionReviewRequired());
        target.setDownstreamWorkflowKey(source.getDownstreamWorkflowKey());
        target.setDownstreamWorkflowStatus(source.getDownstreamWorkflowStatus());
        target.setProductionReleasedBy(source.getProductionReleasedBy());
        target.setProductionReleasedAt(source.getProductionReleasedAt());
        target.setRemarks(source.getRemarks());

        /*
         * Open Query / Revision Review rows belonged to one old Product file and
         * cannot truthfully become a whole-Project issue without explicit review.
         * Move those ambiguous cut-over states to the nearest safe Project-level
         * Engineering review point instead of silently losing a blocking condition.
         */
        if (source.getStage() == ProductionFileStage.ENGINEERING_QUERY) {
            target.setStage(ProductionFileStage.ENGINEERING_REVIEW);
            target.setEngineeringDecision(EngineeringDecision.PENDING);
            target.setEngineeringDecisionBy(null);
            target.setEngineeringDecisionAt(null);
            target.setEngineeringDecisionRemarks("Cut-over from a legacy Product-level Engineering Query; Project-level Engineering review is required.");
            target.setCurrentDepartment("ENGINEERING");
            target.setCurrentOwner(clean(target.getAssignedEngineer()) != null ? target.getAssignedEngineer() : target.getEngineeringHead());
        } else if (source.getStage() == ProductionFileStage.REVISION_REVIEW) {
            target.setRevisionReviewRequired(false);
            target.setStage(source.getEngineeringDecision() == EngineeringDecision.APPROVED
                    ? ProductionFileStage.ENGINEERING_WORK
                    : ProductionFileStage.ENGINEERING_REVIEW);
            target.setCurrentDepartment("ENGINEERING");
            target.setCurrentOwner(clean(target.getAssignedEngineer()) != null ? target.getAssignedEngineer() : target.getEngineeringHead());
            target.setRemarks(mergeRemarks(target.getRemarks(),
                    "Cut-over from legacy Product-level Revision Review; Project-level Engineering revalidation is required."));
        }
    }

    private void retireLegacyProductFiles(MatFlowProject project, String actor) {
        for (MatFlowProductionFile legacy : productionFileRepository.findByProject_IdOrderByCreatedAtAsc(project.getId())) {
            if (legacy.getProduct() == null || !legacy.isActive()) continue;
            legacy.setActive(false);
            legacy.setUpdatedBy(actor);
            productionFileRepository.save(legacy);
            auditService.logAsActor(actor, "PRODUCTION_FILE", legacy.getId(), "LEGACY_PRODUCT_FILE_RETIRED", legacy,
                    auditService.details("projectId", project.getId(), "productId", legacy.getProduct().getId(),
                            "reason", "PROJECT_IS_NOW_THE_PRODUCTION_FILE"));
        }
    }

    private String nextInternalProductionFileNo(MatFlowProject project) {
        String base = "PF-" + project.getId().toString().replace("-", "").substring(0, 12).toUpperCase(Locale.ROOT);
        String candidate = base;
        int suffix = 1;
        while (productionFileRepository.findByProductionFileNoIgnoreCase(candidate).isPresent()) {
            candidate = base + "-" + (++suffix);
        }
        return candidate;
    }

    private ProjectResponse toProject(MatFlowProject project) {
        boolean junior = accessService.isJuniorDesignerOnly();
        MatFlowProductionFile file = canonicalFile(project.getId());
        return toProject(project, productsOf(project.getId()), file, junior);
    }

    private ProjectResponse toProject(
            MatFlowProject project,
            List<MatFlowProjectDrawing> projectProducts,
            MatFlowProductionFile file,
            boolean junior) {
        List<ProductResponse> products = projectProducts.stream()
                .map(product -> toProduct(product, file, junior))
                .toList();
        return new ProjectResponse(
                project.getId(), project.getProjectCode(), project.getProjectName(), project.getClientName(), project.getPlantCode(),
                project.getRequiredDate(), project.getPriority(), directorReference(project.getProjectManager()),
                project.getDesigner1(), project.getDesignHead(), project.getRemarks(),
                project.isActive(),
                file == null ? null : file.getId(), file == null ? null : file.getProductionFileNo(),
                file == null ? null : file.getStage().name(), file == null || junior ? null : file.getReleaseHealth().name(),
                products.size(), project.getRowVersion(), project.getCreatedAt(), project.getUpdatedAt(), products);
    }

    private ProductResponse toProduct(MatFlowProjectDrawing product) {
        MatFlowProductionFile file = canonicalFile(product.getProject().getId());
        return toProduct(product, file, accessService.isJuniorDesignerOnly());
    }

    private ProductResponse toProduct(MatFlowProjectDrawing product, MatFlowProductionFile file, boolean junior) {
        return new ProductResponse(
                product.getId(), product.getProject().getId(), product.getProductName(), product.getProductType(),
                product.getDrawingNo(), product.getDrawingRevision(), product.getUnitQuantity() == null ? 1 : product.getUnitQuantity(),
                product.getDimensionLength(), product.getDimensionBreadth(), product.getDimensionHeight(), product.getDimensionUom(),
                dimensions(product), product.getRequiredDate(), product.getRemarks(), product.isActive(),
                clean(product.getProductImageStoragePath()) != null,
                file == null ? null : file.getId(), file == null ? null : file.getProductionFileNo(),
                file == null ? null : file.getStage().name(), file == null || junior ? null : file.getReleaseHealth().name(),
                product.getRowVersion(), product.getCreatedAt(), product.getUpdatedAt());
    }

    private MatFlowProductionFile canonicalFile(UUID projectId) {
        return productionFileRepository.findFirstByProject_IdAndProductIsNullOrderByCreatedAtAsc(projectId).orElse(null);
    }

    private boolean juniorDesignerCanAccessProject(UUID projectId) {
        if (!accessService.isJuniorDesignerOnly()) return true;
        String actor = accessService.actor();
        if (designProjectService.isAssignedTo(projectId, actor)) return true;
        /* Legacy fallback: pre-cut-over Projects may still use delegated Design tasks. */
        MatFlowProductionFile file = canonicalFile(projectId);
        if (file == null) return false;
        List<MatFlowDesignTask> tasks = designTaskRepository.findByProductionFile_IdOrderByReceivedAtAscCreatedAtAsc(file.getId());
        return tasks.stream().anyMatch(task -> task.getAssignees() != null
                && task.getAssignees().stream().anyMatch(name -> name != null && actor.equalsIgnoreCase(name.trim())));
    }

    private void requireProductMutationAccess(MatFlowProject project) {
        accessService.requireProjectProductWrite();
        accessService.requirePlantAccess(project.getPlantCode());
        if (!accessService.isJuniorDesignerOnly()) return;

        if (!designProjectService.isAssignedTo(project.getId(), accessService.actor())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "This PD / Project is not assigned to your Junior Designer account");
        }
        MatFlowProductionFile file = ensureCanonicalProductionFile(project, accessService.actor());
        if (!Set.of(ProductionFileStage.DESIGN_DRAFT, ProductionFileStage.DESIGN_CLARIFICATION).contains(file.getStage())) {
            throw conflict("Products can be changed by the assigned Junior Designer only while the whole Project / PD is inside Design");
        }
    }

    private String mergeRemarks(String existing, String note) {
        String left = clean(existing);
        String right = clean(note);
        if (left == null) return right;
        if (right == null || left.contains(right)) return left;
        return left + "\n" + right;
    }

    private void validateProjectRequest(ProjectRequest request) {
        if (request == null) throw badRequest("Project request is required");
        if (clean(request.projectName()) == null) throw badRequest("Project Name is required");
        if (clean(request.clientName()) == null) throw badRequest("Client Name is required");
        if (upperOrNull(request.plantCode()) == null) throw badRequest("Plant is required");
    }

    private void validateProductRequest(ProductRequest request) {
        if (request == null || clean(request.productName()) == null) throw badRequest("Product Name is required");
        if (request.unitQuantity() != null && request.unitQuantity() < 1) throw badRequest("Product Units must be at least 1");
    }

    private void requirePdNoAvailable(String plant, String pdNo, UUID currentProjectId) {
        if (pdNo == null) return;
        boolean exists = currentProjectId == null
                ? projectRepository.existsByPlantCodeIgnoreCaseAndProjectCodeIgnoreCase(plant, pdNo)
                : projectRepository.existsByPlantCodeIgnoreCaseAndProjectCodeIgnoreCaseAndIdNot(plant, pdNo, currentProjectId);
        if (exists) throw conflict("PD No. / Project Code already exists for this Plant: " + pdNo);
    }

    private void applyProject(MatFlowProject row, ProjectRequest request) {
        row.setProjectCode(request.projectCode());
        row.setProjectName(request.projectName());
        row.setClientName(request.clientName());
        row.setPlantCode(request.plantCode());
        row.setRequiredDate(request.requiredDate());
        row.setPriority(request.priority());
        row.setProjectManager(directorReference(request.projectManager()));
        row.setDesigner1(request.designer1());
        row.setDesignHead(request.designHead());
        row.setRemarks(request.remarks());
        if (request.active() != null) row.setActive(request.active());
    }

    private void applyProduct(MatFlowProjectDrawing row, ProductRequest request) {
        row.setProductName(request.productName());
        row.setProductType(request.productType());
        row.setDrawingNo(request.drawingNo());
        row.setDrawingRevision(request.drawingRevision());
        row.setUnitQuantity(request.unitQuantity());
        row.setDimensionLength(request.dimensionLength());
        row.setDimensionBreadth(request.dimensionBreadth());
        row.setDimensionHeight(request.dimensionHeight());
        row.setRequiredDate(request.requiredDate());
        row.setRemarks(request.remarks());
        if (request.active() != null) row.setActive(request.active());
    }

    private List<MatFlowProjectDrawing> productsOf(UUID projectId) {
        return productRepository.findByProject_IdOrderByCreatedAtAsc(projectId);
    }

    private MatFlowProject requireProject(UUID id) {
        return projectRepository.findById(id).orElseThrow(() -> notFound("Project not found"));
    }

    private MatFlowProjectDrawing requireProduct(UUID projectId, UUID productId) {
        MatFlowProjectDrawing product = productRepository.findById(productId).orElseThrow(() -> notFound("Product not found"));
        if (product.getProject() == null || !projectId.equals(product.getProject().getId())) {
            throw notFound("Product not found in this Project");
        }
        if (accessService.isJuniorDesignerOnly() && !juniorDesignerCanAccessProject(projectId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "This PD / Project is not assigned to your Junior Designer task queue");
        }
        return product;
    }

    private String dimensions(MatFlowProjectDrawing product) {
        if (product.getDimensionLength() == null || product.getDimensionBreadth() == null || product.getDimensionHeight() == null) return null;
        return strip(product.getDimensionLength()) + " x " + strip(product.getDimensionBreadth()) + " x "
                + strip(product.getDimensionHeight()) + " " + product.getDimensionUom();
    }

    private String strip(BigDecimal value) { return value.stripTrailingZeros().toPlainString(); }
    private Path resolveRoot(String configured) {
        String clean = clean(configured);
        Path root = clean == null
                ? Path.of(System.getProperty("java.io.tmpdir"), "alsorg", "matflow", "product-images")
                : Path.of(clean);
        return root.toAbsolutePath().normalize();
    }
    private String safeExtension(String name) {
        String clean = clean(name);
        if (clean == null || !clean.contains(".")) return "";
        String ext = clean.substring(clean.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        return ext.matches("[a-z0-9]{1,8}") ? ext : "";
    }
    private String safeFileName(String value, String fallback) {
        String clean = clean(value);
        if (clean == null) clean = fallback;
        return clean.replaceAll("[\\/\\r\\n\"]", "_");
    }
    private void requireVersion(Long actual, Long supplied) {
        if (supplied == null || !supplied.equals(actual)) throw conflict("Record changed. Refresh and retry.");
    }
    private String directorReference(String value) {
        String next = clean(value);
        return next != null && "DIRECTOR REFERENCE".equalsIgnoreCase(next) ? null : next;
    }

    private String clean(String value) {
        if (value == null) return null;
        String next = value.trim();
        return next.isBlank() ? null : next;
    }
    private String upperOrNull(String value) {
        String next = clean(value);
        return next == null ? null : next.toUpperCase(Locale.ROOT);
    }
    private boolean contains(String value, String q) { return value != null && value.toLowerCase(Locale.ROOT).contains(q); }
    private ResponseStatusException notFound(String message) { return new ResponseStatusException(HttpStatus.NOT_FOUND, message); }
    private ResponseStatusException conflict(String message) { return new ResponseStatusException(HttpStatus.CONFLICT, message); }
    private ResponseStatusException badRequest(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
}
