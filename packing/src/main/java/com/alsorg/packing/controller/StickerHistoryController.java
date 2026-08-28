package com.alsorg.packing.controller;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.controller.dto.GeneratedPacketHistoryResponse;
import com.alsorg.packing.controller.dto.StickerHistoryResponse;
import com.alsorg.packing.domain.item.PacketItem;
import com.alsorg.packing.domain.sticker.StickerHistory;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.StickerHistoryRepository;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.PacketService;
import com.alsorg.packing.service.StickerHistoryPdfRefreshService;

@RestController
@RequestMapping("/api/stickers")
public class StickerHistoryController {

    private static final int DEFAULT_GENERATED_HISTORY_PAGE_SIZE = 250;
    private static final int MAX_GENERATED_HISTORY_PAGE_SIZE = 500;

    private static final String HEADER_TOTAL_PAGES = "X-Total-Pages";
    private static final String HEADER_TOTAL_ELEMENTS = "X-Total-Elements";
    private static final String HEADER_PAGE_NUMBER = "X-Page-Number";
    private static final String HEADER_PAGE_SIZE = "X-Page-Size";
    private static final String HEADER_HAS_NEXT = "X-Has-Next";

    private final StickerHistoryRepository repository;
    private final CurrentUserService currentUserService;
    private final PacketService packetService;
    private final StickerHistoryPdfRefreshService stickerHistoryPdfRefreshService;

    public StickerHistoryController(
            StickerHistoryRepository repository,
            CurrentUserService currentUserService,
            PacketService packetService,
            StickerHistoryPdfRefreshService stickerHistoryPdfRefreshService
    ) {
        this.repository = repository;
        this.currentUserService = currentUserService;
        this.packetService = packetService;
        this.stickerHistoryPdfRefreshService = stickerHistoryPdfRefreshService;
    }

    /*
     * =====================================================
     * GENERATED HISTORY
     * =====================================================
     *
     * ADMIN:
     * - Can page through all generated sticker history.
     * - Optional generatedBy filter is preserved.
     *
     * OTHER USERS:
     * - Can page only through their own generated history.
     * - A forged generatedBy request parameter is ignored.
     *
     * IMPORTANT:
     * - Response BODY deliberately remains a JSON array for frontend/backward
     *   compatibility.
     * - Paging metadata is returned through headers already exposed by FlowSuite
     *   CORS configuration.
     * - The page size is server-clamped so this endpoint can never reintroduce
     *   the old full-table Hibernate materialization / Java-heap failure.
     */

    @Transactional(readOnly = true)
    @GetMapping("/generated-history")
    public ResponseEntity<List<GeneratedPacketHistoryResponse>> generatedHistory(
            @RequestParam(required = false) String generatedBy,
            @RequestParam(defaultValue = "0") Integer page,
            @RequestParam(defaultValue = "250") Integer size,
            @RequestHeader(
                    value = "Authorization",
                    required = false
            ) String auth
    ) {
        User user =
                currentUserService.getCurrentUserFromAuth(auth);

        Pageable pageable = PageRequest.of(
                safePage(page),
                safeGeneratedHistoryPageSize(size));

        Page<GeneratedPacketHistoryResponse> result;

        if (currentUserService.isAdmin(user)) {
            if (generatedBy != null
                    && !generatedBy.isBlank()
                    && !"ALL".equalsIgnoreCase(generatedBy)) {
                result = repository.findGeneratedPacketHistoryByUserPage(
                        generatedBy.trim(),
                        pageable);
            } else {
                result = repository.findGeneratedPacketHistoryAllPage(
                        pageable);
            }
        } else {
            result = repository.findGeneratedPacketHistoryByUserPage(
                    user.getUsername(),
                    pageable);
        }

        HttpHeaders headers = generatedHistoryHeaders(result);

        return ResponseEntity
                .ok()
                .headers(headers)
                .body(result.getContent());
    }

    private int safePage(Integer page) {
        if (page == null || page < 0) {
            return 0;
        }

        return page;
    }

    private int safeGeneratedHistoryPageSize(Integer size) {
        if (size == null || size < 1) {
            return DEFAULT_GENERATED_HISTORY_PAGE_SIZE;
        }

        return Math.min(
                size,
                MAX_GENERATED_HISTORY_PAGE_SIZE);
    }

    private HttpHeaders generatedHistoryHeaders(
            Page<GeneratedPacketHistoryResponse> result) {

        HttpHeaders headers = new HttpHeaders();

        headers.set(
                HEADER_TOTAL_ELEMENTS,
                Long.toString(result.getTotalElements()));

        headers.set(
                HEADER_TOTAL_PAGES,
                Integer.toString(result.getTotalPages()));

        headers.set(
                HEADER_PAGE_NUMBER,
                Integer.toString(result.getNumber()));

        headers.set(
                HEADER_PAGE_SIZE,
                Integer.toString(result.getSize()));

        headers.set(
                HEADER_HAS_NEXT,
                Boolean.toString(result.hasNext()));

        headers.setCacheControl(
                "no-store, no-cache, must-revalidate, max-age=0");
        headers.setPragma("no-cache");

        return headers;
    }

    /*
     * =====================================================
     * GENERATED-BY USER DROPDOWN
     * =====================================================
     */

    @GetMapping("/generated-history/users")
    public ResponseEntity<List<String>> generatedHistoryUsers(
            @RequestHeader(
                    value = "Authorization",
                    required = false
            ) String auth
    ) {
        User user =
                currentUserService.getCurrentUserFromAuth(auth);

        if (currentUserService.isAdmin(user)) {
            return ResponseEntity.ok(
                    repository.findDistinctGeneratedByUsers()
            );
        }

        return ResponseEntity.ok(
                List.of(user.getUsername())
        );
    }

