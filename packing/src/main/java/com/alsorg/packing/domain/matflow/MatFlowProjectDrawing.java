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
import java.time.LocalDate;

/**
 * Product / Drawing child under one PD / Project. The historical class/table
 * name is retained for migration compatibility, while drawing revisions are
 * now immutable MatFlowRevision records attached to the Production File.
 */
@Entity
@Table(name = "mf_project_drawings",
        uniqueConstraints = @UniqueConstraint(name = "uk_mf_project_drawing_revision", columnNames = {"plant_code", "project_code", "drawing_no", "drawing_revision"}),
        indexes = {
                @Index(name = "idx_mf_project_drawings_project", columnList = "project_id"),
                @Index(name = "idx_mf_project_drawings_lookup", columnList = "plant_code, project_code, drawing_no"),
                @Index(name = "idx_mf_project_drawings_active", columnList = "active")
        })
public class MatFlowProjectDrawing extends MatFlowBaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private MatFlowProject project;

    @Column(name = "project_code", nullable = false, length = 100)
    private String projectCode;

    @Column(name = "project_name", nullable = false, length = 250)
    private String projectName;

    @Column(name = "client_name", nullable = false, length = 250)
    private String clientName;

    @Column(name = "drawing_no", nullable = false, length = 150)
    private String drawingNo;

    @Column(name = "drawing_revision", nullable = false, length = 40)
    private String drawingRevision = "0";

    @Column(name = "product_name", nullable = false, length = 250)
    private String productName;

    @Column(name = "product_type", length = 120)
    private String productType;

    @Column(name = "unit_quantity")
    private Integer unitQuantity = 1;

    @Column(name = "dimension_length", precision = 19, scale = 3)
    private BigDecimal dimensionLength;

    @Column(name = "dimension_breadth", precision = 19, scale = 3)
    private BigDecimal dimensionBreadth;

    @Column(name = "dimension_height", precision = 19, scale = 3)
    private BigDecimal dimensionHeight;

    @Column(name = "dimension_uom", nullable = false, length = 20)
    private String dimensionUom = "MM";

    @Column(name = "plant_code", nullable = false, length = 50)
    private String plantCode;

    @Column(name = "required_date")
    private LocalDate requiredDate;

    @Column(name = "remarks", columnDefinition = "text")
    private String remarks;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    /* Existing MatFlow installations already have this NOT NULL column.
       The new workflow replaces the old product-approval desk, but keeps the
       compatibility value so new Product rows can coexist during migration. */
    @Column(name = "product_approval_status", nullable = false, length = 50)
    private String productApprovalStatusCompatibility = "APPROVED";

    @Column(name = "product_image_file_name", length = 255)
    private String productImageFileName;
    @Column(name = "product_image_content_type", length = 120)
    private String productImageContentType;
    @Column(name = "product_image_storage_path", length = 600)
    private String productImageStoragePath;

    public MatFlowProject getProject() { return project; }
    public void setProject(MatFlowProject value) {
        project = value;
        if (value != null) {
            setProjectCode(value.getProjectCode());
            setProjectName(value.getProjectName());
            setClientName(value.getClientName());
            setPlantCode(value.getPlantCode());
            if (requiredDate == null) requiredDate = value.getRequiredDate();
        }
    }
    public String getProjectCode() { return projectCode; }
    public void setProjectCode(String value) { projectCode = cleanUpper(value); }
    public String getProjectName() { return projectName; }
    public void setProjectName(String value) { projectName = clean(value); }
    public String getClientName() { return clientName; }
    public void setClientName(String value) { clientName = clean(value); }
    public String getDrawingNo() { return drawingNo; }
    public void setDrawingNo(String value) { drawingNo = cleanUpper(value); }
    public String getDrawingRevision() { return drawingRevision; }
    public void setDrawingRevision(String value) { String next = cleanUpper(value); drawingRevision = next == null ? "0" : next; }
    public String getProductName() { return productName; }
    public void setProductName(String value) { productName = clean(value); }
    public String getProductType() { return productType; }
    public void setProductType(String value) { productType = clean(value); }
    public Integer getUnitQuantity() { return unitQuantity; }
    public void setUnitQuantity(Integer value) { unitQuantity = value == null || value < 1 ? 1 : value; }
    public BigDecimal getDimensionLength() { return dimensionLength; }
    public void setDimensionLength(BigDecimal value) { dimensionLength = value; }
    public BigDecimal getDimensionBreadth() { return dimensionBreadth; }
    public void setDimensionBreadth(BigDecimal value) { dimensionBreadth = value; }
    public BigDecimal getDimensionHeight() { return dimensionHeight; }
    public void setDimensionHeight(BigDecimal value) { dimensionHeight = value; }
    public String getDimensionUom() { return dimensionUom; }
    public void setDimensionUom(String value) { String next = cleanUpper(value); dimensionUom = next == null ? "MM" : next; }
    public String getPlantCode() { return plantCode; }
    public void setPlantCode(String value) { plantCode = cleanUpper(value); }
    public LocalDate getRequiredDate() { return requiredDate; }
    public void setRequiredDate(LocalDate value) { requiredDate = value; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String value) { remarks = clean(value); }
    public boolean isActive() { return active; }
    public void setActive(boolean value) { active = value; }
    public String getProductImageFileName() { return productImageFileName; }
    public void setProductImageFileName(String value) { productImageFileName = clean(value); }
    public String getProductImageContentType() { return productImageContentType; }
    public void setProductImageContentType(String value) { productImageContentType = clean(value); }
    public String getProductImageStoragePath() { return productImageStoragePath; }
    public void setProductImageStoragePath(String value) { productImageStoragePath = clean(value); }
}
