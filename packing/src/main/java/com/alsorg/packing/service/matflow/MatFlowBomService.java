package com.alsorg.packing.service.matflow;

import static com.alsorg.packing.controller.dto.matflow.MatFlowBomDtos.*;

import com.alsorg.packing.config.TimeZoneConfig;
import com.alsorg.packing.domain.matflow.MatFlowBom;
import com.alsorg.packing.domain.matflow.MatFlowBomLine;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.BomStatus;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.EngineeringDecision;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.ProductionFileStage;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.WorkItemStatus;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.WorkItemType;
import com.alsorg.packing.domain.matflow.MatFlowMaterial;
import com.alsorg.packing.domain.matflow.MatFlowProductionFile;
import com.alsorg.packing.domain.matflow.MatFlowProjectDrawing;
import com.alsorg.packing.repository.matflow.MatFlowBomLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowBomRepository;
import com.alsorg.packing.repository.matflow.MatFlowMaterialRepository;
import com.alsorg.packing.repository.matflow.MatFlowProductionFileRepository;
import com.alsorg.packing.repository.matflow.MatFlowProjectDrawingRepository;
import com.alsorg.packing.repository.matflow.MatFlowWorkItemRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

/** Engineering BOM/documentation service. Production routing is intentionally absent from V1. */
@Service
public class MatFlowBomService {
    private static final Logger log = LoggerFactory.getLogger(MatFlowBomService.class);
    private static final String LEGACY_BOM_TABLE = "mf_boms";
    private static final String LEGACY_BOM_LINE_TABLE = "mf_bom_lines";

    private final MatFlowBomRepository bomRepository;
    private final MatFlowBomLineRepository lineRepository;
    private final MatFlowMaterialRepository materialRepository;
    private final MatFlowProductionFileRepository fileRepository;
    private final MatFlowProjectDrawingRepository productRepository;
    private final MatFlowWorkItemRepository workRepository;
    private final MatFlowAccessService accessService;
    private final MatFlowAuditService auditService;
    private final JdbcTemplate jdbcTemplate;
    private final TransactionTemplate legacyMigrationTx;

    public MatFlowBomService(
            MatFlowBomRepository bomRepository,
            MatFlowBomLineRepository lineRepository,
            MatFlowMaterialRepository materialRepository,
            MatFlowProductionFileRepository fileRepository,
            MatFlowProjectDrawingRepository productRepository,
            MatFlowWorkItemRepository workRepository,
            MatFlowAccessService accessService,
            MatFlowAuditService auditService,
            JdbcTemplate jdbcTemplate,
            PlatformTransactionManager transactionManager) {
        this.bomRepository = bomRepository;
        this.lineRepository = lineRepository;
        this.materialRepository = materialRepository;
        this.fileRepository = fileRepository;
        this.productRepository = productRepository;
        this.workRepository = workRepository;
        this.accessService = accessService;
        this.auditService = auditService;
        this.jdbcTemplate = jdbcTemplate;
        this.legacyMigrationTx = new TransactionTemplate(transactionManager);
        this.legacyMigrationTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.legacyMigrationTx.setName("matflowLegacyBomMigration");
    }

    @Order(200)
    @EventListener(ApplicationReadyEvent.class)
    public void reconcileLegacyBomsOnStartup() {
        reconcileLegacyBoms();
    }

    /**
     * The previous MatFlow design stored operational BOMs in mf_boms / mf_bom_lines,
     * linked directly to mf_project_drawings. The rebuilt control workflow stores BOMs
     * in mf_control_boms / mf_control_bom_lines and links them through a Production File.
     *
     * This bridge is deliberately idempotent and non-destructive:
     * - the legacy tables are never updated or deleted;
     * - the original BOM UUID, BOM number, revision, line UUIDs and quantities are
     *   retained in the control copy whenever there is no conflicting control BOM;
     * - the historical status stays authoritative in mf_boms and is surfaced in API
     *   responses without violating the new mf_control_boms status constraint;
     * - the migrated Project / PD must already have its canonical Production File before a Product BOM
     *   is copied, so the Project migration remains the source of workflow identity;
     * - rerunning this method is safe.
     */
    /**
     * Runs the compatibility import in an isolated transaction. PostgreSQL marks a
     * transaction unusable after any SQL error, so the bridge must never execute in
     * the caller's read transaction. If a legacy database is incomplete/corrupt, the
     * migration rolls back independently and the current MatFlow BOM API can still
     * continue.
     */
    public int reconcileLegacyBoms() {
        try {
            Integer imported = legacyMigrationTx.execute(status -> doReconcileLegacyBoms());
            return imported == null ? 0 : imported;
        } catch (DataAccessException ex) {
            log.warn("MatFlow legacy BOM bridge could not run; current BOM workflow remains available", ex);
            return 0;
        }
    }

