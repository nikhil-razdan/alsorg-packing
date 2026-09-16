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
import com.alsorg.packing.repository.matflow.MatFlowBomLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowBomRepository;
import com.alsorg.packing.repository.matflow.MatFlowMaterialRepository;
import com.alsorg.packing.repository.matflow.MatFlowProductionFileRepository;
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
import org.springframework.transaction.annotation.Transactional;
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
    private final MatFlowWorkItemRepository workRepository;
    private final MatFlowAccessService accessService;
    private final MatFlowAuditService auditService;
    private final JdbcTemplate jdbcTemplate;

    public MatFlowBomService(
            MatFlowBomRepository bomRepository,
            MatFlowBomLineRepository lineRepository,
            MatFlowMaterialRepository materialRepository,
            MatFlowProductionFileRepository fileRepository,
            MatFlowWorkItemRepository workRepository,
            MatFlowAccessService accessService,
            MatFlowAuditService auditService,
            JdbcTemplate jdbcTemplate) {
        this.bomRepository = bomRepository;
        this.lineRepository = lineRepository;
        this.materialRepository = materialRepository;
        this.fileRepository = fileRepository;
        this.workRepository = workRepository;
        this.accessService = accessService;
        this.auditService = auditService;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Order(200)
    @EventListener(ApplicationReadyEvent.class)
    @Transactional
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
     * - the original BOM UUID, BOM number, revision, status, line UUIDs and quantities
     *   are retained in the control copy whenever there is no conflicting control BOM;
     * - a migrated Project/Product must already have its Production File before the BOM
     *   is copied, so the existing Project migration remains the source of identity;
     * - rerunning this method is safe.
     */
    @Transactional
    public int reconcileLegacyBoms() {
        if (!legacyTableExists(LEGACY_BOM_TABLE) || !legacyTableExists(LEGACY_BOM_LINE_TABLE)) {
            return 0;
        }

        try {
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
                        b.status,
                        b.latest_revision,
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
                    join mf_production_files pf
                      on pf.product_id = b.project_drawing_id
                    where not exists (
                        select 1
                        from mf_control_boms current_bom
                        where current_bom.id = b.id
                    )
                    and not exists (
                        select 1
                        from mf_control_boms current_bom
                        where current_bom.production_file_id = pf.id
                          and current_bom.revision_no = b.revision_no
                    )
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
                    """);

            if (importedBoms > 0 || importedLines > 0) {
                log.info("MatFlow legacy BOM bridge imported {} BOM(s) and {} BOM line(s)", importedBoms, importedLines);
            }
            return importedBoms;
        } catch (DataAccessException ex) {
            // Legacy compatibility must never make a fresh/current-only installation fail.
            log.warn("MatFlow legacy BOM bridge could not run; current BOM workflow remains available", ex);
            return 0;
        }
    }

    @Transactional
    public List<BomResponse> list(String search, String status, UUID productionFileId) {
        accessService.requireRead();
        reconcileLegacyBoms();
        String q = clean(search);
        q = q == null ? "" : q.toLowerCase(Locale.ROOT);
        final String term = q;
        BomStatus filter = status == null || status.isBlank() ? null : parseStatus(status);
        return bomRepository.findAllByOrderByUpdatedAtDesc().stream()
                .filter(b -> accessService.canAccessPlant(b.getProductionFile().getPlantCode()))
                .filter(b -> productionFileId == null || productionFileId.equals(b.getProductionFile().getId()))
                .filter(b -> filter == null || b.getStatus() == filter)
                .filter(b -> term.isBlank()
                        || contains(b.getBomNumber(), term)
                        || contains(b.getProductionFile().getProjectCode(), term)
                        || contains(b.getProductionFile().getProductName(), term)
                        || contains(b.getProductionFile().getDrawingNo(), term))
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public BomResponse get(UUID id) {
        accessService.requireRead();
        reconcileLegacyBoms();
        MatFlowBom b = requireBom(id);
        return toResponse(b);
    }

    @Transactional
    public BomResponse create(BomCreateRequest request) {
        accessService.requireEngineeringWrite();
        reconcileLegacyBoms();
        MatFlowProductionFile file = requireFile(request.productionFileId());
        if (file.getEngineeringDecision() != EngineeringDecision.APPROVED) {
            throw conflict("Engineering approval is required before BOM creation");
        }
        MatFlowBom latest = bomRepository.findFirstByProductionFile_IdAndLatestRevisionTrue(file.getId()).orElse(null);
        if (latest != null && latest.getStatus() != BomStatus.SUPERSEDED) {
            throw conflict("An active BOM already exists. Open that BOM or create a current revision instead.");
        }
        int revision = nextRevisionNo(file.getId());
        MatFlowBom row = new MatFlowBom();
        row.setProductionFile(file);
        row.setProjectDrawing(file.getProduct());
        row.setRevisionNo(revision);
        row.setBomNumber(buildBomNo(file, revision));
        row.setStatus(BomStatus.DRAFT);
        row.setLatestRevision(true);
        row.setRemarks(request.remarks());
        row.setCreatedBy(accessService.actor());
        row.setUpdatedBy(accessService.actor());
        bomRepository.save(row);
        auditService.log("BOM", row.getId(), "BOM_CREATED", file,
                auditService.details("bomNumber", row.getBomNumber(), "revision", revision));
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
        accessService.requireEngineeringWrite();
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
        workRepository.findByProductionFile_IdAndItemTypeAndItemKeyIgnoreCase(
                bom.getProductionFile().getId(), WorkItemType.ENGINEERING_TASK, "BOM").ifPresent(task -> {
                    task.setStatus(WorkItemStatus.COMPLETE);
                    task.setCompletedBy(accessService.actor());
                    task.setCompletedAt(now());
                    task.setCompletionNote("BOM " + bom.getBomNumber() + " submitted Ready for Release");
                    task.setUpdatedBy(accessService.actor());
                    workRepository.save(task);
                });
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

        source.setLatestRevision(false);
        source.setStatus(BomStatus.SUPERSEDED);
        source.setUpdatedBy(accessService.actor());
        bomRepository.save(source);

        MatFlowBom next = new MatFlowBom();
        next.setProductionFile(source.getProductionFile());
        next.setProjectDrawing(source.getProjectDrawing());
        next.setRevisionNo(nextRevisionNo(source.getProductionFile().getId()));
        next.setBomNumber(buildBomNo(source.getProductionFile(), next.getRevisionNo()));
        next.setStatus(BomStatus.DRAFT);
        next.setLatestRevision(true);
        next.setRemarks(request.remarks());
        next.setCreatedBy(accessService.actor());
        next.setUpdatedBy(accessService.actor());
        bomRepository.save(next);

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
                source.getProductionFile().getId(), WorkItemType.ENGINEERING_TASK, "BOM").ifPresent(task -> {
                    task.setStatus(WorkItemStatus.IN_PROGRESS);
                    task.setCompletedAt(null);
                    task.setCompletedBy(null);
                    task.setUpdatedBy(accessService.actor());
                    workRepository.save(task);
                });
        auditService.log("BOM", next.getId(), "BOM_REVISION_CREATED", source.getProductionFile(),
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
        boolean legacy = isLegacyBom(bom.getId());
        return new BomResponse(
                bom.getId(),
                bom.getBomNumber(),
                f.getId(),
                f.getProductionFileNo(),
                f.getProjectCode(),
                f.getProductName(),
                f.getDrawingNo(),
                bom.getRevisionNo(),
                bom.getStatus().name(),
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

    private int nextRevisionNo(UUID productionFileId) {
        return bomRepository.findByProductionFile_IdOrderByRevisionNoDesc(productionFileId).stream()
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
            MatFlowProductionFile file = bom.getProductionFile();
            return file.getEngineeringDecision() == EngineeringDecision.APPROVED
                    && file.getStage() == ProductionFileStage.ENGINEERING_WORK;
        }
        return Set.of(BomStatus.READY_FOR_RELEASE, BomStatus.RELEASED).contains(bom.getStatus());
    }

    private boolean isLegacyBom(UUID bomId) {
        if (bomId == null || !legacyTableExists(LEGACY_BOM_TABLE)) return false;
        try {
            Boolean exists = jdbcTemplate.queryForObject(
                    "select exists (select 1 from mf_boms where id = ?)",
                    Boolean.class,
                    bomId);
            return Boolean.TRUE.equals(exists);
        } catch (DataAccessException ex) {
            return false;
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

    private String buildBomNo(MatFlowProductionFile f, int revision) {
        return ("BOM-" + f.getProductionFileNo() + "-R" + String.format("%02d", revision))
                .replaceAll("[^A-Z0-9._-]+", "-");
    }

    private BomStatus parseStatus(String value) {
        try {
            return BomStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (Exception ex) {
            throw badRequest("Invalid BOM status: " + value);
        }
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
