package com.alsorg.packing.service;

import com.alsorg.packing.controller.dto.VenFlowDtos.*;
import com.alsorg.packing.domain.venflow.*;
import com.alsorg.packing.repository.VenFlowAuditLogRepository;
import com.alsorg.packing.repository.VenFlowEntryRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@Service
@Transactional
public class VenFlowService {

    private final VenFlowEntryRepository entryRepo;
    private final VenFlowAuditLogRepository auditRepo;

    public VenFlowService(
            VenFlowEntryRepository entryRepo,
            VenFlowAuditLogRepository auditRepo
    ) {
        this.entryRepo = entryRepo;
        this.auditRepo = auditRepo;
    }

    public VenFlowEntry create(CreateRequest req) {
        assertRole("ADMIN", "VENFLOW_PRODUCTION");

        require(req.orderDate(), "Order Date is required.");
        requireText(req.pdNo(), "PD No. is required.");
        requireText(req.clientName(), "Client Name is required.");

        VenFlowEntry e = new VenFlowEntry();
        e.orderDate = req.orderDate();
        e.pdNo = clean(req.pdNo());
        e.clientName = clean(req.clientName());
        e.stage = VenFlowStage.HEADER_CREATED;
        e.createdBy = actor();
        e.updatedBy = actor();

        VenFlowEntry saved = entryRepo.save(e);

        audit(saved.id, "CREATE_HEADER", null,
                "Order Date=" + saved.orderDate + ", PD No=" + saved.pdNo + ", Client=" + saved.clientName);

        return saved;
    }

