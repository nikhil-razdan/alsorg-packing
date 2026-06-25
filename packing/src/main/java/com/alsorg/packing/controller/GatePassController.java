package com.alsorg.packing.controller;

import java.util.List;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.service.pdf.GatePassPdfService;

@RestController
@RequestMapping("/api/gatepass")
public class GatePassController {

    private final DispatchedItemRepository repo;
    private final GatePassPdfService pdfService;

    public GatePassController(
            DispatchedItemRepository repo,
            GatePassPdfService pdfService) {
        this.repo = repo;
        this.pdfService = pdfService;
    }

    @GetMapping("/{zohoItemId}/pdf")
    public ResponseEntity<byte[]> downloadGatePass(
            @PathVariable String zohoItemId) throws Exception {

        DispatchedItem item = repo.findById(zohoItemId)
                .orElseThrow(() -> new IllegalStateException("Item not found"));

        if (item.getGatePassNumber() == null) {
            throw new IllegalStateException("Gate pass not generated yet");
        }
        System.out.println("📄 GatePass PDF DEBUG:");
        System.out.println("ID: " + zohoItemId);
        System.out.println("GatePass: " + item.getGatePassNumber());
        System.out.println("Item: " + item.getName());
        System.out.println("Warehouse: " + item.getWarehouseCode());
        System.out.println("From: " + item.getFromLocation());
        System.out.println("CreatedBy: " + item.getCreatedBy());

        byte[] pdf = pdfService.generateGatePass(item);
        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=" + item.getGatePassNumber() + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @GetMapping("/bulk/{gatePass}/pdf")
    public ResponseEntity<byte[]> bulkGatePassPdf(@PathVariable String gatePass) throws Exception {

        List<DispatchedItem> items = repo.findByGatePassNumber(gatePass);

        if (items.isEmpty()) {
            throw new RuntimeException("No items found for gate pass");
        }

        byte[] pdf = pdfService.generateBulkGatePass(items);

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=" + gatePass + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
}