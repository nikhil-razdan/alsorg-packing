package com.alsorg.packing.machflow;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Compact domain model for MachFlow.
 *
 * All entities are intentionally kept in one file so the module stays isolated and small.
 * JPA supports static nested entity classes. No relationship proxies are used; UUID references
 * keep reads predictable and avoid accidentally coupling MachFlow with PackFlow/BOMFlow/MatFlow/HRFlow.
 */
public final class MachFlowData {

    private MachFlowData() {
    }

    public enum WorkType {
        CORRECTIVE,
        PREVENTIVE,
        INSPECTION,
        CALIBRATION,
        IMPROVEMENT
    }

    public enum WorkStatus {
        NEW,
        PLANNED,
        IN_PROGRESS,
        WAITING_PARTS,
        REPAIRED,
        CLOSED,
        SCRAPPED,
        CANCELLED
    }

    public enum Priority {
        LOW,
        NORMAL,
        HIGH,
        CRITICAL
    }

    public enum EquipmentStatus {
        ACTIVE,
        UNDER_MAINTENANCE,
        DOWN,
        RETIRED
    }

    public enum Criticality {
        LOW,
        MEDIUM,
        HIGH,
        CRITICAL
    }

    @Entity(name = "MachFlowEquipment")
    @Table(
            name = "machflow_equipment",
            indexes = {
                    @Index(name = "idx_mf_equipment_asset_code", columnList = "asset_code", unique = true),
                    @Index(name = "idx_mf_equipment_plant", columnList = "plant_code"),
                    @Index(name = "idx_mf_equipment_status", columnList = "status"),
                    @Index(name = "idx_mf_equipment_category", columnList = "category")
            }
    )
    public static class Equipment {
        @Id
        UUID id = UUID.randomUUID();

        @Column(name = "asset_code", nullable = false, length = 80, unique = true)
        String assetCode;

        @Column(nullable = false, length = 220)
        String name;

        @Column(length = 140)
        String category;

        @Column(name = "plant_code", nullable = false, length = 80)
        String plantCode;

        @Column(length = 180)
        String location;

        @Column(length = 160)
        String manufacturer;

        @Column(length = 160)
        String model;

        @Column(name = "serial_number", length = 180)
        String serialNumber;

        @Enumerated(EnumType.STRING)
        @Column(nullable = false, length = 40)
        Criticality criticality = Criticality.MEDIUM;

        @Enumerated(EnumType.STRING)
        @Column(nullable = false, length = 40)
        EquipmentStatus status = EquipmentStatus.ACTIVE;

        @Column(name = "maintenance_team", length = 160)
        String maintenanceTeam;

        @Column(name = "primary_technician", length = 180)
        String primaryTechnician;

        @Column(length = 180)
        String owner;

        @Column(name = "purchase_date")
        LocalDate purchaseDate;

        @Column(name = "commissioned_date")
        LocalDate commissionedDate;

        @Column(name = "warranty_expiry")
        LocalDate warrantyExpiry;

        @Column(name = "last_maintenance_at")
        LocalDateTime lastMaintenanceAt;

        @Column(name = "next_maintenance_at")
        LocalDateTime nextMaintenanceAt;

        @Column(name = "failure_count", nullable = false)
        long failureCount = 0;

        @Column(name = "downtime_minutes", nullable = false)
        long downtimeMinutes = 0;

        @Lob
        @Column(name = "description")
        String description;

        @Lob
        @Column(name = "safety_notes")
        String safetyNotes;

        @Column(name = "created_by", length = 180)
        String createdBy;

        @Column(name = "created_at", nullable = false)
        LocalDateTime createdAt = LocalDateTime.now();

        @Column(name = "updated_by", length = 180)
        String updatedBy;

        @Column(name = "updated_at", nullable = false)
        LocalDateTime updatedAt = LocalDateTime.now();

        @Version
        long version;

        public Equipment() {
        }
    }

    @Entity(name = "MachFlowWorkOrder")
    @Table(
            name = "machflow_work_order",
            indexes = {
                    @Index(name = "idx_mf_wo_number", columnList = "work_number", unique = true),
                    @Index(name = "idx_mf_wo_equipment", columnList = "equipment_id"),
                    @Index(name = "idx_mf_wo_status", columnList = "status"),
                    @Index(name = "idx_mf_wo_plant", columnList = "plant_code"),
                    @Index(name = "idx_mf_wo_scheduled", columnList = "scheduled_at"),
                    @Index(name = "idx_mf_wo_responsible", columnList = "responsible")
            }
    )
    public static class WorkOrder {
        @Id
        UUID id = UUID.randomUUID();

