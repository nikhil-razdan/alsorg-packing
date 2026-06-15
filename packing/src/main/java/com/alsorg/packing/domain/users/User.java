package com.alsorg.packing.domain.users;

import jakarta.persistence.*;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String username;

    private String password;

    private String role;

    private boolean enabled = true;

    @Column(name = "plant_code")
    private String plantCode;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "user_plant_access",
            joinColumns = @JoinColumn(name = "user_id")
    )
    @Column(name = "plant_code")
    private Set<String> plantCodes = new LinkedHashSet<>();
    
    private String packedAreaCode;
    
    private String fgAreaCode;
    
    private String allowedWarehouseCodes;
    
    private UUID driverId;

    public UUID getDriverId() {
        return driverId;
    }

    public void setDriverId(java.util.UUID driverId) {
        this.driverId = driverId;
    }
    
    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
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
        this.role = role;
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
        this.plantCode = plantCode;
    }

    public Set<String> getPlantCodes() {
        return plantCodes;
    }

    public void setPlantCodes(Set<String> plantCodes) {
        this.plantCodes = plantCodes;
    }

    public Set<String> getEffectivePlantCodes() {
        if (plantCodes != null && !plantCodes.isEmpty()) {
            return plantCodes;
        }

        Set<String> fallback = new LinkedHashSet<>();

        if (plantCode != null && !plantCode.isBlank()) {
            fallback.add(plantCode);
        }

        return fallback;
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
}