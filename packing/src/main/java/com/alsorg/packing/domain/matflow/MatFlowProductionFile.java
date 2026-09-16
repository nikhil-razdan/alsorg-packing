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
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "mf_production_files",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_mf_production_file_no", columnNames = "production_file_no"),
                @UniqueConstraint(name = "uk_mf_production_file_product", columnNames = "product_id")
        },
        indexes = {
                @Index(name = "idx_mf_pf_project", columnList = "project_id"),
                @Index(name = "idx_mf_pf_stage", columnList = "stage"),
                @Index(name = "idx_mf_pf_health", columnList = "release_health"),
                @Index(name = "idx_mf_pf_owner", columnList = "current_owner"),
                @Index(name = "idx_mf_pf_pd", columnList = "project_code")
        })
public class MatFlowProductionFile extends MatFlowBaseEntity {

    @Column(name = "production_file_no", nullable = false, length = 180)
    private String productionFileNo;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private MatFlowProject project;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private MatFlowProjectDrawing product;

    @Column(name = "project_code", nullable = false, length = 100)
    private String projectCode;
    @Column(name = "project_name", nullable = false, length = 250)
    private String projectName;
    @Column(name = "client_name", nullable = false, length = 250)
    private String clientName;
    @Column(name = "product_name", nullable = false, length = 250)
    private String productName;
    @Column(name = "drawing_no", nullable = false, length = 150)
    private String drawingNo;
    @Column(name = "plant_code", nullable = false, length = 50)
    private String plantCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "stage", nullable = false, length = 50)
    private ProductionFileStage stage = ProductionFileStage.DESIGN_DRAFT;

    @Enumerated(EnumType.STRING)
    @Column(name = "release_health", nullable = false, length = 20)
    private ReleaseHealth releaseHealth = ReleaseHealth.RED;

    @Enumerated(EnumType.STRING)
    @Column(name = "engineering_decision", nullable = false, length = 30)
    private EngineeringDecision engineeringDecision = EngineeringDecision.PENDING;

    @Column(name = "current_department", nullable = false, length = 80)
    private String currentDepartment = "DESIGN";
    @Column(name = "current_owner", length = 150)
    private String currentOwner;

    /** Designer-1: upstream/client/project designer. */
    @Column(name = "designer", length = 150)
    private String designer;

    /** Design Department head who owns delegation and final design review. */
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

    @Column(name = "design_submitted_by", length = 150)
    private String designSubmittedBy;
    @Column(name = "design_submitted_at")
    private LocalDateTime designSubmittedAt;

    @Column(name = "ppc_gate1_decision", length = 30)
    private String ppcGate1Decision;
    @Column(name = "ppc_gate1_by", length = 150)
    private String ppcGate1By;
    @Column(name = "ppc_gate1_at")
    private LocalDateTime ppcGate1At;
    @Column(name = "ppc_gate1_remarks", columnDefinition = "text")
    private String ppcGate1Remarks;

    @Column(name = "engineering_decision_by", length = 150)
    private String engineeringDecisionBy;
    @Column(name = "engineering_decision_at")
    private LocalDateTime engineeringDecisionAt;
    @Column(name = "engineering_decision_remarks", columnDefinition = "text")
    private String engineeringDecisionRemarks;

    @Column(name = "ppc_gate2_decision", length = 30)
    private String ppcGate2Decision;
    @Column(name = "ppc_gate2_by", length = 150)
    private String ppcGate2By;
    @Column(name = "ppc_gate2_at")
    private LocalDateTime ppcGate2At;
    @Column(name = "ppc_gate2_remarks", columnDefinition = "text")
    private String ppcGate2Remarks;

    @Column(name = "production_released_by", length = 150)
    private String productionReleasedBy;
    @Column(name = "production_released_at")
    private LocalDateTime productionReleasedAt;

    /** Deliberate extension boundary. No production execution records are created in this build. */
    @Column(name = "downstream_workflow_key", length = 120)
    private String downstreamWorkflowKey;
    @Column(name = "downstream_workflow_status", length = 80)
    private String downstreamWorkflowStatus;

    @Column(name = "revision_review_required", nullable = false)
    private boolean revisionReviewRequired = false;
    @Column(name = "active", nullable = false)
    private boolean active = true;
    @Column(name = "remarks", columnDefinition = "text")
    private String remarks;

    public String getProductionFileNo() { return productionFileNo; }
    public void setProductionFileNo(String value) { productionFileNo = cleanUpper(value); }
    public MatFlowProject getProject() { return project; }
    public void setProject(MatFlowProject value) { project = value; }
    public MatFlowProjectDrawing getProduct() { return product; }
    public void setProduct(MatFlowProjectDrawing value) { product = value; }
    public String getProjectCode() { return projectCode; }
    public void setProjectCode(String value) { projectCode = cleanUpper(value); }
    public String getProjectName() { return projectName; }
    public void setProjectName(String value) { projectName = clean(value); }
    public String getClientName() { return clientName; }
    public void setClientName(String value) { clientName = clean(value); }
    public String getProductName() { return productName; }
    public void setProductName(String value) { productName = clean(value); }
    public String getDrawingNo() { return drawingNo; }
    public void setDrawingNo(String value) { drawingNo = cleanUpper(value); }
    public String getPlantCode() { return plantCode; }
    public void setPlantCode(String value) { plantCode = cleanUpper(value); }
    public ProductionFileStage getStage() { return stage; }
    public void setStage(ProductionFileStage value) { stage = value == null ? ProductionFileStage.DESIGN_DRAFT : value; }
    public ReleaseHealth getReleaseHealth() { return releaseHealth; }
    public void setReleaseHealth(ReleaseHealth value) { releaseHealth = value == null ? ReleaseHealth.RED : value; }
    public EngineeringDecision getEngineeringDecision() { return engineeringDecision; }
    public void setEngineeringDecision(EngineeringDecision value) { engineeringDecision = value == null ? EngineeringDecision.PENDING : value; }
    public String getCurrentDepartment() { return currentDepartment; }
    public void setCurrentDepartment(String value) { currentDepartment = cleanUpper(value); }
    public String getCurrentOwner() { return currentOwner; }
    public void setCurrentOwner(String value) { currentOwner = clean(value); }
    public String getDesigner() { return designer; }
    public void setDesigner(String value) { designer = clean(value); }
    public String getDesignHead() { return designHead; }
    public void setDesignHead(String value) { designHead = clean(value); }
    public String getDesignHeadDecision() { return designHeadDecision; }
    public void setDesignHeadDecision(String value) { String next = cleanUpper(value); designHeadDecision = next == null ? "PENDING" : next; }
    public String getDesignHeadReviewedBy() { return designHeadReviewedBy; }
    public void setDesignHeadReviewedBy(String value) { designHeadReviewedBy = clean(value); }
    public LocalDateTime getDesignHeadReviewedAt() { return designHeadReviewedAt; }
    public void setDesignHeadReviewedAt(LocalDateTime value) { designHeadReviewedAt = value; }
    public String getDesignHeadRemarks() { return designHeadRemarks; }
    public void setDesignHeadRemarks(String value) { designHeadRemarks = clean(value); }
    public String getPpcOwner() { return ppcOwner; }
    public void setPpcOwner(String value) { ppcOwner = clean(value); }
    public String getEngineeringHead() { return engineeringHead; }
    public void setEngineeringHead(String value) { engineeringHead = clean(value); }
    public String getAssignedEngineer() { return assignedEngineer; }
    public void setAssignedEngineer(String value) { assignedEngineer = clean(value); }
    public String getControlledReleaseReason() { return controlledReleaseReason; }
    public void setControlledReleaseReason(String value) { controlledReleaseReason = clean(value); }
    public LocalDate getPlannedProductionReleaseDate() { return plannedProductionReleaseDate; }
    public void setPlannedProductionReleaseDate(LocalDate value) { plannedProductionReleaseDate = value; }
    public LocalDate getPlannedDispatchDate() { return plannedDispatchDate; }
    public void setPlannedDispatchDate(LocalDate value) { plannedDispatchDate = value; }
    public String getDesignSubmittedBy() { return designSubmittedBy; }
    public void setDesignSubmittedBy(String value) { designSubmittedBy = clean(value); }
    public LocalDateTime getDesignSubmittedAt() { return designSubmittedAt; }
    public void setDesignSubmittedAt(LocalDateTime value) { designSubmittedAt = value; }
    public String getPpcGate1Decision() { return ppcGate1Decision; }
    public void setPpcGate1Decision(String value) { ppcGate1Decision = cleanUpper(value); }
    public String getPpcGate1By() { return ppcGate1By; }
    public void setPpcGate1By(String value) { ppcGate1By = clean(value); }
    public LocalDateTime getPpcGate1At() { return ppcGate1At; }
    public void setPpcGate1At(LocalDateTime value) { ppcGate1At = value; }
    public String getPpcGate1Remarks() { return ppcGate1Remarks; }
    public void setPpcGate1Remarks(String value) { ppcGate1Remarks = clean(value); }
    public String getEngineeringDecisionBy() { return engineeringDecisionBy; }
    public void setEngineeringDecisionBy(String value) { engineeringDecisionBy = clean(value); }
    public LocalDateTime getEngineeringDecisionAt() { return engineeringDecisionAt; }
    public void setEngineeringDecisionAt(LocalDateTime value) { engineeringDecisionAt = value; }
    public String getEngineeringDecisionRemarks() { return engineeringDecisionRemarks; }
    public void setEngineeringDecisionRemarks(String value) { engineeringDecisionRemarks = clean(value); }
    public String getPpcGate2Decision() { return ppcGate2Decision; }
    public void setPpcGate2Decision(String value) { ppcGate2Decision = cleanUpper(value); }
    public String getPpcGate2By() { return ppcGate2By; }
    public void setPpcGate2By(String value) { ppcGate2By = clean(value); }
    public LocalDateTime getPpcGate2At() { return ppcGate2At; }
    public void setPpcGate2At(LocalDateTime value) { ppcGate2At = value; }
    public String getPpcGate2Remarks() { return ppcGate2Remarks; }
    public void setPpcGate2Remarks(String value) { ppcGate2Remarks = clean(value); }
    public String getProductionReleasedBy() { return productionReleasedBy; }
    public void setProductionReleasedBy(String value) { productionReleasedBy = clean(value); }
    public LocalDateTime getProductionReleasedAt() { return productionReleasedAt; }
    public void setProductionReleasedAt(LocalDateTime value) { productionReleasedAt = value; }
    public String getDownstreamWorkflowKey() { return downstreamWorkflowKey; }
    public void setDownstreamWorkflowKey(String value) { downstreamWorkflowKey = cleanUpper(value); }
    public String getDownstreamWorkflowStatus() { return downstreamWorkflowStatus; }
    public void setDownstreamWorkflowStatus(String value) { downstreamWorkflowStatus = cleanUpper(value); }
    public boolean isRevisionReviewRequired() { return revisionReviewRequired; }
    public void setRevisionReviewRequired(boolean value) { revisionReviewRequired = value; }
    public boolean isActive() { return active; }
    public void setActive(boolean value) { active = value; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String value) { remarks = clean(value); }
}
