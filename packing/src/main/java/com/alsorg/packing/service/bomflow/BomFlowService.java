package com.alsorg.packing.service.bomflow;

import com.alsorg.packing.controller.dto.bomflow.CreateBomRequest;
import com.alsorg.packing.controller.dto.bomflow.SaveBomItemRequest;
import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.BomAuditResponse;
import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.BomDetailResponse;
import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.BomItemResponse;
import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.BomListResponse;
import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.BomRevisionResponse;
import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.CreateRevisionRequest;
import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.DeactivateBomItemRequest;
import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.RevisionDetailResponse;
import com.alsorg.packing.controller.dto.bomflow.BomFlowDtos.UpdateBomRequest;

import com.alsorg.packing.domain.bomflow.BomFlowBom;
import com.alsorg.packing.domain.bomflow.BomFlowItem;
import com.alsorg.packing.domain.bomflow.BomFlowRevision;
import com.alsorg.packing.domain.bomflow.BomFlowStatus;

import com.alsorg.packing.repository.bomflow.BomFlowBomRepository;
import com.alsorg.packing.repository.bomflow.BomFlowItemRepository;
import com.alsorg.packing.repository.bomflow.BomFlowRevisionRepository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import org.springframework.data.jpa.domain.Specification;

import org.springframework.http.HttpStatus;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
@Transactional
public class BomFlowService {

    private final BomFlowBomRepository bomRepo;
    private final BomFlowRevisionRepository revisionRepo;
    private final BomFlowItemRepository itemRepo;

    private final BomFlowAccessService access;
    private final BomFlowNumberService numberService;
    private final BomFlowAuditService auditService;
    private final BomFlowMapper mapper;

    public BomFlowService(
            BomFlowBomRepository bomRepo,
            BomFlowRevisionRepository revisionRepo,
            BomFlowItemRepository itemRepo,
            BomFlowAccessService access,
            BomFlowNumberService numberService,
            BomFlowAuditService auditService,
            BomFlowMapper mapper) {

        this.bomRepo = bomRepo;
        this.revisionRepo = revisionRepo;
        this.itemRepo = itemRepo;
        this.access = access;
        this.numberService = numberService;
        this.auditService = auditService;
        this.mapper = mapper;
    }

    /*
     * =========================================================
     * CREATE BOM
     * =========================================================
     */

    public BomDetailResponse create(
            CreateBomRequest req) {

        access.requireEditor();

        require(
                req,
                "BOM request body is required.");

        requireText(
                req.plantCode(),
                "Plant Code is required.");

        requireText(
                req.pdNo(),
                "PD No. is required.");

        requireText(
                req.clientName(),
                "Client Name is required.");

        requireText(
                req.productName(),
                "Product Name is required.");

        String plantCode = cleanUpper(
                req.plantCode());

        access.assertPlantAccess(
                plantCode);

        String actor = access.currentUsername();

        LocalDateTime now = LocalDateTime.now();

        BomFlowBom bom = new BomFlowBom();

        bom.bomNo = numberService.nextBomNo(
                plantCode);

        bom.plantCode = plantCode;

        bom.pdNo = clean(req.pdNo());

        bom.drawingNo = clean(req.drawingNo());

        bom.projectCode = clean(req.projectCode());

        bom.clientName = clean(req.clientName());

        bom.productName = clean(req.productName());

        bom.productCode = clean(req.productCode());

        bom.productDescription = clean(req.productDescription());

        bom.currentRevisionNo = 1;
        bom.status = BomFlowStatus.DRAFT;

        bom.remarks = clean(req.remarks());

        bom.createdBy = actor;
        bom.updatedBy = actor;

        bom = bomRepo.save(
                bom);

        BomFlowRevision revision = new BomFlowRevision();

        revision.bomId = bom.id;

        revision.revisionNo = 1;

        revision.status = BomFlowStatus.DRAFT;

        revision.revisionReason = "INITIAL_BOM";

        revision.engineeringRemarks = clean(req.remarks());

        revision.preparedBy = actor;
        revision.preparedAt = now;

        revision.createdBy = actor;
        revision.updatedBy = actor;

        revision = revisionRepo.save(
                revision);

        auditService.record(
                bom.id,
                revision.id,
                null,
                "BOM_CREATED",
                null,
                "BOM="
                        + bom.bomNo
                        + ", Revision=1",
                actor);

        return buildBomDetail(
                bom);
    }

