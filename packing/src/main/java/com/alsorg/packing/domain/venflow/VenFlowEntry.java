package com.alsorg.packing.domain.venflow;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "ven_flow_entries",
        indexes = {
                @Index(name = "idx_venflow_pd_no", columnList = "pdNo"),
                @Index(name = "idx_venflow_client_name", columnList = "clientName"),
                @Index(name = "idx_venflow_stage", columnList = "stage"),
                @Index(name = "idx_venflow_store_status", columnList = "storeStatus")
        }
)
public class VenFlowEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;

    public LocalDate orderDate;

    @Column(nullable = false)
    public String pdNo;

    @Column(nullable = false)
    public String clientName;

    @Column(length = 1000)
    public String productDescription;

    public String veneerType;

    @Column(name = "veneer_size")
    public String size;

    @Enumerated(EnumType.STRING)
    public VenFlowStoreStatus storeStatus;

    public String requisitionSlipNo;

    public LocalDate requisitionDate;

    @Column(precision = 12, scale = 3)
    public BigDecimal orderedQty;

    @Column(precision = 12, scale = 3)
    public BigDecimal receivedQty;

    @Column(precision = 12, scale = 3)
    public BigDecimal balanceQty;

    @Enumerated(EnumType.STRING)
    public VenFlowUnit unit;

    public LocalDate expectedDate;

    public LocalDate actualInHouseDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    public VenFlowStage stage = VenFlowStage.HEADER_CREATED;

    @Column(length = 2000)
    public String remarks;

    public String createdBy;

    public String updatedBy;

    public LocalDateTime createdAt;

    public LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();

        if (createdAt == null) {
            createdAt = now;
        }

        updatedAt = now;

        if (stage == null) {
            stage = VenFlowStage.HEADER_CREATED;
        }
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}