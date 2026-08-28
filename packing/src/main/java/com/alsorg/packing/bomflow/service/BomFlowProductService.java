package com.alsorg.packing.bomflow.service;

import com.alsorg.packing.bomflow.security.BomFlowAccessService;
import com.alsorg.packing.bomflow.dto.BomFlowProductDtos.ProductRequest;
import com.alsorg.packing.bomflow.dto.BomFlowProductDtos.ProductResponse;
import com.alsorg.packing.bomflow.dto.BomFlowRevisionDtos.CreateRevisionRequest;
import com.alsorg.packing.bomflow.dto.BomFlowRevisionDtos.RevisionSummaryResponse;
import com.alsorg.packing.bomflow.domain.BomFlowProduct;
import com.alsorg.packing.bomflow.domain.BomFlowProductStatus;
import com.alsorg.packing.bomflow.domain.BomFlowRevision;
import com.alsorg.packing.bomflow.domain.BomFlowRevisionStatus;
import com.alsorg.packing.bomflow.repository.BomFlowProductRepository;
import com.alsorg.packing.bomflow.repository.BomFlowRevisionRepository;
import com.alsorg.packing.bomflow.repository.BomFlowRevisionItemRepository;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class BomFlowProductService {

    private static final int MAX_PRODUCT_LIST_ROWS = 1000;

    private static final Set<BomFlowRevisionStatus> OPEN_STATUSES = Set.of(
            BomFlowRevisionStatus.DRAFT,
            BomFlowRevisionStatus.RETURNED);

    private final BomFlowProductRepository productRepository;
    private final BomFlowRevisionRepository revisionRepository;
    private final BomFlowRevisionItemRepository itemRepository;
    private final BomFlowAccessService access;
    private final BomFlowMapper mapper;
    private final JdbcTemplate jdbc;

    public BomFlowProductService(
            BomFlowProductRepository productRepository,
            BomFlowRevisionRepository revisionRepository,
            BomFlowRevisionItemRepository itemRepository,
            BomFlowAccessService access,
            BomFlowMapper mapper,
            JdbcTemplate jdbc) {
        this.productRepository = productRepository;
        this.revisionRepository = revisionRepository;
        this.itemRepository = itemRepository;
        this.access = access;
        this.mapper = mapper;
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public List<ProductResponse> list(String search) {
        access.requireBomFlowAccess();
        String query = clean(search);

        List<BomFlowProduct> products = productRepository
                .search(query, PageRequest.of(0, MAX_PRODUCT_LIST_ROWS));

        if (products.isEmpty()) {
            return List.of();
        }

        List<UUID> productIds = products.stream()
                .map(product -> product.id)
                .toList();

        Map<UUID, BomFlowRevision> latestByProduct = new LinkedHashMap<>();
        for (BomFlowRevision revision : revisionRepository.findLatestByProductIds(productIds)) {
            if (revision != null && revision.product != null && revision.product.id != null) {
                latestByProduct.merge(
                        revision.product.id,
                        revision,
                        (left, right) -> left.revisionNo >= right.revisionNo ? left : right);
            }
        }

        Map<UUID, Long> countsByProduct = new LinkedHashMap<>();
        revisionRepository.countByProductIds(productIds).forEach(row ->
                countsByProduct.put(row.getProductId(), row.getRevisionCount()));

        return products.stream()
                .map(product -> mapper.toProductResponse(
                        product,
                        latestByProduct.get(product.id),
                        countsByProduct.getOrDefault(product.id, 0L)))
                .toList();
    }

    @Transactional(readOnly = true)
    public ProductResponse get(UUID productId) {
        access.requireBomFlowAccess();
        return mapper.toProductResponse(requireProduct(productId));
    }

    public ProductResponse create(ProductRequest request) {
        access.requireEditor();
        validateProductRequest(request);

        String productCode = upper(request.productCode());
        if (productRepository.existsByProductCodeIgnoreCase(productCode)) {
            throw badRequest("Product code already exists: " + productCode);
        }

        String actor = access.currentUsername();
        LocalDateTime now = LocalDateTime.now();

        BomFlowProduct product = new BomFlowProduct();
        applyProductRequest(product, request);
        product.currentRevisionNo = 0;
        product.status = BomFlowProductStatus.DRAFT;
        product.createdBy = actor;
        product.createdAt = now;
        product.updatedBy = actor;
        product.updatedAt = now;

        product = productRepository.saveAndFlush(product);
        return mapper.toProductResponse(product);
    }

    public ProductResponse update(UUID productId, ProductRequest request) {
        access.requireEditor();
        validateProductRequest(request);
        if (productId == null) throw badRequest("Product ID is required.");

        BomFlowProduct product = productRepository.findByIdForUpdate(productId)
                .orElseThrow(() -> notFound("Product not found: " + productId));

        requireVersion(product.rowVersion, request.rowVersion(), "Product");

        String productCode = upper(request.productCode());
        if (productRepository.existsByProductCodeIgnoreCaseAndIdNot(productCode, product.id)) {
            throw badRequest("Product code already exists: " + productCode);
        }

        applyProductRequest(product, request);
        product.updatedBy = access.currentUsername();
        product.updatedAt = LocalDateTime.now();

        product = productRepository.saveAndFlush(product);
        return mapper.toProductResponse(product);
    }

    @Transactional(readOnly = true)
    public List<RevisionSummaryResponse> revisions(UUID productId) {
        access.requireBomFlowAccess();
        requireProduct(productId);

        List<BomFlowRevision> revisions = revisionRepository
                .findByProductIdOrderByRevisionNoDesc(productId);

        if (revisions.isEmpty()) {
            return List.of();
        }

        List<UUID> revisionIds = revisions.stream()
                .map(revision -> revision.id)
                .toList();

        Map<UUID, BomFlowRevisionItemRepository.RevisionItemAggregate> aggregates =
                new LinkedHashMap<>();
        itemRepository.aggregateByRevisionIds(revisionIds).forEach(row ->
                aggregates.put(row.getRevisionId(), row));

        return revisions.stream()
                .map(revision -> {
                    BomFlowRevisionItemRepository.RevisionItemAggregate aggregate =
                            aggregates.get(revision.id);
                    return mapper.toRevisionSummary(
                            revision,
                            aggregate == null ? 0L : aggregate.getItemCount(),
                            aggregate == null ? BigDecimal.ZERO : aggregate.getTotalAmount());
                })
                .toList();
    }

    public RevisionSummaryResponse createRevision(UUID productId, CreateRevisionRequest request) {
        access.requireEditor();
        if (productId == null) throw badRequest("Product ID is required.");

        BomFlowProduct product = productRepository.findByIdForUpdate(productId)
                .orElseThrow(() -> notFound("Product not found: " + productId));

        BomFlowRevision existingOpen = revisionRepository
                .findTopByProductIdAndStatusInOrderByRevisionNoDesc(productId, OPEN_STATUSES)
                .orElse(null);

        if (existingOpen != null) {
            return mapper.toRevisionSummary(existingOpen);
        }

        BomFlowRevision sourceRevision = revisionRepository
                .findTopByProductIdOrderByRevisionNoDesc(productId)
                .orElse(null);

        int nextRevisionNo = sourceRevision == null ? 1 : sourceRevision.revisionNo + 1;
        String actor = access.currentUsername();
        LocalDateTime now = LocalDateTime.now();

        BomFlowRevision revision = new BomFlowRevision();
        revision.product = product;
        revision.revisionNo = nextRevisionNo;
        revision.status = BomFlowRevisionStatus.DRAFT;
        revision.remarks = clean(request == null ? null : request.remarks());
        revision.createdBy = actor;
        revision.createdAt = now;
        revision.updatedBy = actor;
        revision.updatedAt = now;

        revision = revisionRepository.saveAndFlush(revision);

        if (sourceRevision != null) {
            cloneRevisionSnapshot(sourceRevision.id, revision.id, actor, now);
        }

        product.currentRevisionNo = nextRevisionNo;
        product.updatedBy = actor;
        product.updatedAt = now;
        productRepository.saveAndFlush(product);

        return mapper.toRevisionSummary(revision);
    }

    private void cloneRevisionSnapshot(
            UUID sourceRevisionId,
            UUID targetRevisionId,
            String actor,
            LocalDateTime now) {

        jdbc.update("""
                INSERT INTO bom_flow_items (
                    id, revision_id, line_no, section_name, category, sub_category,
                    inventory_item_id, item_code, item_name, item_description,
                    specification, grade, brand, vendor_name, finish, colour,
                    thickness, material_size, length_value, width_value, height_value,
                    base_qty, wastage_percent, required_qty, unit, unit_rate,
                    material_amount, processing_amount, total_amount, gst_percent,
                    store_issue_required, active, remarks,
                    rate_master_id, rate_applied_by, rate_applied_at,
                    created_by, created_at, updated_by, updated_at, row_version
                )
                SELECT
                    gen_random_uuid(), ?, line_no, section_name, category, sub_category,
                    inventory_item_id, item_code, item_name, item_description,
                    specification, grade, brand, vendor_name, finish, colour,
                    thickness, material_size, length_value, width_value, height_value,
                    base_qty, wastage_percent, required_qty, unit, unit_rate,
                    material_amount, processing_amount, total_amount, gst_percent,
                    store_issue_required, active, remarks,
                    rate_master_id, rate_applied_by, rate_applied_at,
                    ?, ?, ?, ?, 0
                FROM bom_flow_items
                WHERE revision_id = ?
                ORDER BY line_no
                """,
                targetRevisionId,
                actor,
                now,
                actor,
                now,
                sourceRevisionId);

        jdbc.update("""
                INSERT INTO bom_flow_revision_labour (
                    id, revision_id, labour_rate_id, department, process_code,
                    process_name, basis, unit, labour_count, working_hours, quantity,
                    rate, amount, remarks, created_by, created_at, updated_by,
                    updated_at, row_version
                )
                SELECT
                    gen_random_uuid(), ?, labour_rate_id, department, process_code,
                    process_name, basis, unit, labour_count, working_hours, quantity,
                    rate, amount, remarks, ?, ?, ?, ?, 0
                FROM bom_flow_revision_labour
                WHERE revision_id = ?
                ORDER BY created_at, process_name
                """,
                targetRevisionId,
                actor,
                now,
                actor,
                now,
                sourceRevisionId);

        jdbc.update("""
                INSERT INTO bom_flow_costing_settings (
                    id, revision_id, markup_percent, factory_fixed_overhead_percent,
                    factory_variable_overhead_percent, admin_overhead_percent,
                    selling_overhead_percent, profit_percent, franchise_percent,
                    gst_percent, round_off, created_by, created_at, updated_by,
                    updated_at, row_version
                )
                SELECT
                    gen_random_uuid(), ?, markup_percent, factory_fixed_overhead_percent,
                    factory_variable_overhead_percent, admin_overhead_percent,
                    selling_overhead_percent, profit_percent, franchise_percent,
                    gst_percent, round_off, ?, ?, ?, ?, 0
                FROM bom_flow_costing_settings
                WHERE revision_id = ?
                """,
                targetRevisionId,
                actor,
                now,
                actor,
                now,
                sourceRevisionId);

        jdbc.update("""
                INSERT INTO bom_flow_master_audit_logs (
                    id, entity_type, entity_id, revision_id, action,
                    old_value, new_value, changed_by, changed_at
                ) VALUES (?,?,?,?,?,?,?,?,?)
                """,
                UUID.randomUUID(),
                "REVISION",
                targetRevisionId,
                targetRevisionId,
                "REVISION_SNAPSHOT_CLONED",
                "sourceRevisionId=" + sourceRevisionId,
                "targetRevisionId=" + targetRevisionId,
                actor,
                now);
    }

    private void applyProductRequest(BomFlowProduct product, ProductRequest request) {
        product.productName = required(request.productName(), "Product name");
        product.productCode = upper(required(request.productCode(), "Product code"));
        product.drawingNumber = cleanLimited(request.drawingNumber(), 160, "Drawing number");
        product.category = cleanLimited(required(request.category(), "Product category"), 120, "Product category");
        product.collection = cleanLimited(request.collection(), 160, "Collection");
        product.length = positive(request.length(), "Length");
        product.width = positive(request.width(), "Width");
        product.height = positive(request.height(), "Height");
        product.projectReference = cleanLimited(request.projectReference(), 180, "Project reference");
        product.clientEntity = cleanLimited(request.clientEntity(), 240, "Client");
    }

    private void validateProductRequest(ProductRequest request) {
        if (request == null) throw badRequest("Product request body is required.");
        cleanLimited(required(request.productName(), "Product name"), 500, "Product name");
        cleanLimited(required(request.productCode(), "Product code"), 150, "Product code");
    }

    private BomFlowProduct requireProduct(UUID productId) {
        if (productId == null) throw badRequest("Product ID is required.");
        return productRepository.findById(productId)
                .orElseThrow(() -> notFound("Product not found: " + productId));
    }

    private BigDecimal positive(BigDecimal value, String field) {
        if (value == null || value.compareTo(BigDecimal.ZERO) <= 0) {
            throw badRequest(field + " must be greater than zero.");
        }
        return value;
    }

    private String required(String value, String field) {
        String cleaned = clean(value);
        if (cleaned == null) throw badRequest(field + " is required.");
        return cleaned;
    }

    private String cleanLimited(String value, int maxLength, String field) {
        String cleaned = clean(value);
        if (cleaned != null && cleaned.length() > maxLength) {
            throw badRequest(field + " is too long.");
        }
        return cleaned;
    }

    private String upper(String value) {
        String cleaned = clean(value);
        return cleaned == null ? null : cleaned.toUpperCase(Locale.ROOT);
    }

    private String clean(String value) {
        if (value == null) return null;
        String cleaned = value.trim();
        return cleaned.isEmpty() ? null : cleaned;
    }

    private void requireVersion(Long actual, Long supplied, String label) {
        if (supplied == null) throw badRequest(label + " rowVersion is required.");
        if (!Objects.equals(actual, supplied)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    label + " was changed by another user. Refresh and try again.");
        }
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private ResponseStatusException notFound(String message) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
    }
}
