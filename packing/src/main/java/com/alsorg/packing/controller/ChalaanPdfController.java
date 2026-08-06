package com.alsorg.packing.controller;

import com.alsorg.packing.controller.dto.logistics.DispatchTripPdfResult;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.item.PacketItem;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.repository.PacketItemRepository;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.DispatchChallanService;
import com.alsorg.packing.service.pdf.ChalaanItem;
import com.alsorg.packing.service.pdf.ChalaanPdfData;
import com.alsorg.packing.service.pdf.ChalaanPdfService;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.alsorg.packing.controller.dto.challan.CustomChallanRequest;
import com.alsorg.packing.controller.dto.challan.CustomChallanSummaryResponse;
import com.alsorg.packing.service.CustomChallanService;

@RestController
@RequestMapping("/api/chalaan")
public class ChalaanPdfController {

        private final DispatchChallanService dispatchChallanService;
        private final ChalaanPdfService pdfService;
        private final CurrentUserService currentUserService;
        private final DispatchedItemRepository dispatchedItemRepository;
        private final PacketItemRepository packetItemRepository;
        private final CustomChallanService customChallanService;

        public ChalaanPdfController(
                        DispatchChallanService dispatchChallanService,
                        ChalaanPdfService pdfService,
                        DispatchedItemRepository dispatchedItemRepository,
                        PacketItemRepository packetItemRepository,
                        CurrentUserService currentUserService,
                        CustomChallanService customChallanService) {
                this.dispatchChallanService = dispatchChallanService;
                this.pdfService = pdfService;
                this.dispatchedItemRepository = dispatchedItemRepository;
                this.packetItemRepository = packetItemRepository;
                this.currentUserService = currentUserService;
                this.customChallanService = customChallanService;
        }

        @Transactional
        @PostMapping(value = "/dispatch", produces = MediaType.APPLICATION_PDF_VALUE)
        public ResponseEntity<byte[]> generateDispatchChallan(
                        @RequestBody ChallanDispatchRequest request,
                        @RequestParam(defaultValue = "true") boolean preview,
                        @RequestHeader(value = "Authorization", required = false) String auth) {
                User user = currentUserService.getCurrentUserFromAuth(auth);

                if (!canUseDispatchChallan(user)) {
    return ResponseEntity
            .status(403)
            .build();
}
                DispatchTripPdfResult result = dispatchChallanService.generateAndDispatch(
                                request.itemIds(),
                                request.driverId(),
                                request.vehicleId(),
                                firstNonNull(
                                                request.dispatchTime(),
                                                request.tripStart()),
                                request.helperLoaderCount(),
                                user.getUsername(),
                                currentUserService.allowedPlants(user));

                return buildPdfResponse(result, preview);
        }

        @PostMapping(value = "/dispatch/preview", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_PDF_VALUE)
        public ResponseEntity<byte[]> previewDispatchChallan(
                        @RequestBody ChallanDispatchRequest request,
                        @RequestHeader(value = "Authorization", required = false) String auth) {

                User user = currentUserService.getCurrentUserFromAuth(
                                auth);

                /*
                 * Keep the same permission rule as final challan creation.
                 */
                if (!canUseDispatchChallan(user)) {
    return ResponseEntity
            .status(403)
            .build();
}

                DispatchTripPdfResult result = dispatchChallanService.previewDispatchChallan(
                                request.itemIds(),
                                request.driverId(),
                                request.vehicleId(),
                                firstNonNull(
                                                request.dispatchTime(),
                                                request.tripStart()),
                                request.helperLoaderCount(),
                                user.getUsername(),
                                currentUserService.allowedPlants(
                                                user));

                return buildPreviewPdfResponse(
                                result);
        }

