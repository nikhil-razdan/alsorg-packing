package com.alsorg.packing.service;

import java.util.Locale;
import java.util.Set;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.UserRepository;
import com.alsorg.packing.security.JwtUtil;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;

@Service
public class CurrentUserService {

    private final UserRepository userRepository;
    private final PlantLocationService plantLocationService;

    public CurrentUserService(
            UserRepository userRepository,
            PlantLocationService plantLocationService) {
        this.userRepository = userRepository;
        this.plantLocationService = plantLocationService;
    }

    /*
     * Preferred path: use the SecurityContext populated by
     * JwtAuthenticationFilter.
     */
    public User requireCurrentUser() {
        String username = usernameFromSecurityContext();

        if (username == null || username.isBlank()) {
            throw new AccessDeniedException("Authentication required");
        }

        return requireEnabledUser(username);
    }

    /*
     * Backward-compatible bridge for older controllers that still pass the
     * Authorization header explicitly.
     *
     * SECURITY: prefer SecurityContext first. A stale/invalid Authorization
     * header must not override an already-authenticated HttpOnly-cookie session.
     */
    public User getCurrentUserFromAuth(String auth) {
        String username = usernameFromSecurityContext();

        if (username != null && !username.isBlank()) {
            return requireEnabledUser(username);
        }

        User bearerUser = userFromBearerHeader(auth);

        if (bearerUser == null) {
            throw new AccessDeniedException("Authentication required");
        }

        return bearerUser;
    }

    private User requireEnabledUser(String username) {
        String cleanUsername = username == null ? "" : username.trim();

        User user = userRepository.findByUsernameIgnoreCase(cleanUsername)
                .orElseThrow(() -> new AccessDeniedException("User not found"));

        if (!user.isEnabled()) {
            throw new AccessDeniedException("User is disabled");
        }

        return user;
    }

    private User userFromBearerHeader(String auth) {
        if (auth == null
                || !auth.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return null;
        }

        String token = auth.substring(7).trim();

        if (token.isBlank()
                || "null".equalsIgnoreCase(token)
                || "undefined".equalsIgnoreCase(token)) {
            return null;
        }

        try {
            Claims claims = JwtUtil.getClaims(token);

            String username = claims.getSubject();

            if (username == null || username.isBlank()) {
                throw new AccessDeniedException("Invalid authentication token");
            }

            User user = requireEnabledUser(username);

            long tokenSecurityVersion = JwtUtil.getSecurityVersion(claims);

            if (tokenSecurityVersion != user.getSecurityVersion()) {
                throw new AccessDeniedException(
                        "Session is no longer valid. Please login again.");
            }

            return user;

        } catch (JwtException | IllegalArgumentException exception) {
            throw new AccessDeniedException("Invalid authentication token");
        }
    }

    private String usernameFromSecurityContext() {
        Authentication authentication = SecurityContextHolder
                .getContext()
                .getAuthentication();

        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication.getName() == null
                || authentication.getName().isBlank()
                || "anonymousUser".equals(authentication.getName())) {
            return null;
        }

