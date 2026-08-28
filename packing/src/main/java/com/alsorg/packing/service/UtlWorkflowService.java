package com.alsorg.packing.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.alsorg.packing.config.TimeZoneConfig;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.item.PacketItem;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.domain.utl.UtlPacketRouting;
import com.alsorg.packing.repository.UtlPacketRoutingRepository;

/**
 * Strict boundary around the external UTL packing/dispatch workflow.
 *
 * UTL exists only at AL-P3 (K&W) and WR-38.  A UTL packing user must choose
 * one concrete dispatch user before the final sticker/QR is generated.  The
 * selected user is then the only non-admin user allowed to operate that UTL
 * packet in Dispatch.
 */
@Service
public class UtlWorkflowService {

    public static final String ROLE_UTL_PACKING = "UTL_PACKING";
    public static final String ROLE_UTL_DISPATCH = "UTL_DISPATCH";

    public static final String MODE_UTL = "UTL";
    public static final String MODE_INTERNAL = "INTERNAL";

    public static final String AL_P3 = "AL-P3";
    public static final String WR_38 = "WR-38";

    private static final Set<String> UTL_SOURCE_PLANTS = Set.of(AL_P3, WR_38);
    private static final Set<String> ALS_INTERNAL_DISPATCH_PLANTS = Set.of(
            "AL-P1", "AL-P2", "AL-P3", "AL-P4");

    private final UtlPacketRoutingRepository routingRepository;
    private final UserService userService;
    private final CurrentUserService currentUserService;
    private final PlantLocationService plantLocationService;

    public UtlWorkflowService(
            UtlPacketRoutingRepository routingRepository,
            UserService userService,
            CurrentUserService currentUserService,
            PlantLocationService plantLocationService) {
        this.routingRepository = routingRepository;
        this.userService = userService;
        this.currentUserService = currentUserService;
        this.plantLocationService = plantLocationService;
    }

    public boolean isUtlSourcePlant(String plantCode) {
        String clean = cleanUpper(plantCode);
        return clean != null && UTL_SOURCE_PLANTS.contains(clean);
    }

