package com.alsorg.packing.service;

import java.util.LinkedHashSet;
import java.util.Set;

import org.springframework.stereotype.Service;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.UserRepository;
import com.alsorg.packing.security.JwtUtil;

@Service
public class CurrentUserService {

    private final UserRepository userRepository;
    private final PlantLocationService plantLocationService;

    public CurrentUserService(
            UserRepository userRepository,
            PlantLocationService plantLocationService
    ) {
        this.userRepository = userRepository;
        this.plantLocationService = plantLocationService;
    }

    public User getCurrentUserFromAuth(String auth) {
        if (auth == null || !auth.startsWith("Bearer ")) {
            throw new RuntimeException("Missing Authorization header");
        }

        String token = auth.replace("Bearer ", "").trim();
        String username = JwtUtil.getUsername(token);

        if (username == null || username.isBlank()) {
            throw new RuntimeException("Username missing in token");
        }

        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));
    }

    public boolean isAdmin(User user) {
        return user != null && "ADMIN".equalsIgnoreCase(user.getRole());
    }

    public boolean isPacking(User user) {
        return user != null && "PACKING".equalsIgnoreCase(user.getRole());
    }

    public boolean isDispatch(User user) {
        return user != null && "DISPATCH".equalsIgnoreCase(user.getRole());
    }
    
    public boolean isLogistics(User user) {
        if (user == null || user.getRole() == null) {
            return false;
        }

        return "LOGISTICS".equalsIgnoreCase(
                String.valueOf(user.getRole()).trim()
        );
    }
    
    public boolean isDriver(User user) {
        if (user == null || user.getRole() == null) {
            return false;
        }

        return "DRIVER".equalsIgnoreCase(
                String.valueOf(user.getRole()).trim()
        );
    }

    public boolean canViewTrips(User user) {
        return isAdmin(user)
                || isDispatch(user)
                || isLogistics(user)
                || isDriver(user);
    }

    public Set<String> allowedPlants(User user) {
        if (user == null) {
            throw new RuntimeException("User missing");
        }

        if (isAdmin(user)) {
            return plantLocationService.getAllPlantCodes();
        }

        Set<String> plants = parsePlantCodes(user.getPlantCode());

        /*
         * LEGACY SAFETY:
         * Old users may not have plantCode assigned yet.
         * Let them continue working until admin assigns plant.
         */
        if (plants.isEmpty()) {
            return plantLocationService.getAllPlantCodes();
        }
        return plants;
    }

    public boolean hasExplicitPlantAccess(User user) {
        if (user == null) return false;
        return !parsePlantCodes(user.getPlantCode()).isEmpty();
    }

    public boolean canAccessPlant(User user, String plantCode) {
        if (plantCode == null || plantCode.isBlank()) {
            return false;
        }

        return allowedPlants(user).contains(plantCode.trim());
    }

    public String resolvePlantForWrite(User user, String requestedPlantCode) {
        Set<String> allowed = allowedPlants(user);

        if (requestedPlantCode != null && !requestedPlantCode.isBlank()) {
            String clean = requestedPlantCode.trim();

            if (!allowed.contains(clean)) {
                throw new RuntimeException("User does not have access to plant: " + clean);
            }

            return clean;
        }

        if (allowed.size() == 1) {
            return allowed.iterator().next();
        }

        throw new RuntimeException("Plant selection required");
    }

    private Set<String> parsePlantCodes(String raw) {
        Set<String> plants = new LinkedHashSet<>();

        if (raw == null || raw.isBlank()) {
            return plants;
        }

        for (String part : raw.split(",")) {
            String clean = part.trim();

            if (!clean.isBlank()) {
                plants.add(clean);
            }
        }

        return plants;
    }
}