        return authentication.getName();
    }

    public User requireAdminUser(
            String auth) {
        User user = getCurrentUserFromAuth(auth);

        if (!isAdmin(user)) {
            throw new AccessDeniedException(
                    "Only ADMIN can perform this action");
        }

        return user;
    }

    public boolean isAdmin(User user) {
        return hasRole(user, "ADMIN");
    }

    public boolean isPackFlowDirector(User user) {
        return hasRole(user, "PACKFLOW_DIRECTOR");
    }

    public boolean canViewPackFlowDashboard(User user) {
        return isAdmin(user) || isPackFlowDirector(user);
    }

    public User requirePackFlowDashboardUser() {
        User user = requireCurrentUser();

        if (!canViewPackFlowDashboard(user)) {
            throw new AccessDeniedException(
                    "PackFlow dashboard access requires ADMIN or PACKFLOW_DIRECTOR");
        }

        return user;
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
            String role) {

        if (user == null) {
            return false;
        }

        String normalizedRequestedRole = normalizeRoleKey(
                role);

        if (normalizedRequestedRole == null) {
            return false;
        }

        Set<String> effectiveRoles = user.getEffectiveRoles();

        if (effectiveRoles == null || effectiveRoles.isEmpty()) {
            return false;
        }

        return effectiveRoles
                .stream()
                .map(this::normalizeRoleKey)
                .filter(java.util.Objects::nonNull)
                .anyMatch(
                        normalizedRequestedRole::equals);
    }

    private String normalizeRoleKey(
            String value) {

        if (value == null) {
            return null;
        }

        String clean = value
                .trim()
                .replaceFirst(
                        "(?i)^ROLE_",
                        "")
                .toUpperCase(Locale.ROOT);

        if (clean.isBlank() ||
                "NULL".equals(clean) ||
                "UNDEFINED".equals(clean)) {
            return null;
        }

        return clean;
    }

    public boolean hasAnyRole(
            User user,
            String... roles) {
        if (user == null ||
                roles == null) {
            return false;
        }

        for (String role : roles) {
            if (hasRole(user, role)) {
                return true;
            }
        }

        return false;
    }

    public boolean hasModule(
            User user,
            String module) {

        if (user == null
                || module == null
                || module.isBlank()) {
            return false;
        }

        String normalizedModule = module.trim().toUpperCase(Locale.ROOT);

        return user.getEffectiveModules() != null
                && user.getEffectiveModules()
                        .stream()
                        .anyMatch(value -> value != null
                                && value.trim()
                                        .equalsIgnoreCase(
                                                normalizedModule));
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

        Set<String> plants = user.getEffectivePlantCodes();

        if (plants == null || plants.isEmpty()) {
            throw new AccessDeniedException(
                    "No plant access assigned");
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
            String plantCode) {

        if (plantCode == null
                || plantCode.isBlank()) {
            return false;
        }

        String normalizedPlantCode = plantCode.trim().toUpperCase(Locale.ROOT);

        return allowedPlants(user)
                .stream()
                .anyMatch(value -> value != null
                        && value.trim()
                                .equalsIgnoreCase(
                                        normalizedPlantCode));
    }

    public String resolvePlantForWrite(
            User user,
            String requestedPlantCode) {

        Set<String> allowed = allowedPlants(user);

        if (requestedPlantCode != null
                && !requestedPlantCode.isBlank()) {

            String clean = requestedPlantCode
                    .trim()
                    .toUpperCase(Locale.ROOT);

            boolean permitted = allowed.stream()
                    .anyMatch(value -> value != null
                            && value.trim()
                                    .equalsIgnoreCase(clean));

            if (!permitted) {
                throw new AccessDeniedException(
                        "User does not have access to plant: "
                                + clean);
            }

            return clean;
        }

        if (allowed.size() == 1) {
            return allowed.iterator().next();
        }

        throw new AccessDeniedException(
                "Plant selection required");
    }

    public boolean canAccessWarehouse(User user) {
        if (user == null) {
            return false;
        }

        return isAdmin(user)
                || isDispatch(user)
                || isWarehouse(user)
                || user.isWarehouseAccess();
    }

    public boolean canViewAllWarehouseData(User user) {
        return isAdmin(user)
                || isDispatch(user);
    }

    public boolean canGenerateWarehouseGatePass(User user) {
        return isAdmin(user) || isDispatch(user);
    }

    public boolean canApproveWarehouseMove(User user) {
        return user != null
                && (isAdmin(user)
                        || isWarehouse(user));
    }

    public boolean isHardwarePacking(
            User user) {
        return hasRole(
                user,
                "HARDWARE_PACKING");
    }

    public boolean isNormalPacking(
            User user) {
        return hasRole(
                user,
                "PACKING");
    }

    public boolean isHardwareOnlyPackingUser(
            User user) {
        return user != null
                && isHardwarePacking(user)
                && !isAdmin(user)
                && !hasAnyRole(
                        user,
                        "PACKING",
                        "WAREHOUSE",
                        "DISPATCH",
                        "LOGISTICS");
    }

    /*
     * Read-only hardware access.
     *
     * DISPATCH can see packets but cannot change them.
     */
    public boolean canReadHardwarePackets(
            User user) {
        return user != null
                && (isAdmin(user)
                        || isDispatch(user)
                        || isHardwarePacking(user));
    }

    /*
     * Hardware packet creation, update, deletion and
     * sticker generation.
     */
    public boolean canWriteHardwarePackets(
            User user) {
        return user != null
                && (isAdmin(user)
                        || isHardwarePacking(user));
    }

    public void requireHardwareReadAccess(
            User user) {
        if (canReadHardwarePackets(user)) {
            return;
        }

        throw new AccessDeniedException(
                "Hardware packet read access required");
    }

    public void requireHardwareWriteAccess(
            User user) {
        if (canWriteHardwarePackets(user)) {
            return;
        }

        throw new AccessDeniedException(
                "Hardware packet write access required");
    }

    /*
     * Keep for old code, but make it call the stricter
     * write-access method.
     */
    public void requireHardwarePackingOrAdmin(
            User user) {
        requireHardwareWriteAccess(user);
    }

    public void rejectHardwareUserFromNormalInventory(
            User user) {
        if (isHardwareOnlyPackingUser(user)) {
            throw new AccessDeniedException(
                    "Hardware-only packing users cannot access normal inventory");
        }
    }
}