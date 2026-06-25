package com.alsorg.packing.domain.users;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

import java.util.LinkedHashSet;
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
    private String password;

    @Column(nullable = false)
    private String role;

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
                            columnNames = {"user_id", "plant_code"}
                    )
            }
    )
    @Column(name = "plant_code")
    private Set<String> plantCodes = new LinkedHashSet<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "user_module_access",
            joinColumns = @JoinColumn(name = "user_id"),
            uniqueConstraints = {
                    @UniqueConstraint(
                            name = "uk_user_module_access",
                            columnNames = {"user_id", "module_key"}
                    )
            }
    )
    @Column(name = "module_key")
    private Set<String> modules = new LinkedHashSet<>();

    private String packedAreaCode;

    private String fgAreaCode;

    private String allowedWarehouseCodes;

    private UUID driverId;

    @Column(name = "warehouse_access", nullable = false)
    private boolean warehouseAccess = false;

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username == null ? null : username.trim();
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role == null ? null : role.trim().toUpperCase();
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getPlantCode() {
        return plantCode;
    }

    public void setPlantCode(String plantCode) {
        this.plantCode = plantCode == null ? null : plantCode.trim();
    }

    public Set<String> getPlantCodes() {
        return plantCodes;
    }

    public void setPlantCodes(Set<String> plantCodes) {
        this.plantCodes = plantCodes == null
                ? new LinkedHashSet<>()
                : new LinkedHashSet<>(plantCodes);
    }

    public Set<String> getEffectivePlantCodes() {
        if (plantCodes != null && !plantCodes.isEmpty()) {
            return plantCodes;
        }

        Set<String> fallback = new LinkedHashSet<>();

        if (plantCode != null && !plantCode.isBlank()) {
            fallback.add(plantCode.trim());
        }

        return fallback;
    }

    public Set<String> getModules() {
        return modules;
    }

    public void setModules(Set<String> modules) {
        this.modules = modules == null
                ? new LinkedHashSet<>()
                : new LinkedHashSet<>(modules);
    }

    public Set<String> getEffectiveModules() {
        Set<String> effective = new LinkedHashSet<>();

        if (modules != null && !modules.isEmpty()) {
            effective.addAll(modules);
            return effective;
        }

        String r = role == null ? "" : role.trim().toUpperCase();

        if ("ADMIN".equals(r)) {
            effective.add("PACKFLOW");
            effective.add("BOMFLOW");
            effective.add("VENFLOW");
            return effective;
        }

        if (
                "PACKING".equals(r)
                        || "WAREHOUSE".equals(r)
                        || "DISPATCH".equals(r)
                        || "LOGISTICS".equals(r)
                        || "DRIVER".equals(r)
        ) {
            effective.add("PACKFLOW");
        }

        if (r.startsWith("BOMFLOW_")) {
            effective.add("BOMFLOW");
        }

        if (r.startsWith("VENFLOW_")) {
            effective.add("VENFLOW");
        }

        return effective;
    }

    public String getPackedAreaCode() {
        return packedAreaCode;
    }

    public void setPackedAreaCode(String packedAreaCode) {
        this.packedAreaCode = packedAreaCode;
    }

    public String getFgAreaCode() {
        return fgAreaCode;
    }

    public void setFgAreaCode(String fgAreaCode) {
        this.fgAreaCode = fgAreaCode;
    }

    public String getAllowedWarehouseCodes() {
        return allowedWarehouseCodes;
    }

    public void setAllowedWarehouseCodes(String allowedWarehouseCodes) {
        this.allowedWarehouseCodes = allowedWarehouseCodes;
    }

    public UUID getDriverId() {
        return driverId;
    }

    public void setDriverId(UUID driverId) {
        this.driverId = driverId;
    }

    public boolean isWarehouseAccess() {
        return warehouseAccess;
    }

    public void setWarehouseAccess(boolean warehouseAccess) {
        this.warehouseAccess = warehouseAccess;
    }
}