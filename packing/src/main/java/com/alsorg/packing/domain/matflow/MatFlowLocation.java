package com.alsorg.packing.domain.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.LocationType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.OwnershipType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "mf_locations", uniqueConstraints = {
        @UniqueConstraint(name = "uk_mf_location_code", columnNames = "location_code")
}, indexes = {
        @Index(name = "idx_mf_location_plant", columnList = "plant_code"),
        @Index(name = "idx_mf_location_type", columnList = "location_type"),
        @Index(name = "idx_mf_location_active", columnList = "active")
})
public class MatFlowLocation
        extends MatFlowBaseEntity {

    @Column(name = "location_code", nullable = false, length = 100)
    public String locationCode;

    @Column(name = "location_name", nullable = false, length = 250)
    public String locationName;

    /**
     * The plant that owns or is operationally responsible
     * for this location.
     *
     * External processors and suppliers must also be linked
     * to one servicing plant for access filtering.
     */
    @Column(name = "plant_code", nullable = false, length = 50)
    public String plantCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "location_type", nullable = false, length = 50)
    public LocationType locationType;

    @Enumerated(EnumType.STRING)
    @Column(name = "ownership_type", nullable = false, length = 30)
    public OwnershipType ownershipType = OwnershipType.INTERNAL;

    @Column(name = "supports_stock", nullable = false)
    public boolean supportsStock = true;

    @Column(name = "address", columnDefinition = "text")
    public String address;

    @Column(name = "contact_person", length = 200)
    public String contactPerson;

    @Column(name = "contact_phone", length = 50)
    public String contactPhone;

    @Column(name = "active", nullable = false)
    public boolean active = true;
}