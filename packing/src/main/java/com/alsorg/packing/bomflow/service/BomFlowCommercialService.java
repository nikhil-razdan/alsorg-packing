package com.alsorg.packing.bomflow.service;

import com.alsorg.packing.bomflow.dto.BomFlowCommercialDtos.*;
import com.alsorg.packing.bomflow.security.BomFlowAccessService;
import com.alsorg.packing.bomflow.service.BomFlowProductFileStorageService.FileSlot;
import com.alsorg.packing.bomflow.service.BomFlowProductFileStorageService.StoredFile;

import org.springframework.core.io.Resource;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
@Transactional
public class BomFlowCommercialService {

    private static final BigDecimal ZERO = BigDecimal.ZERO;
    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");
    private static final long RATE_EVIDENCE_MAX_BYTES = 15L * 1024L * 1024L;
    private static final Set<String> RATE_EVIDENCE_EXTENSIONS = Set.of(
            "pdf", "png", "jpg", "jpeg", "webp", "xlsx", "xls", "csv");

    public record RateEvidenceDownload(
            String originalFileName,
            String contentType,
            long fileSize,
            Resource resource) {
    }

    private final JdbcTemplate jdbc;
    private final BomFlowAccessService access;
    private final BomFlowProductFileStorageService storage;

    public BomFlowCommercialService(
            JdbcTemplate jdbc,
            BomFlowAccessService access,
            BomFlowProductFileStorageService storage) {
        this.jdbc = jdbc;
        this.access = access;
        this.storage = storage;
    }

    /* =====================================================================
       RATE MASTER
       ===================================================================== */

    @Transactional(readOnly = true)
    public List<MaterialRateResponse> listMaterialRates(
            String search,
            Boolean activeOnly) {

        access.requireBomFlowAccess();

        StringBuilder sql = new StringBuilder("""
                SELECT *
                FROM bom_flow_material_rates
                WHERE 1 = 1
                """);
        List<Object> args = new ArrayList<>();

        if (Boolean.TRUE.equals(activeOnly)) {
            sql.append(" AND active = true ");
        }

        String query = clean(search);
        if (query != null) {
            sql.append("""
                     AND (
                        LOWER(item_name) LIKE ? OR
                        LOWER(category) LIKE ? OR
                        LOWER(COALESCE(brand,'')) LIKE ? OR
                        LOWER(COALESCE(vendor_name,'')) LIKE ? OR
                        LOWER(unit) LIKE ? OR
                        LOWER(rate_type) LIKE ? OR
                        LOWER(COALESCE(source_reference,'')) LIKE ? OR
                        LOWER(COALESCE(evidence_original_name,'')) LIKE ?
                     )
                    """);
            String like = "%" + query.toLowerCase(Locale.ROOT) + "%";
            for (int i = 0; i < 8; i++) args.add(like);
        }

        sql.append(" ORDER BY active DESC, updated_at DESC, item_name ASC ");

        return jdbc.query(
                sql.toString(),
                this::mapMaterialRate,
                args.toArray());
    }

    public MaterialRateResponse createMaterialRate(
            MaterialRateRequest request) {

        access.requireEditor();
        validateMaterialRate(request);

        UUID id = UUID.randomUUID();
        String actor = access.currentUsername();
        LocalDateTime now = LocalDateTime.now();
        LocalDate from = request.effectiveFrom() == null
                ? LocalDate.now()
                : request.effectiveFrom();

        jdbc.update("""
                INSERT INTO bom_flow_material_rates (
                    id, category, item_name, brand, vendor_name, unit, rate_type,
                    rate, gst_percent, effective_from, effective_to,
                    source_reference, notes, active,
                    created_by, created_at, updated_by, updated_at, row_version
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)
                """,
                id,
                required(request.category(), "Category"),
                required(request.itemName(), "Item name"),
                clean(request.brand()),
                clean(request.vendorName()),
                upper(required(request.unit(), "Unit")),
                materialRateType(request.rateType()),
                nonNegative(request.rate(), "Rate"),
                nonNegative(defaultZero(request.gstPercent()), "GST percent"),
                Date.valueOf(from),
                request.effectiveTo() == null ? null : Date.valueOf(request.effectiveTo()),
                clean(request.sourceReference()),
                clean(request.notes()),
                request.active() == null || request.active(),
                actor,
                Timestamp.valueOf(now),
                actor,
                Timestamp.valueOf(now));

        audit(
                "MATERIAL_RATE",
                id,
                null,
                "CREATE",
                null,
                materialRateAuditText(request),
                actor);

        return getMaterialRate(id);
    }

    public MaterialRateResponse updateMaterialRate(
            UUID id,
            MaterialRateRequest request) {

        access.requireEditor();
        requireId(id, "Material rate ID");
        validateMaterialRate(request);
        requireVersion(request.rowVersion(), "Material rate");

        MaterialRateResponse old = getMaterialRate(id);
        String actor = access.currentUsername();
        LocalDateTime now = LocalDateTime.now();
        LocalDate from = request.effectiveFrom() == null
                ? old.effectiveFrom()
                : request.effectiveFrom();

        int changed = jdbc.update("""
                UPDATE bom_flow_material_rates
                SET category = ?, item_name = ?, brand = ?, vendor_name = ?, unit = ?, rate_type = ?,
                    rate = ?, gst_percent = ?, effective_from = ?, effective_to = ?,
                    source_reference = ?, notes = ?, active = ?,
                    updated_by = ?, updated_at = ?, row_version = row_version + 1
                WHERE id = ? AND row_version = ?
                """,
                required(request.category(), "Category"),
                required(request.itemName(), "Item name"),
                clean(request.brand()),
                clean(request.vendorName()),
                upper(required(request.unit(), "Unit")),
                materialRateType(request.rateType()),
                nonNegative(request.rate(), "Rate"),
                nonNegative(defaultZero(request.gstPercent()), "GST percent"),
                Date.valueOf(from == null ? LocalDate.now() : from),
                request.effectiveTo() == null ? null : Date.valueOf(request.effectiveTo()),
                clean(request.sourceReference()),
                clean(request.notes()),
                request.active() == null ? old.active() : request.active(),
                actor,
                Timestamp.valueOf(now),
                id,
                request.rowVersion());

        if (changed == 0) {
            throw conflict("Material rate was changed by another user. Refresh and try again.");
        }

        audit(
                "MATERIAL_RATE",
                id,
                null,
                "UPDATE",
                materialRateAuditText(old),
                materialRateAuditText(request),
                actor);

        return getMaterialRate(id);
    }

    public MaterialRateResponse setMaterialRateActive(
            UUID id,
            boolean active,
            Long rowVersion) {

        access.requireEditor();
        requireId(id, "Material rate ID");
        requireVersion(rowVersion, "Material rate");

        MaterialRateResponse old = getMaterialRate(id);
        String actor = access.currentUsername();

        int changed = jdbc.update("""
                UPDATE bom_flow_material_rates
                SET active = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP,
                    row_version = row_version + 1
                WHERE id = ? AND row_version = ?
                """,
                active,
                actor,
                id,
                rowVersion);

        if (changed == 0) {
            throw conflict("Material rate was changed by another user. Refresh and try again.");
        }

        audit(
                "MATERIAL_RATE",
                id,
                null,
                active ? "ACTIVATE" : "DEACTIVATE",
                "active=" + old.active(),
                "active=" + active,
                actor);

        return getMaterialRate(id);
    }

    public RateApplyResponse applyRatesToRevision(
            UUID revisionId) {

        access.requireEditor();
        requireId(revisionId, "Revision ID");

        RevisionContext context = revisionContext(revisionId);
        String status = upper(context.status());
        if (!("DRAFT".equals(status) || "RETURNED".equals(status))) {
            throw badRequest("Rate Master can only be applied to Draft or Returned revisions.");
        }

        LocalDate today = LocalDate.now();
        List<MaterialRateResponse> rates = jdbc.query("""
                SELECT *
                FROM bom_flow_material_rates
                WHERE active = true
                  AND effective_from <= ?
                  AND (effective_to IS NULL OR effective_to >= ?)
                ORDER BY effective_from DESC, updated_at DESC
                """,
                this::mapMaterialRate,
                Date.valueOf(today),
                Date.valueOf(today));

        List<MaterialBomRow> items = jdbc.query("""
                SELECT id, item_name, category, section_name, brand, vendor_name,
                       unit, required_qty, processing_amount
                FROM bom_flow_items
                WHERE revision_id = ? AND active = true
                ORDER BY line_no
                """,
                (rs, rowNum) -> new MaterialBomRow(
                        uuid(rs, "id"),
                        rs.getString("item_name"),
                        rs.getString("category"),
                        rs.getString("section_name"),
                        rs.getString("brand"),
                        rs.getString("vendor_name"),
                        rs.getString("unit"),
                        decimal(rs, "required_qty"),
                        decimal(rs, "processing_amount")),
                revisionId);

        int matched = 0;
        List<String> unmatched = new ArrayList<>();
        String actor = access.currentUsername();
        LocalDateTime now = LocalDateTime.now();

        for (MaterialBomRow item : items) {
            MaterialRateResponse best = findBestRate(item, rates);

            if (best == null) {
                unmatched.add(item.itemName());
                continue;
            }

            BigDecimal material = money(item.quantity().multiply(best.rate()));
            BigDecimal total = amount4(material.add(defaultZero(item.processingAmount())));

            jdbc.update("""
                    UPDATE bom_flow_items
                    SET unit_rate = ?, material_amount = ?, total_amount = ?, gst_percent = ?,
                        rate_master_id = ?, rate_applied_by = ?, rate_applied_at = ?,
                        updated_by = ?, updated_at = ?, row_version = row_version + 1
                    WHERE id = ?
                    """,
                    best.rate(),
                    material,
                    total,
                    best.gstPercent(),
                    best.id(),
                    actor,
                    Timestamp.valueOf(now),
                    actor,
                    Timestamp.valueOf(now),
                    item.id());

            matched++;
        }

        if (matched > 0) {
            jdbc.update("""
                    UPDATE bom_flow_revisions
                    SET updated_by = ?, updated_at = CURRENT_TIMESTAMP,
                        row_version = row_version + 1
                    WHERE id = ?
                    """,
                    actor,
                    revisionId);
        }

        BigDecimal total = jdbc.queryForObject("""
                SELECT COALESCE(SUM(total_amount),0)
                FROM bom_flow_items
                WHERE revision_id = ? AND active = true
                """,
                BigDecimal.class,
                revisionId);

        audit(
                "REVISION",
                revisionId,
                revisionId,
                "RATE_MASTER_APPLY",
                null,
                "matched=" + matched + ", unmatched=" + unmatched.size(),
                actor);

        return new RateApplyResponse(
                revisionId,
                items.size(),
                matched,
                unmatched.size(),
                unmatched,
                money(total),
                matched == 0
                        ? "No exact material names matched the active Rate Master."
                        : "Rate Master applied to " + matched + " BOM row(s)." );
    }