    /*
     * =========================================================
     * LIST / DETAIL
     * =========================================================
     */

    @Transactional(readOnly = true)
    public Page<BomListResponse> list(
            String search,
            String plantCode,
            String status,
            int page,
            int size) {

        access.requireBomFlowAccess();

        if (hasText(plantCode)) {
            access.assertPlantAccess(
                    plantCode);
        }

        Specification<BomFlowBom> spec = visibleSpec()
                .and(
                        BomFlowSpecifications
                                .search(search))
                .and(
                        BomFlowSpecifications
                                .plantCode(
                                        plantCode))
                .and(
                        BomFlowSpecifications
                                .status(status));

        Pageable pageable = PageRequest.of(
                Math.max(page, 0),
                Math.min(
                        Math.max(size, 1),
                        100),
                Sort.by(
                        Sort.Direction.DESC,
                        "updatedAt")
                        .and(
                                Sort.by(
                                        Sort.Direction.DESC,
                                        "createdAt")));

        return bomRepo
                .findAll(
                        spec,
                        pageable)
                .map(
                        mapper::toBomResponse);
    }

    @Transactional(readOnly = true)
    public BomDetailResponse get(
            UUID bomId) {

        BomFlowBom bom = requireVisibleBom(
                bomId);

        return buildBomDetail(
                bom);
    }

    @Transactional(readOnly = true)
    public RevisionDetailResponse getRevision(
            UUID revisionId) {

        access.requireBomFlowAccess();

        BomFlowRevision revision = revisionRepo.findById(
                revisionId)
                .orElseThrow(() -> notFound(
                        "BOM revision not found."));

        BomFlowBom bom = requireVisibleBom(
                revision.bomId);

        List<BomFlowItem> items = itemRepo
                .findByRevisionIdOrderByLineNoAsc(
                        revision.id);

        return mapper
                .toRevisionDetailResponse(
                        bom,
                        revision,
                        items);
    }

