package com.alsorg.packing.domain.matflow;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "mf_vendors", uniqueConstraints = {
        @UniqueConstraint(name = "uk_mf_vendor_code", columnNames = "vendor_code")
}, indexes = {
        @Index(name = "idx_mf_vendor_name", columnList = "vendor_name"),
        @Index(name = "idx_mf_vendor_active", columnList = "active")
})
public class MatFlowVendor extends MatFlowBaseEntity {

    @Column(name = "vendor_code", nullable = false, length = 100)
    public String vendorCode;

    @Column(name = "vendor_name", nullable = false, length = 250)
    public String vendorName;

    @Column(name = "gstin", length = 40)
    public String gstin;

    @Column(name = "contact_person", length = 200)
    public String contactPerson;

    @Column(name = "phone", length = 50)
    public String phone;

    @Column(name = "email", length = 250)
    public String email;

    @Column(name = "address", columnDefinition = "text")
    public String address;

    @Column(name = "active", nullable = false)
    public boolean active = true;
}