    public MaterialRateResponse uploadRateEvidence(
            UUID rateId,
            MultipartFile file) {

        access.requireEditor();
        requireId(rateId, "Material rate ID");
        String extension = validateEvidence(file);
        MaterialRateResponse before = getMaterialRate(rateId);
        String oldKey = jdbc.queryForObject(
                "SELECT evidence_storage_key FROM bom_flow_material_rates WHERE id = ?",
                String.class,
                rateId);

        StoredFile stored = storage.store(rateId, FileSlot.RATE_EVIDENCE, file, extension);
        String actor = access.currentUsername();
        LocalDateTime now = LocalDateTime.now();

        try {
            jdbc.update("""
                    UPDATE bom_flow_material_rates
                    SET evidence_original_name = ?, evidence_stored_name = ?,
                        evidence_storage_key = ?, evidence_content_type = ?, evidence_size = ?,
                        evidence_uploaded_by = ?, evidence_uploaded_at = ?,
                        updated_by = ?, updated_at = ?, row_version = row_version + 1
                    WHERE id = ?
                    """,
                    cleanFileName(file.getOriginalFilename()),
                    stored.storedFileName(),
                    stored.storageKey(),
                    clean(file.getContentType()),
                    stored.fileSize(),
                    actor,
                    Timestamp.valueOf(now),
                    actor,
                    Timestamp.valueOf(now),
                    rateId);
        } catch (RuntimeException ex) {
            storage.delete(stored.storageKey());
            throw ex;
        }

        if (hasText(oldKey) && !oldKey.equals(stored.storageKey())) {
            storage.delete(oldKey);
        }

        audit("MATERIAL_RATE", rateId, null, "EVIDENCE_UPLOAD",
                before.evidenceFileName(), cleanFileName(file.getOriginalFilename()), actor);
        return getMaterialRate(rateId);
    }

    @Transactional(readOnly = true)
    public RateEvidenceDownload downloadRateEvidence(UUID rateId) {
        access.requireBomFlowAccess();
        requireId(rateId, "Material rate ID");
        return jdbc.queryForObject("""
                SELECT evidence_original_name, evidence_storage_key,
                       evidence_content_type, evidence_size
                FROM bom_flow_material_rates
                WHERE id = ?
                """,
                (rs, rowNum) -> {
                    String key = rs.getString("evidence_storage_key");
                    if (!hasText(key)) throw notFound("Rate evidence is not available.");
                    return new RateEvidenceDownload(
                            defaultText(rs.getString("evidence_original_name"), "rate-evidence"),
                            rs.getString("evidence_content_type"),
                            Math.max(0L, rs.getLong("evidence_size")),
                            storage.load(key));
                },
                rateId);
    }

    public MaterialRateResponse deleteRateEvidence(UUID rateId) {
        access.requireEditor();
        requireId(rateId, "Material rate ID");
        String oldKey = jdbc.queryForObject(
                "SELECT evidence_storage_key FROM bom_flow_material_rates WHERE id = ?",
                String.class,
                rateId);
        String actor = access.currentUsername();
        jdbc.update("""
                UPDATE bom_flow_material_rates
                SET evidence_original_name = NULL, evidence_stored_name = NULL,
                    evidence_storage_key = NULL, evidence_content_type = NULL, evidence_size = NULL,
                    evidence_uploaded_by = NULL, evidence_uploaded_at = NULL,
                    updated_by = ?, updated_at = CURRENT_TIMESTAMP, row_version = row_version + 1
                WHERE id = ?
                """, actor, rateId);
        storage.delete(oldKey);
        audit("MATERIAL_RATE", rateId, null, "EVIDENCE_DELETE", oldKey, null, actor);
        return getMaterialRate(rateId);
    }

    /* =====================================================================
       LABOUR MASTER
       ===================================================================== */

    @Transactional(readOnly = true)
    public List<LabourRateResponse> listLabourRates(
            String search,
            Boolean activeOnly) {

        access.requireBomFlowAccess();

        StringBuilder sql = new StringBuilder("""
                SELECT * FROM bom_flow_labour_rates WHERE 1 = 1
                """);
        List<Object> args = new ArrayList<>();

        if (Boolean.TRUE.equals(activeOnly)) {
            sql.append(" AND active = true ");
        }

        String query = clean(search);
        if (query != null) {
            sql.append("""
                    AND (
                        LOWER(department) LIKE ? OR
                        LOWER(process_name) LIKE ? OR
                        LOWER(COALESCE(process_code,'')) LIKE ? OR
                        LOWER(basis) LIKE ? OR
                        LOWER(unit) LIKE ?
                    )
                    """);
            String like = "%" + query.toLowerCase(Locale.ROOT) + "%";
            for (int i = 0; i < 5; i++) args.add(like);
        }

        sql.append(" ORDER BY active DESC, department ASC, process_name ASC ");

        return jdbc.query(sql.toString(), this::mapLabourRate, args.toArray());
    }

    public LabourRateResponse createLabourRate(
            LabourRateRequest request) {

        access.requireEditor();
        validateLabourRate(request);

        UUID id = UUID.randomUUID();
        String actor = access.currentUsername();
        LocalDateTime now = LocalDateTime.now();
        LocalDate from = request.effectiveFrom() == null
                ? LocalDate.now()
                : request.effectiveFrom();

        jdbc.update("""
                INSERT INTO bom_flow_labour_rates (
                    id, department, process_code, process_name, basis, unit,
                    rate, default_labour_count, default_working_hours, effective_from, effective_to,
                    notes, active, created_by, created_at, updated_by, updated_at, row_version
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)
                """,
                id,
                required(request.department(), "Department"),
                clean(request.processCode()),
                required(request.processName(), "Process name"),
                labourBasis(request.basis()),
                upper(defaultText(request.unit(), "HOUR")),
                nonNegative(request.rate(), "Labour rate"),
                nonNegative(defaultValue(request.defaultLabourCount(), BigDecimal.ONE), "Default labour count"),
                nonNegative(defaultZero(request.defaultWorkingHours()), "Default working hours"),
                Date.valueOf(from),
                request.effectiveTo() == null ? null : Date.valueOf(request.effectiveTo()),
                clean(request.notes()),
                request.active() == null || request.active(),
                actor,
                Timestamp.valueOf(now),
                actor,
                Timestamp.valueOf(now));

        audit("LABOUR_RATE", id, null, "CREATE", null, labourRateAuditText(request), actor);
        return getLabourRate(id);
    }

    public LabourRateResponse updateLabourRate(
            UUID id,
            LabourRateRequest request) {

        access.requireEditor();
        requireId(id, "Labour rate ID");
        validateLabourRate(request);
        requireVersion(request.rowVersion(), "Labour rate");

        LabourRateResponse old = getLabourRate(id);
        String actor = access.currentUsername();

        int changed = jdbc.update("""
                UPDATE bom_flow_labour_rates
                SET department = ?, process_code = ?, process_name = ?, basis = ?, unit = ?,
                    rate = ?, default_labour_count = ?, default_working_hours = ?, effective_from = ?, effective_to = ?,
                    notes = ?, active = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP,
                    row_version = row_version + 1
                WHERE id = ? AND row_version = ?
                """,
                required(request.department(), "Department"),
                clean(request.processCode()),
                required(request.processName(), "Process name"),
                labourBasis(request.basis()),
                upper(defaultText(request.unit(), "HOUR")),
                nonNegative(request.rate(), "Labour rate"),
                nonNegative(defaultValue(request.defaultLabourCount(), BigDecimal.ONE), "Default labour count"),
                nonNegative(defaultValue(request.defaultWorkingHours(), old.defaultWorkingHours()), "Default working hours"),
                Date.valueOf(request.effectiveFrom() == null
                        ? (old.effectiveFrom() == null ? LocalDate.now() : old.effectiveFrom())
                        : request.effectiveFrom()),
                request.effectiveTo() == null ? null : Date.valueOf(request.effectiveTo()),
                clean(request.notes()),
                request.active() == null ? old.active() : request.active(),
                actor,
                id,
                request.rowVersion());

        if (changed == 0) {
            throw conflict("Labour rate was changed by another user. Refresh and try again.");
        }

        audit("LABOUR_RATE", id, null, "UPDATE", labourRateAuditText(old), labourRateAuditText(request), actor);
        return getLabourRate(id);
    }

