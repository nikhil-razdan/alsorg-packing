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
                        "MATFLOW_DIRECTOR");

        private static final Set<String> ALLOWED_MODULES = Set.of(
                        "PACKFLOW",
                        "BOMFLOW",
                        "MATFLOW");

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
                        String role,
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

                String cleanRole = normalizeRole(role);

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
                user.setRole(cleanRole);
                user.setEnabled(true);

                applyAccessFields(
                                user,
                                cleanRole,
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
                        String role,
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

                String cleanRole = normalizeRole(role);

                if (repo.existsByUsernameIgnoreCaseAndIdNot(
                                cleanUsername,
                                id)) {
                        throw new RuntimeException(
                                        "Username already exists: " +
                                                        cleanUsername);
                }

                user.setUsername(cleanUsername);
                user.setRole(cleanRole);

                applyAccessFields(
                                user,
                                cleanRole,
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

                if ("ADMIN".equalsIgnoreCase(
                                user.getRole())) {
                        long activeAdminCount = repo.findAll()
                                        .stream()
                                        .filter(User::isEnabled)
                                        .filter(existing -> "ADMIN".equalsIgnoreCase(
                                                        existing.getRole()))
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
                        String role,
                        Set<String> plantCodes,
                        UUID driverId,
                        boolean requestedWarehouseAccess,
                        Set<String> modules) {
                Set<String> cleanModules = cleanModules(
                                modules,
                                role);

                user.setModules(cleanModules);

                boolean packFlowAssigned = cleanModules.contains("PACKFLOW");

                boolean finalWarehouseAccess;

                if ("ADMIN".equals(role) ||
                                "WAREHOUSE".equals(role)) {
                        finalWarehouseAccess = true;

                } else if ("HARDWARE_PACKING".equals(role) ||
                                "DRIVER".equals(role)) {
                        finalWarehouseAccess = false;

                } else {
                        /*
                         * Warehouse permission has no meaning for a user
                         * who does not have PackFlow access.
                         */
                        finalWarehouseAccess = packFlowAssigned &&
                                        requestedWarehouseAccess;
                }

                user.setWarehouseAccess(
                                finalWarehouseAccess);

                if ("DRIVER".equals(role)) {
                        if (driverId == null) {
                                throw new RuntimeException(
                                                "Driver profile required for DRIVER user");
                        }

                        user.setDriverId(driverId);
                        user.setPlantCodes(
                                        new LinkedHashSet<>());
                        user.setPlantCode(null);

                        return;
                }

                user.setDriverId(null);

                Set<String> cleanPlants = cleanPlantCodes(plantCodes);

                /*
                 * BOMFlow performs product costing and does not require
                 * operational plant ownership.
                 *
                 * Every non-admin PackFlow or MatFlow operational user
                 * requires explicit plant access.
                 */
                boolean plantRequired = !"ADMIN".equals(role) &&
                                !role.startsWith("BOMFLOW_");

                if (plantRequired &&
                                cleanPlants.isEmpty()) {
                        throw new RuntimeException(
                                        "Plant access is required for this user");
                }

                user.setPlantCodes(cleanPlants);

                if (cleanPlants.isEmpty()) {
                        user.setPlantCode(null);
                } else {
                        user.setPlantCode(
                                        cleanPlants
                                                        .iterator()
                                                        .next());
                }
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

                        String normalized = code.trim()
                                        .toUpperCase();

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
                        String role) {
                Set<String> clean = new LinkedHashSet<>();

                if (modules != null) {
                        for (String module : modules) {
                                if (module == null ||
                                                module.isBlank()) {
                                        continue;
                                }

                                String normalized = module.trim()
                                                .toUpperCase();

                                if (!ALLOWED_MODULES.contains(
                                                normalized)) {
                                        throw new RuntimeException(
                                                        "Invalid module access: " +
                                                                        normalized);
                                }

                                clean.add(normalized);
                        }
                }

                if (clean.isEmpty()) {
                        clean.addAll(
                                        defaultModulesForRole(role));
                }

                /*
                 * Every departmental role must retain access to its
                 * natural module.
                 */
                if (role.startsWith("BOMFLOW_") &&
                                !clean.contains("BOMFLOW")) {
                        throw new RuntimeException(
                                        "BOMFlow role requires BOMFlow module access");
                }

                if (role.startsWith("MATFLOW_") &&
                                !clean.contains("MATFLOW")) {
                        throw new RuntimeException(
                                        "MatFlow role requires MatFlow module access");
                }

                if (isPackFlowRole(role) &&
                                !clean.contains("PACKFLOW")) {
                        throw new RuntimeException(
                                        "PackFlow role requires PackFlow module access");
                }

                return clean;
        }

        private Set<String> defaultModulesForRole(
                        String role) {
                Set<String> modules = new LinkedHashSet<>();

                if ("ADMIN".equals(role)) {
                        modules.add("PACKFLOW");
                        modules.add("BOMFLOW");
                        modules.add("MATFLOW");

                } else if (isPackFlowRole(role)) {
                        modules.add("PACKFLOW");

                } else if (role.startsWith("BOMFLOW_")) {
                        modules.add("BOMFLOW");

                } else if (role.startsWith("MATFLOW_")) {
                        modules.add("MATFLOW");
                }

                return modules;
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
                                .toUpperCase();

                if (!ALLOWED_ROLES.contains(
                                cleanRole)) {
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
}