    private int doReconcileLegacyBoms() {
        if (!legacyTableExists(LEGACY_BOM_TABLE) || !legacyTableExists(LEGACY_BOM_LINE_TABLE)) {
            return 0;
        }

        /*
         * Project/PD is now the canonical Production File. Older control copies may
         * still point at the historical Product-level Production File that was used
         * before this model changed. Re-home only the control-copy FK; the original
         * legacy mf_boms row and the historical Product-level Production File stay
         * untouched for audit/history. This runs after ProjectService creates the
         * canonical product_id IS NULL file (startup order 100 -> BOM order 200).
         */
        int rehomedBoms = jdbcTemplate.update("""
                update mf_control_boms current_bom
                   set production_file_id = canonical.id,
                       updated_at = coalesce(current_bom.updated_at, current_timestamp)
                  from mf_production_files legacy_file
                  join mf_production_files canonical
                    on canonical.project_id = legacy_file.project_id
                   and canonical.product_id is null
                 where current_bom.production_file_id = legacy_file.id
                   and legacy_file.product_id is not null
                   and current_bom.project_drawing_id = legacy_file.product_id
                   and not exists (
                       select 1
                         from mf_control_boms duplicate_bom
                        where duplicate_bom.id <> current_bom.id
                          and duplicate_bom.production_file_id = canonical.id
                          and duplicate_bom.project_drawing_id = current_bom.project_drawing_id
                          and duplicate_bom.revision_no = current_bom.revision_no
                   )
                """);

        /*
         * IMPORTANT: mf_control_boms is the NEW workflow table and its database
         * check constraint accepts only the new control vocabulary. Old mf_boms
         * statuses (SUBMITTED / APPROVED / RETURNED / etc.) must therefore never be
         * copied into this column. Historical status is read from mf_boms at response
         * time, while the control copy uses DRAFT (or SUPERSEDED for archived old
         * revisions). This also guarantees that an imported historical APPROVED BOM
         * cannot silently satisfy the new PPC Gate 2; Engineering must create a current
         * revision first.
         */
        int importedBoms = jdbcTemplate.update("""
                insert into mf_control_boms (
                    id,
                    bom_number,
                    production_file_id,
                    project_drawing_id,
                    revision_no,
                    status,
                    latest_revision,
                    remarks,
                    submitted_by,
                    submitted_at,
                    released_by,
                    released_at,
                    row_version,
                    created_at,
                    created_by,
                    updated_at,
                    updated_by
                )
                select
                    b.id,
                    b.bom_number,
                    pf.id,
                    b.project_drawing_id,
                    b.revision_no,
                    case
                        when upper(coalesce(b.status::text, '')) = 'SUPERSEDED' then 'SUPERSEDED'
                        else 'DRAFT'
                    end,
                    coalesce(b.latest_revision, true),
                    b.remarks,
                    b.submitted_by,
                    b.submitted_at,
                    null,
                    null,
                    coalesce(b.row_version, 0),
                    b.created_at,
                    coalesce(nullif(b.created_by, ''), 'SYSTEM_MATFLOW_BOM_MIGRATION'),
                    b.updated_at,
                    coalesce(nullif(b.updated_by, ''), 'SYSTEM_MATFLOW_BOM_MIGRATION')
                from mf_boms b
                join mf_project_drawings product
                  on product.id = b.project_drawing_id
                join mf_production_files pf
                  on pf.project_id = product.project_id
                 and pf.product_id is null
                where not exists (
                    select 1
                    from mf_control_boms current_bom
                    where current_bom.id = b.id
                )
                and not exists (
                    select 1
                    from mf_control_boms current_bom
                    where current_bom.production_file_id = pf.id
                      and current_bom.project_drawing_id = b.project_drawing_id
                      and current_bom.revision_no = b.revision_no
                )
                on conflict do nothing
                """);

        int importedLines = jdbcTemplate.update("""
                insert into mf_control_bom_lines (
                    id,
                    bom_id,
                    material_id,
                    line_no,
                    material_code_snapshot,
                    material_name_snapshot,
                    material_category_snapshot,
                    specification_snapshot,
                    uom_snapshot,
                    required_qty,
                    wastage_percent,
                    net_required_qty,
                    remarks,
                    row_version,
                    created_at,
                    created_by,
                    updated_at,
                    updated_by
                )
                select
                    legacy_line.id,
                    legacy_line.bom_id,
                    legacy_line.material_id,
                    legacy_line.line_no,
                    legacy_line.material_code_snapshot,
                    legacy_line.material_name_snapshot,
                    legacy_line.material_category_snapshot,
                    legacy_line.specification_snapshot,
                    legacy_line.uom_snapshot,
                    legacy_line.required_qty,
                    coalesce(legacy_line.wastage_percent, 0),
                    legacy_line.net_required_qty,
                    legacy_line.remarks,
                    coalesce(legacy_line.row_version, 0),
                    legacy_line.created_at,
                    coalesce(nullif(legacy_line.created_by, ''), 'SYSTEM_MATFLOW_BOM_MIGRATION'),
                    legacy_line.updated_at,
                    coalesce(nullif(legacy_line.updated_by, ''), 'SYSTEM_MATFLOW_BOM_MIGRATION')
                from mf_bom_lines legacy_line
                join mf_control_boms current_bom
                  on current_bom.id = legacy_line.bom_id
                where exists (
                    select 1
                    from mf_boms legacy_bom
                    where legacy_bom.id = legacy_line.bom_id
                )
                and not exists (
                    select 1
                    from mf_control_bom_lines current_line
                    where current_line.id = legacy_line.id
                )
                and not exists (
                    select 1
                    from mf_control_bom_lines current_line
                    where current_line.bom_id = legacy_line.bom_id
                      and current_line.line_no = legacy_line.line_no
                )
                on conflict do nothing
                """);

        if (rehomedBoms > 0 || importedBoms > 0 || importedLines > 0) {
            log.info("MatFlow legacy BOM bridge re-homed {} control BOM(s), imported {} BOM(s) and {} BOM line(s)",
                    rehomedBoms, importedBoms, importedLines);
        }
        return rehomedBoms + importedBoms;
    }

