package com.alsorg.packing.bomflow.domain;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "bom_flow_boms",
        indexes = {
                @Index(name = "idx_bom_flow_product_name", columnList = "product_name"),
                @Index(name = "idx_bom_flow_product_project", columnList = "project_code"),
                @Index(name = "idx_bom_flow_product_category", columnList = "product_category"),
                @Index(name = "idx_bom_flow_status", columnList = "status"),
                @Index(name = "idx_bom_flow_updated", columnList = "updated_at")
        })
public class BomFlowProduct {

    @Id
    @Column(nullable = false, updatable = false)
    public UUID id;

    @Column(name = "product_name", nullable = false, length = 500)
    public String productName;

    @Column(name = "product_code", length = 150)
    public String productCode;

    @Column(name = "drawing_no", length = 160)
    public String drawingNumber;

    @Column(name = "product_category", nullable = false, length = 120)
    public String category;

    @Column(name = "collection_name", length = 160)
    public String collection;

    @Column(name = "length_mm", nullable = false, precision = 18, scale = 3)
    public BigDecimal length;

    @Column(name = "width_mm", nullable = false, precision = 18, scale = 3)
    public BigDecimal width;

    @Column(name = "height_mm", nullable = false, precision = 18, scale = 3)
    public BigDecimal height;

    @Column(name = "project_code", length = 180)
    public String projectReference;

    @Column(name = "client_name", length = 240)
    public String clientEntity;

    @Column(name = "current_revision_no", nullable = false)
    public Integer currentRevisionNo = 0;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 50)
    public BomFlowProductStatus status = BomFlowProductStatus.DRAFT;

    @Column(name = "product_image_original_name", length = 500)
    public String productImageOriginalName;

    @Column(name = "product_image_stored_name", length = 500)
    public String productImageStoredName;

    @Column(name = "product_image_storage_key", length = 1200)
    public String productImageStorageKey;

    @Column(name = "product_image_content_type", length = 255)
    public String productImageContentType;

    @Column(name = "product_image_size")
    public Long productImageSize;

    @Column(name = "product_image_uploaded_by", length = 150)
    public String productImageUploadedBy;

    @Column(name = "product_image_uploaded_at")
    public LocalDateTime productImageUploadedAt;

    @Column(name = "drawing_file_original_name", length = 500)
    public String drawingFileOriginalName;

    @Column(name = "drawing_file_stored_name", length = 500)
    public String drawingFileStoredName;

    @Column(name = "drawing_file_storage_key", length = 1200)
    public String drawingFileStorageKey;

    @Column(name = "drawing_file_content_type", length = 255)
    public String drawingFileContentType;

    @Column(name = "drawing_file_size")
    public Long drawingFileSize;

    @Column(name = "drawing_file_uploaded_by", length = 150)
    public String drawingFileUploadedBy;

    @Column(name = "drawing_file_uploaded_at")
    public LocalDateTime drawingFileUploadedAt;

    @Column(name = "created_by", nullable = false, length = 150)
    public String createdBy;

    @Column(name = "created_at", nullable = false)
    public LocalDateTime createdAt;

    @Column(name = "updated_by", nullable = false, length = 150)
    public String updatedBy;

    @Column(name = "updated_at", nullable = false)
    public LocalDateTime updatedAt;

    @Version
    @Column(name = "row_version", nullable = false)
    public Long rowVersion;

    @PrePersist
    void prePersist() {
        if (id == null) id = UUID.randomUUID();
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
        if (status == null) status = BomFlowProductStatus.DRAFT;
        if (currentRevisionNo == null) currentRevisionNo = 0;
        if (category == null || category.isBlank()) category = "MISCELLANEOUS";
        if (length == null) length = BigDecimal.ZERO;
        if (width == null) width = BigDecimal.ZERO;
        if (height == null) height = BigDecimal.ZERO;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
