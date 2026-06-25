package com.alsorg.packing.domain.venflow;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "ven_flow_audit_logs")
public class VenFlowAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;

    @Column(nullable = false)
    public UUID entryId;

    @Column(nullable = false)
    public String action;

    @Column(length = 2000)
    public String oldValue;

    @Column(length = 2000)
    public String newValue;

    public String changedBy;

    public LocalDateTime changedAt;

    @PrePersist
    public void prePersist() {
        if (changedAt == null) {
            changedAt = LocalDateTime.now();
        }
    }
}