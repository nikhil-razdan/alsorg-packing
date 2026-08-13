package com.alsorg.packing.service.matflow;

import com.alsorg.packing.repository.matflow.MatFlowGoodsReceiptRepository;
import com.alsorg.packing.repository.matflow.MatFlowIndentRepository;
import com.alsorg.packing.repository.matflow.MatFlowMaterialRequisitionRepository;
import com.alsorg.packing.repository.matflow.MatFlowPurchaseOrderRepository;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.OptionalLong;
import java.util.function.Supplier;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Transaction-safe canonical human document numbering for MatFlow.
 *
 * <pre>
 * MR/2026/08/13/1
 * PI/2026/08/13/1
 * PO/2026/08/13/1
 * GRN/2026/08/13/1
 * BOM/2026/08/13/F-65/09-03
 * </pre>
 *
 * The number belongs to the business date on which the document is generated.
 * A PostgreSQL transaction advisory lock serializes callers for the same
 * document type + business date so two concurrent requests cannot receive the
 * same serial.
 *
 * Legacy records are normalized by
 * {@link MatFlowDocumentNumberMigrationService}
 * at application startup. This service is therefore responsible only for new
 * numbers and for the shared canonical parsing/formatting rules.
 */
@Service
public class MatFlowDocumentNumberService {

    static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Kolkata");
    static final DateTimeFormatter DATE_PATH = DateTimeFormatter.ofPattern("yyyy/MM/dd", Locale.ROOT);

    private final JdbcTemplate jdbc;
    private final MatFlowMaterialRequisitionRepository requisitionRepository;
    private final MatFlowIndentRepository indentRepository;
    private final MatFlowPurchaseOrderRepository purchaseOrderRepository;
    private final MatFlowGoodsReceiptRepository receiptRepository;

    public MatFlowDocumentNumberService(
            JdbcTemplate jdbc,
            MatFlowMaterialRequisitionRepository requisitionRepository,
            MatFlowIndentRepository indentRepository,
            MatFlowPurchaseOrderRepository purchaseOrderRepository,
            MatFlowGoodsReceiptRepository receiptRepository) {
        this.jdbc = jdbc;
        this.requisitionRepository = requisitionRepository;
        this.indentRepository = indentRepository;
        this.purchaseOrderRepository = purchaseOrderRepository;
        this.receiptRepository = receiptRepository;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public String nextMr() {
        return next("MR", () -> requisitionRepository.findAll().stream()
                .map(row -> row.requisitionNumber)
                .toList());
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public String nextPi() {
        return next("PI", () -> indentRepository.findAll().stream()
                .map(row -> row.indentNumber)
                .toList());
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public String nextPo() {
        return next("PO", () -> purchaseOrderRepository.findAll().stream()
                .map(row -> row.poNumber)
                .toList());
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public String nextGrn() {
        return next("GRN", () -> receiptRepository.findAll().stream()
                .map(row -> row.grnNumber)
                .toList());
    }

    /**
     * Canonical Product BOM number. The existing database/API field named
     * projectCode is the MatFlow compatibility field for the business PD No.
     *
     * Example: PD F-65 + drawing 09/03 => BOM/2026/08/13/F-65/09-03.
     * BOM revisions intentionally retain the same BOM number; revisionNo is the
     * separate revision identity.
     */
    public String nextBom(String pdNo, String drawingNo) {
        return canonicalBomNumber(currentBusinessDate(), pdNo, drawingNo);
    }

    static String canonicalBomNumber(LocalDate businessDate, String pdNo, String drawingNo) {
        if (businessDate == null) {
            throw new IllegalArgumentException("Business date is required");
        }

        String pd = canonicalBomSegment(pdNo, "PD No.");
        String drawing = canonicalBomSegment(drawingNo, "Drawing number");

        return "BOM/" + DATE_PATH.format(businessDate) + "/" + pd + "/" + drawing;
    }

    static boolean isCanonicalBom(LocalDate businessDate, String pdNo, String drawingNo, String value) {
        if (value == null) {
            return false;
        }
        return canonicalBomNumber(businessDate, pdNo, drawingNo).equals(value.trim());
    }

    private static String canonicalBomSegment(String value, String label) {
        if (value == null || value.trim().isBlank()) {
            throw new IllegalArgumentException(label + " is required for BOM numbering");
        }

        String normalized = value.trim().toUpperCase(Locale.ROOT)
                .replace('\\', '-')
                .replace('/', '-')
                .replaceAll("\\s+", "-")
                .replaceAll("[^A-Z0-9._-]+", "-")
                .replaceAll("-+", "-")
                .replaceAll("^[.-]+|[.-]+$", "");

        if (normalized.isBlank()) {
            throw new IllegalArgumentException(label + " has no usable characters for BOM numbering");
        }
        return normalized;
    }

    private String next(String prefix, Supplier<List<String>> existingNumbers) {
        LocalDate businessDate = currentBusinessDate();
        String normalizedPrefix = normalizePrefix(prefix);
        String root = numberRoot(normalizedPrefix, businessDate);
        String lockKey = "MATFLOW:DOCNO:" + root;

        jdbc.query(
                "select pg_advisory_xact_lock(hashtext(?))",
                ps -> ps.setString(1, lockKey),
                rs -> null);

        long max = existingNumbers.get().stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .map(value -> canonicalSerial(normalizedPrefix, businessDate, value))
                .filter(OptionalLong::isPresent)
                .mapToLong(OptionalLong::getAsLong)
                .max()
                .orElse(0L);

        return canonicalNumber(normalizedPrefix, businessDate, max + 1L);
    }

    static LocalDate currentBusinessDate() {
        return LocalDate.now(BUSINESS_ZONE);
    }

    static String canonicalNumber(String prefix, LocalDate businessDate, long serial) {
        String normalizedPrefix = normalizePrefix(prefix);
        if (businessDate == null) {
            throw new IllegalArgumentException("Business date is required");
        }
        if (serial <= 0) {
            throw new IllegalArgumentException("Document serial must be greater than zero");
        }
        return numberRoot(normalizedPrefix, businessDate) + serial;
    }

    static OptionalLong canonicalSerial(String prefix, LocalDate businessDate, String value) {
        if (value == null || businessDate == null) {
            return OptionalLong.empty();
        }

        String root = numberRoot(normalizePrefix(prefix), businessDate);
        String trimmed = value.trim();
        if (!trimmed.startsWith(root)) {
            return OptionalLong.empty();
        }

        String suffix = trimmed.substring(root.length());
        if (suffix.isBlank() || !suffix.chars().allMatch(Character::isDigit)) {
            return OptionalLong.empty();
        }

        try {
            long serial = Long.parseLong(suffix);
            return serial > 0 ? OptionalLong.of(serial) : OptionalLong.empty();
        } catch (NumberFormatException ignored) {
            return OptionalLong.empty();
        }
    }

    static boolean isCanonical(String prefix, LocalDate businessDate, String value) {
        return canonicalSerial(prefix, businessDate, value).isPresent();
    }

    private static String numberRoot(String prefix, LocalDate businessDate) {
        return prefix + "/" + DATE_PATH.format(businessDate) + "/";
    }

    private static String normalizePrefix(String prefix) {
        if (prefix == null || prefix.trim().isBlank()) {
            throw new IllegalArgumentException("Document prefix is required");
        }
        return prefix.trim().toUpperCase(Locale.ROOT);
    }
}
