package com.alsorg.packing.assetflow;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Set;
import java.util.UUID;

/**
 * Compact, isolated AssetFlow domain model.
 *
 * AssetFlow intentionally stores snapshots instead of JPA relationships into
 * other FlowSuite modules. Reporter identities grant request-only access and
 * never become FlowSuite users or Spring Security principals.
 */
public final class AssetFlowData {

    private AssetFlowData() {
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
        ASSIGNED,
        ACCEPTED,
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

    public enum ServiceDomain {
        MACHINE,
        IT
    }

    public enum AssetKind {
        PRODUCTION_MACHINE,
        IT_ASSET,
        ELECTRICAL_ASSET,
        FACILITY_ASSET,
        UTILITY_ASSET,
        OTHER
    }

    public enum ComplaintSource {
        WEB,
        QR,
        SERVICE_QR,
        REPORTER_PORTAL,
        FLOW_SUITE_REQUEST,
        MOBILE_APP,
        PREVENTIVE,
        SYSTEM
    }

    public enum ReporterType {
        EMPLOYEE,
        OPERATOR,
        SUPERVISOR,
        STAFF,
        CONTRACTOR,
        OTHER
    }

    @Entity(name = "AssetFlowEquipment")
    @Table(
            name = "assetflow_equipment",
            indexes = {
                    @Index(name = "idx_af_equipment_asset_code", columnList = "asset_code", unique = true),
                    @Index(name = "idx_af_equipment_qr_token", columnList = "qr_token", unique = true),
                    @Index(name = "idx_af_equipment_plant", columnList = "plant_code"),
                    @Index(name = "idx_af_equipment_status", columnList = "status"),
                    @Index(name = "idx_af_equipment_category", columnList = "category"),
                    @Index(name = "idx_af_equipment_domain", columnList = "service_domain"),
                    @Index(name = "idx_af_equipment_scope", columnList = "plant_code,service_domain,status")
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

        @Enumerated(EnumType.STRING)
        @Column(name = "service_domain", length = 40)
        ServiceDomain serviceDomain = ServiceDomain.MACHINE;

        @Enumerated(EnumType.STRING)
        @Column(name = "asset_kind", length = 50)
        AssetKind assetKind = AssetKind.PRODUCTION_MACHINE;

        @Column(name = "plant_code", nullable = false, length = 80)
        String plantCode;

        @Column(length = 180)
        String location;

        @Column(name = "work_center", length = 180)
        String workCenter;

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

        @Column(name = "assigned_to_code", length = 80)
        String assignedToCode;

        @Column(name = "assigned_to_name", length = 180)
        String assignedToName;

        @Column(name = "assigned_department", length = 160)
        String assignedDepartment;

        @Column(name = "hostname", length = 180)
        String hostname;

        @Column(name = "ip_address", length = 100)
        String ipAddress;

        @Column(name = "mac_address", length = 100)
        String macAddress;

        @Column(name = "operating_system", length = 180)
        String operatingSystem;

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

        @Column(name = "qr_token", unique = true)
        UUID qrToken = UUID.randomUUID();

        @Column(name = "qr_enabled", nullable = false)
        boolean qrEnabled = true;

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

    @Entity(name = "AssetFlowWorkOrder")
    @Table(
            name = "assetflow_work_order",
            indexes = {
                    @Index(name = "idx_af_wo_number", columnList = "work_number", unique = true),
                    @Index(name = "idx_af_wo_equipment", columnList = "equipment_id"),
                    @Index(name = "idx_af_wo_status", columnList = "status"),
                    @Index(name = "idx_af_wo_plant", columnList = "plant_code"),
                    @Index(name = "idx_af_wo_domain", columnList = "service_domain"),
                    @Index(name = "idx_af_wo_scheduled", columnList = "scheduled_at"),
                    @Index(name = "idx_af_wo_responsible", columnList = "responsible"),
                    @Index(name = "idx_af_wo_requester", columnList = "requested_by"),
                    @Index(name = "idx_af_wo_reporter", columnList = "reporter_id"),
                    @Index(name = "idx_af_wo_scope_created", columnList = "plant_code,service_domain,created_at"),
                    @Index(name = "idx_af_wo_scope_status", columnList = "plant_code,service_domain,status")
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

        @Column(name = "equipment_code", length = 80)
        String equipmentCode;

        @Enumerated(EnumType.STRING)
        @Column(name = "service_domain", length = 40)
        ServiceDomain serviceDomain = ServiceDomain.MACHINE;

        @Column(name = "request_category", length = 120)
        String requestCategory;

        @Column(name = "plant_code", nullable = false, length = 80)
        String plantCode;

        @Column(length = 180)
        String location;

        @Column(name = "work_center", length = 180)
        String workCenter;

        @Column(name = "requested_by", length = 180)
        String requestedBy;

        @Column(name = "reporter_id")
        UUID reporterId;

        @Column(name = "reporter_code", length = 80)
        String reporterCode;

        @Column(name = "reporter_department", length = 160)
        String reporterDepartment;

        @Column(name = "reporter_contact", length = 100)
        String reporterContact;

        @Column(name = "operator_name", length = 180)
        String operatorName;

        @Column(name = "operator_contact", length = 80)
        String operatorContact;

        @Column(name = "team_name", length = 160)
        String teamName;

        @Column(length = 180)
        String responsible;

        @Column(name = "assigned_by", length = 180)
        String assignedBy;

        @Column(name = "assigned_at")
        LocalDateTime assignedAt;

        @Column(name = "accepted_by", length = 180)
        String acceptedBy;

        @Column(name = "accepted_at")
        LocalDateTime acceptedAt;

        @Enumerated(EnumType.STRING)
        @Column(name = "complaint_source", nullable = false, length = 40)
        ComplaintSource complaintSource = ComplaintSource.WEB;

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

        @Column(name = "requested_for_at")
        LocalDateTime requestedForAt;

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

    @Entity(name = "AssetFlowTeam")
    @Table(
            name = "assetflow_team",
            indexes = {
                    @Index(name = "idx_af_team_name", columnList = "name", unique = true),
                    @Index(name = "idx_af_team_plant", columnList = "plant_code"),
                    @Index(name = "idx_af_team_domain", columnList = "service_domain"),
                    @Index(name = "idx_af_team_request_token", columnList = "request_token", unique = true),
                    @Index(name = "idx_af_team_route", columnList = "plant_code,service_domain,active,default_for_plant")
            }
    )
    public static class Team {
        @Id
        UUID id = UUID.randomUUID();

        @Column(nullable = false, length = 160, unique = true)
        String name;

        @Column(name = "plant_code", length = 80)
        String plantCode;

        @Enumerated(EnumType.STRING)
        @Column(name = "service_domain", length = 40)
        ServiceDomain serviceDomain = ServiceDomain.MACHINE;

        @Column(length = 180)
        String lead;

        @Lob
        @Column(name = "members_text")
        String membersText;

        @Column(name = "default_for_plant", nullable = false)
        boolean defaultForPlant;

        @Column(name = "request_token", unique = true)
        UUID requestToken = UUID.randomUUID();

        @Column(name = "public_reporting_enabled", nullable = false)
        boolean publicReportingEnabled = true;

        @Column(name = "default_categories", length = 700)
        String defaultCategories;

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

    @Entity(name = "AssetFlowReporter")
    @Table(
            name = "assetflow_reporter",
            indexes = {
                    @Index(name = "idx_af_reporter_code", columnList = "reporter_code", unique = true),
                    @Index(name = "idx_af_reporter_plant", columnList = "plant_code"),
                    @Index(name = "idx_af_reporter_active", columnList = "active"),
                    @Index(name = "idx_af_reporter_linked_username", columnList = "linked_username", unique = true),
                    @Index(name = "idx_af_reporter_lock", columnList = "locked_until")
            }
    )
    public static class Reporter {
        @Id
        UUID id = UUID.randomUUID();

        @Column(name = "reporter_code", nullable = false, length = 80, unique = true)
        String reporterCode;

        @Column(name = "display_name", nullable = false, length = 180)
        String displayName;

        @Enumerated(EnumType.STRING)
        @Column(name = "reporter_type", nullable = false, length = 40)
        ReporterType reporterType = ReporterType.EMPLOYEE;

        @Column(name = "plant_code", nullable = false, length = 80)
        String plantCode;

        @Column(name = "plant_codes", nullable = false, length = 500)
        String plantCodes;

        @Column(name = "linked_username", length = 180, unique = true)
        String linkedUsername;

        @Column(length = 160)
        String department;

        @Column(length = 160)
        String designation;

        @Column(length = 100)
        String phone;

        @Column(length = 180)
        String email;

        @Column(name = "allowed_domains", nullable = false, length = 350)
        String allowedDomains = ServiceDomain.MACHINE.name();

        @Column(name = "pin_hash", nullable = false, length = 255)
        String pinHash;

        @Column(nullable = false)
        boolean active = true;

        @Column(name = "valid_until")
        LocalDate validUntil;

        @Column(name = "failed_attempts", nullable = false)
        int failedAttempts;

        @Column(name = "locked_until")
        LocalDateTime lockedUntil;

        @Column(name = "last_request_at")
        LocalDateTime lastRequestAt;

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

        public Reporter() {
        }
    }

    @Entity(name = "AssetFlowPreventivePlan")
    @Table(
            name = "assetflow_preventive_plan",
            indexes = {
                    @Index(name = "idx_af_pm_equipment", columnList = "equipment_id"),
                    @Index(name = "idx_af_pm_next_due", columnList = "next_due_date"),
                    @Index(name = "idx_af_pm_active", columnList = "active"),
                    @Index(name = "idx_af_pm_active_due", columnList = "active,next_due_date")
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

        @Column(name = "scheduled_time")
        LocalTime scheduledTime = LocalTime.of(9, 0);

        @Column(name = "estimated_minutes")
        Integer estimatedMinutes = 60;

        @Enumerated(EnumType.STRING)
        @Column(name = "default_priority", nullable = false, length = 40)
        Priority defaultPriority = Priority.NORMAL;

        @Column(name = "team_name", length = 160)
        String teamName;

        @Column(length = 180)
        String responsible;

        @Column(name = "requires_shutdown", nullable = false)
        boolean requiresShutdown;

        @Lob
        String instructions;

        @Lob
        @Column(name = "checklist_text")
        String checklistText;

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

    @Entity(name = "AssetFlowAuditEvent")
    @Table(
            name = "assetflow_audit_event",
            indexes = {
                    @Index(name = "idx_af_audit_entity", columnList = "entity_type,entity_id"),
                    @Index(name = "idx_af_audit_created", columnList = "created_at"),
                    @Index(name = "idx_af_audit_entity_created", columnList = "entity_type,entity_id,created_at")
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
            @Size(max = 80) String assetCode,
            @Size(max = 220) String name,
            @Size(max = 140) String category,
            ServiceDomain serviceDomain,
            AssetKind assetKind,
            @Size(max = 80) String plantCode,
            @Size(max = 180) String location,
            @Size(max = 180) String workCenter,
            @Size(max = 160) String manufacturer,
            @Size(max = 160) String model,
            @Size(max = 180) String serialNumber,
            Criticality criticality,
            EquipmentStatus status,
            @Size(max = 160) String maintenanceTeam,
            @Size(max = 180) String primaryTechnician,
            @Size(max = 180) String owner,
            @Size(max = 80) String assignedToCode,
            @Size(max = 180) String assignedToName,
            @Size(max = 160) String assignedDepartment,
            @Size(max = 180) String hostname,
            @Size(max = 100) String ipAddress,
            @Size(max = 100) String macAddress,
            @Size(max = 180) String operatingSystem,
            LocalDate purchaseDate,
            LocalDate commissionedDate,
            LocalDate warrantyExpiry,
            Boolean qrEnabled,
            @Size(max = 20000) String description,
            @Size(max = 20000) String safetyNotes,
            @PositiveOrZero Long version
    ) {
    }

    public record WorkOrderUpsert(
            @Size(max = 300) String title,
            @Size(max = 30000) String description,
            @Size(max = 30000) String instructions,
            UUID equipmentId,
            UUID qrToken,
            ServiceDomain serviceDomain,
            @Size(max = 120) String requestCategory,
            @Size(max = 80) String plantCode,
            @Size(max = 180) String location,
            @Size(max = 180) String operatorName,
            @Size(max = 80) String operatorContact,
            @Size(max = 160) String teamName,
            @Size(max = 180) String responsible,
            WorkType workType,
            WorkStatus status,
            Priority priority,
            LocalDateTime requestedForAt,
            LocalDateTime scheduledAt,
            @PositiveOrZero Integer estimatedMinutes,
            @PositiveOrZero Integer downtimeMinutes,
            Boolean breakdown,
            Boolean productionStopped,
            Boolean safetyRisk,
            @Size(max = 30000) String rootCause,
            @Size(max = 30000) String actionTaken,
            @Size(max = 30000) String partsUsed,
            @DecimalMin("0.00") BigDecimal partsCost,
            @DecimalMin("0.00") BigDecimal laborCost,
            @DecimalMin("0.00") BigDecimal externalCost,
            @Size(max = 30000) String verificationNote,
            @PositiveOrZero Long version
    ) {
    }

    public record AssignmentRequest(
            @Size(max = 160) String teamName,
            @Size(max = 180) String responsible,
            LocalDateTime scheduledAt,
            @PositiveOrZero Integer estimatedMinutes,
            @Size(max = 4000) String note,
            @PositiveOrZero Long version
    ) {
    }

    public record StatusChange(
            WorkStatus status,
            @Size(max = 4000) String note,
            @PositiveOrZero Integer actualMinutes,
            @PositiveOrZero Integer downtimeMinutes,
            @Size(max = 30000) String rootCause,
            @Size(max = 30000) String actionTaken,
            @Size(max = 30000) String partsUsed,
            @DecimalMin("0.00") BigDecimal partsCost,
            @DecimalMin("0.00") BigDecimal laborCost,
            @DecimalMin("0.00") BigDecimal externalCost,
            @Size(max = 30000) String verificationNote,
            @PositiveOrZero Long version
    ) {
    }

    public record TeamUpsert(
            @Size(max = 160) String name,
            @Size(max = 80) String plantCode,
            ServiceDomain serviceDomain,
            @Size(max = 180) String lead,
            @Size(max = 10000) String membersText,
            Boolean defaultForPlant,
            Boolean publicReportingEnabled,
            @Size(max = 700) String defaultCategories,
            Boolean active,
            @PositiveOrZero Long version
    ) {
    }

    public record ReporterUpsert(
            @Size(max = 80) String reporterCode,
            @Size(max = 180) String displayName,
            ReporterType reporterType,
            @Size(max = 80) String plantCode,
            @Size(max = 100) Set<@Size(max = 80) String> plantCodes,
            @Size(max = 180) String linkedUsername,
            @Size(max = 160) String department,
            @Size(max = 160) String designation,
            @Size(max = 100) String phone,
            @Email @Size(max = 180) String email,
            @Size(max = 10) Set<ServiceDomain> allowedDomains,
            @Pattern(regexp = "\\d{4,8}", message = "Reporter PIN must contain 4 to 8 digits") String accessPin,
            Boolean active,
            LocalDate validUntil,
            @PositiveOrZero Long version
    ) {
    }

    public record ReporterLogin(
            @Size(max = 80) String reporterCode,
            @Pattern(regexp = "\\d{4,8}", message = "Reporter PIN must contain 4 to 8 digits") String accessPin,
            UUID equipmentToken,
            UUID serviceDeskToken
    ) {
    }

    public record PublicRequestCreate(
            @Size(max = 80) String reporterCode,
            @Pattern(regexp = "\\d{4,8}", message = "Reporter PIN must contain 4 to 8 digits") String accessPin,
            UUID equipmentToken,
            UUID serviceDeskToken,
            ServiceDomain serviceDomain,
            @Size(max = 80) String plantCode,
            @Size(max = 120) String requestCategory,
            @Size(max = 300) String title,
            @Size(max = 30000) String description,
            @Size(max = 180) String location,
            @Size(max = 180) String operatorName,
            @Size(max = 80) String operatorContact,
            LocalDateTime requestedForAt,
            Priority priority,
            Boolean productionStopped,
            Boolean safetyRisk
    ) {
    }

    public record AuthenticatedRequestCreate(
            UUID equipmentId,
            UUID equipmentToken,
            UUID serviceDeskToken,
            ServiceDomain serviceDomain,
            @Size(max = 120) String requestCategory,
            @Size(max = 80) String plantCode,
            @Size(max = 300) String title,
            @Size(max = 30000) String description,
            @Size(max = 180) String location,
            @Size(max = 180) String operatorName,
            @Size(max = 80) String operatorContact,
            LocalDateTime requestedForAt,
            Priority priority,
            Boolean productionStopped,
            Boolean safetyRisk
    ) {
    }

    public record PreventivePlanUpsert(
            UUID equipmentId,
            @Size(max = 220) String title,
            @Positive Integer intervalDays,
            @PositiveOrZero Integer leadDays,
            LocalDate nextDueDate,
            LocalTime scheduledTime,
            @PositiveOrZero Integer estimatedMinutes,
            Priority defaultPriority,
            @Size(max = 160) String teamName,
            @Size(max = 180) String responsible,
            Boolean requiresShutdown,
            @Size(max = 30000) String instructions,
            @Size(max = 30000) String checklistText,
            Boolean active,
            @PositiveOrZero Long version
    ) {
    }
}
