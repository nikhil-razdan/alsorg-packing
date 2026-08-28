package com.alsorg.packing.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.config.TimeZoneConfig;
import com.alsorg.packing.controller.dto.admin.AdminDeleteResultResponse;
import com.alsorg.packing.controller.dto.admin.PacketDeletionRequestDtos.DecisionRequest;
import com.alsorg.packing.controller.dto.admin.PacketDeletionRequestDtos.DecisionResponse;
import com.alsorg.packing.controller.dto.admin.PacketDeletionRequestDtos.RequestResponse;
import com.alsorg.packing.controller.dto.admin.PacketDeletionRequestDtos.SubmitRequest;
import com.alsorg.packing.controller.dto.admin.PacketDeletionRequestDtos.SubmitResponse;
import com.alsorg.packing.domain.admin.PacketDeletionRequest;
import com.alsorg.packing.domain.admin.PacketDeletionRequestStatus;
import com.alsorg.packing.domain.admin.PacketLifecycleChangeRequestStatus;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.item.PacketItem;
import com.alsorg.packing.domain.sticker.StickerHistory;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.repository.PacketDeletionRequestRepository;
import com.alsorg.packing.repository.PacketItemRepository;
import com.alsorg.packing.repository.PacketLifecycleChangeRequestRepository;
import com.alsorg.packing.repository.StickerHistoryRepository;

@Service
public class PacketDeletionRequestService {

    private static final java.time.ZoneId APP_ZONE = TimeZoneConfig.APP_ZONE;

    private static final int MAX_BATCH_SIZE = 200;
    private static final int MAX_PENDING_PAGE_SIZE = 100;
    private static final int MAX_REASON_LENGTH = 1000;
    private static final int MAX_DECISION_REASON_LENGTH = 500;

    private static final String SOURCE_DISPATCH = "DISPATCH";
    private static final String SOURCE_INVENTORY_HISTORY = "INVENTORY_HISTORY";

    private static final String TARGET_PACKET_ITEM = "PACKET_ITEM";
    private static final String TARGET_DISPATCH_ITEM = "DISPATCH_ITEM";

    private final PacketDeletionRequestRepository requestRepository;
    private final PacketLifecycleChangeRequestRepository lifecycleRequestRepository;
    private final PacketItemRepository packetItemRepository;
    private final DispatchedItemRepository dispatchedItemRepository;
    private final StickerHistoryRepository stickerHistoryRepository;
    private final AdminDeletionService adminDeletionService;
    private final CurrentUserService currentUserService;

    public PacketDeletionRequestService(
            PacketDeletionRequestRepository requestRepository,
            PacketLifecycleChangeRequestRepository lifecycleRequestRepository,
            PacketItemRepository packetItemRepository,
            DispatchedItemRepository dispatchedItemRepository,
            StickerHistoryRepository stickerHistoryRepository,
            AdminDeletionService adminDeletionService,
            CurrentUserService currentUserService) {
        this.requestRepository = requestRepository;
        this.lifecycleRequestRepository = lifecycleRequestRepository;
        this.packetItemRepository = packetItemRepository;
        this.dispatchedItemRepository = dispatchedItemRepository;
        this.stickerHistoryRepository = stickerHistoryRepository;
        this.adminDeletionService = adminDeletionService;
        this.currentUserService = currentUserService;
    }

    /**
     * Creates immutable PENDING deletion requests. No operational PackFlow data
     * is deleted here. The same PacketItem/Dispatch rows used by permanent
     * deletion are pessimistically locked before duplicate/conflict checks, so
     * a user request cannot race past an Admin deletion.
     */
    @Transactional
    public SubmitResponse submit(
            SubmitRequest request,
            User user) {
        requireAuthenticated(user);

        if (request == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Deletion request is required");
        }

        String source = normalizeSource(request.source());
        assertSourceAccess(source, user);

        String reason = cleanRequiredReason(request.reason());
        List<String> targetIds = normalizeTargetIds(request.targetIds());

        Map<String, ResolvedTarget> resolvedByTargetKey = new LinkedHashMap<>();

        for (String rawTargetId : targetIds) {
            ResolvedTarget target = resolveTarget(
                    source,
                    rawTargetId,
                    user);

            resolvedByTargetKey.putIfAbsent(
                    target.targetKey(),
                    target);
        }

        if (resolvedByTargetKey.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "No valid items were selected for deletion request");
        }

