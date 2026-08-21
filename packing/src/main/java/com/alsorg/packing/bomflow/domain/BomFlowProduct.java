package com.alsorg.packing.bomflow.domain;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "bomflow_products",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_bomflow_product_code",
                        columnNames = "product_code")
        },
        indexes = {
                @Index(
                        name = "idx_bomflow_product_name",
                        columnList = "product_name"),
                @Index(
                        name = "idx_bomflow_product_project",
                        columnList = "project_reference")
        })
public class BomFlowProduct {

    @Id
    @Column(nullable = false, updatable = false)
    public UUID id;

    @Column(name = "product_name", nullable = false, length = 250)
    public String productName;

    @Column(name = "product_code", nullable = false, length = 120)
    public String productCode;

    @Column(name = "drawing_number", length = 160)
    public String drawingNumber;

    @Column(name = "category", nullable = false, length = 120)
    public String category;

    @Column(name = "collection_name", length = 160)
    public String collection;

    @Column(name = "length_mm", nullable = false, precision = 18, scale = 3)
    public BigDecimal length;

    @Column(name = "width_mm", nullable = false, precision = 18, scale = 3)
    public BigDecimal width;

    @Column(name = "height_mm", nullable = false, precision = 18, scale = 3)
    public BigDecimal height;

    @Column(name = "project_reference", length = 180)
    public String projectReference;

    @Column(name = "client_entity", length = 240)
    public String clientEntity;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    public BomFlowProductStatus status = BomFlowProductStatus.DRAFT;

    @Column(name = "created_by", nullable = false, length = 120)
    public String createdBy;

    @Column(name = "created_at", nullable = false)
    public LocalDateTime createdAt;

    @Column(name = "updated_by", nullable = false, length = 120)
    public String updatedBy;

    @Column(name = "updated_at", nullable = false)
    public LocalDateTime updatedAt;

    @Version
    @Column(name = "row_version", nullable = false)
    public Long rowVersion;

    @PrePersist
    void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }

        LocalDateTime now = LocalDateTime.now();

        if (createdAt == null) {
            createdAt = now;
        }

        if (updatedAt == null) {
            updatedAt = now;
        }

        if (status == null) {
            status = BomFlowProductStatus.DRAFT;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