    @Transactional(readOnly = true)
    public Page<VenFlowEntry> list(
            String search,
            String stage,
            String storeStatus,
            int page,
            int size
    ) {
        Pageable pageable = PageRequest.of(
                Math.max(page, 0),
                Math.min(Math.max(size, 1), 100),
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        Specification<VenFlowEntry> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (hasText(search)) {
                String q = "%" + search.trim().toLowerCase() + "%";

                predicates.add(
                        cb.or(
                                cb.like(cb.lower(root.get("pdNo")), q),
                                cb.like(cb.lower(root.get("clientName")), q),
                                cb.like(cb.lower(root.get("productDescription")), q),
                                cb.like(cb.lower(root.get("veneerType")), q)
                        )
                );
            }

            if (hasText(stage)) {
                predicates.add(cb.equal(root.get("stage"), VenFlowStage.valueOf(stage)));
            }

            if (hasText(storeStatus)) {
                predicates.add(cb.equal(root.get("storeStatus"), VenFlowStoreStatus.valueOf(storeStatus)));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return entryRepo.findAll(spec, pageable);
    }

    @Transactional(readOnly = true)
    public VenFlowEntry get(UUID id) {
        return getOrThrow(id);
    }

    public VenFlowEntry updateProductDetails(UUID id, ProductDetailsRequest req) {
        assertRole("ADMIN", "VENFLOW_PRODUCTION");

        VenFlowEntry e = getOrThrow(id);

        requireHeader(e);

        requireText(req.productDescription(), "Product Description is required.");
        requireText(req.veneerType(), "Veneer Type is required.");
        requireText(req.size(), "Size is required.");

        String oldValue =
                "Product=" + e.productDescription +
                ", Veneer=" + e.veneerType +
                ", Size=" + e.size;

        e.productDescription = clean(req.productDescription());
        e.veneerType = clean(req.veneerType());
        e.size = clean(req.size());
        e.stage = maxStage(e.stage, VenFlowStage.PRODUCT_DETAILS_FILLED);
        e.updatedBy = actor();

        VenFlowEntry saved = entryRepo.save(e);

        audit(id, "UPDATE_PRODUCT_DETAILS", oldValue,
                "Product=" + saved.productDescription +
                ", Veneer=" + saved.veneerType +
                ", Size=" + saved.size);

        return saved;
    }

    public VenFlowEntry updateStoreStatus(UUID id, StoreStatusRequest req) {
        assertRole("ADMIN", "VENFLOW_STORE");

        VenFlowEntry e = getOrThrow(id);

        requireProductDetails(e);
        require(req.storeStatus(), "Store Status is required.");

        String oldValue = String.valueOf(e.storeStatus);

        e.storeStatus = req.storeStatus();
        e.stage = maxStage(e.stage, VenFlowStage.STORE_STATUS_UPDATED);
        e.updatedBy = actor();

        VenFlowEntry saved = entryRepo.save(e);

        audit(id, "UPDATE_STORE_STATUS", oldValue, String.valueOf(saved.storeStatus));

        return saved;
    }

    public VenFlowEntry updateRequisition(UUID id, RequisitionRequest req) {
        assertRole("ADMIN", "VENFLOW_PURCHASE");

        VenFlowEntry e = getOrThrow(id);

        requireStoreStatus(e);

        requireText(req.requisitionSlipNo(), "Requisition Slip No. is required.");
        require(req.requisitionDate(), "Requisition Date is required.");

        String oldValue =
                "Slip=" + e.requisitionSlipNo +
                ", Date=" + e.requisitionDate;

        e.requisitionSlipNo = clean(req.requisitionSlipNo());
        e.requisitionDate = req.requisitionDate();
        e.stage = maxStage(e.stage, VenFlowStage.REQUISITION_UPDATED);
        e.updatedBy = actor();

        VenFlowEntry saved = entryRepo.save(e);

        audit(id, "UPDATE_REQUISITION", oldValue,
                "Slip=" + saved.requisitionSlipNo +
                ", Date=" + saved.requisitionDate);

        return saved;
    }

    public VenFlowEntry updateOrderedQty(UUID id, OrderedQtyRequest req) {
        assertRole("ADMIN", "VENFLOW_PURCHASE");

        VenFlowEntry e = getOrThrow(id);

        requireRequisition(e);

        require(req.orderedQty(), "Ordered Qty is required.");
        require(req.unit(), "Unit is required.");

        if (req.orderedQty().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Ordered Qty must be greater than zero.");
        }

        String oldValue =
                "Ordered=" + e.orderedQty +
                ", Unit=" + e.unit +
                ", Balance=" + e.balanceQty;

        e.orderedQty = req.orderedQty();
        e.unit = req.unit();
        e.balanceQty = calculateBalance(e.orderedQty, e.receivedQty);
        e.stage = maxStage(e.stage, VenFlowStage.ORDER_QTY_UPDATED);
        e.updatedBy = actor();

        VenFlowEntry saved = entryRepo.save(e);

        audit(id, "UPDATE_ORDERED_QTY", oldValue,
                "Ordered=" + saved.orderedQty +
                ", Unit=" + saved.unit +
                ", Balance=" + saved.balanceQty);

        return saved;
    }

    public VenFlowEntry updateExpectedDate(UUID id, ExpectedDateRequest req) {
        assertRole("ADMIN", "VENFLOW_PRODUCTION");

        VenFlowEntry e = getOrThrow(id);

        requireOrderedQty(e);
        require(req.expectedDate(), "Expected Date is required.");

        String oldValue = String.valueOf(e.expectedDate);

        e.expectedDate = req.expectedDate();
        e.stage = maxStage(e.stage, VenFlowStage.EXPECTED_DATE_UPDATED);
        e.updatedBy = actor();

        VenFlowEntry saved = entryRepo.save(e);

        audit(id, "UPDATE_EXPECTED_DATE", oldValue, String.valueOf(saved.expectedDate));

        return saved;
    }

    public VenFlowEntry updateReceivedQty(UUID id, ReceivedQtyRequest req) {
        assertRole("ADMIN", "VENFLOW_STORE");

        VenFlowEntry e = getOrThrow(id);

        requireExpectedDate(e);

        require(req.receivedQty(), "Received Qty is required.");

        if (req.receivedQty().compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Received Qty cannot be negative.");
        }

        String oldValue =
                "Received=" + e.receivedQty +
                ", Balance=" + e.balanceQty +
                ", Actual In-house=" + e.actualInHouseDate;

        e.receivedQty = req.receivedQty();
        e.actualInHouseDate = req.actualInHouseDate();
        e.balanceQty = calculateBalance(e.orderedQty, e.receivedQty);

        if (e.balanceQty != null && e.balanceQty.compareTo(BigDecimal.ZERO) <= 0) {
            e.stage = VenFlowStage.COMPLETED;
        } else {
            e.stage = maxStage(e.stage, VenFlowStage.RECEIVED_QTY_UPDATED);
        }

        e.updatedBy = actor();

        VenFlowEntry saved = entryRepo.save(e);

        audit(id, "UPDATE_RECEIVING", oldValue,
                "Received=" + saved.receivedQty +
                ", Balance=" + saved.balanceQty +
                ", Actual In-house=" + saved.actualInHouseDate);

        return saved;
    }

    public VenFlowEntry updateRemarks(UUID id, RemarksRequest req) {
        VenFlowEntry e = getOrThrow(id);

        String oldValue = e.remarks;

        e.remarks = req.remarks();
        e.updatedBy = actor();

        VenFlowEntry saved = entryRepo.save(e);

        audit(id, "UPDATE_REMARKS", oldValue, saved.remarks);

        return saved;
    }

    public VenFlowEntry complete(UUID id) {
        assertRole("ADMIN", "VENFLOW_STORE", "VENFLOW_PRODUCTION");

        VenFlowEntry e = getOrThrow(id);

        if (e.balanceQty == null || e.balanceQty.compareTo(BigDecimal.ZERO) > 0) {
            throw new IllegalArgumentException("Cannot complete entry while Balance Qty is pending.");
        }

        String oldValue = String.valueOf(e.stage);

        e.stage = VenFlowStage.COMPLETED;
        e.updatedBy = actor();

        VenFlowEntry saved = entryRepo.save(e);

        audit(id, "COMPLETE_ENTRY", oldValue, String.valueOf(saved.stage));

        return saved;
    }

    @Transactional(readOnly = true)
    public DashboardResponse dashboard() {
        List<VenFlowEntry> all = entryRepo.findAll();
        LocalDate today = LocalDate.now();

        long total = all.size();

        long pendingStoreCheck = all.stream()
                .filter(e -> e.storeStatus == null)
                .count();

        long pendingRequisition = all.stream()
                .filter(e -> e.storeStatus != null)
                .filter(e -> !hasText(e.requisitionSlipNo))
                .count();

        long pendingOrderQty = all.stream()
                .filter(e -> hasText(e.requisitionSlipNo))
                .filter(e -> e.orderedQty == null)
                .count();

        long pendingReceiving = all.stream()
                .filter(e -> e.orderedQty != null)
                .filter(e -> e.stage != VenFlowStage.COMPLETED)
                .count();

        long balancePending = all.stream()
                .filter(e -> e.balanceQty != null)
                .filter(e -> e.balanceQty.compareTo(BigDecimal.ZERO) > 0)
                .count();

        long delayedItems = all.stream()
                .filter(e -> e.expectedDate != null)
                .filter(e -> e.expectedDate.isBefore(today))
                .filter(e -> e.stage != VenFlowStage.COMPLETED)
                .count();

        long completed = all.stream()
                .filter(e -> e.stage == VenFlowStage.COMPLETED)
                .count();

        return new DashboardResponse(
                total,
                pendingStoreCheck,
                pendingRequisition,
                pendingOrderQty,
                pendingReceiving,
                balancePending,
                delayedItems,
                completed
        );
    }

    @Transactional(readOnly = true)
    public List<VenFlowAuditLog> auditLogs(UUID entryId) {
        return auditRepo.findByEntryIdOrderByChangedAtDesc(entryId);
    }

    private VenFlowEntry getOrThrow(UUID id) {
        return entryRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("VenFlow entry not found."));
    }

    private BigDecimal calculateBalance(BigDecimal orderedQty, BigDecimal receivedQty) {
        if (orderedQty == null) {
            return null;
        }

        BigDecimal received = receivedQty == null ? BigDecimal.ZERO : receivedQty;
        return orderedQty.subtract(received);
    }

    private void requireHeader(VenFlowEntry e) {
        require(e.orderDate, "Order Date must be entered first.");
        requireText(e.pdNo, "PD No. must be entered first.");
        requireText(e.clientName, "Client Name must be entered first.");
    }

    private void requireProductDetails(VenFlowEntry e) {
        requireHeader(e);
        requireText(e.productDescription, "Product Description must be entered first.");
        requireText(e.veneerType, "Veneer Type must be entered first.");
        requireText(e.size, "Size must be entered first.");
    }

    private void requireStoreStatus(VenFlowEntry e) {
        requireProductDetails(e);
        require(e.storeStatus, "Store Status must be entered first.");
    }

    private void requireRequisition(VenFlowEntry e) {
        requireStoreStatus(e);
        requireText(e.requisitionSlipNo, "Requisition Slip No. must be entered first.");
        require(e.requisitionDate, "Requisition Date must be entered first.");
    }

    private void requireOrderedQty(VenFlowEntry e) {
        requireRequisition(e);
        require(e.orderedQty, "Ordered Qty must be entered first.");
        require(e.unit, "Unit must be entered first.");
    }

    private void requireExpectedDate(VenFlowEntry e) {
        requireOrderedQty(e);
        require(e.expectedDate, "Expected Date must be entered first.");
    }

    private void require(Object value, String message) {
        if (value == null) {
            throw new IllegalArgumentException(message);
        }
    }

    private void requireText(String value, String message) {
        if (!hasText(value)) {
            throw new IllegalArgumentException(message);
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private String clean(String value) {
        return value == null ? null : value.trim();
    }

    private VenFlowStage maxStage(VenFlowStage current, VenFlowStage next) {
        if (current == null) {
            return next;
        }

        if (current == VenFlowStage.COMPLETED) {
            return current;
        }

        return current.ordinal() >= next.ordinal() ? current : next;
    }

    private void audit(UUID entryId, String action, Object oldValue, Object newValue) {
        VenFlowAuditLog log = new VenFlowAuditLog();
        log.entryId = entryId;
        log.action = action;
        log.oldValue = oldValue == null ? null : String.valueOf(oldValue);
        log.newValue = newValue == null ? null : String.valueOf(newValue);
        log.changedBy = actor();

        auditRepo.save(log);
    }

    private String actor() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (auth == null || auth.getName() == null) {
            return "SYSTEM";
        }

        return auth.getName();
    }

    private void assertRole(String... allowedRoles) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (auth == null) {
            return;
        }

        Set<String> roles = new HashSet<>();

        auth.getAuthorities().forEach(a -> {
            String role = a.getAuthority();

            if (role != null) {
                role = role.replace("ROLE_", "").trim().toUpperCase();
                roles.add(role);
            }
        });

        if (roles.isEmpty()) {
            return;
        }

        if (roles.contains("ADMIN")) {
            return;
        }

        for (String allowed : allowedRoles) {
            if (roles.contains(allowed.trim().toUpperCase())) {
                return;
            }
        }

        throw new SecurityException("You do not have permission to perform this VenFlow action.");
    }
}