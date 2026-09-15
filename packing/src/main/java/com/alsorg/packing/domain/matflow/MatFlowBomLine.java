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
@Table(name = "mf_control_bom_lines",
        uniqueConstraints = @UniqueConstraint(name = "uk_mf_control_bom_line_no", columnNames = {"bom_id", "line_no"}),
        indexes = {
                @Index(name = "idx_mf_control_bom_line_bom", columnList = "bom_id"),
                @Index(name = "idx_mf_control_bom_line_material", columnList = "material_id")
        })
public class MatFlowBomLine extends MatFlowBaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bom_id", nullable = false)
    private MatFlowBom bom;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "material_id")
    private MatFlowMaterial material;

    @Column(name = "line_no", nullable = false)
    private Integer lineNo;
    @Column(name = "material_code_snapshot", nullable = false, length = 100)
    private String materialCodeSnapshot;
    @Column(name = "material_name_snapshot", nullable = false, length = 250)
    private String materialNameSnapshot;
    @Column(name = "material_category_snapshot", nullable = false, length = 120)
    private String materialCategorySnapshot;
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

    public MatFlowBom getBom() { return bom; }
    public void setBom(MatFlowBom value) { bom = value; }
    public MatFlowMaterial getMaterial() { return material; }
    public void setMaterial(MatFlowMaterial value) { material = value; }
    public Integer getLineNo() { return lineNo; }
    public void setLineNo(Integer value) { lineNo = value; }
    public String getMaterialCodeSnapshot() { return materialCodeSnapshot; }
    public void setMaterialCodeSnapshot(String value) { materialCodeSnapshot = cleanUpper(value); }
    public String getMaterialNameSnapshot() { return materialNameSnapshot; }
    public void setMaterialNameSnapshot(String value) { materialNameSnapshot = clean(value); }
    public String getMaterialCategorySnapshot() { return materialCategorySnapshot; }
    public void setMaterialCategorySnapshot(String value) { materialCategorySnapshot = clean(value); }
    public String getSpecificationSnapshot() { return specificationSnapshot; }
    public void setSpecificationSnapshot(String value) { specificationSnapshot = clean(value); }
    public String getUomSnapshot() { return uomSnapshot; }
    public void setUomSnapshot(String value) { uomSnapshot = cleanUpper(value); }
    public BigDecimal getRequiredQty() { return requiredQty; }
    public void setRequiredQty(BigDecimal value) { requiredQty = value; }
    public BigDecimal getWastagePercent() { return wastagePercent; }
    public void setWastagePercent(BigDecimal value) { wastagePercent = value == null ? BigDecimal.ZERO : value; }
    public BigDecimal getNetRequiredQty() { return netRequiredQty; }
    public void setNetRequiredQty(BigDecimal value) { netRequiredQty = value; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String value) { remarks = clean(value); }
}
