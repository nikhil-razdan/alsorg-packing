package com.alsorg.packing.domain.matflow;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.math.BigDecimal;

@Entity
@Table(name = "mf_bom_lines", uniqueConstraints = {
        @UniqueConstraint(name = "uk_mf_bom_line_no", columnNames = {
                "bom_id",
                "line_no"
        })
}, indexes = {
        @Index(name = "idx_mf_bom_line_bom", columnList = "bom_id"),
        @Index(name = "idx_mf_bom_line_material", columnList = "material_id")
})
public class MatFlowBomLine
        extends MatFlowBaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bom_id", nullable = false)
    private MatFlowBom bom;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "material_id", nullable = false)
    private MatFlowMaterial material;

    @Column(name = "line_no", nullable = false)
    private Integer lineNo;

    @Column(name = "material_code_snapshot", nullable = false, length = 100)
    private String materialCodeSnapshot;

    @Column(name = "material_name_snapshot", nullable = false, length = 250)
    private String materialNameSnapshot;

    @Column(name = "specification_snapshot", columnDefinition = "text")
    private String specificationSnapshot;

    @Column(name = "uom_snapshot", nullable = false, length = 40)
    private String uomSnapshot;

    @Column(name = "required_qty", nullable = false, precision = 19, scale = 3)
    private BigDecimal requiredQty;

    @Column(name = "wastage_percent", nullable = false, precision = 8, scale = 3)
    private BigDecimal wastagePercent = BigDecimal.ZERO;

    @Column(name = "net_required_qty", nullable = false, precision = 19, scale = 3)
    private BigDecimal netRequiredQty;

    @Column(name = "remarks", columnDefinition = "text")
    private String remarks;

    public MatFlowBom getBom() {
        return bom;
    }

    public void setBom(MatFlowBom bom) {
        this.bom = bom;
    }

    public MatFlowMaterial getMaterial() {
        return material;
    }

    public void setMaterial(
            MatFlowMaterial material) {
        this.material = material;
    }

    public Integer getLineNo() {
        return lineNo;
    }

    public void setLineNo(Integer lineNo) {
        this.lineNo = lineNo;
    }

    public String getMaterialCodeSnapshot() {
        return materialCodeSnapshot;
    }

    public void setMaterialCodeSnapshot(
            String materialCodeSnapshot) {
        this.materialCodeSnapshot = cleanUpper(materialCodeSnapshot);
    }

    public String getMaterialNameSnapshot() {
        return materialNameSnapshot;
    }

    public void setMaterialNameSnapshot(
            String materialNameSnapshot) {
        this.materialNameSnapshot = clean(materialNameSnapshot);
    }

    public String getSpecificationSnapshot() {
        return specificationSnapshot;
    }

    public void setSpecificationSnapshot(
            String specificationSnapshot) {
        this.specificationSnapshot = clean(specificationSnapshot);
    }

    public String getUomSnapshot() {
        return uomSnapshot;
    }

    public void setUomSnapshot(
            String uomSnapshot) {
        this.uomSnapshot = cleanUpper(uomSnapshot);
    }

    public BigDecimal getRequiredQty() {
        return requiredQty;
    }

    public void setRequiredQty(
            BigDecimal requiredQty) {
        this.requiredQty = requiredQty;
    }

    public BigDecimal getWastagePercent() {
        return wastagePercent;
    }

    public void setWastagePercent(
            BigDecimal wastagePercent) {
        this.wastagePercent = wastagePercent == null
                ? BigDecimal.ZERO
                : wastagePercent;
    }

    public BigDecimal getNetRequiredQty() {
        return netRequiredQty;
    }

    public void setNetRequiredQty(
            BigDecimal netRequiredQty) {
        this.netRequiredQty = netRequiredQty;
    }

    public String getRemarks() {
        return remarks;
    }

    public void setRemarks(String remarks) {
        this.remarks = clean(remarks);
    }
}