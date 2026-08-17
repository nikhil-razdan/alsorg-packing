package com.alsorg.packing.service.matflow;

import com.alsorg.packing.domain.matflow.MatFlowLocation;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.LocationType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.OwnershipType;
import com.alsorg.packing.repository.matflow.MatFlowLocationRepository;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.context.event.EventListener;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * Four-plant routing authority. There is no user-facing Location concept.
 *
 * Store and Production endpoints are hidden compatibility rows because existing
 * custody/audit tables have foreign keys to mf_locations. They are created and
 * resolved by the system from the Plant and are never selected/configured by a
 * MatFlow operator. The business route is Plant Store / Main Store / Production
 * requester, not a Location master.
 */
@Service
public class MatFlowPlantRoutingService {

    public static final String MAIN_STORE_PLANT = "AL-P1";
    public static final Set<String> FACTORY_PLANTS = Set.of("AL-P1", "AL-P2", "AL-P3", "AL-P4");

    private final MatFlowLocationRepository locationRepository;
    private final MatFlowAccessService accessService;

    public MatFlowPlantRoutingService(MatFlowLocationRepository locationRepository, MatFlowAccessService accessService) {
        this.locationRepository = locationRepository;
        this.accessService = accessService;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void ensureHiddenPlantRoutingNodes() {
        for (String plant : FACTORY_PLANTS) {
            ensureNode(plant, LocationType.STORE);
            ensureNode(plant, LocationType.PRODUCTION);
        }
    }

    public String normalizeFactoryPlant(String plantCode) {
        String plant = normalizePlantText(plantCode);
        if (plant == null || !FACTORY_PLANTS.contains(plant)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
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
        return requireSystemNode(MAIN_STORE_PLANT, LocationType.STORE);
    }

    public MatFlowLocation requireOriginStore(String originPlantCode) {
        return requireSystemNode(normalizeFactoryPlant(originPlantCode), LocationType.STORE);
    }

    public MatFlowLocation requireProductionNode(String plantCode) {
        return requireSystemNode(normalizeFactoryPlant(plantCode), LocationType.PRODUCTION);
    }

    public boolean isMainStoreLocation(MatFlowLocation location) {
        return location != null && location.getLocationType() == LocationType.STORE
                && isMainStorePlant(location.getPlantCode()) && location.isActive();
    }

    public void assertMainStoreLocation(MatFlowLocation location, String operation) {
        MatFlowLocation configured = requireMainStore();
        if (location == null || location.getId() == null || !location.getId().equals(configured.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    (operation == null ? "This action" : operation) + " must use AL-P1 Main Store");
        }
    }

    public void assertOriginStoreLocation(MatFlowLocation location, String originPlantCode, String operation) {
        String plant = normalizeFactoryPlant(originPlantCode);
        MatFlowLocation configured = requireOriginStore(plant);
        if (location == null || location.getId() == null || !location.getId().equals(configured.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    (operation == null ? "This action" : operation) + " must use " + plant + " Store");
        }
    }

    public void requireMainStorePlanningActor() {
        accessService.requireMaterialPlanning();
        accessService.requirePlantAccess(MAIN_STORE_PLANT);
    }

    public void requireOriginStoreActor(String originPlantCode) {
        String plant = normalizeFactoryPlant(originPlantCode);
        accessService.requireStore();
        accessService.requirePlantAccess(plant);
    }

    public boolean canActAsMainStore() {
        return accessService.hasAnyRole("ADMIN", "MATFLOW_MANAGER", "MATFLOW_STORE")
                && accessService.canAccessPlant(MAIN_STORE_PLANT);
    }

    public boolean canActAsOriginStore(String originPlantCode) {
        String plant;
        try { plant = normalizeFactoryPlant(originPlantCode); }
        catch (ResponseStatusException ignored) { return false; }
        return accessService.hasAnyRole("ADMIN", "MATFLOW_MANAGER", "MATFLOW_STORE")
                && accessService.canAccessPlant(plant);
    }

    private MatFlowLocation requireSystemNode(String plantCode, LocationType type) {
        String plant = normalizeFactoryPlant(plantCode);
        MatFlowLocation node = findPreferredNode(plant, type);
        if (node == null) node = ensureNode(plant, type);
        return node;
    }

    private MatFlowLocation ensureNode(String plant, LocationType type) {
        MatFlowLocation existing = findPreferredNode(plant, type);
        if (existing != null) return existing;

        MatFlowLocation node = new MatFlowLocation();
        node.setLocationCode(systemCode(plant, type));
        node.setLocationName(type == LocationType.STORE ? plant + " Store" : plant + " Production");
        node.setPlantCode(plant);
        node.setLocationType(type);
        node.setOwnershipType(OwnershipType.INTERNAL);
        node.setSupportsStock(type == LocationType.STORE);
        node.setActive(true);
        node.setCreatedBy("MATFLOW_SYSTEM");
        node.setUpdatedBy("MATFLOW_SYSTEM");
        try { return locationRepository.save(node); }
        catch (RuntimeException ex) {
            MatFlowLocation retry = findPreferredNode(plant, type);
            if (retry != null) return retry;
            throw ex;
        }
    }

    private MatFlowLocation findPreferredNode(String plant, LocationType type) {
        List<MatFlowLocation> candidates = locationRepository.findAll().stream()
                .filter(x -> x != null && x.isActive())
                .filter(x -> x.getLocationType() == type)
                .filter(x -> plant.equals(normalizePlantText(x.getPlantCode())))
                .sorted(Comparator.comparing((MatFlowLocation x) ->
                        !systemCode(plant, type).equalsIgnoreCase(safe(x.getLocationCode())))
                        .thenComparing(x -> safe(x.getLocationCode()), String.CASE_INSENSITIVE_ORDER))
                .toList();
        return candidates.isEmpty() ? null : candidates.get(0);
    }

    private String systemCode(String plant, LocationType type) {
        return "MF-" + plant + (type == LocationType.STORE ? "-STORE" : "-PRODUCTION");
    }

    private String normalizePlantText(String value) {
        if (value == null || value.trim().isBlank()) return null;
        String normalized = value.trim().toUpperCase(Locale.ROOT)
                .replace('\u2010', '-').replace('\u2011', '-').replace('\u2012', '-')
                .replace('\u2013', '-').replace('\u2014', '-')
                .replaceAll("\\s*-\\s*", "-").replaceAll("\\s+", "").replace('_', '-');
        if (normalized.matches("ALP[1-4]")) normalized = "AL-" + normalized.substring(2);
        return normalized;
    }

    private String safe(String value) { return value == null ? "" : value.trim(); }
}
