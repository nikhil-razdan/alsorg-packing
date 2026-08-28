package com.alsorg.packing.bomflow.service;

import com.alsorg.packing.bomflow.security.BomFlowAccessService;
import com.alsorg.packing.bomflow.dto.BomFlowRevisionDtos.DeleteLineRequest;
import com.alsorg.packing.bomflow.dto.BomFlowRevisionDtos.RevisionActionRequest;
import com.alsorg.packing.bomflow.dto.BomFlowRevisionDtos.RevisionDetailResponse;
import com.alsorg.packing.bomflow.dto.BomFlowRevisionDtos.RevisionLineRequest;
import com.alsorg.packing.bomflow.domain.BomFlowProduct;
import com.alsorg.packing.bomflow.domain.BomFlowProductStatus;
import com.alsorg.packing.bomflow.domain.BomFlowRevision;
import com.alsorg.packing.bomflow.domain.BomFlowRevisionItem;
import com.alsorg.packing.bomflow.domain.BomFlowRevisionStatus;
import com.alsorg.packing.bomflow.repository.BomFlowProductRepository;
import com.alsorg.packing.bomflow.repository.BomFlowRevisionItemRepository;
import com.alsorg.packing.bomflow.repository.BomFlowRevisionRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

@Service
@Transactional
public class BomFlowRevisionService {

    private final BomFlowRevisionRepository revisionRepository;
    private final BomFlowRevisionItemRepository itemRepository;
    private final BomFlowProductRepository productRepository;
    private final BomFlowAccessService access;
    private final BomFlowMapper mapper;