    public LabourRateResponse setLabourRateActive(
            UUID id,
            boolean active,
            Long rowVersion) {

        access.requireEditor();
        requireId(id, "Labour rate ID");
        requireVersion(rowVersion, "Labour rate");

        LabourRateResponse old = getLabourRate(id);
        String actor = access.currentUsername();

        int changed = jdbc.update("""
                UPDATE bom_flow_labour_rates
                SET active = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP,
                    row_version = row_version + 1
                WHERE id = ? AND row_version = ?
                """,
                active,
                actor,
                id,
                rowVersion);

        if (changed == 0) {
            throw conflict("Labour rate was changed by another user. Refresh and try again.");
        }

        audit("LABOUR_RATE", id, null, active ? "ACTIVATE" : "DEACTIVATE",
                "active=" + old.active(), "active=" + active, actor);
        return getLabourRate(id);
    }

    /* =====================================================================
       COSTING ENGINE
       ===================================================================== */

    @Transactional(readOnly = true)
    public CostingSummaryResponse getCosting(
            UUID revisionId) {

        access.requireBomFlowAccess();
        requireId(revisionId, "Revision ID");
        RevisionContext context = revisionContext(revisionId);

        List<MaterialCostLineResponse> materials = materialLines(revisionId);
        List<LabourLineResponse> labour = labourLines(revisionId);
        CostingSettingsResponse settings = getCostingSettings(revisionId);

        BigDecimal directMaterial = materials.stream()
                .map(MaterialCostLineResponse::totalAmount)
                .map(this::defaultZero)
                .reduce(ZERO, BigDecimal::add);

        BigDecimal directLabour = labour.stream()
                .map(LabourLineResponse::amount)
                .map(this::defaultZero)
                .reduce(ZERO, BigDecimal::add);

        BigDecimal directCost = directMaterial.add(directLabour);
        BigDecimal markup = percent(directCost, settings.markupPercent());
        BigDecimal primeCost = directCost.add(markup);
        BigDecimal fixed = percent(primeCost, settings.factoryFixedOverheadPercent());
        BigDecimal variable = percent(primeCost, settings.factoryVariableOverheadPercent());
        BigDecimal factoryCost = primeCost.add(fixed).add(variable);
        BigDecimal admin = percent(factoryCost, settings.adminOverheadPercent());
        BigDecimal selling = percent(factoryCost, settings.sellingOverheadPercent());
        BigDecimal costProduct = factoryCost.add(admin).add(selling);
        BigDecimal profit = percent(costProduct, settings.profitPercent());
        BigDecimal exFactory = costProduct.add(profit);
        BigDecimal franchise = percent(exFactory, settings.franchisePercent());
        BigDecimal taxable = exFactory.add(franchise);
        BigDecimal gst = percent(taxable, settings.gstPercent());
        BigDecimal mrp = taxable.add(gst);

        if (settings.roundOff()) {
            mrp = mrp.setScale(0, RoundingMode.HALF_UP);
        }

        int missing = (int) materials.stream()
                .filter(line -> defaultZero(line.rate()).compareTo(ZERO) <= 0)
                .count();

        return new CostingSummaryResponse(
                revisionId,
                context.productId(),
                context.productName(),
                context.productCode(),
                context.projectReference(),
                context.clientEntity(),
                context.revisionNo(),
                context.status(),
                money(directMaterial),
                money(directLabour),
                money(directCost),
                money(markup),
                money(primeCost),
                money(fixed),
                money(variable),
                money(factoryCost),
                money(admin),
                money(selling),
                money(costProduct),
                money(profit),
                money(exFactory),
                money(franchise),
                money(taxable),
                money(gst),
                money(mrp),
                materials.size(),
                missing,
                labour.size(),
                settings,
                materials,
                labour);
    }

    public CostingSettingsResponse saveCostingSettings(
            UUID revisionId,
            CostingSettingsRequest request) {

        access.requireEditor();
        requireId(revisionId, "Revision ID");
        RevisionContext context = revisionContext(revisionId);
        requireCommercialEditableRevision(context);
        if (request == null) throw badRequest("Costing settings are required.");

        CostingSettingsResponse existing = findCostingSettings(revisionId);
        String actor = access.currentUsername();
        LocalDateTime now = LocalDateTime.now();

        BigDecimal markup = pctValue(request.markupPercent(), existing == null ? new BigDecimal("5") : existing.markupPercent());
        BigDecimal fixed = pctValue(request.factoryFixedOverheadPercent(), existing == null ? new BigDecimal("40") : existing.factoryFixedOverheadPercent());
        BigDecimal variable = pctValue(request.factoryVariableOverheadPercent(), existing == null ? new BigDecimal("10") : existing.factoryVariableOverheadPercent());
        BigDecimal admin = pctValue(request.adminOverheadPercent(), existing == null ? ZERO : existing.adminOverheadPercent());
        BigDecimal selling = pctValue(request.sellingOverheadPercent(), existing == null ? ZERO : existing.sellingOverheadPercent());
        BigDecimal profit = pctValue(request.profitPercent(), existing == null ? ZERO : existing.profitPercent());
        BigDecimal franchise = pctValue(request.franchisePercent(), existing == null ? ZERO : existing.franchisePercent());
        BigDecimal gst = pctValue(request.gstPercent(), existing == null ? new BigDecimal("18") : existing.gstPercent());
        boolean roundOff = request.roundOff() != null
                ? request.roundOff()
                : existing != null && existing.roundOff();

        if (existing == null) {
            UUID id = UUID.randomUUID();
            jdbc.update("""
                    INSERT INTO bom_flow_costing_settings (
                        id, revision_id, markup_percent, factory_fixed_overhead_percent,
                        factory_variable_overhead_percent, admin_overhead_percent,
                        selling_overhead_percent, profit_percent, franchise_percent,
                        gst_percent, round_off, created_by, created_at, updated_by, updated_at, row_version
                    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)
                    """,
                    id,
                    revisionId,
                    markup,
                    fixed,
                    variable,
                    admin,
                    selling,
                    profit,
                    franchise,
                    gst,
                    roundOff,
                    actor,
                    Timestamp.valueOf(now),
                    actor,
                    Timestamp.valueOf(now));

            audit("COSTING_SETTINGS", id, revisionId, "CREATE", null,
                    "revision=" + revisionId, actor);
        } else {
            requireVersion(request.rowVersion(), "Costing settings");

            int changed = jdbc.update("""
                    UPDATE bom_flow_costing_settings
                    SET markup_percent = ?, factory_fixed_overhead_percent = ?,
                        factory_variable_overhead_percent = ?, admin_overhead_percent = ?,
                        selling_overhead_percent = ?, profit_percent = ?, franchise_percent = ?,
                        gst_percent = ?, round_off = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP,
                        row_version = row_version + 1
                    WHERE revision_id = ? AND row_version = ?
                    """,
                    markup,
                    fixed,
                    variable,
                    admin,
                    selling,
                    profit,
                    franchise,
                    gst,
                    roundOff,
                    actor,
                    revisionId,
                    request.rowVersion());

            if (changed == 0) {
                throw conflict("Costing settings were changed by another user. Refresh and try again.");
            }

            audit("COSTING_SETTINGS", existing.id(), revisionId, "UPDATE", null,
                    "revision=" + revisionId, actor);
        }

        return getCostingSettings(revisionId);
    }

