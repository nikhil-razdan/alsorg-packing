package com.alsorg.packing.service.matflow;

import com.alsorg.packing.domain.matflow.MatFlowAuditLog;
import com.alsorg.packing.domain.matflow.MatFlowGoodsReceipt;
import com.alsorg.packing.domain.matflow.MatFlowIndent;
import com.alsorg.packing.domain.matflow.MatFlowMaterialRequisition;
import com.alsorg.packing.domain.matflow.MatFlowPurchaseOrder;
import com.alsorg.packing.domain.matflow.MatFlowStockLedger;
import com.alsorg.packing.repository.matflow.MatFlowAuditLogRepository;
import com.alsorg.packing.repository.matflow.MatFlowGoodsReceiptRepository;
import com.alsorg.packing.repository.matflow.MatFlowIndentRepository;
import com.alsorg.packing.repository.matflow.MatFlowMaterialRequisitionRepository;
import com.alsorg.packing.repository.matflow.MatFlowPurchaseOrderRepository;
import com.alsorg.packing.repository.matflow.MatFlowStockLedgerRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.OptionalLong;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.function.Function;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * One-time/idempotent compatibility migration for historical MatFlow document
 * numbers.
 *
 * Existing records created under legacy formats such as MFR-..., MFI-...,
 * random PO values or GRN-... are converted to the same canonical nomenclature
 * used for all new records:
 *
 * <pre>
 * MR/yyyy/MM/dd/n
 * PI/yyyy/MM/dd/n
 * PO/yyyy/MM/dd/n
 * GRN/yyyy/MM/dd/n
 * </pre>
 *
 * Important migration properties:
 * - idempotent: once canonical, a record is left unchanged on later startups;
 * - stable: already-valid canonical numbers are preserved;
 * - deterministic: legacy rows are ordered by original creation timestamp +
 * UUID;
 * - collision-safe: changed rows receive short temporary unique values first,
 * then their final canonical values, so existing UNIQUE constraints cannot
 * collide during swaps;
 * - traceable: every changed document gets a SYSTEM audit row containing its
 * legacy and canonical number;
 * - ledger-consistent: historical stock-ledger referenceNumber values are
 * rewritten when they exactly match a migrated MR/PI/PO/GRN number.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 100)
public class MatFlowDocumentNumberMigrationService implements ApplicationRunner {

    private static final Logger LOG = LoggerFactory.getLogger(MatFlowDocumentNumberMigrationService.class);
    private static final String SYSTEM_ACTOR = "SYSTEM_DOCNO_MIGRATION";
    private static final String MIGRATION_LOCK = "MATFLOW:DOCNO:LEGACY:NORMALIZATION:V1";

    private final JdbcTemplate jdbc;
    private final MatFlowMaterialRequisitionRepository requisitionRepository;
    private final MatFlowIndentRepository indentRepository;
    private final MatFlowPurchaseOrderRepository purchaseOrderRepository;
    private final MatFlowGoodsReceiptRepository receiptRepository;
    private final MatFlowStockLedgerRepository ledgerRepository;
    private final MatFlowAuditLogRepository auditRepository;
    private final ObjectMapper objectMapper;