    public BomFlowRevisionService(
            BomFlowRevisionRepository revisionRepository,
            BomFlowRevisionItemRepository itemRepository,
            BomFlowProductRepository productRepository,
            BomFlowAccessService access,
            BomFlowMapper mapper) {
        this.revisionRepository = revisionRepository;
        this.itemRepository = itemRepository;
        this.productRepository = productRepository;
        this.access = access;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public RevisionDetailResponse get(UUID revisionId) {
        access.requireBomFlowAccess();
        return mapper.toRevisionDetail(requireRevisionWithProduct(revisionId));
    }

    public RevisionDetailResponse addLine(UUID revisionId, RevisionLineRequest request) {
        access.requireEditor();
        BomFlowRevision revision = requireRevisionForUpdate(revisionId);
        requireEditable(revision);
        validateLineRequest(request);

        int nextLineNo = itemRepository.findTopByRevisionIdOrderByLineNoDesc(revision.id)
                .map(item -> item.lineNo + 1)
                .orElse(1);

        String actor = access.currentUsername();
        LocalDateTime now = LocalDateTime.now();

        BomFlowRevisionItem item = new BomFlowRevisionItem();
        item.revision = revision;
        item.lineNo = nextLineNo;
        applyLineRequest(item, request);
        item.createdBy = actor;
        item.createdAt = now;
        item.updatedBy = actor;
        item.updatedAt = now;

        itemRepository.saveAndFlush(item);
        revision.updatedBy = actor;
        revision.updatedAt = now;
        revisionRepository.saveAndFlush(revision);
        return mapper.toRevisionDetail(revision);
    }

    public RevisionDetailResponse updateLine(UUID revisionId, UUID itemId, RevisionLineRequest request) {
        access.requireEditor();
        BomFlowRevision revision = requireRevisionForUpdate(revisionId);
        requireEditable(revision);
        validateLineRequest(request);
        if (itemId == null) throw badRequest("BOM row ID is required.");

        BomFlowRevisionItem item = itemRepository.findByIdAndRevisionId(itemId, revisionId)
                .orElseThrow(() -> notFound("BOM row not found: " + itemId));

        requireVersion(item.rowVersion, request.rowVersion(), "BOM row");
        applyLineRequest(item, request);

        item.updatedBy = access.currentUsername();
        item.updatedAt = LocalDateTime.now();
        itemRepository.saveAndFlush(item);

        revision.updatedBy = item.updatedBy;
        revision.updatedAt = item.updatedAt;
        revisionRepository.saveAndFlush(revision);
        return mapper.toRevisionDetail(revision);
    }

    public RevisionDetailResponse deleteLine(UUID revisionId, UUID itemId, DeleteLineRequest request) {
        access.requireEditor();
        BomFlowRevision revision = requireRevisionForUpdate(revisionId);
        requireEditable(revision);
        if (itemId == null) throw badRequest("BOM row ID is required.");

        BomFlowRevisionItem item = itemRepository.findByIdAndRevisionId(itemId, revisionId)
                .orElseThrow(() -> notFound("BOM row not found: " + itemId));

        requireVersion(item.rowVersion, request == null ? null : request.rowVersion(), "BOM row");
        itemRepository.delete(item);
        itemRepository.flush();

        revision.updatedBy = access.currentUsername();
        revision.updatedAt = LocalDateTime.now();
        revisionRepository.saveAndFlush(revision);
        return mapper.toRevisionDetail(revision);
    }

    public RevisionDetailResponse submit(UUID revisionId, RevisionActionRequest request) {
        access.requireEditor();
        BomFlowRevision revision = requireRevisionForUpdate(revisionId);
        requireVersion(revision.rowVersion, version(request), "BOM revision");

        if (!(revision.status == BomFlowRevisionStatus.DRAFT || revision.status == BomFlowRevisionStatus.RETURNED)) {
            throw badRequest("Only Draft or Returned revisions can be submitted.");
        }

        List<BomFlowRevisionItem> items = itemRepository.findByRevisionIdOrderByLineNoAsc(revisionId);
        if (items.isEmpty()) throw badRequest("Add at least one BOM row before submission.");

        for (BomFlowRevisionItem item : items) {
            if (zero(item.requiredQty).compareTo(BigDecimal.ZERO) <= 0) {
                throw badRequest("Every BOM row must have quantity greater than zero.");
            }
            if (zero(item.rate).compareTo(BigDecimal.ZERO) <= 0) {
                throw badRequest("Complete all missing material rates before submission.");
            }
        }

        String actor = access.currentUsername();
        LocalDateTime now = LocalDateTime.now();
        revision.status = BomFlowRevisionStatus.SUBMITTED;
        revision.remarks = firstNonBlank(request == null ? null : request.remarks(), revision.remarks);
        revision.submittedBy = actor;
        revision.submittedAt = now;
        revision.verifiedBy = null;
        revision.verifiedAt = null;
        revision.approvedBy = null;
        revision.approvedAt = null;
        revision.returnedBy = null;
        revision.returnedAt = null;
        revision.returnRemarks = null;
        revision.updatedBy = actor;
        revision.updatedAt = now;

        revision = revisionRepository.saveAndFlush(revision);
        return mapper.toRevisionDetail(revision);
    }

    public RevisionDetailResponse verify(UUID revisionId, RevisionActionRequest request) {
        access.requireReviewer();
        BomFlowRevision revision = requireRevisionForUpdate(revisionId);
        requireVersion(revision.rowVersion, version(request), "BOM revision");

        if (revision.status != BomFlowRevisionStatus.SUBMITTED) {
            throw badRequest("Only Submitted revisions can be verified.");
        }

        String actor = access.currentUsername();
        LocalDateTime now = LocalDateTime.now();
        revision.status = BomFlowRevisionStatus.VERIFIED;
        revision.remarks = firstNonBlank(request == null ? null : request.remarks(), revision.remarks);
        revision.verifiedBy = actor;
        revision.verifiedAt = now;
        revision.updatedBy = actor;
        revision.updatedAt = now;

        revision = revisionRepository.saveAndFlush(revision);
        return mapper.toRevisionDetail(revision);
    }

    public RevisionDetailResponse returnForCorrection(UUID revisionId, RevisionActionRequest request) {
        access.requireReviewer();
        BomFlowRevision revision = requireRevisionForUpdate(revisionId);
        requireVersion(revision.rowVersion, version(request), "BOM revision");

        if (!(revision.status == BomFlowRevisionStatus.SUBMITTED || revision.status == BomFlowRevisionStatus.VERIFIED)) {
            throw badRequest("Only Submitted or Verified revisions can be returned.");
        }

        String remarks = clean(request == null ? null : request.remarks());
        if (remarks == null) throw badRequest("Return remarks are required.");

        String actor = access.currentUsername();
        LocalDateTime now = LocalDateTime.now();
        revision.status = BomFlowRevisionStatus.RETURNED;
        revision.returnedBy = actor;
        revision.returnedAt = now;
        revision.returnRemarks = remarks;
        revision.updatedBy = actor;
        revision.updatedAt = now;

        revision = revisionRepository.saveAndFlush(revision);
        return mapper.toRevisionDetail(revision);
    }

    public RevisionDetailResponse approve(UUID revisionId, RevisionActionRequest request) {
        access.requireApprover();
        BomFlowRevision revision = requireRevisionForUpdate(revisionId);
        requireVersion(revision.rowVersion, version(request), "BOM revision");

        if (revision.status != BomFlowRevisionStatus.VERIFIED) {
            throw badRequest("Only Verified revisions can be approved.");
        }

        String actor = access.currentUsername();
        LocalDateTime now = LocalDateTime.now();
        revision.status = BomFlowRevisionStatus.APPROVED;
        revision.remarks = firstNonBlank(request == null ? null : request.remarks(), revision.remarks);
        revision.approvedBy = actor;
        revision.approvedAt = now;
        revision.updatedBy = actor;
        revision.updatedAt = now;

        revision = revisionRepository.saveAndFlush(revision);
        BomFlowProduct product = revision.product;
        product.status = BomFlowProductStatus.ACTIVE;
        product.updatedBy = actor;
        product.updatedAt = now;
        productRepository.saveAndFlush(product);

        return mapper.toRevisionDetail(revision);
    }

    private void applyLineRequest(BomFlowRevisionItem item, RevisionLineRequest request) {
        String section = cleanLimited(required(request.section(), "Section"), 120, "Section");
        BigDecimal quantity = request.requiredQty() != null ? request.requiredQty() : request.quantity();
        BigDecimal gst = request.gstPercent() != null ? request.gstPercent() : request.gst();

        quantity = positive(quantity, "Quantity");
        BigDecimal rate = nonNegative(request.rate(), "Rate");
        gst = gst == null ? BigDecimal.ZERO : nonNegative(gst, "GST percent");
        if (gst.compareTo(new BigDecimal("100")) > 0) throw badRequest("GST percent cannot exceed 100.");

        item.section = section;
        item.category = cleanLimited(firstNonBlank(request.category(), section), 100, "Category");
        item.itemName = cleanLimited(required(request.itemName(), "Item name"), 500, "Item name");
        item.brand = cleanLimited(request.brand(), 255, "Brand");
        item.vendorName = cleanLimited(request.vendorName(), 220, "Vendor name");
        item.unit = upper(cleanLimited(required(request.unit(), "Unit"), 60, "Unit"));

        BigDecimal amount = quantity.multiply(rate).setScale(4, RoundingMode.HALF_UP);
        item.baseQty = quantity;
        item.wastagePercent = BigDecimal.ZERO;
        item.requiredQty = quantity;
        item.rate = rate;
        item.materialAmount = amount.setScale(2, RoundingMode.HALF_UP);
        item.processingAmount = BigDecimal.ZERO.setScale(2);
        item.amount = amount;
        item.gstPercent = gst;
        item.rateMasterId = null;
        item.rateAppliedBy = null;
        item.rateAppliedAt = null;
        item.storeIssueRequired = true;
        item.active = true;
        item.remarks = cleanLimited(request.remarks(), 3000, "Remarks");
    }

    private void validateLineRequest(RevisionLineRequest request) {
        if (request == null) throw badRequest("BOM row request body is required.");
    }

    private void requireEditable(BomFlowRevision revision) {
        if (!(revision.status == BomFlowRevisionStatus.DRAFT || revision.status == BomFlowRevisionStatus.RETURNED)) {
            throw badRequest("Only Draft or Returned revisions can be edited.");
        }
    }

    private BomFlowRevision requireRevisionForUpdate(UUID revisionId) {
        if (revisionId == null) throw badRequest("Revision ID is required.");
        return revisionRepository.findByIdForUpdate(revisionId)
                .orElseThrow(() -> notFound("BOM revision not found: " + revisionId));
    }

    private BomFlowRevision requireRevisionWithProduct(UUID revisionId) {
        if (revisionId == null) throw badRequest("Revision ID is required.");
        return revisionRepository.findByIdWithProduct(revisionId)
                .orElseThrow(() -> notFound("BOM revision not found: " + revisionId));
    }

    private Long version(RevisionActionRequest request) {
        return request == null ? null : request.rowVersion();
    }

    private void requireVersion(Long actual, Long supplied, String label) {
        if (supplied == null) throw badRequest(label + " rowVersion is required.");
        if (!Objects.equals(actual, supplied)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    label + " was changed by another user. Refresh and try again.");
        }
    }