    public LabourSyncResponse syncLabourMaster(
            UUID revisionId) {

        access.requireEditor();
        requireId(revisionId, "Revision ID");
        RevisionContext context = revisionContext(revisionId);
        requireCommercialEditableRevision(context);

        LocalDate today = LocalDate.now();

        List<LabourRateResponse> masters = jdbc.query("""
                SELECT *
                FROM bom_flow_labour_rates
                WHERE active = true
                  AND effective_from <= ?
                  AND (effective_to IS NULL OR effective_to >= ?)
                ORDER BY department, process_name, effective_from DESC, updated_at DESC
                """,
                this::mapLabourRate,
                Date.valueOf(today),
                Date.valueOf(today));

        List<BomSection> sections = jdbc.query("""
                SELECT section_name, category, COALESCE(SUM(required_qty),0) AS total_qty
                FROM bom_flow_items
                WHERE revision_id = ? AND active = true
                GROUP BY section_name, category
                ORDER BY section_name, category
                """,
                (rs, rowNum) -> new BomSection(
                        rs.getString("section_name"),
                        rs.getString("category"),
                        decimal(rs, "total_qty")),
                revisionId);

        List<UUID> existingRateIds = jdbc.query("""
                SELECT labour_rate_id
                FROM bom_flow_revision_labour
                WHERE revision_id = ? AND labour_rate_id IS NOT NULL
                """,
                (rs, rowNum) -> uuidNullable(rs, "labour_rate_id"),
                revisionId);

        int matched = 0;
        int inserted = 0;
        int existing = 0;
        int incomplete = 0;
        List<String> matchedProcesses = new ArrayList<>();
        List<String> unmatchedProcesses = new ArrayList<>();

        String actor = access.currentUsername();
        LocalDateTime now = LocalDateTime.now();

        for (LabourRateResponse master : masters) {
            BomSection section = findBestLabourSection(master, sections);

            if (section == null) {
                unmatchedProcesses.add(master.department() + " • " + master.processName());
                continue;
            }

            matched++;
            matchedProcesses.add(master.department() + " • " + master.processName());

            if (existingRateIds.contains(master.id())) {
                existing++;
                continue;
            }

            BigDecimal labourCount = nonNegative(
                    defaultValue(master.defaultLabourCount(), BigDecimal.ONE),
                    "Default labour count");

            BigDecimal workingHours = nonNegative(
                    defaultZero(master.defaultWorkingHours()),
                    "Default working hours");

            String basis = labourBasis(master.basis());
            BigDecimal quantity = "PER_ITEM".equals(basis)
                    ? defaultZero(section.quantity())
                    : ZERO;

            BigDecimal rate = nonNegative(master.rate(), "Labour rate");
            BigDecimal amount = labourAmountForSync(
                    basis,
                    labourCount,
                    workingHours,
                    quantity,
                    rate);

            boolean needsInput = labourInputIncomplete(
                    basis,
                    labourCount,
                    workingHours,
                    quantity);

            if (needsInput) {
                incomplete++;
            }

            UUID id = UUID.randomUUID();
            String remarks = "Synced from Labour Master for BOM section: "
                    + defaultText(section.section(), section.category())
                    + (needsInput
                            ? ". Enter the required working hours/quantity before final costing."
                            : ".");

            jdbc.update("""
                    INSERT INTO bom_flow_revision_labour (
                        id, revision_id, labour_rate_id, department, process_code,
                        process_name, basis, unit, labour_count, working_hours, quantity,
                        rate, amount, remarks, created_by, created_at, updated_by, updated_at, row_version
                    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)
                    """,
                    id,
                    revisionId,
                    master.id(),
                    master.department(),
                    master.processCode(),
                    master.processName(),
                    basis,
                    master.unit(),
                    labourCount,
                    workingHours,
                    quantity,
                    rate,
                    amount,
                    remarks,
                    actor,
                    Timestamp.valueOf(now),
                    actor,
                    Timestamp.valueOf(now));

            existingRateIds.add(master.id());
            inserted++;

            audit(
                    "REVISION_LABOUR",
                    id,
                    revisionId,
                    "LABOUR_MASTER_SYNC",
                    null,
                    master.department() + "|" + master.processName() + "|section=" + section.section(),
                    actor);
        }

        String message;
        if (masters.isEmpty()) {
            message = "No active Labour Master rates are effective today.";
        } else if (matched == 0) {
            message = "No Labour Master process matched the BOM sections. Match Department or Process Name to a BOM section/category, or add the process manually.";
        } else if (inserted == 0) {
            message = "Applicable Labour Master processes are already linked to this revision.";
        } else if (incomplete > 0) {
            message = inserted + " Labour Master process(es) synced. "
                    + incomplete + " line(s) still need working hours or quantity before they contribute to Direct Labour.";
        } else {
            message = inserted + " Labour Master process(es) synced and included in Direct Labour.";
        }

        return new LabourSyncResponse(
                revisionId,
                masters.size(),
                matched,
                inserted,
                existing,
                masters.size() - matched,
                incomplete,
                matchedProcesses,
                unmatchedProcesses,
                message);
    }

    public LabourLineResponse addLabourLine(
            UUID revisionId,
            LabourLineRequest request) {

        access.requireEditor();
        requireId(revisionId, "Revision ID");
        RevisionContext context = revisionContext(revisionId);
        requireCommercialEditableRevision(context);
        if (request == null || request.labourRateId() == null) {
            throw badRequest("Labour Master process is required.");
        }

        LabourRateResponse master = getLabourRate(request.labourRateId());
        if (!master.active()) {
            throw badRequest("Selected Labour Master process is inactive.");
        }

        BigDecimal labourCount = nonNegative(defaultValue(request.labourCount(), master.defaultLabourCount()), "Labour count");
        BigDecimal hours = nonNegative(defaultValue(request.workingHours(), master.defaultWorkingHours()), "Working hours");
        BigDecimal quantity = nonNegative(defaultZero(request.quantity()), "Quantity");
        BigDecimal rate = nonNegative(request.rate() == null ? master.rate() : request.rate(), "Labour rate");
        BigDecimal amount = labourAmount(master.basis(), labourCount, hours, quantity, rate);

        UUID id = UUID.randomUUID();
        String actor = access.currentUsername();
        LocalDateTime now = LocalDateTime.now();

        jdbc.update("""
                INSERT INTO bom_flow_revision_labour (
                    id, revision_id, labour_rate_id, department, process_code,
                    process_name, basis, unit, labour_count, working_hours, quantity,
                    rate, amount, remarks, created_by, created_at, updated_by, updated_at, row_version
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)
                """,
                id,
                revisionId,
                master.id(),
                master.department(),
                master.processCode(),
                master.processName(),
                master.basis(),
                master.unit(),
                labourCount,
                hours,
                quantity,
                rate,
                amount,
                clean(request.remarks()),
                actor,
                Timestamp.valueOf(now),
                actor,
                Timestamp.valueOf(now));

        audit("REVISION_LABOUR", id, revisionId, "CREATE", null,
                master.processName() + "=" + amount, actor);
        return getLabourLine(id, revisionId);
    }

    public LabourLineResponse updateLabourLine(
            UUID revisionId,
            UUID lineId,
            LabourLineRequest request) {

        access.requireEditor();
        requireId(revisionId, "Revision ID");
        requireId(lineId, "Labour line ID");
        requireCommercialEditableRevision(revisionContext(revisionId));
        if (request == null) throw badRequest("Labour line request is required.");
        requireVersion(request.rowVersion(), "Labour line");

        LabourLineResponse old = getLabourLine(lineId, revisionId);
        LabourRateResponse master = request.labourRateId() == null
                ? getLabourRate(old.labourRateId())
                : getLabourRate(request.labourRateId());

        BigDecimal labourCount = nonNegative(defaultValue(request.labourCount(), old.labourCount()), "Labour count");
        BigDecimal hours = nonNegative(defaultValue(request.workingHours(), old.workingHours()), "Working hours");
        BigDecimal quantity = nonNegative(defaultValue(request.quantity(), old.quantity()), "Quantity");
        BigDecimal rate = nonNegative(defaultValue(request.rate(), old.rate()), "Labour rate");
        BigDecimal amount = labourAmount(master.basis(), labourCount, hours, quantity, rate);
        String actor = access.currentUsername();

        int changed = jdbc.update("""
                UPDATE bom_flow_revision_labour
                SET labour_rate_id = ?, department = ?, process_code = ?, process_name = ?,
                    basis = ?, unit = ?, labour_count = ?, working_hours = ?, quantity = ?,
                    rate = ?, amount = ?, remarks = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP,
                    row_version = row_version + 1
                WHERE id = ? AND revision_id = ? AND row_version = ?
                """,
                master.id(),
                master.department(),
                master.processCode(),
                master.processName(),
                master.basis(),
                master.unit(),
                labourCount,
                hours,
                quantity,
                rate,
                amount,
                clean(request.remarks()),
                actor,
                lineId,
                revisionId,
                request.rowVersion());

        if (changed == 0) {
            throw conflict("Labour line was changed by another user. Refresh and try again.");
        }

        audit("REVISION_LABOUR", lineId, revisionId, "UPDATE",
                old.processName() + "=" + old.amount(),
                master.processName() + "=" + amount,
                actor);

        return getLabourLine(lineId, revisionId);
    }

    public void deleteLabourLine(
            UUID revisionId,
            UUID lineId,
            Long rowVersion) {

        access.requireEditor();
        requireId(revisionId, "Revision ID");
        requireId(lineId, "Labour line ID");
        requireCommercialEditableRevision(revisionContext(revisionId));
        requireVersion(rowVersion, "Labour line");

        LabourLineResponse old = getLabourLine(lineId, revisionId);
        int changed = jdbc.update("""
                DELETE FROM bom_flow_revision_labour
                WHERE id = ? AND revision_id = ? AND row_version = ?
                """,
                lineId,
                revisionId,
                rowVersion);

        if (changed == 0) {
            throw conflict("Labour line was changed by another user. Refresh and try again.");
        }

        audit("REVISION_LABOUR", lineId, revisionId, "DELETE",
                old.processName() + "=" + old.amount(), null, access.currentUsername());
    }

    /* =====================================================================
       DASHBOARD + REPORTS
       ===================================================================== */

