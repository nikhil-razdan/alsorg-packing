package com.alsorg.packing.controller;

import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.pdf.GatePassPdfService;

@RestController
@RequestMapping("/api/gatepass")
public class GatePassController {

    private static final int MAX_IDENTIFIER_LENGTH = 220;
    private static final int MAX_GATE_PASS_ITEMS = 2000;

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
            @PathVariable String zohoItemId) throws Exception {

        User user = currentUserService.requireCurrentUser();
        assertGatePassViewAccess(user);

        String cleanItemId = requireIdentifier(zohoItemId, "Item id");

        DispatchedItem item = repo.findById(cleanItemId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Item not found"));

        assertPlantVisibility(user, item);

        String gatePassNumber = requireIdentifier(
                item.getGatePassNumber(),
                "Gate pass number");

        List<DispatchedItem> gatePassItems = repo.findByGatePassNumber(gatePassNumber);

        if (gatePassItems == null || gatePassItems.isEmpty()) {
            gatePassItems = List.of(item);
        }

        gatePassItems = filterVisibleItems(user, gatePassItems);
        validateGatePassItems(gatePassItems);

        byte[] pdf = pdfService.generateBulkGatePass(gatePassItems);
        return pdfResponse(pdf, gatePassNumber);
    }

    @GetMapping("/bulk/{gatePass}/pdf")
    public ResponseEntity<byte[]> bulkGatePassPdf(
            @PathVariable String gatePass) throws Exception {

        User user = currentUserService.requireCurrentUser();
        assertGatePassViewAccess(user);

        String cleanGatePass = requireIdentifier(gatePass, "Gate pass number");
        List<DispatchedItem> items = repo.findByGatePassNumber(cleanGatePass);

        if (items == null || items.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "No items found for gate pass");
        }

        items = filterVisibleItems(user, items);
        validateGatePassItems(items);

        byte[] pdf = pdfService.generateBulkGatePass(items);
        return pdfResponse(pdf, cleanGatePass);
    }

    private List<DispatchedItem> filterVisibleItems(
            User user,
            List<DispatchedItem> items) {

        if (currentUserService.canViewAllWarehouseData(user)) {
            return items;
        }

        return items.stream()
                .filter(item -> isVisiblePlant(user, item))
                .toList();
    }

    private void validateGatePassItems(
            List<DispatchedItem> items) {
        if (items == null || items.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Gate pass not visible for this user");
        }

        if (items.size() > MAX_GATE_PASS_ITEMS) {
            throw new ResponseStatusException(
                    HttpStatus.PAYLOAD_TOO_LARGE,
                    "Gate pass contains too many items to render safely");
        }
    }

    private ResponseEntity<byte[]> pdfResponse(
            byte[] pdf,
            String gatePassNumber) {

        String safeFilename = gatePassNumber
                .replaceAll("[^a-zA-Z0-9._-]", "_");

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"" + safeFilename + ".pdf\"")
                .header(
                        HttpHeaders.CACHE_CONTROL,
                        "no-store, no-cache, must-revalidate, max-age=0")
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

        if (item == null) {
            return false;
        }

        String plantCode = item.getPlantCode();

        /*
         * Preserve legacy rows that pre-date plant tracking. New plant-tracked
         * rows remain strictly filtered.
         */
        if (plantCode == null || plantCode.isBlank()) {
            return true;
        }

        Set<String> allowed = currentUserService.allowedPlants(user);
        String target = plantCode.trim().toUpperCase(Locale.ROOT);

        return allowed.stream()
                .filter(value -> value != null)
                .map(value -> value.trim().toUpperCase(Locale.ROOT))
                .anyMatch(target::equals);
    }

    private String requireIdentifier(
            String value,
            String label) {
        if (value == null || value.trim().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    label + " is required");
        }

        String clean = value.trim();

        if (clean.length() > MAX_IDENTIFIER_LENGTH) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    label + " is too long");
        }

        return clean;
    }
}
