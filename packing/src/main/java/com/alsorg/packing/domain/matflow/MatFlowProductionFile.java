package com.alsorg.packing.domain.matflow;

import com.alsorg.packing.domain.matflow.MatFlowControlTypes.EngineeringDecision;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.ProductionFileStage;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.ReleaseHealth;
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
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Workflow/control row for one whole MatFlow PD / Project.
 *
 * productionFileNo is an internal immutable technical reference. The official
 * business PD No. is project.projectCode and may be null. product is nullable
 * by design: canonical/current Production Files are Project-level and therefore
 * have product == null. Old Product-level files can remain for historical audit.
 */
@Entity
@Table(
        name = "mf_production_files",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_mf_production_file_no",
                columnNames = "production_file_no"),
        indexes = {
                @Index(name = "idx_mf_pf_project", columnList = "project_id"),
                @Index(name = "idx_mf_pf_product", columnList = "product_id"),
                @Index(name = "idx_mf_pf_stage", columnList = "stage"),
                @Index(name = "idx_mf_pf_plant", columnList = "plant_code"),
                @Index(name = "idx_mf_pf_active", columnList = "active")
        })
public class MatFlowProductionFile extends MatFlowBaseEntity {

    @Column(name = "production_file_no", nullable = false, length = 140)
    private String productionFileNo;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private MatFlowProject project;

    /** Historical compatibility only. Canonical Project Production File = null. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private MatFlowProjectDrawing product;

    @Column(name = "project_code", length = 100)
    private String projectCode;

    @Column(name = "project_name", nullable = false, length = 250)
    private String projectName;

    @Column(name = "client_name", nullable = false, length = 250)
    private String clientName;

    /** Project-level display snapshot; normally the Project name. */
    @Column(name = "product_name", length = 250)
    private String productName;

    /** Canonical Project-level Production File has no single Drawing No. */
    @Column(name = "drawing_no", length = 150)
    private String drawingNo;

