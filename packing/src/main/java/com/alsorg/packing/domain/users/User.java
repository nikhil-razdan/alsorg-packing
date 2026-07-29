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
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(
            unique = true,
            nullable = false
    )
    private String username;

    @JsonIgnore
    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String role;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(name = "plant_code")
    private String plantCode;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "user_plant_access",
            joinColumns = @JoinColumn(name = "user_id"),
            uniqueConstraints = {
                    @UniqueConstraint(
                            name = "uk_user_plant_access",
                            columnNames = {
                                    "user_id",
                                    "plant_code"
                            }
                    )
            }
    )
    @Column(name = "plant_code")
    private Set<String> plantCodes =
            new LinkedHashSet<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "user_module_access",
            joinColumns = @JoinColumn(name = "user_id"),
            uniqueConstraints = {
                    @UniqueConstraint(
                            name = "uk_user_module_access",
                            columnNames = {
                                    "user_id",
                                    "module_key"
                            }
                    )
            }
    )
    @Column(name = "module_key")
    private Set<String> modules =
            new LinkedHashSet<>();

    private String packedAreaCode;

    private String fgAreaCode;

    private String allowedWarehouseCodes;

    private UUID driverId;

    @Column(
            name = "warehouse_access",
            nullable = false
    )
    private boolean warehouseAccess = false;

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(
            String username
    ) {
        this.username =
                cleanText(username);
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(
            String password
    ) {
        this.password = password;
    }

    public String getRole() {
        return role;
    }

    public void setRole(
            String role
    ) {
        this.role =
                normalizeUpper(role);
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(
            boolean enabled
    ) {
        this.enabled = enabled;
    }

    public String getPlantCode() {
        return plantCode;
    }

    public void setPlantCode(
            String plantCode
    ) {
        this.plantCode =
                normalizeUpper(plantCode);
    }

    public Set<String> getPlantCodes() {
        return plantCodes;
    }

    public void setPlantCodes(
            Set<String> plantCodes
    ) {
        this.plantCodes =
                normalizeValues(plantCodes);
    }

    public Set<String> getEffectivePlantCodes() {
        Set<String> effective =
                new LinkedHashSet<>();

        if (
                plantCodes != null &&
                !plantCodes.isEmpty()
        ) {
            effective.addAll(
                    normalizeValues(plantCodes)
            );

            return effective;
        }

        String fallback =
                normalizeUpper(plantCode);

        if (fallback != null) {
            effective.add(fallback);
        }

        return effective;
    }

    public Set<String> getModules() {
        return modules;
    }

    public void setModules(
            Set<String> modules
    ) {
        this.modules =
                normalizeValues(modules);
    }

    /**
     * Explicit module assignments are preferred.
     *
     * Role-based values are only a compatibility fallback for users
     * created before module assignments were introduced.
     */
    public Set<String> getEffectiveModules() {
        Set<String> effective =
                new LinkedHashSet<>();

        if (
                modules != null &&
                !modules.isEmpty()
        ) {
            effective.addAll(
                    normalizeValues(modules)
            );

            return effective;
        }

        String cleanRole =
                normalizeUpper(role);

        if (cleanRole == null) {
            return effective;
        }

        if ("ADMIN".equals(cleanRole)) {
            effective.add("PACKFLOW");
            effective.add("BOMFLOW");
            effective.add("MATFLOW");

            return effective;
        }

        if (
                "PACKING".equals(cleanRole) ||
                "HARDWARE_PACKING".equals(cleanRole) ||
                "WAREHOUSE".equals(cleanRole) ||
                "DISPATCH".equals(cleanRole) ||
                "LOGISTICS".equals(cleanRole) ||
                "DRIVER".equals(cleanRole)
        ) {
            effective.add("PACKFLOW");
        }

        if (cleanRole.startsWith("BOMFLOW_")) {
            effective.add("BOMFLOW");
        }

        if (cleanRole.startsWith("MATFLOW_")) {
            effective.add("MATFLOW");
        }

        return effective;
    }

    public String getPackedAreaCode() {
        return packedAreaCode;
    }

    public void setPackedAreaCode(
            String packedAreaCode
    ) {
        this.packedAreaCode =
                cleanText(packedAreaCode);
    }

    public String getFgAreaCode() {
        return fgAreaCode;
    }

    public void setFgAreaCode(
            String fgAreaCode
    ) {
        this.fgAreaCode =
                cleanText(fgAreaCode);
    }

    public String getAllowedWarehouseCodes() {
        return allowedWarehouseCodes;
    }

    public void setAllowedWarehouseCodes(
            String allowedWarehouseCodes
    ) {
        this.allowedWarehouseCodes =
                cleanText(allowedWarehouseCodes);
    }

    public UUID getDriverId() {
        return driverId;
    }

    public void setDriverId(
            UUID driverId
    ) {
        this.driverId = driverId;
    }

    public boolean isWarehouseAccess() {
        return warehouseAccess;
    }

    public void setWarehouseAccess(
            boolean warehouseAccess
    ) {
        this.warehouseAccess =
                warehouseAccess;
    }

    private static Set<String> normalizeValues(
            Set<String> values
    ) {
        Set<String> normalized =
                new LinkedHashSet<>();

        if (values == null) {
            return normalized;
        }

        for (String value : values) {
            String clean =
                    normalizeUpper(value);

            if (clean != null) {
                normalized.add(clean);
            }
        }

        return normalized;
    }

    private static String normalizeUpper(
            String value
    ) {
        String clean =
                cleanText(value);

        return clean == null
                ? null
                : clean.toUpperCase();
    }

    private static String cleanText(
            String value
    ) {
        if (value == null) {
            return null;
        }

        String clean =
                value.trim();

        if (
                clean.isBlank() ||
                "null".equalsIgnoreCase(clean) ||
                "undefined".equalsIgnoreCase(clean)
        ) {
            return null;
        }

        return clean;
    }
}