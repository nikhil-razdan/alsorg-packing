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
import java.util.function.Supplier;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Transaction-safe human document numbering for MatFlow.
 *
 * MR/2026/08/13/1
 * PI/2026/08/13/1
 * PO/2026/08/13/1
 * GRN/2026/08/13/1
 *
 * Repository reads avoid coupling this service to physical table names. A
 * PostgreSQL transaction advisory lock serializes callers for the same
 * document type/business date before the next serial is calculated.
 */
@Service
public class MatFlowDocumentNumberService {

    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Kolkata");
    private static final DateTimeFormatter DATE_PATH =
            DateTimeFormatter.ofPattern("yyyy/MM/dd", Locale.ROOT);

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
                .map(row -> row.requisitionNumber).toList());
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public String nextPi() {
        return next("PI", () -> indentRepository.findAll().stream()
                .map(row -> row.indentNumber).toList());
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public String nextPo() {
        return next("PO", () -> purchaseOrderRepository.findAll().stream()
                .map(row -> row.poNumber).toList());
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public String nextGrn() {
        return next("GRN", () -> receiptRepository.findAll().stream()
                .map(row -> row.grnNumber).toList());
    }

    private String next(String prefix, Supplier<List<String>> existingNumbers) {
        LocalDate businessDate = LocalDate.now(BUSINESS_ZONE);
        String root = prefix + "/" + DATE_PATH.format(businessDate) + "/";
        String lockKey = "MATFLOW:DOCNO:" + root;

        jdbc.query(
                "select pg_advisory_xact_lock(hashtext(?))",
                ps -> ps.setString(1, lockKey),
                rs -> null);

        long max = existingNumbers.get().stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(value -> value.startsWith(root))
                .map(value -> value.substring(root.length()))
                .mapToLong(this::serialOrZero)
                .max()
                .orElse(0L);

        return root + (max + 1L);
    }

    private long serialOrZero(String value) {
        try {
            long serial = Long.parseLong(value);
            return serial > 0 ? serial : 0L;
        } catch (NumberFormatException ignored) {
            return 0L;
        }
    }
}