    @Transactional(readOnly = true)
    public DashboardSummaryResponse dashboard() {
        access.requireBomFlowAccess();

        long totalProducts = count("SELECT COUNT(*) FROM bom_flow_boms");
        long activeCostings = count("""
                SELECT COUNT(*) FROM bom_flow_revisions
                WHERE status IN ('SUBMITTED','VERIFIED','APPROVED','RELEASED')
                """);
        long draftBoms = count("""
                SELECT COUNT(*) FROM bom_flow_revisions
                WHERE status IN ('DRAFT','RETURNED')
                """);
        long approvedBoms = count("""
                SELECT COUNT(*) FROM bom_flow_revisions
                WHERE status IN ('APPROVED','RELEASED')
                """);
        long missingRates = count("""
                SELECT COUNT(*) FROM bom_flow_items
                WHERE active = true AND COALESCE(unit_rate,0) <= 0
                """);
        long activeMaterialRates = count("SELECT COUNT(*) FROM bom_flow_material_rates WHERE active = true");
        long activeLabourRates = count("SELECT COUNT(*) FROM bom_flow_labour_rates WHERE active = true");

        List<DashboardRecentResponse> recent = jdbc.query("""
                SELECT b.id AS product_id,
                       r.id AS revision_id,
                       b.product_name,
                       b.product_code,
                       r.status,
                       COALESCE((SELECT SUM(i.total_amount) FROM bom_flow_items i
                                 WHERE i.revision_id = r.id AND i.active = true),0) AS material_cost,
                       COALESCE((SELECT SUM(l.amount) FROM bom_flow_revision_labour l
                                 WHERE l.revision_id = r.id),0) AS labour_cost,
                       r.updated_by,
                       r.updated_at
                FROM bom_flow_revisions r
                JOIN bom_flow_boms b ON b.id = r.bom_id
                ORDER BY r.updated_at DESC
                LIMIT 10
                """,
                (rs, rowNum) -> {
                    BigDecimal material = decimal(rs, "material_cost");
                    BigDecimal labour = decimal(rs, "labour_cost");
                    return new DashboardRecentResponse(
                            uuid(rs, "product_id"),
                            uuid(rs, "revision_id"),
                            rs.getString("product_name"),
                            rs.getString("product_code"),
                            rs.getString("status"),
                            money(material),
                            money(labour),
                            money(material.add(labour)),
                            rs.getString("updated_by"),
                            localDateTime(rs, "updated_at"));
                });

        return new DashboardSummaryResponse(
                totalProducts,
                activeCostings,
                draftBoms,
                approvedBoms,
                missingRates,
                activeMaterialRates,
                activeLabourRates,
                recent);
    }

    @Transactional(readOnly = true)
    public byte[] materialCsv(UUID revisionId) {
        CostingSummaryResponse costing = getCosting(revisionId);
        StringBuilder out = new StringBuilder();
        csvRow(out, "Product", costing.productName());
        csvRow(out, "Product Code", costing.productCode());
        csvRow(out, "Revision", costing.revisionNo());
        out.append('\n');
        csvRow(out, "Line", "Section", "Category", "Item", "Brand", "Vendor", "Unit",
                "Qty", "Rate", "Material Amount", "Processing Amount", "Total Amount", "GST %");
        for (MaterialCostLineResponse line : costing.materialLines()) {
            csvRow(out,
                    line.lineNo(), line.section(), line.category(), line.itemName(), line.brand(),
                    line.vendorName(), line.unit(), line.quantity(), line.rate(), line.materialAmount(),
                    line.processingAmount(), line.totalAmount(), line.gstPercent());
        }
        csvRow(out, "", "", "", "", "", "", "", "", "", "", "Grand Total", costing.directMaterial(), "");
        return excelUtf8(out.toString());
    }

    @Transactional(readOnly = true)
    public byte[] labourCsv(UUID revisionId) {
        CostingSummaryResponse costing = getCosting(revisionId);
        StringBuilder out = new StringBuilder();
        csvRow(out, "Product", costing.productName());
        csvRow(out, "Product Code", costing.productCode());
        csvRow(out, "Revision", costing.revisionNo());
        out.append('\n');
        csvRow(out, "Department", "Process Code", "Process", "Basis", "Unit",
                "Labour Count", "Working Hours", "Quantity", "Rate", "Amount", "Remarks");
        for (LabourLineResponse line : costing.labourLines()) {
            csvRow(out,
                    line.department(), line.processCode(), line.processName(), line.basis(), line.unit(),
                    line.labourCount(), line.workingHours(), line.quantity(), line.rate(), line.amount(), line.remarks());
        }
        csvRow(out, "", "", "", "", "", "", "", "", "Total Labour", costing.directLabour(), "");
        return excelUtf8(out.toString());
    }

    @Transactional(readOnly = true)
    public byte[] costingCsv(UUID revisionId) {
        CostingSummaryResponse c = getCosting(revisionId);
        StringBuilder out = new StringBuilder();
        csvRow(out, "BOMFLOW COSTING SUMMARY");
        csvRow(out, "Product", c.productName());
        csvRow(out, "Product Code", c.productCode());
        csvRow(out, "Project", c.projectReference());
        csvRow(out, "Client", c.clientEntity());
        csvRow(out, "Revision", c.revisionNo());
        csvRow(out, "Revision Status", c.revisionStatus());
        out.append('\n');
        csvRow(out, "Cost Head", "Value");
        csvRow(out, "Direct Material", c.directMaterial());
        csvRow(out, "Direct Labour", c.directLabour());
        csvRow(out, "Direct Cost", c.directCost());
        csvRow(out, "Markup", c.markupAmount());
        csvRow(out, "Prime Cost", c.primeCost());
        csvRow(out, "Factory Fixed Overhead", c.factoryFixedOverhead());
        csvRow(out, "Factory Variable Overhead", c.factoryVariableOverhead());
        csvRow(out, "Factory Cost", c.factoryCost());
        csvRow(out, "Admin Overhead", c.adminOverhead());
        csvRow(out, "Selling Overhead", c.sellingOverhead());
        csvRow(out, "Cost / Product", c.costPerProduct());
        csvRow(out, "Profit", c.profitAmount());
        csvRow(out, "Ex-Factory", c.exFactory());
        csvRow(out, "Franchise", c.franchiseAmount());
        csvRow(out, "Taxable Value", c.taxableValue());
        csvRow(out, "GST", c.gstAmount());
        csvRow(out, "MRP", c.mrp());
        return excelUtf8(out.toString());
    }

    @Transactional(readOnly = true)
    public byte[] changeLogCsv(UUID revisionId) {
        access.requireBomFlowAccess();
        RevisionContext context = revisionContext(revisionId);
        StringBuilder out = new StringBuilder();
        csvRow(out, "Product", context.productName());
        csvRow(out, "Revision", context.revisionNo());
        out.append('\n');
        csvRow(out, "Source", "Action", "Old Value", "New Value", "Changed By", "Changed At");

        jdbc.query("""
                SELECT action, old_value, new_value, changed_by, changed_at
                FROM bom_flow_audit_logs
                WHERE revision_id = ?
                ORDER BY changed_at DESC
                """,
                (RowCallbackHandler) rs -> {
                    csvRow(out,
                            "BOM",
                            rs.getString("action"),
                            rs.getString("old_value"),
                            rs.getString("new_value"),
                            rs.getString("changed_by"),
                            localDateTime(rs, "changed_at"));
                },
                revisionId);

        jdbc.query("""
                SELECT action, old_value, new_value, changed_by, changed_at
                FROM bom_flow_master_audit_logs
                WHERE revision_id = ?
                ORDER BY changed_at DESC
                """,
                (RowCallbackHandler) rs -> {
                    csvRow(out,
                            "COMMERCIAL",
                            rs.getString("action"),
                            rs.getString("old_value"),
                            rs.getString("new_value"),
                            rs.getString("changed_by"),
                            localDateTime(rs, "changed_at"));
                },
                revisionId);

        return excelUtf8(out.toString());
    }

