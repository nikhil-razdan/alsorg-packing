package com.alsorg.packing.machflow;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.machflow.MachFlowData.AuditEvent;
import com.alsorg.packing.machflow.MachFlowData.Criticality;
import com.alsorg.packing.machflow.MachFlowData.Equipment;
import com.alsorg.packing.machflow.MachFlowData.EquipmentStatus;
import com.alsorg.packing.machflow.MachFlowData.EquipmentUpsert;
import com.alsorg.packing.machflow.MachFlowData.PreventivePlan;
import com.alsorg.packing.machflow.MachFlowData.PreventivePlanUpsert;
import com.alsorg.packing.machflow.MachFlowData.Priority;
import com.alsorg.packing.machflow.MachFlowData.StatusChange;
import com.alsorg.packing.machflow.MachFlowData.Team;
import com.alsorg.packing.machflow.MachFlowData.TeamUpsert;
import com.alsorg.packing.machflow.MachFlowData.WorkOrder;
import com.alsorg.packing.machflow.MachFlowData.WorkOrderUpsert;
import com.alsorg.packing.machflow.MachFlowData.WorkStatus;
import com.alsorg.packing.machflow.MachFlowData.WorkType;
import com.alsorg.packing.repository.UserRepository;
import com.alsorg.packing.service.CurrentUserService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import jakarta.transaction.Transactional;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Transactional
public class MachFlowService {

    private static final Set<WorkStatus> TERMINAL = EnumSet.of(
            WorkStatus.CLOSED,
            WorkStatus.SCRAPPED,
            WorkStatus.CANCELLED
    );

    private static final Map<WorkStatus, Set<WorkStatus>> TRANSITIONS = Map.of(
            WorkStatus.NEW, EnumSet.of(WorkStatus.PLANNED, WorkStatus.IN_PROGRESS, WorkStatus.CANCELLED, WorkStatus.SCRAPPED),
            WorkStatus.PLANNED, EnumSet.of(WorkStatus.NEW, WorkStatus.IN_PROGRESS, WorkStatus.CANCELLED, WorkStatus.SCRAPPED),
            WorkStatus.IN_PROGRESS, EnumSet.of(WorkStatus.WAITING_PARTS, WorkStatus.REPAIRED, WorkStatus.CANCELLED),
            WorkStatus.WAITING_PARTS, EnumSet.of(WorkStatus.IN_PROGRESS, WorkStatus.REPAIRED, WorkStatus.CANCELLED),
            WorkStatus.REPAIRED, EnumSet.of(WorkStatus.CLOSED, WorkStatus.IN_PROGRESS),
            WorkStatus.CLOSED, EnumSet.of(WorkStatus.IN_PROGRESS),
            WorkStatus.SCRAPPED, EnumSet.of(WorkStatus.NEW),
            WorkStatus.CANCELLED, EnumSet.of(WorkStatus.NEW)
    );

    @PersistenceContext
    private EntityManager em;

    private final CurrentUserService currentUserService;
    private final UserRepository userRepository;

    public MachFlowService(
            CurrentUserService currentUserService,
            UserRepository userRepository) {
        this.currentUserService = currentUserService;
        this.userRepository = userRepository;
    }

    /* =============================== DASHBOARD =============================== */

    public Map<String, Object> dashboard(String plantCode) {
        Set<String> scope = readPlantScope(plantCode);
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime monthAgo = now.minusDays(30);
        LocalDateTime ninetyDaysAgo = now.minusDays(90);

        List<WorkOrder> openOrders = em.createQuery(
                        "select w from MachFlowWorkOrder w where w.status not in :terminal and w.plantCode in :plants order by w.createdAt desc",
                        WorkOrder.class
                )
                .setParameter("terminal", TERMINAL)
                .setParameter("plants", scope)
                .getResultList();

        long overdue = openOrders.stream()
                .filter(w -> w.scheduledAt != null && w.scheduledAt.isBefore(now))
                .count();
        long critical = openOrders.stream().filter(w -> w.priority == Priority.CRITICAL).count();
        long waitingParts = openOrders.stream().filter(w -> w.status == WorkStatus.WAITING_PARTS).count();

        List<WorkOrder> last90 = listOrdersByCreatedRange(scope, ninetyDaysAgo, now);
        List<WorkOrder> last30 = last90.stream().filter(w -> !w.createdAt.isBefore(monthAgo)).toList();

        long breakdowns30 = last30.stream().filter(w -> w.breakdown).count();
        double downtimeHours30 = last30.stream()
                .map(w -> w.downtimeMinutes)
                .filter(Objects::nonNull)
                .mapToLong(Integer::longValue)
                .sum() / 60.0;

        double mttrHours = last90.stream()
                .filter(w -> w.workType == WorkType.CORRECTIVE && (w.status == WorkStatus.REPAIRED || w.status == WorkStatus.CLOSED))
                .map(this::resolvedActualMinutes)
                .filter(Objects::nonNull)
                .mapToInt(Integer::intValue)
                .average()
                .orElse(0.0) / 60.0;

        List<PreventivePlan> plans = listPlanEntities(scope, true);
        long pmDue7 = plans.stream()
                .filter(p -> !p.nextDueDate.isAfter(LocalDate.now().plusDays(7)))
                .count();

        LocalDateTime pmWindow = now.minusDays(30);
        List<WorkOrder> pmLast30 = last30.stream().filter(w -> w.workType == WorkType.PREVENTIVE && w.scheduledAt != null && !w.scheduledAt.isBefore(pmWindow)).toList();
        long pmCompleted = pmLast30.stream().filter(w -> w.status == WorkStatus.CLOSED || w.status == WorkStatus.REPAIRED).count();
        double pmCompliance = pmLast30.isEmpty() ? 100.0 : (100.0 * pmCompleted / pmLast30.size());

        List<Equipment> equipment = listEquipmentEntities(scope, null, null, null);
        long assetsDown = equipment.stream().filter(e -> e.status == EquipmentStatus.DOWN || e.status == EquipmentStatus.UNDER_MAINTENANCE).count();
        long warrantyRisk = equipment.stream()
                .filter(e -> e.warrantyExpiry != null)
                .filter(e -> !e.warrantyExpiry.isBefore(LocalDate.now()))
                .filter(e -> !e.warrantyExpiry.isAfter(LocalDate.now().plusDays(60)))
                .count();

        EnumMap<WorkStatus, Long> statusCounts = new EnumMap<>(WorkStatus.class);
        for (WorkStatus status : WorkStatus.values()) statusCounts.put(status, 0L);
        for (WorkOrder w : openOrders) statusCounts.merge(w.status, 1L, Long::sum);

        Map<String, Long> topAssets = last90.stream()
                .filter(w -> w.breakdown && notBlank(w.equipmentName))
                .collect(Collectors.groupingBy(w -> w.equipmentName, Collectors.counting()));

        List<Map<String, Object>> topProblemAssets = topAssets.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(6)
                .map(e -> map("name", e.getKey(), "failures", e.getValue()))
                .toList();

        List<Map<String, Object>> priorityQueue = openOrders.stream()
                .sorted(Comparator
                        .comparing((WorkOrder w) -> w.priority == Priority.CRITICAL ? 0 : w.priority == Priority.HIGH ? 1 : 2)
                        .thenComparing(w -> w.scheduledAt == null ? LocalDateTime.MAX : w.scheduledAt))
                .limit(8)
                .map(this::workOrderSummary)
                .toList();

        Map<String, Object> metrics = map(
                "open", openOrders.size(),
                "overdue", overdue,
                "critical", critical,
                "waitingParts", waitingParts,
                "breakdowns30", breakdowns30,
                "downtimeHours30", round(downtimeHours30, 1),
                "mttrHours90", round(mttrHours, 1),
                "pmCompliance30", round(pmCompliance, 1),
                "pmDue7", pmDue7,
                "assetsDown", assetsDown,
                "warrantyRisk60", warrantyRisk,
                "equipmentCount", equipment.size()
        );

        return map(
                "metrics", metrics,
                "byStatus", statusCounts.entrySet().stream().collect(Collectors.toMap(e -> e.getKey().name(), Map.Entry::getValue, (a, b) -> a, LinkedHashMap::new)),
                "priorityQueue", priorityQueue,
                "topProblemAssets", topProblemAssets,
                "generatedAt", now
        );
    }