    @Transactional(readOnly = true)
    public List<BomResponse> list(String search, String status, UUID productionFileId) {
        accessService.requireEngineeringRead();
        String q = clean(search);
        q = q == null ? "" : q.toLowerCase(Locale.ROOT);
        final String term = q;
        String requestedStatus = clean(status);
        final String statusFilter = requestedStatus == null ? "" : requestedStatus.toUpperCase(Locale.ROOT);
        return bomRepository.findAllByOrderByUpdatedAtDesc().stream()
                // Live Engineering/BOM views expose only the canonical Project-level
                // Production File. Historical Product-level files remain readable by
                // direct audit references but must never re-enter the active queue.
                .filter(b -> b.getProductionFile() != null && b.getProductionFile().getProduct() == null)
                .filter(b -> accessService.canAccessPlant(b.getProductionFile().getPlantCode()))
                .filter(b -> productionFileId == null || productionFileId.equals(b.getProductionFile().getId()))
                .filter(b -> term.isBlank()
                        || contains(b.getBomNumber(), term)
                        || contains(b.getProductionFile().getProjectCode(), term)
                        || contains(b.getProductionFile().getProjectName(), term)
                        || contains(b.getProductionFile().getProductionFileNo(), term)
                        || (b.getProjectDrawing() != null && contains(b.getProjectDrawing().getProductName(), term))
                        || (b.getProjectDrawing() != null && contains(b.getProjectDrawing().getDrawingNo(), term)))
                .map(this::toResponse)
                .filter(response -> statusFilter.isBlank() || statusFilter.equalsIgnoreCase(response.status()))
                .toList();
    }

