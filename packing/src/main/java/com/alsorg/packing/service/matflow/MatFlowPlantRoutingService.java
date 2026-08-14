package com.alsorg.packing.service.matflow;

import com.alsorg.packing.domain.matflow.MatFlowLocation;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.LocationType;
import com.alsorg.packing.repository.matflow.MatFlowLocationRepository;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * MatFlow-only authority for the four-plant Store topology.
 *
 * <p>AL-P1 Store is the Main Store. AL-P2/AL-P3/AL-P4 Stores are routing
 * nodes for MR forwarding, outbound material handover and reverse material
 * returns. Central stock review, reservation, PI delivery, GRN inward and QC
 * always belong to AL-P1 Main Store.</p>
 */
@Service
public class MatFlowPlantRoutingService {

    public static final String MAIN_STORE_PLANT = "AL-P1";
    public static final Set<String> FACTORY_PLANTS = Set.of(
            "AL-P1", "AL-P2", "AL-P3", "AL-P4");

    private final MatFlowLocationRepository locationRepository;
    private final MatFlowAccessService accessService;

    public MatFlowPlantRoutingService(
            MatFlowLocationRepository locationRepository,
            MatFlowAccessService accessService) {
        this.locationRepository = locationRepository;
        this.accessService = accessService;
    }

    /** Accepts AL-P1 as well as harmless spacing variants such as "AL - P1". */
    public String normalizeFactoryPlant(String plantCode) {
        String plant = normalizePlantText(plantCode);
        if (plant == null || !FACTORY_PLANTS.contains(plant)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "MatFlow factory plant must be one of AL-P1, AL-P2, AL-P3 or AL-P4");
        }
        return plant;
    }

    public boolean isMainStorePlant(String plantCode) {
        return MAIN_STORE_PLANT.equals(normalizePlantText(plantCode));
    }

    public boolean requiresOriginStoreHop(String originPlantCode) {
        return !isMainStorePlant(normalizeFactoryPlant(originPlantCode));
    }

    public MatFlowLocation requireMainStore() {
        return requirePlantStore(MAIN_STORE_PLANT, "AL-P1 Main Store");
    }

    public MatFlowLocation requireOriginStore(String originPlantCode) {
        String plant = normalizeFactoryPlant(originPlantCode);
        return requirePlantStore(plant, plant + " Store");
    }

    public boolean isMainStoreLocation(MatFlowLocation location) {
        if (location == null || location.getLocationType() != LocationType.STORE) {
            return false;
        }
        return isMainStorePlant(location.getPlantCode())
                && location.isActive()
                && location.isSupportsStock();
    }

    public void assertMainStoreLocation(MatFlowLocation location, String operation) {
        if (!isMainStoreLocation(location)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    (operation == null ? "This action" : operation)
                            + " must use AL-P1 Main Store");
        }

        MatFlowLocation configured = requireMainStore();
        if (location.getId() == null || !location.getId().equals(configured.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    (operation == null ? "This action" : operation)
                            + " must use the configured AL-P1 Main Store location: "
                            + configured.getLocationCode());
        }
    }

    public void assertOriginStoreLocation(
            MatFlowLocation location,
            String originPlantCode,
            String operation) {
        String originPlant = normalizeFactoryPlant(originPlantCode);
        if (location == null
                || location.getLocationType() != LocationType.STORE
                || !location.isActive()
                || !location.isSupportsStock()
                || !originPlant.equals(normalizePlantText(location.getPlantCode()))) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    (operation == null ? "This action" : operation)
                            + " must use the active stock-enabled " + originPlant + " Store");
        }

        MatFlowLocation configured = requireOriginStore(originPlant);
        if (location.getId() == null || !location.getId().equals(configured.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    (operation == null ? "This action" : operation)
                            + " must use the configured " + originPlant + " Store location: "
                            + configured.getLocationCode());
        }
    }

    /** Main Store planning is a P1 Store/Manager/Admin action only. */
    public void requireMainStorePlanningActor() {
        accessService.requireMaterialPlanning();
        accessService.requirePlantAccess(MAIN_STORE_PLANT);
    }

    /** P2/P3/P4 forwarding/final handover is owned by that origin Store. */
    public void requireOriginStoreActor(String originPlantCode) {
        String plant = normalizeFactoryPlant(originPlantCode);
        accessService.requireStore();
        accessService.requirePlantAccess(plant);
    }

    /**
     * True only for a Store/Manager/Admin actor who can operate AL-P1. This is
     * used for routed MR visibility without granting global remote-plant access.
     */
    public boolean canActAsMainStore() {
        return accessService.hasAnyRole(
                "ADMIN", "MATFLOW_MANAGER", "MATFLOW_STORE")
                && accessService.canAccessPlant(MAIN_STORE_PLANT);
    }

    public boolean canActAsOriginStore(String originPlantCode) {
        String plant;
        try {
            plant = normalizeFactoryPlant(originPlantCode);
        } catch (ResponseStatusException ignored) {
            return false;
        }
        return accessService.hasAnyRole(
                "ADMIN", "MATFLOW_MANAGER", "MATFLOW_STORE")
                && accessService.canAccessPlant(plant);
    }

    private MatFlowLocation requirePlantStore(String plantCode, String label) {
        String plant = normalizeFactoryPlant(plantCode);
        List<MatFlowLocation> candidates = locationRepository.findAll().stream()
                .filter(location -> location != null)
                .filter(MatFlowLocation::isActive)
                .filter(MatFlowLocation::isSupportsStock)
                .filter(location -> location.getLocationType() == LocationType.STORE)
                .filter(location -> plant.equals(normalizePlantText(location.getPlantCode())))
                .sorted(Comparator.comparing(
                        location -> safe(location.getLocationCode()),
                        String.CASE_INSENSITIVE_ORDER))
                .toList();

        if (candidates.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    label + " is not configured as an active stock-enabled STORE location");
        }
        if (candidates.size() > 1) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    label + " is ambiguous: more than one active stock-enabled STORE location exists for "
                            + plant + ". Keep exactly one plant Store active for MatFlow routing.");
        }
        return candidates.get(0);
    }

    private String normalizePlantText(String value) {
        if (value == null || value.trim().isBlank()) {
            return null;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT)
                .replace('\u2010', '-')
                .replace('\u2011', '-')
                .replace('\u2012', '-')
                .replace('\u2013', '-')
                .replace('\u2014', '-')
                .replaceAll("\\s*-\\s*", "-")
                .replaceAll("\\s+", "")
                .replace('_', '-');
        if (normalized.matches("ALP[1-4]")) {
            normalized = "AL-" + normalized.substring(2);
        }
        return normalized;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
