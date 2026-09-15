package com.alsorg.packing.domain.matflow;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "mf_materials",
        uniqueConstraints = @UniqueConstraint(name = "uk_mf_material_code", columnNames = "material_code"),
        indexes = {
                @Index(name = "idx_mf_material_name", columnList = "material_name"),
                @Index(name = "idx_mf_material_category", columnList = "category"),
                @Index(name = "idx_mf_material_active", columnList = "active")
        })
public class MatFlowMaterial extends MatFlowBaseEntity {
    @Column(name = "material_code", nullable = false, length = 100)
    private String materialCode;
    @Column(name = "material_name", nullable = false, length = 250)
    private String materialName;
    @Column(name = "category", nullable = false, length = 120)
    private String category;
    @Column(name = "specification", columnDefinition = "text")
    private String specification;
    @Column(name = "uom", nullable = false, length = 40)
    private String uom;

    /* Retained for compatibility with the existing mf_materials table.
       The redesigned Designer/PPC/Engineering flow does not use inventory thresholds. */
    @Column(name = "preferred_supplier", length = 250)
    private String preferredSupplier;
    @Column(name = "minimum_stock", nullable = false, precision = 19, scale = 3)
    private java.math.BigDecimal minimumStock = java.math.BigDecimal.ZERO;
    @Column(name = "reorder_level", nullable = false, precision = 19, scale = 3)
    private java.math.BigDecimal reorderLevel = java.math.BigDecimal.ZERO;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    public String getMaterialCode() { return materialCode; }
    public void setMaterialCode(String value) { materialCode = cleanUpper(value); }
    public String getMaterialName() { return materialName; }
    public void setMaterialName(String value) { materialName = clean(value); }
    public String getCategory() { return category; }
    public void setCategory(String value) { category = clean(value); }
    public String getSpecification() { return specification; }
    public void setSpecification(String value) { specification = clean(value); }
    public String getUom() { return uom; }
    public void setUom(String value) { uom = cleanUpper(value); }
    public boolean isActive() { return active; }
    public void setActive(boolean value) { active = value; }
}
