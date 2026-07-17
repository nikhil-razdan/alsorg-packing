package com.alsorg.packing.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.domain.common.ApprovalStatus;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.domain.common.PacketItemType;
import com.alsorg.packing.domain.common.PacketStatus;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.item.PacketItem;
import com.alsorg.packing.domain.packet.Packet;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.repository.PacketItemRepository;
import com.alsorg.packing.repository.PacketRepository;

import jakarta.transaction.Transactional;

@Service
@Transactional
public class DispatchedItemService {

    private final DispatchedItemRepository dispatchedRepo;
    private final AuditLogService auditLogService;
    private final ActivityLogService activityLogService;
    private final PacketItemRepository packetItemRepo;
    private final PacketRepository packetRepository;
    private final PlantLocationService plantLocationService;

    public DispatchedItemService(
            DispatchedItemRepository dispatchedRepo,
            AuditLogService auditLogService,
            ActivityLogService activityLogService,
            PacketItemRepository packetItemRepo,
            PacketRepository packetRepository,
            PlantLocationService plantLocationService) {
        this.dispatchedRepo = dispatchedRepo;
        this.auditLogService = auditLogService;
        this.activityLogService = activityLogService;
        this.packetItemRepo = packetItemRepo;
        this.packetRepository = packetRepository;
        this.plantLocationService = plantLocationService;
    }

    public void requestRestore(String zohoItemId, String username, String role) {

        DispatchedItem item = dispatchedRepo.findById(zohoItemId)
                .orElseThrow(() -> new IllegalStateException("Item not found"));

        // ================= RULES =================

        if (item.getStatus() == ItemDispatchStatus.OUT_FOR_DELIVERY) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Cannot restore while trip is out for delivery. End the trip first.");
        }

