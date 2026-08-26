package com.alsorg.packing.service;

import com.alsorg.packing.controller.dto.admin.AdminDeletePreviewResponse;
import com.alsorg.packing.controller.dto.admin.AdminDeleteRequest;
import com.alsorg.packing.controller.dto.admin.AdminDeleteResultResponse;
import com.alsorg.packing.controller.dto.admin.AdminDeleteSearchResult;
import com.alsorg.packing.controller.dto.admin.AdminDeletionHistoryResponse;
import com.alsorg.packing.controller.dto.admin.AdminWarehouseBulkDeleteRequest;
import com.alsorg.packing.domain.item.HardwarePacketLine;
import com.alsorg.packing.domain.admin.PacketLifecycleChangeRequestStatus;
import com.alsorg.packing.repository.HardwarePacketLineRepository;
import com.alsorg.packing.domain.audit.AdminDeletionAudit;
import com.alsorg.packing.domain.common.PacketItemType;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.item.MasterItem;
import com.alsorg.packing.domain.item.PacketItem;
import com.alsorg.packing.domain.logistics.LogisticsTrip;
import com.alsorg.packing.domain.logistics.LogisticsTripItem;
import com.alsorg.packing.domain.packet.Packet;
import com.alsorg.packing.domain.users.User;

import com.alsorg.packing.repository.ActivityLogRepository;
import com.alsorg.packing.repository.AdminDeletionAuditRepository;
import com.alsorg.packing.repository.AuditLogRepository;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.repository.LogisticsTripItemRepository;
import com.alsorg.packing.repository.LogisticsTripLocationRepository;
import com.alsorg.packing.repository.LogisticsTripRepository;
import com.alsorg.packing.repository.MasterItemRepository;
import com.alsorg.packing.repository.PacketItemRepository;
import com.alsorg.packing.repository.PacketRepository;
import com.alsorg.packing.repository.PacketLifecycleChangeRequestRepository;
import com.alsorg.packing.repository.StickerHistoryRepository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;

import java.nio.file.Files;
import java.nio.file.Path;

import java.time.LocalDateTime;
import java.time.ZoneId;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.dao.DataIntegrityViolationException;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import org.springframework.http.HttpStatus;

