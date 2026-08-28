package com.alsorg.packing.domain.users;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "users")
public class User {

        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        private Long id;

        @Column(unique = true, nullable = false)
        private String username;

        @JsonIgnore
        @Column(nullable = false)
        private String password;

        /**
         * Primary/legacy role.
         *
         * Keep this column because older code, JWT responses and existing
         * users may still depend on one primary role.
         */
        @Column(nullable = false)
        private String role;

        /**
         * Effective role assignments.
         *
         * Multiple role support is currently allowed for PackFlow roles.
         */
        @ElementCollection(fetch = FetchType.EAGER)
        @CollectionTable(name = "user_role_access", joinColumns = @JoinColumn(name = "user_id"), uniqueConstraints = {
                        @UniqueConstraint(name = "uk_user_role_access", columnNames = {
                                        "user_id",
                                        "role_key"
                        })
        })
        @Column(name = "role_key", nullable = false, length = 64)
        private Set<String> roles = new LinkedHashSet<>();

        @Column(nullable = false)
        private boolean enabled = true;

        @Column(name = "plant_code")
        private String plantCode;

        @ElementCollection(fetch = FetchType.EAGER)
        @CollectionTable(name = "user_plant_access", joinColumns = @JoinColumn(name = "user_id"), uniqueConstraints = {
                        @UniqueConstraint(name = "uk_user_plant_access", columnNames = {
                                        "user_id",
                                        "plant_code"
                        })
        })
        @Column(name = "plant_code")
        private Set<String> plantCodes = new LinkedHashSet<>();

        @ElementCollection(fetch = FetchType.EAGER)
        @CollectionTable(name = "user_module_access", joinColumns = @JoinColumn(name = "user_id"), uniqueConstraints = {
                        @UniqueConstraint(name = "uk_user_module_access", columnNames = {
                                        "user_id",
                                        "module_key"
                        })
        })
        @Column(name = "module_key")
        private Set<String> modules = new LinkedHashSet<>();

        private String packedAreaCode;

        private String fgAreaCode;

        private String allowedWarehouseCodes;

        private UUID driverId;

        @Column(name = "warehouse_access", nullable = false)
        private boolean warehouseAccess = false;

        /*
         * Increments whenever credentials or account access are changed.
         * JWTs carry the version that existed when they were issued.
         */
        @Column(name = "security_version", nullable = false)
        private long securityVersion = 0L;

        public Long getId() {
                return id;
        }

        public void setId(Long id) {
                this.id = id;
        }

        public String getUsername() {
                return username;
        }

        public void setUsername(
                        String username) {
                this.username = cleanText(username);
        }

        public String getPassword() {
                return password;
        }

        public void setPassword(
                        String password) {
                this.password = password;
        }

        public String getRole() {
                return role;
        }

        public void setRole(
                        String role) {
                this.role = normalizeUpper(role);
        }

        public Set<String> getRoles() {
                return roles;
        }

        public void setRoles(
                        Set<String> roles) {
                this.roles = normalizeValues(roles);
        }

        /**
         * Returns explicit roles where present.
         *
         * The old role column remains a fallback and is also merged in case
         * an old record has not yet been backfilled.
         */
        public Set<String> getEffectiveRoles() {
                Set<String> effective = new LinkedHashSet<>();

                if (roles != null) {
                        effective.addAll(
                                        normalizeValues(roles));
                }

                String primaryRole = normalizeUpper(role);

                if (primaryRole != null) {
                        effective.add(primaryRole);
                }

                return effective;
        }

        public boolean hasEffectiveRole(
                        String requestedRole) {
                String normalized = normalizeUpper(requestedRole);

                if (normalized == null) {
                        return false;
                }

                return getEffectiveRoles()
                                .stream()
                                .anyMatch(normalized::equalsIgnoreCase);
        }

        public boolean isEnabled() {
                return enabled;
        }

        public void setEnabled(
                        boolean enabled) {
                this.enabled = enabled;
        }

        public String getPlantCode() {
                return plantCode;
        }

        public void setPlantCode(
                        String plantCode) {
                this.plantCode = normalizeUpper(plantCode);
        }

        public Set<String> getPlantCodes() {
                return plantCodes;
        }

        public void setPlantCodes(
                        Set<String> plantCodes) {
                this.plantCodes = normalizeValues(plantCodes);
        }