    @Transactional(readOnly = true)
    public byte[] workbookXlsx(UUID revisionId) {
        CostingSummaryResponse c = getCosting(revisionId);

        List<List<Object>> costingRows = new ArrayList<>();
        costingRows.add(List.of("ALSORG - BOMFlow Costing Summary"));
        costingRows.add(List.of("Product", safeObject(c.productName())));
        costingRows.add(List.of("Product Code", safeObject(c.productCode())));
        costingRows.add(List.of("Project", safeObject(c.projectReference())));
        costingRows.add(List.of("Client", safeObject(c.clientEntity())));
        costingRows.add(List.of("Revision", c.revisionNo()));
        costingRows.add(List.of("Status", safeObject(c.revisionStatus())));
        costingRows.add(List.of());
        costingRows.add(List.of("Cost Head", "Value"));
        costingRows.add(List.of("Direct Material", c.directMaterial()));
        costingRows.add(List.of("Direct Labour", c.directLabour()));
        costingRows.add(List.of("Direct Cost", c.directCost()));
        costingRows.add(List.of("Markup", c.markupAmount()));
        costingRows.add(List.of("Prime Cost", c.primeCost()));
        costingRows.add(List.of("Factory Fixed Overhead", c.factoryFixedOverhead()));
        costingRows.add(List.of("Factory Variable Overhead", c.factoryVariableOverhead()));
        costingRows.add(List.of("Factory Cost", c.factoryCost()));
        costingRows.add(List.of("Admin Overhead", c.adminOverhead()));
        costingRows.add(List.of("Selling Overhead", c.sellingOverhead()));
        costingRows.add(List.of("Cost / Product", c.costPerProduct()));
        costingRows.add(List.of("Profit", c.profitAmount()));
        costingRows.add(List.of("Ex-Factory", c.exFactory()));
        costingRows.add(List.of("Franchise", c.franchiseAmount()));
        costingRows.add(List.of("Taxable Value", c.taxableValue()));
        costingRows.add(List.of("GST", c.gstAmount()));
        costingRows.add(List.of("MRP", c.mrp()));

        List<List<Object>> materialRows = new ArrayList<>();
        materialRows.add(List.of("Line", "Section", "Category", "Item", "Brand", "Vendor", "Unit", "Qty", "Rate", "Material Amount", "Processing Amount", "Total Amount", "GST %"));
        for (MaterialCostLineResponse line : c.materialLines()) {
            materialRows.add(List.of(
                    line.lineNo(), safeObject(line.section()), safeObject(line.category()), safeObject(line.itemName()),
                    safeObject(line.brand()), safeObject(line.vendorName()), safeObject(line.unit()), line.quantity(),
                    line.rate(), line.materialAmount(), line.processingAmount(), line.totalAmount(), line.gstPercent()));
        }

        List<List<Object>> labourRows = new ArrayList<>();
        labourRows.add(List.of("Department", "Process Code", "Process", "Basis", "Unit", "Labour Count", "Working Hours", "Quantity", "Rate", "Amount", "Remarks"));
        for (LabourLineResponse line : c.labourLines()) {
            labourRows.add(List.of(
                    safeObject(line.department()), safeObject(line.processCode()), safeObject(line.processName()), safeObject(line.basis()),
                    safeObject(line.unit()), line.labourCount(), line.workingHours(), line.quantity(), line.rate(), line.amount(), safeObject(line.remarks())));
        }

        List<List<Object>> auditRows = new ArrayList<>();
        auditRows.add(List.of("Source", "Action", "Old Value", "New Value", "Changed By", "Changed At"));
        jdbc.query("""
                SELECT action, old_value, new_value, changed_by, changed_at
                FROM bom_flow_audit_logs
                WHERE revision_id = ?
                ORDER BY changed_at DESC
                """,
                (RowCallbackHandler) rs -> {
                    auditRows.add(List.of(
                            "BOM",
                            safeObject(rs.getString("action")),
                            safeObject(rs.getString("old_value")),
                            safeObject(rs.getString("new_value")),
                            safeObject(rs.getString("changed_by")),
                            safeObject(localDateTime(rs, "changed_at"))));
                },
                revisionId);
        jdbc.query("""
                SELECT action, old_value, new_value, changed_by, changed_at
                FROM bom_flow_master_audit_logs
                WHERE revision_id = ?
                ORDER BY changed_at DESC
                """,
                (RowCallbackHandler) rs -> {
                    auditRows.add(List.of(
                            "COMMERCIAL",
                            safeObject(rs.getString("action")),
                            safeObject(rs.getString("old_value")),
                            safeObject(rs.getString("new_value")),
                            safeObject(rs.getString("changed_by")),
                            safeObject(localDateTime(rs, "changed_at"))));
                },
                revisionId);

        try {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            try (ZipOutputStream zip = new ZipOutputStream(bytes, StandardCharsets.UTF_8)) {
                zipEntry(zip, "[Content_Types].xml", contentTypesXml());
                zipEntry(zip, "_rels/.rels", rootRelsXml());
                zipEntry(zip, "xl/workbook.xml", workbookXml());
                zipEntry(zip, "xl/_rels/workbook.xml.rels", workbookRelsXml());
                zipEntry(zip, "xl/styles.xml", stylesXml());
                zipEntry(zip, "xl/worksheets/sheet1.xml", sheetXml(costingRows));
                zipEntry(zip, "xl/worksheets/sheet2.xml", sheetXml(materialRows));
                zipEntry(zip, "xl/worksheets/sheet3.xml", sheetXml(labourRows));
                zipEntry(zip, "xl/worksheets/sheet4.xml", sheetXml(auditRows));
            }
            return bytes.toByteArray();
        } catch (IOException ex) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Unable to create BOMFlow Excel report.");
        }
    }

    /* =====================================================================
       INTERNAL QUERIES / MAPPERS
       ===================================================================== */

    @Transactional(readOnly = true)
    public MaterialRateResponse getMaterialRate(UUID id) {
        requireId(id, "Material rate ID");
        try {
            return jdbc.queryForObject(
                    "SELECT * FROM bom_flow_material_rates WHERE id = ?",
                    this::mapMaterialRate,
                    id);
        } catch (EmptyResultDataAccessException ex) {
            throw notFound("Material rate not found: " + id);
        }
    }

    @Transactional(readOnly = true)
    public LabourRateResponse getLabourRate(UUID id) {
        requireId(id, "Labour rate ID");
        try {
            return jdbc.queryForObject(
                    "SELECT * FROM bom_flow_labour_rates WHERE id = ?",
                    this::mapLabourRate,
                    id);
        } catch (EmptyResultDataAccessException ex) {
            throw notFound("Labour rate not found: " + id);
        }
    }

    private MaterialRateResponse mapMaterialRate(ResultSet rs, int rowNum) throws SQLException {
        return new MaterialRateResponse(
                uuid(rs, "id"),
                rs.getString("category"),
                rs.getString("item_name"),
                rs.getString("brand"),
                rs.getString("vendor_name"),
                rs.getString("unit"),
                rs.getString("rate_type"),
                decimal(rs, "rate"),
                decimal(rs, "gst_percent"),
                localDate(rs, "effective_from"),
                localDate(rs, "effective_to"),
                rs.getString("source_reference"),
                rs.getString("notes"),
                hasText(rs.getString("evidence_storage_key")),
                rs.getString("evidence_original_name"),
                rs.getString("evidence_content_type"),
                rs.getObject("evidence_size") == null ? null : rs.getLong("evidence_size"),
                rs.getString("evidence_uploaded_by"),
                localDateTime(rs, "evidence_uploaded_at"),
                rs.getBoolean("active"),
                rs.getString("created_by"),
                localDateTime(rs, "created_at"),
                rs.getString("updated_by"),
                localDateTime(rs, "updated_at"),
                rs.getLong("row_version"));
    }

    private LabourRateResponse mapLabourRate(ResultSet rs, int rowNum) throws SQLException {
        return new LabourRateResponse(
                uuid(rs, "id"),
                rs.getString("department"),
                rs.getString("process_code"),
                rs.getString("process_name"),
                rs.getString("basis"),
                rs.getString("unit"),
                decimal(rs, "rate"),
                decimal(rs, "default_labour_count"),
                decimal(rs, "default_working_hours"),
                localDate(rs, "effective_from"),
                localDate(rs, "effective_to"),
                rs.getString("notes"),
                rs.getBoolean("active"),
                rs.getString("created_by"),
                localDateTime(rs, "created_at"),
                rs.getString("updated_by"),
                localDateTime(rs, "updated_at"),
                rs.getLong("row_version"));
    }

    private List<MaterialCostLineResponse> materialLines(UUID revisionId) {
        return jdbc.query("""
                SELECT id, line_no, section_name, category, item_name, brand, vendor_name,
                       unit, required_qty, unit_rate, material_amount, processing_amount,
                       total_amount, gst_percent, rate_master_id, rate_applied_at
                FROM bom_flow_items
                WHERE revision_id = ? AND active = true
                ORDER BY line_no
                """,
                (rs, rowNum) -> new MaterialCostLineResponse(
                        uuid(rs, "id"),
                        rs.getInt("line_no"),
                        rs.getString("section_name"),
                        rs.getString("category"),
                        rs.getString("item_name"),
                        rs.getString("brand"),
                        rs.getString("vendor_name"),
                        rs.getString("unit"),
                        decimal(rs, "required_qty"),
                        decimal(rs, "unit_rate"),
                        money(decimal(rs, "material_amount")),
                        money(decimal(rs, "processing_amount")),
                        money(decimal(rs, "total_amount")),
                        decimal(rs, "gst_percent"),
                        uuidNullable(rs, "rate_master_id"),
                        localDateTime(rs, "rate_applied_at")),
                revisionId);
    }

    private List<LabourLineResponse> labourLines(UUID revisionId) {
        return jdbc.query("""
                SELECT * FROM bom_flow_revision_labour
                WHERE revision_id = ?
                ORDER BY created_at, process_name
                """,
                this::mapLabourLine,
                revisionId);
    }

    private LabourLineResponse mapLabourLine(ResultSet rs, int rowNum) throws SQLException {
        return new LabourLineResponse(
                uuid(rs, "id"),
                uuid(rs, "revision_id"),
                uuidNullable(rs, "labour_rate_id"),
                rs.getString("department"),
                rs.getString("process_code"),
                rs.getString("process_name"),
                rs.getString("basis"),
                rs.getString("unit"),
                decimal(rs, "labour_count"),
                decimal(rs, "working_hours"),
                decimal(rs, "quantity"),
                decimal(rs, "rate"),
                money(decimal(rs, "amount")),
                rs.getString("remarks"),
                rs.getString("created_by"),
                localDateTime(rs, "created_at"),
                rs.getString("updated_by"),
                localDateTime(rs, "updated_at"),
                rs.getLong("row_version"));
    }

    private LabourLineResponse getLabourLine(UUID id, UUID revisionId) {
        try {
            return jdbc.queryForObject(
                    "SELECT * FROM bom_flow_revision_labour WHERE id = ? AND revision_id = ?",
                    this::mapLabourLine,
                    id,
                    revisionId);
        } catch (EmptyResultDataAccessException ex) {
            throw notFound("Labour line not found: " + id);
        }
    }

    private CostingSettingsResponse getCostingSettings(UUID revisionId) {
        CostingSettingsResponse found = findCostingSettings(revisionId);
        if (found != null) return found;

        return new CostingSettingsResponse(
                null,
                revisionId,
                new BigDecimal("5"),
                new BigDecimal("40"),
                new BigDecimal("10"),
                ZERO,
                ZERO,
                ZERO,
                ZERO,
                new BigDecimal("18"),
                false,
                null,
                null,
                null,
                null,
                null);
    }

    private CostingSettingsResponse findCostingSettings(UUID revisionId) {
        try {
            return jdbc.queryForObject("""
                    SELECT * FROM bom_flow_costing_settings WHERE revision_id = ?
                    """,
                    (rs, rowNum) -> new CostingSettingsResponse(
                            uuid(rs, "id"),
                            uuid(rs, "revision_id"),
                            decimal(rs, "markup_percent"),
                            decimal(rs, "factory_fixed_overhead_percent"),
                            decimal(rs, "factory_variable_overhead_percent"),
                            decimal(rs, "admin_overhead_percent"),
                            decimal(rs, "selling_overhead_percent"),
                            decimal(rs, "profit_percent"),
                            decimal(rs, "franchise_percent"),
                            decimal(rs, "gst_percent"),
                            rs.getBoolean("round_off"),
                            rs.getString("created_by"),
                            localDateTime(rs, "created_at"),
                            rs.getString("updated_by"),
                            localDateTime(rs, "updated_at"),
                            rs.getLong("row_version")),
                    revisionId);
        } catch (EmptyResultDataAccessException ex) {
            return null;
        }
    }

    private RevisionContext revisionContext(UUID revisionId) {
        try {
            return jdbc.queryForObject("""
                    SELECT r.id AS revision_id, r.revision_no, r.status,
                           b.id AS product_id, b.product_name, b.product_code,
                           b.project_code, b.client_name
                    FROM bom_flow_revisions r
                    JOIN bom_flow_boms b ON b.id = r.bom_id
                    WHERE r.id = ?
                    """,
                    (rs, rowNum) -> new RevisionContext(
                            uuid(rs, "revision_id"),
                            uuid(rs, "product_id"),
                            rs.getString("product_name"),
                            rs.getString("product_code"),
                            rs.getString("project_code"),
                            rs.getString("client_name"),
                            rs.getInt("revision_no"),
                            rs.getString("status")),
                    revisionId);
        } catch (EmptyResultDataAccessException ex) {
            throw notFound("BOM revision not found: " + revisionId);
        }
    }

    private MaterialRateResponse findBestRate(
            MaterialBomRow item,
            List<MaterialRateResponse> rates) {

        String itemName = normalize(item.itemName());
        if (itemName.isBlank()) return null;

        return rates.stream()
                .filter(rate -> normalize(rate.itemName()).equals(itemName))
                .max(Comparator
                        .comparingInt((MaterialRateResponse rate) -> rateScore(item, rate))
                        .thenComparing(MaterialRateResponse::effectiveFrom,
                                Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(MaterialRateResponse::updatedAt,
                                Comparator.nullsLast(Comparator.naturalOrder())))
                .orElse(null);
    }

    private int rateScore(MaterialBomRow item, MaterialRateResponse rate) {
        int score = 10;
        if (same(item.category(), rate.category()) || same(item.section(), rate.category())) score += 4;
        if (hasText(item.brand()) && same(item.brand(), rate.brand())) score += 5;
        if (hasText(item.unit()) && same(item.unit(), rate.unit())) score += 3;
        if (hasText(item.vendorName()) && same(item.vendorName(), rate.vendorName())) score += 2;
        return score;
    }

    private BigDecimal labourAmount(
            String basis,
            BigDecimal labourCount,
            BigDecimal workingHours,
            BigDecimal quantity,
            BigDecimal rate) {

        String value = labourBasis(basis);
        return switch (value) {
            case "PER_HOUR" -> {
                if (labourCount.compareTo(ZERO) <= 0 || workingHours.compareTo(ZERO) <= 0) {
                    throw badRequest("PER_HOUR labour requires Labour Count and Working Hours greater than zero.");
                }
                yield money(labourCount.multiply(workingHours).multiply(rate));
            }
            case "FIXED" -> money(rate);
            default -> {
                if (quantity.compareTo(ZERO) <= 0) {
                    throw badRequest(value + " labour requires Quantity greater than zero.");
                }
                yield money(quantity.multiply(rate));
            }
        };
    }

    private BomSection findBestLabourSection(
            LabourRateResponse master,
            List<BomSection> sections) {

        if (master == null || sections == null || sections.isEmpty()) {
            return null;
        }

        return sections.stream()
                .map(section -> new LabourSectionScore(
                        section,
                        labourSectionScore(master, section)))
                .filter(item -> item.score() > 0)
                .max(Comparator.comparingInt(LabourSectionScore::score))
                .map(LabourSectionScore::section)
                .orElse(null);
    }

    private int labourSectionScore(
            LabourRateResponse master,
            BomSection section) {

        int score = 0;

        if (same(master.processName(), section.section())) score += 12;
        if (same(master.processName(), section.category())) score += 10;
        if (same(master.department(), section.section())) score += 9;
        if (same(master.department(), section.category())) score += 8;

        String process = normalize(master.processName());
        String department = normalize(master.department());
        String sectionName = normalize(section.section());
        String category = normalize(section.category());

        if (!process.isBlank() && !sectionName.isBlank()
                && (process.contains(sectionName) || sectionName.contains(process))) {
            score += 4;
        }

        if (!department.isBlank() && !sectionName.isBlank()
                && (department.contains(sectionName) || sectionName.contains(department))) {
            score += 3;
        }

        if (!department.isBlank() && !category.isBlank()
                && (department.contains(category) || category.contains(department))) {
            score += 2;
        }

        return score;
    }

    private BigDecimal labourAmountForSync(
            String basis,
            BigDecimal labourCount,
            BigDecimal workingHours,
            BigDecimal quantity,
            BigDecimal rate) {

        String value = labourBasis(basis);

        return switch (value) {
            case "PER_HOUR" -> labourCount.compareTo(ZERO) > 0
                    && workingHours.compareTo(ZERO) > 0
                    ? money(labourCount.multiply(workingHours).multiply(rate))
                    : money(ZERO);
            case "FIXED" -> money(rate);
            default -> quantity.compareTo(ZERO) > 0
                    ? money(quantity.multiply(rate))
                    : money(ZERO);
        };
    }

    private boolean labourInputIncomplete(
            String basis,
            BigDecimal labourCount,
            BigDecimal workingHours,
            BigDecimal quantity) {

        String value = labourBasis(basis);

        return switch (value) {
            case "PER_HOUR" -> labourCount.compareTo(ZERO) <= 0
                    || workingHours.compareTo(ZERO) <= 0;
            case "FIXED" -> false;
            default -> quantity.compareTo(ZERO) <= 0;
        };
    }

    private void validateMaterialRate(MaterialRateRequest request) {
        if (request == null) throw badRequest("Material rate request is required.");
        required(request.category(), "Category");
        required(request.itemName(), "Item name");
        required(request.unit(), "Unit");
        materialRateType(request.rateType());
        nonNegative(request.rate(), "Rate");
        nonNegative(defaultZero(request.gstPercent()), "GST percent");
        validateDates(request.effectiveFrom(), request.effectiveTo());
    }

    private void validateLabourRate(LabourRateRequest request) {
        if (request == null) throw badRequest("Labour rate request is required.");
        required(request.department(), "Department");
        required(request.processName(), "Process name");
        labourBasis(request.basis());
        nonNegative(request.rate(), "Labour rate");
        nonNegative(defaultValue(request.defaultLabourCount(), BigDecimal.ONE), "Default labour count");
        nonNegative(defaultZero(request.defaultWorkingHours()), "Default working hours");
        validateDates(request.effectiveFrom(), request.effectiveTo());
    }

    private void validateDates(LocalDate from, LocalDate to) {
        if (from != null && to != null && to.isBefore(from)) {
            throw badRequest("Effective To cannot be before Effective From.");
        }
    }

    private String materialRateType(String rateType) {
        String value = upper(defaultText(rateType, "PURCHASE"));
        return switch (value) {
            case "PURCHASE", "STANDARD", "CONTRACT", "PROCESS", "OTHER" -> value;
            default -> throw badRequest("Unsupported material rate type: " + value);
        };
    }

    private String validateEvidence(MultipartFile file) {
        if (file == null || file.isEmpty()) throw badRequest("Rate evidence file is required.");
        if (file.getSize() > RATE_EVIDENCE_MAX_BYTES) {
            throw badRequest("Rate evidence must be 15 MB or smaller.");
        }
        String name = cleanFileName(file.getOriginalFilename());
        int dot = name.lastIndexOf('.');
        String extension = dot >= 0 && dot < name.length() - 1
                ? name.substring(dot + 1).toLowerCase(Locale.ROOT)
                : "";
        if (!RATE_EVIDENCE_EXTENSIONS.contains(extension)) {
            throw badRequest("Rate evidence must be PDF, image, XLS/XLSX or CSV.");
        }
        return extension;
    }

    private String cleanFileName(String fileName) {
        String value = clean(fileName);
        if (value == null) return "rate-evidence";
        value = value.replace('\\', '/');
        int slash = value.lastIndexOf('/');
        if (slash >= 0) value = value.substring(slash + 1);
        value = value.replaceAll("[\r\n\t]", "_");
        return value.length() > 500 ? value.substring(value.length() - 500) : value;
    }

    private String labourBasis(String basis) {
        String value = upper(defaultText(basis, "PER_HOUR"));
        return switch (value) {
            case "PER_HOUR", "PER_ITEM", "PER_SQFT", "PER_SQIN", "PER_METER", "PER_KG", "FIXED" -> value;
            default -> throw badRequest("Unsupported labour basis: " + value);
        };
    }

    private void audit(
            String entityType,
            UUID entityId,
            UUID revisionId,
            String action,
            String oldValue,
            String newValue,
            String actor) {

        jdbc.update("""
                INSERT INTO bom_flow_master_audit_logs (
                    id, entity_type, entity_id, revision_id, action,
                    old_value, new_value, changed_by, changed_at
                ) VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
                """,
                UUID.randomUUID(),
                entityType,
                entityId,
                revisionId,
                action,
                trim4000(oldValue),
                trim4000(newValue),
                actor);
    }

    private long count(String sql) {
        Long value = jdbc.queryForObject(sql, Long.class);
        return value == null ? 0L : value;
    }

    private BigDecimal percent(BigDecimal base, BigDecimal percent) {
        return money(defaultZero(base)
                .multiply(defaultZero(percent))
                .divide(ONE_HUNDRED, 8, RoundingMode.HALF_UP));
    }

    private BigDecimal pctValue(BigDecimal value, BigDecimal fallback) {
        return nonNegative(value == null ? fallback : value, "Percentage");
    }

    private BigDecimal money(BigDecimal value) {
        return defaultZero(value).setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal amount4(BigDecimal value) {
        return defaultZero(value).setScale(4, RoundingMode.HALF_UP);
    }

    private BigDecimal defaultZero(BigDecimal value) {
        return value == null ? ZERO : value;
    }

    private BigDecimal defaultValue(BigDecimal value, BigDecimal fallback) {
        return value == null ? fallback : value;
    }

    private BigDecimal nonNegative(BigDecimal value, String field) {
        BigDecimal safe = value == null ? ZERO : value;
        if (safe.compareTo(ZERO) < 0) throw badRequest(field + " cannot be negative.");
        return safe;
    }

    private String required(String value, String field) {
        String cleaned = clean(value);
        if (cleaned == null) throw badRequest(field + " is required.");
        return cleaned;
    }

    private String clean(String value) {
        if (value == null) return null;
        String cleaned = value.trim();
        return cleaned.isEmpty() ? null : cleaned;
    }

    private String upper(String value) {
        String cleaned = clean(value);
        return cleaned == null ? null : cleaned.toUpperCase(Locale.ROOT);
    }

    private String defaultText(String value, String fallback) {
        String cleaned = clean(value);
        return cleaned == null ? fallback : cleaned;
    }

    private void requireCommercialEditableRevision(RevisionContext context) {
        String status = upper(context == null ? null : context.status());

        if (status == null || status.isBlank()) {
            throw badRequest("BOM revision status is required for commercial costing changes.");
        }

        if ("CANCELLED".equals(status) || "SUPERSEDED".equals(status)) {
            throw badRequest(
                    "Cancelled or Superseded BOM revisions are read-only for commercial costing.");
        }
    }

    private void requireId(UUID id, String label) {
        if (id == null) throw badRequest(label + " is required.");
    }

    private void requireVersion(Long version, String label) {
        if (version == null) throw badRequest(label + " rowVersion is required.");
    }

    private String normalize(String value) {
        if (value == null) return "";
        return value.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ")
                .trim()
                .replaceAll("\\s+", " ");
    }

    private boolean same(String a, String b) {
        return !normalize(a).isBlank() && normalize(a).equals(normalize(b));
    }

    private boolean hasText(String value) {
        return clean(value) != null;
    }

    private String trim4000(String value) {
        if (value == null) return null;
        return value.length() <= 4000 ? value : value.substring(0, 4000);
    }

    private String materialRateAuditText(MaterialRateRequest request) {
        if (request == null) return null;
        return required(request.itemName(), "Item name") + "|" + upper(required(request.unit(), "Unit"))
                + "|type=" + materialRateType(request.rateType()) + "|rate=" + defaultZero(request.rate());
    }

    private String materialRateAuditText(MaterialRateResponse response) {
        if (response == null) return null;
        return response.itemName() + "|" + response.unit() + "|type=" + response.rateType() + "|rate=" + response.rate();
    }

    private String labourRateAuditText(LabourRateRequest request) {
        if (request == null) return null;
        return required(request.processName(), "Process name") + "|" + labourBasis(request.basis())
                + "|rate=" + defaultZero(request.rate());
    }

    private String labourRateAuditText(LabourRateResponse response) {
        if (response == null) return null;
        return response.processName() + "|" + response.basis() + "|rate=" + response.rate();
    }

    private void csvRow(StringBuilder out, Object... values) {
        for (int i = 0; i < values.length; i++) {
            if (i > 0) out.append(',');
            out.append(csv(values[i]));
        }
        out.append('\n');
    }

    private String csv(Object value) {
        String text = value == null ? "" : String.valueOf(value);
        boolean quote = text.contains(",") || text.contains("\"") || text.contains("\n") || text.contains("\r");
        text = text.replace("\"", "\"\"");
        return quote ? "\"" + text + "\"" : text;
    }

    private byte[] excelUtf8(String value) {
        byte[] text = value.getBytes(StandardCharsets.UTF_8);
        byte[] result = new byte[text.length + 3];
        result[0] = (byte) 0xEF;
        result[1] = (byte) 0xBB;
        result[2] = (byte) 0xBF;
        System.arraycopy(text, 0, result, 3, text.length);
        return result;
    }

    private UUID uuid(ResultSet rs, String column) throws SQLException {
        Object value = rs.getObject(column);
        if (value instanceof UUID id) return id;
        return value == null ? null : UUID.fromString(value.toString());
    }

    private UUID uuidNullable(ResultSet rs, String column) throws SQLException {
        return uuid(rs, column);
    }

    private BigDecimal decimal(ResultSet rs, String column) throws SQLException {
        BigDecimal value = rs.getBigDecimal(column);
        return value == null ? ZERO : value;
    }

    private LocalDate localDate(ResultSet rs, String column) throws SQLException {
        Date value = rs.getDate(column);
        return value == null ? null : value.toLocalDate();
    }

    private LocalDateTime localDateTime(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toLocalDateTime();
    }

    private Object safeObject(Object value) {
        return value == null ? "" : value;
    }

    private void zipEntry(ZipOutputStream zip, String name, String content) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(content.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    private String contentTypesXml() {
        return """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
                  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
                  <Default Extension="xml" ContentType="application/xml"/>
                  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
                  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
                  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
                  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
                  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
                  <Override PartName="/xl/worksheets/sheet4.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
                </Types>
                """;
    }

    private String rootRelsXml() {
        return """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
                </Relationships>
                """;
    }

    private String workbookXml() {
        return """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                  <sheets>
                    <sheet name="Costing Summary" sheetId="1" r:id="rId1"/>
                    <sheet name="Direct Material" sheetId="2" r:id="rId2"/>
                    <sheet name="Direct Labour" sheetId="3" r:id="rId3"/>
                    <sheet name="Change Log" sheetId="4" r:id="rId4"/>
                  </sheets>
                </workbook>
                """;
    }

    private String workbookRelsXml() {
        return """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
                  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
                  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
                  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet4.xml"/>
                  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
                </Relationships>
                """;
    }

    private String stylesXml() {
        return """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
                  <fonts count="2">
                    <font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
                    <font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
                  </fonts>
                  <fills count="2">
                    <fill><patternFill patternType="none"/></fill>
                    <fill><patternFill patternType="gray125"/></fill>
                  </fills>
                  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
                  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
                  <cellXfs count="2">
                    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
                    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
                  </cellXfs>
                  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
                  <dxfs count="0"/>
                  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
                </styleSheet>
                """;
    }

    private String sheetXml(List<List<Object>> rows) {
        StringBuilder xml = new StringBuilder();
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>");
        xml.append("<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData>");
        for (int r = 0; r < rows.size(); r++) {
            int rowNo = r + 1;
            xml.append("<row r=\"").append(rowNo).append("\">");
            List<Object> row = rows.get(r);
            boolean headerRow = r == 0 || (!row.isEmpty() && "Cost Head".equals(String.valueOf(row.get(0))));
            for (int c = 0; c < row.size(); c++) {
                Object value = row.get(c);
                String ref = columnName(c + 1) + rowNo;
                String style = headerRow ? " s=\"1\"" : "";
                if (value instanceof Number) {
                    xml.append("<c r=\"").append(ref).append("\"").append(style).append("><v>")
                            .append(xmlEscape(String.valueOf(value))).append("</v></c>");
                } else {
                    xml.append("<c r=\"").append(ref).append("\"").append(style).append(" t=\"inlineStr\"><is><t xml:space=\"preserve\">")
                            .append(xmlEscape(String.valueOf(value == null ? "" : value)))
                            .append("</t></is></c>");
                }
            }
            xml.append("</row>");
        }
        xml.append("</sheetData></worksheet>");
        return xml.toString();
    }

    private String columnName(int index) {
        StringBuilder result = new StringBuilder();
        int value = index;
        while (value > 0) {
            int remainder = (value - 1) % 26;
            result.insert(0, (char) ('A' + remainder));
            value = (value - 1) / 26;
        }
        return result.toString();
    }

    private String xmlEscape(String value) {
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private ResponseStatusException notFound(String message) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
    }

    private ResponseStatusException conflict(String message) {
        return new ResponseStatusException(HttpStatus.CONFLICT, message);
    }

    private record RevisionContext(
            UUID revisionId,
            UUID productId,
            String productName,
            String productCode,
            String projectReference,
            String clientEntity,
            Integer revisionNo,
            String status) {
    }

    private record BomSection(
            String section,
            String category,
            BigDecimal quantity) {
    }

    private record LabourSectionScore(
            BomSection section,
            int score) {
    }

    private record MaterialBomRow(
            UUID id,
            String itemName,
            String category,
            String section,
            String brand,
            String vendorName,
            String unit,
            BigDecimal quantity,
            BigDecimal processingAmount) {
    }
}