    @Transactional(readOnly = true)
    public List<BomRevisionResponse> revisions(
            UUID bomId) {

        BomFlowBom bom = requireVisibleBom(
                bomId);

        return revisionRepo
                .findByBomIdOrderByRevisionNoDesc(
                        bom.id)
                .stream()
                .map(revision -> mapper.toRevisionResponse(
                        revision,
                        itemRepo
                                .findByRevisionIdOrderByLineNoAsc(
                                        revision.id)))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<BomAuditResponse> audit(
            UUID bomId) {

        requireVisibleBom(
                bomId);

        return auditService.list(
                bomId);
    }

    /*
     * =========================================================
     * UPDATE BOM HEADER
     * =========================================================
     */

    public BomDetailResponse updateBom(
            UUID bomId,
            UpdateBomRequest req) {

        access.requireEditor();

        require(
                req,
                "BOM update body is required.");

        requireText(
                req.pdNo(),
                "PD No. is required.");

        requireText(
                req.clientName(),
                "Client Name is required.");

        requireText(
                req.productName(),
                "Product Name is required.");

        require(
                req.bomRowVersion(),
                "BOM rowVersion is required.");

        require(
                req.revisionRowVersion(),
                "Revision rowVersion is required.");

        BomFlowBom bom = bomRepo.findByIdForUpdate(
                bomId)
                .orElseThrow(() -> notFound(
                        "BOM not found."));

        access.assertPlantAccess(
                bom.plantCode);

        assertVersion(
                bom.rowVersion,
                req.bomRowVersion(),
                "BOM");

        BomFlowRevision revision = currentRevisionForUpdate(
                bom);

        assertVersion(
                revision.rowVersion,
                req.revisionRowVersion(),
                "BOM revision");

        assertEditable(
                revision);

        String actor = access.currentUsername();

        String oldValue = headerSummary(bom);

        bom.pdNo = clean(req.pdNo());

        bom.drawingNo = clean(req.drawingNo());

        bom.projectCode = clean(req.projectCode());

        bom.clientName = clean(req.clientName());

        bom.productName = clean(req.productName());

        bom.productCode = clean(req.productCode());

        bom.productDescription = clean(req.productDescription());

        bom.remarks = clean(req.remarks());

        bom.updatedBy = actor;

        reopenReturnedRevision(
                bom,
                revision,
                actor);

        bomRepo.save(
                bom);

        revisionRepo.save(
                revision);

        auditService.record(
                bom.id,
                revision.id,
                null,
                "BOM_HEADER_UPDATED",
                oldValue,
                headerSummary(bom),
                actor);

        return buildBomDetail(
                bom);
    }

    /*
     * =========================================================
     * MATERIAL ITEMS
     * =========================================================
     */

    public BomItemResponse addItem(
            UUID revisionId,
            SaveBomItemRequest req) {

        access.requireEditor();

        require(
                req,
                "BOM item request body is required.");

        EditableContext context = editableContext(
                revisionId);

        validateItemRequest(
                req);

        if (itemRepo.existsByRevisionIdAndLineNo(
                revisionId,
                req.lineNo())) {

            throw conflict(
                    "Line No. "
                            + req.lineNo()
                            + " already exists in this revision.");
        }

        String actor = access.currentUsername();

        BomFlowItem item = new BomFlowItem();

        item.revisionId = context.revision.id;

        applyItemRequest(
                item,
                req);

        item.active = true;
        item.createdBy = actor;
        item.updatedBy = actor;

        item = itemRepo.save(
                item);

        reopenReturnedRevision(
                context.bom,
                context.revision,
                actor);

        context.bom.updatedBy = actor;

        bomRepo.save(
                context.bom);

        revisionRepo.save(
                context.revision);

        auditService.record(
                context.bom.id,
                context.revision.id,
                item.id,
                "BOM_ITEM_ADDED",
                null,
                itemSummary(item),
                actor);

        return mapper.toItemResponse(
                item);
    }

    public BomItemResponse updateItem(
            UUID revisionId,
            UUID itemId,
            SaveBomItemRequest req) {

        access.requireEditor();

        require(
                req,
                "BOM item request body is required.");

        require(
                req.rowVersion(),
                "Item rowVersion is required.");

        EditableContext context = editableContext(
                revisionId);

        BomFlowItem item = itemRepo
                .findByIdAndRevisionIdForUpdate(
                        revisionId,
                        itemId)
                .orElseThrow(() -> notFound(
                        "BOM item not found."));

        assertVersion(
                item.rowVersion,
                req.rowVersion(),
                "BOM item");

        validateItemRequest(
                req);

        if (itemRepo
                .existsByRevisionIdAndLineNoAndIdNot(
                        revisionId,
                        req.lineNo(),
                        itemId)) {

            throw conflict(
                    "Line No. "
                            + req.lineNo()
                            + " already exists in this revision.");
        }

        String actor = access.currentUsername();

        String oldValue = itemSummary(item);

        applyItemRequest(
                item,
                req);

        item.updatedBy = actor;

        item = itemRepo.save(
                item);

        reopenReturnedRevision(
                context.bom,
                context.revision,
                actor);

        context.bom.updatedBy = actor;

        bomRepo.save(
                context.bom);

        revisionRepo.save(
                context.revision);

        auditService.record(
                context.bom.id,
                context.revision.id,
                item.id,
                "BOM_ITEM_UPDATED",
                oldValue,
                itemSummary(item),
                actor);

        return mapper.toItemResponse(
                item);
    }

    public BomItemResponse deactivateItem(
            UUID revisionId,
            UUID itemId,
            DeactivateBomItemRequest req) {

        access.requireEditor();

        require(
                req,
                "Item deactivation body is required.");

        require(
                req.rowVersion(),
                "Item rowVersion is required.");

        requireText(
                req.reason(),
                "Item deactivation reason is required.");

        EditableContext context = editableContext(
                revisionId);

        BomFlowItem item = itemRepo
                .findByIdAndRevisionIdForUpdate(
                        revisionId,
                        itemId)
                .orElseThrow(() -> notFound(
                        "BOM item not found."));

        assertVersion(
                item.rowVersion,
                req.rowVersion(),
                "BOM item");

        if (!item.active) {
            return mapper.toItemResponse(
                    item);
        }

        String actor = access.currentUsername();

        String oldValue = itemSummary(item);

        item.active = false;

        item.remarks = appendReason(
                item.remarks,
                "Deactivated: "
                        + clean(req.reason()));

        item.updatedBy = actor;

        item = itemRepo.save(
                item);

        reopenReturnedRevision(
                context.bom,
                context.revision,
                actor);

        context.bom.updatedBy = actor;

        bomRepo.save(
                context.bom);

        revisionRepo.save(
                context.revision);

        auditService.record(
                context.bom.id,
                context.revision.id,
                item.id,
                "BOM_ITEM_DEACTIVATED",
                oldValue,
                itemSummary(item),
                actor);

        return mapper.toItemResponse(
                item);
    }

    /*
     * =========================================================
     * CREATE NEXT REVISION
     * =========================================================
     */

    public RevisionDetailResponse createRevision(
            UUID bomId,
            CreateRevisionRequest req) {

        access.requireEditor();

        require(
                req,
                "Create Revision body is required.");

        requireText(
                req.revisionReason(),
                "Revision Reason is required.");

        require(
                req.bomRowVersion(),
                "BOM rowVersion is required.");

        BomFlowBom bom = bomRepo.findByIdForUpdate(
                bomId)
                .orElseThrow(() -> notFound(
                        "BOM not found."));

        access.assertPlantAccess(
                bom.plantCode);

        assertVersion(
                bom.rowVersion,
                req.bomRowVersion(),
                "BOM");

        BomFlowRevision sourceRevision = currentRevisionForUpdate(
                bom);

        boolean sourceAllowed = sourceRevision.status == BomFlowStatus.APPROVED
                || sourceRevision.status == BomFlowStatus.RELEASED
                || sourceRevision.status == BomFlowStatus.SUPERSEDED;

        if (!sourceAllowed) {
            throw badRequest(
                    "A new revision can only be created "
                            + "from an Approved, Released or "
                            + "Superseded revision.");
        }

        int nextRevisionNo = sourceRevision.revisionNo + 1;

        if (revisionRepo.existsByBomIdAndRevisionNo(
                bom.id,
                nextRevisionNo)) {

            throw conflict(
                    "Revision "
                            + nextRevisionNo
                            + " already exists.");
        }

        String actor = access.currentUsername();

        LocalDateTime now = LocalDateTime.now();

        BomFlowRevision newRevision = new BomFlowRevision();

        newRevision.bomId = bom.id;

        newRevision.revisionNo = nextRevisionNo;

        newRevision.status = BomFlowStatus.DRAFT;

        newRevision.revisionReason = clean(req.revisionReason());

        newRevision.engineeringRemarks = sourceRevision.engineeringRemarks;

        newRevision.bomDocumentAttachmentId = sourceRevision.bomDocumentAttachmentId;

        newRevision.drawingAttachmentId = sourceRevision.drawingAttachmentId;

        newRevision.sampleAttachmentId = sourceRevision.sampleAttachmentId;

        newRevision.preparedBy = actor;
        newRevision.preparedAt = now;

        newRevision.createdBy = actor;
        newRevision.updatedBy = actor;

        newRevision = revisionRepo.save(
                newRevision);

        List<BomFlowItem> sourceItems = itemRepo
                .findByRevisionIdAndActiveTrueOrderByLineNoAsc(
                        sourceRevision.id);

        for (BomFlowItem source : sourceItems) {

            BomFlowItem copy = copyItem(
                    source,
                    newRevision.id,
                    actor);

            itemRepo.save(
                    copy);
        }

        bom.currentRevisionNo = nextRevisionNo;

        bom.status = BomFlowStatus.DRAFT;

        bom.updatedBy = actor;

        bomRepo.save(
                bom);

        auditService.record(
                bom.id,
                newRevision.id,
                null,
                "BOM_REVISION_CREATED",
                "Source Revision="
                        + sourceRevision.revisionNo,
                "New Revision="
                        + nextRevisionNo
                        + ", Reason="
                        + clean(req.revisionReason()),
                actor);

        List<BomFlowItem> copiedItems = itemRepo
                .findByRevisionIdOrderByLineNoAsc(
                        newRevision.id);

        return mapper
                .toRevisionDetailResponse(
                        bom,
                        newRevision,
                        copiedItems);
    }

    /*
     * =========================================================
     * INTERNAL HELPERS
     * =========================================================
     */

    private BomDetailResponse buildBomDetail(
            BomFlowBom bom) {

        List<BomFlowRevision> revisions = revisionRepo
                .findByBomIdOrderByRevisionNoDesc(
                        bom.id);

        BomFlowRevision currentRevision = revisionRepo
                .findByBomIdAndRevisionNo(
                        bom.id,
                        bom.currentRevisionNo)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "Current BOM revision "
                                + "is missing."));

