package com.alsorg.packing.service.matflow;

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
public class MatFlowAccessService {

    private final UserRepository userRepo;

    public MatFlowAccessService(
            UserRepository userRepo) {

        this.userRepo = userRepo;
    }

    public User currentUser() {

        Authentication auth = SecurityContextHolder
                .getContext()
                .getAuthentication();

        if (auth == null
                || !auth.isAuthenticated()
                || auth instanceof AnonymousAuthenticationToken
                || auth.getName() == null
                || auth.getName().isBlank()
                || "anonymousUser".equalsIgnoreCase(
                        auth.getName())) {

            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "User not authenticated.");
        }

        User user = userRepo
                .findByUsernameIgnoreCase(
                        auth.getName().trim())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "User not found."));

        if (!user.isEnabled()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "User is disabled.");
        }

        return user;
    }

    public String currentUsername() {
        return currentUser()
                .getUsername();
    }

    public String currentRole() {

        String role = currentUser().getRole();

        return role == null
                ? ""
                : role.trim().toUpperCase();
    }

    /*
     * ADMIN and MATFLOW_MANAGER receive broad operational access.
     *
     * VENFLOW_MANAGER remains temporarily accepted during the
     * transition from VenFlow to MatFlow.
     */
    public boolean isAdminOrManager() {

        String role = currentRole();

        return "ADMIN".equals(role)
                || "MATFLOW_MANAGER".equals(role)
                || "VENFLOW_MANAGER".equals(role);
    }

    public boolean isProduction() {

        String role = currentRole();

        return isAdminOrManager()
                || "MATFLOW_PRODUCTION".equals(role)
                || "VENFLOW_PRODUCTION".equals(role);
    }

    public boolean isStore() {

        String role = currentRole();

        return isAdminOrManager()
                || "MATFLOW_STORE".equals(role)
                || "VENFLOW_STORE".equals(role);
    }

    public boolean isPurchase() {

        String role = currentRole();

        return isAdminOrManager()
                || "MATFLOW_PURCHASE".equals(role)
                || "VENFLOW_PURCHASE".equals(role);
    }

    public boolean isQc() {

        String role = currentRole();

        return isAdminOrManager()
                || "MATFLOW_QC".equals(role)
                || "VENFLOW_QC".equals(role)
                || "MATFLOW_STORE".equals(role)
                || "VENFLOW_STORE".equals(role);
    }

    public boolean isDirector() {

        String role = currentRole();

        return "ADMIN".equals(role)
                || "MATFLOW_DIRECTOR".equals(role)
                || "VENFLOW_DIRECTOR".equals(role);
    }

    public boolean hasMatFlowAccess() {

        String role = currentRole();

        return switch (role) {
            case "ADMIN",
                    "MATFLOW_MANAGER",
                    "MATFLOW_ENGINEERING",
                    "MATFLOW_PRODUCTION",
                    "MATFLOW_STORE",
                    "MATFLOW_PURCHASE",
                    "MATFLOW_QC",
                    "MATFLOW_DIRECTOR",
                    "MATFLOW_APPROVER",

                    /*
                     * Temporary compatibility aliases.
                     */
                    "VENFLOW_MANAGER",
                    "VENFLOW_ENGINEERING",
                    "VENFLOW_PRODUCTION",
                    "VENFLOW_STORE",
                    "VENFLOW_PURCHASE",
                    "VENFLOW_QC",
                    "VENFLOW_DIRECTOR" ->
                true;

            default -> false;
        };
    }

    public void requireMatFlowAccess() {

        if (!hasMatFlowAccess()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "MatFlow module access required.");
        }
    }

    public void requireProduction() {

        if (!isProduction()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "MatFlow Production access required.");
        }
    }

    public void requireStore() {

        if (!isStore()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "MatFlow Store access required.");
        }
    }

    public void requirePurchase() {

        if (!isPurchase()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "MatFlow Purchase access required.");
        }
    }

    public Set<String> allowedPlantCodes() {

        User user = currentUser();

        Set<String> plants = new LinkedHashSet<>();

        if (user.getEffectivePlantCodes() != null) {

            for (String code : user.getEffectivePlantCodes()) {

                if (code != null
                        && !code.isBlank()) {

                    plants.add(
                            code.trim().toUpperCase());
                }
            }
        }

        return plants;
    }

    public void assertPlantAccess(
            String plantCode) {

        String cleanPlant = plantCode == null
                ? ""
                : plantCode
                        .trim()
                        .toUpperCase();

        if (cleanPlant.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Plant code is required.");
        }

        if (isDirector()) {
            return;
        }

        Set<String> allowed = allowedPlantCodes();

        if (isAdminOrManager()
                && allowed.isEmpty()) {
            return;
        }

        if (!allowed.contains(cleanPlant)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "No access for plant: "
                            + cleanPlant);
        }
    }

    public boolean isPurchaseApprover() {

        String role = currentRole();

        return "ADMIN".equals(role)
                || "MATFLOW_MANAGER".equals(role)
                || "MATFLOW_APPROVER".equals(role)
                || "MATFLOW_DIRECTOR".equals(role)
                || "VENFLOW_DIRECTOR".equals(role);
    }

    public void requirePurchaseApprover() {

        if (!isPurchaseApprover()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "MatFlow Purchase approval access required.");
        }
    }
}