    private BigDecimal positive(BigDecimal value, String field) {
        if (value == null || value.compareTo(BigDecimal.ZERO) <= 0) {
            throw badRequest(field + " must be greater than zero.");
        }
        return value;
    }

    private BigDecimal nonNegative(BigDecimal value, String field) {
        BigDecimal safe = value == null ? BigDecimal.ZERO : value;
        if (safe.compareTo(BigDecimal.ZERO) < 0) throw badRequest(field + " cannot be negative.");
        return safe;
    }

    private BigDecimal zero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private String required(String value, String field) {
        String cleaned = clean(value);
        if (cleaned == null) throw badRequest(field + " is required.");
        return cleaned;
    }

    private String cleanLimited(String value, int maxLength, String field) {
        String cleaned = clean(value);
        if (cleaned != null && cleaned.length() > maxLength) throw badRequest(field + " is too long.");
        return cleaned;
    }

    private String upper(String value) {
        String cleaned = clean(value);
        return cleaned == null ? null : cleaned.toUpperCase(Locale.ROOT);
    }

    private String firstNonBlank(String first, String second) {
        String cleaned = clean(first);
        return cleaned != null ? cleaned : clean(second);
    }

    private String clean(String value) {
        if (value == null) return null;
        String cleaned = value.trim();
        return cleaned.isEmpty() ? null : cleaned;
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private ResponseStatusException notFound(String message) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
    }
}
