package com.alsorg.packing.service;

import java.util.Set;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
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

    /*
     * NEW PREFERRED METHOD:
     * Uses Spring SecurityContext populated by JwtAuthenticationFilter.
     */
    public User requireCurrentUser() {
        String username =
                usernameFromSecurityContext();

        if (username == null || username.isBlank()) {
            throw new AccessDeniedException("Authentication required");
        }

        User user =
                userRepository.findByUsernameIgnoreCase(username)
                        .orElseThrow(() ->
                                new AccessDeniedException("User not found")
                        );

        if (!user.isEnabled()) {
            throw new AccessDeniedException("User is disabled");
        }

        return user;
    }

    /*
     * BACKWARD COMPATIBILITY:
     * Existing controllers still call getCurrentUserFromAuth(auth).
     *
     * If Authorization header is present, parse it.
     * If Authorization header is missing because frontend now uses HttpOnly cookie,
     * fallback to SecurityContext.
     */
    public User getCurrentUserFromAuth(
        String auth
) {
    String username = null;

    if (auth != null && auth.startsWith("Bearer ")) {
        username = JwtUtil.getUsername(auth);
    }

    if (username == null || username.isBlank()) {
        username = usernameFromSecurityContext();
    }

    if (username == null || username.isBlank()) {
        throw new AccessDeniedException("Authentication required");
    }

    final String finalUsername = username;

    User user =
            userRepository.findByUsernameIgnoreCase(finalUsername)
                    .orElseThrow(() ->
                            new AccessDeniedException(
                                    "User not found: " + finalUsername
                            )
                    );

    if (!user.isEnabled()) {
        throw new AccessDeniedException("User is disabled");
    }

    return user;
}

    private String usernameFromSecurityContext() {
        Authentication authentication =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        if (
                authentication == null
                        || !authentication.isAuthenticated()
                        || authentication.getName() == null
                        || authentication.getName().isBlank()
        ) {
            return null;
        }

        return authentication.getName();
    }

    public boolean isAdmin(User user) {
        return hasRole(user, "ADMIN");
    }

    public boolean isPacking(User user) {
        return hasRole(user, "PACKING");
    }

    public boolean isDispatch(User user) {
        return hasRole(user, "DISPATCH");
    }

    public boolean isLogistics(User user) {
        return hasRole(user, "LOGISTICS");
    }

    public boolean isDriver(User user) {
        return hasRole(user, "DRIVER");
    }

    public boolean isWarehouse(User user) {
        return hasRole(user, "WAREHOUSE");
    }

    public boolean hasRole(
            User user,
            String role
    ) {
        return user != null
                && user.getRole() != null
                && user.getRole()
                        .trim()
                        .equalsIgnoreCase(role);
    }

    public boolean hasModule(
            User user,
            String module
    ) {
        return user != null
                && user.getEffectiveModules() != null
                && user.getEffectiveModules()
                        .contains(module);
    }

    public boolean canViewTrips(User user) {
        return isAdmin(user)
                || isDispatch(user)
                || isLogistics(user)
                || isDriver(user);
    }

    public Set<String> allowedPlants(User user) {
        if (user == null) {
            throw new AccessDeniedException("User missing");
        }

        if (isAdmin(user)) {
            return plantLocationService.getAllPlantCodes();
        }

        Set<String> plants =
                user.getEffectivePlantCodes();

        if (plants == null || plants.isEmpty()) {
            throw new AccessDeniedException(
                    "No plant access assigned"
            );
        }

        return plants;
    }

    public boolean hasExplicitPlantAccess(User user) {
        return user != null
                && user.getEffectivePlantCodes() != null
                && !user.getEffectivePlantCodes().isEmpty();
    }

    public boolean canAccessPlant(
            User user,
            String plantCode
    ) {
        if (plantCode == null || plantCode.isBlank()) {
            return false;
        }

        return allowedPlants(user)
                .contains(plantCode.trim());
    }

    public String resolvePlantForWrite(
            User user,
            String requestedPlantCode
    ) {
        Set<String> allowed =
                allowedPlants(user);

        if (
                requestedPlantCode != null
                        && !requestedPlantCode.isBlank()
        ) {
            String clean =
                    requestedPlantCode.trim();

            if (!allowed.contains(clean)) {
                throw new AccessDeniedException(
                        "User does not have access to plant: " + clean
                );
            }

            return clean;
        }

        if (allowed.size() == 1) {
            return allowed.iterator().next();
        }

        throw new AccessDeniedException(
                "Plant selection required"
        );
    }

    public boolean canAccessWarehouse(User user) {
        return isAdmin(user)
                || isDispatch(user)
                || isWarehouse(user)
                || Boolean.TRUE.equals(user.isWarehouseAccess());
    }

    public boolean canViewAllWarehouseData(User user) {
        return isAdmin(user)
                || isDispatch(user);
    }
}