        @Column(name = "work_number", nullable = false, length = 60, unique = true)
        String workNumber;

        @Column(nullable = false, length = 300)
        String title;

        @Lob
        String description;

        @Lob
        String instructions;

        @Column(name = "equipment_id")
        UUID equipmentId;

        @Column(name = "equipment_name", length = 220)
        String equipmentName;

        @Column(name = "plant_code", nullable = false, length = 80)
        String plantCode;

        @Column(length = 180)
        String location;

        @Column(name = "requested_by", length = 180)
        String requestedBy;

        @Column(name = "team_name", length = 160)
        String teamName;

        @Column(length = 180)
        String responsible;

        @Enumerated(EnumType.STRING)
        @Column(name = "work_type", nullable = false, length = 40)
        WorkType workType = WorkType.CORRECTIVE;

        @Enumerated(EnumType.STRING)
        @Column(nullable = false, length = 40)
        WorkStatus status = WorkStatus.NEW;

        @Enumerated(EnumType.STRING)
        @Column(nullable = false, length = 40)
        Priority priority = Priority.NORMAL;

        @Column(name = "requested_at", nullable = false)
        LocalDateTime requestedAt = LocalDateTime.now();

        @Column(name = "scheduled_at")
        LocalDateTime scheduledAt;

        @Column(name = "started_at")
        LocalDateTime startedAt;

        @Column(name = "repaired_at")
        LocalDateTime repairedAt;

        @Column(name = "closed_at")
        LocalDateTime closedAt;

        @Column(name = "estimated_minutes")
        Integer estimatedMinutes;

        @Column(name = "actual_minutes")
        Integer actualMinutes;

        @Column(name = "downtime_minutes")
        Integer downtimeMinutes;

        @Column(name = "breakdown", nullable = false)
        boolean breakdown;

        @Column(name = "production_stopped", nullable = false)
        boolean productionStopped;

        @Column(name = "safety_risk", nullable = false)
        boolean safetyRisk;

        @Lob
        @Column(name = "root_cause")
        String rootCause;

        @Lob
        @Column(name = "action_taken")
        String actionTaken;

        @Lob
        @Column(name = "parts_used")
        String partsUsed;

        @Column(name = "parts_cost", precision = 14, scale = 2)
        BigDecimal partsCost = BigDecimal.ZERO;

        @Column(name = "labor_cost", precision = 14, scale = 2)
        BigDecimal laborCost = BigDecimal.ZERO;

        @Column(name = "external_cost", precision = 14, scale = 2)
        BigDecimal externalCost = BigDecimal.ZERO;

        @Lob
        @Column(name = "verification_note")
        String verificationNote;

        @Column(name = "preventive_plan_id")
        UUID preventivePlanId;

        @Column(name = "failure_registered", nullable = false)
        boolean failureRegistered;

        @Column(name = "created_by", length = 180)
        String createdBy;

        @Column(name = "created_at", nullable = false)
        LocalDateTime createdAt = LocalDateTime.now();

        @Column(name = "updated_by", length = 180)
        String updatedBy;

        @Column(name = "updated_at", nullable = false)
        LocalDateTime updatedAt = LocalDateTime.now();

        @Version
        long version;

        public WorkOrder() {
        }
    }

    @Entity(name = "MachFlowTeam")
    @Table(
            name = "machflow_team",
            indexes = {
                    @Index(name = "idx_mf_team_name", columnList = "name", unique = true),
                    @Index(name = "idx_mf_team_plant", columnList = "plant_code")
            }
    )
    public static class Team {
        @Id
        UUID id = UUID.randomUUID();

        @Column(nullable = false, length = 160, unique = true)
        String name;

        @Column(name = "plant_code", length = 80)
        String plantCode;

        @Column(length = 180)
        String lead;

        @Lob
        @Column(name = "members_text")
        String membersText;

        @Column(nullable = false)
        boolean active = true;

        @Column(name = "created_at", nullable = false)
        LocalDateTime createdAt = LocalDateTime.now();

        @Column(name = "updated_at", nullable = false)
        LocalDateTime updatedAt = LocalDateTime.now();

        @Version
        long version;

        public Team() {
        }
    }