    /*
     * =====================================================
     * ITEM-WISE STICKER HISTORY
     * =====================================================
     *
     * This endpoint is used by the Dispatch page.
     *
     * ADMIN:
     * - Can read all.
     *
     * DISPATCH:
     * - Can read normal/hardware history for assigned plants.
     *
     * HARDWARE_PACKING:
     * - Can read owned hardware packets.
     *
     * Other permitted users:
     * - Continue using normal PacketService plant access.
     */

    @Transactional(readOnly = true)
    @GetMapping("/{itemId}/history")
    public ResponseEntity<List<StickerHistoryResponse>> history(
            @PathVariable UUID itemId,
            @RequestHeader(
                    value = "Authorization",
                    required = false
            ) String auth
    ) {
        User user =
                currentUserService.getCurrentUserFromAuth(auth);

        Set<String> allowedPlants =
                currentUserService.allowedPlants(user);

        packetService.requireStickerHistoryReadAccess(
                itemId,
                user,
                allowedPlants
        );

        return ResponseEntity.ok(
                repository.findHistoryByItemId(itemId)
        );
    }

    /*
     * =====================================================
     * STICKER HISTORY PDF
     * =====================================================
     *
     * Important correction:
     *
     * Do not authorize only by generatedBy.
     *
     * Dispatch users need to open stickers generated by Packing
     * and Hardware Packing users.
     */

    @Transactional
    @GetMapping("/history/{historyId}/download-pdf")
    public ResponseEntity<byte[]> download(
            @PathVariable UUID historyId,
            @RequestHeader(
                    value = "Authorization",
                    required = false
            ) String auth
    ) {
        User user =
                currentUserService.getCurrentUserFromAuth(auth);

        Set<String> allowedPlants =
                currentUserService.allowedPlants(user);

        StickerHistory history =
                repository.findByIdWithPacketItem(historyId)
                        .orElseThrow(() ->
                                new ResponseStatusException(
                                        HttpStatus.NOT_FOUND,
                                        "Sticker history not found"
                                )
                        );

        PacketItem packetItem =
                history.getPacketItem();

        if (packetItem != null) {
            /*
             * Main authorization route.
             *
             * This allows Dispatch to read normal and hardware
             * sticker PDFs according to its assigned plants.
             */
            packetService.requireStickerHistoryReadAccess(
                    packetItem.getId(),
                    user,
                    allowedPlants
            );
        } else {
            /*
             * Legacy safety for old StickerHistory records that
             * were saved without packet_item_id.
             *
             * ADMIN may open them.
             * The original generator may also open them.
             * Dispatch is denied because there is no linked plant
             * that can be validated safely.
             */
            boolean originalGenerator =
                    history.getGeneratedBy() != null &&
                    user.getUsername() != null &&
                    history.getGeneratedBy()
                            .equalsIgnoreCase(
                                    user.getUsername()
                            );

            if (!currentUserService.isAdmin(user)
                    && !originalGenerator) {
                throw new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "This legacy sticker record is not linked to a packet item"
                );
            }
        }

        /*
         * Always rebuild linked history from the current PacketItem before serving
         * it. This self-heals old stale rows created before Admin Dispatch edits
         * started refreshing StickerHistory.pdfData. Legacy unlinked rows keep
         * their original immutable bytes because there is no safe source entity.
         */
        byte[] pdfData = packetItem != null
                ? stickerHistoryPdfRefreshService.refreshHistory(history)
                : history.getPdfData();

        if (pdfData == null
                || pdfData.length == 0) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Sticker PDF not found"
            );
        }

        String stickerNumber =
                history.getStickerNumber() != null &&
                !history.getStickerNumber().isBlank()
                        ? history.getStickerNumber().trim()
                        : historyId.toString();

        String safeFileName =
                stickerNumber
                        .replace("\"", "")
                        .replace("\r", "")
                        .replace("\n", "");

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"" +
                                safeFileName +
                                ".pdf\""
                )
                .header(
                        HttpHeaders.CACHE_CONTROL,
                        "no-store, no-cache, must-revalidate, max-age=0"
                )
                .header(
                        HttpHeaders.PRAGMA,
                        "no-cache"
                )
                .header(
                        HttpHeaders.EXPIRES,
                        "0"
                )
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdfData);
    }

    /*
     * =====================================================
     * DISPATCH HISTORY REBUILD
     * =====================================================
     */

    @PostMapping("/dispatched/{zohoItemId}/ensure-history")
    public ResponseEntity<Map<String, Object>> ensureHistoryForDispatchedItem(
            @PathVariable String zohoItemId,
            @RequestHeader(
                    value = "Authorization",
                    required = false
            ) String auth
    ) {
        User user =
                currentUserService.getCurrentUserFromAuth(auth);

        if (!currentUserService.isAdmin(user)
                && !currentUserService.isDispatch(user)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only ADMIN or DISPATCH can rebuild sticker history"
            );
        }

        StickerHistory history =
                packetService.ensureStickerHistoryForDispatchedItem(
                        zohoItemId,
                        user.getUsername(),
                        currentUserService.allowedPlants(user)
                );

        UUID packetItemId =
                history.getPacketItem() != null
                        ? history.getPacketItem().getId()
                        : null;

        if (packetItemId == null) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Packet item could not be resolved for sticker history"
            );
        }

        return ResponseEntity.ok(
                Map.of(
                        "packetItemId",
                        packetItemId.toString(),

                        "historyId",
                        history.getId().toString(),

                        "stickerNumber",
                        history.getStickerNumber(),

                        "message",
                        "Sticker history is ready"
                )
        );
    }
}
