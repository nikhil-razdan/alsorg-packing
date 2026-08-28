package com.alsorg.packing.service;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.stereotype.Service;

@Service
public class PlantLocationService {

    public record PlantConfig(
            String plantCode,
            String plantName,
            String packedAreaCode,
            String fgAreaCode,
            List<String> fgZones,
            List<String> warehouseCodes
    ) {}

    private static final Map<String, PlantConfig> PLANTS = Map.of(
            "AL-P1", new PlantConfig(
                    "AL-P1",
                    "AKG",
                    "PKD-1",
                    "FG-1",
                    List.of("A", "B", "C"),
                    List.of("BLS-WH-1", "RTP-WH-2")
            ),
            "AL-P2", new PlantConfig(
                    "AL-P2",
                    "Sofa",
                    "PKD-2",
                    "FG-2",
                    List.of(),
                    List.of("BLS-WH-1", "RTP-WH-2")
            ),
            "AL-P3", new PlantConfig(
                    "AL-P3",
                    "K&W",
                    "PKD-3",
                    "FG-3",
                    List.of(),
                    List.of("BLS-WH-1", "RTP-WH-2")
            ),
            "AL-P4", new PlantConfig(
                    "AL-P4",
                    "Basement",
                    "PKD-4",
                    "FG-4",
                    List.of(),
                    List.of("BLS-WH-1", "RTP-WH-2")
            )
    );

    public PlantConfig getPlantConfig(String plantCode) {
        String cleanPlant = normalizeCode(plantCode);

        PlantConfig config = PLANTS.get(cleanPlant);

        if (config == null) {
            throw new IllegalArgumentException(
                    "Invalid plant code: " + plantCode);
        }

        return config;
    }

    public List<PlantConfig> getAllPlants() {
        return PLANTS.values()
                .stream()
                .sorted(Comparator.comparing(
                        PlantConfig::plantCode))
                .toList();
    }

    public boolean isValidPlant(String plantCode) {
        String cleanPlant = normalizeCode(plantCode);

        return cleanPlant != null
                && PLANTS.containsKey(cleanPlant);
    }

    public boolean isValidFgZone(String plantCode, String fgZoneCode) {
        PlantConfig config = getPlantConfig(plantCode);

        if (config.fgZones().isEmpty()) {
            return fgZoneCode == null || fgZoneCode.isBlank();
        }

        String cleanZone = normalizeCode(fgZoneCode);

        return cleanZone != null
                && config.fgZones().stream()
                        .anyMatch(zone -> zone.equalsIgnoreCase(cleanZone));
    }

    public boolean isWarehouseAllowed(String plantCode, String warehouseCode) {
        String cleanWarehouse = normalizeCode(warehouseCode);

        return cleanWarehouse != null
                && getPlantConfig(plantCode)
                        .warehouseCodes()
                        .stream()
                        .anyMatch(value -> value.equalsIgnoreCase(cleanWarehouse));
    }

    public java.util.Set<String> getAllPlantCodes() {
        return PLANTS.keySet()
                .stream()
                .sorted()
                .collect(
                        java.util.stream.Collectors.toCollection(
                                java.util.LinkedHashSet::new));
    }

    public String buildFgLocation(String plantCode, String fgZoneCode) {
        PlantConfig config = getPlantConfig(plantCode);

        String fgAreaCode = config.fgAreaCode();

        if (config.fgZones().isEmpty()) {
            return fgAreaCode;
        }

        if (fgZoneCode == null || fgZoneCode.isBlank()) {
            throw new RuntimeException("FG zone required for plant: " + plantCode);
        }

        String cleanZone = normalizeCode(fgZoneCode);

        if (cleanZone == null ||
                config.fgZones().stream()
                        .noneMatch(zone -> zone.equalsIgnoreCase(cleanZone))) {
            throw new RuntimeException(
                    "Invalid FG zone " + cleanZone + " for plant " + plantCode
            );
        }

        return fgAreaCode + "-" + cleanZone;
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