package com.alsorg.packing.service;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.UserRepository;

import java.util.LinkedHashSet;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class VenFlowAccessService {

    private final UserRepository userRepository;

    public VenFlowAccessService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (auth == null
                || !auth.isAuthenticated()
                || auth instanceof AnonymousAuthenticationToken
                || auth.getName() == null
                || auth.getName().isBlank()
                || "anonymousUser".equalsIgnoreCase(auth.getName())) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "User not authenticated");
        }

        String username = auth.getName().trim();

        User user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "User not found: " + username));

        if (!user.isEnabled()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "User is disabled");
        }

        return user;
    }

    public String currentRole() {
        User user = currentUser();

        return user.getRole() == null
                ? ""
                : user.getRole().trim().toUpperCase();
    }

    public boolean isAdminOrManager() {
        String role = currentRole();

        return "ADMIN".equals(role)
                || "VENFLOW_MANAGER".equals(role);
    }

    public boolean isEngineering() {
        String role = currentRole();

        return isAdminOrManager()
                || "VENFLOW_ENGINEERING".equals(role);
    }

    public boolean isStore() {
        String role = currentRole();

        return isAdminOrManager()
                || "VENFLOW_STORE".equals(role);
    }

    public boolean isPurchase() {
        String role = currentRole();

        return isAdminOrManager()
                || "VENFLOW_PURCHASE".equals(role);
    }

    public boolean isProcessing() {
        String role = currentRole();

        return isAdminOrManager()
                || "VENFLOW_PRODUCTION".equals(role);
    }

    public boolean isProduction() {
        return isProcessing();
    }

    public boolean isSupervisor() {
        String role = currentRole();

        return isAdminOrManager()
                || "VENFLOW_SUPERVISOR".equals(role);
    }

    public Set<String> allowedPlantCodes() {
        User user = currentUser();

        Set<String> plants = new LinkedHashSet<>();

        if (user.getEffectivePlantCodes() != null) {
            for (String code : user.getEffectivePlantCodes()) {
                if (code != null && !code.isBlank()) {
                    plants.add(code.trim().toUpperCase());
                }
            }
        }

        return plants;
    }

    public void assertPlantAccess(String plantCode) {
        String cleanPlant = plantCode == null
                ? ""
                : plantCode.trim().toUpperCase();

        if (cleanPlant.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Plant code is required");
        }

        /*
         * ADMIN can access every plant.
         */
        if (isAdmin()) {
            return;
        }

        /*
         * VenFlow Manager can access all plants only if no plant restriction is
         * assigned.
         */
        if (isVenFlowManager()) {
            Set<String> allowed = allowedPlantCodes();

            if (allowed.isEmpty()) {
                return;
            }

            if (allowed.contains(cleanPlant)) {
                return;
            }

            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "No access for plant: " + cleanPlant);
        }

        Set<String> allowed = allowedPlantCodes();

        if (allowed.isEmpty() || !allowed.contains(cleanPlant)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "No access for plant: " + cleanPlant);
        }
    }

    public void requireEngineering() {
        if (!isEngineering()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Engineering access required");
        }
    }

    public void requireStore() {
        if (!isStore()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Store access required");
        }
    }

    public void requirePurchase() {
        if (!isPurchase()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Purchase access required");
        }
    }

    public void requireProcessing() {
        if (!isProcessing()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Processing/Production access required");
        }
    }

    public void requireProduction() {
        requireProcessing();
    }

    public void requireSupervisor() {
        if (!isSupervisor()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Supervisor access required");
        }
    }

    public void requireProcessingOrSupervisor() {
        if (!isProcessing() && !isSupervisor()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Processing/Supervisor access required");
        }
    }

    public void requireManagerApproval() {
        if (!isAdminOrManager()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Manager/Admin approval required");
        }
    }

    public boolean isAdmin() {
        return "ADMIN".equals(currentRole());
    }

    public boolean isVenFlowManager() {
        return "VENFLOW_MANAGER".equals(currentRole());
    }
}