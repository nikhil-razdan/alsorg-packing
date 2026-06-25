package com.alsorg.packing.service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.UserRepository;

@Service
public class UserService {

    private static final Set<String> ALLOWED_ROLES = Set.of(
            "ADMIN",
            "PACKING",
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
            "VENFLOW_MANAGER"
    );

    private static final Set<String> ALLOWED_MODULES = Set.of(
            "PACKFLOW",
            "BOMFLOW",
            "VENFLOW"
    );

    private final UserRepository repo;
    private final PasswordEncoder encoder;

    public UserService(UserRepository repo, PasswordEncoder encoder) {
        this.repo = repo;
        this.encoder = encoder;
    }

    public User createUser(
            String username,
            String password,
            String role,
            Set<String> plantCodes,
            UUID driverId,
            boolean warehouseAccess,
            Set<String> modules
    ) {
        String cleanUsername = cleanRequired(username, "Username is required.");
        String cleanPassword = cleanRequired(password, "Password is required.");
        String cleanRole = normalizeRole(role);

        if (repo.existsByUsername(cleanUsername)) {
            throw new RuntimeException("Username already exists: " + cleanUsername);
        }

        User user = new User();

        user.setUsername(cleanUsername);
        user.setPassword(encoder.encode(cleanPassword));
        user.setRole(cleanRole);

        applyAccessFields(user, cleanRole, plantCodes, driverId, warehouseAccess, modules);

        return repo.save(user);
    }

    public List<User> getAllUsers() {
        return repo.findAll(Sort.by(Sort.Direction.ASC, "username"));
    }

    public User updateUser(
            Long id,
            String username,
            String role,
            Set<String> plantCodes,
            UUID driverId,
            boolean warehouseAccess,
            Set<String> modules
    ) {
        Optional<User> optional = repo.findById(id);

        if (optional.isEmpty()) {
            throw new RuntimeException("User not found");
        }

        User user = optional.get();

        String cleanUsername = cleanRequired(username, "Username is required.");
        String cleanRole = normalizeRole(role);

        if (repo.existsByUsernameAndIdNot(cleanUsername, id)) {
            throw new RuntimeException("Username already exists: " + cleanUsername);
        }

        user.setUsername(cleanUsername);
        user.setRole(cleanRole);

        applyAccessFields(user, cleanRole, plantCodes, driverId, warehouseAccess, modules);

        return repo.save(user);
    }

    public void deleteUser(Long id) {
        if (!repo.existsById(id)) {
            throw new RuntimeException("User not found");
        }

        repo.deleteById(id);
    }

    private void applyAccessFields(
            User user,
            String role,
            Set<String> plantCodes,
            UUID driverId,
            boolean warehouseAccess,
            Set<String> modules
    ) {
        Set<String> cleanModules = cleanModules(modules, role);
        user.setModules(cleanModules);

        user.setWarehouseAccess(
                warehouseAccess
                        || "ADMIN".equalsIgnoreCase(role)
                        || "WAREHOUSE".equalsIgnoreCase(role)
        );

        if ("DRIVER".equalsIgnoreCase(role)) {
            if (driverId == null) {
                throw new RuntimeException("Driver profile required for DRIVER user");
            }

            user.setDriverId(driverId);
            user.setPlantCodes(new LinkedHashSet<>());
            user.setPlantCode(null);
            return;
        }

        user.setDriverId(null);

        Set<String> cleanPlants = cleanPlantCodes(plantCodes);

        user.setPlantCodes(cleanPlants);

        if (!cleanPlants.isEmpty()) {
            user.setPlantCode(cleanPlants.iterator().next());
        } else {
            user.setPlantCode(null);
        }
    }

    private Set<String> cleanPlantCodes(Set<String> plantCodes) {
        Set<String> clean = new LinkedHashSet<>();

        if (plantCodes == null) {
            return clean;
        }

        for (String code : plantCodes) {
            if (code != null && !code.isBlank()) {
                clean.add(code.trim());
            }
        }

        return clean;
    }

    private Set<String> cleanModules(Set<String> modules, String role) {
        Set<String> clean = new LinkedHashSet<>();

        if (modules != null) {
            for (String module : modules) {
                if (module == null || module.isBlank()) {
                    continue;
                }

                String normalized = module.trim().toUpperCase();

                if (!ALLOWED_MODULES.contains(normalized)) {
                    throw new RuntimeException("Invalid module access: " + normalized);
                }

                clean.add(normalized);
            }
        }

        if (clean.isEmpty()) {
            if ("ADMIN".equals(role)) {
                clean.add("PACKFLOW");
                clean.add("BOMFLOW");
                clean.add("VENFLOW");
            } else if (
                    "PACKING".equals(role)
                            || "WAREHOUSE".equals(role)
                            || "DISPATCH".equals(role)
                            || "LOGISTICS".equals(role)
                            || "DRIVER".equals(role)
            ) {
                clean.add("PACKFLOW");
            } else if (role.startsWith("BOMFLOW_")) {
                clean.add("BOMFLOW");
            } else if (role.startsWith("VENFLOW_")) {
                clean.add("VENFLOW");
            }
        }

        return clean;
    }

    private String normalizeRole(String role) {
        String cleanRole = cleanRequired(role, "Role is required.").toUpperCase();

        if (!ALLOWED_ROLES.contains(cleanRole)) {
            throw new RuntimeException("Invalid role: " + cleanRole);
        }

        return cleanRole;
    }

    private String cleanRequired(String value, String message) {
        if (value == null || value.trim().isBlank() || "null".equalsIgnoreCase(value.trim())) {
            throw new RuntimeException(message);
        }

        return value.trim();
    }
}