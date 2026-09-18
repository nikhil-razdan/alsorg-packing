package com.alsorg.packing.domain.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ProjectProductApprovalStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Product / Drawing child inside one PD / Project Production File.
 *
 * A Product is NOT a Production File. It carries product identity, dimensions,
 * drawing identity and optional image evidence. Workflow handoff remains owned
 * by the parent Project's single canonical MatFlowProductionFile.
 */
@Entity
@Table(
        name = "mf_project_drawings",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_mf_project_drawing_revision",
                columnNames = {"plant_code", "project_code", "drawing_no", "drawing_revision"}),
        indexes = {
                @Index(name = "idx_mf_project_plant_project", columnList = "plant_code, project_code"),
                @Index(name = "idx_mf_project_drawing_lookup", columnList = "plant_code, project_code, drawing_no"),
                @Index(name = "idx_mf_project_active", columnList = "active"),
                @Index(name = "idx_mf_project_product_approval", columnList = "product_approval_status"),
                @Index(name = "idx_mf_project_drawings_parent", columnList = "project_id")
        })
public class MatFlowProjectDrawing extends MatFlowBaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private MatFlowProject project;

    /* Compatibility snapshots retained for older material/BOM queries. */
    @Column(name = "project_code", length = 100)
    private String projectCode;

    @Column(name = "project_name", nullable = false, length = 250)
    private String projectName;

    @Column(name = "client_name", nullable = false, length = 250)
    private String clientName;

    /** Drawing No. may be assigned later during Engineering. */
    @Column(name = "drawing_no", length = 150)
    private String drawingNo;

    @Column(name = "drawing_revision", nullable = false, length = 40)
    private String drawingRevision = "0";

    @Column(name = "product_name", nullable = false, length = 250)
    private String productName;

    @Column(name = "product_type", length = 120)
    private String productType;

    @Column(name = "unit_quantity", nullable = false)
    private Integer unitQuantity = 1;

    @Column(name = "dimension_length", precision = 14, scale = 3)
    private BigDecimal dimensionLength;

    @Column(name = "dimension_breadth", precision = 14, scale = 3)
    private BigDecimal dimensionBreadth;

    @Column(name = "dimension_height", precision = 14, scale = 3)
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

    @Column(name = "product_image_file_name", length = 500)
    private String productImageFileName;

    @Column(name = "product_image_content_type", length = 150)
    private String productImageContentType;

    @Column(name = "product_image_storage_path", length = 2000)
    private String productImageStoragePath;

    /* Legacy approval columns retained to avoid breaking historical readers. */
    @Enumerated(EnumType.STRING)
    @Column(name = "product_approval_status", nullable = false, length = 50)
    private ProjectProductApprovalStatus productApprovalStatus = ProjectProductApprovalStatus.PENDING_DIRECTOR_APPROVAL;

    @Column(name = "product_approved_by", length = 150)
    private String productApprovedBy;

    @Column(name = "product_approved_at")
    private LocalDateTime productApprovedAt;

    @Column(name = "product_returned_by", length = 150)
    private String productReturnedBy;

    @Column(name = "product_returned_at")
    private LocalDateTime productReturnedAt;

    @Column(name = "product_approval_remarks", columnDefinition = "text")
    private String productApprovalRemarks;

    public MatFlowProject getProject() { return project; }
    public void setProject(MatFlowProject value) {
        this.project = value;
        if (value != null) {
            setProjectCode(value.getProjectCode());
            setProjectName(value.getProjectName());
            setClientName(value.getClientName());
            setPlantCode(value.getPlantCode());
            if (requiredDate == null) requiredDate = value.getRequiredDate();
        }
    }
    public String getProjectCode() { return projectCode; }
    public void setProjectCode(String value) { this.projectCode = cleanUpper(value); }
    public String getProjectName() { return projectName; }
    public void setProjectName(String value) { this.projectName = clean(value); }
    public String getClientName() { return clientName; }
    public void setClientName(String value) { this.clientName = clean(value); }
    public String getDrawingNo() { return drawingNo; }
    public void setDrawingNo(String value) { this.drawingNo = cleanUpper(value); }
    public String getDrawingRevision() { return drawingRevision; }
    public void setDrawingRevision(String value) {
        String next = cleanUpper(value);
        this.drawingRevision = next == null ? "0" : next;
    }
    public String getProductName() { return productName; }
    public void setProductName(String value) { this.productName = clean(value); }
    public String getProductType() { return productType; }
    public void setProductType(String value) { this.productType = clean(value); }
    public Integer getUnitQuantity() { return unitQuantity; }
    public void setUnitQuantity(Integer value) { this.unitQuantity = value == null || value < 1 ? 1 : value; }
    public BigDecimal getDimensionLength() { return dimensionLength; }
    public void setDimensionLength(BigDecimal value) { this.dimensionLength = nonNegative(value); }
    public BigDecimal getDimensionBreadth() { return dimensionBreadth; }
    public void setDimensionBreadth(BigDecimal value) { this.dimensionBreadth = nonNegative(value); }
    public BigDecimal getDimensionHeight() { return dimensionHeight; }
    public void setDimensionHeight(BigDecimal value) { this.dimensionHeight = nonNegative(value); }
    public String getDimensionUom() { return dimensionUom; }
    public void setDimensionUom(String value) {
        String next = cleanUpper(value);
        this.dimensionUom = next == null ? "MM" : next;
    }
    public String getPlantCode() { return plantCode; }
    public void setPlantCode(String value) { this.plantCode = cleanUpper(value); }
    public LocalDate getRequiredDate() { return requiredDate; }
    public void setRequiredDate(LocalDate value) { this.requiredDate = value; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String value) { this.remarks = clean(value); }
    public boolean isActive() { return active; }
    public void setActive(boolean value) { this.active = value; }
    public String getProductImageFileName() { return productImageFileName; }
    public void setProductImageFileName(String value) { this.productImageFileName = clean(value); }
    public String getProductImageContentType() { return productImageContentType; }
    public void setProductImageContentType(String value) { this.productImageContentType = clean(value); }
    public String getProductImageStoragePath() { return productImageStoragePath; }
    public void setProductImageStoragePath(String value) { this.productImageStoragePath = clean(value); }
    public ProjectProductApprovalStatus getProductApprovalStatus() { return productApprovalStatus; }
    public void setProductApprovalStatus(ProjectProductApprovalStatus value) {
        this.productApprovalStatus = value == null ? ProjectProductApprovalStatus.PENDING_DIRECTOR_APPROVAL : value;
    }
    public String getProductApprovedBy() { return productApprovedBy; }
    public void setProductApprovedBy(String value) { this.productApprovedBy = clean(value); }
    public LocalDateTime getProductApprovedAt() { return productApprovedAt; }
    public void setProductApprovedAt(LocalDateTime value) { this.productApprovedAt = value; }
    public String getProductReturnedBy() { return productReturnedBy; }
    public void setProductReturnedBy(String value) { this.productReturnedBy = clean(value); }
    public LocalDateTime getProductReturnedAt() { return productReturnedAt; }
    public void setProductReturnedAt(LocalDateTime value) { this.productReturnedAt = value; }
    public String getProductApprovalRemarks() { return productApprovalRemarks; }
    public void setProductApprovalRemarks(String value) { this.productApprovalRemarks = clean(value); }

    private static BigDecimal nonNegative(BigDecimal value) {
        if (value == null) return null;
        return value.signum() < 0 ? BigDecimal.ZERO : value;
    }
    private static String clean(String value) {
        if (value == null) return null;
        String next = value.trim();
        return next.isBlank() ? null : next;
    }
    private static String cleanUpper(String value) {
        String next = clean(value);
        return next == null ? null : next.toUpperCase(java.util.Locale.ROOT);
    }
}
