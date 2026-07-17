package com.alsorg.packing.service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.UserRepository;

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

                        "VENFLOW_PRODUCTION",
                        "VENFLOW_STORE",
                        "VENFLOW_PURCHASE",
                        "VENFLOW_ENGINEERING",
                        "VENFLOW_SUPERVISOR",
                        "VENFLOW_MANAGER");

        private static final Set<String> ALLOWED_MODULES = Set.of(
                        "PACKFLOW",
                        "BOMFLOW",
                        "VENFLOW");

        private final UserRepository repo;
        private final PasswordEncoder encoder;

        public UserService(
                        UserRepository repo,
                        PasswordEncoder encoder) {
                this.repo = repo;
                this.encoder = encoder;
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

                if (repo.existsByUsernameIgnoreCase(cleanUsername)) {
                        throw new RuntimeException(
                                        "Username already exists: " + cleanUsername);
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
                                .orElseThrow(() -> new RuntimeException("User not found"));

                String cleanUsername = cleanRequired(
                                username,
                                "Username is required.");

                String cleanRole = normalizeRole(role);

                if (repo.existsByUsernameIgnoreCaseAndIdNot(
                                cleanUsername,
                                id)) {
                        throw new RuntimeException(
                                        "Username already exists: " + cleanUsername);
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
        public void disableUser(Long id) {
                User user = repo.findById(id)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                if ("ADMIN".equalsIgnoreCase(user.getRole())) {
                        long adminCount = repo.findAll()
                                        .stream()
                                        .filter(User::isEnabled)
                                        .filter(u -> "ADMIN".equalsIgnoreCase(
                                                        u.getRole()))
                                        .count();

                        if (adminCount <= 1) {
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
                                .orElseThrow(() -> new RuntimeException("User not found"));

                user.setPassword(
                                encoder.encode(cleanPassword));

                repo.save(user);
        }

        private void applyAccessFields(
                        User user,
                        String role,
                        Set<String> plantCodes,
                        UUID driverId,
                        boolean warehouseAccess,
                        Set<String> modules) {
                Set<String> cleanModules = cleanModules(
                                modules,
                                role);

                user.setModules(cleanModules);

                boolean finalWarehouseAccess;

                if ("ADMIN".equals(role)
                                || "WAREHOUSE".equals(role)) {

                        finalWarehouseAccess = true;

                } else if ("HARDWARE_PACKING".equals(role)
                                || "DRIVER".equals(role)) {

                        finalWarehouseAccess = false;

                } else {

                        finalWarehouseAccess = warehouseAccess;
                }

                user.setWarehouseAccess(finalWarehouseAccess);

                if ("DRIVER".equals(role)) {
                        if (driverId == null) {
                                throw new RuntimeException(
                                                "Driver profile required for DRIVER user");
                        }

                        user.setDriverId(driverId);
                        user.setPlantCodes(new LinkedHashSet<>());
                        user.setPlantCode(null);
                        return;
                }

                user.setDriverId(null);

                Set<String> cleanPlants = cleanPlantCodes(plantCodes);

                /*
                 * ADMIN can have no selected plant because ADMIN can access all.
                 * Non-driver, non-admin operational users should have explicit plant access.
                 */
                boolean plantRequired = !"ADMIN".equals(role)
                                && !role.startsWith("BOMFLOW_")
                                && !"VENFLOW_MANAGER".equals(role);

                if (plantRequired && cleanPlants.isEmpty()) {
                        throw new RuntimeException(
                                        "Plant access is required for this user");
                }

                user.setPlantCodes(cleanPlants);

                if (!cleanPlants.isEmpty()) {
                        user.setPlantCode(
                                        cleanPlants.iterator().next());
                } else {
                        user.setPlantCode(null);
                }
        }

        private Set<String> cleanPlantCodes(
                        Set<String> plantCodes) {
                Set<String> clean = new LinkedHashSet<>();

                if (plantCodes == null) {
                        return clean;
                }

                for (String code : plantCodes) {
                        if (code != null && !code.isBlank()) {
                                clean.add(
                                                code.trim().toUpperCase());
                        }
                }

                return clean;
        }

        private Set<String> cleanModules(
                        Set<String> modules,
                        String role) {
                Set<String> clean = new LinkedHashSet<>();

                if (modules != null) {
                        for (String module : modules) {
                                if (module == null || module.isBlank()) {
                                        continue;
                                }

                                String normalized = module.trim().toUpperCase();

                                if (!ALLOWED_MODULES.contains(normalized)) {
                                        throw new RuntimeException(
                                                        "Invalid module access: " + normalized);
                                }

                                clean.add(normalized);
                        }
                }

                if (clean.isEmpty()) {
                        clean.addAll(
                                        defaultModulesForRole(role));
                }

                /*
                 * Safety rule:
                 * Role must belong to at least its natural module.
                 */
                if (role.startsWith("BOMFLOW_")
                                && !clean.contains("BOMFLOW")) {
                        throw new RuntimeException(
                                        "BOMFlow role requires BOMFlow module access");
                }

                if (role.startsWith("VENFLOW_")
                                && !clean.contains("VENFLOW")) {
                        throw new RuntimeException(
                                        "VenFlow role requires VenFlow module access");
                }

                if (("PACKING".equals(role)
                                || "HARDWARE_PACKING".equals(role)
                                || "WAREHOUSE".equals(role)
                                || "DISPATCH".equals(role)
                                || "LOGISTICS".equals(role)
                                || "DRIVER".equals(role)) && !clean.contains("PACKFLOW")) {
                        throw new RuntimeException(
                                        "PackFlow role requires PackFlow module access");
                }

                return clean;
        }

        private Set<String> defaultModulesForRole(
                        String role) {
                Set<String> clean = new LinkedHashSet<>();

                if ("ADMIN".equals(role)) {
                        clean.add("PACKFLOW");
                        clean.add("BOMFLOW");
                        clean.add("VENFLOW");
                } else if ("PACKING".equals(role)
                                || "HARDWARE_PACKING".equals(role)
                                || "WAREHOUSE".equals(role)
                                || "DISPATCH".equals(role)
                                || "LOGISTICS".equals(role)
                                || "DRIVER".equals(role)) {
                        clean.add("PACKFLOW");
                } else if (role.startsWith("BOMFLOW_")) {
                        clean.add("BOMFLOW");
                } else if (role.startsWith("VENFLOW_")) {
                        clean.add("VENFLOW");
                }

                return clean;
        }

        private String normalizeRole(
                        String role) {
                String cleanRole = cleanRequired(
                                role,
                                "Role is required.").toUpperCase();

                if (!ALLOWED_ROLES.contains(cleanRole)) {
                        throw new RuntimeException(
                                        "Invalid role: " + cleanRole);
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
                if (value == null
                                || value.trim().isBlank()
                                || "null".equalsIgnoreCase(value.trim())) {
                        throw new RuntimeException(message);
                }

                return value.trim();
        }
}