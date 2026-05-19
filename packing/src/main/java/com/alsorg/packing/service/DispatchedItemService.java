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
    
    public DispatchedItemService(
            DispatchedItemRepository dispatchedRepo,
            AuditLogService auditLogService,
            ActivityLogService activityLogService,
            PacketItemRepository packetItemRepo,
            PacketRepository packetRepository
    ) {
        this.dispatchedRepo = dispatchedRepo;
        this.auditLogService = auditLogService;
        this.activityLogService = activityLogService;
        this.packetItemRepo = packetItemRepo;
        this.packetRepository = packetRepository;
    }

    public void requestRestore(String zohoItemId, String username, String role) {

        DispatchedItem item = dispatchedRepo.findById(zohoItemId)
                .orElseThrow(() -> new IllegalStateException("Item not found"));

        // ================= RULES =================

     // ✅ ONLY ALLOW RESTORE AFTER DISPATCH
        if (item.getStatus() != ItemDispatchStatus.DISPATCHED) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Restore allowed only after dispatch"
            );
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
                role
        );

        activityLogService.log(
                zohoItemId,
                "RESTORE REQUESTED",
                username,
                role,
                item.getStatus().name(),
                item.getStatus().name(),
                null
        );
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
        	    original.getQuantity() != null ? original.getQuantity() : 1
        	);
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
                null
        );
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
                "ADMIN"
        );
        
        activityLogService.log(
                zohoItemId,
                "RESTORE REJECTED",
                admin,
                "ADMIN",
                "PENDING",
                "REJECTED",
                null
        );

    }

    @Transactional
    public void updateDispatchStatus(
            String zohoItemId,
            ItemDispatchStatus newStatus,
            String username
    ) {

        DispatchedItem item = dispatchedRepo.findById(zohoItemId)
                .orElseThrow(() -> new IllegalStateException("Item not found"));

        ItemDispatchStatus current = item.getStatus();
        System.out.println("➡ REQUEST: " + zohoItemId + " | " + current + " → " + newStatus);
        System.out.println("🔥 STATUS CHANGE: " + current + " → " + newStatus);

        // ❌ BLOCK MANUAL DISPATCH
        if (newStatus == ItemDispatchStatus.DISPATCHED) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "DISPATCHED can only be set via Chalaan generation"
            );
        }

        // ❌ NO SAME STATUS UPDATE
        if (current == newStatus) {
            return;
        }

        String role = "SYSTEM";
        String action = null;


        // =====================================================
        // ✅ READY → READY_TO_STORE
        // =====================================================
       if (current == ItemDispatchStatus.READY
                && newStatus == ItemDispatchStatus.READY_TO_STORE) {

            item.setStatus(newStatus);
            action = "READY → READY_TO_STORE";
            role = "DISPATCH";
        }

     // ✅ READY → READY_TO_DISPATCH 
        else if (current == ItemDispatchStatus.READY
                && newStatus == ItemDispatchStatus.READY_TO_DISPATCH) {

            item.setStatus(newStatus);
            action = "READY → READY_TO_DISPATCH";
            role = "DISPATCH";
        }
        // =====================================================
        // ✅ READY_TO_STORE → WAREHOUSE_REQUESTED
        // =====================================================
        else if (current == ItemDispatchStatus.READY_TO_STORE
                && newStatus == ItemDispatchStatus.WAREHOUSE_REQUESTED) {

            item.setStatus(newStatus);
            action = "WAREHOUSE REQUESTED";
            role = "DISPATCH";
        }
    // =====================================================
    // ✅ IN_WAREHOUSE → READY_TO_DISPATCH
    // =====================================================
    else if (current == ItemDispatchStatus.IN_WAREHOUSE
            && newStatus == ItemDispatchStatus.READY_TO_DISPATCH) {

        item.setStatus(newStatus);
        action = "WAREHOUSE → READY_TO_DISPATCH";
        role = "DISPATCH";
    }
        
        // =====================================================
        // ❌ INVALID
        // =====================================================
        else {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Invalid transition: " + current + " → " + newStatus
            );
        }

        dispatchedRepo.save(item);

        // =====================================================
        // ✅ AUDIT LOG
        // =====================================================
        auditLogService.log(
                zohoItemId,
                action,
                username,
                role
        );

        // =====================================================
        // ✅ ACTIVITY LOG
        // =====================================================
        activityLogService.log(
                zohoItemId,
                action,
                username,
                role,
                current.name(),
                newStatus.name(),
                item.getGatePassNumber() // null safe
        );
    }
    
    public String moveToWarehouse(String zohoItemId, String warehouseCode, String fromLocation, String username) {

        DispatchedItem item = dispatchedRepo.findById(zohoItemId)
                .orElseThrow(() -> new IllegalStateException("Item not found"));

        if (item.getStatus() != ItemDispatchStatus.READY_TO_STORE) {
            throw new IllegalStateException("Only READY_TO_STORE items can be moved to warehouse");
        }
        String gatePass = warehouseCode + "-GP-" + UUID.randomUUID().toString().substring(0,8);
        item.setStatus(ItemDispatchStatus.WAREHOUSE_REQUESTED);
        item.setFromLocation(fromLocation);
        item.setCreatedBy(
        	    username != null && !username.isBlank()
        	        ? username
        	        : "SYSTEM"
        	);
        item.setWarehouseCode(warehouseCode);
        item.setGatePassNumber(gatePass);
        item.setStoredAt(null);

        dispatchedRepo.save(item);

        auditLogService.log(
        	    zohoItemId,
        	    "Warehouse move requested | GP: " + gatePass,
        	    username,
        	    "PACKING"
        	);

        activityLogService.log(
        	    zohoItemId,
        	    "WAREHOUSE REQUESTED",
        	    username,
        	    "DISPATCH",
        	    "READY_TO_STORE",
        	    "WAREHOUSE_REQUESTED",
        	    gatePass
        	);
        return gatePass;
    }
    
    public String bulkMoveToWarehouse(
            List<String> itemIds,
            String warehouseCode,
            String fromLocation,
            String username
    ) {

    	String gatePass = generateGatePass(
    	        warehouseCode,
    	        System.currentTimeMillis()
    	);

        List<DispatchedItem> items = dispatchedRepo.findAllById(itemIds);
        if (items.isEmpty()) {
            throw new RuntimeException("No items selected");
        }

        for (DispatchedItem item : items) {

            if (item.getStatus() != ItemDispatchStatus.READY_TO_STORE) {
                throw new RuntimeException("Invalid item state: " + item.getZohoItemId());
            }

            // Optional: ensure same warehouse input consistency (not required)
            if (warehouseCode == null || warehouseCode.isBlank()) {
                throw new RuntimeException("Warehouse code required");
            }
        }

        for (DispatchedItem item : items) {

            if (item.getStatus() != ItemDispatchStatus.READY_TO_STORE) {
                throw new RuntimeException("Invalid item state: " + item.getZohoItemId());
            }

            item.setStatus(ItemDispatchStatus.WAREHOUSE_REQUESTED);
            item.setWarehouseCode(warehouseCode);
            item.setGatePassNumber(gatePass);
            item.setFromLocation(fromLocation);
            item.setCreatedBy(
            	    username != null && !username.isBlank()
            	        ? username
            	        : "SYSTEM"
            	);
            item.setStoredAt(null);
        }

        dispatchedRepo.saveAll(items);
        
        for (DispatchedItem item : items) {
            auditLogService.log(
                item.getZohoItemId(),
                "Warehouse move requested (bulk) | GP: " + gatePass,
                username,
                "DISPATCH"
            );

            activityLogService.log(
                item.getZohoItemId(),
                "WAREHOUSE REQUESTED (BULK)",
                username,
                "DISPATCH",
                "READY_TO_STORE",
                "WAREHOUSE_REQUESTED",
                gatePass
            );
        }

        return gatePass;
    }
    
    public void approveWarehouseMove(String zohoItemId,String enteredGatePass, String username) {

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
        	    "DISPATCH"
        	);

        activityLogService.log(
        	    zohoItemId,
        	    "WAREHOUSE APPROVED",
        	    username,
        	    "DISPATCH",
        	    "WAREHOUSE_REQUESTED",
        	    "IN_WAREHOUSE",
        	    enteredGatePass
        	    );
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
                "DISPATCH"
        );

        
        activityLogService.log(
                zohoItemId,
                "WAREHOUSE REJECTED",
                username,
                "DISPATCH",
                "WAREHOUSE_REQUESTED",
                "READY_TO_STORE",
                null
        );
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
                null
        );	
    }
    
    public void createFromPacketItem(PacketItem item) {

    	String id = item.getId().toString(); // 🔥 LINK TO ORIGINAL

    	// 🔥 ADD THIS// ✅ FIX


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
        d.setZohoItemId(id);                 // primary key
        d.setName(item.getItemName());
        d.setPacketItemId(item.getId());
        d.setPacketId(item.getPacket().getId()); // 🔥 ADD THIS
        d.setSku(item.getSku());             // 🔥 ADD THIS
        d.setLocation(item.getLocation());   // 🔥 ADD THIS
        d.setFloor(item.getFloor());         // 🔥 ADD THIS
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
            "DISPATCH"
        );

        activityLogService.log(
            zohoItemId,
            "WAREHOUSE RETURN REQUESTED",
            username,
            "DISPATCH",
            "IN_WAREHOUSE",
            "WAREHOUSE_RETURN_REQUESTED",
            null
        );
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
            "ADMIN"
        );

        activityLogService.log(
            zohoItemId,
            "RETURN APPROVED",
            admin,
            "ADMIN",
            "WAREHOUSE_RETURN_REQUESTED",
            "READY",
            null
        );
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
            "ADMIN"
        );

        activityLogService.log(
            zohoItemId,
            "RETURN REJECTED",
            admin,
            "ADMIN",
            "WAREHOUSE_RETURN_REQUESTED",
            "IN_WAREHOUSE",
            null
        );
    }
    private String generateGatePass(String warehouseCode, long sequence) {
        return warehouseCode + "-GN-" + String.format("%06d", sequence);
    }
    
    public void bulkUpdateStatus(List<String> ids, ItemDispatchStatus status, String username) {

        List<DispatchedItem> items = dispatchedRepo.findAllById(ids);

        for (DispatchedItem item : items) {
            updateDispatchStatus(item.getZohoItemId(), status, username);
        }
    }
}
