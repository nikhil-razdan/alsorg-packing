package com.alsorg.packing.service;

import java.time.LocalDateTime;
import java.time.ZoneId;
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
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.controller.dto.admin.AdminPacketRollbackPreviewResponse;
import com.alsorg.packing.controller.dto.admin.PacketLifecycleRequestDtos.DecisionRequest;
import com.alsorg.packing.controller.dto.admin.PacketLifecycleRequestDtos.DecisionResponse;
import com.alsorg.packing.controller.dto.admin.PacketLifecycleRequestDtos.RequestResponse;
import com.alsorg.packing.controller.dto.admin.PacketLifecycleRequestDtos.SubmitRequest;
import com.alsorg.packing.controller.dto.admin.PacketLifecycleRequestDtos.SubmitResponse;
import com.alsorg.packing.domain.admin.PacketDeletionRequestStatus;
import com.alsorg.packing.domain.admin.PacketLifecycleChangeRequest;
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
public class PacketLifecycleChangeRequestService {

    private static final ZoneId APP_ZONE = ZoneId.of("Asia/Kolkata");
    private static final int MAX_BATCH_SIZE = 200;
    private static final int MAX_REASON_LENGTH = 1000;
    private static final int MAX_DECISION_REASON_LENGTH = 500;

    private static final String SOURCE_DISPATCH = "DISPATCH";
    private static final String SOURCE_INVENTORY_HISTORY = "INVENTORY_HISTORY";

    private final PacketLifecycleChangeRequestRepository requestRepository;
    private final PacketDeletionRequestRepository deletionRequestRepository;
    private final PacketItemRepository packetItemRepository;
    private final DispatchedItemRepository dispatchedItemRepository;
    private final StickerHistoryRepository stickerHistoryRepository;
    private final AdminPacketLifecycleService lifecycleService;
    private final CurrentUserService currentUserService;

    public PacketLifecycleChangeRequestService(
            PacketLifecycleChangeRequestRepository requestRepository,
            PacketDeletionRequestRepository deletionRequestRepository,
            PacketItemRepository packetItemRepository,
            DispatchedItemRepository dispatchedItemRepository,
            StickerHistoryRepository stickerHistoryRepository,
            AdminPacketLifecycleService lifecycleService,
            CurrentUserService currentUserService) {
        this.requestRepository = requestRepository;
        this.deletionRequestRepository = deletionRequestRepository;
        this.packetItemRepository = packetItemRepository;
        this.dispatchedItemRepository = dispatchedItemRepository;
        this.stickerHistoryRepository = stickerHistoryRepository;
        this.lifecycleService = lifecycleService;
        this.currentUserService = currentUserService;
    }

    /**
     * Creates one immutable PENDING approval request per unique packet.
     *
     * No operational packet state changes here. The PacketItem itself is locked
     * while duplicate checks and lifecycle snapshotting happen, so simultaneous
     * user submissions cannot create two open requests for the same packet.
     */
    @Transactional
    public SubmitResponse submit(
            SubmitRequest request,
            User user) {
        requireAuthenticated(user);

        if (request == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Lifecycle change request is required");
        }

        String source = normalizeSource(request.source());
        assertSourceAccess(source, user);

        String reason = cleanRequiredReason(request.reason());
        List<String> targetIds = normalizeTargetIds(request.targetIds());

        String actor = cleanActor(user.getUsername());
        UUID requestGroupId = UUID.randomUUID();
        LocalDateTime now = LocalDateTime.now(APP_ZONE);

        /*
         * Resolve requested references first, then deduplicate by PacketItem id.
         * Generated History can contain INITIAL + REPRINT rows for the same packet;
         * selecting both must still create only one approval request.
         */
        Map<UUID, ResolvedTarget> resolvedByPacketId = new LinkedHashMap<>();

        for (String targetId : targetIds) {
            ResolvedTarget target = resolveTarget(
                    source,
                    targetId,
                    user);

            resolvedByPacketId.putIfAbsent(
                    target.packetItemId(),
                    target);
        }

        if (resolvedByPacketId.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "No valid packet items were selected");
        }

