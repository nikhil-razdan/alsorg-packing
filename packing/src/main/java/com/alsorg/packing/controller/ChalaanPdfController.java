package com.alsorg.packing.controller;

import com.alsorg.packing.service.pdf.*;
import com.alsorg.packing.service.pdf.mapper.ChalaanMapper;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.item.PacketItem;
import com.alsorg.packing.integration.zoho.dto.ZohoItemDTO;
import com.alsorg.packing.integration.zoho.ZohoInventoryClient;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.repository.PacketItemRepository;
import com.alsorg.packing.security.JwtUtil;
import com.alsorg.packing.service.DispatchedItemService;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.ArrayList;

@RestController
@RequestMapping("/api/chalaan")
public class ChalaanPdfController {

    private final ChalaanPdfService pdfService;
    private final DispatchedItemRepository repo;
    private final DispatchedItemService dispatchedService;
    private final PacketItemRepository packetItemRepo;

    public ChalaanPdfController(
            ChalaanPdfService pdfService,
            DispatchedItemRepository repo,
            DispatchedItemService dispatchedService,
            PacketItemRepository packetItemRepo
    ) {
        this.pdfService = pdfService;
        this.repo = repo;
        this.dispatchedService = dispatchedService;
        this.packetItemRepo = packetItemRepo;
    }

    /* ================= SINGLE CHALAAN ================= */

    @Transactional
    @GetMapping("/{zohoItemId}/download")
    public ResponseEntity<byte[]> generate(@PathVariable String zohoItemId, 
    		@RequestParam(defaultValue = "false") boolean preview,
    		@RequestHeader("Authorization") String auth
    		) {

    	try {
    		String token = extractToken(auth);
    		DispatchedItem item = repo.findById(zohoItemId)
    		        .orElseThrow(() -> new RuntimeException("Item not found"));

    		PacketItem packetItem = null;

    		if (item.getPacketItemId() != null) {
    		    packetItem = packetItemRepo.findById(item.getPacketItemId()).orElse(null);
    		}

        if (item.getStatus() != ItemDispatchStatus.READY_TO_DISPATCH) {
            throw new IllegalStateException(
                "Item must be READY_TO_DISPATCH before generating chalaan"
            );
        }
        System.out.println("🔥 CHALAAN REQUEST: " + zohoItemId);
        System.out.println("STATUS: " + item.getStatus());

        /* ================= FETCH FROM ZOHO ================= */
        System.out.println("=== CHALAAN DEBUG START ===");
        System.out.println("ID: " + zohoItemId);
        ChalaanPdfData data = new ChalaanPdfData();

        ChalaanItem ci = new ChalaanItem();
        ci.setItemName(
        	    packetItem != null ? packetItem.getItemName() : item.getName()
        	);

        	ci.setPdNo(
        	    packetItem != null ? packetItem.getPdNo() : item.getPdNo()
        	);

        	ci.setClientName(
        	    packetItem != null ? packetItem.getClientName() : item.getClientName()
        	);

        	ci.setDescription(
        	    packetItem != null ? packetItem.getDescription() : item.getDescription()
        	);
        	
        	ci.setClientAddress(
        	        packetItem != null ? packetItem.getClientAddress() : item.getClientAddress()
        	);

        	ci.setDrawingNo(
        	    packetItem != null ? packetItem.getDrawingNo() : item.getDrawingNo()
        	);

        	ci.setRemarks(
        	    packetItem != null ? packetItem.getRemarks() : item.getRemarks()
        	);
        ci.setZohoItemId(item.getZohoItemId());

        String chalaan = "CH-" + System.currentTimeMillis();

        data.setVoucherNo(chalaan);
        data.setDesignerName("-");
        data.setOt("-");

        data.setItems(List.of(ci));
        data.setAddress(
                packetItem != null && packetItem.getClientAddress() != null
                        ? packetItem.getClientAddress()
                        : item.getClientAddress()
        );

        byte[] pdf = pdfService.generateChalaan(data);

        /* ================= SAVE CHALAAN ================= */

        item.setChalaanNumber(chalaan);
        repo.save(item);

        /* ================= FINAL DISPATCH ================= */

        dispatchedService.markDispatchedFromChalaan(
            zohoItemId,
            JwtUtil.getUsername(token)
        );

        return ResponseEntity.ok()
        	    .header(
        	        "Content-Disposition",
        	        preview
        	            ? "inline; filename=chalaan.pdf"
        	            : "attachment; filename=chalaan.pdf"
        	    )
        	    .contentType(org.springframework.http.MediaType.APPLICATION_PDF)
        	    .body(pdf);
    	} catch (Exception e) {
    	    System.err.println("❌ CHALAAN ERROR:");
    	    e.printStackTrace(); 
    	    throw new RuntimeException("Chalaan failed: " + e.getMessage());
    	}
    	
    }

    /* ================= BULK CHALAAN ================= */

    @PostMapping("/bulk")
    public ResponseEntity<byte[]> generateBulk(@RequestBody List<String> ids,
    		@RequestParam(defaultValue = "false") boolean preview,
    		@RequestHeader("Authorization") String auth) {

        List<DispatchedItem> items = repo.findAllById(ids);
        String token = extractToken(auth);
        if (!"DISPATCH".equals(JwtUtil.getRole(token))) {
            return ResponseEntity.status(403).build();
        }
        if (items.size() != ids.size()) {
            throw new RuntimeException("Some items not found");
        }

        items.forEach(i -> {
            if (i.getStatus() != ItemDispatchStatus.READY_TO_DISPATCH) {
                throw new RuntimeException(
                    "Item must be READY_TO_DISPATCH: " + i.getZohoItemId()
                );
            }
        });

   

        ChalaanPdfData data = new ChalaanPdfData();

        List<ChalaanItem> list = new ArrayList<>();

        for (DispatchedItem i : items) {
            ChalaanItem ci = new ChalaanItem();
            ci.setItemName(i.getName());
            ci.setDescription(i.getDescription());
            ci.setDrawingNo(i.getDrawingNo());
            ci.setRemarks(i.getRemarks());
            ci.setPdNo(i.getPdNo());
            ci.setClientName(i.getClientName());
            ci.setClientAddress(i.getClientAddress());
            ci.setZohoItemId(i.getZohoItemId());
            list.add(ci);
        }

        String chalaan = "CH-" + System.currentTimeMillis();

        data.setVoucherNo(chalaan);
        data.setDesignerName("-");
        data.setOt("-");

        data.setItems(list);
        data.setAddress(items.get(0).getClientAddress());

        /* ================= GENERATE PDF ================= */

        byte[] pdf = pdfService.generateChalaan(data);

        /* ================= SAVE CHALAAN ================= */

        items.forEach(i -> i.setChalaanNumber(chalaan));
        repo.saveAll(items);

        /* ================= FINAL DISPATCH ================= */

        items.forEach(i -> dispatchedService.markDispatchedFromChalaan(
                i.getZohoItemId(),
                JwtUtil.getUsername(token)
        ));

        return ResponseEntity.ok()
                .header(
                        "Content-Disposition",
                        preview
                                ? "inline; filename=chalaan.pdf"
                                : "attachment; filename=chalaan.pdf"
                )
                .contentType(org.springframework.http.MediaType.APPLICATION_PDF)
                .body(pdf);
    }
    
    private String extractToken(String auth) {
        if (auth == null || !auth.startsWith("Bearer ")) {
            throw new RuntimeException("Missing or invalid Authorization header");
        }
        return auth.replace("Bearer ", "");
    }
}