    @Transactional(readOnly = true)
    public BomResponse get(UUID id) {
        accessService.requireEngineeringRead();
        MatFlowBom b = requireBom(id);
        return toResponse(b);
    }

    @Transactional
    public BomResponse create(BomCreateRequest request) {
        accessService.requireEngineeringWrite();
        if (request == null || request.productionFileId() == null) throw badRequest("Production File is required");
        if (request.productId() == null) throw badRequest("Product is required for a BOM");

        MatFlowProductionFile file = requireFile(request.productionFileId());
        if (file.getProduct() != null) {
            throw conflict("New BOMs must use the Project-level Production File, not a legacy Product-level file");
        }
        if (file.getEngineeringDecision() != EngineeringDecision.APPROVED) {
            throw conflict("Engineering approval is required before BOM creation");
        }
        MatFlowProjectDrawing product = requireProjectProduct(file, request.productId());

        MatFlowBom latest = bomRepository
                .findFirstByProductionFile_IdAndProjectDrawing_IdAndLatestRevisionTrue(file.getId(), product.getId())
                .orElse(null);
        if (latest != null && latest.getStatus() != BomStatus.SUPERSEDED) {
            throw conflict("This Product already has an active BOM. Open that BOM or create a current revision instead.");
        }

        int revision = nextRevisionNo(file.getId(), product.getId());
        MatFlowBom row = new MatFlowBom();
        row.setProductionFile(file);
        row.setProjectDrawing(product);
        row.setRevisionNo(revision);
        row.setBomNumber(buildBomNo(file, product, revision));
        row.setStatus(BomStatus.DRAFT);
        row.setLatestRevision(true);
        row.setRemarks(request.remarks());
        row.setCreatedBy(accessService.actor());
        row.setUpdatedBy(accessService.actor());
        row = bomRepository.save(row);
        auditService.log("BOM", row.getId(), "BOM_CREATED", file,
                auditService.details("bomNumber", row.getBomNumber(), "revision", revision,
                        "productId", product.getId(), "productName", product.getProductName(),
                        "scope", "PRODUCT_INSIDE_PROJECT_PRODUCTION_FILE"));
        return toResponse(row);
    }

    @Transactional
    public BomResponse update(UUID id, BomUpdateRequest request) {
        accessService.requireEngineeringWrite();
        MatFlowBom row = requireBom(id);
        requireEditable(row);
        requireVersion(row.getRowVersion(), request.rowVersion());
        row.setRemarks(request.remarks());
        row.setUpdatedBy(accessService.actor());
        bomRepository.save(row);
        return toResponse(row);
    }

    @Transactional
    public BomResponse addLine(UUID bomId, BomLineRequest request) {
        accessService.requireEngineeringWrite();
        MatFlowBom bom = requireBom(bomId);
        requireEditable(bom);
        MatFlowBomLine line = new MatFlowBomLine();
        line.setBom(bom);
        applyLine(line, request);
        line.setLineNo(nextLineNo(bomId));
        line.setCreatedBy(accessService.actor());
        line.setUpdatedBy(accessService.actor());
        lineRepository.save(line);
        auditService.log("BOM", bom.getId(), "BOM_LINE_ADDED", bom.getProductionFile(),
                auditService.details("materialCode", line.getMaterialCodeSnapshot(), "qty", line.getNetRequiredQty()));
        return toResponse(bom);
    }

    @Transactional
    public BomResponse updateLine(UUID bomId, UUID lineId, BomLineRequest request) {
        accessService.requireEngineeringWrite();
        MatFlowBom bom = requireBom(bomId);
        requireEditable(bom);
        MatFlowBomLine line = requireLine(bomId, lineId);
        requireVersion(line.getRowVersion(), request.rowVersion());
        applyLine(line, request);
        line.setUpdatedBy(accessService.actor());
        lineRepository.save(line);
        return toResponse(bom);
    }