    @Column(name = "plant_code", nullable = false, length = 50)
    private String plantCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "stage", nullable = false, length = 60)
    private ProductionFileStage stage = ProductionFileStage.DESIGN_DRAFT;

    @Enumerated(EnumType.STRING)
    @Column(name = "release_health", nullable = false, length = 30)
    private ReleaseHealth releaseHealth = ReleaseHealth.RED;

    @Enumerated(EnumType.STRING)
    @Column(name = "engineering_decision", nullable = false, length = 40)
    private EngineeringDecision engineeringDecision = EngineeringDecision.PENDING;

    @Column(name = "current_department", length = 120)
    private String currentDepartment;

    @Column(name = "current_owner", length = 150)
    private String currentOwner;

    @Column(name = "designer", length = 150)
    private String designer;

    @Column(name = "design_head", length = 150)
    private String designHead;

    @Column(name = "design_head_decision", length = 30)
    private String designHeadDecision = "PENDING";

    @Column(name = "design_head_reviewed_by", length = 150)
    private String designHeadReviewedBy;

    @Column(name = "design_head_reviewed_at")
    private LocalDateTime designHeadReviewedAt;

    @Column(name = "design_head_remarks", columnDefinition = "text")
    private String designHeadRemarks;

    @Column(name = "design_submitted_by", length = 150)
    private String designSubmittedBy;

    @Column(name = "design_submitted_at")
    private LocalDateTime designSubmittedAt;

    @Column(name = "ppc_owner", length = 150)
    private String ppcOwner;

    @Column(name = "engineering_head", length = 150)
    private String engineeringHead;

    @Column(name = "assigned_engineer", length = 150)
    private String assignedEngineer;

    @Column(name = "controlled_release_reason", columnDefinition = "text")
    private String controlledReleaseReason;

    @Column(name = "planned_production_release_date")
    private LocalDate plannedProductionReleaseDate;

    @Column(name = "planned_dispatch_date")
    private LocalDate plannedDispatchDate;

    @Column(name = "ppc_gate_1_decision", length = 30)
    private String ppcGate1Decision;
    @Column(name = "ppc_gate_1_by", length = 150)
    private String ppcGate1By;
    @Column(name = "ppc_gate_1_at")
    private LocalDateTime ppcGate1At;
    @Column(name = "ppc_gate_1_remarks", columnDefinition = "text")
    private String ppcGate1Remarks;

    @Column(name = "engineering_decision_by", length = 150)
    private String engineeringDecisionBy;
    @Column(name = "engineering_decision_at")
    private LocalDateTime engineeringDecisionAt;
    @Column(name = "engineering_decision_remarks", columnDefinition = "text")
    private String engineeringDecisionRemarks;

    @Column(name = "ppc_gate_2_decision", length = 30)
    private String ppcGate2Decision;
    @Column(name = "ppc_gate_2_by", length = 150)
    private String ppcGate2By;
    @Column(name = "ppc_gate_2_at")
    private LocalDateTime ppcGate2At;
    @Column(name = "ppc_gate_2_remarks", columnDefinition = "text")
    private String ppcGate2Remarks;

    @Column(name = "revision_review_required", nullable = false)
    private boolean revisionReviewRequired = false;

    @Column(name = "downstream_workflow_key", length = 120)
    private String downstreamWorkflowKey;

    @Column(name = "downstream_workflow_status", length = 120)
    private String downstreamWorkflowStatus;

    @Column(name = "production_released_by", length = 150)
    private String productionReleasedBy;

    @Column(name = "production_released_at")
    private LocalDateTime productionReleasedAt;

    @Column(name = "remarks", columnDefinition = "text")
    private String remarks;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    public String getProductionFileNo() { return productionFileNo; }
    public void setProductionFileNo(String v) { productionFileNo = cleanUpper(v); }
    public MatFlowProject getProject() { return project; }
    public void setProject(MatFlowProject v) { project = v; }
    public MatFlowProjectDrawing getProduct() { return product; }
    public void setProduct(MatFlowProjectDrawing v) { product = v; }
    public String getProjectCode() { return projectCode; }
    public void setProjectCode(String v) { projectCode = cleanUpper(v); }
    public String getProjectName() { return projectName; }
    public void setProjectName(String v) { projectName = clean(v); }
    public String getClientName() { return clientName; }
    public void setClientName(String v) { clientName = clean(v); }
    public String getProductName() { return productName; }
    public void setProductName(String v) { productName = clean(v); }
    public String getDrawingNo() { return drawingNo; }
    public void setDrawingNo(String v) { drawingNo = cleanUpper(v); }
    public String getPlantCode() { return plantCode; }
    public void setPlantCode(String v) { plantCode = cleanUpper(v); }
    public ProductionFileStage getStage() { return stage; }
    public void setStage(ProductionFileStage v) { stage = v == null ? ProductionFileStage.DESIGN_DRAFT : v; }
    public ReleaseHealth getReleaseHealth() { return releaseHealth; }
    public void setReleaseHealth(ReleaseHealth v) { releaseHealth = v == null ? ReleaseHealth.RED : v; }
    public EngineeringDecision getEngineeringDecision() { return engineeringDecision; }
    public void setEngineeringDecision(EngineeringDecision v) { engineeringDecision = v == null ? EngineeringDecision.PENDING : v; }
    public String getCurrentDepartment() { return currentDepartment; }
    public void setCurrentDepartment(String v) { currentDepartment = clean(v); }
    public String getCurrentOwner() { return currentOwner; }
    public void setCurrentOwner(String v) { currentOwner = clean(v); }
    public String getDesigner() { return designer; }
    public void setDesigner(String v) { designer = clean(v); }
    public String getDesignHead() { return designHead; }
    public void setDesignHead(String v) { designHead = clean(v); }
    public String getDesignHeadDecision() { return designHeadDecision; }
    public void setDesignHeadDecision(String v) { designHeadDecision = cleanUpper(v); }
    public String getDesignHeadReviewedBy() { return designHeadReviewedBy; }
    public void setDesignHeadReviewedBy(String v) { designHeadReviewedBy = clean(v); }
    public LocalDateTime getDesignHeadReviewedAt() { return designHeadReviewedAt; }
    public void setDesignHeadReviewedAt(LocalDateTime v) { designHeadReviewedAt = v; }
    public String getDesignHeadRemarks() { return designHeadRemarks; }
    public void setDesignHeadRemarks(String v) { designHeadRemarks = clean(v); }
    public String getDesignSubmittedBy() { return designSubmittedBy; }
    public void setDesignSubmittedBy(String v) { designSubmittedBy = clean(v); }
    public LocalDateTime getDesignSubmittedAt() { return designSubmittedAt; }
    public void setDesignSubmittedAt(LocalDateTime v) { designSubmittedAt = v; }
    public String getPpcOwner() { return ppcOwner; }
    public void setPpcOwner(String v) { ppcOwner = clean(v); }
    public String getEngineeringHead() { return engineeringHead; }
    public void setEngineeringHead(String v) { engineeringHead = clean(v); }
    public String getAssignedEngineer() { return assignedEngineer; }
    public void setAssignedEngineer(String v) { assignedEngineer = clean(v); }
    public String getControlledReleaseReason() { return controlledReleaseReason; }
    public void setControlledReleaseReason(String v) { controlledReleaseReason = clean(v); }
    public LocalDate getPlannedProductionReleaseDate() { return plannedProductionReleaseDate; }
    public void setPlannedProductionReleaseDate(LocalDate v) { plannedProductionReleaseDate = v; }
    public LocalDate getPlannedDispatchDate() { return plannedDispatchDate; }
    public void setPlannedDispatchDate(LocalDate v) { plannedDispatchDate = v; }
    public String getPpcGate1Decision() { return ppcGate1Decision; }
    public void setPpcGate1Decision(String v) { ppcGate1Decision = cleanUpper(v); }
    public String getPpcGate1By() { return ppcGate1By; }
    public void setPpcGate1By(String v) { ppcGate1By = clean(v); }
    public LocalDateTime getPpcGate1At() { return ppcGate1At; }
    public void setPpcGate1At(LocalDateTime v) { ppcGate1At = v; }
    public String getPpcGate1Remarks() { return ppcGate1Remarks; }
    public void setPpcGate1Remarks(String v) { ppcGate1Remarks = clean(v); }
    public String getEngineeringDecisionBy() { return engineeringDecisionBy; }
    public void setEngineeringDecisionBy(String v) { engineeringDecisionBy = clean(v); }
    public LocalDateTime getEngineeringDecisionAt() { return engineeringDecisionAt; }
    public void setEngineeringDecisionAt(LocalDateTime v) { engineeringDecisionAt = v; }
    public String getEngineeringDecisionRemarks() { return engineeringDecisionRemarks; }
    public void setEngineeringDecisionRemarks(String v) { engineeringDecisionRemarks = clean(v); }
    public String getPpcGate2Decision() { return ppcGate2Decision; }
    public void setPpcGate2Decision(String v) { ppcGate2Decision = cleanUpper(v); }
    public String getPpcGate2By() { return ppcGate2By; }
    public void setPpcGate2By(String v) { ppcGate2By = clean(v); }
    public LocalDateTime getPpcGate2At() { return ppcGate2At; }
    public void setPpcGate2At(LocalDateTime v) { ppcGate2At = v; }
    public String getPpcGate2Remarks() { return ppcGate2Remarks; }
    public void setPpcGate2Remarks(String v) { ppcGate2Remarks = clean(v); }
    public boolean isRevisionReviewRequired() { return revisionReviewRequired; }
    public void setRevisionReviewRequired(boolean v) { revisionReviewRequired = v; }
    public String getDownstreamWorkflowKey() { return downstreamWorkflowKey; }
    public void setDownstreamWorkflowKey(String v) { downstreamWorkflowKey = clean(v); }
    public String getDownstreamWorkflowStatus() { return downstreamWorkflowStatus; }
    public void setDownstreamWorkflowStatus(String v) { downstreamWorkflowStatus = clean(v); }
    public String getProductionReleasedBy() { return productionReleasedBy; }
    public void setProductionReleasedBy(String v) { productionReleasedBy = clean(v); }
    public LocalDateTime getProductionReleasedAt() { return productionReleasedAt; }
    public void setProductionReleasedAt(LocalDateTime v) { productionReleasedAt = v; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String v) { remarks = clean(v); }
    public boolean isActive() { return active; }
    public void setActive(boolean v) { active = v; }

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