    @Entity(name = "MachFlowPreventivePlan")
    @Table(
            name = "machflow_preventive_plan",
            indexes = {
                    @Index(name = "idx_mf_pm_equipment", columnList = "equipment_id"),
                    @Index(name = "idx_mf_pm_next_due", columnList = "next_due_date"),
                    @Index(name = "idx_mf_pm_active", columnList = "active")
            }
    )
    public static class PreventivePlan {
        @Id
        UUID id = UUID.randomUUID();

        @Column(name = "equipment_id", nullable = false)
        UUID equipmentId;

        @Column(name = "equipment_name", nullable = false, length = 220)
        String equipmentName;

        @Column(nullable = false, length = 220)
        String title;

        @Column(name = "interval_days", nullable = false)
        int intervalDays;

        @Column(name = "lead_days", nullable = false)
        int leadDays = 3;

        @Column(name = "next_due_date", nullable = false)
        LocalDate nextDueDate;

        @Enumerated(EnumType.STRING)
        @Column(name = "default_priority", nullable = false, length = 40)
        Priority defaultPriority = Priority.NORMAL;

        @Column(name = "team_name", length = 160)
        String teamName;

        @Column(length = 180)
        String responsible;

        @Lob
        String instructions;

        @Column(nullable = false)
        boolean active = true;

        @Column(name = "last_generated_for")
        LocalDate lastGeneratedFor;

        @Column(name = "created_at", nullable = false)
        LocalDateTime createdAt = LocalDateTime.now();

        @Column(name = "updated_at", nullable = false)
        LocalDateTime updatedAt = LocalDateTime.now();

        @Version
        long version;

        public PreventivePlan() {
        }
    }

    @Entity(name = "MachFlowAuditEvent")
    @Table(
            name = "machflow_audit_event",
            indexes = {
                    @Index(name = "idx_mf_audit_entity", columnList = "entity_type,entity_id"),
                    @Index(name = "idx_mf_audit_created", columnList = "created_at")
            }
    )
    public static class AuditEvent {
        @Id
        UUID id = UUID.randomUUID();

        @Column(name = "entity_type", nullable = false, length = 60)
        String entityType;

        @Column(name = "entity_id", nullable = false)
        UUID entityId;

        @Column(nullable = false, length = 100)
        String action;

        @Column(name = "from_status", length = 60)
        String fromStatus;

        @Column(name = "to_status", length = 60)
        String toStatus;

        @Column(length = 180)
        String actor;

        @Lob
        String note;

        @Column(name = "created_at", nullable = false)
        LocalDateTime createdAt = LocalDateTime.now();

        public AuditEvent() {
        }
    }

    public record EquipmentUpsert(
            String assetCode,
            String name,
            String category,
            String plantCode,
            String location,
            String manufacturer,
            String model,
            String serialNumber,
            Criticality criticality,
            EquipmentStatus status,
            String maintenanceTeam,
            String primaryTechnician,
            String owner,
            LocalDate purchaseDate,
            LocalDate commissionedDate,
            LocalDate warrantyExpiry,
            String description,
            String safetyNotes
    ) {
    }

    public record WorkOrderUpsert(
            String title,
            String description,
            String instructions,
            UUID equipmentId,
            String plantCode,
            String location,
            String requestedBy,
            String teamName,
            String responsible,
            WorkType workType,
            WorkStatus status,
            Priority priority,
            LocalDateTime scheduledAt,
            Integer estimatedMinutes,
            Integer downtimeMinutes,
            Boolean breakdown,
            Boolean productionStopped,
            Boolean safetyRisk,
            String rootCause,
            String actionTaken,
            String partsUsed,
            BigDecimal partsCost,
            BigDecimal laborCost,
            BigDecimal externalCost,
            String verificationNote,
            Long version
    ) {
    }

    public record StatusChange(
            WorkStatus status,
            String note,
            Integer actualMinutes,
            Integer downtimeMinutes,
            String rootCause,
            String actionTaken,
            String partsUsed,
            BigDecimal partsCost,
            BigDecimal laborCost,
            BigDecimal externalCost,
            String verificationNote,
            Long version
    ) {
    }

    public record TeamUpsert(
            String name,
            String plantCode,
            String lead,
            String membersText,
            Boolean active
    ) {
    }

    public record PreventivePlanUpsert(
            UUID equipmentId,
            String title,
            Integer intervalDays,
            Integer leadDays,
            LocalDate nextDueDate,
            Priority defaultPriority,
            String teamName,
            String responsible,
            String instructions,
            Boolean active
    ) {
    }
}
