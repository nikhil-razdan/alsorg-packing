package com.alsorg.packing.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.domain.common.ApprovalStatus;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.domain.common.PacketStatus;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.item.PacketItem;
import com.alsorg.packing.domain.packet.Packet;
import com.alsorg.packing.integration.zoho.dto.ZohoItemDTO;
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

        if (item.getPlantCode() != null
                && !item.getPlantCode().isBlank()
                && !plantLocationService.isWarehouseAllowed(item.getPlantCode(), warehouseCode)) {

            throw new RuntimeException(
                    "Warehouse " + warehouseCode + " is not allowed for plant " + item.getPlantCode());
        }

        if (item.getStatus() != ItemDispatchStatus.READY_TO_STORE) {
            throw new IllegalStateException("Only READY_TO_STORE items can be moved to warehouse");
        }

        String gatePass = generateGatePassNumber(warehouseCode);

        item.setStatus(ItemDispatchStatus.WAREHOUSE_REQUESTED);
        item.setFromLocation(fromLocation);
        item.setCreatedBy(
                username != null && !username.isBlank()
                        ? username
                        : "SYSTEM");
        item.setWarehouseCode(warehouseCode);
        item.setGatePassNumber(gatePass);
        item.setStoredAt(null);

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
        if (warehouseCode == null || warehouseCode.isBlank()) {
            throw new RuntimeException("Warehouse code required");
        }

        String gatePass = generateGatePassNumber(warehouseCode);

        List<DispatchedItem> items = dispatchedRepo.findAllById(itemIds);

        if (items.isEmpty()) {
            throw new RuntimeException("No items selected");
        }

        for (DispatchedItem item : items) {
            assertDispatchItemPlantAccess(item, allowedPlants);

            if (item.getPlantCode() != null
                    && !item.getPlantCode().isBlank()
                    && !plantLocationService.isWarehouseAllowed(item.getPlantCode(), warehouseCode)) {

                throw new RuntimeException(
                        "Warehouse " + warehouseCode + " is not allowed for plant " + item.getPlantCode());
            }

            if (item.getStatus() != ItemDispatchStatus.READY_TO_STORE) {
                throw new RuntimeException("Invalid item state: " + item.getZohoItemId());
            }
        }

        for (DispatchedItem item : items) {
            item.setStatus(ItemDispatchStatus.WAREHOUSE_REQUESTED);
            item.setWarehouseCode(warehouseCode);
            item.setGatePassNumber(gatePass);
            item.setFromLocation(fromLocation);
            item.setCreatedBy(
                    username != null && !username.isBlank()
                            ? username
                            : "SYSTEM");
            item.setStoredAt(null);
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

    public void approveWarehouseMove(String zohoItemId, String enteredGatePass, String username) {

        DispatchedItem item = dispatchedRepo.findById(zohoItemId)
                .orElseThrow(() -> new IllegalStateException("Item not found"));

        if (enteredGatePass == null || enteredGatePass.isBlank()) {
            throw new IllegalStateException("Gate pass required");
        }

        if (!enteredGatePass.equals(item.getGatePassNumber())) {
            throw new IllegalStateException("Invalid Gate Pass");
        }

        if (item.getStatus() != ItemDispatchStatus.WAREHOUSE_REQUESTED) {
            throw new IllegalStateException("Item not pending warehouse approval");
        }

        item.setStatus(ItemDispatchStatus.IN_WAREHOUSE);
        item.setStoredAt(LocalDateTime.now());

        dispatchedRepo.save(item);

        auditLogService.log(
                zohoItemId,
                "Warehouse approved | GP: " + enteredGatePass,
                username,
                "DISPATCH");

        activityLogService.log(
                zohoItemId,
                "WAREHOUSE APPROVED",
                username,
                "DISPATCH",
                "WAREHOUSE_REQUESTED",
                "IN_WAREHOUSE",
                enteredGatePass);
    }

    public void rejectWarehouseMove(String zohoItemId, String username) {

        DispatchedItem item = dispatchedRepo.findById(zohoItemId)
                .orElseThrow(() -> new IllegalStateException("Item not found"));

        if (item.getStatus() != ItemDispatchStatus.WAREHOUSE_REQUESTED) {
            throw new IllegalStateException("Item not pending warehouse approval");
        }

        item.setStatus(ItemDispatchStatus.READY_TO_STORE);
        item.setWarehouseCode(null);
        item.setGatePassNumber(null);
        item.setStoredAt(null);

        dispatchedRepo.save(item);

        auditLogService.log(
                zohoItemId,
                "Warehouse move rejected",
                username,
                "DISPATCH");

        activityLogService.log(
                zohoItemId,
                "WAREHOUSE REJECTED",
                username,
                "DISPATCH",
                "WAREHOUSE_REQUESTED",
                "READY_TO_STORE",
                null);
    }

    public void markDispatchedFromChalaan(String zohoItemId, String username) {

        DispatchedItem item = dispatchedRepo.findById(zohoItemId)
                .orElseThrow(() -> new IllegalStateException("Item not found"));

        if (item.getStatus() != ItemDispatchStatus.READY_TO_DISPATCH) {
            throw new IllegalStateException("Item must be READY_TO_DISPATCH");
        }

        item.setStatus(ItemDispatchStatus.DISPATCHED);
        item.setDispatchedBy(username);
        item.setDispatchedAt(LocalDateTime.now());
        item.setStock(0);

        dispatchedRepo.save(item);

        auditLogService.log(zohoItemId, "Dispatched via chalaan", username, "DISPATCH");

        activityLogService.log(
                zohoItemId,
                "DISPATCHED",
                username,
                "DISPATCH",
                "READY_TO_DISPATCH",
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

    private String generateGatePassNumber(
            String warehouseCode) {
        String cleanWarehouse = warehouseCode == null || warehouseCode.trim().isBlank()
                ? "WH"
                : warehouseCode
                        .trim()
                        .toUpperCase()
                        .replaceAll("[^A-Z0-9]", "");

        if (cleanWarehouse.isBlank()) {
            cleanWarehouse = "WH";
        }

        String date = java.time.LocalDate.now(
                java.time.ZoneId.of("Asia/Kolkata")).format(
                        java.time.format.DateTimeFormatter.BASIC_ISO_DATE);

        String suffix = UUID.randomUUID()
                .toString()
                .substring(0, 6)
                .toUpperCase();

        return "GP-" + cleanWarehouse + "-" + date + "-" + suffix;
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

}