        @Transactional
        @PostMapping(value = "/custom", produces = MediaType.APPLICATION_PDF_VALUE)
        public ResponseEntity<byte[]> generateCustomChallan(
                        @RequestBody CustomChallanRequest request,
                        @RequestParam(defaultValue = "true") boolean preview,
                        @RequestHeader(value = "Authorization", required = false) String auth) {
                User user = currentUserService.getCurrentUserFromAuth(auth);

                if (!canUseDispatchChallan(user)) {
    return ResponseEntity
            .status(403)
            .build();
}

                DispatchTripPdfResult result = customChallanService.generateAndSave(
                                request,
                                user.getUsername());

                return buildPdfResponse(result, preview);
        }

        @Transactional
        @GetMapping(value = "/{zohoItemId}/download", produces = MediaType.APPLICATION_PDF_VALUE)
        public ResponseEntity<byte[]> generateSingle(
                        @PathVariable String zohoItemId,
                        @RequestParam(required = false) UUID driverId,
                        @RequestParam(required = false) UUID vehicleId,
                        @RequestParam(defaultValue = "false") boolean preview,
                        @RequestHeader(value = "Authorization", required = false) String auth) {
                User user = currentUserService.getCurrentUserFromAuth(auth);

                if (!canUseDispatchChallan(user)) {
    return ResponseEntity
            .status(403)
            .build();
}

                DispatchTripPdfResult result = dispatchChallanService.generateAndDispatch(
                                List.of(zohoItemId),
                                driverId,
                                vehicleId,
                                null,
                                user.getUsername(),
                                currentUserService.allowedPlants(user));

                return buildPdfResponse(result, preview);
        }

        @Transactional
        @PostMapping(value = "/bulk", produces = MediaType.APPLICATION_PDF_VALUE)
        public ResponseEntity<byte[]> generateBulk(
                        @RequestBody List<String> ids,
                        @RequestParam(required = false) UUID driverId,
                        @RequestParam(required = false) UUID vehicleId,
                        @RequestParam(defaultValue = "false") boolean preview,
                        @RequestHeader(value = "Authorization", required = false) String auth) {
                User user = currentUserService.getCurrentUserFromAuth(auth);

                if (!canUseDispatchChallan(user)) {
    return ResponseEntity
            .status(403)
            .build();
}

                DispatchTripPdfResult result = dispatchChallanService.generateAndDispatch(
                                ids,
                                driverId,
                                vehicleId,
                                null,
                                user.getUsername(),
                                currentUserService.allowedPlants(user));

                return buildPdfResponse(result, preview);
        }

