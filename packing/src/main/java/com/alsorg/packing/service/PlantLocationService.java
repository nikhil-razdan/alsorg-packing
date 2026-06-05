package com.alsorg.packing.service;

import java.util.List;
import java.util.Map;
import java.util.Set;

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
        PlantConfig config = PLANTS.get(plantCode);

        if (config == null) {
            throw new RuntimeException("Invalid plant code: " + plantCode);
        }

        return config;
    }

    public List<PlantConfig> getAllPlants() {
        return PLANTS.values().stream().toList();
    }

    public boolean isValidPlant(String plantCode) {
        return PLANTS.containsKey(plantCode);
    }

    public boolean isValidFgZone(String plantCode, String fgZoneCode) {
        PlantConfig config = getPlantConfig(plantCode);

        if (config.fgZones().isEmpty()) {
            return fgZoneCode == null || fgZoneCode.isBlank();
        }

        return fgZoneCode != null && config.fgZones().contains(fgZoneCode);
    }

    public boolean isWarehouseAllowed(String plantCode, String warehouseCode) {
        return getPlantConfig(plantCode)
                .warehouseCodes()
                .contains(warehouseCode);
    }

    public java.util.Set<String> getAllPlantCodes() {
        return new java.util.LinkedHashSet<>(PLANTS.keySet());
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

        String cleanZone = fgZoneCode.trim();

        if (!config.fgZones().contains(cleanZone)) {
            throw new RuntimeException(
                    "Invalid FG zone " + cleanZone + " for plant " + plantCode
            );
        }

        return fgAreaCode + "-" + cleanZone;
    }
}