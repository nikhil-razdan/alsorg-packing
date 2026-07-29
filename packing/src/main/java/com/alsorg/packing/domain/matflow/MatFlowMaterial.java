package com.alsorg.packing.domain.matflow;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.math.BigDecimal;

@Entity
@Table(
        name = "mf_materials",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_mf_material_code",
                        columnNames = "material_code"
                )
        },
        indexes = {
                @Index(
                        name = "idx_mf_material_name",
                        columnList = "material_name"
                ),
                @Index(
                        name = "idx_mf_material_category",
                        columnList = "category"
                ),
                @Index(
                        name = "idx_mf_material_active",
                        columnList = "active"
                )
        }
)
public class MatFlowMaterial extends MatFlowBaseEntity {

    @Column(
            name = "material_code",
            nullable = false,
            length = 100
    )
    private String materialCode;

    @Column(
            name = "material_name",
            nullable = false,
            length = 250
    )
    private String materialName;

    @Column(
            name = "category",
            nullable = false,
            length = 120
    )
    private String category;

    @Column(
            name = "specification",
            columnDefinition = "text"
    )
    private String specification;

    @Column(
            name = "uom",
            nullable = false,
            length = 40
    )
    private String uom;

    @Column(
            name = "preferred_supplier",
            length = 250
    )
    private String preferredSupplier;

    @Column(
            name = "minimum_stock",
            nullable = false,
            precision = 19,
            scale = 3
    )
    private BigDecimal minimumStock =
            BigDecimal.ZERO;

    @Column(
            name = "reorder_level",
            nullable = false,
            precision = 19,
            scale = 3
    )
    private BigDecimal reorderLevel =
            BigDecimal.ZERO;

    @Column(
            name = "active",
            nullable = false
    )
    private boolean active = true;

    public String getMaterialCode() {
        return materialCode;
    }

    public void setMaterialCode(String materialCode) {
        this.materialCode =
                cleanUpper(materialCode);
    }

    public String getMaterialName() {
        return materialName;
    }

    public void setMaterialName(String materialName) {
        this.materialName =
                clean(materialName);
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category =
                clean(category);
    }

    public String getSpecification() {
        return specification;
    }

    public void setSpecification(String specification) {
        this.specification =
                clean(specification);
    }

    public String getUom() {
        return uom;
    }

    public void setUom(String uom) {
        this.uom =
                cleanUpper(uom);
    }

    public String getPreferredSupplier() {
        return preferredSupplier;
    }

    public void setPreferredSupplier(
            String preferredSupplier
    ) {
        this.preferredSupplier =
                clean(preferredSupplier);
    }

    public BigDecimal getMinimumStock() {
        return minimumStock;
    }

    public void setMinimumStock(
            BigDecimal minimumStock
    ) {
        this.minimumStock =
                minimumStock == null
                        ? BigDecimal.ZERO
                        : minimumStock;
    }

    public BigDecimal getReorderLevel() {
        return reorderLevel;
    }

    public void setReorderLevel(
            BigDecimal reorderLevel
    ) {
        this.reorderLevel =
                reorderLevel == null
                        ? BigDecimal.ZERO
                        : reorderLevel;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }
    
}