    public MatFlowDocumentNumberMigrationService(
            JdbcTemplate jdbc,
            MatFlowMaterialRequisitionRepository requisitionRepository,
            MatFlowIndentRepository indentRepository,
            MatFlowPurchaseOrderRepository purchaseOrderRepository,
            MatFlowGoodsReceiptRepository receiptRepository,
            MatFlowStockLedgerRepository ledgerRepository,
            MatFlowAuditLogRepository auditRepository,
            ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.requisitionRepository = requisitionRepository;
        this.indentRepository = indentRepository;
        this.purchaseOrderRepository = purchaseOrderRepository;
        this.receiptRepository = receiptRepository;
        this.ledgerRepository = ledgerRepository;
        this.auditRepository = auditRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        acquireMigrationLock();

        List<MigrationAudit> auditRows = new ArrayList<>();
        Map<String, String> renamedNumbers = new LinkedHashMap<>();

        MigrationResult mr = migrate(
                "MR",
                "MATERIAL_REQUISITION",
                requisitionRepository.findAll(),
                MatFlowMaterialRequisition::getId,
                row -> row.requisitionNumber,
                (row, value) -> row.requisitionNumber = value,
                row -> businessDate(row.getCreatedAt(), row.requestedAt),
                row -> firstNonNull(row.getCreatedAt(), row.requestedAt),
                rows -> requisitionRepository.saveAll(rows),
                requisitionRepository::flush);
        collect(mr, renamedNumbers, auditRows);

        MigrationResult pi = migrate(
                "PI",
                "PURCHASE_INDENT",
                indentRepository.findAll(),
                MatFlowIndent::getId,
                row -> row.indentNumber,
                (row, value) -> row.indentNumber = value,
                row -> businessDate(row.getCreatedAt(), null),
                MatFlowIndent::getCreatedAt,
                rows -> indentRepository.saveAll(rows),
                indentRepository::flush);
        collect(pi, renamedNumbers, auditRows);

        MigrationResult po = migrate(
                "PO",
                "PURCHASE_ORDER",
                purchaseOrderRepository.findAll(),
                MatFlowPurchaseOrder::getId,
                row -> row.poNumber,
                (row, value) -> row.poNumber = value,
                row -> businessDate(row.getCreatedAt(), null),
                MatFlowPurchaseOrder::getCreatedAt,
                rows -> purchaseOrderRepository.saveAll(rows),
                purchaseOrderRepository::flush);
        collect(po, renamedNumbers, auditRows);

        MigrationResult grn = migrate(
                "GRN",
                "GOODS_RECEIPT",
                receiptRepository.findAll(),
                MatFlowGoodsReceipt::getId,
                row -> row.grnNumber,
                (row, value) -> row.grnNumber = value,
                row -> businessDate(row.getCreatedAt(), row.receivedAt),
                row -> firstNonNull(row.getCreatedAt(), row.receivedAt),
                rows -> receiptRepository.saveAll(rows),
                receiptRepository::flush);
        collect(grn, renamedNumbers, auditRows);

        int ledgerUpdates = synchronizeLedgerReferenceNumbers(renamedNumbers);
        persistMigrationAudit(auditRows);

        int changed = mr.changedCount() + pi.changedCount() + po.changedCount() + grn.changedCount();
        if (changed > 0 || ledgerUpdates > 0) {
            LOG.info(
                    "MatFlow document-number migration completed: MR={}, PI={}, PO={}, GRN={}, ledgerRefs={}",
                    mr.changedCount(), pi.changedCount(), po.changedCount(), grn.changedCount(), ledgerUpdates);
        } else {
            LOG.debug("MatFlow document-number migration: all MR/PI/PO/GRN numbers already canonical");
        }
    }

    private void acquireMigrationLock() {
        jdbc.query(
                "select pg_advisory_xact_lock(hashtext(?))",
                ps -> ps.setString(1, MIGRATION_LOCK),
                rs -> null);
    }

    private <T> MigrationResult migrate(
            String prefix,
            String entityType,
            List<T> inputRows,
            Function<T, UUID> idGetter,
            Function<T, String> numberGetter,
            BiConsumer<T, String> numberSetter,
            Function<T, LocalDate> dateGetter,
            Function<T, LocalDateTime> orderTimeGetter,
            Consumer<List<T>> saveAll,
            Runnable flush) {

        List<T> rows = new ArrayList<>(inputRows == null ? List.of() : inputRows);
        rows.sort((left, right) -> {
            int dateCompare = dateGetter.apply(left).compareTo(dateGetter.apply(right));
            if (dateCompare != 0)
                return dateCompare;

            LocalDateTime leftTime = orderTimeGetter.apply(left);
            LocalDateTime rightTime = orderTimeGetter.apply(right);
            int timeCompare = Comparator.nullsLast(LocalDateTime::compareTo).compare(leftTime, rightTime);
            if (timeCompare != 0)
                return timeCompare;

            String leftId = idGetter.apply(left) == null ? "" : idGetter.apply(left).toString();
            String rightId = idGetter.apply(right) == null ? "" : idGetter.apply(right).toString();
            return leftId.compareTo(rightId);
        });

        Map<LocalDate, Set<Long>> usedSerials = new HashMap<>();
        Set<UUID> preservedCanonicalIds = new HashSet<>();

        /* Preserve each already-valid canonical number whenever it is unique. */
        for (T row : rows) {
            UUID id = idGetter.apply(row);
            LocalDate date = dateGetter.apply(row);
            OptionalLong serial = MatFlowDocumentNumberService.canonicalSerial(prefix, date, numberGetter.apply(row));
            if (serial.isEmpty())
                continue;

            Set<Long> used = usedSerials.computeIfAbsent(date, ignored -> new HashSet<>());
            if (used.add(serial.getAsLong()) && id != null) {
                preservedCanonicalIds.add(id);
            }
        }

        List<Assignment<T>> assignments = new ArrayList<>();
        Map<LocalDate, Long> candidateByDate = new HashMap<>();

        for (T row : rows) {
            UUID id = idGetter.apply(row);
            LocalDate date = dateGetter.apply(row);
            String current = clean(numberGetter.apply(row));

            if (id != null && preservedCanonicalIds.contains(id)) {
                continue;
            }

            Set<Long> used = usedSerials.computeIfAbsent(date, ignored -> new HashSet<>());
            long candidate = candidateByDate.getOrDefault(date, 1L);
            while (used.contains(candidate)) {
                candidate++;
            }
            used.add(candidate);
            candidateByDate.put(date, candidate + 1L);

            String target = MatFlowDocumentNumberService.canonicalNumber(prefix, date, candidate);
            if (!Objects.equals(current, target)) {
                assignments.add(new Assignment<>(row, id, entityType, prefix, current, target));
            }
        }

        if (assignments.isEmpty()) {
            return new MigrationResult(List.of());
        }

        /*
         * Phase 1: free all legacy/incorrect values. This makes the migration safe
         * even if an old row currently owns the final number another row needs.
         */
        for (Assignment<T> assignment : assignments) {
            numberSetter.accept(assignment.row(), temporaryNumber(prefix, assignment.id()));
        }
        saveAll.accept(assignments.stream().map(Assignment::row).toList());
        flush.run();

        /* Phase 2: apply final canonical values. */
        for (Assignment<T> assignment : assignments) {
            numberSetter.accept(assignment.row(), assignment.newNumber());
        }
        saveAll.accept(assignments.stream().map(Assignment::row).toList());
        flush.run();

        List<MigrationAudit> audits = assignments.stream()
                .map(assignment -> new MigrationAudit(
                        assignment.entityType(),
                        assignment.id(),
                        assignment.prefix(),
                        assignment.oldNumber(),
                        assignment.newNumber()))
                .toList();

        return new MigrationResult(audits);
    }

