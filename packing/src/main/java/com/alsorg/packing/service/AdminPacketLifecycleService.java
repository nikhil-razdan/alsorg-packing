package com.alsorg.packing.service;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import com.alsorg.packing.controller.dto.admin.AdminPacketRollbackHistoryResponse;
import com.alsorg.packing.controller.dto.admin.AdminPacketRollbackPreviewResponse;
import com.alsorg.packing.controller.dto.admin.AdminPacketRollbackRequest;
import com.alsorg.packing.controller.dto.admin.AdminPacketRollbackResultResponse;
import com.alsorg.packing.domain.admin.AdminPacketLifecycleState;
import com.alsorg.packing.domain.admin.AdminPacketRollbackAudit;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.item.PacketItem;
import com.alsorg.packing.domain.logistics.LogisticsTrip;
import com.alsorg.packing.domain.logistics.LogisticsTripItem;
import com.alsorg.packing.repository.AdminPacketRollbackAuditRepository;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.repository.LogisticsTripItemRepository;
import com.alsorg.packing.repository.LogisticsTripLocationRepository;
import com.alsorg.packing.repository.LogisticsTripRepository;
import com.alsorg.packing.repository.PacketItemRepository;
import com.alsorg.packing.repository.PacketRepository;
import com.alsorg.packing.repository.StickerHistoryRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class AdminPacketLifecycleService {

    private static final ZoneId APP_ZONE = ZoneId.of("Asia/Kolkata");

    private final PacketItemRepository packetItemRepository;
    private final DispatchedItemRepository dispatchedItemRepository;
    private final PacketRepository packetRepository;
    private final StickerHistoryRepository stickerHistoryRepository;

    private final LogisticsTripItemRepository logisticsTripItemRepository;
    private final LogisticsTripRepository logisticsTripRepository;
    private final LogisticsTripLocationRepository logisticsTripLocationRepository;

    private final AdminPacketRollbackAuditRepository rollbackAuditRepository;

    private final ActivityLogService activityLogService;
    private final AuditLogService auditLogService;

    private final ObjectMapper objectMapper;

    public AdminPacketLifecycleService(
            PacketItemRepository packetItemRepository,
            DispatchedItemRepository dispatchedItemRepository,
            PacketRepository packetRepository,
            StickerHistoryRepository stickerHistoryRepository,
            LogisticsTripItemRepository logisticsTripItemRepository,
            LogisticsTripRepository logisticsTripRepository,
            LogisticsTripLocationRepository logisticsTripLocationRepository,
            AdminPacketRollbackAuditRepository rollbackAuditRepository,
            ActivityLogService activityLogService,
            AuditLogService auditLogService,
            ObjectMapper objectMapper) {
        this.packetItemRepository = packetItemRepository;
        this.dispatchedItemRepository = dispatchedItemRepository;
        this.packetRepository = packetRepository;
        this.stickerHistoryRepository = stickerHistoryRepository;
        this.logisticsTripItemRepository = logisticsTripItemRepository;
        this.logisticsTripRepository = logisticsTripRepository;
        this.logisticsTripLocationRepository = logisticsTripLocationRepository;
        this.rollbackAuditRepository = rollbackAuditRepository;
        this.activityLogService = activityLogService;
        this.auditLogService = auditLogService;
        this.objectMapper = objectMapper;
    }

    /*
     * Preview must not lock rows because this is a read-only transaction.
     */
    @Transactional(readOnly = true)
    public AdminPacketRollbackPreviewResponse previewRollback(
            UUID packetItemId) {
        PacketItem packetItem = packetItemRepository.findById(packetItemId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Packet item not found"));

        DispatchedItem dispatchedItem = findDispatchedItemForRead(packetItem)
                .orElse(null);

        AdminPacketLifecycleState currentState = resolveLifecycleState(
                packetItem,
                dispatchedItem);

        AdminPacketLifecycleState previousState = previousStateOf(currentState);

        boolean allowed = previousState != null;

        List<String> changes = allowed
                ? describeRollbackChanges(
                        currentState,
                        packetItem,
                        dispatchedItem)
                : List.of();

        List<String> preservedHistory = List.of(
                "Existing activity logs will be preserved.",
                "Existing audit logs will be preserved.",
                "Existing sticker history will be preserved.",
                "A new permanent Admin Center rollback audit will be created.");

        Map<String, Long> affectedRecords = buildAffectedRecords(
                packetItem,
                dispatchedItem,
                currentState);

        return new AdminPacketRollbackPreviewResponse(
                packetItem.getId(),

                safe(packetItem.getItemName()),
                safe(packetItem.getDescription()),
                safe(packetItem.getPacketNumber()),
                safe(packetItem.getSku()),
                safe(packetItem.getPdNo()),
                safe(packetItem.getDrawingNo()),

                currentState.name(),
                currentState.getLabel(),

                previousState == null
                        ? null
                        : previousState.name(),

                previousState == null
                        ? null
                        : previousState.getLabel(),

                safe(packetItem.getStatus()),

                dispatchedItem == null ||
                        dispatchedItem.getStatus() == null
                                ? "-"
                                : dispatchedItem.getStatus().name(),

                currentLocation(
                        packetItem,
                        dispatchedItem),

                previousState == null
                        ? "-"
                        : expectedPreviousLocation(
                                previousState,
                                packetItem,
                                dispatchedItem),

                safe(packetItem.getStickerNumber()),

                dispatchedItem == null
                        ? "-"
                        : safe(dispatchedItem.getGatePassNumber()),

                dispatchedItem == null
                        ? "-"
                        : safe(dispatchedItem.getChalaanNumber()),

                buildConfirmation(packetItem),

                allowed,

                changes,
                preservedHistory,
                affectedRecords,

                buildWarning(
                        currentState,
                        previousState,
                        dispatchedItem));
    }

    @Transactional
    public AdminPacketRollbackResultResponse rollbackOneStep(
            UUID packetItemId,
            AdminPacketRollbackRequest request,
            String changedBy) {
        validateRequest(request);

        String actor = safeActor(changedBy);

        PacketItem packetItem = packetItemRepository.findByIdForAdminRollback(
                packetItemId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Packet item not found"));

        String requiredConfirmation = buildConfirmation(packetItem);

        if (!requiredConfirmation.equals(
                request.confirmationText() == null
                        ? ""
                        : request.confirmationText().trim())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Confirmation text does not match exactly");
        }

        DispatchedItem dispatchedItem = findDispatchedItemForUpdate(packetItem)
                .orElse(null);

        AdminPacketLifecycleState fromState = resolveLifecycleState(
                packetItem,
                dispatchedItem);

        AdminPacketLifecycleState toState = previousStateOf(fromState);

        if (toState == null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Packet is already at CREATED and has no previous state");
        }

        String beforeSnapshot = snapshotJson(
                packetItem,
                dispatchedItem,
                fromState);

        List<String> completedChanges = new ArrayList<>();

        switch (fromState) {

            case DISPATCHED ->
                rollbackDispatchedToReadyToDispatch(
                        packetItem,
                        requireDispatched(
                                dispatchedItem,
                                fromState),
                        completedChanges);

            case READY_TO_DISPATCH ->
                rollbackReadyToDispatchToFg(
                        packetItem,
                        requireDispatched(
                                dispatchedItem,
                                fromState),
                        completedChanges);

            case WAREHOUSE_RETURN_REQUESTED ->
                rollbackReturnRequestedToWarehouse(
                        packetItem,
                        requireDispatched(
                                dispatchedItem,
                                fromState),
                        completedChanges);

            case IN_WAREHOUSE ->
                rollbackWarehouseToRequested(
                        packetItem,
                        requireDispatched(
                                dispatchedItem,
                                fromState),
                        completedChanges);

            case WAREHOUSE_REQUESTED ->
                rollbackWarehouseRequestedToReadyToStore(
                        packetItem,
                        requireDispatched(
                                dispatchedItem,
                                fromState),
                        completedChanges);

            case READY_TO_STORE ->
                rollbackReadyToStoreToFg(
                        packetItem,
                        requireDispatched(
                                dispatchedItem,
                                fromState),
                        completedChanges);

            case READY_FG ->
                rollbackFgToPacking(
                        packetItem,
                        requireDispatched(
                                dispatchedItem,
                                fromState),
                        completedChanges);

            case READY_PKD ->
                rollbackPrintedPacketToCreated(
                        packetItem,
                        dispatchedItem,
                        completedChanges);

            case CREATED ->
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Packet is already at its first state");
        }

        packetItemRepository.flush();

        PacketItem finalPacketItem = packetItemRepository.findById(packetItemId)
                .orElseThrow(() -> new IllegalStateException(
                        "Packet item missing after rollback"));

        DispatchedItem finalDispatchedItem = findDispatchedItemForRead(finalPacketItem)
                .orElse(null);

        AdminPacketLifecycleState finalState = resolveLifecycleState(
                finalPacketItem,
                finalDispatchedItem);

        if (finalState != toState) {
            throw new IllegalStateException(
                    "Rollback verification failed. Expected "
                            + toState
                            + " but found "
                            + finalState);
        }

        String afterSnapshot = snapshotJson(
                finalPacketItem,
                finalDispatchedItem,
                finalState);

        LocalDateTime now = LocalDateTime.now(APP_ZONE);

        AdminPacketRollbackAudit audit = new AdminPacketRollbackAudit();

        audit.setId(UUID.randomUUID());
        audit.setPacketItemId(packetItemId);
        audit.setDisplayName(
                buildDisplayName(finalPacketItem));
        audit.setFromState(fromState.name());
        audit.setToState(toState.name());
        audit.setReason(request.reason().trim());
        audit.setChangedBy(actor);
        audit.setChangedAt(now);
        audit.setBeforeSnapshotJson(beforeSnapshot);
        audit.setAfterSnapshotJson(afterSnapshot);
        audit.setChangeSummaryJson(
                writeJson(completedChanges));

        rollbackAuditRepository.save(audit);

        String operationalId = finalDispatchedItem != null
                ? finalDispatchedItem.getZohoItemId()
                : packetItemId.toString();

        auditLogService.log(
                operationalId,
                "Admin moved packet back: "
                        + fromState.name()
                        + " -> "
                        + toState.name()
                        + " | Reason: "
                        + request.reason().trim(),
                actor,
                "ADMIN");

        activityLogService.log(
                operationalId,
                "ADMIN MOVED PACKET BACK",
                actor,
                "ADMIN",
                fromState.name(),
                toState.name(),
                finalDispatchedItem == null
                        ? null
                        : finalDispatchedItem.getGatePassNumber());

        return new AdminPacketRollbackResultResponse(
                finalPacketItem.getId(),
                safe(finalPacketItem.getItemName()),
                safe(finalPacketItem.getPacketNumber()),

                fromState.name(),
                fromState.getLabel(),

                finalState.name(),
                finalState.getLabel(),

                finalDispatchedItem != null &&
                        finalDispatchedItem.getStatus() != null
                                ? finalDispatchedItem.getStatus().name()
                                : safe(finalPacketItem.getStatus()),

                currentLocation(
                        finalPacketItem,
                        finalDispatchedItem),

                actor,
                now,

                audit.getId(),

                completedChanges,

                "Packet moved from "
                        + fromState.getLabel()
                        + " to "
                        + finalState.getLabel());
    }

    /**
     * Executes an approved user lifecycle-change request.
     *
     * The PacketItem is locked before the expected state is compared with the
     * live state. This prevents an old/stale approval request from accidentally
     * rolling back a newer packet state.
     */
    @Transactional
    public AdminPacketRollbackResultResponse rollbackOneStepForApprovedRequest(
            UUID packetItemId,
            String reason,
            String changedBy,
            String expectedFromState,
            String expectedToState) {
        String cleanReason = reason == null
                ? ""
                : reason.trim();

        if (cleanReason.length() < 5) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Reason must contain at least 5 characters");
        }

        if (cleanReason.length() > 1000) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Reason cannot exceed 1000 characters");
        }

        PacketItem packetItem = packetItemRepository
                .findByIdForAdminRollback(packetItemId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Packet item not found"));

        DispatchedItem dispatchedItem = findDispatchedItemForUpdate(packetItem)
                .orElse(null);

        AdminPacketLifecycleState liveFromState = resolveLifecycleState(
                packetItem,
                dispatchedItem);

        AdminPacketLifecycleState liveToState = previousStateOf(liveFromState);

        String expectedFrom = expectedFromState == null
                ? ""
                : expectedFromState.trim();

        String expectedTo = expectedToState == null
                ? ""
                : expectedToState.trim();

        if (!liveFromState.name().equals(expectedFrom)
                || liveToState == null
                || !liveToState.name().equals(expectedTo)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This request is stale because the packet lifecycle changed after the request was submitted. "
                            + "Requested "
                            + expectedFrom
                            + " -> "
                            + expectedTo
                            + ", but the live packet is now "
                            + liveFromState.name()
                            + " -> "
                            + (liveToState == null ? "NONE" : liveToState.name())
                            + ". Refresh the queue and reject this old request if it is no longer required.");
        }

        /*
         * The same transaction still owns the pessimistic PacketItem lock.
         * Reuse the existing, already-audited rollback implementation instead of
         * duplicating any operational state-transition logic.
         */
        return rollbackOneStep(
                packetItemId,
                new AdminPacketRollbackRequest(
                        buildConfirmation(packetItem),
                        cleanReason),
                changedBy);
    }

    @Transactional(readOnly = true)
    public Page<AdminPacketRollbackHistoryResponse> getHistory(
            Pageable pageable) {
        return rollbackAuditRepository
                .findAllByOrderByChangedAtDesc(pageable)
                .map(audit -> new AdminPacketRollbackHistoryResponse(
                        audit.getId(),
                        audit.getPacketItemId(),
                        audit.getDisplayName(),
                        audit.getFromState(),
                        audit.getToState(),
                        audit.getReason(),
                        audit.getChangedBy(),
                        audit.getChangedAt(),
                        audit.getChangeSummaryJson()));
    }

    private void rollbackDispatchedToReadyToDispatch(
            PacketItem packetItem,
            DispatchedItem dispatchedItem,
            List<String> changes) {
        removeFromLogisticsTrips(
                packetItem,
                dispatchedItem,
                changes);

        dispatchedItem.setStatus(
                ItemDispatchStatus.READY_TO_DISPATCH);

        dispatchedItem.setStock(1);

        dispatchedItem.setChalaanNumber(null);

        dispatchedItem.setDriverId(null);
        dispatchedItem.setDriverName(null);

        dispatchedItem.setVehicleId(null);
        dispatchedItem.setVehicleNumber(null);

        dispatchedItem.setDispatchedAt(null);
        dispatchedItem.setDispatchedBy(null);

        dispatchedItem.setTripStartedAt(null);
        dispatchedItem.setTripEndedAt(null);

        /*
         * Restore/approval data belongs to the dispatched state.
         */
        dispatchedItem.setApprovalStatus(null);
        dispatchedItem.setApprovalRequestedBy(null);
        dispatchedItem.setApprovalRequestedAt(null);
        dispatchedItem.setApprovedBy(null);
        dispatchedItem.setApprovedAt(null);

        ensureFgLocation(
                packetItem,
                dispatchedItem);

        packetItem.setStatus("READY");

        packetItemRepository.save(packetItem);
        dispatchedItemRepository.save(dispatchedItem);

        changes.add("Removed packet from logistics trip linkage.");
        changes.add("Cleared challan number.");
        changes.add("Cleared driver and vehicle assignment.");
        changes.add("Cleared dispatch and trip timestamps.");
        changes.add("Restored stock to 1.");
        changes.add("Changed status to READY_TO_DISPATCH.");
    }

    private void rollbackReadyToDispatchToFg(
            PacketItem packetItem,
            DispatchedItem dispatchedItem,
            List<String> changes) {
        dispatchedItem.setStatus(
                ItemDispatchStatus.READY);

        dispatchedItem.setStock(1);

        clearDispatchMetadata(dispatchedItem);

        ensureFgLocation(
                packetItem,
                dispatchedItem);

        packetItem.setStatus("READY");

        packetItemRepository.save(packetItem);
        dispatchedItemRepository.save(dispatchedItem);

        changes.add("Changed dispatch status from READY_TO_DISPATCH to READY.");
        changes.add("Kept packet in Finished Goods.");
        changes.add("Cleared accidental challan/dispatch metadata.");
    }

    private void rollbackReturnRequestedToWarehouse(
            PacketItem packetItem,
            DispatchedItem dispatchedItem,
            List<String> changes) {
        String warehouseLocation = firstNonBlank(
                dispatchedItem.getWarehouseCode(),
                dispatchedItem.getCurrentLocationCode(),
                dispatchedItem.getLocation());

        dispatchedItem.setStatus(
                ItemDispatchStatus.IN_WAREHOUSE);

        if (!warehouseLocation.isBlank()) {
            dispatchedItem.setCurrentLocationCode(
                    warehouseLocation);
            dispatchedItem.setLocation(
                    warehouseLocation);

            packetItem.setCurrentLocationCode(
                    warehouseLocation);
            packetItem.setLocation(
                    warehouseLocation);
            packetItem.setWarehouseCode(
                    dispatchedItem.getWarehouseCode());
        }

        packetItem.setStatus("READY");

        packetItemRepository.save(packetItem);
        dispatchedItemRepository.save(dispatchedItem);

        changes.add("Cancelled warehouse return request.");
        changes.add("Restored status to IN_WAREHOUSE.");
        changes.add("Preserved warehouse code and gate pass.");
    }

    private void rollbackWarehouseToRequested(
            PacketItem packetItem,
            DispatchedItem dispatchedItem,
            List<String> changes) {
        String sourceLocation = firstNonBlank(
                dispatchedItem.getFromLocation(),
                buildFgLocationFromCurrentData(
                        dispatchedItem),
                packetItem.getFgAreaCode(),
                packetItem.getPackedAreaCode());

        dispatchedItem.setStatus(
                ItemDispatchStatus.WAREHOUSE_REQUESTED);

        dispatchedItem.setStoredAt(null);

        if (!sourceLocation.isBlank()) {
            dispatchedItem.setCurrentLocationCode(
                    sourceLocation);
            dispatchedItem.setLocation(
                    sourceLocation);

            packetItem.setCurrentLocationCode(
                    sourceLocation);
            packetItem.setLocation(
                    sourceLocation);
        }

        packetItem.setWarehouseCode(
                dispatchedItem.getWarehouseCode());
        packetItem.setStatus("READY");

        packetItemRepository.save(packetItem);
        dispatchedItemRepository.save(dispatchedItem);

        changes.add("Reversed warehouse approval.");
        changes.add("Changed status to WAREHOUSE_REQUESTED.");
        changes.add("Cleared stored timestamp.");
        changes.add("Moved active location back to the warehouse source location.");
        changes.add("Preserved warehouse code and gate pass for reapproval.");
    }

    private void rollbackWarehouseRequestedToReadyToStore(
            PacketItem packetItem,
            DispatchedItem dispatchedItem,
            List<String> changes) {
        String sourceLocation = firstNonBlank(
                dispatchedItem.getFromLocation(),
                buildFgLocationFromCurrentData(
                        dispatchedItem),
                packetItem.getCurrentLocationCode(),
                packetItem.getFgAreaCode());

        dispatchedItem.setStatus(
                ItemDispatchStatus.READY_TO_STORE);

        dispatchedItem.setWarehouseCode(null);
        dispatchedItem.setGatePassNumber(null);
        dispatchedItem.setStoredAt(null);
        dispatchedItem.setFromLocation(null);

        if (!sourceLocation.isBlank()) {
            dispatchedItem.setCurrentLocationCode(
                    sourceLocation);
            dispatchedItem.setLocation(
                    sourceLocation);

            packetItem.setCurrentLocationCode(
                    sourceLocation);
            packetItem.setLocation(
                    sourceLocation);
        }

        packetItem.setWarehouseCode(null);
        packetItem.setStatus("READY");

        packetItemRepository.save(packetItem);
        dispatchedItemRepository.save(dispatchedItem);

        changes.add("Cancelled warehouse movement request.");
        changes.add("Cleared gate pass.");
        changes.add("Cleared warehouse code and stored timestamp.");
        changes.add("Changed status to READY_TO_STORE.");
    }

    private void rollbackReadyToStoreToFg(
            PacketItem packetItem,
            DispatchedItem dispatchedItem,
            List<String> changes) {
        dispatchedItem.setStatus(
                ItemDispatchStatus.READY);

        clearWarehouseMetadata(
                packetItem,
                dispatchedItem);

        ensureFgLocation(
                packetItem,
                dispatchedItem);

        packetItem.setStatus("READY");

        packetItemRepository.save(packetItem);
        dispatchedItemRepository.save(dispatchedItem);

        changes.add("Changed status from READY_TO_STORE to READY.");
        changes.add("Kept packet in Finished Goods.");
        changes.add("Cleared warehouse request metadata.");
    }

    private void rollbackFgToPacking(
            PacketItem packetItem,
            DispatchedItem dispatchedItem,
            List<String> changes) {
        String packedLocation = firstNonBlank(
                packetItem.getPackedAreaCode(),
                dispatchedItem.getPackedAreaCode(),
                "PKD");

        dispatchedItem.setStatus(
                ItemDispatchStatus.READY);

        dispatchedItem.setCurrentLocationCode(
                packedLocation);
        dispatchedItem.setLocation(
                packedLocation);
        dispatchedItem.setFgZoneCode(null);

        clearWarehouseMetadata(
                packetItem,
                dispatchedItem);

        packetItem.setStatus("READY");
        packetItem.setCurrentLocationCode(
                packedLocation);
        packetItem.setLocation(
                packedLocation);
        packetItem.setFgZoneCode(null);

        packetItemRepository.save(packetItem);
        dispatchedItemRepository.save(dispatchedItem);

        changes.add("Moved packet from Finished Goods back to packing area.");
        changes.add("Cleared FG zone.");
        changes.add("Kept the active sticker and READY state.");
    }

    private void rollbackPrintedPacketToCreated(
            PacketItem packetItem,
            DispatchedItem dispatchedItem,
            List<String> changes) {
        String previousSticker = packetItem.getStickerNumber();

        /*
         * Preserve StickerHistory.
         * Only deactivate the current sticker from PacketItem.
         */
        packetItem.setStatus("CREATED");
        packetItem.setStickerNumber(null);

        packetItem.setPackedAt(null);

        packetItem.setCurrentLocationCode(null);
        packetItem.setLocation("FLOOR");

        packetItem.setFgZoneCode(null);
        packetItem.setWarehouseCode(null);

        packetItemRepository.save(packetItem);

        /*
         * Before sticker generation there was no dispatched_items row.
         * Remove the operational copy to faithfully return to CREATED.
         */
        if (dispatchedItem != null) {
            removeFromLogisticsTrips(
                    packetItem,
                    dispatchedItem,
                    changes);

            dispatchedItemRepository.delete(
                    dispatchedItem);

            dispatchedItemRepository.flush();

            changes.add("Removed the generated dispatched_items operational row.");
        }

        reconcileParentPacketStickerFlag(
                packetItem);

        changes.add(
                "Deactivated active sticker "
                        + safe(previousSticker)
                        + ".");
        changes.add("Preserved all StickerHistory rows.");
        changes.add("Changed PacketItem status to CREATED.");
        changes.add("Moved packet back to FLOOR.");
    }

    private void removeFromLogisticsTrips(
            PacketItem packetItem,
            DispatchedItem dispatchedItem,
            List<String> changes) {
        if (packetItem == null ||
                packetItem.getId() == null) {
            return;
        }

        /*
         * Gather every possible historical identifier.
         *
         * A LinkedHashSet:
         * - avoids duplicate values;
         * - never sends an empty IN collection;
         * - preserves a predictable order for debugging.
         */
        Set<String> lookupIds = buildRollbackLookupIds(
                packetItem,
                dispatchedItem);

        List<LogisticsTripItem> tripItems = logisticsTripItemRepository
                .findForAdminRollback(
                        packetItem.getId(),
                        lookupIds);

        if (tripItems == null ||
                tripItems.isEmpty()) {
            return;
        }

        /*
         * Capture all parent-trip IDs before removing child rows.
         */
        Set<UUID> affectedTripIds = new LinkedHashSet<>();

        for (LogisticsTripItem tripItem : tripItems) {
            if (tripItem == null ||
                    tripItem.getTrip() == null ||
                    tripItem.getTrip().getId() == null) {
                continue;
            }

            affectedTripIds.add(
                    tripItem.getTrip().getId());
        }

        int removedTripItemCount = tripItems.size();

        /*
         * Prefer entity-aware deletion over deleteAllInBatch here.
         *
         * deleteAllInBatch bypasses Hibernate's persistence context.
         * Because these entities were just loaded with their Trip,
         * keeping Hibernate synchronized is safer for the remaining
         * rollback work in the same transaction.
         */
        logisticsTripItemRepository.deleteAll(
                tripItems);

        logisticsTripItemRepository.flush();

        if (changes != null) {
            changes.add(
                    "Removed " +
                            removedTripItemCount +
                            " logistics trip item link(s).");
        }

        /*
         * Each affected parent trip must now either:
         *
         * 1. be deleted when it contains no remaining items; or
         * 2. have its cached totalItems count recalculated.
         */
        for (UUID tripId : affectedTripIds) {
            if (tripId == null) {
                continue;
            }

            long remaining = logisticsTripItemRepository
                    .countByTripId(
                            tripId);

            if (remaining <= 0) {
                /*
                 * Delete location records before deleting the trip.
                 * Otherwise the logistics-trip foreign key may block
                 * the parent deletion.
                 */
                int removedLocationRows = logisticsTripLocationRepository
                        .deleteByTripIdForAdminRollback(
                                tripId);

                logisticsTripLocationRepository.flush();

                if (changes != null &&
                        removedLocationRows > 0) {
                    changes.add(
                            "Removed " +
                                    removedLocationRows +
                                    " logistics location record(s) from trip " +
                                    tripId +
                                    ".");
                }
                /*
                 * Use findById + delete rather than existsById +
                 * deleteById. It avoids resolving the same entity twice
                 * and keeps deletion entity-aware.
                 */
                logisticsTripRepository
                        .findById(tripId)
                        .ifPresent(
                                logisticsTripRepository::delete);

                logisticsTripRepository.flush();

                if (changes != null) {
                    changes.add(
                            "Deleted empty logistics trip " +
                                    tripId +
                                    ".");
                }

                continue;
            }

            logisticsTripRepository
                    .findById(tripId)
                    .ifPresent(trip -> {
                        /*
                         * Keep the stored trip summary synchronized with
                         * the actual child-row count.
                         *
                         * This line assumes LogisticsTrip has:
                         *
                         * setTotalItems(Integer/int)
                         */
                        trip.setTotalItems(
                                Math.toIntExact(
                                        remaining));

                        logisticsTripRepository.save(
                                trip);
                    });

            if (changes != null) {
                changes.add(
                        "Recalculated logistics trip " +
                                tripId +
                                " to " +
                                remaining +
                                " item(s).");
            }
        }

        logisticsTripRepository.flush();
    }

    private AdminPacketLifecycleState resolveLifecycleState(
            PacketItem packetItem,
            DispatchedItem dispatchedItem) {
        if (dispatchedItem == null) {
            if (hasActiveSticker(packetItem) ||
                    "READY".equalsIgnoreCase(
                            safe(packetItem.getStatus()))) {
                return AdminPacketLifecycleState.READY_PKD;
            }

            return AdminPacketLifecycleState.CREATED;
        }

        ItemDispatchStatus status = dispatchedItem.getStatus();

        if (status == null) {
            return hasActiveSticker(packetItem)
                    ? AdminPacketLifecycleState.READY_PKD
                    : AdminPacketLifecycleState.CREATED;
        }

        return switch (status) {

            case DISPATCHED ->
                AdminPacketLifecycleState.DISPATCHED;

            case READY_TO_DISPATCH ->
                AdminPacketLifecycleState.READY_TO_DISPATCH;

            case WAREHOUSE_RETURN_REQUESTED ->
                AdminPacketLifecycleState.WAREHOUSE_RETURN_REQUESTED;

            case IN_WAREHOUSE ->
                AdminPacketLifecycleState.IN_WAREHOUSE;

            case WAREHOUSE_REQUESTED ->
                AdminPacketLifecycleState.WAREHOUSE_REQUESTED;

            case READY_TO_STORE ->
                AdminPacketLifecycleState.READY_TO_STORE;

            case READY -> isFgLocation(dispatchedItem)
                    ? AdminPacketLifecycleState.READY_FG
                    : AdminPacketLifecycleState.READY_PKD;

            default -> throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Admin move-back is not configured for status: "
                            + status);
        };
    }

    private AdminPacketLifecycleState previousStateOf(
            AdminPacketLifecycleState state) {
        return switch (state) {

            case DISPATCHED ->
                AdminPacketLifecycleState.READY_TO_DISPATCH;

            case READY_TO_DISPATCH ->
                AdminPacketLifecycleState.READY_FG;

            case WAREHOUSE_RETURN_REQUESTED ->
                AdminPacketLifecycleState.IN_WAREHOUSE;

            case IN_WAREHOUSE ->
                AdminPacketLifecycleState.WAREHOUSE_REQUESTED;

            case WAREHOUSE_REQUESTED ->
                AdminPacketLifecycleState.READY_TO_STORE;

            case READY_TO_STORE ->
                AdminPacketLifecycleState.READY_FG;

            case READY_FG ->
                AdminPacketLifecycleState.READY_PKD;

            case READY_PKD ->
                AdminPacketLifecycleState.CREATED;

            case CREATED ->
                null;
        };
    }

    private Optional<DispatchedItem> findDispatchedItemForRead(
            PacketItem packetItem) {
        Optional<DispatchedItem> byPacketItem = dispatchedItemRepository.findByPacketItemId(
                packetItem.getId());

        if (byPacketItem.isPresent()) {
            return byPacketItem;
        }

        Optional<DispatchedItem> byPrimaryId = dispatchedItemRepository.findById(
                packetItem.getId().toString());

        if (byPrimaryId.isPresent()) {
            return byPrimaryId;
        }

        if (packetItem.getZohoItemId() != null &&
                !packetItem.getZohoItemId().isBlank()) {
            return dispatchedItemRepository.findById(
                    packetItem.getZohoItemId());
        }

        return Optional.empty();
    }

    private Optional<DispatchedItem> findDispatchedItemForUpdate(
            PacketItem packetItem) {
        if (packetItem == null || packetItem.getId() == null) {
            return Optional.empty();
        }

        /*
         * 1. Preferred modern linkage:
         *
         * dispatched_items.packet_item_id = packet_items.id
         */
        Optional<DispatchedItem> byPacketItem = dispatchedItemRepository
                .findByPacketItemIdForAdminRollback(
                        packetItem.getId());

        if (byPacketItem.isPresent()) {
            return byPacketItem;
        }

        /*
         * 2. Existing PackFlow convention:
         *
         * dispatched_items.zoho_item_id =
         * packet_items.id.toString()
         */
        String packetItemIdAsString = packetItem.getId().toString();

        Optional<DispatchedItem> byPrimaryId = dispatchedItemRepository
                .findByIdForAdminRollback(
                        packetItemIdAsString);

        if (byPrimaryId.isPresent()) {
            return byPrimaryId;
        }

        /*
         * 3. Legacy linkage:
         *
         * packet_items.zoho_item_id may contain the actual
         * dispatched_items primary key.
         */
        String legacyZohoItemId = packetItem.getZohoItemId();

        if (legacyZohoItemId != null &&
                !legacyZohoItemId.isBlank() &&
                !legacyZohoItemId.trim()
                        .equals(packetItemIdAsString)) {

            Optional<DispatchedItem> byLegacyZohoId = dispatchedItemRepository
                    .findByIdForAdminRollback(
                            legacyZohoItemId.trim());

            if (byLegacyZohoId.isPresent()) {
                return byLegacyZohoId;
            }
        }

        /*
         * 4. Final legacy fallback:
         *
         * Some old records have neither packetItemId nor matching
         * primary-key linkage, but their active sticker matches.
         */
        String stickerNumber = packetItem.getStickerNumber();

        if (stickerNumber != null &&
                !stickerNumber.isBlank()) {

            Optional<DispatchedItem> bySticker = dispatchedItemRepository
                    .findByStickerNumberForAdminRollback(
                            stickerNumber.trim());

            if (bySticker.isPresent()) {
                return bySticker;
            }
        }

        return Optional.empty();
    }

    private DispatchedItem requireDispatched(
            DispatchedItem item,
            AdminPacketLifecycleState state) {
        if (item == null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Dispatch record is required to roll back state "
                            + state);
        }

        return item;
    }

    private void ensureFgLocation(
            PacketItem packetItem,
            DispatchedItem dispatchedItem) {
        String fgLocation = buildFgLocationFromCurrentData(
                dispatchedItem);

        if (fgLocation.isBlank()) {
            fgLocation = firstNonBlank(
                    packetItem.getCurrentLocationCode(),
                    packetItem.getFgAreaCode(),
                    dispatchedItem.getFgAreaCode());
        }

        if (!fgLocation.isBlank()) {
            packetItem.setCurrentLocationCode(
                    fgLocation);
            packetItem.setLocation(
                    fgLocation);

            dispatchedItem.setCurrentLocationCode(
                    fgLocation);
            dispatchedItem.setLocation(
                    fgLocation);
        }
    }

    private String buildFgLocationFromCurrentData(
            DispatchedItem item) {
        if (item == null) {
            return "";
        }

        String fgArea = clean(item.getFgAreaCode());

        String fgZone = clean(item.getFgZoneCode());

        if (fgArea.isBlank()) {
            return "";
        }

        if (fgZone.isBlank()) {
            return fgArea;
        }

        if (fgArea.endsWith("-" + fgZone)) {
            return fgArea;
        }

        return fgArea + "-" + fgZone;
    }

    private void clearWarehouseMetadata(
            PacketItem packetItem,
            DispatchedItem dispatchedItem) {
        dispatchedItem.setWarehouseCode(null);
        dispatchedItem.setGatePassNumber(null);
        dispatchedItem.setStoredAt(null);
        dispatchedItem.setFromLocation(null);

        packetItem.setWarehouseCode(null);
    }

    private void clearDispatchMetadata(
            DispatchedItem item) {
        item.setChalaanNumber(null);

        item.setDriverId(null);
        item.setDriverName(null);

        item.setVehicleId(null);
        item.setVehicleNumber(null);

        item.setDispatchedAt(null);
        item.setDispatchedBy(null);

        item.setTripStartedAt(null);
        item.setTripEndedAt(null);
    }

    private void reconcileParentPacketStickerFlag(
            PacketItem packetItem) {
        if (packetItem.getPacket() == null ||
                packetItem.getPacket().getId() == null) {
            return;
        }

        UUID packetId = packetItem.getPacket().getId();

        long activeStickers = packetItemRepository
                .countActiveStickersByPacketId(
                        packetId);

        packetRepository.findById(packetId)
                .ifPresent(packet -> {
                    packet.setStickerGenerated(
                            activeStickers > 0);

                    packetRepository.save(packet);
                });
    }

    private boolean isFgLocation(
            DispatchedItem item) {
        if (item == null) {
            return false;
        }

        String location = clean(
                firstNonBlank(
                        item.getCurrentLocationCode(),
                        item.getLocation()))
                .toUpperCase();

        String fgArea = clean(item.getFgAreaCode())
                .toUpperCase();

        if (location.isBlank() ||
                fgArea.isBlank()) {
            return false;
        }

        return location.equals(fgArea) ||
                location.startsWith(fgArea + "-") ||
                location.startsWith(fgArea + " ");
    }

    private boolean hasActiveSticker(
            PacketItem packetItem) {
        return packetItem.getStickerNumber() != null &&
                !packetItem.getStickerNumber().isBlank();
    }

    private String currentLocation(
            PacketItem packetItem,
            DispatchedItem dispatchedItem) {
        if (dispatchedItem != null) {
            String value = firstNonBlank(
                    dispatchedItem.getCurrentLocationCode(),
                    dispatchedItem.getLocation());

            if (!value.isBlank()) {
                return value;
            }
        }

        return firstNonBlank(
                packetItem.getCurrentLocationCode(),
                packetItem.getLocation(),
                "FLOOR");
    }

    private String expectedPreviousLocation(
            AdminPacketLifecycleState previousState,
            PacketItem packetItem,
            DispatchedItem dispatchedItem) {
        return switch (previousState) {

            case CREATED -> "FLOOR";

            case READY_PKD ->
                firstNonBlank(
                        packetItem.getPackedAreaCode(),
                        dispatchedItem == null
                                ? null
                                : dispatchedItem.getPackedAreaCode(),
                        "PKD");

            case READY_FG,
                    READY_TO_STORE,
                    READY_TO_DISPATCH ->
                firstNonBlank(
                        dispatchedItem == null
                                ? null
                                : buildFgLocationFromCurrentData(
                                        dispatchedItem),
                        packetItem.getFgAreaCode(),
                        "FG");

            case WAREHOUSE_REQUESTED ->
                firstNonBlank(
                        dispatchedItem == null
                                ? null
                                : dispatchedItem.getFromLocation(),
                        packetItem.getFgAreaCode(),
                        "FG");

            case IN_WAREHOUSE,
                    WAREHOUSE_RETURN_REQUESTED ->
                firstNonBlank(
                        dispatchedItem == null
                                ? null
                                : dispatchedItem.getWarehouseCode(),
                        "WAREHOUSE");

            case DISPATCHED -> currentLocation(
                    packetItem,
                    dispatchedItem);
        };
    }

    private List<String> describeRollbackChanges(
            AdminPacketLifecycleState state,
            PacketItem packetItem,
            DispatchedItem dispatchedItem) {
        return switch (state) {

            case DISPATCHED -> List.of(
                    "Remove this packet from its logistics trip.",
                    "Clear challan number.",
                    "Clear driver and vehicle assignment.",
                    "Clear dispatch and trip timestamps.",
                    "Restore stock to 1.",
                    "Change status to READY_TO_DISPATCH.");

            case READY_TO_DISPATCH -> List.of(
                    "Change status to READY.",
                    "Keep the packet in Finished Goods.",
                    "Clear accidental dispatch metadata.");

            case WAREHOUSE_RETURN_REQUESTED -> List.of(
                    "Cancel the return request.",
                    "Restore status to IN_WAREHOUSE.",
                    "Preserve warehouse and gate-pass details.");

            case IN_WAREHOUSE -> List.of(
                    "Reverse warehouse approval.",
                    "Change status to WAREHOUSE_REQUESTED.",
                    "Clear stored timestamp.",
                    "Move current location back to its source location.",
                    "Preserve gate pass for reapproval.");

            case WAREHOUSE_REQUESTED -> List.of(
                    "Cancel the warehouse request.",
                    "Clear gate pass.",
                    "Clear warehouse assignment.",
                    "Change status to READY_TO_STORE.");

            case READY_TO_STORE -> List.of(
                    "Change status to READY.",
                    "Keep the packet in Finished Goods.",
                    "Clear warehouse request metadata.");

            case READY_FG -> List.of(
                    "Move packet from Finished Goods to the packing area.",
                    "Clear FG zone.",
                    "Keep sticker active.",
                    "Keep status READY.");

            case READY_PKD -> List.of(
                    "Deactivate the active sticker.",
                    "Preserve sticker history.",
                    "Remove the generated dispatched_items row.",
                    "Change packet status to CREATED.",
                    "Move packet back to FLOOR.");

            case CREATED -> List.of();
        };
    }

    private Map<String, Long> buildAffectedRecords(
            PacketItem packetItem,
            DispatchedItem dispatchedItem,
            AdminPacketLifecycleState state) {

        Map<String, Long> result = new LinkedHashMap<>();

        result.put(
                "packetItems",
                1L);

        result.put(
                "dispatchedItems",
                dispatchedItem == null
                        ? 0L
                        : 1L);

        long stickerHistoryCount = stickerHistoryRepository
                .countByPacketItem_Id(
                        packetItem.getId());

        result.put(
                "stickerHistoryPreserved",
                stickerHistoryCount);

        /*
         * Use every possible current and legacy identifier,
         * matching the actual rollback execution logic.
         */
        Set<String> lookupIds = buildRollbackLookupIds(
                packetItem,
                dispatchedItem);

        List<LogisticsTripItem> tripItems = logisticsTripItemRepository
                .findForAdminRollback(
                        packetItem.getId(),
                        lookupIds);

        long logisticsTripItemCount = tripItems == null
                ? 0L
                : tripItems.size();

        result.put(
                "logisticsTripItems",
                logisticsTripItemCount);

        /*
         * Count unique affected parent trips as well.
         */
        long logisticsTripCount = tripItems == null
                ? 0L
                : tripItems.stream()
                        .filter(item -> item != null &&
                                item.getTrip() != null &&
                                item.getTrip().getId() != null)
                        .map(item -> item.getTrip().getId())
                        .distinct()
                        .count();

        result.put(
                "logisticsTrips",
                logisticsTripCount);

        result.put(
                "challanMetadata",
                state == AdminPacketLifecycleState.DISPATCHED
                        ? 1L
                        : 0L);

        return result;
    }

    private String buildWarning(
            AdminPacketLifecycleState currentState,
            AdminPacketLifecycleState previousState,
            DispatchedItem dispatchedItem) {
        if (previousState == null) {
            return "This packet is already at CREATED and cannot be moved further back.";
        }

        if (currentState == AdminPacketLifecycleState.DISPATCHED) {
            return "This will remove the packet from its current challan and logistics trip. The historical Admin Center audit will remain.";
        }

        if (currentState == AdminPacketLifecycleState.READY_PKD) {
            return "The active sticker will stop being valid. Existing sticker-history PDFs will remain available as historical records.";
        }

        if (currentState == AdminPacketLifecycleState.IN_WAREHOUSE) {
            return "The warehouse approval will be reversed, but the existing gate pass will be retained for possible reapproval.";
        }

        return "Only one lifecycle step will be reversed.";
    }

    private String snapshotJson(
            PacketItem packetItem,
            DispatchedItem dispatchedItem,
            AdminPacketLifecycleState lifecycleState) {
        Map<String, Object> snapshot = new LinkedHashMap<>();

        snapshot.put(
                "lifecycleState",
                lifecycleState.name());

        snapshot.put(
                "packetItem",
                packetSnapshot(packetItem));

        snapshot.put(
                "dispatchedItem",
                dispatchedItem == null
                        ? null
                        : dispatchedSnapshot(
                                dispatchedItem));

        return writeJson(snapshot);
    }

    private Map<String, Object> packetSnapshot(
            PacketItem item) {
        Map<String, Object> map = new LinkedHashMap<>();

        map.put("id", item.getId());
        map.put("itemName", item.getItemName());
        map.put("description", item.getDescription());
        map.put("packetNumber", item.getPacketNumber());
        map.put("sku", item.getSku());
        map.put("status", item.getStatus());
        map.put("stickerNumber", item.getStickerNumber());
        map.put("printIteration", item.getPrintIteration());
        map.put("location", item.getLocation());
        map.put("currentLocationCode", item.getCurrentLocationCode());
        map.put("packedAreaCode", item.getPackedAreaCode());
        map.put("fgAreaCode", item.getFgAreaCode());
        map.put("fgZoneCode", item.getFgZoneCode());
        map.put("warehouseCode", item.getWarehouseCode());
        map.put("packedAt", item.getPackedAt());

        return map;
    }

    private Map<String, Object> dispatchedSnapshot(
            DispatchedItem item) {
        Map<String, Object> map = new LinkedHashMap<>();

        map.put("zohoItemId", item.getZohoItemId());
        map.put("packetItemId", item.getPacketItemId());
        map.put("status", item.getStatus());
        map.put("stock", item.getStock());

        map.put("location", item.getLocation());
        map.put("currentLocationCode", item.getCurrentLocationCode());
        map.put("packedAreaCode", item.getPackedAreaCode());
        map.put("fgAreaCode", item.getFgAreaCode());
        map.put("fgZoneCode", item.getFgZoneCode());

        map.put("warehouseCode", item.getWarehouseCode());
        map.put("fromLocation", item.getFromLocation());
        map.put("gatePassNumber", item.getGatePassNumber());
        map.put("storedAt", item.getStoredAt());

        map.put("chalaanNumber", item.getChalaanNumber());
        map.put("driverId", item.getDriverId());
        map.put("driverName", item.getDriverName());
        map.put("vehicleId", item.getVehicleId());
        map.put("vehicleNumber", item.getVehicleNumber());

        map.put("dispatchedAt", item.getDispatchedAt());
        map.put("dispatchedBy", item.getDispatchedBy());
        map.put("tripStartedAt", item.getTripStartedAt());
        map.put("tripEndedAt", item.getTripEndedAt());

        return map;
    }

    private void validateRequest(
            AdminPacketRollbackRequest request) {
        if (request == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Rollback request is required");
        }

        String reason = request.reason() == null
                ? ""
                : request.reason().trim();

        if (reason.length() < 5) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Reason must contain at least 5 characters");
        }

        if (reason.length() > 1000) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Reason cannot exceed 1000 characters");
        }
    }

    private String buildConfirmation(
            PacketItem packetItem) {
        String packetReference = firstNonBlank(
                packetItem.getPacketNumber(),
                packetItem.getSku(),
                packetItem.getId().toString());

        return "MOVE BACK " + packetReference;
    }

    private String buildDisplayName(
            PacketItem packetItem) {
        return firstNonBlank(
                packetItem.getItemName(),
                packetItem.getPacketNumber(),
                packetItem.getSku(),
                packetItem.getId().toString());
    }

    private String writeJson(
            Object value) {
        try {
            return objectMapper.writeValueAsString(
                    value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException(
                    "Failed to create admin rollback audit snapshot",
                    exception);
        }
    }

    private String safeActor(
            String value) {
        return value == null ||
                value.trim().isBlank()
                        ? "SYSTEM"
                        : value.trim();
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

    private String clean(
            String value) {
        return value == null
                ? ""
                : value.trim();
    }

    private String firstNonBlank(
            String... values) {
        if (values == null) {
            return "";
        }

        for (String value : values) {
            if (value != null &&
                    !value.trim().isBlank()) {
                return value.trim();
            }
        }

        return "";
    }

    private Set<String> buildRollbackLookupIds(
            PacketItem packetItem,
            DispatchedItem dispatchedItem) {

        Set<String> lookupIds = new LinkedHashSet<>();

        if (packetItem == null) {
            return lookupIds;
        }

        /*
         * Current standard linkage:
         *
         * dispatched_items.zoho_item_id =
         * packet_items.id.toString()
         */
        if (packetItem.getId() != null) {
            addRollbackLookupId(
                    lookupIds,
                    packetItem.getId().toString());
        }

        /*
         * Legacy PacketItem linkage.
         */
        addRollbackLookupId(
                lookupIds,
                packetItem.getZohoItemId());

        if (dispatchedItem != null) {

            /*
             * Actual DispatchedItem identifier.
             */
            addRollbackLookupId(
                    lookupIds,
                    dispatchedItem.getZohoItemId());

            /*
             * Migrated records may store the PacketItem UUID
             * in LogisticsTripItem.zohoItemId as text.
             */
            if (dispatchedItem.getPacketItemId() != null) {
                addRollbackLookupId(
                        lookupIds,
                        dispatchedItem
                                .getPacketItemId()
                                .toString());
            }
        }

        /*
         * Hibernate/JPA IN queries must not receive an empty collection.
         * packetItem.id normally guarantees at least one value, but this
         * fallback makes the helper defensive.
         */
        if (lookupIds.isEmpty()) {
            lookupIds.add(
                    "__NO_MATCH__");
        }

        return lookupIds;
    }

    private void addRollbackLookupId(
            Set<String> lookupIds,
            String value) {
        if (lookupIds == null ||
                value == null ||
                value.isBlank()) {
            return;
        }

        lookupIds.add(
                value.trim());
    }
}