package com.alsorg.packing.domain.bomflow;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "bom_flow_boms",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_bom_flow_bom_no",
                        columnNames = "bom_no")
        },
        indexes = {
                @Index(
                        name = "idx_bom_flow_pd_no",
                        columnList = "pd_no"),

                @Index(
                        name = "idx_bom_flow_drawing_no",
                        columnList = "drawing_no"),

                @Index(
                        name = "idx_bom_flow_project_code",
                        columnList = "project_code"),

                @Index(
                        name = "idx_bom_flow_plant_code",
                        columnList = "plant_code"),

                @Index(
                        name = "idx_bom_flow_status",
                        columnList = "status")
        })
public class BomFlowBom {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;

    /**
     * Permanent business number for the BOM.
     *
     * Example:
     * BOM-AKG-2026-000001
     */
    @Column(
            name = "bom_no",
            nullable = false,
            length = 100)
    public String bomNo;

    @Column(
            name = "plant_code",
            nullable = false,
            length = 100)
    public String plantCode;

    @Column(
            name = "pd_no",
            nullable = false,
            length = 150)
    public String pdNo;

    @Column(
            name = "drawing_no",
            length = 150)
    public String drawingNo;

    @Column(
            name = "project_code",
            length = 150)
    public String projectCode;

    @Column(
            name = "client_name",
            nullable = false,
            length = 255)
    public String clientName;

    @Column(
            name = "product_name",
            nullable = false,
            length = 500)
    public String productName;

    @Column(
            name = "product_code",
            length = 150)
    public String productCode;

    @Column(
            name = "product_description",
            length = 3000)
    public String productDescription;

    /**
     * Number of the latest revision created for this BOM.
     *
     * This is not necessarily the released revision.
     */
    @Column(
            name = "current_revision_no",
            nullable = false)
    public Integer currentRevisionNo = 1;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 50)
    public BomFlowStatus status =
            BomFlowStatus.DRAFT;

    @Column(
            name = "remarks",
            length = 3000)
    public String remarks;

    @Column(
            name = "created_by",
            nullable = false,
            length = 150)
    public String createdBy;

    @Column(
            name = "created_at",
            nullable = false)
    public LocalDateTime createdAt;

    @Column(
            name = "updated_by",
            length = 150)
    public String updatedBy;

    @Column(
            name = "updated_at",
            nullable = false)
    public LocalDateTime updatedAt;

    @Version
    @Column(
            name = "row_version",
            nullable = false)
    public Long rowVersion;

    @PrePersist
    public void prePersist() {
        LocalDateTime now =
                LocalDateTime.now();

        if (createdAt == null) {
            createdAt = now;
        }

        updatedAt = now;

        if (currentRevisionNo == null
                || currentRevisionNo < 1) {

            currentRevisionNo = 1;
        }

        if (status == null) {
            status = BomFlowStatus.DRAFT;
        }
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}