        if (item.getStatus() != ItemDispatchStatus.DISPATCHED &&
                item.getStatus() != ItemDispatchStatus.DELIVERED) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Restore allowed only after delivery");
        }

        if (ApprovalStatus.PENDING.equals(item.getApprovalStatus())) {
            throw new IllegalStateException("Restore already requested");
        }

        // ================= UPDATE =================

        item.setApprovalStatus(ApprovalStatus.PENDING);
        item.setApprovalRequestedBy(username);
        item.setApprovalRequestedAt(LocalDateTime.now());

        dispatchedRepo.save(item);

        auditLogService.log(
                zohoItemId,
                "Restore requested",
                username,
                role);

        activityLogService.log(
                zohoItemId,
                "RESTORE REQUESTED",
                username,
                role,
                item.getStatus().name(),
                item.getStatus().name(),
                null);
    }

    public void approveRestore(String zohoItemId, String admin) {

        DispatchedItem item = dispatchedRepo.findById(zohoItemId)
                .orElseThrow(() -> new IllegalStateException("Item not found"));

        if (item.getApprovalStatus() != ApprovalStatus.PENDING) {
            throw new IllegalStateException("No pending restore request");
        }

        // ================= APPROVAL =================
        item.setApprovalStatus(ApprovalStatus.APPROVED);
        item.setApprovedBy(admin);
        item.setApprovedAt(LocalDateTime.now());

        // ================= KEEP DISPATCH HISTORY =================
        item.setStatus(ItemDispatchStatus.RESTORED);
        item.setStock(0);

        PacketItem original = null;

        // =====================================================
        // 1️⃣ TRY ORIGINAL PACKET ITEM
        // =====================================================
        if (item.getPacketItemId() != null) {
            original = packetItemRepo.findById(item.getPacketItemId()).orElse(null);
        }

        // =====================================================
        // 2️⃣ FALLBACK → USE PACKET ID
        // =====================================================
        if (original == null && item.getPacketId() != null) {

            System.out.println("⚠ Rebuilding from packetId");

            Packet packet = packetRepository.findById(item.getPacketId())
                    .orElse(null);

            if (packet != null) {
                original = new PacketItem();
                original.setPacket(packet);

                original.setItemName(item.getName());
                original.setSku(item.getSku());
                original.setClientName(item.getClientName());
                original.setClientAddress(item.getClientAddress());
                original.setPdNo(item.getPdNo());
                original.setDrawingNo(item.getDrawingNo());
                original.setDescription(item.getDescription());
                original.setRemarks(item.getRemarks());
                original.setQuantity(1);
                original.setLocation("FLOOR");
                original.setFloor("FLOOR");
            }
        }

        // =====================================================
        // 3️⃣ FINAL FALLBACK → REBUILD COMPLETELY (CRITICAL FIX)
        // =====================================================
        if (original == null || original.getPacket() == null) {

            System.out.println("⚠ FULL FALLBACK: rebuilding from dispatched item");

            // 🔥 CREATE NEW PACKET
            Packet packet = new Packet();
            packet.setId(UUID.randomUUID());
            packet.setStatus(PacketStatus.CREATED);
            packet.setCreatedAt(LocalDateTime.now());
            packet.setCreatedBy("SYSTEM");

            packet = packetRepository.save(packet);

            // 🔥 CREATE BASE ITEM
            original = new PacketItem();
            original.setPacket(packet);
            original.setQuantity(1);
            original.setItemName(item.getName());
            original.setSku(item.getSku());
            original.setClientName(item.getClientName());
            original.setClientAddress(item.getClientAddress());
            original.setPdNo(item.getPdNo());
            original.setDrawingNo(item.getDrawingNo());
            original.setDescription(item.getDescription());
            original.setRemarks(item.getRemarks());

            original.setLocation("FLOOR");
            original.setFloor("FLOOR");
        }

        // =====================================================
        // CREATE RESTORED ITEM
        // =====================================================
        PacketItem restored = new PacketItem();

        restored.setPacket(original.getPacket());
        restored.setId(UUID.randomUUID());
        // ================= COPY DATA =================
        restored.setItemName(original.getItemName());
        restored.setSku(original.getSku());
        restored.setClientName(original.getClientName());
        restored.setClientAddress(original.getClientAddress());
        restored.setPdNo(original.getPdNo());
        restored.setDrawingNo(original.getDrawingNo());
        restored.setDescription(original.getDescription());
        restored.setRemarks(original.getRemarks());
        restored.setDimensions(original.getDimensions());
        restored.setWeight(original.getWeight());
        restored.setQuantity(
                original.getQuantity() != null ? original.getQuantity() : 1);
        // ================= RESET STATE =================
        restored.setStatus("CREATED");
        restored.setLocation("FLOOR");
        restored.setFloor("FLOOR");

        // ================= ITERATION =================
        Long iteration = (original.getPrintIteration() == null ? 1 : original.getPrintIteration()) + 1;
        restored.setPrintIteration(iteration);
        restored.setStickerNumber(null);
        // ✅ CRITICAL: maintain linkage
        restored.setZohoItemId(item.getZohoItemId());

        // ✅ Optional but VERY important for traceability
        restored.setPacket(original.getPacket());

        // SAVE
        packetItemRepo.save(restored);

        // ✅ LINK BACK
        item.setPacketItemId(restored.getId());

        // 🔥 FORCE NEW STICKER
        restored.setStickerNumber(null);

        packetItemRepo.save(restored);

        // ================= SAVE DISPATCH =================
        dispatchedRepo.save(item);

        // ================= LOGGING =================
        auditLogService.log(zohoItemId, "Restore approved", admin, "ADMIN");

        activityLogService.log(
                zohoItemId,
                "RESTORE APPROVED",
                admin,
                "ADMIN",
                "DISPATCHED",
                "RESTORED_TO_INVENTORY",
                null);
    }

    public void rejectRestore(String zohoItemId, String admin) {

        DispatchedItem item = dispatchedRepo.findById(zohoItemId)
                .orElseThrow(() -> new IllegalStateException("Item not found"));

        item.setApprovalStatus(ApprovalStatus.REJECTED);
        item.setApprovedBy(admin);
        item.setApprovedAt(LocalDateTime.now());

        dispatchedRepo.save(item);

        auditLogService.log(
                zohoItemId,
                "Restore rejected",
                admin,
                "ADMIN");

        activityLogService.log(
                zohoItemId,
                "RESTORE REJECTED",
                admin,
                "ADMIN",
                "PENDING",
                "REJECTED",
                null);

    }

    private void assertDispatchItemPlantAccess(
            DispatchedItem item,
            java.util.Set<String> allowedPlants) {
        if (allowedPlants == null || allowedPlants.isEmpty()) {
            return;
        }

        /*
         * Legacy safety:
         * Old records may not have plantCode.
         * Do not break old data.
         */
        if (item.getPlantCode() == null || item.getPlantCode().isBlank()) {
            return;
        }

        if (!allowedPlants.contains(item.getPlantCode())) {
            throw new RuntimeException(
                    "User does not have access to plant: " + item.getPlantCode());
        }
    }

    private boolean isInFg(DispatchedItem item) {
        return item.getCurrentLocationCode() != null
                && item.getFgAreaCode() != null
                && item.getCurrentLocationCode().startsWith(item.getFgAreaCode());
    }

    private boolean canProceedFromPacked(DispatchedItem item) {

        /*
         * Legacy safety:
         * Old records may not have plant/location fields.
         * Do not block them, otherwise old READY items will break.
         */
        if (item.getPlantCode() == null || item.getPlantCode().isBlank()) {
            return true;
        }

        if (item.getCurrentLocationCode() == null || item.getCurrentLocationCode().isBlank()) {
            return true;
        }

        if (item.getFgAreaCode() == null || item.getFgAreaCode().isBlank()) {
            return true;
        }

        /*
         * New records with plant tracking must be in FG before next action.
         */
        return isInFg(item);
    }

    @Transactional
    public void updateDispatchStatus(
            String zohoItemId,
            ItemDispatchStatus newStatus,
            String username) {
        updateDispatchStatus(
                zohoItemId,
                newStatus,
                username,
                null);
    }

    @Transactional
    public void updateDispatchStatus(
            String zohoItemId,
            ItemDispatchStatus newStatus,
            String username,
            java.util.Set<String> allowedPlants) {

        DispatchedItem item = dispatchedRepo.findById(zohoItemId)
                .orElseThrow(() -> new IllegalStateException("Item not found"));

        assertDispatchItemPlantAccess(item, allowedPlants);

        ItemDispatchStatus current = item.getStatus();

        System.out.println("➡ REQUEST: " + zohoItemId + " | " + current + " → " + newStatus);

        if (newStatus == ItemDispatchStatus.DISPATCHED) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "DISPATCHED can only be set via Chalaan generation");
        }

        if (current == newStatus) {
            return;
        }

        String role = "DISPATCH";
        String action;

        if (current == ItemDispatchStatus.READY
                && newStatus == ItemDispatchStatus.READY_TO_STORE) {

            if (!canProceedFromPacked(item)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Move item to FG before warehouse action");
            }

            item.setStatus(newStatus);
            action = "PACKED → READY_TO_STORE";
        }

        else if (current == ItemDispatchStatus.READY
                && newStatus == ItemDispatchStatus.READY_TO_DISPATCH) {

            if (!canProceedFromPacked(item)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Move item to FG before dispatch action");
            }

            item.setStatus(newStatus);
            action = "PACKED → READY_TO_DISPATCH";
        }

        else if (current == ItemDispatchStatus.READY_TO_STORE
                && newStatus == ItemDispatchStatus.WAREHOUSE_REQUESTED) {

            item.setStatus(newStatus);
            action = "WAREHOUSE REQUESTED";
        }

        else if (current == ItemDispatchStatus.IN_WAREHOUSE
                && newStatus == ItemDispatchStatus.READY_TO_DISPATCH) {

            item.setStatus(newStatus);
            action = "WAREHOUSE → READY_TO_DISPATCH";
        }

        else {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid transition: " + current + " → " + newStatus);
        }

        dispatchedRepo.save(item);

        auditLogService.log(
                zohoItemId,
                action,
                username,
                role);

        activityLogService.log(
                zohoItemId,
                action,
                username,
                role,
                current.name(),
                newStatus.name(),
                item.getGatePassNumber());
    }

    public String moveToWarehouse(
            String zohoItemId,
            String warehouseCode,
            String fromLocation,
            String username) {
        return moveToWarehouse(
                zohoItemId,
                warehouseCode,
                fromLocation,
                username,
                null);
    }

    public String moveToWarehouse(
            String zohoItemId,
            String warehouseCode,
            String fromLocation,
            String username,
            java.util.Set<String> allowedPlants) {

        DispatchedItem item = dispatchedRepo.findById(zohoItemId)
                .orElseThrow(() -> new IllegalStateException("Item not found"));

        assertDispatchItemPlantAccess(item, allowedPlants);

        if (item.getStatus() != ItemDispatchStatus.READY_TO_STORE) {
            throw new IllegalStateException(
                    "Only READY_TO_STORE items can be moved to warehouse");
        }

        String cleanWarehouse = cleanLocationCode(warehouseCode);

        if (cleanWarehouse == null || cleanWarehouse.isBlank()) {
            throw new RuntimeException("Warehouse code required");
        }

        assertAllowedWarehouseCode(cleanWarehouse);

        String cleanFromLocation = firstNonBlank(
                fromLocation,
                item.getCurrentLocationCode(),
                item.getLocation(),
                item.getPackedAreaCode());

        if (cleanFromLocation == null || cleanFromLocation.isBlank()) {
            throw new RuntimeException("From location required");
        }

        assertAllowedFromLocation(cleanFromLocation);

        /*
         * Keep plant access safety.
         * But allow your fixed warehouse list globally.
         */
        if (!FIXED_WAREHOUSE_CODES.contains(cleanWarehouse)
                && item.getPlantCode() != null
                && !item.getPlantCode().isBlank()
                && !plantLocationService.isWarehouseAllowed(
                        item.getPlantCode(),
                        cleanWarehouse)) {

            throw new RuntimeException(
                    "Warehouse " + cleanWarehouse
                            + " is not allowed for plant "
                            + item.getPlantCode());
        }

        String gatePass = generateGatePassNumber(cleanWarehouse);

        item.setStatus(ItemDispatchStatus.WAREHOUSE_REQUESTED);
        item.setFromLocation(cleanFromLocation);
        item.setWarehouseCode(cleanWarehouse);
        item.setGatePassNumber(gatePass);
        item.setStoredAt(null);

        item.setCreatedBy(
                username != null && !username.isBlank()
                        ? username
                        : "SYSTEM");

        dispatchedRepo.save(item);

        auditLogService.log(
                zohoItemId,
                "Warehouse move requested | GP: " + gatePass,
                username,
                "DISPATCH");

        activityLogService.log(
                zohoItemId,
                "WAREHOUSE REQUESTED",
                username,
                "DISPATCH",
                "READY_TO_STORE",
                "WAREHOUSE_REQUESTED",
                gatePass);

        return gatePass;
    }

    public String bulkMoveToWarehouse(
            List<String> itemIds,
            String warehouseCode,
            String fromLocation,
            String username) {
        return bulkMoveToWarehouse(
                itemIds,
                warehouseCode,
                fromLocation,
                username,
                null);
    }

    public String bulkMoveToWarehouse(
            List<String> itemIds,
            String warehouseCode,
            String fromLocation,
            String username,
            java.util.Set<String> allowedPlants) {

        if (itemIds == null || itemIds.isEmpty()) {
            throw new RuntimeException("No items selected");
        }

        String cleanWarehouse = cleanLocationCode(warehouseCode);

        if (cleanWarehouse == null || cleanWarehouse.isBlank()) {
            throw new RuntimeException("Warehouse code required");
        }

        assertAllowedWarehouseCode(cleanWarehouse);

        String cleanFromLocation = cleanLocationCode(fromLocation);

        if (cleanFromLocation == null || cleanFromLocation.isBlank()) {
            throw new RuntimeException("From location required");
        }

        assertAllowedFromLocation(cleanFromLocation);

        List<DispatchedItem> items = dispatchedRepo.findAllById(itemIds);

        if (items.isEmpty()) {
            throw new RuntimeException("No items selected");
        }

        for (DispatchedItem item : items) {
            assertDispatchItemPlantAccess(item, allowedPlants);

            if (item.getStatus() != ItemDispatchStatus.READY_TO_STORE) {
                throw new RuntimeException(
                        "Invalid item state: " + item.getZohoItemId());
            }

            if (!FIXED_WAREHOUSE_CODES.contains(cleanWarehouse)
                    && item.getPlantCode() != null
                    && !item.getPlantCode().isBlank()
                    && !plantLocationService.isWarehouseAllowed(
                            item.getPlantCode(),
                            cleanWarehouse)) {

                throw new RuntimeException(
                        "Warehouse " + cleanWarehouse
                                + " is not allowed for plant "
                                + item.getPlantCode());
            }
        }

        String gatePass = generateGatePassNumber(cleanWarehouse);

        for (DispatchedItem item : items) {
            item.setStatus(ItemDispatchStatus.WAREHOUSE_REQUESTED);
            item.setWarehouseCode(cleanWarehouse);
            item.setGatePassNumber(gatePass);
            item.setFromLocation(cleanFromLocation);
            item.setStoredAt(null);

            item.setCreatedBy(
                    username != null && !username.isBlank()
                            ? username
                            : "SYSTEM");
        }

        dispatchedRepo.saveAll(items);

        for (DispatchedItem item : items) {
            auditLogService.log(
                    item.getZohoItemId(),
                    "Warehouse move requested (bulk) | GP: " + gatePass,
                    username,
                    "DISPATCH");

            activityLogService.log(
                    item.getZohoItemId(),
                    "WAREHOUSE REQUESTED (BULK)",
                    username,
                    "DISPATCH",
                    "READY_TO_STORE",
                    "WAREHOUSE_REQUESTED",
                    gatePass);
        }

        return gatePass;
    }

    public void approveWarehouseMove(
            String zohoItemId,
            String enteredGatePass,
            String username) {

        approveWarehouseMove(
                zohoItemId,
                enteredGatePass,
                username,
                null,
                "WAREHOUSE");
    }

    public void approveWarehouseMove(
            String zohoItemId,
            String enteredGatePass,
            String username,
            java.util.Set<String> allowedPlants,
            String role) {

        DispatchedItem item = dispatchedRepo.findById(zohoItemId)
                .orElseThrow(() -> new IllegalStateException("Item not found"));

        assertDispatchItemPlantAccess(item, allowedPlants);

        if (item.getStatus() != ItemDispatchStatus.WAREHOUSE_REQUESTED) {
            throw new IllegalStateException("Item not pending warehouse approval");
        }

        if (enteredGatePass == null || enteredGatePass.isBlank()) {
            throw new IllegalStateException("Gate pass required");
        }

        String savedGatePass = normalizeGatePass(item.getGatePassNumber());

        String userGatePass = normalizeGatePass(enteredGatePass);

        if (savedGatePass.isBlank() || !savedGatePass.equals(userGatePass)) {
            throw new IllegalStateException("Invalid Gate Pass");
        }

        String warehouseLocation = firstNonBlank(
                item.getWarehouseCode(),
                item.getCurrentLocationCode(),
                item.getLocation(),
                "WH");

        warehouseLocation = cleanLocationCode(warehouseLocation);

        item.setStatus(ItemDispatchStatus.IN_WAREHOUSE);
        item.setStoredAt(LocalDateTime.now(APP_ZONE));
        item.setWarehouseCode(warehouseLocation);
        item.setCurrentLocationCode(warehouseLocation);
        item.setLocation(warehouseLocation);

        dispatchedRepo.save(item);

        syncPacketItemLocation(
                item,
                warehouseLocation,
                null);

        String safeRole = role != null && !role.isBlank()
                ? role
                : "WAREHOUSE";

        auditLogService.log(
                zohoItemId,
                "Warehouse approved | GP: " + item.getGatePassNumber(),
                username,
                safeRole);

        activityLogService.log(
                zohoItemId,
                "WAREHOUSE APPROVED",
                username,
                safeRole,
                "WAREHOUSE_REQUESTED",
                "IN_WAREHOUSE",
                item.getGatePassNumber());
    }

    public void rejectWarehouseMove(
            String zohoItemId,
            String username) {

        rejectWarehouseMove(
                zohoItemId,
                username,
                null,
                "WAREHOUSE");
    }

    public void rejectWarehouseMove(
            String zohoItemId,
            String username,
            java.util.Set<String> allowedPlants,
            String role) {

        DispatchedItem item = dispatchedRepo.findById(zohoItemId)
                .orElseThrow(() -> new IllegalStateException("Item not found"));

        assertDispatchItemPlantAccess(item, allowedPlants);

        if (item.getStatus() != ItemDispatchStatus.WAREHOUSE_REQUESTED) {
            throw new IllegalStateException("Item not pending warehouse approval");
        }

        String returnLocation = firstNonBlank(
                item.getFromLocation(),
                item.getCurrentLocationCode(),
                item.getLocation(),
                item.getPackedAreaCode());

        item.setStatus(ItemDispatchStatus.READY_TO_STORE);
        item.setWarehouseCode(null);
        item.setGatePassNumber(null);
        item.setStoredAt(null);
        item.setFromLocation(null);

        if (returnLocation != null && !returnLocation.isBlank()) {
            item.setCurrentLocationCode(returnLocation);
            item.setLocation(returnLocation);
        }

        dispatchedRepo.save(item);

        syncPacketItemLocation(
                item,
                returnLocation,
                item.getFgZoneCode());

        String safeRole = role != null && !role.isBlank()
                ? role
                : "WAREHOUSE";

        auditLogService.log(
                zohoItemId,
                "Warehouse move rejected",
                username,
                safeRole);

        activityLogService.log(
                zohoItemId,
                "WAREHOUSE REJECTED",
                username,
                safeRole,
                "WAREHOUSE_REQUESTED",
                "READY_TO_STORE",
                null);
    }

    public void markDispatchedFromChalaan(
            String zohoItemId,
            String username) {
        DispatchedItem item = dispatchedRepo.findById(zohoItemId)
                .orElseThrow(() -> new IllegalStateException("Item not found"));

        ItemDispatchStatus previousStatus = item.getStatus();

        /*
         * Allowed:
         * 1. READY_TO_DISPATCH - normal dispatch flow.
         * 2. READY - QR dispatch flow after FG movement / legacy-safe item.
         */
        if (previousStatus != ItemDispatchStatus.READY_TO_DISPATCH
                && previousStatus != ItemDispatchStatus.READY) {
            throw new IllegalStateException(
                    "Item must be READY or READY_TO_DISPATCH before challan dispatch");
        }

        /*
         * If new plant/location tracking exists, READY item must already be in FG.
         * Legacy records without plant/location are allowed.
         */
        if (previousStatus == ItemDispatchStatus.READY
                && !canProceedFromPacked(item)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Move item to FG before dispatch action");
        }

        LocalDateTime nowIst = LocalDateTime.now(
                java.time.ZoneId.of("Asia/Kolkata"));

        item.setStatus(ItemDispatchStatus.DISPATCHED);
        item.setDispatchedBy(
                username != null && !username.isBlank()
                        ? username
                        : "SYSTEM");

        /*
         * Do not overwrite if DispatchChallanService already set selected dispatch
         * time.
         */
        if (item.getDispatchedAt() == null) {
            item.setDispatchedAt(nowIst);
        }

        /*
         * Trip timer starts from dispatch/challan time.
         * Do not overwrite if already set by selected driver/vehicle dispatch form.
         */
        if (item.getTripStartedAt() == null) {
            item.setTripStartedAt(item.getDispatchedAt());
        }

        /*
         * Important:
         * Do NOT set tripEndedAt here.
         * Logistics/Admin ends the trip later.
         */

        item.setStock(0);

        dispatchedRepo.save(item);

        auditLogService.log(
                zohoItemId,
                "Dispatched via chalaan",
                username,
                "DISPATCH");

        activityLogService.log(
                zohoItemId,
                "DISPATCHED",
                username,
                "DISPATCH",
                previousStatus == null ? null : previousStatus.name(),
                "DISPATCHED",
                null);
    }

    public void createFromPacketItem(PacketItem item) {

        String id = item.getId().toString();
        if (dispatchedRepo.existsById(id)) {
            return;
        }

        DispatchedItem d = new DispatchedItem();
        if (item.getId() == null) {
            throw new IllegalStateException("PacketItem ID is null");
        }
        if (item.getPacket() == null) {
            throw new IllegalStateException("PacketItem has no packet");
        }
        d.setItemType(
                item.getItemType() != null
                        ? item.getItemType()
                        : PacketItemType.NORMAL);

        d.setLinkedPacketItemId(
                item.getLinkedPacketItemId());

        d.setLinkedMasterItemId(
                item.getLinkedMasterItemId());
                
        d.setZohoItemId(id); // primary key
        d.setName(item.getItemName());
        d.setPacketItemId(item.getId());
        d.setPacketId(item.getPacket().getId());
        d.setSku(item.getSku());
        d.setLocation(item.getCurrentLocationCode());
        d.setFloor(item.getFloor());

        d.setPlantCode(item.getPlantCode());
        d.setPackedAreaCode(item.getPackedAreaCode());
        d.setCurrentLocationCode(item.getCurrentLocationCode());
        d.setFgAreaCode(item.getFgAreaCode());
        d.setFgZoneCode(item.getFgZoneCode());

        d.setStock(1);
        d.setStatus(ItemDispatchStatus.READY);
        d.setStickerNumber(item.getStickerNumber());
        d.setWarehouseCode(null);
        d.setGatePassNumber(null);
        d.setPdNo(item.getPdNo());
        d.setWeight(item.getWeight());
        d.setDimensions(item.getDimensions());
        d.setClientName(item.getClientName());
        d.setClientAddress(item.getClientAddress());
        d.setDrawingNo(item.getDrawingNo());
        d.setDescription(item.getDescription());
        d.setRemarks(item.getRemarks());
        d.setItemType(
                item.getItemType() != null
                        ? item.getItemType()
                        : PacketItemType.NORMAL);

        d.setLinkedPacketItemId(
                item.getLinkedPacketItemId());

        d.setLinkedMasterItemId(
                item.getLinkedMasterItemId());

        dispatchedRepo.save(d);
    }

    public void requestReturnToDispatch(String zohoItemId, String username) {

        DispatchedItem item = dispatchedRepo.findById(zohoItemId)
                .orElseThrow(() -> new IllegalStateException("Item not found"));

        if (item.getStatus() != ItemDispatchStatus.IN_WAREHOUSE) {
            throw new RuntimeException("Only warehouse items can be returned");
        }

        item.setStatus(ItemDispatchStatus.WAREHOUSE_RETURN_REQUESTED);

        dispatchedRepo.save(item);

        auditLogService.log(
                zohoItemId,
                "Warehouse return requested",
                username,
                "DISPATCH");

        activityLogService.log(
                zohoItemId,
                "WAREHOUSE RETURN REQUESTED",
                username,
                "DISPATCH",
                "IN_WAREHOUSE",
                "WAREHOUSE_RETURN_REQUESTED",
                null);
    }

    public void approveReturnToDispatch(String zohoItemId, String admin) {

        DispatchedItem item = dispatchedRepo.findById(zohoItemId)
                .orElseThrow(() -> new IllegalStateException("Item not found"));

        if (item.getStatus() != ItemDispatchStatus.WAREHOUSE_RETURN_REQUESTED) {
            throw new RuntimeException("No return request pending");
        }

        item.setStatus(ItemDispatchStatus.READY);

        dispatchedRepo.save(item);

        auditLogService.log(
                zohoItemId,
                "Warehouse return approved",
                admin,
                "ADMIN");

        activityLogService.log(
                zohoItemId,
                "RETURN APPROVED",
                admin,
                "ADMIN",
                "WAREHOUSE_RETURN_REQUESTED",
                "READY",
                null);
    }

    public void rejectReturnToDispatch(String zohoItemId, String admin) {

        DispatchedItem item = dispatchedRepo.findById(zohoItemId)
                .orElseThrow(() -> new IllegalStateException("Item not found"));

        item.setStatus(ItemDispatchStatus.IN_WAREHOUSE);

        dispatchedRepo.save(item);

        auditLogService.log(
                zohoItemId,
                "Warehouse return rejected",
                admin,
                "ADMIN");

        activityLogService.log(
                zohoItemId,
                "RETURN REJECTED",
                admin,
                "ADMIN",
                "WAREHOUSE_RETURN_REQUESTED",
                "IN_WAREHOUSE",
                null);
    }

    public void movePackedItemToFg(
            String zohoItemId,
            String fgZoneCode,
            String username,
            java.util.Set<String> allowedPlants) {
        DispatchedItem item = dispatchedRepo.findById(zohoItemId)
                .orElseThrow(() -> new IllegalStateException("Item not found"));

        assertDispatchItemPlantAccess(item, allowedPlants);

        if (item.getStatus() != ItemDispatchStatus.READY) {
            throw new RuntimeException("Only packed items can be moved to FG");
        }

        if (item.getPlantCode() == null || item.getPlantCode().isBlank()) {
            throw new RuntimeException("Plant not assigned to this item");
        }

        String fgLocation = plantLocationService.buildFgLocation(
                item.getPlantCode(),
                fgZoneCode);

        String oldLocation = item.getCurrentLocationCode();

        item.setCurrentLocationCode(fgLocation);
        item.setLocation(fgLocation);
        item.setFgZoneCode(fgZoneCode);

        dispatchedRepo.save(item);

        if (item.getPacketItemId() != null) {
            packetItemRepo.findById(item.getPacketItemId()).ifPresent(packetItem -> {
                packetItem.setCurrentLocationCode(fgLocation);
                packetItem.setLocation(fgLocation);
                packetItem.setFgZoneCode(fgZoneCode);
                packetItemRepo.save(packetItem);
            });
        }

        auditLogService.log(
                zohoItemId,
                "Moved packed item to FG: " + fgLocation,
                username,
                "DISPATCH");

        activityLogService.log(
                zohoItemId,
                "MOVED TO FG",
                username,
                "DISPATCH",
                oldLocation,
                fgLocation,
                null);
    }

    public String createGatePassNumber(
            String warehouseCode) {
        return generateGatePassNumber(warehouseCode);
    }

    private String generateGatePassNumber(String warehouseCode) {
        String warehouse = warehouseShortCode(warehouseCode);

        String date = java.time.LocalDate.now(APP_ZONE)
                .format(
                        java.time.format.DateTimeFormatter.ofPattern("MMdd"));

        for (int i = 0; i < 30; i++) {
            String suffix = UUID.randomUUID()
                    .toString()
                    .replace("-", "")
                    .substring(0, 5)
                    .toUpperCase();

            String gatePass = "GP-" + warehouse + "-" + date + "-" + suffix;

            if (dispatchedRepo.findByGatePassNumber(gatePass).isEmpty()) {
                return gatePass;
            }
        }

        throw new RuntimeException("Could not generate unique gate pass number");
    }

    public void bulkUpdateStatus(
            List<String> ids,
            ItemDispatchStatus status,
            String username) {
        bulkUpdateStatus(ids, status, username, null);
    }

    public void bulkUpdateStatus(
            List<String> ids,
            ItemDispatchStatus status,
            String username,
            java.util.Set<String> allowedPlants) {
        List<DispatchedItem> items = dispatchedRepo.findAllById(ids);

        for (DispatchedItem item : items) {
            updateDispatchStatus(
                    item.getZohoItemId(),
                    status,
                    username,
                    allowedPlants);
        }
    }

    public DispatchedItem assignPlantLocationToDispatchedItem(
            String zohoItemId,
            String plantCode,
            String currentLocationCode,
            String fgZoneCode,
            String warehouseCode,
            String username) {
        DispatchedItem item = dispatchedRepo.findById(zohoItemId)
                .orElseThrow(() -> new RuntimeException("Item not found"));

        if (plantCode == null || plantCode.isBlank()) {
            throw new RuntimeException("Plant code required");
        }

        PlantLocationService.PlantConfig plant = plantLocationService.getPlantConfig(plantCode);

        String finalLocation = currentLocationCode;

        /*
         * Auto-decide location if UI does not send currentLocationCode.
         */
        if (finalLocation == null || finalLocation.isBlank()) {

            if (item.getStatus() == ItemDispatchStatus.READY) {

                // Packed item should be in PKD area.
                finalLocation = plant.packedAreaCode();

            } else if (item.getStatus() == ItemDispatchStatus.READY_TO_STORE ||
                    item.getStatus() == ItemDispatchStatus.READY_TO_DISPATCH) {

                // Item already moved towards FG.
                finalLocation = plantLocationService.buildFgLocation(
                        plantCode,
                        fgZoneCode);

            } else if (item.getStatus() == ItemDispatchStatus.WAREHOUSE_REQUESTED ||
                    item.getStatus() == ItemDispatchStatus.IN_WAREHOUSE ||
                    item.getStatus() == ItemDispatchStatus.WAREHOUSE_RETURN_REQUESTED) {

                // Warehouse item.
                finalLocation = warehouseCode != null && !warehouseCode.isBlank()
                        ? warehouseCode.trim()
                        : item.getWarehouseCode();
            }
        }

        /*
         * Final safety fallback.
         */
        if (finalLocation == null || finalLocation.isBlank()) {
            finalLocation = plant.packedAreaCode();
        }

        /*
         * IMPORTANT:
         * Java lambda needs final/effectively final variable.
         */
        final String resolvedLocation = finalLocation;
        final String resolvedFgZoneCode = fgZoneCode != null && !fgZoneCode.isBlank()
                ? fgZoneCode.trim()
                : null;

        item.setPlantCode(plantCode);
        item.setPackedAreaCode(plant.packedAreaCode());
        item.setFgAreaCode(plant.fgAreaCode());
        item.setFgZoneCode(resolvedFgZoneCode);
        item.setCurrentLocationCode(resolvedLocation);
        item.setLocation(resolvedLocation);

        if (warehouseCode != null && !warehouseCode.isBlank()) {
            item.setWarehouseCode(warehouseCode.trim());
        }

        dispatchedRepo.save(item);

        if (item.getPacketItemId() != null) {
            packetItemRepo.findById(item.getPacketItemId()).ifPresent(packetItem -> {
                packetItem.setPlantCode(plantCode);
                packetItem.setPackedAreaCode(plant.packedAreaCode());
                packetItem.setFgAreaCode(plant.fgAreaCode());
                packetItem.setFgZoneCode(resolvedFgZoneCode);
                packetItem.setCurrentLocationCode(resolvedLocation);
                packetItem.setLocation(resolvedLocation);

                packetItemRepo.save(packetItem);
            });
        }

        auditLogService.log(
                zohoItemId,
                "Plant/location assigned: " + plantCode + " / " + resolvedLocation,
                username,
                "ADMIN");

        activityLogService.log(
                zohoItemId,
                "PLANT LOCATION ASSIGNED",
                username,
                "ADMIN",
                null,
                resolvedLocation,
                null);

        return item;
    }

    private String cleanLocationCode(String value) {
        if (value == null) {
            return null;
        }

        String text = value.trim()
                .toUpperCase()
                .replaceAll("\\s+", "");

        if (text.isBlank()
                || "NULL".equals(text)
                || "UNDEFINED".equals(text)
                || "-".equals(text)) {
            return null;
        }

        return text;
    }

    private void assertAllowedWarehouseCode(String warehouseCode) {
        if (!FIXED_WAREHOUSE_CODES.contains(warehouseCode)) {
            throw new RuntimeException(
                    "Invalid warehouse code: " + warehouseCode);
        }
    }

    private void assertAllowedFromLocation(String fromLocation) {
        if (!FIXED_FROM_LOCATION_CODES.contains(fromLocation)) {
            throw new RuntimeException(
                    "Invalid from location: " + fromLocation);
        }
    }

    private String warehouseShortCode(String warehouseCode) {
        String clean = cleanLocationCode(warehouseCode);

        if (clean == null || clean.isBlank()) {
            return "WH";
        }

        return switch (clean) {
            case "BLS-WH-1" -> "BLS1";
            case "RTP-WH-2" -> "RTP2";
            case "AL-P1" -> "ALP1";
            case "AL-P2" -> "ALP2";
            case "AL-P3" -> "ALP3";
            case "AL-P4" -> "ALP4";
            default -> clean.replaceAll("[^A-Z0-9]", "");
        };
    }

    private String normalizeGatePass(String value) {
        if (value == null) {
            return "";
        }

        return value
                .trim()
                .toUpperCase()
                .replace("–", "-")
                .replace("—", "-")
                .replaceAll("\\s+", "")
                .replaceAll("[^A-Z0-9-]", "");
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }

        for (String value : values) {
            if (value != null && !value.trim().isBlank()) {
                return value.trim();
            }
        }

        return "";
    }

    private void syncPacketItemLocation(
            DispatchedItem item,
            String location,
            String fgZoneCode) {

        if (item == null || item.getPacketItemId() == null) {
            return;
        }

        packetItemRepo.findById(item.getPacketItemId())
                .ifPresent(packetItem -> {
                    if (location != null && !location.isBlank()) {
                        packetItem.setCurrentLocationCode(location);
                        packetItem.setLocation(location);
                    }

                    packetItem.setWarehouseCode(item.getWarehouseCode());
                    packetItem.setFgZoneCode(fgZoneCode);

                    packetItemRepo.save(packetItem);
                });
    }

    private static final java.time.ZoneId APP_ZONE = java.time.ZoneId.of("Asia/Kolkata");

    private static final java.util.Set<String> FIXED_WAREHOUSE_CODES = java.util.Set.of(
            "BLS-WH-1",
            "RTP-WH-2",
            "AL-P1",
            "AL-P2",
            "AL-P3",
            "AL-P4");

    private static final java.util.Set<String> FIXED_FROM_LOCATION_CODES = java.util.Set.of(
            "AL-P1-FG-1-A",
            "AL-P1-FG-1-B",
            "AL-P1-FG-1-C",
            "AL-P2-FG-2",
            "AL-P3-FG-3",
            "AL-P4-FG-4",
            "AL-P1",
            "AL-P2",
            "AL-P3",
            "AL-P4",
            "AL-P1-PKD-1",
            "AL-P2-PKD-2",
            "AL-P3-PKD-3",
            "AL-P4-PKD-4");

}
