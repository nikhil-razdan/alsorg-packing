package com.alsorg.packing.service;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.DriverRepository;
import com.alsorg.packing.repository.UserRepository;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

        private static final int MIN_USERNAME_LENGTH = 3;
        private static final int MAX_USERNAME_LENGTH = 180;

        private static final Set<String> BLOCKED_PASSWORDS = Set.of(
                        "password",
                        "password1",
                        "password123",
                        "password1234",
                        "12345678",
                        "123456789",
                        "1234567890",
                        "123456789012345",
                        "87654321",
                        "qwerty12",
                        "qwerty123",
                        "qwertyui",
                        "qwertyuiop",
                        "qwertyuiopasdfgh",
                        "admin123",
                        "admin1234",
                        "adminadmin",
                        "adminadminadmin",
                        "administrator",
                        "letmein12",
                        "letmeinletmein",
                        "welcome1",
                        "welcome123",
                        "welcome123456789",
                        "1q2w3e4r",
                        "abcd1234",
                        "flowsuite",
                        "flowsuite123",
                        "flowsuite123456",
                        "alsorg123",
                        "alsorg123456789");

        private static final Set<String> ALLOWED_ROLES = Set.of(
                        "ADMIN",

                        "PACKFLOW_DIRECTOR",
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
        private final DriverRepository driverRepository;
        private final int minimumPasswordLength;

        public UserService(
                        UserRepository repo,
                        PasswordEncoder encoder,
                        PlantLocationService plantLocationService,
                        DriverRepository driverRepository,
                        @Value("${app.security.password.min-length:8}")
                        int minimumPasswordLength) {
                this.repo = repo;
                this.encoder = encoder;
                this.plantLocationService = plantLocationService;
                this.driverRepository = driverRepository;
                this.minimumPasswordLength = Math.max(
                                8,
                                Math.min(
                                                64,
                                                minimumPasswordLength));
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
                String cleanUsername = cleanUsername(
                                username);

                String cleanPassword = requirePassword(
                                password,
                                "Password is required.");

                validatePassword(
                                cleanPassword,
                                cleanUsername);

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
                user.setSecurityVersion(0L);

                applyAccessFields(
                                user,
                                roleAssignment.roles(),
                                plantCodes,
                                driverId,
                                warehouseAccess,
                                modules);

                return repo.save(user);
        }

        @Transactional(readOnly = true)
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

                boolean wasActiveAdmin =
                                user.isEnabled()
                                                && hasRole(
                                                                user,
                                                                "ADMIN");

                String cleanUsername = cleanUsername(
                                username);

                RoleAssignment roleAssignment = normalizeRoleAssignment(
                                primaryRole,
                                roles);

                if (wasActiveAdmin
                                && !containsRole(
                                                roleAssignment.roles(),
                                                "ADMIN")
                                && repo.countActiveAdmins() <= 1L) {

                        throw new RuntimeException(
                                        "Cannot remove ADMIN access from the last active ADMIN user");
                }

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

                user.bumpSecurityVersion();

                return repo.save(user);
        }

        @Transactional
        public void disableUser(
                        Long id) {
                User user = repo.findById(id)
                                .orElseThrow(
                                                () -> new RuntimeException(
                                                                "User not found"));

                if (hasRole(user, "ADMIN")
                                && user.isEnabled()
                                && repo.countActiveAdmins() <= 1L) {

                        throw new RuntimeException(
                                        "Cannot disable the last active ADMIN user");
                }

                user.setEnabled(false);
                user.bumpSecurityVersion();

                repo.save(user);
        }

        @Transactional
        public void resetPassword(
                        Long id,
                        String newPassword) {
                String cleanPassword = requirePassword(
                                newPassword,
                                "Password cannot be empty");

                User user = repo.findById(id)
                                .orElseThrow(
                                                () -> new RuntimeException(
                                                                "User not found"));

                validatePassword(
                                cleanPassword,
                                user.getUsername());

                if (encoder.matches(
                                cleanPassword,
                                user.getPassword())) {

                        throw new RuntimeException(
                                        "New password must be different from the current password");
                }

                user.setPassword(
                                encoder.encode(cleanPassword));

                user.bumpSecurityVersion();

                repo.save(user);
        }

        @Transactional
        public void revokeSessions(
                        Long id) {

                User user = repo.findById(id)
                                .orElseThrow(
                                                () -> new RuntimeException(
                                                                "User not found"));

                user.bumpSecurityVersion();

                repo.save(user);
        }

        private void applyAccessFields(
                        User user,
                        Set<String> roles,
                        Set<String> plantCodes,
                        UUID driverId,
                        boolean requestedWarehouseAccess,
                        Set<String> modules) {
                /*
                 * PACKFLOW_DIRECTOR is a dedicated least-privilege identity.
                 * Ignore any broader access fields submitted by an old/stale UI so
                 * the backend itself guarantees dashboard-only module access.
                 */
                if (containsRole(roles, "PACKFLOW_DIRECTOR")) {
                        user.setModules(new LinkedHashSet<>(Set.of("PACKFLOW")));
                        user.setWarehouseAccess(false);
                        user.setDriverId(null);
                        user.setPlantCodes(new LinkedHashSet<>());
                        user.setPlantCode(null);
                        return;
                }

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

                        if (!driverRepository.existsById(
                                        driverId)) {
                                throw new RuntimeException(
                                                "Selected driver profile does not exist");
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
                 * PACKFLOW_DIRECTOR is deliberately read-only/executive and must
                 * never inherit operational permissions through a second PackFlow role.
                 */
                if (cleanRoles.contains("PACKFLOW_DIRECTOR") &&
                                cleanRoles.size() > 1) {
                        throw new RuntimeException(
                                        "PACKFLOW_DIRECTOR cannot be combined with another role");
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
                                !"PACKFLOW_DIRECTOR".equals(role) &&
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
                return "PACKFLOW_DIRECTOR".equals(role) ||
                                "PACKING".equals(role) ||
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
                        String password,
                        String username) {

                if (password == null) {
                        throw new RuntimeException(
                                        "Password is required");
                }

                int codePointLength =
                                password.codePointCount(
                                                0,
                                                password.length());

                if (codePointLength < minimumPasswordLength) {
                        throw new RuntimeException(
                                        "Password must be at least "
                                                        + minimumPasswordLength
                                                        + " characters");
                }

                if (codePointLength > 128) {
                        throw new RuntimeException(
                                        "Password is too long");
                }

                String normalized =
                                password
                                                .toLowerCase(
                                                                Locale.ROOT)
                                                .trim();

                if (BLOCKED_PASSWORDS.contains(
                                normalized)) {
                        throw new RuntimeException(
                                        "Choose a less predictable password");
                }

                String cleanUsername =
                                username == null
                                                ? ""
                                                : username
                                                                .trim()
                                                                .toLowerCase(
                                                                                Locale.ROOT);

                if (cleanUsername.length() >= 4
                                && normalized.contains(
                                                cleanUsername)) {

                        throw new RuntimeException(
                                        "Password must not contain the username");
                }

                boolean allSame = password.codePoints()
                                .distinct()
                                .limit(2)
                                .count() <= 1;

                if (allSame) {
                        throw new RuntimeException(
                                        "Choose a less predictable password");
                }

                if (containsPredictableSequence(normalized)) {
                        throw new RuntimeException(
                                        "Password contains a predictable sequence");
                }

                /*
                 * Eight characters remains the minimum for compatibility with the
                 * factory's current user policy. Short passwords need stronger
                 * character diversity because they have substantially less raw
                 * entropy than a longer passphrase. Passwords of 12+ characters
                 * are allowed to be passphrases and do not get this composition
                 * requirement.
                 */
                if (codePointLength < 12
                                && passwordCharacterClassCount(password) < 3) {
                        throw new RuntimeException(
                                        "Passwords shorter than 12 characters must use at least three of: uppercase letters, lowercase letters, numbers, and symbols");
                }
        }

        private int passwordCharacterClassCount(
                        String password) {

                boolean lower = false;
                boolean upper = false;
                boolean digit = false;
                boolean symbol = false;

                for (int offset = 0; offset < password.length();) {
                        int codePoint = password.codePointAt(offset);

                        if (Character.isLowerCase(codePoint)) {
                                lower = true;
                        } else if (Character.isUpperCase(codePoint)) {
                                upper = true;
                        } else if (Character.isDigit(codePoint)) {
                                digit = true;
                        } else if (!Character.isWhitespace(codePoint)) {
                                symbol = true;
                        }

                        offset += Character.charCount(codePoint);
                }

                int count = 0;
                count += lower ? 1 : 0;
                count += upper ? 1 : 0;
                count += digit ? 1 : 0;
                count += symbol ? 1 : 0;

                return count;
        }

        private boolean containsPredictableSequence(
                        String normalizedPassword) {

                if (normalizedPassword == null
                                || normalizedPassword.isBlank()) {
                        return false;
                }

                String compact = normalizedPassword
                                .replaceAll("\\s+", "");

                return compact.contains("12345678")
                                || compact.contains("87654321")
                                || compact.contains("abcdefgh")
                                || compact.contains("hgfedcba")
                                || compact.contains("qwertyui")
                                || compact.contains("asdfghjk")
                                || compact.contains("zxcvbnm")
                                || compact.contains("1q2w3e4r");
        }

        private String requirePassword(
                        String value,
                        String message) {

                if (value == null
                                || value.isBlank()) {
                        throw new RuntimeException(
                                        message);
                }

                /*
                 * Do not trim passwords. Leading/trailing spaces are valid
                 * password characters and must hash exactly as entered.
                 */
                return value;
        }


        private String cleanUsername(
                        String value) {

                String clean = cleanRequired(
                                value,
                                "Username is required.");

                int length = clean.codePointCount(
                                0,
                                clean.length());

                if (length < MIN_USERNAME_LENGTH
                                || length > MAX_USERNAME_LENGTH) {

                        throw new RuntimeException(
                                        "Username must be between "
                                                        + MIN_USERNAME_LENGTH
                                                        + " and "
                                                        + MAX_USERNAME_LENGTH
                                                        + " characters");
                }

                boolean hasControlCharacter =
                                clean.codePoints()
                                                .anyMatch(
                                                                Character::isISOControl);

                if (hasControlCharacter) {
                        throw new RuntimeException(
                                        "Username contains invalid characters");
                }

                return clean;
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