    @Transactional(readOnly = true)
    public List<DispatchTarget> getEligibleDispatchTargets(
            User packingUser,
            String sourcePlantCode) {

        if (packingUser == null) {
            throw new AccessDeniedException("Authentication is required");
        }

        if (!currentUserService.isAdmin(packingUser)
                && !currentUserService.isUtlPacking(packingUser)) {
            throw new AccessDeniedException(
                    "UTL dispatch target selection requires UTL_PACKING access");
        }

        String sourcePlant = requireUtlSourcePlant(sourcePlantCode);

        if (!currentUserService.isAdmin(packingUser)
                && !currentUserService.canAccessPlant(packingUser, sourcePlant)) {
            throw new AccessDeniedException(
                    "UTL packing user does not have access to " + sourcePlant);
        }

        List<DispatchTarget> result = new ArrayList<>();

        for (User candidate : userService.getAllUsers()) {
            if (candidate == null || !candidate.isEnabled()) {
                continue;
            }

            String username = clean(candidate.getUsername());
            if (username == null) {
                continue;
            }

            Set<String> plants = normalizePlants(candidate.getEffectivePlantCodes());

            if (currentUserService.isUtlDispatch(candidate)
                    && plants.contains(sourcePlant)) {
                result.add(new DispatchTarget(
                        username,
                        MODE_UTL,
                        sourcePlant,
                        sourcePlant.equals(WR_38)
                                ? "UTL Dispatch • WR-38"
                                : "UTL Dispatch • AL-P3 K&W"));
            }

            if (!currentUserService.isDispatch(candidate)) {
                continue;
            }

            if (WR_38.equals(sourcePlant)) {
                if (plants.contains(WR_38)) {
                    result.add(new DispatchTarget(
                            username,
                            MODE_INTERNAL,
                            WR_38,
                            "WR-38 Dispatch"));
                }
                continue;
            }

            for (String plant : ALS_INTERNAL_DISPATCH_PLANTS) {
                if (plants.contains(plant)) {
                    result.add(new DispatchTarget(
                            username,
                            MODE_INTERNAL,
                            plant,
                            plant + " Dispatch"));
                }
            }
        }

        Map<String, DispatchTarget> unique = new LinkedHashMap<>();
        for (DispatchTarget target : result) {
            String key = target.dispatchMode()
                    + "|" + target.plantCode()
                    + "|" + target.username().toLowerCase(Locale.ROOT);
            unique.putIfAbsent(key, target);
        }

        return unique.values()
                .stream()
                .sorted(Comparator
                        .comparing(DispatchTarget::dispatchMode)
                        .thenComparing(DispatchTarget::plantCode)
                        .thenComparing(DispatchTarget::username, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    /**
     * Called while PacketService owns the packet-item row lock.  Non-UTL users
     * keep their existing path and simply receive Optional.empty().
     */
    @Transactional
    public Optional<UtlPacketRouting> applyRoutingForSticker(
            PacketItem item,
            User packingUser,
            String requestedMode,
            String requestedTargetUsername,
            String requestedTargetPlantCode) {

        if (packingUser == null || !currentUserService.isUtlPacking(packingUser)) {
            return Optional.empty();
        }

        if (item == null || item.getId() == null) {
            throw new IllegalArgumentException("UTL packet item is required");
        }

        String sourcePlant = requireUtlSourcePlant(item.getPlantCode());

        if (!currentUserService.canAccessPlant(packingUser, sourcePlant)) {
            throw new AccessDeniedException(
                    "UTL packing user cannot route a packet outside its assigned plant");
        }

        String mode = cleanUpper(requestedMode);
        String targetUsername = clean(requestedTargetUsername);
        String targetPlant = cleanUpper(requestedTargetPlantCode);

        if (!MODE_UTL.equals(mode) && !MODE_INTERNAL.equals(mode)) {
            throw new IllegalArgumentException(
                    "Select UTL Dispatch or Internal Plant Dispatch before sticker generation");
        }

        if (targetUsername == null) {
            throw new IllegalArgumentException(
                    "Select the dispatch user before sticker generation");
        }

        if (targetPlant == null) {
            throw new IllegalArgumentException(
                    "Select the dispatch plant before sticker generation");
        }

        DispatchTarget selected = getEligibleDispatchTargets(packingUser, sourcePlant)
                .stream()
                .filter(target -> mode.equals(target.dispatchMode()))
                .filter(target -> targetPlant.equalsIgnoreCase(target.plantCode()))
                .filter(target -> targetUsername.equalsIgnoreCase(target.username()))
                .findFirst()
                .orElseThrow(() -> new AccessDeniedException(
                        "Selected dispatch user is not eligible for this UTL packet"));

        LocalDateTime now = LocalDateTime.now(TimeZoneConfig.APP_ZONE);

        UtlPacketRouting routing = routingRepository.findByPacketItemId(item.getId())
                .orElseGet(UtlPacketRouting::new);

        if (routing.getPacketItemId() == null) {
            routing.setPacketItemId(item.getId());
            routing.setCreatedAt(now);
        }

        routing.setSourcePlantCode(sourcePlant);
        routing.setDispatchMode(selected.dispatchMode());
        routing.setDispatchTargetUsername(selected.username());
        routing.setDispatchTargetPlantCode(selected.plantCode());
        routing.setPackedByUsername(requireUsername(packingUser));
        routing.setUpdatedAt(now);

        return Optional.of(routingRepository.save(routing));
    }

    /**
     * The PacketItem remains attached to the physical UTL source plant.  The
     * DispatchedItem is projected into the selected dispatch plant so all
     * existing FG/status/challan queries continue to work without weakening
     * normal plant security.
     */
    public void applyOperationalDispatchProjection(
            DispatchedItem dispatchedItem,
            UtlPacketRouting routing) {

        if (dispatchedItem == null || routing == null) {
            return;
        }

        String targetPlantCode = cleanUpper(routing.getDispatchTargetPlantCode());
        PlantLocationService.PlantConfig targetPlant =
                plantLocationService.getPlantConfig(targetPlantCode);

        dispatchedItem.setPlantCode(targetPlantCode);
        dispatchedItem.setPackedAreaCode(targetPlant.packedAreaCode());
        dispatchedItem.setCurrentLocationCode(targetPlant.packedAreaCode());
        dispatchedItem.setFgAreaCode(targetPlant.fgAreaCode());
        dispatchedItem.setFgZoneCode(null);
        dispatchedItem.setWarehouseCode(null);
        dispatchedItem.setGatePassNumber(null);
        dispatchedItem.setFromLocation(null);
        dispatchedItem.setLocation(targetPlant.packedAreaCode());
    }

    @Transactional(readOnly = true)
    public Optional<UtlPacketRouting> findRouting(DispatchedItem item) {
        if (item == null || item.getPacketItemId() == null) {
            return Optional.empty();
        }
        return routingRepository.findByPacketItemId(item.getPacketItemId());
    }

    @Transactional(readOnly = true)
    public Map<UUID, UtlPacketRouting> findRoutingMap(
            Collection<DispatchedItem> items) {
        Set<UUID> ids = new LinkedHashSet<>();
        if (items != null) {
            for (DispatchedItem item : items) {
                if (item != null && item.getPacketItemId() != null) {
                    ids.add(item.getPacketItemId());
                }
            }
        }

        if (ids.isEmpty()) {
            return Map.of();
        }

        Map<UUID, UtlPacketRouting> result = new LinkedHashMap<>();
        for (UtlPacketRouting routing : routingRepository.findByPacketItemIdIn(ids)) {
            if (routing != null && routing.getPacketItemId() != null) {
                result.put(routing.getPacketItemId(), routing);
            }
        }
        return result;
    }

    /**
     * Hard mutation boundary for routed UTL work.
     *
     * - ADMIN remains the controlled override.
     * - The exact selected dispatcher may perform dispatch-side mutations.
     * - WAREHOUSE / LOGISTICS keep their existing downstream plant-scoped
     *   hand-off operations after the UTL packet has been projected to the
     *   selected dispatch plant.
     * - A pure UTL_DISPATCH user can never operate an ordinary non-UTL row.
     */
    @Transactional(readOnly = true)
    public void assertCurrentUserCanOperate(DispatchedItem item) {
        User user = currentUserService.requireCurrentUser();

        if (currentUserService.isAdmin(user)) {
            return;
        }

        Optional<UtlPacketRouting> optionalRouting = findRouting(item);

        if (optionalRouting.isEmpty()) {
            if (currentUserService.isUtlDispatch(user)
                    && !currentUserService.isDispatch(user)) {
                throw new AccessDeniedException(
                        "UTL dispatch users can operate only UTL-routed packets");
            }
            return;
        }

        UtlPacketRouting routing = optionalRouting.get();
        String targetPlant = cleanUpper(routing.getDispatchTargetPlantCode());

        /* Existing Warehouse / Logistics hand-off stays plant-scoped. */
        if (currentUserService.isWarehouse(user) || currentUserService.isLogistics(user)) {
            if (targetPlant != null && currentUserService.canAccessPlant(user, targetPlant)) {
                return;
            }
            throw new AccessDeniedException(
                    "UTL packet is outside this user's assigned plant");
        }

        String username = requireUsername(user);
        String targetUsername = clean(routing.getDispatchTargetUsername());

        if (targetUsername == null || !username.equalsIgnoreCase(targetUsername)) {
            throw new AccessDeniedException(
                    "This UTL packet is assigned to dispatch user "
                            + routing.getDispatchTargetUsername());
        }

        String mode = cleanUpper(routing.getDispatchMode());

        if (MODE_UTL.equals(mode)) {
            if (!currentUserService.isUtlDispatch(user)) {
                throw new AccessDeniedException(
                        "This packet is assigned to UTL Dispatch");
            }
        } else if (MODE_INTERNAL.equals(mode)) {
            if (!currentUserService.isDispatch(user)) {
                throw new AccessDeniedException(
                        "This packet is assigned to an internal DISPATCH user");
            }
        } else {
            throw new AccessDeniedException(
                    "UTL packet has an invalid dispatch route");
        }

        if (targetPlant != null && !currentUserService.canAccessPlant(user, targetPlant)) {
            throw new AccessDeniedException(
                    "Assigned dispatch user no longer has access to " + targetPlant);
        }
    }

    /**
     * Read visibility for UTL-routed rows. The creator side intentionally
     * retains visibility even when the selected/actual dispatcher is an
     * internal AL/WR dispatcher. This implements the shared-view rule:
     * UTL creator + selected/actual dispatcher can both see the same packet.
     */
    @Transactional(readOnly = true)
    public boolean canCurrentUserRead(DispatchedItem item) {
        User user;
        try {
            user = currentUserService.requireCurrentUser();
        } catch (Exception exception) {
            return false;
        }

        if (currentUserService.isAdmin(user)) {
            return true;
        }

        Optional<UtlPacketRouting> optionalRouting = findRouting(item);

        if (optionalRouting.isEmpty()) {
            /* Pure UTL identities never inherit ordinary plant-wide rows. */
            return !currentUserService.isUtlUser(user);
        }

        UtlPacketRouting routing = optionalRouting.get();
        String username = clean(user.getUsername());

        if (username != null) {
            if (username.equalsIgnoreCase(clean(routing.getPackedByUsername()))) {
                return true;
            }
            if (username.equalsIgnoreCase(clean(routing.getDispatchTargetUsername()))) {
                return true;
            }
            if (item != null
                    && username.equalsIgnoreCase(clean(item.getDispatchedBy()))) {
                return true;
            }
        }

        if (currentUserService.isWarehouse(user) || currentUserService.isLogistics(user)) {
            String targetPlant = cleanUpper(routing.getDispatchTargetPlantCode());
            return targetPlant != null && currentUserService.canAccessPlant(user, targetPlant);
        }

        return false;
    }

    @Transactional(readOnly = true)
    public Optional<UtlPacketRouting> findRoutingByPacketItemId(UUID packetItemId) {
        if (packetItemId == null) {
            return Optional.empty();
        }
        return routingRepository.findByPacketItemId(packetItemId);
    }

    @Transactional(readOnly = true)
    public boolean canUserReadPacketItem(PacketItem item, User user) {
        if (item == null || item.getId() == null || user == null) {
            return false;
        }

        Optional<UtlPacketRouting> optionalRouting = routingRepository
                .findByPacketItemId(item.getId());

        if (optionalRouting.isEmpty()) {
            return false;
        }

        if (currentUserService.isAdmin(user)) {
            return true;
        }

        UtlPacketRouting routing = optionalRouting.get();
        String username = clean(user.getUsername());

        if (username != null
                && (username.equalsIgnoreCase(clean(routing.getPackedByUsername()))
                        || username.equalsIgnoreCase(clean(routing.getDispatchTargetUsername())))) {
            return true;
        }

        if (currentUserService.isWarehouse(user) || currentUserService.isLogistics(user)) {
            String targetPlant = cleanUpper(routing.getDispatchTargetPlantCode());
            return targetPlant != null && currentUserService.canAccessPlant(user, targetPlant);
        }

        return false;
    }

    public String requireUtlSourcePlant(String plantCode) {
        String clean = cleanUpper(plantCode);
        if (clean == null || !UTL_SOURCE_PLANTS.contains(clean)) {
            throw new IllegalArgumentException(
                    "UTL can operate only in AL-P3 (K&W) or WR-38");
        }
        return clean;
    }

    private Set<String> normalizePlants(Set<String> plants) {
        Set<String> result = new LinkedHashSet<>();
        if (plants == null) {
            return result;
        }
        for (String plant : plants) {
            String clean = cleanUpper(plant);
            if (clean != null) {
                result.add(clean);
            }
        }
        return result;
    }

    private String requireUsername(User user) {
        String username = user == null ? null : clean(user.getUsername());
        if (username == null) {
            throw new AccessDeniedException("Authenticated username is missing");
        }
        return username;
    }

    private String cleanUpper(String value) {
        String clean = clean(value);
        return clean == null ? null : clean.toUpperCase(Locale.ROOT);
    }

    private String clean(String value) {
        if (value == null) {
            return null;
        }
        String clean = value.trim();
        return clean.isBlank() ? null : clean;
    }

    public record DispatchTarget(
            String username,
            String dispatchMode,
            String plantCode,
            String label) {
    }
}
