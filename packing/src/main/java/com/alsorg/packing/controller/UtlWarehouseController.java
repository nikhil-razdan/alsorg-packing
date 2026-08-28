package com.alsorg.packing.controller;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.DispatchedItemService;
import com.alsorg.packing.service.UtlWorkflowService;
import com.alsorg.packing.service.WarehouseService;

/**
 * Isolated Warehouse boundary for UTL_DISPATCH.
 *
 * UTL_DISPATCH intentionally acts as the UTL Warehouse / Dispatch identity
 * without inheriting generic WAREHOUSE authority.  Every read and mutation is
 * restricted to:
 *   - the authenticated UTL user's one assigned plant (AL-P3 or WR-38),
 *   - a packet that has UTL routing metadata, and
 *   - a packet the UTL routing service says the current user may read/operate.
 *
 * The ordinary /api/warehouse controller is not modified or widened.  This is
 * what preserves the primary AL-P1/P2/P3/P4 and normal WR-38 workflow while
 * giving UTL teams their own Warehouse hand-off path.
 */
@RestController
@RequestMapping("/api/utl/warehouse")
@PreAuthorize("isAuthenticated() and hasAuthority('UTL_DISPATCH')")
public class UtlWarehouseController {

    private static final Set<String> UTL_PLANTS = Set.of(
            "AL-P3",
            "WR-38");

    private final WarehouseService warehouseService;
    private final DispatchedItemService dispatchedItemService;
    private final DispatchedItemRepository dispatchedItemRepository;
    private final CurrentUserService currentUserService;
    private final UtlWorkflowService utlWorkflowService;

    public UtlWarehouseController(
            WarehouseService warehouseService,
            DispatchedItemService dispatchedItemService,
            DispatchedItemRepository dispatchedItemRepository,
            CurrentUserService currentUserService,
            UtlWorkflowService utlWorkflowService) {
        this.warehouseService = warehouseService;
        this.dispatchedItemService = dispatchedItemService;
        this.dispatchedItemRepository = dispatchedItemRepository;
        this.currentUserService = currentUserService;
        this.utlWorkflowService = utlWorkflowService;
    }

    @GetMapping("/floor")
    public ResponseEntity<List<DispatchedItem>> floor() {
        User user = requireUtlWarehouseUser();
        Set<String> plants = requireSingleUtlPlant(user);

        List<DispatchedItem> rows = warehouseService
                .getFloorItems(plants, false)
                .stream()
                .filter(this::isVisibleUtlItem)
                .toList();

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(rows);
    }

    @GetMapping("/items")
    public ResponseEntity<List<DispatchedItem>> items() {
        User user = requireUtlWarehouseUser();
        Set<String> plants = requireSingleUtlPlant(user);

        List<DispatchedItem> rows = warehouseService
                .getWarehouseItems(plants, false)
                .stream()
                .filter(this::isVisibleUtlItem)
                .toList();

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(rows);
    }

    @PostMapping("/{itemId}/approve")
    public ResponseEntity<?> approve(
            @PathVariable String itemId,
            @RequestParam String gatePass) {

        User user = requireUtlWarehouseUser();
        Set<String> plants = requireSingleUtlPlant(user);
        requireVisibleUtlItem(itemId, plants);

        dispatchedItemService.approveWarehouseMove(
                itemId,
                gatePass,
                user.getUsername(),
                plants,
                "UTL_DISPATCH");

        return ResponseEntity.ok(
                Map.of(
                        "status", "IN_WAREHOUSE",
                        "itemId", itemId));
    }

    @PostMapping("/{itemId}/reject")
    public ResponseEntity<?> reject(
            @PathVariable String itemId) {

        User user = requireUtlWarehouseUser();
        Set<String> plants = requireSingleUtlPlant(user);
        requireVisibleUtlItem(itemId, plants);

        dispatchedItemService.rejectWarehouseMove(
                itemId,
                user.getUsername(),
                plants,
                "UTL_DISPATCH");

        return ResponseEntity.ok(
                Map.of(
                        "status", "READY_TO_STORE",
                        "itemId", itemId));
    }

    @PostMapping("/{itemId}/request-return")
    public ResponseEntity<?> requestReturn(
            @PathVariable String itemId) {

        User user = requireUtlWarehouseUser();
        Set<String> plants = requireSingleUtlPlant(user);
        requireVisibleUtlItem(itemId, plants);

        /*
         * DispatchedItemService also re-checks UTL operational routing before
         * changing the status, so this endpoint has defense in depth.
         */
        dispatchedItemService.requestReturnToDispatch(
                itemId,
                user.getUsername());

        return ResponseEntity.ok(
                Map.of(
                        "status", "WAREHOUSE_RETURN_REQUESTED",
                        "itemId", itemId));
    }

    private User requireUtlWarehouseUser() {
        User user = currentUserService.requireCurrentUser();

        if (!currentUserService.isUtlDispatch(user)) {
            throw new AccessDeniedException(
                    "UTL_DISPATCH access required");
        }

        requireSingleUtlPlant(user);
        return user;
    }

    private Set<String> requireSingleUtlPlant(
            User user) {
        Set<String> plants = currentUserService.allowedPlants(user);

        if (plants == null || plants.size() != 1) {
            throw new AccessDeniedException(
                    "UTL Warehouse / Dispatch identity must have exactly one plant");
        }

        String plant = normalizeCode(
                plants.iterator().next());

        if (plant == null || !UTL_PLANTS.contains(plant)) {
            throw new AccessDeniedException(
                    "UTL Warehouse / Dispatch can operate only in AL-P3 or WR-38");
        }

        return Set.of(plant);
    }

    private boolean isVisibleUtlItem(
            DispatchedItem item) {
        if (item == null || item.getPacketItemId() == null) {
            return false;
        }

        if (utlWorkflowService
                .findRoutingByPacketItemId(item.getPacketItemId())
                .isEmpty()) {
            return false;
        }

        return utlWorkflowService.canCurrentUserRead(item);
    }

    private DispatchedItem requireVisibleUtlItem(
            String itemId,
            Set<String> plants) {
        String cleanId = cleanRequired(itemId);

        DispatchedItem item = dispatchedItemRepository
                .findById(cleanId)
                .orElseThrow(() -> hiddenNotFound(cleanId));

        String itemPlant = normalizeCode(item.getPlantCode());

        if (itemPlant == null || !plants.contains(itemPlant)) {
            throw hiddenNotFound(cleanId);
        }

        if (item.getPacketItemId() == null
                || utlWorkflowService
                        .findRoutingByPacketItemId(item.getPacketItemId())
                        .isEmpty()) {
            throw hiddenNotFound(cleanId);
        }

        /* Stronger write check than read visibility. */
        utlWorkflowService.assertCurrentUserCanOperate(item);

        return item;
    }

    private ResponseStatusException hiddenNotFound(
            String itemId) {
        return new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "UTL warehouse item not found or not assigned: " + itemId);
    }

    private String cleanRequired(
            String value) {
        String clean = value == null
                ? ""
                : value.trim();

        if (clean.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Warehouse item id is required");
        }

        if (clean.length() > 300) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Warehouse item id is too long");
        }

        return clean;
    }

    private String normalizeCode(
            String value) {
        if (value == null) {
            return null;
        }

        String clean = value
                .trim()
                .toUpperCase(Locale.ROOT);

        return clean.isBlank()
                ? null
                : clean;
    }
}
