package com.alsorg.packing.controller;

import java.util.List;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.pdf.GatePassPdfService;

@RestController
@RequestMapping("/api/gatepass")
public class GatePassController {

    private final DispatchedItemRepository repo;
    private final GatePassPdfService pdfService;
    private final CurrentUserService currentUserService;

    public GatePassController(
            DispatchedItemRepository repo,
            GatePassPdfService pdfService,
            CurrentUserService currentUserService) {

        this.repo = repo;
        this.pdfService = pdfService;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/{zohoItemId}/pdf")
    public ResponseEntity<byte[]> downloadGatePass(
            @PathVariable String zohoItemId,
            @RequestHeader(value = "Authorization", required = false) String auth) throws Exception {

        User user =
                currentUserService.getCurrentUserFromAuth(auth);

        assertGatePassViewAccess(user);

        DispatchedItem item =
                repo.findById(zohoItemId)
                        .orElseThrow(() -> new IllegalStateException("Item not found"));

        assertPlantVisibility(user, item);

        if (item.getGatePassNumber() == null ||
                item.getGatePassNumber().trim().isBlank()) {
            throw new IllegalStateException("Gate pass not generated yet");
        }

        List<DispatchedItem> gatePassItems =
                repo.findByGatePassNumber(item.getGatePassNumber());

        if (gatePassItems == null || gatePassItems.isEmpty()) {
            gatePassItems = List.of(item);
        }

        if (!currentUserService.canViewAllWarehouseData(user)) {
            gatePassItems =
                    gatePassItems.stream()
                            .filter(gpItem -> isVisiblePlant(user, gpItem))
                            .toList();
        }

        if (gatePassItems.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Gate pass not visible for this user");
        }

        byte[] pdf =
                pdfService.generateBulkGatePass(gatePassItems);

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=" + item.getGatePassNumber() + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @GetMapping("/bulk/{gatePass}/pdf")
    public ResponseEntity<byte[]> bulkGatePassPdf(
            @PathVariable String gatePass,
            @RequestHeader(value = "Authorization", required = false) String auth) throws Exception {

        User user =
                currentUserService.getCurrentUserFromAuth(auth);

        assertGatePassViewAccess(user);

        List<DispatchedItem> items =
                repo.findByGatePassNumber(gatePass);

        if (items.isEmpty()) {
            throw new RuntimeException("No items found for gate pass");
        }

        if (!currentUserService.canViewAllWarehouseData(user)) {
            items =
                    items.stream()
                            .filter(item -> isVisiblePlant(user, item))
                            .toList();
        }

        if (items.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Gate pass not visible for this user");
        }

        byte[] pdf =
                pdfService.generateBulkGatePass(items);

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=" + gatePass + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    private void assertGatePassViewAccess(User user) {
        if (!currentUserService.canAccessWarehouse(user)
                && !currentUserService.isDispatch(user)
                && !currentUserService.isAdmin(user)) {

            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Gate pass access not allowed");
        }
    }

    private void assertPlantVisibility(
            User user,
            DispatchedItem item) {

        if (currentUserService.canViewAllWarehouseData(user)) {
            return;
        }

        if (!isVisiblePlant(user, item)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Item not visible for this user");
        }
    }

    private boolean isVisiblePlant(
            User user,
            DispatchedItem item) {

        if (item.getPlantCode() == null || item.getPlantCode().isBlank()) {
            return true;
        }

        return currentUserService
                .allowedPlants(user)
                .contains(item.getPlantCode());
    }
}