    @Transactional
    public BomResponse deleteLine(UUID bomId, UUID lineId, Long rowVersion) {
        accessService.requireEngineeringWrite();
        MatFlowBom bom = requireBom(bomId);
        requireEditable(bom);
        MatFlowBomLine line = requireLine(bomId, lineId);
        requireVersion(line.getRowVersion(), rowVersion);
        lineRepository.delete(line);
        renumber(bomId);
        return toResponse(bom);
    }

    @Transactional
    public void deleteDraft(UUID id, Long rowVersion) {
        /* Physical BOM deletion is ADMIN-only. Engineering can revise/edit but cannot hard-delete. */
        if (!accessService.hasAnyRole("ADMIN")) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Only ADMIN can permanently delete a BOM");
        }
        MatFlowBom bom = requireBom(id);
        requireVersion(bom.getRowVersion(), rowVersion);
        requireEditable(bom);
        lineRepository.deleteByBom_Id(id);
        bomRepository.delete(bom);
    }

    @Transactional
    public BomResponse submit(UUID id, BomActionRequest request) {
        accessService.requireEngineeringWrite();
        MatFlowBom bom = requireBom(id);
        requireVersion(bom.getRowVersion(), request.rowVersion());
        requireEditable(bom);
        if (lineRepository.countByBom_Id(id) == 0) throw conflict("Add at least one BOM line before submission");
        bom.setStatus(BomStatus.READY_FOR_RELEASE);
        bom.setSubmittedBy(accessService.actor());
        bom.setSubmittedAt(now());
        if (request.remarks() != null) bom.setRemarks(request.remarks());
        bom.setUpdatedBy(accessService.actor());
        bomRepository.save(bom);
        refreshProjectBomTask(bom.getProductionFile(),
                "BOM " + bom.getBomNumber() + " submitted Ready for Release");
        auditService.log("BOM", bom.getId(), "BOM_READY_FOR_RELEASE", bom.getProductionFile(),
                auditService.details("bomNumber", bom.getBomNumber(), "revision", bom.getRevisionNo()));
        return toResponse(bom);
    }

    @Transactional
    public BomResponse createRevision(UUID id, BomActionRequest request) {
        accessService.requireEngineeringWrite();
        MatFlowBom source = requireBom(id);
        requireVersion(source.getRowVersion(), request.rowVersion());
        if (!canCreateRevision(source)) {
            if (isLegacyBom(source.getId())) {
                throw conflict("Historical BOM is read-only until this Production File reaches Engineering Work with Engineering approval.");
            }
            throw conflict("A revision can only be created from the current Ready for Release / Released BOM.");
        }

        MatFlowProductionFile workflowFile = workflowFileForBom(source);

        source.setLatestRevision(false);
        source.setStatus(BomStatus.SUPERSEDED);
        source.setUpdatedBy(accessService.actor());
        bomRepository.save(source);

        MatFlowBom next = new MatFlowBom();
        next.setProductionFile(workflowFile);
        next.setProjectDrawing(source.getProjectDrawing());
        next.setRevisionNo(nextRevisionNo(workflowFile.getId(), source.getProjectDrawing().getId()));
        next.setBomNumber(buildBomNo(workflowFile, source.getProjectDrawing(), next.getRevisionNo()));
        next.setStatus(BomStatus.DRAFT);
        next.setLatestRevision(true);
        next.setRemarks(request.remarks());
        next.setCreatedBy(accessService.actor());
        next.setUpdatedBy(accessService.actor());
        next = bomRepository.save(next);

        int no = 0;
        for (MatFlowBomLine old : lineRepository.findByBom_IdOrderByLineNoAsc(source.getId())) {
            MatFlowBomLine copy = new MatFlowBomLine();
            copy.setBom(next);
            copy.setLineNo(++no);
            copy.setMaterial(old.getMaterial());
            copy.setMaterialCodeSnapshot(old.getMaterialCodeSnapshot());
            copy.setMaterialNameSnapshot(old.getMaterialNameSnapshot());
            copy.setMaterialCategorySnapshot(old.getMaterialCategorySnapshot());
            copy.setSpecificationSnapshot(old.getSpecificationSnapshot());
            copy.setUomSnapshot(old.getUomSnapshot());
            copy.setRequiredQty(old.getRequiredQty());
            copy.setWastagePercent(old.getWastagePercent());
            copy.setNetRequiredQty(old.getNetRequiredQty());
            copy.setRemarks(old.getRemarks());
            copy.setCreatedBy(accessService.actor());
            copy.setUpdatedBy(accessService.actor());
            lineRepository.save(copy);
        }

        workRepository.findByProductionFile_IdAndItemTypeAndItemKeyIgnoreCase(
                workflowFile.getId(), WorkItemType.ENGINEERING_TASK, "BOM").ifPresent(task -> {
                    task.setStatus(WorkItemStatus.IN_PROGRESS);
                    task.setCompletedAt(null);
                    task.setCompletedBy(null);
                    task.setUpdatedBy(accessService.actor());
                    workRepository.save(task);
                });
        auditService.log("BOM", next.getId(), "BOM_REVISION_CREATED", workflowFile,
                auditService.details("fromRevision", source.getRevisionNo(), "toRevision", next.getRevisionNo(),
                        "sourceLegacy", isLegacyBom(source.getId())));
        return toResponse(next);
    }

    private void applyLine(MatFlowBomLine line, BomLineRequest request) {
        MatFlowMaterial material = request.materialId() == null ? null
                : materialRepository.findById(request.materialId()).orElseThrow(() -> notFound("Material not found"));
        line.setMaterial(material);
        line.setMaterialCodeSnapshot(request.materialCode());
        line.setMaterialNameSnapshot(request.materialName());
        line.setMaterialCategorySnapshot(request.category());
        line.setSpecificationSnapshot(request.specification());
        line.setUomSnapshot(request.uom());
        line.setRequiredQty(request.requiredQty());
        BigDecimal wastage = request.wastagePercent() == null ? BigDecimal.ZERO : request.wastagePercent();
        line.setWastagePercent(wastage);
        BigDecimal multiplier = BigDecimal.ONE.add(wastage.divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP));
        line.setNetRequiredQty(request.requiredQty().multiply(multiplier).setScale(3, RoundingMode.HALF_UP));
        line.setRemarks(request.remarks());
    }

    private BomResponse toResponse(MatFlowBom bom) {
        List<BomLineResponse> lines = lineRepository.findByBom_IdOrderByLineNoAsc(bom.getId()).stream()
                .map(this::toLine)
                .toList();
        MatFlowProductionFile f = bom.getProductionFile();
        String historicalStatus = legacyBomStatus(bom.getId());
        boolean legacy = historicalStatus != null;
        String responseStatus = legacy ? historicalStatus : bom.getStatus().name();
        return new BomResponse(
                bom.getId(),
                bom.getBomNumber(),
                f.getId(),
                f.getProductionFileNo(),
                f.getProjectCode(),
                f.getProjectName(),
                bom.getProjectDrawing() == null ? null : bom.getProjectDrawing().getId(),
                bom.getProjectDrawing() == null ? null : bom.getProjectDrawing().getProductName(),
                bom.getProjectDrawing() == null ? null : bom.getProjectDrawing().getDrawingNo(),
                bom.getCreatedBy(),
                bom.getRevisionNo(),
                responseStatus,
                bom.isLatestRevision(),
                bom.getRemarks(),
                bom.getSubmittedBy(),
                bom.getSubmittedAt(),
                bom.getReleasedBy(),
                bom.getReleasedAt(),
                bom.getRowVersion(),
                bom.getUpdatedAt(),
                legacy,
                isEditable(bom, legacy),
                canCreateRevision(bom, legacy),
                lines);
    }

    private BomLineResponse toLine(MatFlowBomLine x) {
        return new BomLineResponse(
                x.getId(),
                x.getLineNo(),
                x.getMaterial() == null ? null : x.getMaterial().getId(),
                x.getMaterialCodeSnapshot(),
                x.getMaterialNameSnapshot(),
                x.getMaterialCategorySnapshot(),
                x.getSpecificationSnapshot(),
                x.getUomSnapshot(),
                x.getRequiredQty(),
                x.getWastagePercent(),
                x.getNetRequiredQty(),
                x.getRemarks(),
                x.getRowVersion());
    }

    private void renumber(UUID bomId) {
        int no = 0;
        for (MatFlowBomLine x : lineRepository.findByBom_IdOrderByLineNoAsc(bomId)) {
            x.setLineNo(++no);
            x.setUpdatedBy(accessService.actor());
            lineRepository.save(x);
        }
    }

    private int nextRevisionNo(UUID productionFileId, UUID productId) {
        return bomRepository.findByProductionFile_IdAndProjectDrawing_IdOrderByRevisionNoDesc(productionFileId, productId).stream()
                .map(MatFlowBom::getRevisionNo)
                .filter(java.util.Objects::nonNull)
                .max(Integer::compareTo)
                .orElse(0) + 1;
    }

    private int nextLineNo(UUID bomId) {
        return lineRepository.findByBom_IdOrderByLineNoAsc(bomId).stream()
                .map(MatFlowBomLine::getLineNo)
                .filter(java.util.Objects::nonNull)
                .max(Integer::compareTo)
                .orElse(0) + 1;
    }

    private MatFlowBom requireBom(UUID id) {
        MatFlowBom b = bomRepository.findById(id).orElseThrow(() -> notFound("BOM not found"));
        accessService.requirePlantAccess(b.getProductionFile().getPlantCode());
        return b;
    }

    private MatFlowProductionFile requireFile(UUID id) {
        MatFlowProductionFile f = fileRepository.findById(id).orElseThrow(() -> notFound("Production File not found"));
        accessService.requirePlantAccess(f.getPlantCode());
        return f;
    }

    private MatFlowProjectDrawing requireProjectProduct(MatFlowProductionFile file, UUID productId) {
        MatFlowProjectDrawing product = productRepository.findById(productId)
                .orElseThrow(() -> notFound("Product not found"));
        if (product.getProject() == null || file.getProject() == null
                || !file.getProject().getId().equals(product.getProject().getId())) {
            throw conflict("Selected Product does not belong to this PD / Project Production File");
        }
        if (!product.isActive()) throw conflict("Selected Product is inactive");
        return product;
    }

    private MatFlowBomLine requireLine(UUID bomId, UUID id) {
        MatFlowBomLine x = lineRepository.findById(id).orElseThrow(() -> notFound("BOM line not found"));
        if (!bomId.equals(x.getBom().getId())) throw notFound("BOM line not found");
        return x;
    }

    private void requireEditable(MatFlowBom b) {
        boolean legacy = isLegacyBom(b.getId());
        if (!isEditable(b, legacy)) {
            if (legacy) {
                throw conflict("Historical BOM is preserved read-only. Complete the current Engineering gate and create a current revision to continue editing.");
            }
            throw conflict("Only the current Draft BOM can be edited");
        }
    }

    private boolean isEditable(MatFlowBom bom, boolean legacy) {
        return !legacy && bom.getStatus() == BomStatus.DRAFT;
    }

    private boolean canCreateRevision(MatFlowBom bom) {
        return canCreateRevision(bom, isLegacyBom(bom.getId()));
    }

    private boolean canCreateRevision(MatFlowBom bom, boolean legacy) {
        if (!bom.isLatestRevision()) return false;
        if (legacy) {
            MatFlowProductionFile file = workflowFileForBom(bom);
            return file != null
                    && file.getEngineeringDecision() == EngineeringDecision.APPROVED
                    && file.getStage() == ProductionFileStage.ENGINEERING_WORK;
        }
        return Set.of(BomStatus.READY_FOR_RELEASE, BomStatus.RELEASED).contains(bom.getStatus());
    }

    private MatFlowProductionFile workflowFileForBom(MatFlowBom bom) {
        if (bom == null) return null;
        MatFlowProjectDrawing product = bom.getProjectDrawing();
        if (product != null && product.getProject() != null) {
            MatFlowProductionFile canonical = fileRepository
                    .findFirstByProject_IdAndProductIsNullOrderByCreatedAtAsc(product.getProject().getId())
                    .orElse(null);
            if (canonical != null) return canonical;
        }
        return bom.getProductionFile();
    }

    private boolean isLegacyBom(UUID bomId) {
        return legacyBomStatus(bomId) != null;
    }

    /**
     * Exact old workflow status is intentionally read from the untouched legacy
     * table. The control copy stores only the new workflow vocabulary so database
     * constraints and PPC release rules remain correct.
     */
    private String legacyBomStatus(UUID bomId) {
        if (bomId == null || !legacyTableExists(LEGACY_BOM_TABLE)) return null;
        try {
            List<String> values = jdbcTemplate.query(
                    "select cast(status as text) from mf_boms where id = ?",
                    (rs, rowNum) -> rs.getString(1),
                    bomId);
            if (values.isEmpty()) return null;
            String value = clean(values.get(0));
            return value == null ? "DRAFT" : value.toUpperCase(Locale.ROOT);
        } catch (DataAccessException ex) {
            log.debug("Unable to read legacy BOM status for {}", bomId, ex);
            return null;
        }
    }

    private boolean legacyTableExists(String tableName) {
        try {
            Boolean exists = jdbcTemplate.queryForObject("""
                    select exists (
                        select 1
                        from information_schema.tables
                        where table_schema = current_schema()
                          and table_name = ?
                    )
                    """, Boolean.class, tableName);
            return Boolean.TRUE.equals(exists);
        } catch (DataAccessException ex) {
            return false;
        }
    }

    private String buildBomNo(MatFlowProductionFile file, MatFlowProjectDrawing product, int revision) {
        String projectRef = clean(file.getProjectCode());
        if (projectRef == null) projectRef = file.getProductionFileNo();
        String productRef = clean(product.getDrawingNo());
        if (productRef == null) productRef = clean(product.getProductName());
        if (productRef == null) productRef = product.getId().toString().substring(0, 8);
        return ("BOM-" + projectRef + "-" + productRef + "-R" + String.format("%02d", revision))
                .toUpperCase(Locale.ROOT)
                .replaceAll("[^A-Z0-9._-]+", "-");
    }

    private void refreshProjectBomTask(MatFlowProductionFile file, String completionNote) {
        if (file == null || file.getProject() == null) return;
        List<MatFlowProjectDrawing> activeProducts = productRepository
                .findByProject_IdOrderByCreatedAtAsc(file.getProject().getId()).stream()
                .filter(MatFlowProjectDrawing::isActive)
                .toList();
        boolean allReady = !activeProducts.isEmpty() && activeProducts.stream().allMatch(product ->
                bomRepository.findFirstByProductionFile_IdAndProjectDrawing_IdAndLatestRevisionTrue(file.getId(), product.getId())
                        .map(current -> current.getStatus() == BomStatus.READY_FOR_RELEASE || current.getStatus() == BomStatus.RELEASED)
                        .orElse(false));

        workRepository.findByProductionFile_IdAndItemTypeAndItemKeyIgnoreCase(
                file.getId(), WorkItemType.ENGINEERING_TASK, "BOM").ifPresent(task -> {
            if (allReady) {
                task.setStatus(WorkItemStatus.COMPLETE);
                task.setCompletedBy(accessService.actor());
                task.setCompletedAt(now());
                task.setCompletionNote(completionNote + "; all active Products have Ready for Release BOMs");
            } else {
                task.setStatus(WorkItemStatus.IN_PROGRESS);
                task.setCompletedBy(null);
                task.setCompletedAt(null);
                task.setCompletionNote(null);
            }
            task.setUpdatedBy(accessService.actor());
            workRepository.save(task);
        });
    }



    private void requireVersion(Long actual, Long supplied) {
        if (supplied == null || !supplied.equals(actual)) throw conflict("Record changed. Refresh and retry.");
    }

    private String clean(String v) {
        if (v == null) return null;
        String x = v.trim();
        return x.isBlank() ? null : x;
    }

    private boolean contains(String v, String q) {
        return v != null && v.toLowerCase(Locale.ROOT).contains(q);
    }

    private LocalDateTime now() {
        return LocalDateTime.now(TimeZoneConfig.APP_ZONE);
    }

    private ResponseStatusException notFound(String m) { return new ResponseStatusException(HttpStatus.NOT_FOUND, m); }
    private ResponseStatusException conflict(String m) { return new ResponseStatusException(HttpStatus.CONFLICT, m); }
    private ResponseStatusException badRequest(String m) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, m); }
}
