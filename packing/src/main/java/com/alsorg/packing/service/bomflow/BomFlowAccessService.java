package com.alsorg.packing.service.bomflow;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.UserRepository;

import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashSet;
import java.util.Set;

@Service
public class BomFlowAccessService {

    private final UserRepository userRepository;

    public BomFlowAccessService(
            UserRepository userRepository) {

        this.userRepository = userRepository;
    }

    public User currentUser() {
        Authentication authentication = SecurityContextHolder
                .getContext()
                .getAuthentication();

        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken
                || authentication.getName() == null
                || authentication.getName().isBlank()
                || "anonymousUser".equalsIgnoreCase(
                        authentication.getName())) {

            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "User not authenticated");
        }

        String username = authentication.getName().trim();

        User user = userRepository
                .findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "User not found: "
                                + username));

        if (!user.isEnabled()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "User is disabled");
        }

        return user;
    }

    public String currentUsername() {
        return currentUser()
                .getUsername();
    }

    public String currentRole() {
        String role = currentUser()
                .getRole();

        return role == null
                ? ""
                : role.trim().toUpperCase();
    }

    public boolean isAdmin() {
        return "ADMIN".equals(
                currentRole());
    }

    public boolean isManager() {
        String role = currentRole();

        return "ADMIN".equals(role)
                || "BOMFLOW_MANAGER".equals(role);
    }

    public boolean isEditor() {
        String role = currentRole();

        return isManager()
                || "BOMFLOW_EDITOR".equals(role);
    }

    public boolean isReviewer() {
        String role = currentRole();

        return isManager()
                || "BOMFLOW_REVIEWER".equals(role)
                || "BOMFLOW_APPROVER".equals(role);
    }

    public boolean isApprover() {
        String role = currentRole();

        return isManager()
                || "BOMFLOW_APPROVER".equals(role);
    }

    public boolean hasBomFlowAccess() {
        String role = currentRole();

        return switch (role) {
            case "ADMIN",
                    "BOMFLOW_MANAGER",
                    "BOMFLOW_EDITOR",
                    "BOMFLOW_REVIEWER",
                    "BOMFLOW_APPROVER" ->
                true;

            default -> false;
        };
    }

    public void requireBomFlowAccess() {
        if (!hasBomFlowAccess()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "BOMFlow module access required");
        }
    }

    public void requireEditor() {
        if (!isEditor()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "BOMFlow Editor access required");
        }
    }

    public void requireReviewer() {
        if (!isReviewer()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "BOMFlow Reviewer access required");
        }
    }

    public void requireApprover() {
        if (!isApprover()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "BOMFlow Approver access required");
        }
    }

    public boolean isReleaser() {
        /*
         * For now, the approved BOM may be released by:
         * - ADMIN
         * - BOMFLOW_MANAGER
         * - BOMFLOW_APPROVER
         *
         * isApprover() already includes those roles.
         */
        return isApprover();
    }

    public void requireReleaser() {
        if (!isReleaser()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "BOMFlow release access required");
        }
    }

    public Set<String> allowedPlantCodes() {
        User user = currentUser();

        Set<String> plants = new LinkedHashSet<>();

        if (user.getEffectivePlantCodes() != null) {

            for (String plant : user.getEffectivePlantCodes()) {

                if (plant != null
                        && !plant.isBlank()) {

                    plants.add(
                            plant.trim()
                                    .toUpperCase());
                }
            }
        }

        return plants;
    }

    public boolean canAccessAllPlants() {
        if (isAdmin()) {
            return true;
        }

        return "BOMFLOW_MANAGER"
                .equals(currentRole())
                && allowedPlantCodes()
                        .isEmpty();
    }

    public void assertPlantAccess(
            String plantCode) {

        String normalized = plantCode == null
                ? ""
                : plantCode.trim()
                        .toUpperCase();

        if (normalized.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Plant Code is required");
        }

        if (canAccessAllPlants()) {
            return;
        }

        Set<String> allowed = allowedPlantCodes();

        if (!allowed.contains(normalized)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "No BOMFlow access for plant: "
                            + normalized);
        }
    }
}