package com.alsorg.packing.domain.venflow;

import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "ven_flow_stage_history", indexes = {
        @Index(name = "idx_vf_stage_history_entry", columnList = "entry_id"),
        @Index(name = "idx_vf_stage_history_open", columnList = "entry_id,exited_at"),
        @Index(name = "idx_vf_stage_history_stage", columnList = "stage")
})
public class VenFlowStageHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;

    @Column(name = "entry_id", nullable = false)
    public UUID entryId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    public VenFlowStage stage;

    @Column(nullable = false)
    public String department;

    @Column(name = "entered_at", nullable = false)
    public LocalDateTime enteredAt;

    @Column(name = "exited_at")
    public LocalDateTime exitedAt;

    @Column(name = "duration_minutes")
    public Long durationMinutes;

    @Column(name = "entered_by")
    public String enteredBy;

    @Column(name = "exit_action")
    public String exitAction;

    @Column(length = 2000)
    public String remarks;
}