import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminDeletionService {

        private static final ZoneId INDIA_ZONE = ZoneId.of("Asia/Kolkata");

        private static final UUID NO_MATCH_UUID = new UUID(0L, 0L);

        /*
         * Warehouse page rows are DispatchedItem records. Excel imports create
         * standalone rows here without Packet / PacketItem / MasterItem records.
         * Keep the Admin delete target aligned with what the Warehouse page can
         * actually show instead of broadening permanent deletion into unrelated
         * Dispatch history.
         */
        private static final Set<ItemDispatchStatus> WAREHOUSE_DELETE_STATUSES = Set.of(
                        ItemDispatchStatus.ON_FLOOR,
                        ItemDispatchStatus.WAREHOUSE_REQUESTED,
                        ItemDispatchStatus.IN_WAREHOUSE,
                        ItemDispatchStatus.WAREHOUSE_RETURN_REQUESTED);

        private final PacketItemRepository packetItemRepository;

        private final MasterItemRepository masterItemRepository;

        private final PacketRepository packetRepository;

        private final StickerHistoryRepository stickerHistoryRepository;

        private final DispatchedItemRepository dispatchedItemRepository;

        private final HardwarePacketLineRepository hardwarePacketLineRepository;

        private final LogisticsTripItemRepository logisticsTripItemRepository;

        private final LogisticsTripRepository logisticsTripRepository;

        private final LogisticsTripLocationRepository logisticsTripLocationRepository;

        private final ActivityLogRepository activityLogRepository;

        private final AuditLogRepository auditLogRepository;

        private final AdminDeletionAuditRepository adminDeletionAuditRepository;

        private final PacketLifecycleChangeRequestRepository lifecycleChangeRequestRepository;

        private final CurrentUserService currentUserService;

        private final ObjectMapper objectMapper;

        private final EntityManager entityManager;

        public AdminDeletionService(
                        PacketItemRepository packetItemRepository,
                        HardwarePacketLineRepository hardwarePacketLineRepository,
                        MasterItemRepository masterItemRepository,
                        PacketRepository packetRepository,
                        StickerHistoryRepository stickerHistoryRepository,
                        DispatchedItemRepository dispatchedItemRepository,
                        LogisticsTripItemRepository logisticsTripItemRepository,
                        LogisticsTripRepository logisticsTripRepository,
                        LogisticsTripLocationRepository logisticsTripLocationRepository,
                        ActivityLogRepository activityLogRepository,
                        AuditLogRepository auditLogRepository,
                        AdminDeletionAuditRepository adminDeletionAuditRepository,
                        PacketLifecycleChangeRequestRepository lifecycleChangeRequestRepository,
                        CurrentUserService currentUserService,
                        ObjectMapper objectMapper,
                        EntityManager entityManager) {
                this.packetItemRepository = packetItemRepository;
                this.hardwarePacketLineRepository = hardwarePacketLineRepository;
                this.masterItemRepository = masterItemRepository;
                this.packetRepository = packetRepository;
                this.stickerHistoryRepository = stickerHistoryRepository;
                this.dispatchedItemRepository = dispatchedItemRepository;
                this.logisticsTripItemRepository = logisticsTripItemRepository;
                this.logisticsTripRepository = logisticsTripRepository;
                this.logisticsTripLocationRepository = logisticsTripLocationRepository;
                this.activityLogRepository = activityLogRepository;
                this.auditLogRepository = auditLogRepository;
                this.adminDeletionAuditRepository = adminDeletionAuditRepository;
                this.lifecycleChangeRequestRepository = lifecycleChangeRequestRepository;
                this.currentUserService = currentUserService;
                this.objectMapper = objectMapper;
                this.entityManager = entityManager;
        }

        /*
         * =====================================================
         * SEARCH PACKET ITEMS
         * =====================================================
         */

        @Transactional(readOnly = true)
        public Page<AdminDeleteSearchResult> searchPacketItems(
                        String rawQuery,
                        Pageable pageable,
                        User user) {
                assertAdmin(user);

                String query = normalizeSearchQuery(rawQuery);

                /*
                 * UUID lookup is handled separately because portable JPQL
                 * cannot always cast UUID to string.
                 */
                UUID possibleId = tryParseUuid(query);

                if (possibleId != null) {
                        PacketItem exactItem = packetItemRepository
                                        .findById(possibleId)
                                        .orElse(null);

                        if (exactItem != null) {
                                return new PageImpl<>(
                                                List.of(
                                                                toPacketSearchResult(exactItem)),
                                                pageable,
                                                1);
                        }
                }

                return packetItemRepository
                                .searchForAdminDeletion(
                                                query,
                                                pageable)
                                .map(this::toPacketSearchResult);
        }

        /*
         * =====================================================
         * SEARCH MASTER ITEMS
         * =====================================================
         */

        @Transactional(readOnly = true)
        public Page<AdminDeleteSearchResult> searchMasterItems(
                        String rawQuery,
                        Pageable pageable,
                        User user) {
                assertAdmin(user);

                String query = normalizeSearchQuery(rawQuery);

                UUID possibleId = tryParseUuid(query);

                if (possibleId != null) {
                        MasterItem exactMaster = masterItemRepository
                                        .findById(possibleId)
                                        .orElse(null);

                        if (exactMaster != null) {
                                return new PageImpl<>(
                                                List.of(
                                                                toMasterSearchResult(
                                                                                exactMaster)),
                                                pageable,
                                                1);
                        }
                }

                return masterItemRepository
                                .searchForAdminDeletion(
                                                query,
                                                pageable)
                                .map(this::toMasterSearchResult);
        }

        /*
         * =====================================================
         * PREVIEW PACKET ITEM DELETION
         * =====================================================
         */

        @Transactional(readOnly = true)
        public AdminDeletePreviewResponse previewPacketItem(
                        UUID itemId,
                        User user) {
                assertAdmin(user);

                PacketItem item = packetItemRepository
                                .findByIdForAdminDeletionPreview(itemId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "Packet item not found"));

                DeletionContext context = buildDeletionContext(
                                List.of(item));

                Map<String, Long> affectedRows = buildAffectedRowPreview(
                                context,
                                false);

                boolean deletesMaster = affectedRows.getOrDefault(
                                "masterItems",
                                0L) > 0;

                boolean deletesInternalPacket = affectedRows.getOrDefault(
                                "internalPackets",
                                0L) > 0;

                String confirmation = "DELETE PACKET " + itemId;

                return new AdminDeletePreviewResponse(
                                "PACKET_ITEM",
                                itemId.toString(),
                                buildPacketDisplayName(item),
                                safe(item.getDescription()),
                                safe(item.getPdNo()),
                                safe(item.getDrawingNo()),
                                safe(item.getPacketNumber()),
                                safe(item.getStatus()),
                                firstNonBlank(
                                                item.getCurrentLocationCode(),
                                                item.getLocation(),
                                                "-"),
                                confirmation,
                                affectedRows,
                                deletesMaster,
                                deletesInternalPacket,
                                buildPacketWarning(
                                                item,
                                                affectedRows));
        }

        /*
         * =====================================================
         * PREVIEW MASTER ITEM DELETION
         * =====================================================
         */

        @Transactional(readOnly = true)
        public AdminDeletePreviewResponse previewMasterItem(
                        UUID masterItemId,
                        User user) {
                assertAdmin(user);

                MasterItem master = masterItemRepository
                                .findByIdForAdminDeletionPreview(
                                                masterItemId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "Master item not found"));

                List<PacketItem> items = packetItemRepository
                                .findAllByMasterItemIdForAdminDeletionPreview(
                                                masterItemId);

                Map<String, Long> affectedRows;

                boolean deletesInternalPacket;

                if (items.isEmpty()) {
                        affectedRows = new LinkedHashMap<>();

                        affectedRows.put("packetItems", 0L);
                        affectedRows.put("hardwarePacketLines", 0L);
                        affectedRows.put("stickerHistory", 0L);
                        affectedRows.put("dispatchedItems", 0L);
                        affectedRows.put("logisticsTripItems", 0L);
                        affectedRows.put("affectedTrips", 0L);
                        affectedRows.put("activityLogs", 0L);
                        affectedRows.put("auditLogs", 0L);
                        affectedRows.put("pendingLifecycleRequests", 0L);
                        affectedRows.put("internalPackets", 0L);
                        affectedRows.put("masterItems", 1L);

                        deletesInternalPacket = false;
                } else {
                        DeletionContext context = buildDeletionContext(items);

                        affectedRows = buildAffectedRowPreview(
                                        context,
                                        true);

                        deletesInternalPacket = affectedRows.getOrDefault(
                                        "internalPackets",
                                        0L) > 0;
                }

                String confirmation = "DELETE MASTER " + masterItemId;

                return new AdminDeletePreviewResponse(
                                "MASTER_ITEM",
                                masterItemId.toString(),
                                buildMasterDisplayName(master),
                                "",
                                safe(master.getPdNo()),
                                safe(master.getDrawingName()),
                                "-",
                                "MULTIPLE",
                                "MULTIPLE",
                                confirmation,
                                affectedRows,
                                true,
                                deletesInternalPacket,
                                "This permanently deletes the master item and every linked packet.");
        }

        /*
         * =====================================================
         * DELETE ONE PACKET ITEM
         * =====================================================
         */

        @Transactional
        public AdminDeleteResultResponse deletePacketItem(
                        UUID itemId,
                        AdminDeleteRequest request,
                        User user) {
                assertAdmin(user);

                PacketItem item = packetItemRepository
                                .findByIdForAdminDeletion(itemId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "Packet item not found"));

                String requiredConfirmation = "DELETE PACKET " + itemId;

                validateDeleteRequest(
                                request,
                                requiredConfirmation);

                DeletionContext context = buildDeletionContext(
                                List.of(item));

                String displayName = buildPacketDisplayName(item);

                String snapshotJson = buildPacketSnapshotJson(
                                item,
                                context);

                try {
                        return executeDeletion(
                                        context,
                                        "PACKET_ITEM",
                                        itemId.toString(),
                                        displayName,
                                        cleanRequiredReason(
                                                        request.reason()),
                                        safeActor(user.getUsername()),
                                        snapshotJson,
                                        null);

                } catch (DataIntegrityViolationException exception) {
                        throw new ResponseStatusException(
                                        HttpStatus.CONFLICT,
                                        "Deletion was blocked because another linked database record still exists",
                                        exception);
                }
        }

        /*
         * =====================================================
         * DELETE MASTER ITEM AND ALL PACKETS
         * =====================================================
         */

        @Transactional
        public AdminDeleteResultResponse deleteMasterItem(
                        UUID masterItemId,
                        AdminDeleteRequest request,
                        User user) {
                assertAdmin(user);

                MasterItem master = masterItemRepository
                                .findByIdForAdminDeletion(
                                                masterItemId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "Master item not found"));

                String requiredConfirmation = "DELETE MASTER " + masterItemId;

                validateDeleteRequest(
                                request,
                                requiredConfirmation);

                String displayName = buildMasterDisplayName(master);

                List<PacketItem> packetItems = packetItemRepository
                                .findAllByMasterItemIdForAdminDeletion(
                                                masterItemId);

                /*
                 * A master may exist without packet children because of
                 * old data or earlier partial cleanup.
                 */
                if (packetItems.isEmpty()) {
                        return deleteEmptyMasterItem(
                                        master,
                                        request,
                                        user);
                }

                DeletionContext context = buildDeletionContext(packetItems);

                String snapshotJson = buildMasterSnapshotJson(
                                master,
                                context);

                try {
                        return executeDeletion(
                                        context,
                                        "MASTER_ITEM",
                                        masterItemId.toString(),
                                        displayName,
                                        cleanRequiredReason(
                                                        request.reason()),
                                        safeActor(user.getUsername()),
                                        snapshotJson,
                                        masterItemId);

                } catch (DataIntegrityViolationException exception) {
                        throw new ResponseStatusException(
                                        HttpStatus.CONFLICT,
                                        "Master deletion was blocked because another linked database record still exists",
                                        exception);
                }
        }

        /*
         * =====================================================
         * SEARCH WAREHOUSE ITEMS
         * =====================================================
         */

        @Transactional(readOnly = true)
        public Page<AdminDeleteSearchResult> searchWarehouseItems(
                        String rawQuery,
                        Pageable pageable,
                        User user) {
                assertAdmin(user);

                String query = normalizeSearchQuery(rawQuery);

                DispatchedItem exactItem = dispatchedItemRepository
                                .findById(query)
                                .orElse(null);

                if (isWarehouseDeleteCandidate(exactItem)) {
                        return new PageImpl<>(
                                        List.of(toWarehouseSearchResult(exactItem)),
                                        pageable,
                                        1);
                }

                String loweredQuery = query.toLowerCase(Locale.ROOT);
                String likeQuery = "%" + loweredQuery + "%";

                Specification<DispatchedItem> specification = (root, criteriaQuery, cb) -> {
                        List<Predicate> matches = new ArrayList<>();

                        for (String field : List.of(
                                        "zohoItemId",
                                        "name",
                                        "sku",
                                        "pdNo",
                                        "drawingNo",
                                        "description",
                                        "clientName",
                                        "plantCode",
                                        "currentLocationCode",
                                        "location",
                                        "warehouseCode",
                                        "gatePassNumber")) {

                                Expression<String> value = cb.lower(
                                                cb.coalesce(
                                                                root.get(field).as(String.class),
                                                                ""));

                                matches.add(
                                                cb.like(
                                                                value,
                                                                likeQuery));
                        }

                        return cb.and(
                                        root.get("status").in(WAREHOUSE_DELETE_STATUSES),
                                        cb.or(matches.toArray(Predicate[]::new)));
                };

                return dispatchedItemRepository
                                .findAll(specification, pageable)
                                .map(this::toWarehouseSearchResult);
        }

        /*
         * =====================================================
         * PREVIEW / DELETE ONE WAREHOUSE ITEM
         * =====================================================
         */

        @Transactional(readOnly = true)
        public AdminDeletePreviewResponse previewWarehouseItem(
                        String itemId,
                        User user) {
                assertAdmin(user);

                DispatchedItem item = requireWarehouseDeleteItem(itemId);

                DeletionContext context = buildWarehouseDeletionContext(
                                List.of(item));

                Map<String, Long> affectedRows = buildAffectedRowPreview(
                                context,
                                false);

                String requiredConfirmation = "DELETE WAREHOUSE " + item.getZohoItemId();

                boolean deletesMaster = affectedRows.getOrDefault(
                                "masterItems",
                                0L) > 0;

                boolean deletesInternalPacket = affectedRows.getOrDefault(
                                "internalPackets",
                                0L) > 0;

                return new AdminDeletePreviewResponse(
                                "WAREHOUSE_ITEM",
                                item.getZohoItemId(),
                                buildWarehouseDisplayName(item),
                                safe(item.getDescription()),
                                safe(item.getPdNo()),
                                safe(item.getDrawingNo()),
                                "-",
                                item.getStatus() == null ? "" : item.getStatus().name(),
                                firstNonBlank(
                                                item.getCurrentLocationCode(),
                                                item.getWarehouseCode(),
                                                item.getLocation(),
                                                "-"),
                                requiredConfirmation,
                                affectedRows,
                                deletesMaster,
                                deletesInternalPacket,
                                buildWarehouseWarning(context));
        }

        @Transactional
        public AdminDeleteResultResponse deleteWarehouseItem(
                        String itemId,
                        AdminDeleteRequest request,
                        User user) {
                assertAdmin(user);

                DispatchedItem item = requireWarehouseDeleteItem(itemId);

                String requiredConfirmation = "DELETE WAREHOUSE " + item.getZohoItemId();

                validateDeleteRequest(
                                request,
                                requiredConfirmation);

                DeletionContext context = buildWarehouseDeletionContext(
                                List.of(item));

                String displayName = buildWarehouseDisplayName(item);

                try {
                        return executeDeletion(
                                        context,
                                        "WAREHOUSE_ITEM",
                                        item.getZohoItemId(),
                                        displayName,
                                        cleanRequiredReason(request.reason()),
                                        safeActor(user.getUsername()),
                                        buildWarehouseSnapshotJson(
                                                        List.of(item),
                                                        context,
                                                        "SINGLE"),
                                        null);
                } catch (DataIntegrityViolationException exception) {
                        throw new ResponseStatusException(
                                        HttpStatus.CONFLICT,
                                        "Warehouse deletion was blocked because another linked database record still exists",
                                        exception);
                }
        }

        /*
         * =====================================================
         * PREVIEW / DELETE WAREHOUSE ITEMS IN BULK
         * =====================================================
         */

        @Transactional(readOnly = true)
        public AdminDeletePreviewResponse previewWarehouseItemsBulk(
                        List<String> itemIds,
                        User user) {
                assertAdmin(user);

                List<DispatchedItem> items = requireWarehouseDeleteItems(itemIds);

                DeletionContext context = buildWarehouseDeletionContext(items);

                Map<String, Long> affectedRows = buildAffectedRowPreview(
                                context,
                                false);

                String requiredConfirmation = "DELETE WAREHOUSE BULK " + items.size();

                return new AdminDeletePreviewResponse(
                                "WAREHOUSE_BULK",
                                "BULK",
                                items.size() + " Warehouse Items",
                                "Permanent bulk deletion of the selected Warehouse rows.",
                                "MULTIPLE",
                                "MULTIPLE",
                                "MULTIPLE",
                                "MULTIPLE",
                                "MULTIPLE",
                                requiredConfirmation,
                                affectedRows,
                                affectedRows.getOrDefault("masterItems", 0L) > 0,
                                affectedRows.getOrDefault("internalPackets", 0L) > 0,
                                buildWarehouseWarning(context));
        }

        @Transactional
        public AdminDeleteResultResponse deleteWarehouseItemsBulk(
                        AdminWarehouseBulkDeleteRequest request,
                        User user) {
                assertAdmin(user);

                if (request == null) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Warehouse bulk deletion request is missing");
                }

                List<DispatchedItem> items = requireWarehouseDeleteItems(
                                request.itemIds());

                String requiredConfirmation = "DELETE WAREHOUSE BULK " + items.size();

                validateDeleteRequest(
                                new AdminDeleteRequest(
                                                request.confirmationText(),
                                                request.reason()),
                                requiredConfirmation);

                DeletionContext context = buildWarehouseDeletionContext(items);

                String auditTargetId = "BULK-" + UUID.randomUUID();
                String displayName = items.size() + " Warehouse Items";

                try {
                        return executeDeletion(
                                        context,
                                        "WAREHOUSE_BULK",
                                        auditTargetId,
                                        displayName,
                                        cleanRequiredReason(request.reason()),
                                        safeActor(user.getUsername()),
                                        buildWarehouseSnapshotJson(
                                                        items,
                                                        context,
                                                        "BULK"),
                                        null);
                } catch (DataIntegrityViolationException exception) {
                        throw new ResponseStatusException(
                                        HttpStatus.CONFLICT,
                                        "Bulk Warehouse deletion was blocked because another linked database record still exists",
                                        exception);
                }
        }


        /*
         * =====================================================
         * PREVIEW / DELETE ONE DISPATCH ITEM
         * =====================================================
         *
         * Dispatch deletion is intentionally separate from Warehouse deletion.
         * Warehouse deletion is restricted to Warehouse-visible statuses, while
         * an ADMIN may permanently delete ANY row visible in the Dispatch page.
         *
         * The deletion graph still uses the same central cascade engine, so a
         * linked PacketItem is removed from Packet/Sticker/Dispatch/Logistics
         * data and empty parent Packet/Master records are reconciled. Standalone
         * Excel-import Dispatch rows are supported as well.
         */

        @Transactional(readOnly = true)
        public AdminDeletePreviewResponse previewDispatchItem(
                        String itemId,
                        User user) {
                assertAdmin(user);

                DispatchedItem item = requireDispatchDeleteItem(itemId);

                DeletionContext context = buildDispatchDeletionContext(
                                List.of(item));

                Map<String, Long> affectedRows = buildAffectedRowPreview(
                                context,
                                false);

                String requiredConfirmation = "DELETE DISPATCH " + item.getZohoItemId();

                boolean deletesMaster = affectedRows.getOrDefault(
                                "masterItems",
                                0L) > 0;

                boolean deletesInternalPacket = affectedRows.getOrDefault(
                                "internalPackets",
                                0L) > 0;

                return new AdminDeletePreviewResponse(
                                "DISPATCH_ITEM",
                                item.getZohoItemId(),
                                buildDispatchDisplayName(item),
                                safe(item.getDescription()),
                                safe(item.getPdNo()),
                                safe(item.getDrawingNo()),
                                firstNonBlank(
                                                item.getSku(),
                                                "-"),
                                item.getStatus() == null ? "" : item.getStatus().name(),
                                firstNonBlank(
                                                item.getCurrentLocationCode(),
                                                item.getWarehouseCode(),
                                                item.getLocation(),
                                                "-"),
                                requiredConfirmation,
                                affectedRows,
                                deletesMaster,
                                deletesInternalPacket,
                                buildDispatchWarning(context));
        }

        @Transactional
        public AdminDeleteResultResponse deleteDispatchItem(
                        String itemId,
                        AdminDeleteRequest request,
                        User user) {
                assertAdmin(user);

                DispatchedItem item = requireDispatchDeleteItem(itemId);

                String requiredConfirmation = "DELETE DISPATCH " + item.getZohoItemId();

                validateDeleteRequest(
                                request,
                                requiredConfirmation);

                DeletionContext context = buildDispatchDeletionContext(
                                List.of(item));

                String displayName = buildDispatchDisplayName(item);

                try {
                        return executeDeletion(
                                        context,
                                        "DISPATCH_ITEM",
                                        item.getZohoItemId(),
                                        displayName,
                                        cleanRequiredReason(request.reason()),
                                        safeActor(user.getUsername()),
                                        buildDispatchSnapshotJson(
                                                        List.of(item),
                                                        context,
                                                        "SINGLE"),
                                        null);
                } catch (DataIntegrityViolationException exception) {
                        throw new ResponseStatusException(
                                        HttpStatus.CONFLICT,
                                        "Dispatch deletion was blocked because another linked database record still exists",
                                        exception);
                }
        }

        /*
         * =====================================================
         * PREVIEW / DELETE DISPATCH ITEMS IN BULK
         * =====================================================
         */

        @Transactional(readOnly = true)
        public AdminDeletePreviewResponse previewDispatchItemsBulk(
                        List<String> itemIds,
                        User user) {
                assertAdmin(user);

                List<DispatchedItem> items = requireDispatchDeleteItems(itemIds);

                DeletionContext context = buildDispatchDeletionContext(items);

                Map<String, Long> affectedRows = buildAffectedRowPreview(
                                context,
                                false);

                String requiredConfirmation = "DELETE DISPATCH BULK " + items.size();

                return new AdminDeletePreviewResponse(
                                "DISPATCH_BULK",
                                "BULK",
                                items.size() + " Dispatch Items",
                                "Permanent bulk deletion of the selected Dispatch rows and all linked PackFlow records.",
                                "MULTIPLE",
                                "MULTIPLE",
                                "MULTIPLE",
                                "MULTIPLE",
                                "MULTIPLE",
                                requiredConfirmation,
                                affectedRows,
                                affectedRows.getOrDefault("masterItems", 0L) > 0,
                                affectedRows.getOrDefault("internalPackets", 0L) > 0,
                                buildDispatchWarning(context));
        }

        @Transactional
        public AdminDeleteResultResponse deleteDispatchItemsBulk(
                        AdminWarehouseBulkDeleteRequest request,
                        User user) {
                assertAdmin(user);

                if (request == null) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Dispatch bulk deletion request is missing");
                }

                List<DispatchedItem> items = requireDispatchDeleteItems(
                                request.itemIds());

                String requiredConfirmation = "DELETE DISPATCH BULK " + items.size();

                validateDeleteRequest(
                                new AdminDeleteRequest(
                                                request.confirmationText(),
                                                request.reason()),
                                requiredConfirmation);

                DeletionContext context = buildDispatchDeletionContext(items);

                String auditTargetId = "BULK-" + UUID.randomUUID();
                String displayName = items.size() + " Dispatch Items";

                try {
                        return executeDeletion(
                                        context,
                                        "DISPATCH_BULK",
                                        auditTargetId,
                                        displayName,
                                        cleanRequiredReason(request.reason()),
                                        safeActor(user.getUsername()),
                                        buildDispatchSnapshotJson(
                                                        items,
                                                        context,
                                                        "BULK"),
                                        null);
                } catch (DataIntegrityViolationException exception) {
                        throw new ResponseStatusException(
                                        HttpStatus.CONFLICT,
                                        "Bulk Dispatch deletion was blocked because another linked database record still exists",
                                        exception);
                }
        }

        /*
         * =====================================================
         * DELETION HISTORY
         * =====================================================
         */

        @Transactional(readOnly = true)
        public Page<AdminDeletionHistoryResponse> getDeletionHistory(
                        Pageable pageable,
                        User user) {
                assertAdmin(user);

                return adminDeletionAuditRepository
                                .findAllByOrderByDeletedAtDesc(
                                                pageable)
                                .map(audit -> new AdminDeletionHistoryResponse(
                                                audit.getId(),
                                                audit.getTargetType(),
                                                audit.getTargetId(),
                                                audit.getDisplayName(),
                                                audit.getReason(),
                                                audit.getDeletedBy(),
                                                audit.getDeletedAt(),
                                                audit.getAffectedRowsJson()));
        }

        /*
         * =====================================================
         * CENTRAL EXECUTION
         * =====================================================
         */

        private AdminDeleteResultResponse executeDeletion(
                        DeletionContext context,
                        String targetType,
                        String targetId,
                        String displayName,
                        String reason,
                        String actor,
                        String snapshotJson,
                        UUID explicitlyDeletedMasterId) {
                /*
                 * A permanent deletion must never orphan an open user approval
                 * request. Preserve decided request history, but require every
                 * PENDING request to be approved/rejected first. This keeps the
                 * Admin Center queue actionable and avoids an approval later
                 * targeting a packet that no longer exists.
                 */
                lockPacketItemsForLifecycleDeletion(
                                context.packetItemIds());

                assertNoPendingLifecycleRequests(
                                context.packetItemIds());

                /*
                 * Child records must be deleted first.
                 */

                Set<UUID> repositoryPacketItemIds = packetItemIdsForRepository(
                                context.packetItemIds());

                int deletedHardwarePacketLines = context.packetItemIds().isEmpty()
                                ? 0
                                : hardwarePacketLineRepository
                                                .deleteByPacketItemIdsForAdminDeletion(
                                                                context.packetItemIds());

                int deletedStickerHistory = context.packetItemIds().isEmpty()
                                ? 0
                                : stickerHistoryRepository
                                                .deleteByPacketItemIdsForAdminDeletion(
                                                                context.packetItemIds());

                int deletedTripItems = context.lookupIds().isEmpty()
                                ? 0
                                : logisticsTripItemRepository
                                                .deleteForAdminDeletion(
                                                                repositoryPacketItemIds,
                                                                context.lookupIds());

                int deletedDispatchedItems = context.lookupIds().isEmpty()
                                ? 0
                                : dispatchedItemRepository
                                                .deleteForAdminDeletion(
                                                                repositoryPacketItemIds,
                                                                context.lookupIds());

                int deletedActivityLogs = context.lookupIds().isEmpty()
                                ? 0
                                : activityLogRepository
                                                .deleteByZohoItemIdsForAdminDeletion(
                                                                context.lookupIds());

                int deletedAuditLogs = context.lookupIds().isEmpty()
                                ? 0
                                : auditLogRepository
                                                .deleteByZohoItemIdsForAdminDeletion(
                                                                context.lookupIds());

                int deletedPacketItems = context.packetItemIds().isEmpty()
                                ? 0
                                : packetItemRepository
                                                .deleteByIdsForAdminDeletion(
                                                                context.packetItemIds());

                /*
                 * JPQL bulk deletes bypass the persistence context.
                 * Flush and clear before counting remaining records.
                 */
                entityManager.flush();
                entityManager.clear();

                TripReconcileResult tripResult = reconcileLogisticsTrips(
                                context.tripIds());

                PacketReconcileResult packetResult = reconcileInternalPackets(
                                context.packetIds());

                MasterReconcileResult masterResult;

                if (explicitlyDeletedMasterId != null) {
                        masterResult = deleteExplicitMaster(
                                        explicitlyDeletedMasterId);
                } else {
                        masterResult = reconcileMasterItems(
                                        context.masterIds());
                }

                Map<String, Long> deletedRows = new LinkedHashMap<>();

                deletedRows.put(
                                "packetItems",
                                (long) deletedPacketItems);

                deletedRows.put(
                                "stickerHistory",
                                (long) deletedStickerHistory);

                deletedRows.put(
                                "hardwarePacketLines",
                                (long) deletedHardwarePacketLines);

                deletedRows.put(
                                "dispatchedItems",
                                (long) deletedDispatchedItems);

                deletedRows.put(
                                "logisticsTripItems",
                                (long) deletedTripItems);

                deletedRows.put(
                                "logisticsTrips",
                                tripResult.deletedTrips());

                deletedRows.put(
                                "logisticsTripLocations",
                                tripResult.deletedLocations());

                deletedRows.put(
                                "activityLogs",
                                (long) deletedActivityLogs);

                deletedRows.put(
                                "auditLogs",
                                (long) deletedAuditLogs);

                deletedRows.put(
                                "pendingLifecycleRequests",
                                0L);

                deletedRows.put(
                                "internalPackets",
                                packetResult.deletedPackets());

                deletedRows.put(
                                "masterItems",
                                masterResult.deletedMasters());

                deletedRows.put(
                                "masterItemsUpdated",
                                masterResult.updatedMasters());

                AdminDeletionAudit deletionAudit = saveDeletionAudit(
                                targetType,
                                targetId,
                                displayName,
                                reason,
                                actor,
                                deletedRows,
                                snapshotJson);

                /*
                 * Filesystem deletion must happen only after successful
                 * transaction commit.
                 */
                scheduleFilesForDeletionAfterCommit(
                                packetResult.filePaths());

                String message;

                if ("MASTER_ITEM".equals(targetType)) {
                        message = "Master item and all linked packets were permanently deleted";
                } else if ("DISPATCH_BULK".equals(targetType)) {
                        message = "Selected Dispatch items and all linked operational records were permanently deleted";
                } else if ("DISPATCH_ITEM".equals(targetType)) {
                        message = "Dispatch item and all linked operational records were permanently deleted";
                } else if ("WAREHOUSE_BULK".equals(targetType)) {
                        message = "Selected Warehouse items and all linked operational records were permanently deleted";
                } else if ("WAREHOUSE_ITEM".equals(targetType)) {
                        message = "Warehouse item and all linked operational records were permanently deleted";
                } else {
                        message = "Packet was permanently deleted from all linked operational records";
                }

                return new AdminDeleteResultResponse(
                                deletionAudit.getId(),
                                targetType,
                                targetId,
                                displayName,
                                actor,
                                deletionAudit.getDeletedAt(),
                                deletedRows,
                                message);
        }

        /*
         * =====================================================
         * DELETE EMPTY MASTER
         * =====================================================
         */

        private AdminDeleteResultResponse deleteEmptyMasterItem(
                        MasterItem master,
                        AdminDeleteRequest request,
                        User user) {
                String displayName = buildMasterDisplayName(master);

                String snapshotJson = buildEmptyMasterSnapshotJson(
                                master);

                UUID masterId = master.getId();

                masterItemRepository.delete(master);

                entityManager.flush();

                Map<String, Long> deletedRows = new LinkedHashMap<>();

                deletedRows.put("packetItems", 0L);
                deletedRows.put("hardwarePacketLines", 0L);
                deletedRows.put("stickerHistory", 0L);
                deletedRows.put("dispatchedItems", 0L);
                deletedRows.put("logisticsTripItems", 0L);
                deletedRows.put("logisticsTrips", 0L);
                deletedRows.put("logisticsTripLocations", 0L);
                deletedRows.put("activityLogs", 0L);
                deletedRows.put("auditLogs", 0L);
                deletedRows.put("pendingLifecycleRequests", 0L);
                deletedRows.put("internalPackets", 0L);
                deletedRows.put("masterItems", 1L);
                deletedRows.put("masterItemsUpdated", 0L);

                String actor = safeActor(user.getUsername());

                AdminDeletionAudit deletionAudit = saveDeletionAudit(
                                "MASTER_ITEM",
                                masterId.toString(),
                                displayName,
                                cleanRequiredReason(
                                                request.reason()),
                                actor,
                                deletedRows,
                                snapshotJson);

                return new AdminDeleteResultResponse(
                                deletionAudit.getId(),
                                "MASTER_ITEM",
                                masterId.toString(),
                                displayName,
                                actor,
                                deletionAudit.getDeletedAt(),
                                deletedRows,
                                "Empty master item was permanently deleted");
        }

        private List<Map<String, Object>> buildHardwareLineSnapshots(
                        UUID packetItemId,
                        List<HardwarePacketLine> lines) {
                if (packetItemId == null ||
                                lines == null ||
                                lines.isEmpty()) {
                        return List.of();
                }

                List<Map<String, Object>> result = new ArrayList<>();

                for (HardwarePacketLine line : lines) {
                        if (line == null ||
                                        line.getPacketItem() == null ||
                                        !packetItemId.equals(
                                                        line.getPacketItem().getId())) {
                                continue;
                        }

                        Map<String, Object> row = new LinkedHashMap<>();

                        row.put(
                                        "id",
                                        line.getId());

                        row.put(
                                        "lineNo",
                                        line.getLineNo());

                        row.put(
                                        "itemName",
                                        line.getItemName());

                        row.put(
                                        "quantity",
                                        line.getQuantity());

                        row.put(
                                        "uom",
                                        line.getUom());

                        row.put(
                                        "hardwareInventoryItemId",
                                        line.getHardwareInventoryItemId());

                        result.add(row);
                }

                return result;
        }

        /*
         * =====================================================
         * BUILD COMPLETE DELETION GRAPH
         * =====================================================
         */

        private DeletionContext buildDeletionContext(
                        List<PacketItem> packetItems) {
                if (packetItems == null ||
                                packetItems.isEmpty()) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "No packet items found for deletion");
                }

                Set<UUID> packetItemIds = packetItems.stream()
                                .map(PacketItem::getId)
                                .filter(Objects::nonNull)
                                .collect(
                                                Collectors.toCollection(
                                                                LinkedHashSet::new));

                if (packetItemIds.isEmpty()) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Packet item IDs are missing");
                }

                List<HardwarePacketLine> hardwarePacketLines = hardwarePacketLineRepository
                                .findForAdminDeletion(
                                                packetItemIds);

                Set<String> lookupIds = new LinkedHashSet<>();

                for (PacketItem item : packetItems) {
                        if (item.getId() != null) {
                                lookupIds.add(
                                                item.getId().toString());
                        }

                        if (hasText(item.getZohoItemId())) {
                                lookupIds.add(
                                                item.getZohoItemId().trim());
                        }
                }

                List<DispatchedItem> dispatchedItems = dispatchedItemRepository
                                .findForAdminDeletion(
                                                packetItemIds,
                                                lookupIds);

                for (DispatchedItem item : dispatchedItems) {
                        if (hasText(item.getZohoItemId())) {
                                lookupIds.add(
                                                item.getZohoItemId().trim());
                        }
                }

                List<LogisticsTripItem> tripItems = logisticsTripItemRepository
                                .findForAdminDeletion(
                                                packetItemIds,
                                                lookupIds);

                Set<UUID> tripIds = new LinkedHashSet<>();

                for (LogisticsTripItem item : tripItems) {
                        if (item.getTrip() != null &&
                                        item.getTrip().getId() != null) {

                                tripIds.add(
                                                item.getTrip().getId());
                        }
                }

                for (DispatchedItem item : dispatchedItems) {
                        if (item.getLogisticsTripId() != null) {
                                tripIds.add(
                                                item.getLogisticsTripId());
                        }
                }

                Set<UUID> packetIds = packetItems.stream()
                                .map(PacketItem::getPacket)
                                .filter(Objects::nonNull)
                                .map(Packet::getId)
                                .filter(Objects::nonNull)
                                .collect(
                                                Collectors.toCollection(
                                                                LinkedHashSet::new));

                Set<UUID> masterIds = packetItems.stream()
                                .map(PacketItem::getMasterItem)
                                .filter(Objects::nonNull)
                                .map(MasterItem::getId)
                                .filter(Objects::nonNull)
                                .collect(
                                                Collectors.toCollection(
                                                                LinkedHashSet::new));

                return new DeletionContext(
                                List.copyOf(packetItems),
                                packetItemIds,
                                packetIds,
                                masterIds,
                                lookupIds,
                                List.copyOf(
                                                hardwarePacketLines),
                                dispatchedItems,
                                tripItems,
                                tripIds);
        }

        /*
         * =====================================================
         * BUILD WAREHOUSE DELETION GRAPH
         * =====================================================
         */

        private DeletionContext buildWarehouseDeletionContext(
                        List<DispatchedItem> warehouseItems) {
                if (warehouseItems == null || warehouseItems.isEmpty()) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "No Warehouse items found for deletion");
                }

                LinkedHashMap<String, DispatchedItem> requestedRows = new LinkedHashMap<>();

                Set<UUID> linkedPacketItemIds = new LinkedHashSet<>();
                Set<UUID> packetIds = new LinkedHashSet<>();
                Set<UUID> masterIds = new LinkedHashSet<>();
                Set<String> lookupIds = new LinkedHashSet<>();

                for (DispatchedItem item : warehouseItems) {
                        if (!isWarehouseDeleteCandidate(item)) {
                                throw new ResponseStatusException(
                                                HttpStatus.BAD_REQUEST,
                                                "Item is not currently visible in Warehouse: "
                                                                + (item == null ? "unknown" : item.getZohoItemId()));
                        }

                        requestedRows.put(item.getZohoItemId(), item);
                        lookupIds.add(item.getZohoItemId());

                        if (item.getPacketItemId() != null) {
                                linkedPacketItemIds.add(item.getPacketItemId());
                        }

                        if (item.getLinkedPacketItemId() != null) {
                                linkedPacketItemIds.add(item.getLinkedPacketItemId());
                        }

                        if (item.getPacketId() != null) {
                                packetIds.add(item.getPacketId());
                        }

                        if (item.getLinkedMasterItemId() != null) {
                                masterIds.add(item.getLinkedMasterItemId());
                        }
                }

                List<PacketItem> packetItems = linkedPacketItemIds.isEmpty()
                                ? List.of()
                                : packetItemRepository.findAllById(linkedPacketItemIds);

                Set<UUID> packetItemIds = new LinkedHashSet<>(
                                linkedPacketItemIds);

                packetItems.stream()
                                .map(PacketItem::getId)
                                .filter(Objects::nonNull)
                                .forEach(packetItemIds::add);

                List<HardwarePacketLine> hardwarePacketLines = packetItemIds.isEmpty()
                                ? List.of()
                                : hardwarePacketLineRepository.findForAdminDeletion(packetItemIds);

                for (PacketItem item : packetItems) {
                        if (item.getId() != null) {
                                lookupIds.add(item.getId().toString());
                        }

                        if (hasText(item.getZohoItemId())) {
                                lookupIds.add(item.getZohoItemId().trim());
                        }

                        if (item.getPacket() != null && item.getPacket().getId() != null) {
                                packetIds.add(item.getPacket().getId());
                        }

                        if (item.getMasterItem() != null && item.getMasterItem().getId() != null) {
                                masterIds.add(item.getMasterItem().getId());
                        }
                }

                List<DispatchedItem> relatedDispatchRows = dispatchedItemRepository
                                .findForAdminDeletion(
                                                packetItemIdsForRepository(packetItemIds),
                                                lookupIds);

                LinkedHashMap<String, DispatchedItem> allDispatchRows = new LinkedHashMap<>(requestedRows);

                for (DispatchedItem row : relatedDispatchRows) {
                        if (row == null || !hasText(row.getZohoItemId())) {
                                continue;
                        }

                        allDispatchRows.put(row.getZohoItemId(), row);
                        lookupIds.add(row.getZohoItemId());

                        if (row.getPacketId() != null) {
                                packetIds.add(row.getPacketId());
                        }

                        if (row.getLinkedMasterItemId() != null) {
                                masterIds.add(row.getLinkedMasterItemId());
                        }
                }

                List<LogisticsTripItem> tripItems = logisticsTripItemRepository
                                .findForAdminDeletion(
                                                packetItemIdsForRepository(packetItemIds),
                                                lookupIds);

                Set<UUID> tripIds = new LinkedHashSet<>();

                for (LogisticsTripItem tripItem : tripItems) {
                        if (tripItem.getTrip() != null && tripItem.getTrip().getId() != null) {
                                tripIds.add(tripItem.getTrip().getId());
                        }
                }

                for (DispatchedItem row : allDispatchRows.values()) {
                        if (row.getLogisticsTripId() != null) {
                                tripIds.add(row.getLogisticsTripId());
                        }
                }

                return new DeletionContext(
                                List.copyOf(packetItems),
                                packetItemIds,
                                packetIds,
                                masterIds,
                                lookupIds,
                                List.copyOf(hardwarePacketLines),
                                List.copyOf(allDispatchRows.values()),
                                List.copyOf(tripItems),
                                tripIds);
        }


        /*
         * =====================================================
         * BUILD DISPATCH DELETION GRAPH
         * =====================================================
         *
         * Unlike buildWarehouseDeletionContext(), this deliberately has no
         * status restriction: every DispatchedItem shown on the Dispatch page
         * is an eligible ADMIN deletion target.
         */
        private DeletionContext buildDispatchDeletionContext(
                        List<DispatchedItem> dispatchItems) {
                if (dispatchItems == null || dispatchItems.isEmpty()) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "No Dispatch items found for deletion");
                }

                LinkedHashMap<String, DispatchedItem> requestedRows = new LinkedHashMap<>();

                Set<UUID> linkedPacketItemIds = new LinkedHashSet<>();
                Set<UUID> packetIds = new LinkedHashSet<>();
                Set<UUID> masterIds = new LinkedHashSet<>();
                Set<String> lookupIds = new LinkedHashSet<>();

                for (DispatchedItem item : dispatchItems) {
                        if (item == null || !hasText(item.getZohoItemId())) {
                                throw new ResponseStatusException(
                                                HttpStatus.BAD_REQUEST,
                                                "Dispatch item is missing a valid ID");
                        }

                        String dispatchItemId = item.getZohoItemId().trim();

                        requestedRows.put(dispatchItemId, item);
                        lookupIds.add(dispatchItemId);

                        if (item.getPacketItemId() != null) {
                                linkedPacketItemIds.add(item.getPacketItemId());
                        }

                        if (item.getLinkedPacketItemId() != null) {
                                linkedPacketItemIds.add(item.getLinkedPacketItemId());
                        }

                        if (item.getPacketId() != null) {
                                packetIds.add(item.getPacketId());
                        }

                        if (item.getLinkedMasterItemId() != null) {
                                masterIds.add(item.getLinkedMasterItemId());
                        }
                }

                List<PacketItem> packetItems = linkedPacketItemIds.isEmpty()
                                ? List.of()
                                : packetItemRepository.findAllById(linkedPacketItemIds);

                Set<UUID> packetItemIds = new LinkedHashSet<>(
                                linkedPacketItemIds);

                packetItems.stream()
                                .map(PacketItem::getId)
                                .filter(Objects::nonNull)
                                .forEach(packetItemIds::add);

                List<HardwarePacketLine> hardwarePacketLines = packetItemIds.isEmpty()
                                ? List.of()
                                : hardwarePacketLineRepository.findForAdminDeletion(packetItemIds);

                for (PacketItem item : packetItems) {
                        if (item.getId() != null) {
                                lookupIds.add(item.getId().toString());
                        }

                        if (hasText(item.getZohoItemId())) {
                                lookupIds.add(item.getZohoItemId().trim());
                        }

                        if (item.getPacket() != null && item.getPacket().getId() != null) {
                                packetIds.add(item.getPacket().getId());
                        }

                        if (item.getMasterItem() != null && item.getMasterItem().getId() != null) {
                                masterIds.add(item.getMasterItem().getId());
                        }
                }

                /*
                 * When the selected Dispatch row belongs to a PacketItem, remove
                 * every operational Dispatch row that points to that same packet.
                 * Otherwise a duplicate/legacy row could survive in stats.
                 */
                List<DispatchedItem> relatedDispatchRows = dispatchedItemRepository
                                .findForAdminDeletion(
                                                packetItemIdsForRepository(packetItemIds),
                                                lookupIds);

                LinkedHashMap<String, DispatchedItem> allDispatchRows = new LinkedHashMap<>(
                                requestedRows);

                for (DispatchedItem row : relatedDispatchRows) {
                        if (row == null || !hasText(row.getZohoItemId())) {
                                continue;
                        }

                        allDispatchRows.put(row.getZohoItemId(), row);
                        lookupIds.add(row.getZohoItemId());

                        if (row.getPacketId() != null) {
                                packetIds.add(row.getPacketId());
                        }

                        if (row.getLinkedMasterItemId() != null) {
                                masterIds.add(row.getLinkedMasterItemId());
                        }
                }

                List<LogisticsTripItem> tripItems = logisticsTripItemRepository
                                .findForAdminDeletion(
                                                packetItemIdsForRepository(packetItemIds),
                                                lookupIds);

                Set<UUID> tripIds = new LinkedHashSet<>();

                for (LogisticsTripItem tripItem : tripItems) {
                        if (tripItem.getTrip() != null && tripItem.getTrip().getId() != null) {
                                tripIds.add(tripItem.getTrip().getId());
                        }
                }

                for (DispatchedItem row : allDispatchRows.values()) {
                        if (row.getLogisticsTripId() != null) {
                                tripIds.add(row.getLogisticsTripId());
                        }
                }

                return new DeletionContext(
                                List.copyOf(packetItems),
                                packetItemIds,
                                packetIds,
                                masterIds,
                                lookupIds,
                                List.copyOf(hardwarePacketLines),
                                List.copyOf(allDispatchRows.values()),
                                List.copyOf(tripItems),
                                tripIds);
        }

        private Set<UUID> packetItemIdsForRepository(
                        Set<UUID> packetItemIds) {
                if (packetItemIds == null || packetItemIds.isEmpty()) {
                        return Set.of(NO_MATCH_UUID);
                }

                return packetItemIds;
        }

        /*
         * =====================================================
         * PREVIEW COUNTS
         * =====================================================
         */

        private Map<String, Long> buildAffectedRowPreview(
                        DeletionContext context,
                        boolean explicitMasterDelete) {
                Map<String, Long> counts = new LinkedHashMap<>();

                counts.put(
                                "packetItems",
                                (long) context.packetItems().size());

                counts.put(
                                "hardwarePacketLines",
                                (long) context
                                                .hardwarePacketLines()
                                                .size());

                counts.put(
                                "stickerHistory",
                                context.packetItemIds().isEmpty()
                                                ? 0L
                                                : stickerHistoryRepository
                                                                .countByPacketItem_IdIn(
                                                                                context.packetItemIds()));

                counts.put(
                                "dispatchedItems",
                                (long) context.dispatchedItems().size());

                counts.put(
                                "logisticsTripItems",
                                (long) context.tripItems().size());

                counts.put(
                                "affectedTrips",
                                (long) context.tripIds().size());

                counts.put(
                                "activityLogs",
                                context.lookupIds().isEmpty()
                                                ? 0L
                                                : activityLogRepository
                                                                .countByZohoItemIdIn(
                                                                                context.lookupIds()));

                counts.put(
                                "auditLogs",
                                context.lookupIds().isEmpty()
                                                ? 0L
                                                : auditLogRepository
                                                                .countByZohoItemIdIn(
                                                                                context.lookupIds()));

                counts.put(
                                "pendingLifecycleRequests",
                                countPendingLifecycleRequests(
                                                context.packetItemIds()));

                counts.put(
                                "internalPackets",
                                countInternalPacketsThatWillBeDeleted(
                                                context));

                counts.put(
                                "masterItems",
                                explicitMasterDelete
                                                ? 1L
                                                : countMasterItemsThatWillBeDeleted(
                                                                context));

                return counts;
        }

        private void lockPacketItemsForLifecycleDeletion(
                        Set<UUID> packetItemIds) {
                if (packetItemIds == null || packetItemIds.isEmpty()) {
                        return;
                }

                /*
                 * Submit requests lock PacketItem rows in UUID-string order.
                 * Use the same order here so permanent deletion and request
                 * submission cannot race past each other or deadlock by taking
                 * packet locks in different orders.
                 */
                packetItemIds.stream()
                                .filter(Objects::nonNull)
                                .sorted(Comparator.comparing(UUID::toString))
                                .forEach(packetItemId ->
                                                entityManager.find(
                                                                PacketItem.class,
                                                                packetItemId,
                                                                LockModeType.PESSIMISTIC_WRITE));
        }

        private long countPendingLifecycleRequests(
                        Set<UUID> packetItemIds) {
                if (packetItemIds == null || packetItemIds.isEmpty()) {
                        return 0L;
                }

                return lifecycleChangeRequestRepository
                                .countByPacketItemIdInAndStatus(
                                                packetItemIds,
                                                PacketLifecycleChangeRequestStatus.PENDING);
        }

        private void assertNoPendingLifecycleRequests(
                        Set<UUID> packetItemIds) {
                long pending = countPendingLifecycleRequests(
                                packetItemIds);

                if (pending <= 0L) {
                        return;
                }

                throw new ResponseStatusException(
                                HttpStatus.CONFLICT,
                                pending == 1L
                                                ? "This packet has a pending lifecycle change request. Approve or reject it in Admin Center > User Requests before permanent deletion."
                                                : pending + " selected packets have pending lifecycle change requests. Approve or reject them in Admin Center > User Requests before permanent deletion.");
        }

        private long countInternalPacketsThatWillBeDeleted(
                        DeletionContext context) {
                long count = 0;

                for (UUID packetId : context.packetIds()) {
                        long currentTotal = packetItemRepository
                                        .countByPacketId(packetId);

                        long deletingFromPacket = context.packetItems()
                                        .stream()
                                        .filter(item -> item.getPacket() != null &&
                                                        packetId.equals(
                                                                        item.getPacket().getId()))
                                        .count();

                        if (currentTotal <= deletingFromPacket) {
                                count++;
                        }
                }

                return count;
        }

        private long countMasterItemsThatWillBeDeleted(
                        DeletionContext context) {
                long count = 0;

                for (UUID masterId : context.masterIds()) {
                        long currentTotal = packetItemRepository
                                        .countByMasterItemId(
                                                        masterId);

                        long deletingFromMaster = context.packetItems()
                                        .stream()
                                        .filter(item -> item.getMasterItem() != null &&
                                                        masterId.equals(
                                                                        item.getMasterItem().getId()))
                                        .count();

                        if (currentTotal <= deletingFromMaster) {
                                count++;
                        }
                }

                return count;
        }

        /*
         * =====================================================
         * RECONCILE LOGISTICS TRIPS
         * =====================================================
         */

        private TripReconcileResult reconcileLogisticsTrips(
                        Set<UUID> tripIds) {
                long deletedTrips = 0;
                long deletedLocations = 0;

                for (UUID tripId : tripIds) {
                        long remainingTripItems = logisticsTripItemRepository
                                        .countByTripId(tripId);

                        long remainingDispatchItems = dispatchedItemRepository
                                        .countByLogisticsTripId(
                                                        tripId);

                        if (remainingTripItems == 0 &&
                                        remainingDispatchItems == 0) {

                                deletedLocations += logisticsTripLocationRepository
                                                .deleteByTripIdForAdminDeletion(
                                                                tripId);

                                if (logisticsTripRepository.existsById(
                                                tripId)) {
                                        logisticsTripRepository.deleteById(
                                                        tripId);

                                        deletedTrips++;
                                }

                                continue;
                        }

                        LogisticsTrip trip = logisticsTripRepository
                                        .findById(tripId)
                                        .orElse(null);

                        if (trip == null) {
                                continue;
                        }

                        long remainingCount = Math.max(
                                        remainingTripItems,
                                        remainingDispatchItems);

                        trip.setTotalItems(
                                        Math.toIntExact(remainingCount));

                        trip.setUpdatedAt(
                                        LocalDateTime.now(INDIA_ZONE));

                        logisticsTripRepository.save(trip);
                }

                return new TripReconcileResult(
                                deletedTrips,
                                deletedLocations);
        }

        /*
         * =====================================================
         * RECONCILE INTERNAL PACKETS
         * =====================================================
         */

        private PacketReconcileResult reconcileInternalPackets(
                        Set<UUID> packetIds) {
                long deletedPackets = 0;

                List<String> filePaths = new ArrayList<>();

                for (UUID packetId : packetIds) {
                        long remaining = packetItemRepository
                                        .countByPacketId(packetId);

                        if (remaining != 0) {
                                continue;
                        }

                        Packet packet = packetRepository
                                        .findById(packetId)
                                        .orElse(null);

                        if (packet == null) {
                                continue;
                        }

                        if (hasText(packet.getStickerPath())) {
                                filePaths.add(
                                                packet.getStickerPath().trim());
                        }

                        packetRepository.delete(packet);

                        deletedPackets++;
                }

                return new PacketReconcileResult(
                                deletedPackets,
                                List.copyOf(filePaths));
        }

        /*
         * =====================================================
         * RECONCILE MASTER ITEMS
         * =====================================================
         */

        private MasterReconcileResult reconcileMasterItems(
                        Set<UUID> masterIds) {
                long deletedMasters = 0;
                long updatedMasters = 0;

                for (UUID masterId : masterIds) {
                        long remaining = packetItemRepository
                                        .countByMasterItemId(
                                                        masterId);

                        MasterItem master = masterItemRepository
                                        .findById(masterId)
                                        .orElse(null);

                        if (master == null) {
                                continue;
                        }

                        if (remaining == 0) {
                                masterItemRepository.delete(master);

                                deletedMasters++;

                                continue;
                        }

                        master.setTotalPackets(
                                        Math.toIntExact(remaining));

                        masterItemRepository.save(master);

                        updatedMasters++;
                }

                return new MasterReconcileResult(
                                deletedMasters,
                                updatedMasters);
        }

        private MasterReconcileResult deleteExplicitMaster(
                        UUID masterItemId) {
                if (!masterItemRepository.existsById(
                                masterItemId)) {
                        return new MasterReconcileResult(
                                        0,
                                        0);
                }

                masterItemRepository.deleteById(
                                masterItemId);

                return new MasterReconcileResult(
                                1,
                                0);
        }

        /*
         * =====================================================
         * SAVE PERMANENT DELETION RECEIPT
         * =====================================================
         */

        private AdminDeletionAudit saveDeletionAudit(
                        String targetType,
                        String targetId,
                        String displayName,
                        String reason,
                        String actor,
                        Map<String, Long> deletedRows,
                        String snapshotJson) {
                AdminDeletionAudit audit = new AdminDeletionAudit();

                audit.setId(UUID.randomUUID());

                audit.setTargetType(targetType);

                audit.setTargetId(targetId);

                audit.setDisplayName(displayName);

                audit.setReason(reason);

                audit.setDeletedBy(actor);

                audit.setDeletedAt(
                                LocalDateTime.now(INDIA_ZONE));

                audit.setAffectedRowsJson(
                                toJson(deletedRows));

                audit.setSnapshotJson(snapshotJson);

                return adminDeletionAuditRepository.save(
                                audit);
        }

        /*
         * =====================================================
         * FILE CLEANUP AFTER COMMIT
         * =====================================================
         */

        private void scheduleFilesForDeletionAfterCommit(
                        List<String> filePaths) {
                if (filePaths == null ||
                                filePaths.isEmpty()) {
                        return;
                }

                if (!TransactionSynchronizationManager
                                .isSynchronizationActive()) {
                        return;
                }

                TransactionSynchronizationManager
                                .registerSynchronization(
                                                new TransactionSynchronization() {

                                                        @Override
                                                        public void afterCommit() {
                                                                for (String filePath : filePaths) {
                                                                        if (!hasText(filePath)) {
                                                                                continue;
                                                                        }

                                                                        try {
                                                                                Files.deleteIfExists(
                                                                                                Path.of(
                                                                                                                filePath));

                                                                        } catch (Exception exception) {
                                                                                System.err.println(
                                                                                                "Unable to delete sticker file: "
                                                                                                                + filePath);

                                                                                exception.printStackTrace();
                                                                        }
                                                                }
                                                        }
                                                });
        }

        /*
         * =====================================================
         * SNAPSHOTS
         * =====================================================
         */

        private String buildPacketSnapshotJson(
                        PacketItem item,
                        DeletionContext context) {

                Map<String, Object> snapshot = new LinkedHashMap<>();

                snapshot.put(
                                "packetItemId",
                                item.getId());

                snapshot.put(
                                "masterItemId",
                                item.getMasterItem() == null
                                                ? null
                                                : item.getMasterItem().getId());

                snapshot.put(
                                "internalPacketId",
                                item.getPacket() == null
                                                ? null
                                                : item.getPacket().getId());

                snapshot.put(
                                "itemName",
                                item.getItemName());

                snapshot.put(
                                "pdNo",
                                item.getPdNo());

                snapshot.put(
                                "drawingNo",
                                item.getDrawingNo());

                snapshot.put(
                                "packetNumber",
                                item.getPacketNumber());

                snapshot.put(
                                "sku",
                                item.getSku());

                snapshot.put(
                                "stickerNumber",
                                item.getStickerNumber());

                snapshot.put(
                                "status",
                                item.getStatus());

                snapshot.put(
                                "plantCode",
                                item.getPlantCode());

                snapshot.put(
                                "location",
                                firstNonBlank(
                                                item.getCurrentLocationCode(),
                                                item.getLocation(),
                                                null));

                snapshot.put(
                                "itemType",
                                item.getItemType() == null
                                                ? null
                                                : item.getItemType().name());

                snapshot.put(
                                "hardwareLines",
                                buildHardwareLineSnapshots(
                                                item.getId(),
                                                context.hardwarePacketLines()));

                snapshot.put(
                                "dispatchRecords",
                                buildDispatchSnapshots(
                                                context.dispatchedItems()));

                snapshot.put(
                                "tripIds",
                                context.tripIds());

                return toJson(snapshot);
        }

        private String buildMasterSnapshotJson(
                        MasterItem master,
                        DeletionContext context) {
                Map<String, Object> snapshot = new LinkedHashMap<>();

                snapshot.put(
                                "masterItemId",
                                master.getId());

                snapshot.put(
                                "itemName",
                                master.getItemName());

                snapshot.put(
                                "pdNo",
                                master.getPdNo());

                snapshot.put(
                                "drawingName",
                                master.getDrawingName());

                snapshot.put(
                                "clientName",
                                master.getClientName());

                snapshot.put(
                                "address",
                                master.getAddress());

                snapshot.put(
                                "totalPackets",
                                master.getTotalPackets());

                List<Map<String, Object>> packetSnapshots = new ArrayList<>();

                for (PacketItem item : context.packetItems()) {
                        Map<String, Object> packet = new LinkedHashMap<>();

                        packet.put("id", item.getId());
                        packet.put("packetNumber", item.getPacketNumber());
                        packet.put("sku", item.getSku());
                        packet.put("stickerNumber", item.getStickerNumber());
                        packet.put("status", item.getStatus());
                        packet.put("plantCode", item.getPlantCode());
                        packet.put(
                                        "itemType",
                                        item.getItemType() == null
                                                        ? null
                                                        : item.getItemType().name());

                        packet.put(
                                        "hardwareLines",
                                        buildHardwareLineSnapshots(
                                                        item.getId(),
                                                        context.hardwarePacketLines()));
                        packetSnapshots.add(packet);
                }

                snapshot.put(
                                "packets",
                                packetSnapshots);

                snapshot.put(
                                "dispatchRecords",
                                buildDispatchSnapshots(
                                                context.dispatchedItems()));

                snapshot.put(
                                "tripIds",
                                context.tripIds());

                return toJson(snapshot);
        }

        private String buildEmptyMasterSnapshotJson(
                        MasterItem master) {
                Map<String, Object> snapshot = new LinkedHashMap<>();

                snapshot.put(
                                "masterItemId",
                                master.getId());

                snapshot.put(
                                "itemName",
                                master.getItemName());

                snapshot.put(
                                "pdNo",
                                master.getPdNo());

                snapshot.put(
                                "drawingName",
                                master.getDrawingName());

                snapshot.put(
                                "clientName",
                                master.getClientName());

                snapshot.put(
                                "totalPackets",
                                master.getTotalPackets());

                return toJson(snapshot);
        }

        private List<Map<String, Object>> buildDispatchSnapshots(
                        List<DispatchedItem> dispatchedItems) {
                List<Map<String, Object>> result = new ArrayList<>();

                for (DispatchedItem item : dispatchedItems) {
                        Map<String, Object> row = new LinkedHashMap<>();

                        row.put(
                                        "zohoItemId",
                                        item.getZohoItemId());

                        row.put(
                                        "packetItemId",
                                        item.getPacketItemId());

                        row.put(
                                        "status",
                                        item.getStatus() == null
                                                        ? null
                                                        : item.getStatus().name());

                        row.put(
                                        "challanNumber",
                                        item.getChalaanNumber());

                        row.put(
                                        "gatePassNumber",
                                        item.getGatePassNumber());

                        row.put(
                                        "logisticsTripId",
                                        item.getLogisticsTripId());

                        result.add(row);
                }

                return result;
        }


        private DispatchedItem requireDispatchDeleteItem(
                        String rawItemId) {
                String itemId = clean(rawItemId);

                if (itemId == null) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Dispatch item ID is required");
                }

                DispatchedItem item = dispatchedItemRepository
                                .findById(itemId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "Dispatch item not found"));

                if (!hasText(item.getZohoItemId())) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Dispatch item has no valid system ID");
                }

                return item;
        }

        private List<DispatchedItem> requireDispatchDeleteItems(
                        List<String> rawItemIds) {
                List<String> itemIds = cleanUniqueDispatchIds(rawItemIds);

                if (itemIds.isEmpty()) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Select at least one Dispatch item");
                }

                if (itemIds.size() > 500) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "A maximum of 500 Dispatch items can be permanently deleted at once");
                }

                List<DispatchedItem> foundItems = dispatchedItemRepository
                                .findAllById(itemIds);

                Map<String, DispatchedItem> byId = foundItems.stream()
                                .filter(Objects::nonNull)
                                .filter(item -> hasText(item.getZohoItemId()))
                                .collect(Collectors.toMap(
                                                item -> item.getZohoItemId().trim(),
                                                item -> item,
                                                (first, second) -> first,
                                                LinkedHashMap::new));

                List<String> missingIds = itemIds.stream()
                                .filter(id -> !byId.containsKey(id))
                                .toList();

                if (!missingIds.isEmpty()) {
                        throw new ResponseStatusException(
                                        HttpStatus.NOT_FOUND,
                                        "Dispatch items not found: "
                                                        + String.join(", ", missingIds.stream().limit(10).toList()));
                }

                return itemIds.stream()
                                .map(byId::get)
                                .toList();
        }

        private List<String> cleanUniqueDispatchIds(
                        List<String> rawItemIds) {
                if (rawItemIds == null) {
                        return List.of();
                }

                return rawItemIds.stream()
                                .map(this::clean)
                                .filter(Objects::nonNull)
                                .distinct()
                                .toList();
        }

        private String buildDispatchDisplayName(
                        DispatchedItem item) {
                String name = firstNonBlank(
                                item.getName(),
                                "Dispatch Item");

                String identifier = firstNonBlank(
                                item.getSku(),
                                item.getPdNo(),
                                item.getDrawingNo(),
                                item.getZohoItemId());

                return name + " | " + identifier;
        }

        private String buildDispatchWarning(
                        DeletionContext context) {
                if (!context.packetItems().isEmpty()) {
                        return "This Dispatch row is linked to PackFlow packet data. Permanent deletion removes the linked packet item, sticker history, Dispatch/Warehouse/logistics records, activity/audit rows, and empty parent packet/master records where applicable. The deletion snapshot itself remains only in Admin Delete History.";
                }

                if (!context.tripIds().isEmpty()) {
                        return "This standalone Dispatch row has challan/logistics history. Permanent deletion removes the Dispatch record and its linked logistics/activity/audit records. The deletion snapshot itself remains only in Admin Delete History.";
                }

                return "This is a standalone Dispatch/Excel-import record. Permanent deletion removes it from operational data and statistics. The deletion snapshot itself remains only in Admin Delete History.";
        }

        private String buildDispatchSnapshotJson(
                        List<DispatchedItem> dispatchItems,
                        DeletionContext context,
                        String mode) {
                Map<String, Object> snapshot = new LinkedHashMap<>();

                snapshot.put("mode", mode);
                snapshot.put("dispatchItems", buildDispatchItemSnapshots(dispatchItems));
                snapshot.put("linkedPacketItemIds", context.packetItemIds());
                snapshot.put("linkedPacketIds", context.packetIds());
                snapshot.put("linkedMasterItemIds", context.masterIds());
                snapshot.put("affectedTripIds", context.tripIds());
                snapshot.put("lookupIds", context.lookupIds());

                return toJson(snapshot);
        }

        private List<Map<String, Object>> buildDispatchItemSnapshots(
                        List<DispatchedItem> items) {
                List<Map<String, Object>> snapshots = new ArrayList<>();

                for (DispatchedItem item : items) {
                        Map<String, Object> row = new LinkedHashMap<>();

                        row.put("zohoItemId", item.getZohoItemId());
                        row.put("packetItemId", item.getPacketItemId());
                        row.put("packetId", item.getPacketId());
                        row.put("linkedPacketItemId", item.getLinkedPacketItemId());
                        row.put("linkedMasterItemId", item.getLinkedMasterItemId());

                        row.put("name", item.getName());
                        row.put("sku", item.getSku());
                        row.put("pdNo", item.getPdNo());
                        row.put("drawingNo", item.getDrawingNo());
                        row.put("description", item.getDescription());
                        row.put("clientName", item.getClientName());
                        row.put("clientAddress", item.getClientAddress());

                        row.put("status", item.getStatus());
                        row.put("plantCode", item.getPlantCode());
                        row.put("currentLocationCode", item.getCurrentLocationCode());
                        row.put("location", item.getLocation());
                        row.put("warehouseCode", item.getWarehouseCode());
                        row.put("gatePassNumber", item.getGatePassNumber());

                        row.put("chalaanNumber", item.getChalaanNumber());
                        row.put("logisticsTripId", item.getLogisticsTripId());
                        row.put("driverId", item.getDriverId());
                        row.put("driverName", item.getDriverName());
                        row.put("vehicleId", item.getVehicleId());
                        row.put("vehicleNumber", item.getVehicleNumber());

                        row.put("packedAt", item.getPackedAt());
                        row.put("dispatchedAt", item.getDispatchedAt());
                        row.put("tripStartedAt", item.getTripStartedAt());
                        row.put("tripEndedAt", item.getTripEndedAt());
                        row.put("deliveredAt", item.getDeliveredAt());

                        row.put("createdBy", item.getCreatedBy());
                        row.put("createdAt", item.getCreatedAt());
                        row.put("dispatchedBy", item.getDispatchedBy());

                        snapshots.add(row);
                }

                return snapshots;
        }

        private DispatchedItem requireWarehouseDeleteItem(
                        String rawItemId) {
                String itemId = clean(rawItemId);

                if (itemId == null) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Warehouse item ID is required");
                }

                DispatchedItem item = dispatchedItemRepository
                                .findById(itemId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "Warehouse item not found"));

                if (!isWarehouseDeleteCandidate(item)) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Item is not currently visible in Warehouse");
                }

                return item;
        }

        private List<DispatchedItem> requireWarehouseDeleteItems(
                        List<String> rawItemIds) {
                List<String> itemIds = cleanUniqueWarehouseIds(rawItemIds);

                if (itemIds.isEmpty()) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Select at least one Warehouse item");
                }

                if (itemIds.size() > 500) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "A maximum of 500 Warehouse items can be permanently deleted at once");
                }

                List<DispatchedItem> foundItems = dispatchedItemRepository.findAllById(itemIds);

                Map<String, DispatchedItem> byId = foundItems.stream()
                                .filter(Objects::nonNull)
                                .filter(item -> hasText(item.getZohoItemId()))
                                .collect(Collectors.toMap(
                                                DispatchedItem::getZohoItemId,
                                                item -> item,
                                                (first, second) -> first,
                                                LinkedHashMap::new));

                List<String> missingIds = itemIds.stream()
                                .filter(id -> !byId.containsKey(id))
                                .toList();

                if (!missingIds.isEmpty()) {
                        throw new ResponseStatusException(
                                        HttpStatus.NOT_FOUND,
                                        "Warehouse items not found: "
                                                        + String.join(", ", missingIds.stream().limit(10).toList()));
                }

                List<DispatchedItem> ordered = itemIds.stream()
                                .map(byId::get)
                                .toList();

                for (DispatchedItem item : ordered) {
                        if (!isWarehouseDeleteCandidate(item)) {
                                throw new ResponseStatusException(
                                                HttpStatus.BAD_REQUEST,
                                                "Bulk deletion can contain only rows currently visible in Warehouse. Item "
                                                                + item.getZohoItemId()
                                                                + " is "
                                                                + (item.getStatus() == null ? "UNKNOWN"
                                                                                : item.getStatus().name()));
                        }
                }

                return ordered;
        }

        private List<String> cleanUniqueWarehouseIds(
                        List<String> rawItemIds) {
                if (rawItemIds == null) {
                        return List.of();
                }

                return rawItemIds.stream()
                                .map(this::clean)
                                .filter(Objects::nonNull)
                                .distinct()
                                .toList();
        }

        private boolean isWarehouseDeleteCandidate(
                        DispatchedItem item) {
                return item != null
                                && item.getStatus() != null
                                && WAREHOUSE_DELETE_STATUSES.contains(item.getStatus())
                                && hasText(item.getZohoItemId());
        }

        private String buildWarehouseDisplayName(
                        DispatchedItem item) {
                String name = firstNonBlank(
                                item.getName(),
                                "Warehouse Item");

                String identifier = firstNonBlank(
                                item.getSku(),
                                item.getPdNo(),
                                item.getZohoItemId());

                return name + " | " + identifier;
        }

        private String buildWarehouseWarning(
                        DeletionContext context) {
                if (!context.packetItems().isEmpty()) {
                        return "This Warehouse row is linked to PackFlow packet data. Permanent deletion will also remove the linked packet, sticker, dispatch/logistics records, and empty parent packet/master records where applicable.";
                }

                if (!context.tripIds().isEmpty()) {
                        return "This standalone Warehouse row has logistics history. Permanent deletion will remove the Warehouse record and its linked logistics/activity/audit records.";
                }

                return "This is a standalone Warehouse/Excel-import record. Permanent deletion removes the row and any matching activity/audit data without creating or changing PackFlow lifecycle records.";
        }

        private String buildWarehouseSnapshotJson(
                        List<DispatchedItem> warehouseItems,
                        DeletionContext context,
                        String mode) {
                Map<String, Object> snapshot = new LinkedHashMap<>();

                snapshot.put("mode", mode);
                snapshot.put("warehouseItems", buildWarehouseItemSnapshots(warehouseItems));
                snapshot.put("linkedPacketItemIds", context.packetItemIds());
                snapshot.put("linkedPacketIds", context.packetIds());
                snapshot.put("linkedMasterItemIds", context.masterIds());
                snapshot.put("affectedTripIds", context.tripIds());
                snapshot.put("lookupIds", context.lookupIds());

                return toJson(snapshot);
        }

        private List<Map<String, Object>> buildWarehouseItemSnapshots(
                        List<DispatchedItem> items) {
                List<Map<String, Object>> snapshots = new ArrayList<>();

                for (DispatchedItem item : items) {
                        Map<String, Object> row = new LinkedHashMap<>();

                        row.put("zohoItemId", item.getZohoItemId());
                        row.put("packetItemId", item.getPacketItemId());
                        row.put("packetId", item.getPacketId());
                        row.put("linkedPacketItemId", item.getLinkedPacketItemId());
                        row.put("linkedMasterItemId", item.getLinkedMasterItemId());
                        row.put("name", item.getName());
                        row.put("sku", item.getSku());
                        row.put("pdNo", item.getPdNo());
                        row.put("drawingNo", item.getDrawingNo());
                        row.put("description", item.getDescription());
                        row.put("clientName", item.getClientName());
                        row.put("status", item.getStatus());
                        row.put("plantCode", item.getPlantCode());
                        row.put("currentLocationCode", item.getCurrentLocationCode());
                        row.put("location", item.getLocation());
                        row.put("warehouseCode", item.getWarehouseCode());
                        row.put("gatePassNumber", item.getGatePassNumber());
                        row.put("chalaanNumber", item.getChalaanNumber());
                        row.put("logisticsTripId", item.getLogisticsTripId());
                        row.put("createdBy", item.getCreatedBy());
                        row.put("createdAt", item.getCreatedAt());
                        row.put("storedAt", item.getStoredAt());

                        snapshots.add(row);
                }

                return snapshots;
        }

        /*
         * =====================================================
         * DTO MAPPING
         * =====================================================
         */

        private AdminDeleteSearchResult toPacketSearchResult(
                        PacketItem item) {
                MasterItem master = item.getMasterItem();

                return new AdminDeleteSearchResult(
                                "PACKET_ITEM",
                                item.getId().toString(),

                                master == null
                                                ? null
                                                : master.getId().toString(),

                                item.getItemName(),
                                item.getDescription(),
                                item.getPdNo(),
                                item.getDrawingNo(),
                                item.getPacketNumber(),
                                item.getSku(),
                                item.getStickerNumber(),
                                item.getStatus(),

                                firstNonBlank(
                                                item.getCurrentLocationCode(),
                                                item.getLocation(),
                                                ""),

                                item.getPlantCode(),

                                master == null
                                                ? null
                                                : master.getTotalPackets());
        }

        private AdminDeleteSearchResult toMasterSearchResult(
                        MasterItem master) {
                return new AdminDeleteSearchResult(
                                "MASTER_ITEM",
                                master.getId().toString(),
                                master.getId().toString(),
                                master.getItemName(),
                                "",
                                master.getPdNo(),
                                master.getDrawingName(),
                                null,
                                null,
                                null,
                                "MASTER",
                                null,
                                master.getPlantCode(),
                                master.getTotalPackets());
        }

        private AdminDeleteSearchResult toWarehouseSearchResult(
                        DispatchedItem item) {
                return new AdminDeleteSearchResult(
                                "WAREHOUSE_ITEM",
                                item.getZohoItemId(),
                                item.getLinkedMasterItemId() == null
                                                ? null
                                                : item.getLinkedMasterItemId().toString(),
                                item.getName(),
                                item.getDescription(),
                                item.getPdNo(),
                                item.getDrawingNo(),
                                null,
                                item.getSku(),
                                item.getStickerNumber(),
                                item.getStatus() == null
                                                ? null
                                                : item.getStatus().name(),
                                firstNonBlank(
                                                item.getCurrentLocationCode(),
                                                item.getWarehouseCode(),
                                                item.getLocation(),
                                                ""),
                                item.getPlantCode(),
                                null);
        }

        /*
         * =====================================================
         * VALIDATION
         * =====================================================
         */

        private void assertAdmin(
                        User user) {
                if (!currentUserService.isAdmin(user)) {
                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "Only ADMIN can permanently delete records");
                }
        }

        private void validateDeleteRequest(
                        AdminDeleteRequest request,
                        String requiredConfirmation) {
                if (request == null) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Deletion request is missing");
                }

                cleanRequiredReason(
                                request.reason());

                String confirmation = clean(request.confirmationText());

                if (confirmation == null ||
                                !confirmation.equalsIgnoreCase(
                                                requiredConfirmation)) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Confirmation text does not match. Type exactly: "
                                                        + requiredConfirmation);
                }
        }

        private String cleanRequiredReason(
                        String value) {
                String reason = clean(value);

                if (reason == null ||
                                reason.length() < 5) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Deletion reason must contain at least 5 characters");
                }

                if (reason.length() > 1000) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Deletion reason cannot exceed 1000 characters");
                }

                return reason;
        }

        private String normalizeSearchQuery(
                        String value) {
                String query = clean(value);

                if (query == null) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Search query is required");
                }

                if (query.length() > 200) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Search query is too long");
                }

                return query;
        }

        /*
         * =====================================================
         * DISPLAY HELPERS
         * =====================================================
         */

        private String buildPacketDisplayName(
                        PacketItem item) {
                String itemName = firstNonBlank(
                                item.getItemName(),
                                "Packet");

                String packetNo = firstNonBlank(
                                item.getPacketNumber(),
                                item.getId().toString());

                return itemName + " | " + packetNo;
        }

        private String buildMasterDisplayName(
                        MasterItem master) {
                String name = firstNonBlank(
                                master.getItemName(),
                                "Master Item");

                String pdNo = firstNonBlank(
                                master.getPdNo(),
                                master.getId().toString());

                return name + " | " + pdNo;
        }

        private String buildPacketWarning(
                        PacketItem item,
                        Map<String, Long> affectedRows) {
                long dispatched = affectedRows.getOrDefault(
                                "dispatchedItems",
                                0L);

                long trips = affectedRows.getOrDefault(
                                "affectedTrips",
                                0L);

                long stickers = affectedRows.getOrDefault(
                                "stickerHistory",
                                0L);

                if (dispatched > 0 ||
                                trips > 0) {
                        return "This packet has dispatch, warehouse or challan history. The ADMIN deletion will remove that linked history.";
                }

                if (stickers > 0) {
                        return "This packet has generated sticker history. All stored sticker PDFs will be removed.";
                }

                return "This packet has no dispatch history, but deletion is still permanent.";
        }

        /*
         * =====================================================
         * GENERAL HELPERS
         * =====================================================
         */

        private String toJson(
                        Object value) {
                try {
                        return objectMapper
                                        .writeValueAsString(value);

                } catch (JsonProcessingException exception) {
                        throw new RuntimeException(
                                        "Could not create deletion audit JSON",
                                        exception);
                }
        }

        private UUID tryParseUuid(
                        String value) {
                try {
                        return UUID.fromString(value);

                } catch (Exception ignored) {
                        return null;
                }
        }

        private boolean hasText(
                        String value) {
                return value != null &&
                                !value.trim().isBlank();
        }

        private String clean(
                        String value) {
                if (value == null) {
                        return null;
                }

                String clean = value.trim();

                return clean.isBlank()
                                ? null
                                : clean;
        }

        private String safeActor(
                        String username) {
                return hasText(username)
                                ? username.trim()
                                : "SYSTEM";
        }

        private String safe(
                        Object value) {
                if (value == null) {
                        return "-";
                }

                String text = value.toString().trim();

                return text.isBlank()
                                ? "-"
                                : text;
        }

        private String firstNonBlank(
                        String... values) {
                if (values == null) {
                        return null;
                }

                for (String value : values) {
                        if (value != null &&
                                        !value.trim().isBlank()) {
                                return value.trim();
                        }
                }

                return null;
        }

        /*
         * =====================================================
         * INTERNAL RECORDS
         * =====================================================
         */

        private record DeletionContext(
                        List<PacketItem> packetItems,
                        Set<UUID> packetItemIds,
                        Set<UUID> packetIds,
                        Set<UUID> masterIds,
                        Set<String> lookupIds,
                        List<HardwarePacketLine> hardwarePacketLines,
                        List<DispatchedItem> dispatchedItems,
                        List<LogisticsTripItem> tripItems,
                        Set<UUID> tripIds) {
        }

        private record TripReconcileResult(
                        long deletedTrips,
                        long deletedLocations) {
        }

        private record PacketReconcileResult(
                        long deletedPackets,
                        List<String> filePaths) {
        }

        private record MasterReconcileResult(
                        long deletedMasters,
                        long updatedMasters) {
        }
}