        Map<UUID, List<BomFlowItem>> itemsByRevision = new LinkedHashMap<>();

        for (BomFlowRevision revision : revisions) {

            itemsByRevision.put(
                    revision.id,
                    itemRepo
                            .findByRevisionIdOrderByLineNoAsc(
                                    revision.id));
        }

        List<BomFlowItem> currentItems = itemsByRevision.getOrDefault(
                currentRevision.id,
                List.of());

        return mapper.toBomDetailResponse(
                bom,
                revisions,
                currentRevision,
                currentItems,
                itemsByRevision);
    }

    private Specification<BomFlowBom> visibleSpec() {

        access.requireBomFlowAccess();

        return BomFlowSpecifications
                .visiblePlants(
                        access.allowedPlantCodes(),
                        access.canAccessAllPlants());
    }

    private BomFlowBom requireVisibleBom(
            UUID bomId) {

        access.requireBomFlowAccess();

        if (bomId == null) {
            throw badRequest(
                    "BOM ID is required.");
        }

        BomFlowBom bom = bomRepo.findById(
                bomId)
                .orElseThrow(() -> notFound(
                        "BOM not found."));

        access.assertPlantAccess(
                bom.plantCode);

        return bom;
    }

    private BomFlowRevision currentRevisionForUpdate(
            BomFlowBom bom) {

        return revisionRepo
                .findByBomIdAndRevisionNo(
                        bom.id,
                        bom.currentRevisionNo)
                .flatMap(revision -> revisionRepo
                        .findByIdForUpdate(
                                revision.id))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "Current BOM revision "
                                + "is missing."));
    }

    private EditableContext editableContext(
            UUID revisionId) {

        if (revisionId == null) {
            throw badRequest(
                    "Revision ID is required.");
        }

        BomFlowRevision initial = revisionRepo.findById(
                revisionId)
                .orElseThrow(() -> notFound(
                        "BOM revision not found."));

        BomFlowBom bom = bomRepo.findByIdForUpdate(
                initial.bomId)
                .orElseThrow(() -> notFound(
                        "BOM not found."));

        access.assertPlantAccess(
                bom.plantCode);

        BomFlowRevision revision = revisionRepo
                .findByIdForUpdate(
                        revisionId)
                .orElseThrow(() -> notFound(
                        "BOM revision not found."));

        if (!Objects.equals(
                revision.bomId,
                bom.id)) {

            throw conflict(
                    "BOM revision ownership changed. "
                            + "Reload and try again.");
        }

        if (!Objects.equals(
                bom.currentRevisionNo,
                revision.revisionNo)) {

            throw badRequest(
                    "Only the current BOM revision "
                            + "can be edited.");
        }

        assertEditable(
                revision);

        return new EditableContext(
                bom,
                revision);
    }

    private void assertEditable(
            BomFlowRevision revision) {

        boolean editable = revision.status == BomFlowStatus.DRAFT
                || revision.status == BomFlowStatus.RETURNED;

        if (!editable) {
            throw badRequest(
                    "Only a Draft or Returned "
                            + "BOM revision can be edited.");
        }
    }

    private void reopenReturnedRevision(
            BomFlowBom bom,
            BomFlowRevision revision,
            String actor) {

        if (revision.status == BomFlowStatus.RETURNED) {

            revision.status = BomFlowStatus.DRAFT;

            revision.returnedBy = null;
            revision.returnedAt = null;
            revision.returnRemarks = null;

            revision.updatedBy = actor;

            bom.status = BomFlowStatus.DRAFT;
        }
    }

    private void validateItemRequest(
            SaveBomItemRequest req) {

        require(
                req.lineNo(),
                "Line No. is required.");

        if (req.lineNo() < 1) {
            throw badRequest(
                    "Line No. must be greater than zero.");
        }

        require(
                req.category(),
                "Material Category is required.");

        requireText(
                req.itemName(),
                "Item Name is required.");

        requirePositive(
                req.baseQty(),
                "Base Qty must be greater than zero.");

        requireNonNegative(
                defaultZero(
                        req.wastagePercent()),
                "Wastage Percent cannot be negative.");

        if (defaultZero(
                req.wastagePercent())
                .compareTo(
                        BigDecimal.valueOf(100)) > 0) {

            throw badRequest(
                    "Wastage Percent cannot exceed 100.");
        }

        require(
                req.unit(),
                "Material Unit is required.");

        requireNonNegative(
                defaultZero(
                        req.unitRate()),
                "Unit Rate cannot be negative.");

        requireNonNegative(
                defaultZero(
                        req.processingAmount()),
                "Processing Amount cannot be negative.");

        validateOptionalNonNegative(
                req.length(),
                "Length");

        validateOptionalNonNegative(
                req.width(),
                "Width");

        validateOptionalNonNegative(
                req.height(),
                "Height");
    }

    private void applyItemRequest(
            BomFlowItem item,
            SaveBomItemRequest req) {

        BigDecimal baseQty = quantity(
                req.baseQty(),
                "Base Qty is invalid.");

        BigDecimal wastagePercent = percent(
                defaultZero(
                        req.wastagePercent()));

        BigDecimal wastageQty = baseQty
                .multiply(
                        wastagePercent)
                .divide(
                        BigDecimal.valueOf(100),
                        6,
                        RoundingMode.HALF_UP);

        BigDecimal requiredQty = baseQty
                .add(wastageQty)
                .setScale(
                        3,
                        RoundingMode.HALF_UP);

        BigDecimal unitRate = moneyRate(
                defaultZero(
                        req.unitRate()));

        BigDecimal materialAmount = requiredQty
                .multiply(unitRate)
                .setScale(
                        2,
                        RoundingMode.HALF_UP);

        BigDecimal processingAmount = money(
                defaultZero(
                        req.processingAmount()));

        BigDecimal totalAmount = materialAmount
                .add(
                        processingAmount)
                .setScale(
                        2,
                        RoundingMode.HALF_UP);

        item.lineNo = req.lineNo();

        item.category = req.category();

        item.subCategory = clean(req.subCategory());

        item.inventoryItemId = req.inventoryItemId();

        item.itemCode = clean(req.itemCode());

        item.itemName = clean(req.itemName());

        item.itemDescription = clean(req.itemDescription());

        item.specification = clean(req.specification());

        item.grade = clean(req.grade());

        item.brand = clean(req.brand());

        item.finish = clean(req.finish());

        item.colour = clean(req.colour());

        item.thickness = clean(req.thickness());

        item.size = clean(req.size());

        item.length = optionalQuantity(
                req.length());

        item.width = optionalQuantity(
                req.width());

        item.height = optionalQuantity(
                req.height());

        item.baseQty = baseQty;

        item.wastagePercent = wastagePercent;

        item.requiredQty = requiredQty;

        item.unit = req.unit();

        item.unitRate = unitRate;

        item.materialAmount = materialAmount;

        item.processingAmount = processingAmount;

        item.totalAmount = totalAmount;

        item.storeIssueRequired = req.storeIssueRequired() == null
                || req.storeIssueRequired();

        item.remarks = clean(req.remarks());
    }

    private BomFlowItem copyItem(
            BomFlowItem source,
            UUID revisionId,
            String actor) {

        BomFlowItem copy = new BomFlowItem();

        copy.revisionId = revisionId;
        copy.lineNo = source.lineNo;

        copy.category = source.category;
        copy.subCategory = source.subCategory;

        copy.inventoryItemId = source.inventoryItemId;

        copy.itemCode = source.itemCode;
        copy.itemName = source.itemName;
        copy.itemDescription = source.itemDescription;

        copy.specification = source.specification;

        copy.grade = source.grade;
        copy.brand = source.brand;
        copy.finish = source.finish;
        copy.colour = source.colour;

        copy.thickness = source.thickness;

        copy.size = source.size;

        copy.length = source.length;
        copy.width = source.width;
        copy.height = source.height;

        copy.baseQty = source.baseQty;

        copy.wastagePercent = source.wastagePercent;

        copy.requiredQty = source.requiredQty;

        copy.unit = source.unit;

        copy.unitRate = source.unitRate;

        copy.materialAmount = source.materialAmount;

        copy.processingAmount = source.processingAmount;

        copy.totalAmount = source.totalAmount;

        copy.storeIssueRequired = source.storeIssueRequired;

        copy.active = true;

        copy.remarks = source.remarks;

        copy.createdBy = actor;
        copy.updatedBy = actor;

        return copy;
    }

    private String headerSummary(
            BomFlowBom bom) {

        return "PD="
                + bom.pdNo
                + ", Drawing="
                + bom.drawingNo
                + ", Project="
                + bom.projectCode
                + ", Client="
                + bom.clientName
                + ", Product="
                + bom.productName
                + ", Product Code="
                + bom.productCode;
    }

    private String itemSummary(
            BomFlowItem item) {

        return "Line="
                + item.lineNo
                + ", Item="
                + item.itemName
                + ", Category="
                + item.category
                + ", Base Qty="
                + item.baseQty
                + ", Wastage="
                + item.wastagePercent
                + "%, Required Qty="
                + item.requiredQty
                + ", Unit="
                + item.unit
                + ", Total="
                + item.totalAmount
                + ", Active="
                + item.active;
    }

    private String appendReason(
            String existing,
            String newReason) {

        if (!hasText(existing)) {
            return newReason;
        }

        return existing.trim()
                + " | "
                + newReason;
    }

    private void assertVersion(
            Long actual,
            Long supplied,
            String label) {

        if (!Objects.equals(
                actual,
                supplied)) {

            throw conflict(
                    label
                            + " was updated by another user. "
                            + "Reload before submitting.");
        }
    }

    private BigDecimal quantity(
            BigDecimal value,
            String message) {

        require(
                value,
                message);

        if (value.compareTo(
                BigDecimal.ZERO) < 0) {

            throw badRequest(
                    message);
        }

        if (value.stripTrailingZeros()
                .scale() > 3) {

            throw badRequest(
                    "Quantity can have a maximum "
                            + "of 3 decimal places.");
        }

        return value.setScale(
                3,
                RoundingMode.UNNECESSARY);
    }

    private BigDecimal optionalQuantity(
            BigDecimal value) {

        if (value == null) {
            return null;
        }

        return value.setScale(
                3,
                RoundingMode.HALF_UP);
    }

    private BigDecimal percent(
            BigDecimal value) {

        return value.setScale(
                3,
                RoundingMode.HALF_UP);
    }

    private BigDecimal moneyRate(
            BigDecimal value) {

        return value.setScale(
                4,
                RoundingMode.HALF_UP);
    }

    private BigDecimal money(
            BigDecimal value) {

        return value.setScale(
                2,
                RoundingMode.HALF_UP);
    }

    private BigDecimal defaultZero(
            BigDecimal value) {

        return value == null
                ? BigDecimal.ZERO
                : value;
    }

    private void validateOptionalNonNegative(
            BigDecimal value,
            String fieldName) {

        if (value != null
                && value.compareTo(
                        BigDecimal.ZERO) < 0) {

            throw badRequest(
                    fieldName
                            + " cannot be negative.");
        }
    }

    private void requirePositive(
            BigDecimal value,
            String message) {

        require(
                value,
                message);

        if (value.compareTo(
                BigDecimal.ZERO) <= 0) {

            throw badRequest(
                    message);
        }
    }

    private void requireNonNegative(
            BigDecimal value,
            String message) {

        require(
                value,
                message);

        if (value.compareTo(
                BigDecimal.ZERO) < 0) {

            throw badRequest(
                    message);
        }
    }

    private void require(
            Object value,
            String message) {

        if (value == null) {
            throw badRequest(
                    message);
        }
    }

    private void requireText(
            String value,
            String message) {

        if (!hasText(value)) {
            throw badRequest(
                    message);
        }
    }

    private boolean hasText(
            String value) {

        return value != null
                && !value.trim().isEmpty();
    }

    private String clean(
            String value) {

        return value == null
                ? null
                : value.trim();
    }

    private String cleanUpper(
            String value) {

        return value == null
                ? null
                : value.trim()
                        .toUpperCase();
    }

    private ResponseStatusException badRequest(
            String message) {

        return new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                message);
    }

    private ResponseStatusException notFound(
            String message) {

        return new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                message);
    }

    private ResponseStatusException conflict(
            String message) {

        return new ResponseStatusException(
                HttpStatus.CONFLICT,
                message);
    }

    private record EditableContext(
            BomFlowBom bom,
            BomFlowRevision revision) {
    }
}