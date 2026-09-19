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

    /**
     * Department-scoped read gates keep the shared Production File architecture
     * without exposing irrelevant departmental work surfaces.
     */
    public void requireDesignRead() {
        requireAny("ADMIN", "MATFLOW_MANAGER", "MATFLOW_DIRECTOR",
                "MATFLOW_DESIGN_HEAD", "MATFLOW_DESIGNER", "MATFLOW_DESIGNER_JUNIOR");
    }

    public void requireEngineeringRead() {
        requireAny("ADMIN", "MATFLOW_MANAGER", "MATFLOW_DIRECTOR",
                "MATFLOW_ENGINEERING_HEAD", "MATFLOW_ENGINEERING", "MATFLOW_ENGINEERING_JUNIOR");
    }

    public void requirePpcRead() {
        requireAny("ADMIN", "MATFLOW_MANAGER", "MATFLOW_DIRECTOR", "MATFLOW_PPC", "MATFLOW_PRODUCTION");
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
        /*
         * Junior Designers are execution-only users. They work only on explicitly
         * assigned Design tasks and may participate in a directly related Issue Chat.
         * Checklist / reference / broader Design-file mutation remains with the
         * Designer / Design Head layer.
         */
        requireAny("ADMIN", "MATFLOW_MANAGER", "MATFLOW_DESIGN_HEAD", "MATFLOW_DESIGNER");
    }

    public void requireDesignHeadWrite() {
        requireAny("ADMIN", "MATFLOW_MANAGER", "MATFLOW_DESIGN_HEAD");
    }

    public void requireDesignTaskWrite() {
        requireAny("ADMIN", "MATFLOW_MANAGER", "MATFLOW_DESIGN_HEAD", "MATFLOW_DESIGNER", "MATFLOW_DESIGNER_JUNIOR");
    }

    /**
     * Project/PD Design execution. Ownership is checked by MatFlowDesignProjectService
     * after this role-level gate.
     */
    public void requireDesignProjectContributorWrite() {
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

    /**
     * Junior Engineers may create personal Engineering tasks. The workspace service
     * still enforces self-assignment and makes Junior-created tasks non-blocking;
     * Engineering Head / Engineer retain normal delegation authority.
     */
    public void requireEngineeringTaskCreate() {
        requireAny("ADMIN", "MATFLOW_MANAGER", "MATFLOW_ENGINEERING_HEAD", "MATFLOW_ENGINEERING", "MATFLOW_ENGINEERING_JUNIOR");
    }

    /**
     * Queries/issues are the controlled communication bridge between Design and
     * Engineering. Either department may raise/respond; department heads and
     * full contributors may close once the point is resolved.
     */
    public void requireSharedQueryWrite() {
        requireAny("ADMIN", "MATFLOW_MANAGER",
                "MATFLOW_DESIGN_HEAD", "MATFLOW_DESIGNER", "MATFLOW_DESIGNER_JUNIOR",
                "MATFLOW_ENGINEERING_HEAD", "MATFLOW_ENGINEERING", "MATFLOW_ENGINEERING_JUNIOR");
    }

    public void requireSharedQueryClose() {
        requireAny("ADMIN", "MATFLOW_MANAGER",
                "MATFLOW_DESIGN_HEAD", "MATFLOW_DESIGNER",
                "MATFLOW_ENGINEERING_HEAD", "MATFLOW_ENGINEERING");
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

    /**
     * Creating a Project / PD is also allowed for a Junior Designer. The service
     * automatically self-assigns a Junior-created Project so a Junior can never
     * create a PD on behalf of another Design user.
     */
    public void requireProjectCreate() {
        requireAny("ADMIN", "MATFLOW_MANAGER", "MATFLOW_DESIGN_HEAD", "MATFLOW_DESIGNER",
                "MATFLOW_DESIGNER_JUNIOR", "MATFLOW_ENGINEERING_HEAD", "MATFLOW_ENGINEERING");
    }

    /**
     * Parent Project / PD editing includes Junior Designers, but ownership and
     * Design-stage checks are enforced in MatFlowProjectService. Deactivation and
     * broader administrative Project mutations continue to use requireProjectWrite().
     */
    public void requireProjectEdit() {
        requireAny("ADMIN", "MATFLOW_MANAGER", "MATFLOW_DESIGN_HEAD", "MATFLOW_DESIGNER",
                "MATFLOW_DESIGNER_JUNIOR", "MATFLOW_ENGINEERING_HEAD", "MATFLOW_ENGINEERING");
    }

    /**
     * Product children are Design work/subtasks inside the Project Production File.
     * A Junior Designer may create/update Product children only for the PD actually
     * assigned to them; MatFlowProjectService enforces that ownership + Design-stage
     * boundary after this role-level gate. Parent Project/PD mutation remains under
     * requireProjectWrite().
     */
    public void requireProjectProductWrite() {
        requireAny("ADMIN", "MATFLOW_MANAGER", "MATFLOW_DESIGN_HEAD", "MATFLOW_DESIGNER",
                "MATFLOW_DESIGNER_JUNIOR", "MATFLOW_ENGINEERING_HEAD", "MATFLOW_ENGINEERING");
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

    /**
     * True only for a pure Junior Designer session. A user who also carries a
     * higher MatFlow Design / management authority keeps that higher authority.
     */
    public boolean isJuniorDesignerOnly() {
        return hasAnyRole("MATFLOW_DESIGNER_JUNIOR")
                && !hasAnyRole("ADMIN", "MATFLOW_MANAGER", "MATFLOW_DIRECTOR",
                        "MATFLOW_DESIGN_HEAD", "MATFLOW_DESIGNER");
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