        if (resolvedByTargetKey.size() > MAX_BATCH_SIZE) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "A maximum of " + MAX_BATCH_SIZE + " items can be requested at once");
        }

        List<ResolvedTarget> orderedTargets = new ArrayList<>(
                resolvedByTargetKey.values());

        orderedTargets.sort(
                Comparator.comparing(ResolvedTarget::targetKey));

        UUID requestGroupId = UUID.randomUUID();
        LocalDateTime now = LocalDateTime.now(APP_ZONE);
        String actor = cleanActor(user.getUsername());

        List<PacketDeletionRequest> created = new ArrayList<>();

        for (ResolvedTarget target : orderedTargets) {
            RequestSnapshot snapshot = lockAndRefreshTarget(
                    target,
                    source,
                    user);

            if (requestRepository.existsByTargetKeyAndStatus(
                    target.targetKey(),
                    PacketDeletionRequestStatus.PENDING)) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "A pending deletion request already exists for "
                                + snapshot.displayName());
            }

            if (snapshot.packetItemId() != null
                    && lifecycleRequestRepository.existsByPacketItemIdAndStatus(
                            snapshot.packetItemId(),
                            PacketLifecycleChangeRequestStatus.PENDING)) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        snapshot.displayName()
                                + " already has a pending lifecycle state-change request. "
                                + "That request must be approved or rejected before a deletion request can be created.");
            }

            PacketDeletionRequest entity = new PacketDeletionRequest();
            entity.setId(UUID.randomUUID());
            entity.setRequestGroupId(requestGroupId);
            entity.setTargetKey(target.targetKey());
            entity.setTargetType(target.targetType());
            entity.setTargetId(target.targetId());
            entity.setPacketItemId(snapshot.packetItemId());
            entity.setDispatchItemId(snapshot.dispatchItemId());
            entity.setSourceReferenceId(target.sourceReferenceId());
            entity.setDisplayName(snapshot.displayName());
            entity.setItemName(snapshot.itemName());
            entity.setPacketNumber(snapshot.packetNumber());
            entity.setSku(snapshot.sku());
            entity.setPdNo(snapshot.pdNo());
            entity.setDrawingNo(snapshot.drawingNo());
            entity.setPlantCode(snapshot.plantCode());
            entity.setSource(source);
            entity.setReason(reason);
            entity.setRequestedBy(actor);
            entity.setRequestedAt(now);
            entity.setRequestedStatus(snapshot.status());
            entity.setRequestedLocation(snapshot.location());
            entity.setStatus(PacketDeletionRequestStatus.PENDING);

            created.add(entity);
        }

        try {
            List<PacketDeletionRequest> saved = requestRepository.saveAll(created);
            requestRepository.flush();

            List<RequestResponse> responses = saved.stream()
                    .map(this::toResponse)
                    .toList();

            return new SubmitResponse(
                    requestGroupId,
                    responses.size(),
                    responses,
                    responses.size() == 1
                            ? "Deletion request sent to Admin for approval"
                            : responses.size() + " deletion requests sent to Admin for approval");
        } catch (DataIntegrityViolationException exception) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "One or more selected items already have a pending deletion request. Refresh and try again.",
                    exception);
        }
    }

    @Transactional(readOnly = true)
    public Page<RequestResponse> getPending(
            Pageable pageable,
            User user) {
        requireAdmin(user);

        Pageable safePageable = boundedPendingPageable(
                pageable);

        return requestRepository
                .findByStatusOrderByRequestedAtAscIdAsc(
                        PacketDeletionRequestStatus.PENDING,
                        safePageable)
                .map(this::toResponse);
    }

    /**
     * Bulk approval is atomic. Every selected request is locked first and then
     * routed through the existing AdminDeletionService. If one target is stale,
     * missing, conflicted, or cannot be deleted, the whole approval transaction
     * rolls back and no selected request is partially approved.
     */
    @Transactional
    public DecisionResponse approve(
            DecisionRequest request,
            User user) {
        requireAdmin(user);

        List<UUID> requestIds = normalizeDecisionIds(request);
        String adminNote = cleanOptionalDecisionReason(
                request == null ? null : request.reason());

        List<PacketDeletionRequest> requests = lockPendingRequests(requestIds);

        String actor = cleanActor(user.getUsername());
        LocalDateTime now = LocalDateTime.now(APP_ZONE);

        for (PacketDeletionRequest deletionRequest : requests) {
            /*
             * Permanent deletion approval must apply to the same live state the
             * user actually requested. If the item moved after submission, the
             * old request is stale and the Admin must reject it / ask the user to
             * submit a fresh request. This prevents an approval for an earlier
             * Inventory/Dispatch state from unexpectedly deleting a later-stage
             * operational record.
             */
            assertRequestTargetStillCurrent(deletionRequest);

            AdminDeleteResultResponse result;

            if (TARGET_PACKET_ITEM.equals(deletionRequest.getTargetType())) {
                UUID packetItemId = deletionRequest.getPacketItemId();

                if (packetItemId == null) {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "Deletion request is missing its PacketItem linkage");
                }

                result = adminDeletionService.deletePacketItemForApprovedRequest(
                        packetItemId,
                        deletionRequest.getReason(),
                        actor,
                        deletionRequest.getId());
            } else if (TARGET_DISPATCH_ITEM.equals(deletionRequest.getTargetType())) {
                String dispatchItemId = clean(deletionRequest.getDispatchItemId());

                if (dispatchItemId.isBlank()) {
                    dispatchItemId = clean(deletionRequest.getTargetId());
                }

                if (dispatchItemId.isBlank()) {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "Deletion request is missing its Dispatch item linkage");
                }

                result = adminDeletionService.deleteDispatchItemForApprovedRequest(
                        dispatchItemId,
                        deletionRequest.getReason(),
                        actor,
                        deletionRequest.getId());
            } else {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Unsupported deletion request target type: "
                                + deletionRequest.getTargetType());
            }

            deletionRequest.setStatus(PacketDeletionRequestStatus.APPROVED);
            deletionRequest.setDecidedBy(actor);
            deletionRequest.setDecidedAt(now);
            deletionRequest.setDecisionReason(adminNote);
            deletionRequest.setDeletionAuditId(result.deletionAuditId());
            deletionRequest.setDeletionMessage(cleanNullable(result.message()));
        }

        List<PacketDeletionRequest> saved = requestRepository.saveAll(requests);
        requestRepository.flush();

        List<RequestResponse> responses = saved.stream()
                .map(this::toResponse)
                .toList();

        return new DecisionResponse(
                responses.size(),
                responses,
                responses.size() == 1
                        ? "Deletion request approved and item permanently deleted"
                        : responses.size() + " deletion requests approved and items permanently deleted");
    }

    @Transactional
    public DecisionResponse reject(
            DecisionRequest request,
            User user) {
        requireAdmin(user);

        List<UUID> requestIds = normalizeDecisionIds(request);
        String rejectionReason = cleanRequiredDecisionReason(
                request == null ? null : request.reason());

        List<PacketDeletionRequest> requests = lockPendingRequests(requestIds);

        String actor = cleanActor(user.getUsername());
        LocalDateTime now = LocalDateTime.now(APP_ZONE);

        for (PacketDeletionRequest deletionRequest : requests) {
            deletionRequest.setStatus(PacketDeletionRequestStatus.REJECTED);
            deletionRequest.setDecidedBy(actor);
            deletionRequest.setDecidedAt(now);
            deletionRequest.setDecisionReason(rejectionReason);
        }

        List<PacketDeletionRequest> saved = requestRepository.saveAll(requests);
        requestRepository.flush();

        List<RequestResponse> responses = saved.stream()
                .map(this::toResponse)
                .toList();

        return new DecisionResponse(
                responses.size(),
                responses,
                responses.size() == 1
                        ? "Deletion request rejected"
                        : responses.size() + " deletion requests rejected");
    }

    private List<PacketDeletionRequest> lockPendingRequests(
            List<UUID> requestIds) {
        List<PacketDeletionRequest> rows = requestRepository
                .findAllByIdForDecision(requestIds);

        if (rows.size() != requestIds.size()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "One or more selected deletion requests no longer exist");
        }

        for (PacketDeletionRequest row : rows) {
            if (row.getStatus() != PacketDeletionRequestStatus.PENDING) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "One or more selected deletion requests have already been decided");
            }
        }

        return rows;
    }

    private ResolvedTarget resolveTarget(
            String source,
            String rawTargetId,
            User user) {
        String targetId = clean(rawTargetId);

        if (SOURCE_INVENTORY_HISTORY.equals(source)) {
            UUID historyId = parseUuid(
                    targetId,
                    "Generated History id is invalid");

            StickerHistory history = stickerHistoryRepository
                    .findByIdWithPacketItem(historyId)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND,
                            "Generated History record not found"));

            assertGeneratedHistoryOwnership(history, user);

            PacketItem packetItem = history.getPacketItem();

            if (packetItem == null || packetItem.getId() == null) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Generated History record is no longer linked to a packet item");
            }

            assertPacketPlantAccess(packetItem, user);

            return packetTarget(
                    packetItem.getId(),
                    null,
                    historyId.toString());
        }

        DispatchedItem dispatchedItem = dispatchedItemRepository
                .findById(targetId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Dispatch item not found: " + targetId));

        assertDispatchPlantAccess(dispatchedItem, user);

        UUID linkedPacketItemId = resolveLinkedPacketItemId(dispatchedItem);

        if (linkedPacketItemId != null) {
            PacketItem packetItem = packetItemRepository
                    .findById(linkedPacketItemId)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "Dispatch item points to a PacketItem that no longer exists"));

            assertPacketAndDispatchPlantsAgree(
                    packetItem,
                    dispatchedItem);
            assertPacketPlantAccess(packetItem, user);

            return packetTarget(
                    packetItem.getId(),
                    dispatchedItem.getZohoItemId(),
                    dispatchedItem.getZohoItemId());
        }

        String dispatchId = clean(dispatchedItem.getZohoItemId());

        if (dispatchId.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Dispatch item has no valid system ID");
        }

        return new ResolvedTarget(
                TARGET_DISPATCH_ITEM,
                dispatchId,
                TARGET_DISPATCH_ITEM + ":" + dispatchId,
                null,
                dispatchId,
                dispatchId);
    }

    private ResolvedTarget packetTarget(
            UUID packetItemId,
            String dispatchItemId,
            String sourceReferenceId) {
        String id = packetItemId.toString();

        return new ResolvedTarget(
                TARGET_PACKET_ITEM,
                id,
                TARGET_PACKET_ITEM + ":" + id,
                packetItemId,
                cleanNullable(dispatchItemId),
                clean(sourceReferenceId));
    }

    private RequestSnapshot lockAndRefreshTarget(
            ResolvedTarget target,
            String source,
            User user) {
        if (TARGET_PACKET_ITEM.equals(target.targetType())) {
            PacketItem packetItem = packetItemRepository
                    .findByIdForAdminRollback(target.packetItemId())
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND,
                            "Packet item no longer exists: " + target.packetItemId()));

            DispatchedItem dispatchItem = null;

            if (target.dispatchItemId() != null
                    && !target.dispatchItemId().isBlank()) {
                dispatchItem = dispatchedItemRepository
                        .findByIdForAdminRollback(target.dispatchItemId())
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.CONFLICT,
                                "The selected Dispatch row changed while the deletion request was being created. Refresh and try again."));

                UUID liveLinkedPacketItemId = resolveLinkedPacketItemId(dispatchItem);

                if (!packetItem.getId().equals(liveLinkedPacketItemId)) {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "The selected Dispatch row changed its PacketItem linkage. Refresh and try again.");
                }

                assertPacketAndDispatchPlantsAgree(
                        packetItem,
                        dispatchItem);
                assertDispatchPlantAccess(dispatchItem, user);
            }

            if (SOURCE_INVENTORY_HISTORY.equals(source)) {
                UUID historyId = parseUuid(
                        target.sourceReferenceId(),
                        "Generated History id is invalid");

                StickerHistory liveHistory = stickerHistoryRepository
                        .findByIdWithPacketItem(historyId)
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.CONFLICT,
                                "Generated History record changed while the deletion request was being created. Refresh and try again."));

                assertGeneratedHistoryOwnership(liveHistory, user);

                if (liveHistory.getPacketItem() == null
                        || !packetItem.getId().equals(liveHistory.getPacketItem().getId())) {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "Generated History record no longer points to the selected packet. Refresh and try again.");
                }
            }

            assertPacketPlantAccess(packetItem, user);

            return snapshotPacket(
                    packetItem,
                    dispatchItem);
        }

        DispatchedItem dispatchItem = dispatchedItemRepository
                .findByIdForAdminRollback(target.dispatchItemId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Dispatch item no longer exists: " + target.dispatchItemId()));

        if (resolveLinkedPacketItemId(dispatchItem) != null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This Dispatch row gained a PacketItem linkage while the request was being created. Refresh and submit the request again so the complete packet graph is targeted safely.");
        }

        assertDispatchPlantAccess(dispatchItem, user);

        return snapshotDispatch(dispatchItem);
    }

    private void assertRequestTargetStillCurrent(
            PacketDeletionRequest request) {
        if (request == null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Deletion request is missing");
        }

        if (TARGET_PACKET_ITEM.equals(request.getTargetType())) {
            UUID packetItemId = request.getPacketItemId();

            if (packetItemId == null) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Deletion request is missing its PacketItem linkage");
            }

            PacketItem packetItem = packetItemRepository
                    .findByIdForAdminRollback(packetItemId)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "This deletion request is stale because the packet item no longer exists"));

            if (SOURCE_DISPATCH.equals(request.getSource())) {
                String dispatchItemId = clean(request.getDispatchItemId());

                if (dispatchItemId.isBlank()) {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "This Dispatch deletion request is missing its Dispatch-row snapshot");
                }

                DispatchedItem dispatchItem = dispatchedItemRepository
                        .findByIdForAdminRollback(dispatchItemId)
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.CONFLICT,
                                "This deletion request is stale because the Dispatch row no longer exists"));

                UUID livePacketItemId = resolveLinkedPacketItemId(dispatchItem);

                if (!packetItemId.equals(livePacketItemId)) {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "This deletion request is stale because the Dispatch-to-packet linkage changed after the request was submitted");
                }

                assertSnapshotStillCurrent(
                        request,
                        dispatchItem.getStatus() == null
                                ? null
                                : dispatchItem.getStatus().name(),
                        firstNonBlankNullable(
                                dispatchItem.getCurrentLocationCode(),
                                dispatchItem.getLocation(),
                                packetItem.getCurrentLocationCode(),
                                packetItem.getLocation()));

                return;
            }

            assertSnapshotStillCurrent(
                    request,
                    cleanNullable(packetItem.getStatus()),
                    firstNonBlankNullable(
                            packetItem.getCurrentLocationCode(),
                            packetItem.getLocation()));

            return;
        }

        if (TARGET_DISPATCH_ITEM.equals(request.getTargetType())) {
            String dispatchItemId = clean(request.getDispatchItemId());

            if (dispatchItemId.isBlank()) {
                dispatchItemId = clean(request.getTargetId());
            }

            if (dispatchItemId.isBlank()) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Deletion request is missing its Dispatch item linkage");
            }

            DispatchedItem dispatchItem = dispatchedItemRepository
                    .findByIdForAdminRollback(dispatchItemId)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "This deletion request is stale because the Dispatch item no longer exists"));

            if (resolveLinkedPacketItemId(dispatchItem) != null) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "This standalone Dispatch deletion request is stale because the row is now linked to a PacketItem. Reject it and submit a fresh request so the complete linked packet graph is reviewed explicitly.");
            }

            assertSnapshotStillCurrent(
                    request,
                    dispatchItem.getStatus() == null
                            ? null
                            : dispatchItem.getStatus().name(),
                    firstNonBlankNullable(
                            dispatchItem.getCurrentLocationCode(),
                            dispatchItem.getWarehouseCode(),
                            dispatchItem.getLocation()));

            return;
        }

        throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Unsupported deletion request target type: "
                        + request.getTargetType());
    }

    private void assertSnapshotStillCurrent(
            PacketDeletionRequest request,
            String liveStatus,
            String liveLocation) {
        String requestedStatus = clean(request.getRequestedStatus());
        String requestedLocation = clean(request.getRequestedLocation());
        String currentStatus = clean(liveStatus);
        String currentLocation = clean(liveLocation);

        boolean sameStatus = requestedStatus.equalsIgnoreCase(currentStatus);
        boolean sameLocation = requestedLocation.equalsIgnoreCase(currentLocation);

        if (sameStatus && sameLocation) {
            return;
        }

        throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "This deletion request is stale because the item changed after submission. "
                        + "Requested snapshot was status '"
                        + displaySnapshotValue(requestedStatus)
                        + "' at location '"
                        + displaySnapshotValue(requestedLocation)
                        + "', but the live item is now status '"
                        + displaySnapshotValue(currentStatus)
                        + "' at location '"
                        + displaySnapshotValue(currentLocation)
                        + "'. Reject the old request and submit a fresh deletion request if deletion is still required.");
    }

    private String displaySnapshotValue(
            String value) {
        String cleanValue = clean(value);

        return cleanValue.isBlank()
                ? "-"
                : cleanValue;
    }

    private RequestSnapshot snapshotPacket(
            PacketItem packetItem,
            DispatchedItem dispatchItem) {
        String itemName = firstNonBlank(
                packetItem.getItemName(),
                dispatchItem == null ? null : dispatchItem.getName(),
                "Packet");

        String packetNumber = cleanNullable(packetItem.getPacketNumber());
        String sku = firstNonBlankNullable(
                packetItem.getSku(),
                dispatchItem == null ? null : dispatchItem.getSku());
        String pdNo = firstNonBlankNullable(
                packetItem.getPdNo(),
                dispatchItem == null ? null : dispatchItem.getPdNo());
        String drawingNo = firstNonBlankNullable(
                packetItem.getDrawingNo(),
                dispatchItem == null ? null : dispatchItem.getDrawingNo());
        String plantCode = firstNonBlankNullable(
                packetItem.getPlantCode(),
                dispatchItem == null ? null : dispatchItem.getPlantCode());

        String displayName = itemName;

        if (packetNumber != null) {
            displayName += " | " + packetNumber;
        } else if (sku != null) {
            displayName += " | " + sku;
        }

        String status = dispatchItem != null && dispatchItem.getStatus() != null
                ? dispatchItem.getStatus().name()
                : cleanNullable(packetItem.getStatus());

        String location = firstNonBlankNullable(
                dispatchItem == null ? null : dispatchItem.getCurrentLocationCode(),
                dispatchItem == null ? null : dispatchItem.getLocation(),
                packetItem.getCurrentLocationCode(),
                packetItem.getLocation());

        return new RequestSnapshot(
                packetItem.getId(),
                dispatchItem == null ? null : cleanNullable(dispatchItem.getZohoItemId()),
                displayName,
                itemName,
                packetNumber,
                sku,
                pdNo,
                drawingNo,
                plantCode,
                status,
                location);
    }

    private RequestSnapshot snapshotDispatch(
            DispatchedItem item) {
        String itemName = firstNonBlank(
                item.getName(),
                "Dispatch Item");

        String identifier = firstNonBlankNullable(
                item.getSku(),
                item.getPdNo(),
                item.getDrawingNo(),
                item.getZohoItemId());

        String displayName = identifier == null
                ? itemName
                : itemName + " | " + identifier;

        return new RequestSnapshot(
                null,
                cleanNullable(item.getZohoItemId()),
                displayName,
                itemName,
                null,
                cleanNullable(item.getSku()),
                cleanNullable(item.getPdNo()),
                cleanNullable(item.getDrawingNo()),
                cleanNullable(item.getPlantCode()),
                item.getStatus() == null ? null : item.getStatus().name(),
                firstNonBlankNullable(
                        item.getCurrentLocationCode(),
                        item.getWarehouseCode(),
                        item.getLocation()));
    }

    private UUID resolveLinkedPacketItemId(
            DispatchedItem item) {
        if (item == null) {
            return null;
        }

        if (item.getPacketItemId() != null) {
            return item.getPacketItemId();
        }

        return item.getLinkedPacketItemId();
    }

    private void assertSourceAccess(
            String source,
            User user) {
        if (currentUserService.isAdmin(user)) {
            return;
        }

        if (SOURCE_DISPATCH.equals(source)) {
            if (currentUserService.isDispatch(user)) {
                return;
            }

            throw new AccessDeniedException(
                    "DISPATCH access is required to request deletion from the Dispatch page");
        }

        if (SOURCE_INVENTORY_HISTORY.equals(source)) {
            if (currentUserService.isNormalPacking(user)) {
                return;
            }

            throw new AccessDeniedException(
                    "Packing access is required to request deletion from Generated History");
        }

        throw new AccessDeniedException(
                "Deletion request source is not permitted");
    }

    private void assertPacketPlantAccess(
            PacketItem packetItem,
            User user) {
        if (currentUserService.isAdmin(user)) {
            return;
        }

        String plantCode = clean(packetItem == null ? null : packetItem.getPlantCode());

        if (plantCode.isBlank()) {
            throw new AccessDeniedException(
                    "Legacy packet has no plant assignment. An admin must assign its plant before a user can request permanent deletion.");
        }

        if (!currentUserService.canAccessPlant(user, plantCode)) {
            throw new AccessDeniedException(
                    "You do not have access to packet plant " + plantCode);
        }
    }

    private void assertDispatchPlantAccess(
            DispatchedItem item,
            User user) {
        if (currentUserService.isAdmin(user)) {
            return;
        }

        String plantCode = clean(item == null ? null : item.getPlantCode());

        if (plantCode.isBlank()) {
            throw new AccessDeniedException(
                    "Legacy Dispatch item has no plant assignment. An admin must assign its plant before a user can request permanent deletion.");
        }

        if (!currentUserService.canAccessPlant(user, plantCode)) {
            throw new AccessDeniedException(
                    "You do not have access to Dispatch item plant " + plantCode);
        }
    }

    private void assertPacketAndDispatchPlantsAgree(
            PacketItem packetItem,
            DispatchedItem dispatchItem) {
        String packetPlant = clean(packetItem == null ? null : packetItem.getPlantCode());
        String dispatchPlant = clean(dispatchItem == null ? null : dispatchItem.getPlantCode());

        if (!packetPlant.isBlank()
                && !dispatchPlant.isBlank()
                && !packetPlant.equalsIgnoreCase(dispatchPlant)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Packet and Dispatch plant linkage is inconsistent. An admin must repair the linkage before deletion can be requested.");
        }
    }

    private void assertGeneratedHistoryOwnership(
            StickerHistory history,
            User user) {
        if (currentUserService.isAdmin(user)) {
            return;
        }

        if (history == null) {
            throw new AccessDeniedException(
                    "Generated History ownership could not be verified");
        }

        String generatedBy = clean(history.getGeneratedBy());
        String username = clean(user.getUsername());

        if (generatedBy.isBlank()
                || username.isBlank()
                || !generatedBy.equalsIgnoreCase(username)) {
            throw new AccessDeniedException(
                    "You can request permanent deletion only from your own Generated History");
        }
    }

    private Pageable boundedPendingPageable(
            Pageable pageable) {

        if (pageable == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Pending request page is required");
        }

        return PageRequest.of(
                Math.max(0, pageable.getPageNumber()),
                Math.max(
                        1,
                        Math.min(
                                pageable.getPageSize(),
                                MAX_PENDING_PAGE_SIZE)),
                pageable.getSort());
    }

    private List<String> normalizeTargetIds(
            List<String> values) {
        if (values == null || values.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Select at least one item");
        }

        Set<String> unique = new LinkedHashSet<>();

        for (String value : values) {
            String clean = clean(value);

            if (!clean.isBlank()) {
                unique.add(clean);
            }
        }

        if (unique.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Select at least one valid item");
        }

        if (unique.size() > MAX_BATCH_SIZE) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "A maximum of " + MAX_BATCH_SIZE + " items can be requested at once");
        }

        return List.copyOf(unique);
    }

    private List<UUID> normalizeDecisionIds(
            DecisionRequest request) {
        if (request == null
                || request.requestIds() == null
                || request.requestIds().isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Select at least one pending deletion request");
        }

        Set<UUID> unique = new LinkedHashSet<>();

        for (UUID requestId : request.requestIds()) {
            if (requestId != null) {
                unique.add(requestId);
            }
        }

        if (unique.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Select at least one valid deletion request");
        }

        if (unique.size() > MAX_BATCH_SIZE) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "A maximum of " + MAX_BATCH_SIZE + " requests can be processed at once");
        }

        return List.copyOf(unique);
    }

    private String normalizeSource(
            String value) {
        String source = clean(value).toUpperCase();

        if (SOURCE_DISPATCH.equals(source)
                || SOURCE_INVENTORY_HISTORY.equals(source)) {
            return source;
        }

        throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Deletion request source must be DISPATCH or INVENTORY_HISTORY");
    }

    private String cleanRequiredReason(
            String value) {
        String reason = clean(value);

        if (reason.length() < 5) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Deletion reason must contain at least 5 characters");
        }

        if (reason.length() > MAX_REASON_LENGTH) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Deletion reason cannot exceed " + MAX_REASON_LENGTH + " characters");
        }

        return reason;
    }

    private String cleanRequiredDecisionReason(
            String value) {
        String reason = clean(value);

        if (reason.length() < 3) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Rejection reason must contain at least 3 characters");
        }

        if (reason.length() > MAX_DECISION_REASON_LENGTH) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Decision reason cannot exceed " + MAX_DECISION_REASON_LENGTH + " characters");
        }

        return reason;
    }

    private String cleanOptionalDecisionReason(
            String value) {
        String reason = clean(value);

        if (reason.length() > MAX_DECISION_REASON_LENGTH) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Decision note cannot exceed " + MAX_DECISION_REASON_LENGTH + " characters");
        }

        return reason.isBlank()
                ? null
                : reason;
    }

    private RequestResponse toResponse(
            PacketDeletionRequest row) {
        return new RequestResponse(
                row.getId(),
                row.getRequestGroupId(),
                row.getTargetType(),
                row.getTargetId(),
                row.getPacketItemId(),
                row.getDispatchItemId(),
                row.getSourceReferenceId(),
                row.getDisplayName(),
                row.getItemName(),
                row.getPacketNumber(),
                row.getSku(),
                row.getPdNo(),
                row.getDrawingNo(),
                row.getPlantCode(),
                row.getSource(),
                row.getReason(),
                row.getRequestedBy(),
                row.getRequestedAt(),
                row.getRequestedStatus(),
                row.getRequestedLocation(),
                row.getStatus() == null ? null : row.getStatus().name(),
                row.getDecidedBy(),
                row.getDecidedAt(),
                row.getDecisionReason(),
                row.getDeletionAuditId(),
                row.getDeletionMessage(),
                row.getRowVersion());
    }

    private void requireAuthenticated(
            User user) {
        if (user == null) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Authentication required");
        }
    }

    private void requireAdmin(
            User user) {
        requireAuthenticated(user);

        if (!currentUserService.isAdmin(user)) {
            throw new AccessDeniedException(
                    "ADMIN access required");
        }
    }

    private UUID parseUuid(
            String value,
            String message) {
        try {
            return UUID.fromString(clean(value));
        } catch (Exception exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    message);
        }
    }

    private String cleanActor(
            String value) {
        String actor = clean(value);

        if (actor.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Authenticated username is missing");
        }

        return actor;
    }

    private String cleanNullable(
            Object value) {
        if (value == null) {
            return null;
        }

        String text = String.valueOf(value).trim();

        return text.isBlank()
                ? null
                : text;
    }

    private String firstNonBlank(
            Object... values) {
        String value = firstNonBlankNullable(values);
        return value == null ? "" : value;
    }

    private String firstNonBlankNullable(
            Object... values) {
        if (values == null) {
            return null;
        }

        for (Object value : values) {
            String clean = cleanNullable(value);

            if (clean != null) {
                return clean;
            }
        }

        return null;
    }

    private String clean(
            Object value) {
        return value == null
                ? ""
                : String.valueOf(value).trim();
    }

    private record ResolvedTarget(
            String targetType,
            String targetId,
            String targetKey,
            UUID packetItemId,
            String dispatchItemId,
            String sourceReferenceId) {
    }

    private record RequestSnapshot(
            UUID packetItemId,
            String dispatchItemId,
            String displayName,
            String itemName,
            String packetNumber,
            String sku,
            String pdNo,
            String drawingNo,
            String plantCode,
            String status,
            String location) {
    }
}