    /* =============================== WORK ORDERS =============================== */

    public Map<String, Object> listWorkOrders(
            String plantCode,
            WorkStatus status,
            WorkType type,
            Priority priority,
            UUID equipmentId,
            String responsible,
            String search,
            int page,
            int size
    ) {
        Set<String> scope = readPlantScope(plantCode);
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(size, 1), 1000);
        QueryResult<WorkOrder> result = queryOrders(scope, status, type, priority, equipmentId, responsible, search, safePage, safeSize);
        return map(
                "items", result.items.stream().map(this::workOrderSummary).toList(),
                "page", safePage,
                "size", safeSize,
                "total", result.total,
                "pages", Math.max(1, (long) Math.ceil(result.total / (double) safeSize))
        );
    }

    public Map<String, Object> getWorkOrder(UUID id) {
        WorkOrder w = requireOrder(id, false);
        requirePlantReadAccess(w.plantCode);
        Map<String, Object> out = workOrderDetail(w);
        out.put("audit", listAudit("WORK_ORDER", id));
        out.put("allowedTransitions", TRANSITIONS.getOrDefault(w.status, Set.of()).stream().map(Enum::name).toList());
        return out;
    }

    public Map<String, Object> createWorkOrder(WorkOrderUpsert request, Authentication auth) {
        require(request != null, "Request body is required");
        require(notBlank(request.title()), "Title is required");

        User currentUser = currentUserService.requireCurrentUser();
        boolean canPlan = canPlan(currentUser);

        WorkOrder w = new WorkOrder();
        w.workNumber = nextWorkNumber();
        w.title = clean(request.title());
        w.description = clean(request.description());
        w.instructions = clean(request.instructions());
        w.requestedBy = currentUser.getUsername();
        w.teamName = canPlan ? clean(request.teamName()) : null;
        w.responsible = canPlan ? clean(request.responsible()) : null;
        w.workType = request.workType() == null ? WorkType.CORRECTIVE : request.workType();
        w.status = canPlan && request.scheduledAt() != null ? WorkStatus.PLANNED : WorkStatus.NEW;
        w.priority = request.priority() == null ? Priority.NORMAL : request.priority();
        w.scheduledAt = canPlan ? request.scheduledAt() : null;
        w.estimatedMinutes = canPlan ? nonNegative(request.estimatedMinutes(), "Estimated minutes") : null;
        w.downtimeMinutes = 0;
        w.breakdown = request.breakdown() == null
                ? w.workType == WorkType.CORRECTIVE
                : request.breakdown();
        w.productionStopped = Boolean.TRUE.equals(request.productionStopped());
        w.safetyRisk = Boolean.TRUE.equals(request.safetyRisk());
        w.rootCause = null;
        w.actionTaken = null;
        w.partsUsed = null;
        w.partsCost = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        w.laborCost = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        w.externalCost = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        w.verificationNote = null;

        hydrateEquipmentSnapshot(w, request.equipmentId(), request.plantCode(), request.location());
        require(notBlank(w.plantCode), "Plant code is required");
        requirePlantWriteAccess(w.plantCode);

        String actor = actor(auth);
        w.createdBy = actor;
        w.updatedBy = actor;
        w.createdAt = LocalDateTime.now();
        w.updatedAt = w.createdAt;
        em.persist(w);
        audit("WORK_ORDER", w.id, "CREATED", null, w.status.name(), actor, w.title);
        syncEquipmentState(w.equipmentId);
        return workOrderDetail(w);
    }

    public Map<String, Object> updateWorkOrder(UUID id, WorkOrderUpsert request, Authentication auth) {
        require(request != null, "Request body is required");
        WorkOrder w = requireOrder(id, true);
        requirePlantWriteAccess(w.plantCode);
        checkVersion(w.version, request.version());

        if (notBlank(request.title())) w.title = clean(request.title());
        if (request.description() != null) w.description = clean(request.description());
        if (request.instructions() != null) w.instructions = clean(request.instructions());
        if (request.teamName() != null) w.teamName = clean(request.teamName());
        if (request.responsible() != null) w.responsible = clean(request.responsible());
        if (request.workType() != null) w.workType = request.workType();
        if (request.priority() != null) w.priority = request.priority();
        if (request.scheduledAt() != null || w.scheduledAt != null) w.scheduledAt = request.scheduledAt();
        if (request.estimatedMinutes() != null) w.estimatedMinutes = nonNegative(request.estimatedMinutes(), "Estimated minutes");
        if (request.downtimeMinutes() != null) w.downtimeMinutes = nonNegative(request.downtimeMinutes(), "Downtime minutes");
        if (request.breakdown() != null) w.breakdown = request.breakdown();
        if (request.productionStopped() != null) w.productionStopped = request.productionStopped();
        if (request.safetyRisk() != null) w.safetyRisk = request.safetyRisk();
        if (request.rootCause() != null) w.rootCause = clean(request.rootCause());
        if (request.actionTaken() != null) w.actionTaken = clean(request.actionTaken());
        if (request.partsUsed() != null) w.partsUsed = clean(request.partsUsed());
        if (request.partsCost() != null) w.partsCost = money(request.partsCost());
        if (request.laborCost() != null) w.laborCost = money(request.laborCost());
        if (request.externalCost() != null) w.externalCost = money(request.externalCost());
        if (request.verificationNote() != null) w.verificationNote = clean(request.verificationNote());

        UUID oldEquipment = w.equipmentId;
        if (request.equipmentId() != null && !request.equipmentId().equals(w.equipmentId)) {
            hydrateEquipmentSnapshot(w, request.equipmentId(), request.plantCode(), request.location());
        } else {
            if (notBlank(request.plantCode())) w.plantCode = normalizePlant(request.plantCode());
            if (request.location() != null) w.location = clean(request.location());
        }

        requirePlantWriteAccess(w.plantCode);
        w.updatedBy = actor(auth);
        w.updatedAt = LocalDateTime.now();
        audit("WORK_ORDER", w.id, "UPDATED", w.status.name(), w.status.name(), actor(auth), "Work order details updated");
        syncEquipmentState(oldEquipment);
        syncEquipmentState(w.equipmentId);
        return workOrderDetail(w);
    }

    public Map<String, Object> changeStatus(UUID id, StatusChange request, Authentication auth) {
        require(request != null && request.status() != null, "Target status is required");
        WorkOrder w = requireOrder(id, true);
        requirePlantWriteAccess(w.plantCode);
        checkVersion(w.version, request.version());

        WorkStatus from = w.status;
        WorkStatus to = request.status();
        require(from != to, "Work order is already in " + to.name());
        require(TRANSITIONS.getOrDefault(from, Set.of()).contains(to), "Invalid transition: " + from + " → " + to);
        if (to == WorkStatus.PLANNED) {
            require(w.scheduledAt != null, "Schedule date is required before moving work to Planned");
        }

        LocalDateTime now = LocalDateTime.now();
        if (to == WorkStatus.IN_PROGRESS && w.startedAt == null) w.startedAt = now;
        if (to == WorkStatus.REPAIRED) {
            if (request.actualMinutes() != null) w.actualMinutes = nonNegative(request.actualMinutes(), "Actual minutes");
            else if (w.startedAt != null) w.actualMinutes = Math.toIntExact(Math.max(0, Duration.between(w.startedAt, now).toMinutes()));
            if (request.downtimeMinutes() != null) w.downtimeMinutes = nonNegative(request.downtimeMinutes(), "Downtime minutes");
            else if (w.productionStopped && w.startedAt != null) w.downtimeMinutes = w.actualMinutes;
            if (request.rootCause() != null) w.rootCause = clean(request.rootCause());
            if (request.actionTaken() != null) w.actionTaken = clean(request.actionTaken());
            if (request.partsUsed() != null) w.partsUsed = clean(request.partsUsed());
            if (request.partsCost() != null) w.partsCost = money(request.partsCost());
            if (request.laborCost() != null) w.laborCost = money(request.laborCost());
            if (request.externalCost() != null) w.externalCost = money(request.externalCost());
            if (w.workType == WorkType.CORRECTIVE || w.breakdown) {
                require(notBlank(w.rootCause), "Root cause is required before marking a corrective breakdown repaired");
                require(notBlank(w.actionTaken), "Action taken is required before marking a corrective breakdown repaired");
            }
            w.repairedAt = now;
        }
        if (to == WorkStatus.CLOSED) {
            String verification = firstNonBlank(request.verificationNote(), w.verificationNote);
            require(notBlank(verification), "Repair verification is required before closing");
            w.verificationNote = verification;
            w.closedAt = now;
            registerFailureOnce(w);
        }
        if ((to == WorkStatus.CANCELLED || to == WorkStatus.SCRAPPED) && !notBlank(request.note())) {
            throw badRequest("A reason is required for " + to.name().toLowerCase(Locale.ROOT));
        }
        if (request.actualMinutes() != null && to != WorkStatus.REPAIRED) w.actualMinutes = nonNegative(request.actualMinutes(), "Actual minutes");
        if (request.downtimeMinutes() != null && to != WorkStatus.REPAIRED) w.downtimeMinutes = nonNegative(request.downtimeMinutes(), "Downtime minutes");
        if (request.rootCause() != null && to != WorkStatus.REPAIRED) w.rootCause = clean(request.rootCause());
        if (request.actionTaken() != null && to != WorkStatus.REPAIRED) w.actionTaken = clean(request.actionTaken());
        if (request.verificationNote() != null && to != WorkStatus.CLOSED) w.verificationNote = clean(request.verificationNote());

        if (from == WorkStatus.CLOSED && to == WorkStatus.IN_PROGRESS) {
            w.closedAt = null;
            w.repairedAt = null;
        }

        w.status = to;
        w.updatedBy = actor(auth);
        w.updatedAt = now;
        audit("WORK_ORDER", w.id, "STATUS_CHANGED", from.name(), to.name(), actor(auth), clean(request.note()));
        syncEquipmentState(w.equipmentId);
        return workOrderDetail(w);
    }

    /* =============================== EQUIPMENT =============================== */

    public Map<String, Object> listEquipment(String plantCode, EquipmentStatus status, String category, String search) {
        Set<String> scope = readPlantScope(plantCode);
        List<Equipment> items = listEquipmentEntities(scope, status, category, search);
        Map<UUID, Long> openCounts = openWorkOrderCountsByEquipment(scope);
        List<Map<String, Object>> views = items.stream()
                .map(e -> equipmentSummary(e, openCounts.getOrDefault(e.id, 0L)))
                .toList();
        return map("items", views, "total", views.size());
    }

    public Map<String, Object> getEquipment(UUID id) {
        Equipment e = requireEquipment(id, false);
        requirePlantReadAccess(e.plantCode);
        Map<String, Object> out = equipmentDetail(e);
        out.put("health", equipmentHealth(e));
        out.put("recentWorkOrders", listOrdersForEquipment(e.id, 10).stream().map(this::workOrderSummary).toList());
        out.put("plans", listPlanEntities(Set.of(e.plantCode), false).stream()
                .filter(p -> p.equipmentId.equals(e.id))
                .map(this::planView)
                .toList());
        out.put("audit", listAudit("EQUIPMENT", e.id));
        return out;
    }

    public Map<String, Object> createEquipment(EquipmentUpsert request, Authentication auth) {
        validateEquipment(request, null);
        requirePlantWriteAccess(request.plantCode());
        Equipment e = new Equipment();
        applyEquipment(e, request);
        e.createdBy = actor(auth);
        e.updatedBy = actor(auth);
        e.createdAt = LocalDateTime.now();
        e.updatedAt = e.createdAt;
        em.persist(e);
        audit("EQUIPMENT", e.id, "CREATED", null, e.status.name(), actor(auth), e.assetCode + " · " + e.name);
        return equipmentDetail(e);
    }

    public Map<String, Object> updateEquipment(UUID id, EquipmentUpsert request, Authentication auth) {
        Equipment e = requireEquipment(id, true);
        requirePlantWriteAccess(e.plantCode);
        validateEquipment(request, id);
        requirePlantWriteAccess(request.plantCode());
        applyEquipment(e, request);
        e.updatedBy = actor(auth);
        e.updatedAt = LocalDateTime.now();
        audit("EQUIPMENT", e.id, "UPDATED", e.status.name(), e.status.name(), actor(auth), "Equipment master updated");
        return equipmentDetail(e);
    }

    private void validateEquipment(EquipmentUpsert request, UUID currentId) {
        require(request != null, "Request body is required");
        require(notBlank(request.assetCode()), "Asset code is required");
        require(notBlank(request.name()), "Equipment name is required");
        require(notBlank(request.plantCode()), "Plant code is required");

        String duplicateJpql = "select count(e) from MachFlowEquipment e where lower(e.assetCode)=:code"
                + (currentId == null ? "" : " and e.id<>:id");
        TypedQuery<Long> duplicateQuery = em.createQuery(duplicateJpql, Long.class)
                .setParameter("code", request.assetCode().trim().toLowerCase(Locale.ROOT));
        if (currentId != null) duplicateQuery.setParameter("id", currentId);
        Long duplicates = duplicateQuery.getSingleResult();
        require(duplicates == 0, "Asset code already exists");
    }

    private void applyEquipment(Equipment e, EquipmentUpsert r) {
        e.assetCode = clean(r.assetCode()).toUpperCase(Locale.ROOT);
        e.name = clean(r.name());
        e.category = clean(r.category());
        e.plantCode = normalizePlant(r.plantCode());
        e.location = clean(r.location());
        e.manufacturer = clean(r.manufacturer());
        e.model = clean(r.model());
        e.serialNumber = clean(r.serialNumber());
        e.criticality = r.criticality() == null ? Criticality.MEDIUM : r.criticality();
        e.status = r.status() == null ? EquipmentStatus.ACTIVE : r.status();
        e.maintenanceTeam = clean(r.maintenanceTeam());
        e.primaryTechnician = clean(r.primaryTechnician());
        e.owner = clean(r.owner());
        e.purchaseDate = r.purchaseDate();
        e.commissionedDate = r.commissionedDate();
        e.warrantyExpiry = r.warrantyExpiry();
        e.description = clean(r.description());
        e.safetyNotes = clean(r.safetyNotes());
    }

    /* =============================== TEAMS =============================== */

    public List<Map<String, Object>> listTeams(String plantCode) {
        Set<String> scope = readPlantScope(plantCode);
        return em.createQuery(
                        "select t from MachFlowTeam t where t.plantCode is null or t.plantCode in :plants order by t.active desc, t.name",
                        Team.class)
                .setParameter("plants", scope)
                .getResultList()
                .stream()
                .map(this::teamView)
                .toList();
    }

    public Map<String, Object> saveTeam(UUID id, TeamUpsert request) {
        require(request != null && notBlank(request.name()), "Team name is required");
        User current = currentUserService.requireCurrentUser();

        Team t = id == null ? new Team() : em.find(Team.class, id, LockModeType.PESSIMISTIC_WRITE);
        if (id != null && t == null) throw notFound("Team not found");
        if (id != null && notBlank(t.plantCode)) requirePlantWriteAccess(t.plantCode);

        String targetPlant = blankToNull(request.plantCode());
        if (targetPlant == null) {
            require(currentUserService.isAdmin(current), "Only ADMIN can create a company-wide maintenance team");
        } else {
            targetPlant = normalizePlant(targetPlant);
            requirePlantWriteAccess(targetPlant);
        }

        t.name = clean(request.name());
        t.plantCode = targetPlant;
        t.lead = clean(request.lead());
        t.membersText = clean(request.membersText());
        if (request.active() != null) t.active = request.active();
        t.updatedAt = LocalDateTime.now();
        if (id == null) em.persist(t);
        return teamView(t);
    }

    /* =============================== PREVENTIVE PLANS =============================== */

    public List<Map<String, Object>> listPlans(String plantCode, Boolean activeOnly) {
        Set<String> scope = readPlantScope(plantCode);
        return listPlanEntities(scope, Boolean.TRUE.equals(activeOnly)).stream().map(this::planView).toList();
    }

    public Map<String, Object> savePlan(UUID id, PreventivePlanUpsert request) {
        require(request != null, "Request body is required");
        require(request.equipmentId() != null, "Equipment is required");
        require(notBlank(request.title()), "Plan title is required");
        require(request.intervalDays() != null && request.intervalDays() > 0, "Interval days must be greater than zero");
        require(request.nextDueDate() != null, "Next due date is required");

        Equipment equipment = requireEquipment(request.equipmentId(), false);
        requirePlantWriteAccess(equipment.plantCode);

        PreventivePlan p = id == null
                ? new PreventivePlan()
                : em.find(PreventivePlan.class, id, LockModeType.PESSIMISTIC_WRITE);
        if (id != null && p == null) throw notFound("Preventive plan not found");
        if (id != null) {
            Equipment previousEquipment = requireEquipment(p.equipmentId, false);
            requirePlantWriteAccess(previousEquipment.plantCode);
        }

        p.equipmentId = equipment.id;
        p.equipmentName = equipment.name;
        p.title = clean(request.title());
        p.intervalDays = request.intervalDays();
        p.leadDays = request.leadDays() == null ? 3 : Math.max(0, request.leadDays());
        p.nextDueDate = request.nextDueDate();
        p.defaultPriority = request.defaultPriority() == null ? Priority.NORMAL : request.defaultPriority();
        p.teamName = firstNonBlank(request.teamName(), equipment.maintenanceTeam);
        p.responsible = firstNonBlank(request.responsible(), equipment.primaryTechnician);
        p.instructions = clean(request.instructions());
        p.active = request.active() == null || request.active();
        p.updatedAt = LocalDateTime.now();
        if (id == null) em.persist(p);
        updateEquipmentNextMaintenance(equipment.id);
        return planView(p);
    }

    /**
     * Manual generation is constrained to the signed-in user's authorised plants.
     * The scheduled run is intentionally system-wide and does not depend on a SecurityContext.
     */
    public int generateDuePreventiveOrders() {
        User current = currentUserService.requireCurrentUser();
        return generateDuePreventiveOrdersForPlants(readPlantScope(null), current.getUsername());
    }

    @Scheduled(cron = "0 10 1 * * *")
    public void generateDuePreventiveOrdersScheduled() {
        generateDuePreventiveOrdersForPlants(null, "SYSTEM");
    }

    private int generateDuePreventiveOrdersForPlants(Set<String> allowedPlants, String actor) {
        LocalDate today = LocalDate.now();
        StringBuilder jpql = new StringBuilder(
                "select p from MachFlowPreventivePlan p where p.active=true and p.nextDueDate<=:cutoff");
        if (allowedPlants != null) {
            jpql.append(" and p.equipmentId in (select e.id from MachFlowEquipment e where e.plantCode in :plants)");
        }
        jpql.append(" order by p.nextDueDate");

        TypedQuery<PreventivePlan> query = em.createQuery(jpql.toString(), PreventivePlan.class)
                .setParameter("cutoff", today.plusDays(30));
        if (allowedPlants != null) query.setParameter("plants", allowedPlants);
        List<PreventivePlan> plans = query.getResultList();

        int created = 0;
        for (PreventivePlan p : plans) {
            if (p.nextDueDate.isAfter(today.plusDays(p.leadDays))) continue;
            if (p.lastGeneratedFor != null && p.lastGeneratedFor.equals(p.nextDueDate)) continue;

            Equipment e = em.find(Equipment.class, p.equipmentId);
            if (e == null || e.status == EquipmentStatus.RETIRED) continue;
            if (allowedPlants != null && !allowedPlants.contains(normalizePlant(e.plantCode))) continue;

            WorkOrder w = new WorkOrder();
            w.workNumber = nextWorkNumber();
            w.title = p.title + " · " + e.name;
            w.instructions = p.instructions;
            w.equipmentId = e.id;
            w.equipmentName = e.name;
            w.plantCode = e.plantCode;
            w.location = e.location;
            w.requestedBy = "MachFlow PM Scheduler";
            w.teamName = p.teamName;
            w.responsible = p.responsible;
            w.workType = WorkType.PREVENTIVE;
            w.status = WorkStatus.PLANNED;
            w.priority = p.defaultPriority;
            w.requestedAt = LocalDateTime.now();
            w.scheduledAt = p.nextDueDate.atTime(LocalTime.of(9, 0));
            w.estimatedMinutes = 60;
            w.downtimeMinutes = 0;
            w.breakdown = false;
            w.preventivePlanId = p.id;
            w.createdBy = actor;
            w.updatedBy = actor;
            w.createdAt = LocalDateTime.now();
            w.updatedAt = w.createdAt;
            em.persist(w);
            audit("WORK_ORDER", w.id, "PM_AUTO_CREATED", null, WorkStatus.PLANNED.name(), actor, p.title);

            p.lastGeneratedFor = p.nextDueDate;
            p.nextDueDate = p.nextDueDate.plusDays(p.intervalDays);
            p.updatedAt = LocalDateTime.now();
            updateEquipmentNextMaintenance(e.id);
            created++;
        }
        return created;
    }

    /* =============================== CALENDAR / REPORTS =============================== */

    public List<Map<String, Object>> calendar(LocalDate from, LocalDate to, String plantCode) {
        Set<String> scope = readPlantScope(plantCode);
        LocalDate start = from == null ? LocalDate.now().with(java.time.DayOfWeek.MONDAY) : from;
        LocalDate end = to == null ? start.plusDays(13) : to;
        require(!end.isBefore(start), "Calendar end date cannot be before start date");
        LocalDateTime startAt = start.atStartOfDay();
        LocalDateTime endAt = end.plusDays(1).atStartOfDay();

        List<WorkOrder> orders = em.createQuery(
                        "select w from MachFlowWorkOrder w where w.scheduledAt>=:from and w.scheduledAt<:to and w.plantCode in :plants order by w.scheduledAt",
                        WorkOrder.class
                )
                .setParameter("from", startAt)
                .setParameter("to", endAt)
                .setParameter("plants", scope)
                .getResultList();

        List<Map<String, Object>> events = new ArrayList<>();
        for (WorkOrder w : orders) {
            events.add(map(
                    "id", w.id,
                    "kind", "WORK_ORDER",
                    "title", w.title,
                    "number", w.workNumber,
                    "date", w.scheduledAt.toLocalDate(),
                    "start", w.scheduledAt,
                    "minutes", w.estimatedMinutes == null ? 60 : w.estimatedMinutes,
                    "responsible", w.responsible,
                    "equipment", w.equipmentName,
                    "status", w.status.name(),
                    "priority", w.priority.name(),
                    "plantCode", w.plantCode
            ));
        }

        for (PreventivePlan p : listPlanEntities(scope, true)) {
            if (p.nextDueDate.isBefore(start) || p.nextDueDate.isAfter(end)) continue;
            events.add(map(
                    "id", p.id,
                    "kind", "PM_DUE",
                    "title", p.title,
                    "date", p.nextDueDate,
                    "responsible", p.responsible,
                    "equipment", p.equipmentName,
                    "priority", p.defaultPriority.name()
            ));
        }
        events.sort(Comparator.comparing(o -> String.valueOf(o.get("date"))));
        return events;
    }

    public Map<String, Object> reports(LocalDate from, LocalDate to, String plantCode) {
        Set<String> scope = readPlantScope(plantCode);
        LocalDate start = from == null ? LocalDate.now().minusMonths(6).withDayOfMonth(1) : from;
        LocalDate end = to == null ? LocalDate.now() : to;
        LocalDateTime fromAt = start.atStartOfDay();
        LocalDateTime toAt = end.plusDays(1).atStartOfDay();

        List<WorkOrder> orders = listOrdersByCreatedRange(scope, fromAt, toAt);

        Map<String, List<WorkOrder>> byTechnician = orders.stream()
                .filter(w -> notBlank(w.responsible))
                .collect(Collectors.groupingBy(w -> w.responsible));
        List<Map<String, Object>> technicians = byTechnician.entrySet().stream()
                .map(e -> {
                    List<WorkOrder> list = e.getValue();
                    long closed = list.stream().filter(w -> w.status == WorkStatus.CLOSED || w.status == WorkStatus.REPAIRED).count();
                    double avgRepair = list.stream().map(this::resolvedActualMinutes).filter(Objects::nonNull).mapToInt(Integer::intValue).average().orElse(0);
                    long downtime = list.stream().map(w -> w.downtimeMinutes).filter(Objects::nonNull).mapToLong(Integer::longValue).sum();
                    return map("name", e.getKey(), "orders", list.size(), "closed", closed, "avgRepairHours", round(avgRepair / 60.0, 1), "downtimeHours", round(downtime / 60.0, 1));
                })
                .sorted(Comparator.comparing(o -> -((Number) o.get("orders")).intValue()))
                .toList();

        Map<String, List<WorkOrder>> byEquipment = orders.stream()
                .filter(w -> notBlank(w.equipmentName))
                .collect(Collectors.groupingBy(w -> w.equipmentName));
        List<Map<String, Object>> assets = byEquipment.entrySet().stream()
                .map(e -> {
                    List<WorkOrder> list = e.getValue();
                    long failures = list.stream().filter(w -> w.breakdown).count();
                    long downtime = list.stream().map(w -> w.downtimeMinutes).filter(Objects::nonNull).mapToLong(Integer::longValue).sum();
                    BigDecimal cost = list.stream().map(this::totalCost).reduce(BigDecimal.ZERO, BigDecimal::add);
                    return map("name", e.getKey(), "orders", list.size(), "failures", failures, "downtimeHours", round(downtime / 60.0, 1), "cost", cost);
                })
                .sorted(Comparator.comparing(o -> -((Number) o.get("failures")).intValue()))
                .limit(20)
                .toList();

        Map<YearMonth, List<WorkOrder>> byMonth = orders.stream().collect(Collectors.groupingBy(w -> YearMonth.from(w.createdAt)));
        List<Map<String, Object>> months = byMonth.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(e -> map(
                        "month", e.getKey().toString(),
                        "opened", e.getValue().size(),
                        "closed", e.getValue().stream().filter(w -> w.status == WorkStatus.CLOSED || w.status == WorkStatus.REPAIRED).count(),
                        "breakdowns", e.getValue().stream().filter(w -> w.breakdown).count(),
                        "downtimeHours", round(e.getValue().stream().map(w -> w.downtimeMinutes).filter(Objects::nonNull).mapToLong(Integer::longValue).sum() / 60.0, 1)
                ))
                .toList();

        BigDecimal totalCost = orders.stream().map(this::totalCost).reduce(BigDecimal.ZERO, BigDecimal::add);
        long corrective = orders.stream().filter(w -> w.workType == WorkType.CORRECTIVE).count();
        long preventive = orders.stream().filter(w -> w.workType == WorkType.PREVENTIVE).count();
        long completed = orders.stream().filter(w -> w.status == WorkStatus.CLOSED || w.status == WorkStatus.REPAIRED).count();

        return map(
                "from", start,
                "to", end,
                "summary", map(
                        "orders", orders.size(),
                        "completed", completed,
                        "corrective", corrective,
                        "preventive", preventive,
                        "plannedRatio", orders.isEmpty() ? 0 : round(100.0 * preventive / Math.max(1, corrective + preventive), 1),
                        "totalCost", totalCost
                ),
                "byTechnician", technicians,
                "byEquipment", assets,
                "monthly", months
        );
    }

    public List<Map<String, Object>> categories() {
        Set<String> scope = readPlantScope(null);
        List<String> names = em.createQuery(
                        "select distinct e.category from MachFlowEquipment e where e.plantCode in :plants and e.category is not null and e.category<>'' order by e.category",
                        String.class
                )
                .setParameter("plants", scope)
                .getResultList();
        return names.stream().map(n -> map("name", n)).toList();
    }

    public List<Map<String, Object>> plants() {
        User current = currentUserService.requireCurrentUser();
        return currentUserService.allowedPlants(current)
                .stream()
                .filter(Objects::nonNull)
                .map(MachFlowService::normalizePlant)
                .filter(MachFlowService::notBlank)
                .distinct()
                .sorted()
                .map(n -> map("name", n))
                .toList();
    }

    public List<Map<String, Object>> users(String plantCode) {
        User current = currentUserService.requireCurrentUser();
        Set<String> scope = readPlantScope(plantCode);
        boolean currentIsAdmin = currentUserService.isAdmin(current);

        return userRepository.findAll(Sort.by(Sort.Direction.ASC, "username"))
                .stream()
                .filter(User::isEnabled)
                .filter(this::isMachFlowUser)
                .filter(user -> {
                    if (currentIsAdmin) {
                        if (!notBlank(plantCode)) return true;
                    }
                    Set<String> userPlants = safePlants(user);
                    return userPlants.stream().anyMatch(scope::contains);
                })
                .map(user -> map(
                        "id", user.getUsername(),
                        "username", user.getUsername(),
                        "displayName", user.getUsername(),
                        "roles", user.getEffectiveRoles().stream()
                                .filter(Objects::nonNull)
                                .map(String::trim)
                                .sorted()
                                .toList(),
                        "plantCodes", safePlants(user).stream().sorted().toList()
                ))
                .toList();
    }

    /* =============================== INTERNAL QUERIES =============================== */

    private QueryResult<WorkOrder> queryOrders(
            Set<String> plants,
            WorkStatus status,
            WorkType type,
            Priority priority,
            UUID equipmentId,
            String responsible,
            String search,
            int page,
            int size
    ) {
        StringBuilder where = new StringBuilder(" where w.plantCode in :plants ");
        Map<String, Object> params = new HashMap<>();
        params.put("plants", plants);

        if (status != null) {
            where.append(" and w.status=:status ");
            params.put("status", status);
        }
        if (type != null) {
            where.append(" and w.workType=:type ");
            params.put("type", type);
        }
        if (priority != null) {
            where.append(" and w.priority=:priority ");
            params.put("priority", priority);
        }
        if (equipmentId != null) {
            where.append(" and w.equipmentId=:equipmentId ");
            params.put("equipmentId", equipmentId);
        }
        if (notBlank(responsible)) {
            where.append(" and lower(w.responsible)=:responsible ");
            params.put("responsible", clean(responsible).toLowerCase(Locale.ROOT));
        }
        if (notBlank(search)) {
            where.append(" and (lower(w.title) like :search or lower(w.workNumber) like :search or lower(coalesce(w.equipmentName,'')) like :search or lower(coalesce(w.requestedBy,'')) like :search) ");
            params.put("search", "%" + clean(search).toLowerCase(Locale.ROOT) + "%");
        }

        TypedQuery<WorkOrder> query = em.createQuery(
                "select w from MachFlowWorkOrder w" + where + " order by w.createdAt desc",
                WorkOrder.class);
        TypedQuery<Long> count = em.createQuery(
                "select count(w) from MachFlowWorkOrder w" + where,
                Long.class);
        params.forEach((key, value) -> {
            query.setParameter(key, value);
            count.setParameter(key, value);
        });
        query.setFirstResult(Math.max(0, page) * size);
        query.setMaxResults(size);
        return new QueryResult<>(query.getResultList(), count.getSingleResult());
    }

    private List<Equipment> listEquipmentEntities(
            Set<String> plants,
            EquipmentStatus status,
            String category,
            String search) {
        StringBuilder jpql = new StringBuilder(
                "select e from MachFlowEquipment e where e.plantCode in :plants");
        Map<String, Object> params = new HashMap<>();
        params.put("plants", plants);
        if (status != null) {
            jpql.append(" and e.status=:status");
            params.put("status", status);
        }
        if (notBlank(category)) {
            jpql.append(" and lower(e.category)=:category");
            params.put("category", clean(category).toLowerCase(Locale.ROOT));
        }
        if (notBlank(search)) {
            jpql.append(" and (lower(e.name) like :q or lower(e.assetCode) like :q or lower(coalesce(e.serialNumber,'')) like :q or lower(coalesce(e.category,'')) like :q)");
            params.put("q", "%" + clean(search).toLowerCase(Locale.ROOT) + "%");
        }
        jpql.append(" order by e.name");
        TypedQuery<Equipment> query = em.createQuery(jpql.toString(), Equipment.class);
        params.forEach(query::setParameter);
        return query.getResultList();
    }

    private List<PreventivePlan> listPlanEntities(Set<String> plants, boolean activeOnly) {
        StringBuilder jpql = new StringBuilder(
                "select p from MachFlowPreventivePlan p where p.equipmentId in (select e.id from MachFlowEquipment e where e.plantCode in :plants)");
        if (activeOnly) jpql.append(" and p.active=true");
        jpql.append(" order by p.nextDueDate, p.equipmentName");
        return em.createQuery(jpql.toString(), PreventivePlan.class)
                .setParameter("plants", plants)
                .getResultList();
    }

    private List<WorkOrder> listOrdersByCreatedRange(
            Set<String> plants,
            LocalDateTime from,
            LocalDateTime to) {
        return em.createQuery(
                        "select w from MachFlowWorkOrder w where w.createdAt>=:from and w.createdAt<:to and w.plantCode in :plants order by w.createdAt",
                        WorkOrder.class
                )
                .setParameter("from", from)
                .setParameter("to", to)
                .setParameter("plants", plants)
                .getResultList();
    }

    private List<WorkOrder> listOrdersForEquipment(UUID equipmentId, int limit) {
        return em.createQuery(
                        "select w from MachFlowWorkOrder w where w.equipmentId=:id order by w.createdAt desc",
                        WorkOrder.class
                )
                .setParameter("id", equipmentId)
                .setMaxResults(limit)
                .getResultList();
    }

    private Map<UUID, Long> openWorkOrderCountsByEquipment(Set<String> plants) {
        List<Object[]> rows = em.createQuery(
                        "select w.equipmentId, count(w) from MachFlowWorkOrder w where w.equipmentId is not null and w.status not in :terminal and w.plantCode in :plants group by w.equipmentId",
                        Object[].class
                )
                .setParameter("terminal", TERMINAL)
                .setParameter("plants", plants)
                .getResultList();
        return rows.stream().collect(Collectors.toMap(r -> (UUID) r[0], r -> (Long) r[1]));
    }

    /* =============================== DOMAIN HELPERS =============================== */

    private WorkOrder requireOrder(UUID id, boolean lock) {
        WorkOrder w = lock ? em.find(WorkOrder.class, id, LockModeType.PESSIMISTIC_WRITE) : em.find(WorkOrder.class, id);
        if (w == null) throw notFound("Work order not found");
        return w;
    }

    private Equipment requireEquipment(UUID id, boolean lock) {
        Equipment e = lock ? em.find(Equipment.class, id, LockModeType.PESSIMISTIC_WRITE) : em.find(Equipment.class, id);
        if (e == null) throw notFound("Equipment not found");
        return e;
    }

    private void hydrateEquipmentSnapshot(WorkOrder w, UUID equipmentId, String fallbackPlant, String fallbackLocation) {
        if (equipmentId == null) {
            w.equipmentId = null;
            w.equipmentName = null;
            w.plantCode = normalizePlant(fallbackPlant);
            w.location = clean(fallbackLocation);
            require(notBlank(w.plantCode), "Plant code is required when no equipment is selected");
            requirePlantWriteAccess(w.plantCode);
            return;
        }
        Equipment e = requireEquipment(equipmentId, false);
        requirePlantWriteAccess(e.plantCode);
        require(e.status != EquipmentStatus.RETIRED, "Cannot create maintenance work for retired equipment");
        w.equipmentId = e.id;
        w.equipmentName = e.name;
        w.plantCode = e.plantCode;
        w.location = e.location;
        if (!notBlank(w.teamName)) w.teamName = e.maintenanceTeam;
        if (!notBlank(w.responsible)) w.responsible = e.primaryTechnician;
    }

    private void registerFailureOnce(WorkOrder w) {
        if (!w.breakdown || w.failureRegistered || w.equipmentId == null) return;
        Equipment e = em.find(Equipment.class, w.equipmentId, LockModeType.PESSIMISTIC_WRITE);
        if (e == null) return;
        e.failureCount++;
        if (w.downtimeMinutes != null) e.downtimeMinutes += w.downtimeMinutes;
        e.lastMaintenanceAt = w.closedAt == null ? LocalDateTime.now() : w.closedAt;
        e.updatedAt = LocalDateTime.now();
        w.failureRegistered = true;
    }

    private void syncEquipmentState(UUID equipmentId) {
        if (equipmentId == null) return;
        Equipment e = em.find(Equipment.class, equipmentId, LockModeType.PESSIMISTIC_WRITE);
        if (e == null || e.status == EquipmentStatus.RETIRED) return;

        List<WorkOrder> active = em.createQuery(
                        "select w from MachFlowWorkOrder w where w.equipmentId=:id and w.status not in :terminal order by w.createdAt desc",
                        WorkOrder.class
                )
                .setParameter("id", equipmentId)
                .setParameter("terminal", TERMINAL)
                .getResultList();

        boolean stopped = active.stream().anyMatch(w -> w.productionStopped && (w.status == WorkStatus.NEW || w.status == WorkStatus.PLANNED || w.status == WorkStatus.IN_PROGRESS || w.status == WorkStatus.WAITING_PARTS));
        boolean beingWorked = active.stream().anyMatch(w -> w.status == WorkStatus.IN_PROGRESS || w.status == WorkStatus.WAITING_PARTS);
        e.status = stopped ? EquipmentStatus.DOWN : beingWorked ? EquipmentStatus.UNDER_MAINTENANCE : EquipmentStatus.ACTIVE;
        e.updatedAt = LocalDateTime.now();
        updateEquipmentNextMaintenance(equipmentId);
    }

    private void updateEquipmentNextMaintenance(UUID equipmentId) {
        if (equipmentId == null) return;
        Equipment e = em.find(Equipment.class, equipmentId);
        if (e == null) return;
        List<LocalDate> dates = em.createQuery(
                        "select p.nextDueDate from MachFlowPreventivePlan p where p.equipmentId=:id and p.active=true order by p.nextDueDate",
                        LocalDate.class
                )
                .setParameter("id", equipmentId)
                .setMaxResults(1)
                .getResultList();
        e.nextMaintenanceAt = dates.isEmpty() ? null : dates.get(0).atTime(9, 0);
    }

    private Map<String, Object> equipmentHealth(Equipment e) {
        List<WorkOrder> recent = em.createQuery(
                        "select w from MachFlowWorkOrder w where w.equipmentId=:id and w.createdAt>=:from order by w.createdAt desc",
                        WorkOrder.class
                )
                .setParameter("id", e.id)
                .setParameter("from", LocalDateTime.now().minusDays(90))
                .getResultList();
        long open = recent.stream().filter(w -> !TERMINAL.contains(w.status)).count();
        long failures30 = recent.stream().filter(w -> w.breakdown && !w.createdAt.isBefore(LocalDateTime.now().minusDays(30))).count();
        boolean overduePm = e.nextMaintenanceAt != null && e.nextMaintenanceAt.isBefore(LocalDateTime.now());

        int score = 100;
        if (e.status == EquipmentStatus.DOWN) score -= 35;
        else if (e.status == EquipmentStatus.UNDER_MAINTENANCE) score -= 20;
        if (overduePm) score -= 20;
        score -= Math.min(20, (int) open * 5);
        score -= Math.min(20, (int) failures30 * 4);
        score = Math.max(0, score);

        List<WorkOrder> repairs = recent.stream()
                .filter(w -> w.breakdown && (w.status == WorkStatus.REPAIRED || w.status == WorkStatus.CLOSED))
                .sorted(Comparator.comparing(w -> w.closedAt == null ? w.repairedAt : w.closedAt))
                .toList();
        double mttrHours = repairs.stream().map(this::resolvedActualMinutes).filter(Objects::nonNull).mapToInt(Integer::intValue).average().orElse(0) / 60.0;

        List<LocalDateTime> failureDates = repairs.stream()
                .map(w -> w.closedAt == null ? w.repairedAt : w.closedAt)
                .filter(Objects::nonNull)
                .sorted()
                .toList();
        double mtbfDays = 0;
        if (failureDates.size() >= 2) {
            long totalDays = 0;
            for (int i = 1; i < failureDates.size(); i++) totalDays += ChronoUnit.DAYS.between(failureDates.get(i - 1), failureDates.get(i));
            mtbfDays = totalDays / (double) (failureDates.size() - 1);
        }

        return map(
                "score", score,
                "label", score >= 85 ? "Healthy" : score >= 65 ? "Watch" : score >= 40 ? "At Risk" : "Critical",
                "openWorkOrders", open,
                "failures30", failures30,
                "pmOverdue", overduePm,
                "mttrHours", round(mttrHours, 1),
                "mtbfDays", round(mtbfDays, 1),
                "lifetimeFailures", e.failureCount,
                "lifetimeDowntimeHours", round(e.downtimeMinutes / 60.0, 1)
        );
    }

    private void audit(String entityType, UUID entityId, String action, String from, String to, String actor, String note) {
        AuditEvent event = new AuditEvent();
        event.entityType = entityType;
        event.entityId = entityId;
        event.action = action;
        event.fromStatus = from;
        event.toStatus = to;
        event.actor = actor;
        event.note = note;
        event.createdAt = LocalDateTime.now();
        em.persist(event);
    }

    private List<Map<String, Object>> listAudit(String entityType, UUID entityId) {
        return em.createQuery(
                        "select a from MachFlowAuditEvent a where a.entityType=:type and a.entityId=:id order by a.createdAt desc",
                        AuditEvent.class
                )
                .setParameter("type", entityType)
                .setParameter("id", entityId)
                .setMaxResults(100)
                .getResultList()
                .stream().map(a -> map(
                        "id", a.id,
                        "action", a.action,
                        "fromStatus", a.fromStatus,
                        "toStatus", a.toStatus,
                        "actor", a.actor,
                        "note", a.note,
                        "createdAt", a.createdAt
                )).toList();
    }

    /* =============================== VIEW MAPPERS =============================== */

    private Map<String, Object> workOrderSummary(WorkOrder w) {
        return map(
                "id", w.id,
                "workNumber", w.workNumber,
                "title", w.title,
                "equipmentId", w.equipmentId,
                "equipmentName", w.equipmentName,
                "plantCode", w.plantCode,
                "location", w.location,
                "requestedBy", w.requestedBy,
                "teamName", w.teamName,
                "responsible", w.responsible,
                "workType", w.workType.name(),
                "status", w.status.name(),
                "priority", w.priority.name(),
                "requestedAt", w.requestedAt,
                "scheduledAt", w.scheduledAt,
                "startedAt", w.startedAt,
                "repairedAt", w.repairedAt,
                "closedAt", w.closedAt,
                "estimatedMinutes", w.estimatedMinutes,
                "actualMinutes", resolvedActualMinutes(w),
                "downtimeMinutes", w.downtimeMinutes,
                "breakdown", w.breakdown,
                "productionStopped", w.productionStopped,
                "safetyRisk", w.safetyRisk,
                "totalCost", totalCost(w),
                "overdue", w.scheduledAt != null && w.scheduledAt.isBefore(LocalDateTime.now()) && !TERMINAL.contains(w.status),
                "version", w.version
        );
    }

    private Map<String, Object> workOrderDetail(WorkOrder w) {
        Map<String, Object> out = workOrderSummary(w);
        out.put("description", w.description);
        out.put("instructions", w.instructions);
        out.put("rootCause", w.rootCause);
        out.put("actionTaken", w.actionTaken);
        out.put("partsUsed", w.partsUsed);
        out.put("partsCost", w.partsCost);
        out.put("laborCost", w.laborCost);
        out.put("externalCost", w.externalCost);
        out.put("verificationNote", w.verificationNote);
        out.put("preventivePlanId", w.preventivePlanId);
        out.put("createdBy", w.createdBy);
        out.put("createdAt", w.createdAt);
        out.put("updatedBy", w.updatedBy);
        out.put("updatedAt", w.updatedAt);
        return out;
    }

    private Map<String, Object> equipmentSummary(Equipment e, long openCount) {
        return map(
                "id", e.id,
                "assetCode", e.assetCode,
                "name", e.name,
                "category", e.category,
                "plantCode", e.plantCode,
                "location", e.location,
                "manufacturer", e.manufacturer,
                "model", e.model,
                "serialNumber", e.serialNumber,
                "criticality", e.criticality.name(),
                "status", e.status.name(),
                "maintenanceTeam", e.maintenanceTeam,
                "primaryTechnician", e.primaryTechnician,
                "nextMaintenanceAt", e.nextMaintenanceAt,
                "lastMaintenanceAt", e.lastMaintenanceAt,
                "openWorkOrders", openCount,
                "failureCount", e.failureCount,
                "version", e.version
        );
    }

    private Map<String, Object> equipmentDetail(Equipment e) {
        Map<String, Object> out = equipmentSummary(e, openWorkOrderCountsByEquipment(Set.of(e.plantCode)).getOrDefault(e.id, 0L));
        out.put("owner", e.owner);
        out.put("purchaseDate", e.purchaseDate);
        out.put("commissionedDate", e.commissionedDate);
        out.put("warrantyExpiry", e.warrantyExpiry);
        out.put("downtimeMinutes", e.downtimeMinutes);
        out.put("description", e.description);
        out.put("safetyNotes", e.safetyNotes);
        out.put("createdBy", e.createdBy);
        out.put("createdAt", e.createdAt);
        out.put("updatedBy", e.updatedBy);
        out.put("updatedAt", e.updatedAt);
        return out;
    }

    private Map<String, Object> teamView(Team t) {
        List<String> members = notBlank(t.membersText)
                ? List.of(t.membersText.split("\\s*,\\s*|\\s*\\n\\s*"))
                : List.of();
        return map(
                "id", t.id,
                "name", t.name,
                "plantCode", t.plantCode,
                "lead", t.lead,
                "membersText", t.membersText,
                "members", members,
                "active", t.active,
                "version", t.version
        );
    }

    private Map<String, Object> planView(PreventivePlan p) {
        return map(
                "id", p.id,
                "equipmentId", p.equipmentId,
                "equipmentName", p.equipmentName,
                "title", p.title,
                "intervalDays", p.intervalDays,
                "leadDays", p.leadDays,
                "nextDueDate", p.nextDueDate,
                "defaultPriority", p.defaultPriority.name(),
                "teamName", p.teamName,
                "responsible", p.responsible,
                "instructions", p.instructions,
                "active", p.active,
                "lastGeneratedFor", p.lastGeneratedFor,
                "version", p.version
        );
    }

    /* =============================== ACCESS / USER HELPERS =============================== */

    private Set<String> readPlantScope(String requestedPlantCode) {
        User user = currentUserService.requireCurrentUser();
        Set<String> allowed = currentUserService.allowedPlants(user)
                .stream()
                .filter(Objects::nonNull)
                .map(MachFlowService::normalizePlant)
                .filter(MachFlowService::notBlank)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        if (allowed.isEmpty()) {
            throw forbidden("No plant access assigned for MachFlow");
        }

        if (notBlank(requestedPlantCode)) {
            String requested = normalizePlant(requestedPlantCode);
            if (!allowed.contains(requested)) {
                throw forbidden("You do not have MachFlow access to plant " + requested);
            }
            return Set.of(requested);
        }
        return Set.copyOf(allowed);
    }

    private void requirePlantReadAccess(String plantCode) {
        requirePlantAccess(plantCode);
    }

    private void requirePlantWriteAccess(String plantCode) {
        requirePlantAccess(plantCode);
    }

    private void requirePlantAccess(String plantCode) {
        String normalized = normalizePlant(plantCode);
        if (!notBlank(normalized)) {
            throw forbidden("Plant access is required");
        }
        User user = currentUserService.requireCurrentUser();
        if (!currentUserService.canAccessPlant(user, normalized)) {
            throw forbidden("You do not have MachFlow access to plant " + normalized);
        }
    }

    private boolean canPlan(User user) {
        return currentUserService.isAdmin(user)
                || currentUserService.hasAnyRole(
                        user,
                        "MACHFLOW_MANAGER",
                        "MACHFLOW_PLANNER");
    }

    private boolean isMachFlowUser(User user) {
        return currentUserService.hasAnyRole(
                user,
                "MACHFLOW_MANAGER",
                "MACHFLOW_PLANNER",
                "MACHFLOW_TECHNICIAN",
                "MACHFLOW_REQUESTER");
    }

    private Set<String> safePlants(User user) {
        if (user == null || user.getEffectivePlantCodes() == null) return Set.of();
        return user.getEffectivePlantCodes()
                .stream()
                .filter(Objects::nonNull)
                .map(MachFlowService::normalizePlant)
                .filter(MachFlowService::notBlank)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private static String normalizePlant(String value) {
        return notBlank(value) ? value.trim().toUpperCase(Locale.ROOT) : null;
    }

    /* =============================== SMALL UTILITIES =============================== */

    private String nextWorkNumber() {
        String date = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
        String random = UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase(Locale.ROOT);
        return "MF-" + date + "-" + random;
    }

    private Integer resolvedActualMinutes(WorkOrder w) {
        if (w.actualMinutes != null) return w.actualMinutes;
        LocalDateTime end = w.repairedAt != null ? w.repairedAt : w.closedAt;
        if (w.startedAt != null && end != null) return Math.toIntExact(Math.max(0, Duration.between(w.startedAt, end).toMinutes()));
        return null;
    }

    private BigDecimal totalCost(WorkOrder w) {
        return money(w.partsCost).add(money(w.laborCost)).add(money(w.externalCost));
    }

    private BigDecimal money(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }

    private Integer nonNegative(Integer value, String field) {
        if (value == null) return null;
        require(value >= 0, field + " cannot be negative");
        return value;
    }

    private void checkVersion(long current, Long supplied) {
        if (supplied != null && supplied != current) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This record changed after you opened it. Refresh and retry.");
        }
    }

    private String actor(Authentication auth) {
        return auth == null || !notBlank(auth.getName()) ? "SYSTEM" : auth.getName();
    }

    private static String clean(String value) {
        return value == null ? null : value.trim();
    }

    private static String blankToNull(String value) {
        return notBlank(value) ? value.trim() : null;
    }

    private static boolean notBlank(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private static String firstNonBlank(String first, String second) {
        return notBlank(first) ? clean(first) : clean(second);
    }

    private static double round(double value, int scale) {
        return BigDecimal.valueOf(value).setScale(scale, RoundingMode.HALF_UP).doubleValue();
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw badRequest(message);
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private static ResponseStatusException notFound(String message) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
    }

    private static ResponseStatusException forbidden(String message) {
        return new ResponseStatusException(HttpStatus.FORBIDDEN, message);
    }

    private static Map<String, Object> map(Object... entries) {
        LinkedHashMap<String, Object> out = new LinkedHashMap<>();
        for (int i = 0; i < entries.length; i += 2) out.put(String.valueOf(entries[i]), entries[i + 1]);
        return out;
    }

    private record QueryResult<T>(List<T> items, long total) {
    }
}
