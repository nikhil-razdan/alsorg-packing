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
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Product / Item / Drawing under a MatFlowProject.
 *
 * Project/Product setup is approval-free. Legacy approval columns remain mapped
 * only so old database rows can be read safely; all newly created Products are
 * execution-eligible immediately.
 */
@Entity
@Table(name = "mf_project_drawings", uniqueConstraints = @UniqueConstraint(name = "uk_mf_project_drawing_revision", columnNames = {
                "plant_code", "project_code", "drawing_no", "drawing_revision" }), indexes = {
                                @Index(name = "idx_mf_project_plant_project", columnList = "plant_code, project_code"),
                                @Index(name = "idx_mf_project_drawing_lookup", columnList = "plant_code, project_code, drawing_no"),
                                @Index(name = "idx_mf_project_active", columnList = "active"),
                                @Index(name = "idx_mf_project_product_approval", columnList = "product_approval_status"),
                                @Index(name = "idx_mf_project_drawings_parent", columnList = "project_id")
                })
public class MatFlowProjectDrawing extends MatFlowBaseEntity {

        @ManyToOne(fetch = FetchType.LAZY)
        @JoinColumn(name = "project_id", nullable = false)
        private MatFlowProject project;

        /* Compatibility snapshots populated from the parent Project. */
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

        @Column(name = "plant_code", nullable = false, length = 50)
        private String plantCode;

        @Column(name = "required_date")
        private LocalDate requiredDate;

        @Column(name = "remarks", columnDefinition = "text")
        private String remarks;

        @Column(name = "active", nullable = false)
        private boolean active = true;

        /**
         * Historical compatibility only; active workflow has no Product approval gate.
         */
        @Enumerated(EnumType.STRING)
        @Column(name = "product_approval_status", nullable = false, length = 50)
        private ProjectProductApprovalStatus productApprovalStatus = ProjectProductApprovalStatus.APPROVED;

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

        public MatFlowProject getProject() {
                return project;
        }

        /** Sets the parent and synchronizes compatibility header snapshots. */
        public void setProject(MatFlowProject value) {
                this.project = value;
                if (value != null) {
                        setProjectCode(value.getProjectCode());
                        setProjectName(value.getProjectName());
                        setClientName(value.getClientName());
                        setPlantCode(value.getPlantCode());
                        if (this.requiredDate == null) {
                                this.requiredDate = value.getRequiredDate();
                        }
                }
        }

        public String getProjectCode() {
                return projectCode;
        }

        public void setProjectCode(String projectCode) {
                this.projectCode = cleanUpper(projectCode);
        }

        public String getProjectName() {
                return projectName;
        }

        public void setProjectName(String projectName) {
                this.projectName = clean(projectName);
        }

        public String getClientName() {
                return clientName;
        }

        public void setClientName(String clientName) {
                this.clientName = clean(clientName);
        }

        public String getDrawingNo() {
                return drawingNo;
        }

        public void setDrawingNo(String drawingNo) {
                this.drawingNo = cleanUpper(drawingNo);
        }

        public String getDrawingRevision() {
                return drawingRevision;
        }

        public void setDrawingRevision(String drawingRevision) {
                String value = cleanUpper(drawingRevision);
                this.drawingRevision = value == null ? "0" : value;
        }

        public String getProductName() {
                return productName;
        }

        public void setProductName(String productName) {
                this.productName = clean(productName);
        }

        public String getPlantCode() {
                return plantCode;
        }

        public void setPlantCode(String plantCode) {
                this.plantCode = cleanUpper(plantCode);
        }

        public LocalDate getRequiredDate() {
                return requiredDate;
        }

        public void setRequiredDate(LocalDate requiredDate) {
                this.requiredDate = requiredDate;
        }

        public String getRemarks() {
                return remarks;
        }

        public void setRemarks(String remarks) {
                this.remarks = clean(remarks);
        }

        public boolean isActive() {
                return active;
        }

        public void setActive(boolean active) {
                this.active = active;
        }

        public ProjectProductApprovalStatus getProductApprovalStatus() {
                return productApprovalStatus;
        }

        public void setProductApprovalStatus(ProjectProductApprovalStatus value) {
                this.productApprovalStatus = value == null
                                ? ProjectProductApprovalStatus.APPROVED
                                : value;
        }

        public String getProductApprovedBy() {
                return productApprovedBy;
        }

        public void setProductApprovedBy(String value) {
                this.productApprovedBy = clean(value);
        }

        public LocalDateTime getProductApprovedAt() {
                return productApprovedAt;
        }

        public void setProductApprovedAt(LocalDateTime value) {
                this.productApprovedAt = value;
        }

        public String getProductReturnedBy() {
                return productReturnedBy;
        }

        public void setProductReturnedBy(String value) {
                this.productReturnedBy = clean(value);
        }

        public LocalDateTime getProductReturnedAt() {
                return productReturnedAt;
        }

        public void setProductReturnedAt(LocalDateTime value) {
                this.productReturnedAt = value;
        }

        public String getProductApprovalRemarks() {
                return productApprovalRemarks;
        }

        public void setProductApprovalRemarks(String value) {
                this.productApprovalRemarks = clean(value);
        }
}
