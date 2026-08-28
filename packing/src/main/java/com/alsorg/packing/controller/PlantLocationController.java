package com.alsorg.packing.controller;

import java.util.List;
import java.util.Map;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.PlantLocationService;

@RestController
@RequestMapping("/api/plants")
@PreAuthorize("isAuthenticated()")
public class PlantLocationController {

    private final PlantLocationService plantLocationService;
    private final CurrentUserService currentUserService;

    public PlantLocationController(
            PlantLocationService plantLocationService,
            CurrentUserService currentUserService) {
        this.plantLocationService = plantLocationService;
        this.currentUserService = currentUserService;
    }

    @GetMapping
    public List<PlantLocationService.PlantConfig> getAllPlants() {
        currentUserService.requireCurrentUser();
        return plantLocationService.getAllPlants();
    }

    @GetMapping("/my")
    public List<PlantLocationService.PlantConfig> getMyPlants() {
        User user = currentUserService.requireCurrentUser();
        return currentUserService.allowedPlants(user)
                .stream()
                .sorted()
                .map(plantLocationService::getPlantConfig)
                .toList();
    }

    @GetMapping("/codes")
    public Map<String, Object> getPlantCodes() {
        currentUserService.requireCurrentUser();
        return Map.of(
                "plants",
                plantLocationService.getAllPlantCodes()
                        .stream()
                        .sorted()
                        .toList());
    }
}
