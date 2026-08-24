package com.alsorg.packing.service;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.UserRepository;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

        private static final Set<String> ALLOWED_ROLES = Set.of(
                        "ADMIN",

                        "PACKING",
                        "HARDWARE_PACKING",
                        "WAREHOUSE",
                        "DISPATCH",
                        "LOGISTICS",
                        "DRIVER",

                        "BOMFLOW_EDITOR",
                        "BOMFLOW_REVIEWER",
                        "BOMFLOW_APPROVER",
                        "BOMFLOW_MANAGER",

                        "MATFLOW_MANAGER",
                        "MATFLOW_ENGINEERING",
                        "MATFLOW_STORE",
                        "MATFLOW_PURCHASE",
                        "MATFLOW_PROCESSING",
                        "MATFLOW_PRODUCTION",
                        "MATFLOW_QC",
                        "MATFLOW_DIRECTOR",

                        /*
                         * Current AssetFlow roles.
                         * DIRECTOR = cross-department oversight/read-only.
                         * Machine and IT roles are intentionally separate.
                         */
                        "ASSETFLOW_DIRECTOR",
                        "ASSETFLOW_MACHINE_HEAD",
                        "ASSETFLOW_MACHINE_TECHNICIAN",
                        "ASSETFLOW_IT_HEAD",
                        "ASSETFLOW_IT_TECHNICIAN",
                        "ASSETFLOW_REQUESTER",

                        /*
                         * Legacy AssetFlow authorities are retained so existing
                         * accounts do not break during migration.
                         */
                        "ASSETFLOW_MANAGER",
                        "ASSETFLOW_PLANNER",
                        "ASSETFLOW_HEAD_TECHNICIAN",
                        "ASSETFLOW_TECHNICIAN");

        private static final Set<String> ALLOWED_MODULES = Set.of(
                        "PACKFLOW",
                        "BOMFLOW",
                        "MATFLOW",
                        "ASSETFLOW");

        private final UserRepository repo;
        private final PasswordEncoder encoder;
        private final PlantLocationService plantLocationService;

        public UserService(
                        UserRepository repo,
                        PasswordEncoder encoder,
                        PlantLocationService plantLocationService) {
                this.repo = repo;
                this.encoder = encoder;
                this.plantLocationService = plantLocationService;
        }

        @Transactional
        public User createUser(
                        String username,
                        String password,
                        String primaryRole,
                        Set<String> roles,
                        Set<String> plantCodes,
                        UUID driverId,
                        boolean warehouseAccess,
                        Set<String> modules) {
                String cleanUsername = cleanRequired(
                                username,
                                "Username is required.");

                String cleanPassword = cleanRequired(
                                password,
                                "Password is required.");

                validatePassword(cleanPassword);

                RoleAssignment roleAssignment = normalizeRoleAssignment(
                                primaryRole,
                                roles);

                if (repo.existsByUsernameIgnoreCase(
                                cleanUsername)) {
                        throw new RuntimeException(
                                        "Username already exists: " +
                                                        cleanUsername);
                }

                User user = new User();

                user.setUsername(cleanUsername);
                user.setPassword(
                                encoder.encode(cleanPassword));
                user.setRole(
                                roleAssignment.primaryRole());
                user.setRoles(
                                roleAssignment.roles());
                user.setEnabled(true);

                applyAccessFields(
                                user,
                                roleAssignment.roles(),
                                plantCodes,
                                driverId,
                                warehouseAccess,
                                modules);

                return repo.save(user);
        }

        public List<User> getAllUsers() {
                return repo.findAll(
                                Sort.by(
                                                Sort.Direction.ASC,
                                                "username"));
        }

        @Transactional
        public User updateUser(
                        Long id,
                        String username,
                        String primaryRole,
                        Set<String> roles,
                        Set<String> plantCodes,
                        UUID driverId,
                        boolean warehouseAccess,
                        Set<String> modules) {
                User user = repo.findById(id)
                                .orElseThrow(
                                                () -> new RuntimeException(
                                                                "User not found"));

                String cleanUsername = cleanRequired(
                                username,
                                "Username is required.");

                RoleAssignment roleAssignment = normalizeRoleAssignment(
                                primaryRole,
                                roles);

                if (repo.existsByUsernameIgnoreCaseAndIdNot(
                                cleanUsername,
                                id)) {
                        throw new RuntimeException(
                                        "Username already exists: " +
                                                        cleanUsername);
                }

                user.setUsername(cleanUsername);
                user.setRole(
                                roleAssignment.primaryRole());
                user.setRoles(
                                roleAssignment.roles());

                applyAccessFields(
                                user,
                                roleAssignment.roles(),
                                plantCodes,
                                driverId,
                                warehouseAccess,
                                modules);

                return repo.save(user);
        }

        @Transactional
        public void disableUser(
                        Long id) {
                User user = repo.findById(id)
                                .orElseThrow(
                                                () -> new RuntimeException(
                                                                "User not found"));

                if (hasRole(user, "ADMIN")) {
                        long activeAdminCount = repo.findAll()
                                        .stream()
                                        .filter(User::isEnabled)
                                        .filter(existing -> hasRole(
                                                        existing,
                                                        "ADMIN"))
                                        .count();

                        if (activeAdminCount <= 1) {
                                throw new RuntimeException(
                                                "Cannot disable the last active ADMIN user");
                        }
                }

                user.setEnabled(false);

                repo.save(user);
        }

        @Transactional
        public void resetPassword(
                        Long id,
                        String newPassword) {
                String cleanPassword = cleanRequired(
                                newPassword,
                                "Password cannot be empty");

                validatePassword(cleanPassword);

                User user = repo.findById(id)
                                .orElseThrow(
                                                () -> new RuntimeException(
                                                                "User not found"));

                user.setPassword(
                                encoder.encode(cleanPassword));

                repo.save(user);
        }

        private void applyAccessFields(
                        User user,
                        Set<String> roles,
                        Set<String> plantCodes,
                        UUID driverId,
                        boolean requestedWarehouseAccess,
                        Set<String> modules) {
                Set<String> cleanModules = cleanModules(
                                modules,
                                roles);

                /*
                 * ASSETFLOW_REQUESTER is a request-portal identity, not full
                 * operational AssetFlow access. Strip ASSETFLOW unless the same
                 * profile also carries a real AssetFlow operational role.
                 */
                if (!hasOperationalAssetFlowRole(roles)) {
                        cleanModules.remove("ASSETFLOW");
                }

                user.setModules(cleanModules);

                boolean packFlowAssigned = cleanModules.contains("PACKFLOW");

                boolean finalWarehouseAccess;

                /*
                 * ADMIN, WAREHOUSE and DISPATCH already receive warehouse
                 * access from the permission service.
                 */
                if (containsRole(roles, "ADMIN") ||
                                containsRole(roles, "WAREHOUSE") ||
                                containsRole(roles, "DISPATCH")) {
                        finalWarehouseAccess = true;
                } else if (!packFlowAssigned ||
                                (!containsRole(roles, "PACKING") &&
                                                !containsRole(roles, "LOGISTICS"))) {
                        finalWarehouseAccess = false;
                } else {
                        finalWarehouseAccess = requestedWarehouseAccess;
                }

                user.setWarehouseAccess(
                                finalWarehouseAccess);

                /*
                 * DRIVER may be assigned together with another PackFlow role.
                 * In that case driver profile and plant access may both apply.
                 */
                if (containsRole(roles, "DRIVER")) {
                        if (driverId == null) {
                                throw new RuntimeException(
                                                "Driver profile required when DRIVER role is assigned");
                        }

                        user.setDriverId(driverId);
                } else {
                        user.setDriverId(null);
                }

                Set<String> cleanPlants = cleanPlantCodes(plantCodes);

                boolean plantRequired = roles.stream()
                                .anyMatch(
                                                this::roleRequiresPlantAccess);

                if (plantRequired &&
                                cleanPlants.isEmpty()) {
                        throw new RuntimeException(
                                        "Plant access is required for the selected role combination");
                }

                user.setPlantCodes(cleanPlants);

                if (cleanPlants.isEmpty()) {
                        user.setPlantCode(null);
                } else {
                        user.setPlantCode(
                                        cleanPlants.iterator().next());
                }
        }

        private RoleAssignment normalizeRoleAssignment(
                        String primaryRole,
                        Set<String> requestedRoles) {
                String cleanPrimaryRole = normalizeRole(primaryRole);

                Set<String> cleanRoles = new LinkedHashSet<>();

                if (requestedRoles != null) {
                        for (String role : requestedRoles) {
                                if (role == null ||
                                                role.isBlank()) {
                                        continue;
                                }

                                cleanRoles.add(
                                                normalizeRole(role));
                        }
                }

                /*
                 * Backward compatibility for old frontend/API clients.
                 */
                if (cleanRoles.isEmpty()) {
                        cleanRoles.add(cleanPrimaryRole);
                }

                if (!cleanRoles.contains(cleanPrimaryRole)) {
                        throw new RuntimeException(
                                        "Primary role must be included in assigned roles");
                }

                /*
                 * ADMIN already means complete application access and therefore
                 * must remain an exclusive role.
                 */
                if (cleanRoles.contains("ADMIN") &&
                                cleanRoles.size() > 1) {
                        throw new RuntimeException(
                                        "ADMIN cannot be combined with another role");
                }

                /*
                 * Preserve the existing PackFlow multi-role behaviour, but allow exactly
                 * one AssetFlow role to be added to an existing user profile. This is
                 * important for real factory complainants: an Engineering/Store/Production
                 * user can also raise a machine complaint without creating a duplicate user.
                 *
                 * We deliberately do NOT open unrestricted cross-module role mixing.
                 * BOMFlow + MatFlow still cannot be combined, and a user may have only one
                 * AssetFlow role because Head/Technician/Requester already express the
                 * complete AssetFlow responsibility.
                 */
                if (!isAllowedRoleCombination(cleanRoles)) {
                        throw new RuntimeException(
                                        "Invalid role combination. PackFlow roles may be combined as before; one AssetFlow role may additionally be combined with PackFlow or one BOMFlow/MatFlow role.");
                }

                return new RoleAssignment(
                                cleanPrimaryRole,
                                cleanRoles);
        }

        private Set<String> cleanPlantCodes(
                        Set<String> plantCodes) {
                Set<String> clean = new LinkedHashSet<>();

                if (plantCodes == null) {
                        return clean;
                }

                for (String code : plantCodes) {
                        if (code == null ||
                                        code.isBlank()) {
                                continue;
                        }

                        String normalized = code.trim().toUpperCase();

                        if (!plantLocationService.isValidPlant(
                                        normalized)) {
                                throw new RuntimeException(
                                                "Invalid plant access: " +
                                                                normalized);
                        }

                        clean.add(normalized);
                }

                return clean;
        }

        private Set<String> cleanModules(
                        Set<String> modules,
                        Set<String> roles) {
                Set<String> clean = new LinkedHashSet<>();

                if (modules != null) {
                        for (String module : modules) {
                                if (module == null ||
                                                module.isBlank()) {
                                        continue;
                                }

                                String normalized = module.trim().toUpperCase();

                                if (!ALLOWED_MODULES.contains(
                                                normalized)) {
                                        throw new RuntimeException(
                                                        "Invalid module access: " +
                                                                        normalized);
                                }

                                clean.add(normalized);
                        }
                }

                Set<String> requiredModules = defaultModulesForRoles(roles);

                if (clean.isEmpty()) {
                        clean.addAll(requiredModules);
                }

                if (!clean.containsAll(requiredModules)) {
                        throw new RuntimeException(
                                        "Selected modules do not contain every module required by the assigned roles");
                }

                return clean;
        }

        private Set<String> defaultModulesForRoles(
                        Set<String> roles) {
                Set<String> modules = new LinkedHashSet<>();

                if (containsRole(roles, "ADMIN")) {
                        modules.add("PACKFLOW");
                        modules.add("BOMFLOW");
                        modules.add("MATFLOW");
                        modules.add("ASSETFLOW");

                        return modules;
                }

                for (String role : roles) {
                        if (isPackFlowRole(role)) {
                                modules.add("PACKFLOW");
                        }

                        if (role.startsWith("BOMFLOW_")) {
                                modules.add("BOMFLOW");
                        }

                        if (role.startsWith("MATFLOW_")) {
                                modules.add("MATFLOW");
                        }

                        if (role.startsWith("ASSETFLOW_")
                                        && !"ASSETFLOW_REQUESTER".equals(role)) {
                                /*
                                 * Request-only identities use the controlled
                                 * Maintenance Request portal, not the full
                                 * operational AssetFlow workspace.
                                 */
                                modules.add("ASSETFLOW");
                        }
                }

                return modules;
        }

        private boolean roleRequiresPlantAccess(
                        String role) {
                return !"ADMIN".equals(role) &&
                                !"DRIVER".equals(role) &&
                                !role.startsWith("BOMFLOW_");
        }

        private boolean containsRole(
                        Set<String> roles,
                        String requestedRole) {
                if (roles == null ||
                                requestedRole == null) {
                        return false;
                }

                return roles.stream()
                                .anyMatch(role -> requestedRole.equalsIgnoreCase(
                                                role));
        }

        private boolean hasRole(
                        User user,
                        String requestedRole) {
                return user != null &&
                                user.getEffectiveRoles()
                                                .stream()
                                                .anyMatch(role -> requestedRole.equalsIgnoreCase(
                                                                role));
        }


        private boolean hasOperationalAssetFlowRole(
                        Set<String> roles) {
                if (roles == null) {
                        return false;
                }

                if (containsRole(roles, "ADMIN")) {
                        return true;
                }

                return roles.stream()
                                .anyMatch(role -> role != null
                                                && role.startsWith("ASSETFLOW_")
                                                && !"ASSETFLOW_REQUESTER".equals(role));
        }

        private boolean isAllowedRoleCombination(
                        Set<String> roles) {
                if (roles == null || roles.size() <= 1) {
                        return true;
                }

                if (roles.stream().allMatch(this::isPackFlowRole)) {
                        return true;
                }

                long assetFlowCount = roles.stream()
                                .filter(role -> role != null && role.startsWith("ASSETFLOW_"))
                                .count();

                if (assetFlowCount != 1) {
                        return false;
                }

                Set<String> nonAssetFlowRoles = roles.stream()
                                .filter(role -> role != null && !role.startsWith("ASSETFLOW_"))
                                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));

                if (nonAssetFlowRoles.isEmpty()) {
                        return true;
                }

                if (nonAssetFlowRoles.stream().allMatch(this::isPackFlowRole)) {
                        return true;
                }

                return nonAssetFlowRoles.size() == 1
                                && (nonAssetFlowRoles.iterator().next().startsWith("BOMFLOW_")
                                                || nonAssetFlowRoles.iterator().next().startsWith("MATFLOW_"));
        }

        private boolean isPackFlowRole(
                        String role) {
                return "PACKING".equals(role) ||
                                "HARDWARE_PACKING".equals(role) ||
                                "WAREHOUSE".equals(role) ||
                                "DISPATCH".equals(role) ||
                                "LOGISTICS".equals(role) ||
                                "DRIVER".equals(role);
        }

        private String normalizeRole(
                        String role) {
                String cleanRole = cleanRequired(
                                role,
                                "Role is required.")
                                .replace("ROLE_", "")
                                .toUpperCase();

                if (!ALLOWED_ROLES.contains(cleanRole)) {
                        throw new RuntimeException(
                                        "Invalid role: " +
                                                        cleanRole);
                }

                return cleanRole;
        }

        private void validatePassword(
                        String password) {
                if (password.length() < 8) {
                        throw new RuntimeException(
                                        "Password must be at least 8 characters");
                }

                if (password.length() > 128) {
                        throw new RuntimeException(
                                        "Password is too long");
                }
        }

        private String cleanRequired(
                        String value,
                        String message) {
                if (value == null) {
                        throw new RuntimeException(message);
                }

                String clean = value.trim();

                if (clean.isBlank() ||
                                "null".equalsIgnoreCase(clean) ||
                                "undefined".equalsIgnoreCase(clean)) {
                        throw new RuntimeException(message);
                }

                return clean;
        }

        private record RoleAssignment(
                        String primaryRole,
                        Set<String> roles) {
        }
}