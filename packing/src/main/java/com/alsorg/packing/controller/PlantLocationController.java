package com.alsorg.packing.controller;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.*;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.PlantLocationService;

@RestController
@RequestMapping("/api/plants")
public class PlantLocationController {

    private final PlantLocationService plantLocationService;
    private final CurrentUserService currentUserService;

    public PlantLocationController(
            PlantLocationService plantLocationService,
            CurrentUserService currentUserService
    ) {
        this.plantLocationService = plantLocationService;
        this.currentUserService = currentUserService;
    }

    @GetMapping
    public List<PlantLocationService.PlantConfig> getAllPlants() {
        return plantLocationService.getAllPlants();
    }

    @GetMapping("/my")
    public List<PlantLocationService.PlantConfig> getMyPlants(
            @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        User user = currentUserService.getCurrentUserFromAuth(auth);

        return currentUserService.allowedPlants(user)
                .stream()
                .map(plantLocationService::getPlantConfig)
                .toList();
    }

    @GetMapping("/codes")
    public Map<String, Object> getPlantCodes() {
        return Map.of("plants", plantLocationService.getAllPlantCodes());
    }
}