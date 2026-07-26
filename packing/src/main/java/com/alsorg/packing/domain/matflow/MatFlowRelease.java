package com.alsorg.packing.domain.matflow;

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
        name = "mat_flow_releases",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_mat_flow_source_revision",
                        columnNames = "source_revision_id")
        },
        indexes = {
                @Index(
                        name = "idx_mat_flow_release_source_bom",
                        columnList = "source_bom_id"),

                @Index(
                        name = "idx_mat_flow_release_status",
                        columnList = "status"),

                @Index(
                        name = "idx_mat_flow_release_plant",
                        columnList = "plant_code"),

                @Index(
                        name = "idx_mat_flow_release_pd",
                        columnList = "pd_no"),

                @Index(
                        name = "idx_mat_flow_release_created",
                        columnList = "released_at")
        })
public class MatFlowRelease {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;

    /*
     * Source BOM identity.
     */
    @Column(
            name = "source_bom_id",
            nullable = false)
    public UUID sourceBomId;

    @Column(
            name = "source_revision_id",
            nullable = false)
    public UUID sourceRevisionId;

    @Column(
            name = "source_revision_no",
            nullable = false)
    public Integer sourceRevisionNo;

    /*
     * Immutable BOM header snapshot.
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

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 50)
    public MatFlowReleaseStatus status =
            MatFlowReleaseStatus.ACTIVE;

    /**
     * Number of active BOM lines copied to MatFlow.
     */
    @Column(
            name = "released_line_count",
            nullable = false)
    public Integer releasedLineCount = 0;

    /**
     * Active informational lines that did not require Store issue.
     */
    @Column(
            name = "skipped_line_count",
            nullable = false)
    public Integer skippedLineCount = 0;

    /**
     * Previous active release for this BOM, when this is a later revision.
     */
    @Column(
            name = "previous_release_id")
    public UUID previousReleaseId;

    /**
     * Newer release which superseded this release.
     */
    @Column(
            name = "superseded_by_release_id")
    public UUID supersededByReleaseId;

    @Column(
            name = "release_remarks",
            length = 3000)
    public String releaseRemarks;

    @Column(
            name = "released_by",
            nullable = false,
            length = 150)
    public String releasedBy;

    @Column(
            name = "released_at",
            nullable = false)
    public LocalDateTime releasedAt;

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

        if (releasedAt == null) {
            releasedAt = now;
        }

        updatedAt = now;

        if (status == null) {
            status =
                    MatFlowReleaseStatus.ACTIVE;
        }

        if (releasedLineCount == null) {
            releasedLineCount = 0;
        }

        if (skippedLineCount == null) {
            skippedLineCount = 0;
        }
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}