    private int synchronizeLedgerReferenceNumbers(Map<String, String> renames) {
        if (renames.isEmpty())
            return 0;

        List<MatFlowStockLedger> changed = new ArrayList<>();
        for (MatFlowStockLedger ledger : ledgerRepository.findAll()) {
            if (ledger == null)
                continue;
            String current = clean(ledger.referenceNumber);
            if (current == null)
                continue;
            String canonical = renames.get(current);
            if (canonical == null || canonical.equals(current))
                continue;

            ledger.referenceNumber = canonical;
            changed.add(ledger);
        }

        if (!changed.isEmpty()) {
            ledgerRepository.saveAll(changed);
            ledgerRepository.flush();
        }
        return changed.size();
    }

    private void persistMigrationAudit(List<MigrationAudit> migrations) {
        if (migrations.isEmpty())
            return;

        LocalDateTime now = LocalDateTime.now();
        List<MatFlowAuditLog> rows = new ArrayList<>();

        for (MigrationAudit migration : migrations) {
            if (migration.entityId() == null)
                continue;

            MatFlowAuditLog audit = new MatFlowAuditLog();
            audit.setEntityType(migration.entityType());
            audit.setEntityId(migration.entityId());
            audit.setAction("DOCUMENT_NUMBER_MIGRATED");
            audit.setDetailsJson(json(Map.of(
                    "documentType", migration.prefix(),
                    "legacyNumber", migration.oldNumber() == null ? "" : migration.oldNumber(),
                    "canonicalNumber", migration.newNumber())));
            audit.setActor(SYSTEM_ACTOR);
            audit.setActionAt(now);
            audit.setCreatedBy(SYSTEM_ACTOR);
            audit.setUpdatedBy(SYSTEM_ACTOR);
            rows.add(audit);
        }

        if (!rows.isEmpty()) {
            auditRepository.saveAll(rows);
            auditRepository.flush();
        }
    }

    private void collect(
            MigrationResult result,
            Map<String, String> renamedNumbers,
            List<MigrationAudit> auditRows) {
        auditRows.addAll(result.audits());
        for (MigrationAudit migration : result.audits()) {
            String oldNumber = clean(migration.oldNumber());
            if (oldNumber != null) {
                renamedNumbers.put(oldNumber, migration.newNumber());
            }
        }
    }

    private LocalDate businessDate(LocalDateTime createdAt, LocalDateTime fallbackTime) {
        LocalDateTime value = firstNonNull(createdAt, fallbackTime);
        return value == null ? MatFlowDocumentNumberService.currentBusinessDate() : value.toLocalDate();
    }

    private LocalDateTime firstNonNull(LocalDateTime first, LocalDateTime second) {
        return first != null ? first : second;
    }

    private String temporaryNumber(String prefix, UUID id) {
        String token = id == null
                ? UUID.randomUUID().toString().replace("-", "")
                : id.toString().replace("-", "");
        token = token.substring(0, Math.min(12, token.length())).toUpperCase(Locale.ROOT);
        return "TMP" + prefix.toUpperCase(Locale.ROOT) + "/" + token;
    }

    private String clean(String value) {
        if (value == null)
            return null;
        String result = value.trim();
        return result.isBlank() ? null : result;
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            return "{\"documentNumberMigration\":true}";
        }
    }

    private record Assignment<T>(
            T row,
            UUID id,
            String entityType,
            String prefix,
            String oldNumber,
            String newNumber) {
    }

    private record MigrationAudit(
            String entityType,
            UUID entityId,
            String prefix,
            String oldNumber,
            String newNumber) {
    }

    private record MigrationResult(List<MigrationAudit> audits) {
        int changedCount() {
            return audits == null ? 0 : audits.size();
        }
    }
}
