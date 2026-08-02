package com.alsorg.packing.domain.matflow;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDate;

@Entity
@Table(
        name = "mf_project_drawings",

        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_mf_project_drawing_revision",
                        columnNames = {
                                "plant_code",
                                "project_code",
                                "drawing_no",
                                "drawing_revision"
                        }
                )
        },

        indexes = {
                /*
                 * Primary lookup for one logical Project / PD.
                 */
                @Index(
                        name = "idx_mf_project_plant_project",
                        columnList = "plant_code, project_code"
                ),

                /*
                 * Product/Drawing lookup within a project.
                 */
                @Index(
                        name = "idx_mf_project_drawing_lookup",
                        columnList = "plant_code, project_code, drawing_no"
                ),

                @Index(
                        name = "idx_mf_project_active",
                        columnList = "active"
                )
        }
)
public class MatFlowProjectDrawing
        extends MatFlowBaseEntity {

        @Column(name = "project_code", nullable = false, length = 100)
        private String projectCode;

        @Column(name = "project_name", nullable = false, length = 250)
        private String projectName;

        @Column(name = "client_name", length = 250)
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

        public void setDrawingRevision(
                        String drawingRevision) {
                String clean = cleanUpper(drawingRevision);

                this.drawingRevision = clean == null
                                ? "0"
                                : clean;
        }

        public String getProductName() {
                return productName;
        }

        public void setProductName(
                        String productName) {
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

        public void setRequiredDate(
                        LocalDate requiredDate) {
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
}