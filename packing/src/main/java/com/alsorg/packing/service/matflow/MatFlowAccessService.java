package com.alsorg.packing.service.matflow;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

/** MatFlow-only authorization. No PackFlow/BOMFlow security behavior is changed. */
@Service
public class MatFlowAccessService {
    private final CurrentUserService currentUserService;

    public MatFlowAccessService(CurrentUserService currentUserService) {
        this.currentUserService = currentUserService;
    }

    public User currentUser() {
        User user = currentUserService.requireCurrentUser();
        if (!isAdmin(user) && !currentUserService.hasModule(user, "MATFLOW")) {
            throw new AccessDeniedException("MatFlow module access required");
        }
        return user;
    }

    public String actor() { return currentUser().getUsername(); }

    public void requireRead() {
        User user = currentUser();
        if (isAdmin(user) || hasMatFlowRole(user)) return;
        throw new AccessDeniedException("MatFlow access required");
    }

    /*
     * MatFlow responsibility model.
     *
     * The workflow remains Designer -> PPC Gate 1 -> Engineering -> PPC Gate 2
     * -> PRODUCTION_RELEASED.  These authorities intentionally describe who may
     * mutate each control surface; screen visibility in React is only a UX gate.
     */
    public void requireSetupWrite() {
        requireAny("ADMIN", "MATFLOW_MANAGER", "MATFLOW_DESIGN_HEAD", "MATFLOW_PPC", "MATFLOW_ENGINEERING_HEAD");
    }

    public void requireDesignerWrite() {
        requireAny("ADMIN", "MATFLOW_MANAGER", "MATFLOW_DESIGN_HEAD", "MATFLOW_DESIGNER", "MATFLOW_DESIGNER_JUNIOR");
    }

    public void requireDesignHeadWrite() {
        requireAny("ADMIN", "MATFLOW_MANAGER", "MATFLOW_DESIGN_HEAD");
    }

    public void requireDesignTaskWrite() {
        requireAny("ADMIN", "MATFLOW_MANAGER", "MATFLOW_DESIGN_HEAD", "MATFLOW_DESIGNER", "MATFLOW_DESIGNER_JUNIOR");
    }

    public void requireEngineeringReviewWrite() {
        requireAny("ADMIN", "MATFLOW_MANAGER", "MATFLOW_ENGINEERING_HEAD", "MATFLOW_ENGINEERING");
    }

    public void requireEngineeringDecisionWrite() {
        requireAny("ADMIN", "MATFLOW_MANAGER", "MATFLOW_ENGINEERING_HEAD");
    }

    public void requireEngineeringTaskWrite() {
        requireAny("ADMIN", "MATFLOW_MANAGER", "MATFLOW_ENGINEERING_HEAD", "MATFLOW_ENGINEERING", "MATFLOW_ENGINEERING_JUNIOR");
    }

    /** Compatibility alias used by BOM/master services: authoring is Engineer-level, not Junior-level. */
    public void requireEngineeringWrite() {
        requireEngineeringReviewWrite();
    }

    public void requirePpcWrite() {
        requireAny("ADMIN", "MATFLOW_MANAGER", "MATFLOW_PPC");
    }

    public void requireProjectWrite() {
        requireAny("ADMIN", "MATFLOW_MANAGER", "MATFLOW_DESIGN_HEAD", "MATFLOW_DESIGNER", "MATFLOW_ENGINEERING_HEAD", "MATFLOW_ENGINEERING");
    }

    public void requireMasterWrite() {
        requireAny("ADMIN", "MATFLOW_MANAGER", "MATFLOW_ENGINEERING_HEAD", "MATFLOW_ENGINEERING");
    }

    public Set<String> allowedPlants() {
        User user = currentUser();
        if (isAdmin(user)) return normalizePlants(currentUserService.allowedPlants(user));
        LinkedHashSet<String> plants = new LinkedHashSet<>();
        if (user.getPlantCodes() != null) plants.addAll(normalizePlants(user.getPlantCodes()));
        String legacy = normalize(user.getPlantCode());
        if (!legacy.isBlank()) plants.add(legacy);
        if (plants.isEmpty()) throw new AccessDeniedException("No MatFlow plant access assigned");
        return java.util.Collections.unmodifiableSet(plants);
    }

    public void requirePlantAccess(String plantCode) {
        String plant = normalize(plantCode);
        if (plant.isBlank() || !allowedPlants().contains(plant)) {
            throw new AccessDeniedException("No MatFlow access to plant: " + (plant.isBlank() ? "UNKNOWN" : plant));
        }
    }

    public boolean canAccessPlant(String plantCode) {
        try { return allowedPlants().contains(normalize(plantCode)); }
        catch (AccessDeniedException ex) { return false; }
    }

    public boolean hasAnyRole(String... roles) {
        User user = currentUser();
        return currentUserService.hasAnyRole(user, roles);
    }

    private void requireAny(String... roles) {
        if (!currentUserService.hasAnyRole(currentUser(), roles)) {
            throw new AccessDeniedException("You do not have permission to perform this MatFlow action");
        }
    }

    private boolean isAdmin(User user) { return currentUserService.hasRole(user, "ADMIN"); }

    private boolean hasMatFlowRole(User user) {
        return user != null && user.getEffectiveRoles() != null && user.getEffectiveRoles().stream()
                .map(this::normalize).anyMatch(role -> role.startsWith("MATFLOW_"));
    }

    private Set<String> normalizePlants(Set<String> source) {
        if (source == null) return Set.of();
        LinkedHashSet<String> result = new LinkedHashSet<>();
        for (String value : source) {
            String clean = normalize(value);
            if (!clean.isBlank()) result.add(clean);
        }
        return result;
    }

    private String normalize(String value) {
        if (value == null) return "";
        return value.trim().replaceFirst("(?i)^ROLE_", "").toUpperCase(Locale.ROOT);
    }
}