        @GetMapping(value = "/dispatched/{challanNumber:.+}/download", produces = MediaType.APPLICATION_PDF_VALUE)
        public ResponseEntity<byte[]> downloadExistingDispatchedChallan(
                        @PathVariable String challanNumber,
                        @RequestParam(defaultValue = "false") boolean preview,
                        @RequestHeader(value = "Authorization", required = false) String auth) {
                User user = currentUserService.getCurrentUserFromAuth(auth);

                List<ItemDispatchStatus> statuses = List.of(
                                ItemDispatchStatus.DISPATCHED);

                List<DispatchedItem> sourceItems;

                if (currentUserService.isAdmin(user)) {
                        sourceItems = dispatchedItemRepository.findByStatusIn(statuses);
                } else {
                        sourceItems = dispatchedItemRepository.findVisibleByStatusesAndPlantsIncludingLegacy(
                                        statuses,
                                        currentUserService.allowedPlants(user));
                }

                String currentUsername = cleanLower(user.getUsername());

                List<DispatchedItem> items = sourceItems
                                .stream()
                                .filter(item -> item.getChalaanNumber() != null
                                                && item.getChalaanNumber().equals(challanNumber))
                                .filter(item -> {
                                        if (currentUserService.isAdmin(user)) {
                                                return true;
                                        }

                                        return cleanLower(item.getDispatchedBy())
                                                        .equals(currentUsername);
                                })
                                .toList();

                if (items.isEmpty()) {
                        throw new RuntimeException(
                                        "No dispatched items found for challan: " + challanNumber);
                }

                DispatchedItem first = items.get(0);

                ChalaanPdfData data = new ChalaanPdfData();

                LocalDateTime challanDateTime = items
                                .stream()
                                .map(DispatchedItem::getDispatchedAt)
                                .filter(date -> date != null)
                                .min(LocalDateTime::compareTo)
                                .orElse(null);

                data.setVoucherNo(challanNumber);
                data.setDispatchTime(challanDateTime);
                data.setDesignerName("-");
                data.setOt("-");
                data.setDriverName(first.getDriverName());
                data.setVehicleNumber(first.getVehicleNumber());
                data.setHelperLoaderCount(
                                first.getHelperLoaderCount());

                /*
                 * Existing challan is a valid generated challan.
                 * The preview query parameter controls inline/attachment,
                 * not draft watermark behaviour.
                 */
                data.setPreview(false);

                List<ChalaanItem> challanItems = new ArrayList<>();

                for (DispatchedItem item : items) {
                        PacketItem packetItem = null;

                        if (item.getPacketItemId() != null) {
                                packetItem = packetItemRepository
                                                .findById(item.getPacketItemId())
                                                .orElse(null);
                        }

                        challanItems.add(
                                        buildExistingChallanItem(
                                                        item,
                                                        packetItem));
                }

                data.setItems(challanItems);
                data.setAddress(firstNonBlank(first.getClientAddress()));

                byte[] pdf = pdfService.generateChalaan(data);

                String filename = challanNumber
                                .replaceAll("[^a-zA-Z0-9._-]", "_")
                                + ".pdf";

                return ResponseEntity.ok()
                                .header(
                                                HttpHeaders.CONTENT_DISPOSITION,
                                                preview
                                                                ? "inline; filename=" + filename
                                                                : "attachment; filename=" + filename)
                                .contentType(MediaType.APPLICATION_PDF)
                                .body(pdf);
        }

        private boolean canUseDispatchChallan(
                        User user) {

                return currentUserService
                                .hasAnyRole(
                                                user,
                                                "ADMIN",
                                                "DISPATCH");
        }

        private ResponseEntity<byte[]> buildPdfResponse(
                        DispatchTripPdfResult result,
                        boolean preview) {
                String challanNo = result.getChallanNumber() == null || result.getChallanNumber().isBlank()
                                ? "challan"
                                : result.getChallanNumber();

                String filename = challanNo.replaceAll("[^a-zA-Z0-9._-]", "_") + ".pdf";

                return ResponseEntity.ok()
                                .header(
                                                HttpHeaders.CONTENT_DISPOSITION,
                                                preview
                                                                ? "inline; filename=" + filename
                                                                : "attachment; filename=" + filename)
                                .header(
                                                "X-Challan-No",
                                                challanNo)
                                .header(
                                                "Access-Control-Expose-Headers",
                                                "X-Challan-No, Content-Disposition")
                                .contentType(MediaType.APPLICATION_PDF)
                                .body(result.getPdfBytes());
        }

        private ResponseEntity<byte[]> buildPreviewPdfResponse(
                        DispatchTripPdfResult result) {

                byte[] pdfBytes = result == null
                                ? null
                                : result.getPdfBytes();

                if (pdfBytes == null || pdfBytes.length == 0) {
                        throw new RuntimeException(
                                        "Preview PDF could not be generated");
                }

                return ResponseEntity
                                .ok()
                                .header(
                                                HttpHeaders.CONTENT_DISPOSITION,
                                                "inline; filename=\"CHALLAN_PREVIEW.pdf\"")
                                .header(
                                                HttpHeaders.CACHE_CONTROL,
                                                "no-store, no-cache, must-revalidate")
                                .header(
                                                "Pragma",
                                                "no-cache")
                                .header(
                                                "Expires",
                                                "0")
                                .header(
                                                "X-Challan-Preview",
                                                "true")
                                .header(
                                                "X-Challan-No",
                                                "PREVIEW")
                                .header(
                                                "Access-Control-Expose-Headers",
                                                "X-Challan-No, X-Challan-Preview, Content-Disposition")
                                .contentType(
                                                MediaType.APPLICATION_PDF)
                                .body(
                                                pdfBytes);
        }