        if (resolvedByPacketId.size() > MAX_BATCH_SIZE) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "A maximum of " + MAX_BATCH_SIZE + " packet items can be requested at once");
        }

        List<ResolvedTarget> orderedTargets = new ArrayList<>(resolvedByPacketId.values());
        orderedTargets.sort(
                Comparator.comparing(target -> target.packetItemId().toString()));

        List<PacketLifecycleChangeRequest> created = new ArrayList<>();

        for (ResolvedTarget target : orderedTargets) {
            PacketItem packetItem = packetItemRepository
                    .findByIdForAdminRollback(target.packetItemId())
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND,
                            "Packet item no longer exists: " + target.packetItemId()));

            assertPacketAccess(
                    source,
                    packetItem,
                    target.history(),
                    target.dispatchedItem(),
                    user);

            String deletionTargetKey =
                    "PACKET_ITEM:" + packetItem.getId();

            if (deletionRequestRepository.existsByTargetKeyAndStatus(
                    deletionTargetKey,
                    PacketDeletionRequestStatus.PENDING)) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        buildDisplayName(packetItem)
                                + " already has a pending deletion request. "
                                + "That request must be approved or rejected before a lifecycle state-change request can be created.");
            }

            if (requestRepository.existsByPacketItemIdAndStatus(
                    packetItem.getId(),
                    PacketLifecycleChangeRequestStatus.PENDING)) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "A pending lifecycle change request already exists for "
                                + buildDisplayName(packetItem));
            }

            AdminPacketRollbackPreviewResponse preview = lifecycleService
                    .previewRollback(packetItem.getId());

            if (!preview.rollbackAllowed()
                    || preview.previousLifecycleState() == null
                    || preview.previousLifecycleState().isBlank()) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        buildDisplayName(packetItem)
                                + " cannot be moved to an earlier lifecycle state");
            }

            PacketLifecycleChangeRequest entity = new PacketLifecycleChangeRequest();
            entity.setId(UUID.randomUUID());
            entity.setRequestGroupId(requestGroupId);
            entity.setPacketItemId(packetItem.getId());
            entity.setDisplayName(buildDisplayName(packetItem));
            entity.setItemName(cleanNullable(packetItem.getItemName()));
            entity.setPacketNumber(cleanNullable(packetItem.getPacketNumber()));
            entity.setSku(cleanNullable(packetItem.getSku()));
            entity.setPdNo(cleanNullable(packetItem.getPdNo()));
            entity.setDrawingNo(cleanNullable(packetItem.getDrawingNo()));
            entity.setPlantCode(cleanNullable(packetItem.getPlantCode()));
            entity.setSource(source);
            entity.setReason(reason);
            entity.setRequestedBy(actor);
            entity.setRequestedAt(now);
            entity.setRequestedFromState(preview.currentLifecycleState());
            entity.setRequestedFromLabel(preview.currentLifecycleLabel());
            entity.setRequestedToState(preview.previousLifecycleState());
            entity.setRequestedToLabel(preview.previousLifecycleLabel());
            entity.setStatus(PacketLifecycleChangeRequestStatus.PENDING);

            created.add(entity);
        }

        List<PacketLifecycleChangeRequest> saved;

        try {
            saved = requestRepository.saveAll(created);
            requestRepository.flush();
        } catch (DataIntegrityViolationException exception) {
            /*
             * The PostgreSQL partial unique index is the final concurrency
             * safety net. Two simultaneous submissions can both pass the
             * application-level exists check, but only one may keep the
             * PENDING row for a packet. Convert that database race into the
             * same clean 409 contract used by the normal duplicate check.
             */
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "One or more selected packets already has a pending lifecycle change request. Refresh the page and try again.",
                    exception);
        }

        List<RequestResponse> responses = saved.stream()
                .map(this::toResponse)
                .toList();

        return new SubmitResponse(
                requestGroupId,
                responses.size(),
                responses,
                responses.size() == 1
                        ? "State-change request sent to Admin for approval"
                        : responses.size() + " state-change requests sent to Admin for approval");
    }

    @Transactional(readOnly = true)
    public Page<RequestResponse> getPending(
            Pageable pageable,
            User user) {
        requireAdmin(user);

        return requestRepository
                .findByStatusOrderByRequestedAtAscIdAsc(
                        PacketLifecycleChangeRequestStatus.PENDING,
                        pageable)
                .map(this::toResponse);
    }

    /**
     * Bulk approval is atomic: either every selected request still matches its
     * originally requested from->to state and all rollbacks succeed, or the
     * complete transaction rolls back with no partial approvals.
     */
    @Transactional
    public DecisionResponse approve(
            DecisionRequest request,
            User user) {
        requireAdmin(user);

        List<UUID> requestIds = normalizeDecisionIds(request);
        String adminNote = cleanOptionalDecisionReason(
                request == null ? null : request.reason());

        List<PacketLifecycleChangeRequest> requests = lockPendingRequests(requestIds);
        String actor = cleanActor(user.getUsername());
        LocalDateTime now = LocalDateTime.now(APP_ZONE);

        for (PacketLifecycleChangeRequest lifecycleRequest : requests) {
            lifecycleService.rollbackOneStepForApprovedRequest(
                    lifecycleRequest.getPacketItemId(),
                    lifecycleRequest.getReason(),
                    actor,
                    lifecycleRequest.getRequestedFromState(),
                    lifecycleRequest.getRequestedToState());

            lifecycleRequest.setStatus(PacketLifecycleChangeRequestStatus.APPROVED);
            lifecycleRequest.setDecidedBy(actor);
            lifecycleRequest.setDecidedAt(now);
            lifecycleRequest.setDecisionReason(adminNote);
        }

        List<PacketLifecycleChangeRequest> saved = requestRepository.saveAll(requests);
        requestRepository.flush();

        List<RequestResponse> responses = saved.stream()
                .map(this::toResponse)
                .toList();

        return new DecisionResponse(
                responses.size(),
                responses,
                responses.size() == 1
                        ? "Request approved and packet moved back one state"
                        : responses.size() + " requests approved and packets moved back one state");
    }

    @Transactional
    public DecisionResponse reject(
            DecisionRequest request,
            User user) {
        requireAdmin(user);

        List<UUID> requestIds = normalizeDecisionIds(request);
        String rejectionReason = cleanRequiredDecisionReason(
                request == null ? null : request.reason());

        List<PacketLifecycleChangeRequest> requests = lockPendingRequests(requestIds);
        String actor = cleanActor(user.getUsername());
        LocalDateTime now = LocalDateTime.now(APP_ZONE);

        for (PacketLifecycleChangeRequest lifecycleRequest : requests) {
            lifecycleRequest.setStatus(PacketLifecycleChangeRequestStatus.REJECTED);
            lifecycleRequest.setDecidedBy(actor);
            lifecycleRequest.setDecidedAt(now);
            lifecycleRequest.setDecisionReason(rejectionReason);
        }

        List<PacketLifecycleChangeRequest> saved = requestRepository.saveAll(requests);
        requestRepository.flush();

        List<RequestResponse> responses = saved.stream()
                .map(this::toResponse)
                .toList();

        return new DecisionResponse(
                responses.size(),
                responses,
                responses.size() == 1
                        ? "Lifecycle change request rejected"
                        : responses.size() + " lifecycle change requests rejected");
    }

    private List<PacketLifecycleChangeRequest> lockPendingRequests(
            List<UUID> requestIds) {
        List<PacketLifecycleChangeRequest> rows = requestRepository
                .findAllByIdForDecision(requestIds);

        if (rows.size() != requestIds.size()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "One or more selected lifecycle requests no longer exist");
        }

        for (PacketLifecycleChangeRequest row : rows) {
            if (row.getStatus() != PacketLifecycleChangeRequestStatus.PENDING) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "One or more selected lifecycle requests have already been decided");
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

            PacketItem packetItem = history.getPacketItem();

            if (packetItem == null || packetItem.getId() == null) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Generated History record is no longer linked to a packet item");
            }

            assertGeneratedHistoryOwnership(history, user);

            return new ResolvedTarget(
                    packetItem.getId(),
                    history,
                    null);
        }

        /*
         * DISPATCH requests must originate from an actual Dispatch row.
         *
         * Do not accept an arbitrary PacketItem UUID merely because that UUID
         * exists. Without this binding, a Dispatch user who knew another
         * PacketItem UUID could bypass the Dispatch-row boundary and request a
         * rollback for any packet in an allowed plant.
         *
         * The frontend now sends zohoItemId first. The packetItemId fallback is
         * retained for cached/legacy rows, but it still has to resolve through
         * DispatchedItem before the request is accepted.
         */
        UUID possiblePacketItemId = tryParseUuid(targetId);

        DispatchedItem dispatchedItem = dispatchedItemRepository
                .findById(targetId)
                .orElse(null);

        if (dispatchedItem == null
                && possiblePacketItemId != null) {
            dispatchedItem = dispatchedItemRepository
                    .findByPacketItemId(possiblePacketItemId)
                    .orElse(null);
        }

        if (dispatchedItem == null) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Dispatch item not found or is no longer linked to Dispatch: " + targetId);
        }

        UUID packetItemId = dispatchedItem.getPacketItemId();

        if (packetItemId == null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This legacy dispatch row has no PacketItem linkage. An admin must repair the linkage before a rollback can be requested.");
        }

        return new ResolvedTarget(
                packetItemId,
                null,
                dispatchedItem);
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
                    "DISPATCH access is required to request a lifecycle change from the Dispatch page");
        }

        if (SOURCE_INVENTORY_HISTORY.equals(source)) {
            if (currentUserService.isNormalPacking(user)) {
                return;
            }

            throw new AccessDeniedException(
                    "Packing access is required to request a lifecycle change from Generated History");
        }

        throw new AccessDeniedException(
                "Lifecycle request source is not permitted");
    }

    private void assertPacketAccess(
            String source,
            PacketItem packetItem,
            StickerHistory history,
            DispatchedItem dispatchedItem,
            User user) {
        if (currentUserService.isAdmin(user)) {
            return;
        }

        if (SOURCE_INVENTORY_HISTORY.equals(source)) {
            assertGeneratedHistoryOwnership(history, user);
        }

        String plantCode = clean(packetItem.getPlantCode());

        if (plantCode.isBlank()) {
            throw new AccessDeniedException(
                    "Legacy packet has no plant assignment. An admin must assign its plant before a user can request a rollback.");
        }

        if (!currentUserService.canAccessPlant(user, plantCode)) {
            throw new AccessDeniedException(
                    "You do not have access to packet plant " + plantCode);
        }

        if (SOURCE_DISPATCH.equals(source) && dispatchedItem != null) {
            String dispatchPlant = clean(dispatchedItem.getPlantCode());

            if (!dispatchPlant.isBlank() &&
                    !dispatchPlant.equalsIgnoreCase(plantCode)) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Dispatch row and PacketItem plant assignments do not match. An admin must repair the linkage before a rollback can be requested.");
            }

            if (!dispatchPlant.isBlank() &&
                    !currentUserService.canAccessPlant(user, dispatchPlant)) {
                throw new AccessDeniedException(
                        "You do not have access to dispatch plant " + dispatchPlant);
            }
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
                    "You can request a lifecycle change only from your own Generated History");
        }
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
                    "Select at least one pending lifecycle request");
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
                    "Select at least one valid lifecycle request");
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
                "Lifecycle request source must be DISPATCH or INVENTORY_HISTORY");
    }

    private String cleanRequiredReason(
            String value) {
        String reason = clean(value);

        if (reason.length() < 5) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Reason must contain at least 5 characters");
        }

        if (reason.length() > MAX_REASON_LENGTH) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Reason cannot exceed " + MAX_REASON_LENGTH + " characters");
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
            PacketLifecycleChangeRequest row) {
        return new RequestResponse(
                row.getId(),
                row.getRequestGroupId(),
                row.getPacketItemId(),
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
                row.getRequestedFromState(),
                row.getRequestedFromLabel(),
                row.getRequestedToState(),
                row.getRequestedToLabel(),
                row.getStatus() == null ? null : row.getStatus().name(),
                row.getDecidedBy(),
                row.getDecidedAt(),
                row.getDecisionReason(),
                row.getRowVersion());
    }

    private String buildDisplayName(
            PacketItem packetItem) {
        String itemName = clean(packetItem.getItemName());
        String packetNumber = clean(packetItem.getPacketNumber());
        String sku = clean(packetItem.getSku());

        if (!itemName.isBlank() && !packetNumber.isBlank()) {
            return itemName + " | " + packetNumber;
        }

        if (!itemName.isBlank()) {
            return itemName;
        }

        if (!packetNumber.isBlank()) {
            return packetNumber;
        }

        if (!sku.isBlank()) {
            return sku;
        }

        return packetItem.getId().toString();
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
        UUID result = tryParseUuid(value);

        if (result == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    message);
        }

        return result;
    }

    private UUID tryParseUuid(
            String value) {
        try {
            return UUID.fromString(clean(value));
        } catch (Exception ignored) {
            return null;
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

    private String clean(
            Object value) {
        return value == null
                ? ""
                : String.valueOf(value).trim();
    }

    private record ResolvedTarget(
            UUID packetItemId,
            StickerHistory history,
            DispatchedItem dispatchedItem) {
    }
}