        public Set<String> getEffectivePlantCodes() {
                Set<String> effective = new LinkedHashSet<>();

                if (plantCodes != null &&
                                !plantCodes.isEmpty()) {
                        effective.addAll(
                                        normalizeValues(plantCodes));

                        return effective;
                }

                String fallback = normalizeUpper(plantCode);

                if (fallback != null) {
                        effective.add(fallback);
                }

                return effective;
        }

        public Set<String> getModules() {
                return modules;
        }

        public void setModules(
                        Set<String> modules) {
                this.modules = normalizeValues(modules);
        }

        /**
         * Explicit module assignments are preferred.
         *
         * Effective roles are used as the compatibility fallback.
         */
        public Set<String> getEffectiveModules() {
                Set<String> effective = new LinkedHashSet<>();

                if (modules != null &&
                                !modules.isEmpty()) {
                        effective.addAll(
                                        normalizeValues(modules));

                        return effective;
                }

                for (String effectiveRole : getEffectiveRoles()) {
                        if ("ADMIN".equals(effectiveRole)) {
                                effective.add("PACKFLOW");
                                effective.add("BOMFLOW");
                                effective.add("MATFLOW");
                                effective.add("ASSETFLOW");

                                return effective;
                        }

                        if (isPackFlowRole(effectiveRole)) {
                                effective.add("PACKFLOW");
                        }

                        if (effectiveRole.startsWith("BOMFLOW_")) {
                                effective.add("BOMFLOW");
                        }

                        if (effectiveRole.startsWith("MATFLOW_")) {
                                effective.add("MATFLOW");
                        }

                        if (effectiveRole.startsWith("ASSETFLOW_")
                                        && !"ASSETFLOW_REQUESTER".equals(
                                                        effectiveRole)) {
                                effective.add("ASSETFLOW");
                        }
                }

                return effective;
        }

        public String getPackedAreaCode() {
                return packedAreaCode;
        }

        public void setPackedAreaCode(
                        String packedAreaCode) {
                this.packedAreaCode = cleanText(packedAreaCode);
        }

        public String getFgAreaCode() {
                return fgAreaCode;
        }

        public void setFgAreaCode(
                        String fgAreaCode) {
                this.fgAreaCode = cleanText(fgAreaCode);
        }

        public String getAllowedWarehouseCodes() {
                return allowedWarehouseCodes;
        }

        public void setAllowedWarehouseCodes(
                        String allowedWarehouseCodes) {
                this.allowedWarehouseCodes = cleanText(allowedWarehouseCodes);
        }

        public UUID getDriverId() {
                return driverId;
        }

        public void setDriverId(
                        UUID driverId) {
                this.driverId = driverId;
        }

        public boolean isWarehouseAccess() {
                return warehouseAccess;
        }

        public void setWarehouseAccess(
                        boolean warehouseAccess) {
                this.warehouseAccess = warehouseAccess;
        }

        public long getSecurityVersion() {
                return Math.max(
                                0L,
                                securityVersion);
        }

        public void setSecurityVersion(
                        long securityVersion) {
                this.securityVersion = Math.max(
                                0L,
                                securityVersion);
        }

        public void bumpSecurityVersion() {
                if (securityVersion == Long.MAX_VALUE) {
                        securityVersion = 1L;
                        return;
                }

                securityVersion = Math.max(
                                0L,
                                securityVersion) + 1L;
        }

        private static boolean isPackFlowRole(
                        String role) {
                return "PACKING".equals(role) ||
                                "HARDWARE_PACKING".equals(role) ||
                                "WAREHOUSE".equals(role) ||
                                "DISPATCH".equals(role) ||
                                "LOGISTICS".equals(role) ||
                                "DRIVER".equals(role);
        }

        private static Set<String> normalizeValues(
                        Set<String> values) {
                Set<String> normalized = new LinkedHashSet<>();

                if (values == null) {
                        return normalized;
                }

                for (String value : values) {
                        String clean = normalizeUpper(value);

                        if (clean != null) {
                                normalized.add(clean);
                        }
                }

                return normalized;
        }

        private static String normalizeUpper(
                        String value) {
                String clean = cleanText(value);

                return clean == null
                                ? null
                                : clean.toUpperCase(Locale.ROOT);
        }

        private static String cleanText(
                        String value) {
                if (value == null) {
                        return null;
                }

                String clean = value.trim();

                if (clean.isBlank() ||
                                "null".equalsIgnoreCase(clean) ||
                                "undefined".equalsIgnoreCase(clean)) {
                        return null;
                }

                return clean;
        }
}