        @GetMapping("/custom")
        public ResponseEntity<List<CustomChallanSummaryResponse>> getCustomChallans(
                        @RequestHeader(value = "Authorization", required = false) String auth) {
                User user = currentUserService.getCurrentUserFromAuth(auth);

                if (!canUseDispatchChallan(user)) {
    return ResponseEntity
            .status(403)
            .build();
}

                return ResponseEntity.ok(
                                customChallanService.listForUser(
                                                user.getUsername(),
                                                currentUserService.isAdmin(user)));
        }

        @GetMapping(value = "/custom/{challanNumber:.+}/download", produces = MediaType.APPLICATION_PDF_VALUE)
        public ResponseEntity<byte[]> downloadCustomChallan(
                        @PathVariable String challanNumber,
                        @RequestParam(defaultValue = "true") boolean preview,
                        @RequestHeader(value = "Authorization", required = false) String auth) {
                User user = currentUserService.getCurrentUserFromAuth(auth);

                if (!currentUserService.isDispatch(user)
                                && !currentUserService.isAdmin(user)) {
                        return ResponseEntity.status(403).build();
                }

                DispatchTripPdfResult result = customChallanService.downloadForUser(
                                challanNumber,
                                user.getUsername(),
                                currentUserService.isAdmin(user));

                return buildPdfResponse(result, preview);
        }

        private ChalaanItem buildExistingChallanItem(
                        DispatchedItem dispatchedItem,
                        PacketItem packetItem) {
                ChalaanItem ci = new ChalaanItem();

                ci.setZohoItemId(dispatchedItem.getZohoItemId());

                ci.setItemName(
                                packetItem != null && packetItem.getItemName() != null
                                                ? packetItem.getItemName()
                                                : dispatchedItem.getName());

                ci.setPdNo(
                                packetItem != null && packetItem.getPdNo() != null
                                                ? packetItem.getPdNo()
                                                : dispatchedItem.getPdNo());

                ci.setClientName(
                                packetItem != null && packetItem.getClientName() != null
                                                ? packetItem.getClientName()
                                                : dispatchedItem.getClientName());

                ci.setClientAddress(
                                packetItem != null && packetItem.getClientAddress() != null
                                                ? packetItem.getClientAddress()
                                                : dispatchedItem.getClientAddress());

                ci.setDrawingNo(
                                packetItem != null && packetItem.getDrawingNo() != null
                                                ? packetItem.getDrawingNo()
                                                : dispatchedItem.getDrawingNo());

                ci.setDescription(
                                packetItem != null && packetItem.getDescription() != null
                                                ? packetItem.getDescription()
                                                : dispatchedItem.getDescription());

                ci.setRemarks(
                                packetItem != null && packetItem.getRemarks() != null
                                                ? packetItem.getRemarks()
                                                : dispatchedItem.getRemarks());

                ci.setQty(
                                dispatchedItem.getQuantity() != null
                                                ? String.valueOf(dispatchedItem.getQuantity())
                                                : "1");

                return ci;
        }

        private String firstNonBlank(
                        String value) {
                if (value == null || value.trim().isBlank()) {
                        return "-";
                }

                return value.trim();
        }

        private LocalDateTime firstNonNull(
                        LocalDateTime first,
                        LocalDateTime second) {
                return first != null
                                ? first
                                : second;
        }

        public record ChallanDispatchRequest(
                        List<String> itemIds,
                        UUID driverId,
                        UUID vehicleId,
                        Integer helperLoaderCount,
                        /*
                         * Kept only so old frontend/mobile payload does not break.
                         * Not used for trip/delivery anymore.
                         */
                        LocalDateTime tripStart,
                        LocalDateTime dispatchTime) {
        }

        private String cleanLower(String value) {
                if (value == null) {
                        return "";
                }

                return value.trim().toLowerCase();
        }
}