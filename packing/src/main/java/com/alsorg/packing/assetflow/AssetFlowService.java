package com.alsorg.packing.assetflow;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.assetflow.AssetFlowData.AssignmentRequest;
import com.alsorg.packing.assetflow.AssetFlowData.AssetKind;
import com.alsorg.packing.assetflow.AssetFlowData.AuthenticatedRequestCreate;
import com.alsorg.packing.assetflow.AssetFlowData.AuditEvent;
import com.alsorg.packing.assetflow.AssetFlowData.ComplaintSource;
import com.alsorg.packing.assetflow.AssetFlowData.Criticality;
import com.alsorg.packing.assetflow.AssetFlowData.Equipment;
import com.alsorg.packing.assetflow.AssetFlowData.EquipmentStatus;
import com.alsorg.packing.assetflow.AssetFlowData.EquipmentUpsert;
import com.alsorg.packing.assetflow.AssetFlowData.PreventivePlan;
import com.alsorg.packing.assetflow.AssetFlowData.PreventivePlanUpsert;
import com.alsorg.packing.assetflow.AssetFlowData.Priority;
import com.alsorg.packing.assetflow.AssetFlowData.PublicRequestCreate;
import com.alsorg.packing.assetflow.AssetFlowData.Reporter;
import com.alsorg.packing.assetflow.AssetFlowData.ReporterLogin;
import com.alsorg.packing.assetflow.AssetFlowData.ReporterType;
import com.alsorg.packing.assetflow.AssetFlowData.ReporterUpsert;
import com.alsorg.packing.assetflow.AssetFlowData.ServiceDomain;
import com.alsorg.packing.assetflow.AssetFlowData.StatusChange;
import com.alsorg.packing.assetflow.AssetFlowData.Team;
import com.alsorg.packing.assetflow.AssetFlowData.TeamUpsert;
import com.alsorg.packing.assetflow.AssetFlowData.WorkOrder;
import com.alsorg.packing.assetflow.AssetFlowData.WorkOrderUpsert;
import com.alsorg.packing.assetflow.AssetFlowData.WorkStatus;
import com.alsorg.packing.assetflow.AssetFlowData.WorkType;
import com.alsorg.packing.repository.UserRepository;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.PlantLocationService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import jakarta.transaction.Transactional;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
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
public class AssetFlowService {

    private static final Set<WorkStatus> TERMINAL = EnumSet.of(
            WorkStatus.CLOSED,
            WorkStatus.SCRAPPED,
            WorkStatus.CANCELLED
    );

    private static final Map<WorkStatus, Set<WorkStatus>> TRANSITIONS = Map.ofEntries(
            Map.entry(WorkStatus.NEW, EnumSet.of(WorkStatus.PLANNED, WorkStatus.ASSIGNED, WorkStatus.CANCELLED, WorkStatus.SCRAPPED)),
            Map.entry(WorkStatus.PLANNED, EnumSet.of(WorkStatus.ASSIGNED, WorkStatus.ACCEPTED, WorkStatus.CANCELLED, WorkStatus.SCRAPPED)),
            Map.entry(WorkStatus.ASSIGNED, EnumSet.of(WorkStatus.ACCEPTED, WorkStatus.PLANNED, WorkStatus.CANCELLED, WorkStatus.SCRAPPED)),
            Map.entry(WorkStatus.ACCEPTED, EnumSet.of(WorkStatus.IN_PROGRESS, WorkStatus.ASSIGNED, WorkStatus.CANCELLED)),
            Map.entry(WorkStatus.IN_PROGRESS, EnumSet.of(WorkStatus.WAITING_PARTS, WorkStatus.REPAIRED)),
            Map.entry(WorkStatus.WAITING_PARTS, EnumSet.of(WorkStatus.IN_PROGRESS, WorkStatus.REPAIRED, WorkStatus.CANCELLED)),
            Map.entry(WorkStatus.REPAIRED, EnumSet.of(WorkStatus.CLOSED, WorkStatus.IN_PROGRESS)),
            Map.entry(WorkStatus.CLOSED, EnumSet.of(WorkStatus.IN_PROGRESS)),
            Map.entry(WorkStatus.SCRAPPED, EnumSet.of(WorkStatus.NEW)),
            Map.entry(WorkStatus.CANCELLED, EnumSet.of(WorkStatus.NEW))
    );

    @PersistenceContext
    private EntityManager em;

    private final CurrentUserService currentUserService;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final PlantLocationService plantLocationService;
    private final AssetFlowReporterAuthStateService reporterAuthStateService;

    public AssetFlowService(
            CurrentUserService currentUserService,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            PlantLocationService plantLocationService,
            AssetFlowReporterAuthStateService reporterAuthStateService) {
        this.currentUserService = currentUserService;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.plantLocationService = plantLocationService;
        this.reporterAuthStateService = reporterAuthStateService;
    }

    /* =============================== DASHBOARD =============================== */

    public Map<String, Object> dashboard(String plantCode, ServiceDomain requestedDomain) {
        User currentUser = currentUserService.requireCurrentUser();
        Set<String> scope = readPlantScope(plantCode);
        Set<ServiceDomain> domainScope = readDomainScope(currentUser, requestedDomain);
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime monthAgo = now.minusDays(30);
        LocalDateTime ninetyDaysAgo = now.minusDays(90);

        List<WorkOrder> openOrders = em.createQuery(
                        "select w from AssetFlowWorkOrder w where w.status not in :terminal and w.plantCode in :plants order by w.createdAt desc",
                        WorkOrder.class
                )
                .setParameter("terminal", TERMINAL)
                .setParameter("plants", scope)
                .getResultList()
                .stream()
                .filter(w -> domainScope.contains(domainOf(w)))
                .filter(w -> canReadOrder(currentUser, w))
                .toList();

        long overdue = openOrders.stream()
                .filter(w -> w.scheduledAt != null && w.scheduledAt.isBefore(now))
                .count();
        long critical = openOrders.stream().filter(w -> w.priority == Priority.CRITICAL).count();
        long waitingParts = openOrders.stream().filter(w -> w.status == WorkStatus.WAITING_PARTS).count();

        List<WorkOrder> last90 = listOrdersByCreatedRange(scope, ninetyDaysAgo, now)
                .stream()
                .filter(w -> domainScope.contains(domainOf(w)))
                .filter(w -> canReadOrder(currentUser, w))
                .toList();
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

        List<PreventivePlan> plans = listPlanEntities(scope, true).stream()
                .filter(p -> domainScope.contains(planDomain(p)))
                .toList();
        long pmDue7 = plans.stream()
                .filter(p -> !p.nextDueDate.isAfter(LocalDate.now().plusDays(7)))
                .count();

        LocalDateTime pmWindow = now.minusDays(30);
        List<WorkOrder> pmLast30 = last30.stream()
                .filter(w -> w.workType == WorkType.PREVENTIVE && w.scheduledAt != null && !w.scheduledAt.isBefore(pmWindow))
                .toList();
        long pmCompleted = pmLast30.stream().filter(w -> w.status == WorkStatus.CLOSED || w.status == WorkStatus.REPAIRED).count();
        double pmCompliance = pmLast30.isEmpty() ? 100.0 : (100.0 * pmCompleted / pmLast30.size());

        List<Equipment> equipment = listEquipmentEntities(scope, null, null, null).stream()
                .filter(e -> domainScope.contains(domainOf(e)))
                .toList();
        long assetsDown = equipment.stream().filter(e -> e.status == EquipmentStatus.DOWN || e.status == EquipmentStatus.UNDER_MAINTENANCE).count();
        long warrantyRisk = equipment.stream()
                .filter(e -> e.warrantyExpiry != null)
                .filter(e -> !e.warrantyExpiry.isBefore(LocalDate.now()))
                .filter(e -> !e.warrantyExpiry.isAfter(LocalDate.now().plusDays(60)))
                .count();

        EnumMap<WorkStatus, Long> statusCounts = new EnumMap<>(WorkStatus.class);
        for (WorkStatus status : WorkStatus.values()) statusCounts.put(status, 0L);
        for (WorkOrder w : openOrders) statusCounts.merge(w.status, 1L, Long::sum);

        EnumMap<ServiceDomain, Long> serviceCounts = new EnumMap<>(ServiceDomain.class);
        for (ServiceDomain domain : ServiceDomain.values()) serviceCounts.put(domain, 0L);
        for (WorkOrder w : openOrders) serviceCounts.merge(domainOf(w), 1L, Long::sum);

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
                .limit(10)
                .map(this::workOrderSummary)
                .toList();

        List<Map<String, Object>> departmentComparison = new ArrayList<>();
        for (ServiceDomain domain : ServiceDomain.values()) {
            if (!domainScope.contains(domain)) continue;
            List<WorkOrder> domainOpen = openOrders.stream().filter(w -> domainOf(w) == domain).toList();
            List<WorkOrder> domain30 = last30.stream().filter(w -> domainOf(w) == domain).toList();
            List<Equipment> domainAssets = equipment.stream().filter(e -> domainOf(e) == domain).toList();
            double avgResponse = domain30.stream()
                    .map(this::responseMinutes)
                    .filter(Objects::nonNull)
                    .mapToInt(Integer::intValue)
                    .average().orElse(0.0);
            double avgResolutionHours = domain30.stream()
                    .filter(w -> w.status == WorkStatus.REPAIRED || w.status == WorkStatus.CLOSED)
                    .map(this::resolvedActualMinutes)
                    .filter(Objects::nonNull)
                    .mapToInt(Integer::intValue)
                    .average().orElse(0.0) / 60.0;
            long domainDowntime = domain30.stream().map(w -> w.downtimeMinutes).filter(Objects::nonNull).mapToLong(Integer::longValue).sum();
            long completed = domain30.stream().filter(w -> w.status == WorkStatus.REPAIRED || w.status == WorkStatus.CLOSED).count();
            departmentComparison.add(map(
                    "serviceDomain", domain.name(),
                    "label", humanDomain(domain),
                    "open", domainOpen.size(),
                    "overdue", domainOpen.stream().filter(w -> w.scheduledAt != null && w.scheduledAt.isBefore(now)).count(),
                    "critical", domainOpen.stream().filter(w -> w.priority == Priority.CRITICAL).count(),
                    "completed30", completed,
                    "avgResponseMinutes30", round(avgResponse, 1),
                    "avgResolutionHours30", round(avgResolutionHours, 1),
                    "downtimeHours30", round(domainDowntime / 60.0, 1),
                    "assets", domainAssets.size(),
                    "assetsDown", domainAssets.stream().filter(e -> e.status == EquipmentStatus.DOWN || e.status == EquipmentStatus.UNDER_MAINTENANCE).count()
            ));
        }

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
                "scope", requestedDomain == null ? (domainScope.size() > 1 ? "ALL" : domainScope.iterator().next().name()) : requestedDomain.name(),
                "metrics", metrics,
                "byStatus", statusCounts.entrySet().stream().collect(Collectors.toMap(e -> e.getKey().name(), Map.Entry::getValue, (a, b) -> a, LinkedHashMap::new)),
                "byServiceDomain", serviceCounts.entrySet().stream().collect(Collectors.toMap(e -> e.getKey().name(), Map.Entry::getValue, (a, b) -> a, LinkedHashMap::new)),
                "departmentComparison", departmentComparison,
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
            ServiceDomain serviceDomain,
            UUID equipmentId,
            String responsible,
            String search,
            int page,
            int size
    ) {
        User current = currentUserService.requireCurrentUser();
        Set<String> scope = readPlantScope(plantCode);
        Set<ServiceDomain> domainScope = readDomainScope(current, serviceDomain);
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(size, 1), 1000);

        boolean technicianOnly = !currentUserService.isAdmin(current)
                && !isDirector(current)
                && domainScope.stream().noneMatch(d -> canCoordinate(current, d))
                && domainScope.stream().allMatch(d -> isTechnicianForDomain(current, d));
        String effectiveResponsible = technicianOnly ? current.getUsername() : responsible;

        QueryResult<WorkOrder> result = queryOrders(
                scope,
                domainScope,
                status,
                type,
                priority,
                equipmentId,
                effectiveResponsible,
                null,
                search,
                safePage,
                safeSize);

        return map(
                "items", result.items.stream().map(this::workOrderSummary).toList(),
                "page", safePage,
                "size", safeSize,
                "total", result.total,
                "pages", Math.max(1, (long) Math.ceil(result.total / (double) safeSize))
        );
    }

    public Map<String, Object> getWorkOrder(UUID id) {
        User current = currentUserService.requireCurrentUser();
        WorkOrder w = requireOrder(id, false);
        requirePlantReadAccess(w.plantCode);
        require(canReadOrder(current, w), "You are not allowed to open this maintenance request");

        Map<String, Object> out = workOrderDetail(w);
        out.put("audit", listAudit("WORK_ORDER", id));
        out.put("allowedTransitions", allowedTransitionsFor(current, w).stream().map(Enum::name).toList());
        out.put("canAssign", canCoordinate(current, domainOf(w)));
        out.put("canClose", canCoordinate(current, domainOf(w)));
        out.put("canExecute", canExecuteOrder(current, w));
        return out;
    }

    public Map<String, Object> getEquipmentByQr(UUID qrToken) {
        User current = currentUserService.requireCurrentUser();
        Equipment e = requireEquipmentByQr(qrToken);
        require(e.qrEnabled, "QR reporting is disabled for this equipment");
        requirePlantReadAccess(e.plantCode);
        requireDomainReadAccess(current, domainOf(e));
        require(isAssetFlowOperationalUser(current) || currentUserService.isAdmin(current), "AssetFlow operational access is required");

        Team team = resolveRoutingTeam(e);
        return map(
                "id", e.id,
                "qrToken", e.qrToken,
                "assetCode", e.assetCode,
                "name", e.name,
                "category", e.category,
                "plantCode", e.plantCode,
                "location", e.location,
                "workCenter", e.workCenter,
                "status", e.status.name(),
                "criticality", e.criticality.name(),
                "maintenanceTeam", team != null ? team.name : e.maintenanceTeam,
                "headTechnician", team != null ? team.lead : e.primaryTechnician,
                "safetyNotes", e.safetyNotes,
                "qrEnabled", e.qrEnabled,
                "qrPath", qrPath(e.qrToken)
        );
    }

    public Map<String, Object> createQrComplaint(UUID qrToken, WorkOrderUpsert request, Authentication auth) {
        Equipment e = requireEquipmentByQr(qrToken);
        require(e.qrEnabled, "QR reporting is disabled for this equipment");
        requirePlantWriteAccess(e.plantCode);
        return createWorkOrderInternal(request, auth, e, ComplaintSource.QR);
    }

    public Map<String, Object> createWorkOrder(WorkOrderUpsert request, Authentication auth) {
        Equipment forcedEquipment = null;
        ComplaintSource source = ComplaintSource.WEB;
        if (request != null && request.qrToken() != null) {
            forcedEquipment = requireEquipmentByQr(request.qrToken());
            require(forcedEquipment.qrEnabled, "QR reporting is disabled for this equipment");
            source = ComplaintSource.QR;
        }
        return createWorkOrderInternal(request, auth, forcedEquipment, source);
    }

    private Map<String, Object> createWorkOrderInternal(
            WorkOrderUpsert request,
            Authentication auth,
            Equipment forcedEquipment,
            ComplaintSource source
    ) {
        require(request != null, "Request body is required");
        require(notBlank(request.title()), "Issue / request title is required");
        require(notBlank(request.description()), "Problem description is required");

        User currentUser = currentUserService.requireCurrentUser();
        WorkType requestedType = request.workType() == null ? WorkType.CORRECTIVE : request.workType();

        if (isRequesterOnly(currentUser)) {
            require(requestedType == WorkType.CORRECTIVE,
                    "Requester users can raise corrective/service complaints only. Preventive work is controlled by maintenance planning.");
        }

        Equipment equipment = forcedEquipment;
        if (equipment == null && request.equipmentId() != null) {
            equipment = requireEquipment(request.equipmentId(), false);
        }
        if (equipment != null) {
            require(equipment.status != EquipmentStatus.RETIRED, "Cannot create maintenance for retired equipment");
            requirePlantWriteAccess(equipment.plantCode);
        }

        String targetPlant = equipment != null
                ? normalizePlant(equipment.plantCode)
                : normalizePlant(request.plantCode());
        require(notBlank(targetPlant), "Plant is required when no asset/equipment is selected");
        requirePlantWriteAccess(targetPlant);

        ServiceDomain domain = equipment != null
                ? domainOf(equipment)
                : (request.serviceDomain() == null ? ServiceDomain.MACHINE : request.serviceDomain());
        requireDomainReadAccess(currentUser, domain);
        require(canCreateOperationalOrder(currentUser, domain), "You cannot create operational work in this department");
        boolean coordinator = canCoordinate(currentUser, domain);

        Team routedTeam = resolveRoutingTeam(
                targetPlant,
                domain,
                equipment != null ? equipment.maintenanceTeam : request.teamName());
        String autoHead = routedTeam != null
                ? blankToNull(routedTeam.lead)
                : equipment != null ? blankToNull(equipment.primaryTechnician) : null;
        if (autoHead != null) {
            validateAssignableUser(autoHead, targetPlant, domain, false);
        }

        WorkOrder w = new WorkOrder();
        w.workNumber = nextWorkNumber();
        w.title = clean(request.title());
        w.description = clean(request.description());
        w.instructions = clean(request.instructions());
        w.requestedBy = currentUser.getUsername();
        w.operatorName = clean(request.operatorName());
        w.operatorContact = clean(request.operatorContact());
        w.serviceDomain = domain;
        w.requestCategory = clean(request.requestCategory());
        w.workType = requestedType;
        w.priority = normalizeRequestPriority(request.priority(), request.productionStopped(), request.safetyRisk(), coordinator);
        w.requestedAt = LocalDateTime.now();
        w.requestedForAt = request.requestedForAt() != null
                ? request.requestedForAt()
                : request.scheduledAt();
        w.scheduledAt = request.scheduledAt() != null
                ? request.scheduledAt()
                : w.requestedForAt != null ? w.requestedForAt : w.requestedAt;
        w.estimatedMinutes = coordinator && request.estimatedMinutes() != null
                ? nonNegative(request.estimatedMinutes(), "Estimated minutes")
                : null;
        w.downtimeMinutes = 0;
        w.breakdown = request.breakdown() == null ? requestedType == WorkType.CORRECTIVE : request.breakdown();
        w.productionStopped = Boolean.TRUE.equals(request.productionStopped());
        w.safetyRisk = Boolean.TRUE.equals(request.safetyRisk());
        w.complaintSource = source == null ? ComplaintSource.WEB : source;
        w.partsCost = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        w.laborCost = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        w.externalCost = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

        if (equipment != null) {
            hydrateEquipmentSnapshot(w, equipment.id, equipment.plantCode, equipment.location);
            w.workCenter = equipment.workCenter;
        } else {
            hydrateEquipmentSnapshot(w, null, targetPlant, request.location());
        }
        w.serviceDomain = domain;
        if (request.location() != null && equipment == null) w.location = clean(request.location());
        w.teamName = routedTeam != null
                ? routedTeam.name
                : equipment != null ? blankToNull(equipment.maintenanceTeam) : blankToNull(request.teamName());
        w.responsible = autoHead;

        if (coordinator && notBlank(request.teamName())) {
            Team selected = findTeamByName(request.teamName());
            require(selected != null && selected.active, "Selected maintenance/service team is not active");
            require(teamCanServePlant(selected, targetPlant), "Selected team cannot serve this plant");
            require(domainOf(selected) == domain, "Selected team belongs to " + domainOf(selected) + " service");
            w.teamName = selected.name;
            if (!notBlank(request.responsible())) w.responsible = blankToNull(selected.lead);
        }
        if (coordinator && notBlank(request.responsible())) {
            validateAssignableUser(request.responsible(), targetPlant, domain, false);
            w.responsible = clean(request.responsible());
        }

        String actor = actor(auth);
        if (notBlank(w.responsible)) {
            w.status = WorkStatus.ASSIGNED;
            w.assignedBy = coordinator && notBlank(request.responsible()) ? actor : "AUTO_ROUTE";
            w.assignedAt = LocalDateTime.now();
        } else {
            w.status = WorkStatus.NEW;
        }

        w.createdBy = actor;
        w.updatedBy = actor;
        w.createdAt = LocalDateTime.now();
        w.updatedAt = w.createdAt;
        em.persist(w);

        audit("WORK_ORDER", w.id, "CREATED", null, w.status.name(), actor,
                w.complaintSource.name() + " · " + humanDomain(domain) + " · " + w.title);
        if (notBlank(w.responsible)) {
            audit("WORK_ORDER", w.id, "AUTO_ASSIGNED", WorkStatus.NEW.name(), w.status.name(),
                    w.assignedBy, "Assigned to " + w.responsible + " via " + firstNonBlank(w.teamName, "service routing"));
        }
        syncEquipmentState(w.equipmentId);
        return workOrderDetail(w);
    }


    /* =============================== REQUEST GATEWAY =============================== */

    /**
     * Controlled request context for an authenticated FlowSuite user.
     *
     * A normal FlowSuite account is NOT automatically a AssetFlow complainant.
     * The employee must either be an operational AssetFlow user or have a
     * AssetFlow Reporter record linked to the same FlowSuite username. This is
     * what prevents every application user from posting arbitrary requests.
     */
    public Map<String, Object> requesterContext() {
        User current = currentUserService.requireCurrentUser();
        RequestPermission permission = authenticatedRequestPermission(current);
        List<Map<String, Object>> desks = listPublicServiceDesks(permission.plants(), permission.domains());

        return map(
                "allowed", true,
                "username", current.getUsername(),
                "identityType", permission.reporter() == null ? "FLOW_SUITE_STAFF" : "LINKED_REPORTER",
                "reporter", permission.reporter() == null ? null : reporterPublicView(permission.reporter()),
                "plants", permission.plants().stream().sorted().toList(),
                "serviceDomains", permission.domains().stream().map(Enum::name).sorted().toList(),
                "serviceDesks", desks
        );
    }

    public List<Map<String, Object>> myRequests() {
        User current = currentUserService.requireCurrentUser();
        RequestPermission permission = authenticatedRequestPermission(current);

        TypedQuery<WorkOrder> query;
        if (permission.reporter() != null) {
            query = em.createQuery(
                            "select w from AssetFlowWorkOrder w "
                                    + "where lower(w.requestedBy)=:user or w.reporterId=:reporterId "
                                    + "order by w.createdAt desc",
                            WorkOrder.class)
                    .setParameter("user", current.getUsername().toLowerCase(Locale.ROOT))
                    .setParameter("reporterId", permission.reporter().id);
        } else {
            query = em.createQuery(
                            "select w from AssetFlowWorkOrder w where lower(w.requestedBy)=:user order by w.createdAt desc",
                            WorkOrder.class)
                    .setParameter("user", current.getUsername().toLowerCase(Locale.ROOT));
        }

        return query.setMaxResults(200)
                .getResultList()
                .stream()
                .map(this::workOrderSummary)
                .toList();
    }

    public Map<String, Object> createAuthenticatedRequest(AuthenticatedRequestCreate request, Authentication auth) {
        require(request != null, "Request body is required");
        require(notBlank(request.title()), "Issue / request title is required");
        require(notBlank(request.description()), "Problem description is required");

        User current = currentUserService.requireCurrentUser();
        RequestPermission permission = authenticatedRequestPermission(current);
        Equipment equipment = resolveRequestEquipment(request.equipmentId(), request.equipmentToken());
        Team tokenTeam = resolveServiceDeskToken(request.serviceDeskToken(), false);

        ServiceDomain domain = equipment != null
                ? domainOf(equipment)
                : tokenTeam != null ? domainOf(tokenTeam)
                : request.serviceDomain() == null ? null : request.serviceDomain();
        require(domain != null, "Select Machine Maintenance or IT Support");
        require(permission.domains().contains(domain),
                "You are not authorised to raise " + humanDomain(domain) + " requests");

        String plant = equipment != null
                ? normalizePlant(equipment.plantCode)
                : normalizePlant(request.plantCode());
        if (!notBlank(plant) && tokenTeam != null && notBlank(tokenTeam.plantCode)) {
            plant = normalizePlant(tokenTeam.plantCode);
        }
        if (!notBlank(plant) && permission.plants().size() == 1) {
            plant = permission.plants().iterator().next();
        }
        require(notBlank(plant), "Select the plant/location for this request");
        require(permission.plants().contains(plant), "You are not authorised to report requests for plant " + plant);

        if (equipment != null) {
            require(permission.plants().contains(normalizePlant(equipment.plantCode)), "This asset belongs to another plant");
            require(permission.domains().contains(domainOf(equipment)), "This asset belongs to another service department");
        }
        if (tokenTeam != null) {
            validateRequestRoute(tokenTeam, plant, domain);
        }

        Team route = tokenTeam != null
                ? tokenTeam
                : resolveRoutingTeam(plant, domain, equipment == null ? null : equipment.maintenanceTeam);
        validateRequestRoute(route, plant, domain);

        Reporter profile = permission.reporter();
        WorkOrder w = createGatewayOrder(
                current.getUsername(),
                profile == null ? null : profile.id,
                profile == null ? null : profile.reporterCode,
                profile == null ? null : profile.department,
                profile == null ? null : firstNonBlank(profile.phone, profile.email),
                equipment,
                route,
                plant,
                domain,
                request.requestCategory(),
                request.title(),
                request.description(),
                request.location(),
                request.operatorName(),
                request.operatorContact(),
                request.requestedForAt(),
                request.priority(),
                request.productionStopped(),
                request.safetyRisk(),
                equipment != null ? ComplaintSource.QR : tokenTeam != null ? ComplaintSource.SERVICE_QR : ComplaintSource.FLOW_SUITE_REQUEST,
                actor(auth)
        );

        if (profile != null) {
            profile.lastRequestAt = LocalDateTime.now();
            profile.updatedAt = profile.lastRequestAt;
        }
        return workOrderDetail(w);
    }

    /** Public QR/desk context deliberately contains no internal/user-sensitive data. */
    public Map<String, Object> publicContext(UUID equipmentToken, UUID serviceDeskToken) {
        Equipment equipment = equipmentToken == null ? null : requireEquipmentByQr(equipmentToken);
        Team team = serviceDeskToken == null ? null : resolveServiceDeskToken(serviceDeskToken, true);

        if (equipment != null) {
            require(equipment.qrEnabled, "QR reporting is disabled for this asset");
        }
        if (team != null) {
            require(team.active && team.publicReportingEnabled, "This service-desk request link is disabled");
        }

        Map<String, Object> asset = equipment == null ? null : map(
                "id", equipment.id,
                "token", equipment.qrToken,
                "assetCode", equipment.assetCode,
                "name", equipment.name,
                "category", equipment.category,
                "serviceDomain", domainOf(equipment).name(),
                "assetKind", assetKindOf(equipment).name(),
                "plantCode", equipment.plantCode,
                "location", equipment.location,
                "workCenter", equipment.workCenter,
                "status", equipment.status.name(),
                "qrEnabled", equipment.qrEnabled
        );

        return map(
                "asset", asset,
                "serviceDesk", team == null ? null : publicDeskView(team),
                "serviceDomains", java.util.Arrays.stream(ServiceDomain.values()).map(Enum::name).toList(),
                "requiresReporterAuthentication", true,
                "message", "QR identifies the asset/service desk only. A linked FlowSuite identity or approved Reporter Code + PIN is still required."
        );
    }

    public Map<String, Object> authoriseReporter(ReporterLogin login) {
        require(login != null, "Reporter credentials are required");
        Reporter reporter = authenticateReporter(login.reporterCode(), login.accessPin());
        Set<ServiceDomain> allowed = reporterDomains(reporter);
        Set<String> plants = reporterPlants(reporter);
        Equipment equipment = login.equipmentToken() == null ? null : requireEquipmentByQr(login.equipmentToken());
        Team desk = login.serviceDeskToken() == null ? null : resolveServiceDeskToken(login.serviceDeskToken(), true);
        if (equipment != null) validateReporterCanUseAsset(reporter, equipment, allowed);
        if (desk != null) validateReporterCanUseDesk(reporter, desk, allowed);

        return map(
                "reporter", reporterPublicView(reporter),
                "allowedDomains", allowed.stream().map(Enum::name).sorted().toList(),
                "plants", plants.stream().sorted().toList(),
                "serviceDesks", listPublicServiceDesks(plants, allowed),
                "asset", equipment == null ? null : map(
                        "token", equipment.qrToken,
                        "assetCode", equipment.assetCode,
                        "name", equipment.name,
                        "serviceDomain", domainOf(equipment).name(),
                        "plantCode", equipment.plantCode,
                        "location", equipment.location,
                        "workCenter", equipment.workCenter),
                "serviceDesk", desk == null ? null : publicDeskView(desk)
        );
    }

    public List<Map<String, Object>> reporterRequests(ReporterLogin login) {
        require(login != null, "Reporter credentials are required");
        Reporter reporter = authenticateReporter(login.reporterCode(), login.accessPin());
        return em.createQuery(
                        "select w from AssetFlowWorkOrder w where w.reporterId=:reporterId order by w.createdAt desc",
                        WorkOrder.class)
                .setParameter("reporterId", reporter.id)
                .setMaxResults(100)
                .getResultList()
                .stream()
                .map(this::workOrderSummary)
                .toList();
    }

    public Map<String, Object> createPublicRequest(PublicRequestCreate request) {
        require(request != null, "Request body is required");
        require(notBlank(request.title()), "Issue / request title is required");
        require(notBlank(request.description()), "Problem description is required");

        Reporter reporter = authenticateReporter(request.reporterCode(), request.accessPin());
        Set<ServiceDomain> allowed = reporterDomains(reporter);
        Set<String> allowedPlants = reporterPlants(reporter);
        Equipment equipment = request.equipmentToken() == null ? null : requireEquipmentByQr(request.equipmentToken());
        Team tokenTeam = request.serviceDeskToken() == null ? null : resolveServiceDeskToken(request.serviceDeskToken(), true);

        if (equipment != null) validateReporterCanUseAsset(reporter, equipment, allowed);
        if (tokenTeam != null) validateReporterCanUseDesk(reporter, tokenTeam, allowed);

        ServiceDomain domain = equipment != null
                ? domainOf(equipment)
                : tokenTeam != null ? domainOf(tokenTeam)
                : request.serviceDomain();
        require(domain != null, "Select Machine Maintenance or IT Support");
        require(allowed.contains(domain), "Your Reporter Pass is not permitted for " + humanDomain(domain) + " requests");

        String plant = equipment != null
                ? normalizePlant(equipment.plantCode)
                : tokenTeam != null && notBlank(tokenTeam.plantCode)
                    ? normalizePlant(tokenTeam.plantCode)
                    : normalizePlant(request.plantCode());
        if (!notBlank(plant) && allowedPlants.size() == 1) plant = allowedPlants.iterator().next();
        require(notBlank(plant), "Select the plant for this request");
        require(allowedPlants.contains(plant), "Your Reporter Pass is not permitted for plant " + plant);

        Team route = tokenTeam != null
                ? tokenTeam
                : resolveRoutingTeam(plant, domain, equipment == null ? null : equipment.maintenanceTeam);
        validateRequestRoute(route, plant, domain);

        ComplaintSource source = equipment != null
                ? ComplaintSource.QR
                : tokenTeam != null ? ComplaintSource.SERVICE_QR : ComplaintSource.REPORTER_PORTAL;

        WorkOrder w = createGatewayOrder(
                reporter.displayName,
                reporter.id,
                reporter.reporterCode,
                reporter.department,
                firstNonBlank(reporter.phone, reporter.email),
                equipment,
                route,
                plant,
                domain,
                request.requestCategory(),
                request.title(),
                request.description(),
                request.location(),
                request.operatorName(),
                request.operatorContact(),
                request.requestedForAt(),
                request.priority(),
                request.productionStopped(),
                request.safetyRisk(),
                source,
                "REPORTER:" + reporter.reporterCode
        );

        reporter.lastRequestAt = LocalDateTime.now();
        reporter.updatedAt = reporter.lastRequestAt;
        return map(
                "workNumber", w.workNumber,
                "status", w.status.name(),
                "teamName", w.teamName,
                "responsible", w.responsible,
                "serviceDomain", domain.name(),
                "requestedForAt", w.requestedForAt,
                "message", notBlank(w.responsible)
                        ? "Request submitted and routed to " + w.responsible
                        : "Request submitted to the " + humanDomain(domain) + " queue"
        );
    }

    private WorkOrder createGatewayOrder(
            String requestedBy,
            UUID reporterId,
            String reporterCode,
            String reporterDepartment,
            String reporterContact,
            Equipment equipment,
            Team route,
            String plant,
            ServiceDomain domain,
            String requestCategory,
            String title,
            String description,
            String location,
            String operatorName,
            String operatorContact,
            LocalDateTime requestedForAt,
            Priority requestedPriority,
            Boolean productionStopped,
            Boolean safetyRisk,
            ComplaintSource source,
            String actor
    ) {
        WorkOrder w = new WorkOrder();
        w.workNumber = nextWorkNumber();
        w.title = clean(title);
        w.description = clean(description);
        w.workType = WorkType.CORRECTIVE;
        w.serviceDomain = domain == null ? ServiceDomain.MACHINE : domain;
        w.requestCategory = clean(requestCategory);
        w.requestedBy = clean(requestedBy);
        w.reporterId = reporterId;
        w.reporterCode = clean(reporterCode);
        w.reporterDepartment = clean(reporterDepartment);
        w.reporterContact = clean(reporterContact);
        w.operatorName = clean(operatorName);
        w.operatorContact = clean(operatorContact);
        w.requestedAt = LocalDateTime.now();
        w.requestedForAt = requestedForAt;
        w.scheduledAt = requestedForAt;
        w.productionStopped = Boolean.TRUE.equals(productionStopped);
        w.safetyRisk = Boolean.TRUE.equals(safetyRisk);
        w.breakdown = w.serviceDomain == ServiceDomain.MACHINE;
        w.priority = normalizeRequestPriority(requestedPriority, productionStopped, safetyRisk, false);
        w.complaintSource = source == null ? ComplaintSource.REPORTER_PORTAL : source;
        w.partsCost = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        w.laborCost = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        w.externalCost = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        w.downtimeMinutes = 0;

        if (equipment != null) {
            w.equipmentId = equipment.id;
            w.equipmentName = equipment.name;
            w.equipmentCode = equipment.assetCode;
            w.plantCode = normalizePlant(equipment.plantCode);
            w.location = firstNonBlank(location, equipment.location);
            w.workCenter = equipment.workCenter;
        } else {
            w.plantCode = normalizePlant(plant);
            w.location = clean(location);
        }

        w.teamName = route == null ? null : route.name;
        w.responsible = route == null ? null : blankToNull(route.lead);
        if (notBlank(w.responsible)) {
            w.status = WorkStatus.ASSIGNED;
            w.assignedAt = LocalDateTime.now();
            w.assignedBy = "AUTO_ROUTE";
        } else {
            w.status = WorkStatus.NEW;
        }
        w.createdBy = actor;
        w.updatedBy = actor;
        w.createdAt = LocalDateTime.now();
        w.updatedAt = w.createdAt;
        em.persist(w);

        audit("WORK_ORDER", w.id, "REQUEST_CREATED", null, w.status.name(), actor,
                humanDomain(w.serviceDomain) + " · " + w.title);
        if (notBlank(w.responsible)) {
            audit("WORK_ORDER", w.id, "AUTO_ASSIGNED", WorkStatus.NEW.name(), WorkStatus.ASSIGNED.name(),
                    "AUTO_ROUTE", "Assigned to " + w.responsible + " via " + firstNonBlank(w.teamName, humanDomain(w.serviceDomain)));
        }
        syncEquipmentState(w.equipmentId);
        return w;
    }

    /* =============================== REPORTER DIRECTORY =============================== */

    public List<Map<String, Object>> listReporters(String plantCode, Boolean activeOnly, String search) {
        User current = currentUserService.requireCurrentUser();
        require(currentUserService.isAdmin(current), "Only ADMIN can manage the central AssetFlow requester directory");
        Set<String> scope = readPlantScope(plantCode);

        StringBuilder jpql = new StringBuilder("select r from AssetFlowReporter r where 1=1");
        if (Boolean.TRUE.equals(activeOnly)) jpql.append(" and r.active=true");
        if (notBlank(search)) {
            jpql.append(" and (lower(r.reporterCode) like :search or lower(r.displayName) like :search or lower(coalesce(r.department,'')) like :search or lower(coalesce(r.linkedUsername,'')) like :search)");
        }
        jpql.append(" order by r.active desc, r.displayName");
        TypedQuery<Reporter> query = em.createQuery(jpql.toString(), Reporter.class);
        if (notBlank(search)) query.setParameter("search", "%" + clean(search).toLowerCase(Locale.ROOT) + "%");
        return query.getResultList().stream()
                .filter(r -> reporterPlants(r).stream().anyMatch(scope::contains))
                .map(this::reporterAdminView)
                .toList();
    }

    public Map<String, Object> saveReporter(UUID id, ReporterUpsert request, Authentication auth) {
        require(request != null, "Reporter request is required");
        User current = currentUserService.requireCurrentUser();
        require(currentUserService.isAdmin(current), "Only ADMIN can manage the central AssetFlow requester directory");
        require(notBlank(request.reporterCode()), "Reporter Code / Employee Code is required");
        require(notBlank(request.displayName()), "Reporter name is required");

        LinkedHashSet<String> requestedPlants = new LinkedHashSet<>();
        if (request.plantCodes() != null) {
            for (String value : request.plantCodes()) {
                if (!notBlank(value)) continue;
                String plant = normalizePlant(value);
                require(plantLocationService.isValidPlant(plant), "Invalid reporter plant: " + plant);
                requestedPlants.add(plant);
            }
        }
        if (notBlank(request.plantCode())) {
            String plant = normalizePlant(request.plantCode());
            require(plantLocationService.isValidPlant(plant), "Invalid reporter plant: " + plant);
            requestedPlants.add(plant);
        }
        require(!requestedPlants.isEmpty(), "At least one reporter plant is required");

        Reporter r = id == null ? new Reporter() : em.find(Reporter.class, id, LockModeType.PESSIMISTIC_WRITE);
        if (id != null && r == null) throw notFound("Reporter not found");
        if (id != null) checkVersion(r.version, request.version());

        String code = clean(request.reporterCode()).toUpperCase(Locale.ROOT);
        String duplicateJpql = "select count(r) from AssetFlowReporter r where lower(r.reporterCode)=:code"
                + (id == null ? "" : " and r.id<>:id");
        TypedQuery<Long> duplicateQuery = em.createQuery(duplicateJpql, Long.class)
                .setParameter("code", code.toLowerCase(Locale.ROOT));
        if (id != null) duplicateQuery.setParameter("id", id);
        require(duplicateQuery.getSingleResult() == 0L, "Reporter Code already exists");

        String linkedUsername = blankToNull(request.linkedUsername());
        if (linkedUsername != null) {
            User linked = userRepository.findByUsernameIgnoreCase(linkedUsername)
                    .orElseThrow(() -> badRequest("Linked FlowSuite username does not exist"));
            require(linked.isEnabled(), "Linked FlowSuite user is disabled");
            linkedUsername = linked.getUsername();
            String linkedJpql = "select count(r) from AssetFlowReporter r where lower(r.linkedUsername)=:username"
                    + (id == null ? "" : " and r.id<>:id");
            TypedQuery<Long> linkedQuery = em.createQuery(linkedJpql, Long.class)
                    .setParameter("username", linkedUsername.toLowerCase(Locale.ROOT));
            if (id != null) linkedQuery.setParameter("id", id);
            require(linkedQuery.getSingleResult() == 0L, "This FlowSuite user is already linked to another Reporter Pass");
        }

        Set<ServiceDomain> domains = request.allowedDomains() == null || request.allowedDomains().isEmpty()
                ? Set.of(ServiceDomain.MACHINE)
                : EnumSet.copyOf(request.allowedDomains());

        r.reporterCode = code;
        r.displayName = clean(request.displayName());
        r.reporterType = request.reporterType() == null ? ReporterType.EMPLOYEE : request.reporterType();
        r.plantCode = requestedPlants.iterator().next();
        r.plantCodes = requestedPlants.stream().sorted().collect(Collectors.joining(","));
        r.linkedUsername = linkedUsername;
        r.department = clean(request.department());
        r.designation = clean(request.designation());
        r.phone = clean(request.phone());
        r.email = clean(request.email());
        r.allowedDomains = domains.stream().map(Enum::name).sorted().collect(Collectors.joining(","));
        r.active = request.active() == null || request.active();
        r.validUntil = request.validUntil();
        if (notBlank(request.accessPin())) {
            validateReporterPin(request.accessPin());
            r.pinHash = passwordEncoder.encode(request.accessPin().trim());
            r.failedAttempts = 0;
            r.lockedUntil = null;
        } else if (id == null) {
            throw badRequest("Initial Reporter PIN is required");
        }
        r.updatedBy = actor(auth);
        r.updatedAt = LocalDateTime.now();
        if (id == null) {
            r.createdBy = actor(auth);
            r.createdAt = r.updatedAt;
            em.persist(r);
        }
        audit("REPORTER", r.id, id == null ? "CREATED" : "UPDATED", null, null, actor(auth), r.reporterCode + " · " + r.displayName);
        return reporterAdminView(r);
    }

    public Map<String, Object> updateWorkOrder(UUID id, WorkOrderUpsert request, Authentication auth) {
        require(request != null, "Request body is required");
        User current = currentUserService.requireCurrentUser();

        WorkOrder w = requireOrder(id, true);
        requirePlantWriteAccess(w.plantCode);
        require(canCoordinate(current, domainOf(w)), "Department head/coordinator permission is required for this work order");
        checkVersion(w.version, request.version());

        UUID oldEquipment = w.equipmentId;
        if (request.equipmentId() != null && !request.equipmentId().equals(w.equipmentId)) {
            Equipment newEquipment = requireEquipment(request.equipmentId(), false);
            requirePlantWriteAccess(newEquipment.plantCode);
            hydrateEquipmentSnapshot(w, newEquipment.id, newEquipment.plantCode, newEquipment.location);
            w.workCenter = newEquipment.workCenter;
        }

        if (notBlank(request.title())) w.title = clean(request.title());
        if (request.description() != null) w.description = clean(request.description());
        if (request.instructions() != null) w.instructions = clean(request.instructions());
        if (request.operatorName() != null) w.operatorName = clean(request.operatorName());
        if (request.operatorContact() != null) w.operatorContact = clean(request.operatorContact());
        if (request.serviceDomain() != null) {
            if (w.equipmentId != null) {
                Equipment currentEquipment = requireEquipment(w.equipmentId, false);
                require(domainOf(currentEquipment) == request.serviceDomain(),
                        "Asset service domain cannot be changed from the work order");
            }
            require(readDomainScope(current, request.serviceDomain()).contains(request.serviceDomain()), "You cannot move work into another maintenance department");
            w.serviceDomain = request.serviceDomain();
        }
        if (request.requestCategory() != null) w.requestCategory = clean(request.requestCategory());
        if (request.requestedForAt() != null) w.requestedForAt = request.requestedForAt();
        if (request.teamName() != null) {
            if (notBlank(request.teamName())) {
                Team selectedTeam = findTeamByName(request.teamName());
                require(selectedTeam != null && selectedTeam.active, "Maintenance/service team not found or inactive");
                require(teamCanServePlant(selectedTeam, w.plantCode), "Selected team cannot serve this plant");
                require(domainOf(selectedTeam) == domainOf(w),
                        "Selected team belongs to " + humanDomain(domainOf(selectedTeam)) + ", not " + humanDomain(domainOf(w)));
                w.teamName = selectedTeam.name;
            } else {
                w.teamName = null;
            }
        }
        if (request.responsible() != null) {
            if (notBlank(request.responsible())) validateAssignableUser(request.responsible(), w.plantCode, domainOf(w), false);
            w.responsible = blankToNull(request.responsible());
        }
        if (request.workType() != null) w.workType = request.workType();
        if (request.priority() != null) w.priority = request.priority();
        if (request.scheduledAt() != null) w.scheduledAt = request.scheduledAt();
        if (request.estimatedMinutes() != null) w.estimatedMinutes = nonNegative(request.estimatedMinutes(), "Estimated minutes");
        if (request.breakdown() != null) w.breakdown = request.breakdown();
        if (request.productionStopped() != null) w.productionStopped = request.productionStopped();
        if (request.safetyRisk() != null) w.safetyRisk = request.safetyRisk();
        if (request.location() != null) w.location = clean(request.location());

        w.updatedBy = actor(auth);
        w.updatedAt = LocalDateTime.now();
        audit("WORK_ORDER", w.id, "UPDATED", w.status.name(), w.status.name(), actor(auth), "Planning details updated");
        syncEquipmentState(oldEquipment);
        syncEquipmentState(w.equipmentId);
        return workOrderDetail(w);
    }

    public Map<String, Object> assignWorkOrder(UUID id, AssignmentRequest request, Authentication auth) {
        require(request != null, "Assignment request is required");
        User current = currentUserService.requireCurrentUser();

        WorkOrder w = requireOrder(id, true);
        requirePlantWriteAccess(w.plantCode);
        require(canCoordinate(current, domainOf(w)), "Only the head/coordinator of this department can assign work");
        checkVersion(w.version, request.version());
        require(!TERMINAL.contains(w.status), "A closed/cancelled work order cannot be assigned");

        if (notBlank(request.teamName())) {
            Team team = findTeamByName(request.teamName());
            require(team != null && team.active, "Maintenance team not found or inactive");
            require(teamCanServePlant(team, w.plantCode), "Maintenance team cannot serve this plant");
            require(domainOf(team) == domainOf(w),
                    "Maintenance team belongs to " + humanDomain(domainOf(team)) + ", not " + humanDomain(domainOf(w)));
            w.teamName = team.name;
            if (!notBlank(request.responsible())) w.responsible = blankToNull(team.lead);
        }

        if (notBlank(request.responsible())) {
            validateAssignableUser(request.responsible(), w.plantCode, domainOf(w), false);
            w.responsible = clean(request.responsible());
        }
        require(notBlank(w.responsible), "Responsible technician is required");

        if (request.scheduledAt() != null) w.scheduledAt = request.scheduledAt();
        if (request.estimatedMinutes() != null) w.estimatedMinutes = nonNegative(request.estimatedMinutes(), "Estimated minutes");

        WorkStatus from = w.status;
        if (EnumSet.of(WorkStatus.NEW, WorkStatus.PLANNED, WorkStatus.ASSIGNED, WorkStatus.ACCEPTED).contains(w.status)) {
            w.status = WorkStatus.ASSIGNED;
            w.acceptedAt = null;
            w.acceptedBy = null;
        }
        w.assignedBy = actor(auth);
        w.assignedAt = LocalDateTime.now();
        w.updatedBy = actor(auth);
        w.updatedAt = LocalDateTime.now();
        audit("WORK_ORDER", w.id, "ASSIGNED", from.name(), w.status.name(), actor(auth),
                firstNonBlank(request.note(), "Assigned to " + w.responsible));
        return workOrderDetail(w);
    }

    public Map<String, Object> changeStatus(UUID id, StatusChange request, Authentication auth) {
        require(request != null && request.status() != null, "Target status is required");
        User current = currentUserService.requireCurrentUser();
        WorkOrder w = requireOrder(id, true);
        requirePlantWriteAccess(w.plantCode);
        require(canReadOrder(current, w), "You are not allowed to update this maintenance request");
        checkVersion(w.version, request.version());

        WorkStatus from = w.status;
        WorkStatus to = request.status();
        require(from != to, "Work order is already in " + to.name());
        require(allowedTransitionsFor(current, w).contains(to), "Invalid or unauthorized transition: " + from + " → " + to);

        LocalDateTime now = LocalDateTime.now();

        if (to == WorkStatus.PLANNED) {
            require(canCoordinate(current, domainOf(w)), "Planning permission is required for this department");
            require(w.scheduledAt != null, "Schedule date is required before moving work to Planned");
        }

        if (to == WorkStatus.ACCEPTED) {
            require(notBlank(w.responsible), "Assign a head technician / technician before acceptance");
            require(canExecuteOrder(current, w), "Only the assigned technician or maintenance coordinator can accept this job");
            w.acceptedAt = now;
            w.acceptedBy = current.getUsername();
        }

        if (to == WorkStatus.IN_PROGRESS) {
            require(canExecuteOrder(current, w), "Only the assigned technician or maintenance coordinator can start this job");
            if (w.acceptedAt == null) {
                w.acceptedAt = now;
                w.acceptedBy = current.getUsername();
            }
            if (w.startedAt == null) w.startedAt = now;
        }

        if (to == WorkStatus.WAITING_PARTS) {
            require(canExecuteOrder(current, w), "Only the assigned technician or maintenance coordinator can hold this job");
            require(notBlank(request.note()), "Waiting-parts reason / required part is required");
        }

        if (to == WorkStatus.REPAIRED) {
            require(canExecuteOrder(current, w), "Only the assigned technician or maintenance coordinator can repair this job");
            if (w.startedAt == null) w.startedAt = now;
            if (request.actualMinutes() != null) w.actualMinutes = nonNegative(request.actualMinutes(), "Actual minutes");
            else w.actualMinutes = Math.toIntExact(Math.max(0, Duration.between(w.startedAt, now).toMinutes()));
            if (request.downtimeMinutes() != null) w.downtimeMinutes = nonNegative(request.downtimeMinutes(), "Downtime minutes");
            else if (w.productionStopped) w.downtimeMinutes = Math.toIntExact(Math.max(0, Duration.between(w.requestedAt, now).toMinutes()));
            if (request.rootCause() != null) w.rootCause = clean(request.rootCause());
            if (request.actionTaken() != null) w.actionTaken = clean(request.actionTaken());
            if (request.partsUsed() != null) w.partsUsed = clean(request.partsUsed());
            if (request.partsCost() != null) w.partsCost = money(request.partsCost());
            if (request.laborCost() != null) w.laborCost = money(request.laborCost());
            if (request.externalCost() != null) w.externalCost = money(request.externalCost());

            require(notBlank(w.actionTaken), "Work done / action taken is required before marking repaired");
            if (w.workType == WorkType.CORRECTIVE || w.breakdown) {
                require(notBlank(w.rootCause), "Root cause / best-known cause is required for corrective breakdowns");
            }
            w.repairedAt = now;
        }

        if (to == WorkStatus.CLOSED) {
            require(canCoordinate(current, domainOf(w)), "Department head verification is required to close a job");
            String verification = firstNonBlank(request.verificationNote(), w.verificationNote);
            require(notBlank(verification), domainOf(w) == ServiceDomain.IT
                    ? "IT service verification / user handover note is required before closing"
                    : "Machine test / handover verification note is required before closing");
            w.verificationNote = verification;
            w.closedAt = now;
            registerFailureOnce(w);
            completePreventiveCycleIfNeeded(w);
        }

        if (to == WorkStatus.CANCELLED || to == WorkStatus.SCRAPPED) {
            require(notBlank(request.note()), "A reason is required for " + humanStatus(to));
        }

        if (from == WorkStatus.CLOSED && to == WorkStatus.IN_PROGRESS) {
            require(currentUserService.isAdmin(current) || canCoordinate(current, domainOf(w)), "Only the department head/admin can reopen a closed job");
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

    public Map<String, Object> listEquipment(
            String plantCode,
            ServiceDomain serviceDomain,
            EquipmentStatus status,
            String category,
            String search) {
        User current = currentUserService.requireCurrentUser();
        Set<String> scope = readPlantScope(plantCode);
        Set<ServiceDomain> domains = readDomainScope(current, serviceDomain);
        List<Equipment> items = listEquipmentEntities(scope, domains, status, category, search);
        Map<UUID, Long> openCounts = openWorkOrderCountsByEquipment(scope, domains);
        List<Map<String, Object>> views = items.stream()
                .map(e -> equipmentSummary(e, openCounts.getOrDefault(e.id, 0L)))
                .toList();
        return map(
                "items", views,
                "total", views.size(),
                "scope", serviceDomain == null && domains.size() > 1 ? "ALL" : domains.iterator().next().name()
        );
    }

    public Map<String, Object> getEquipment(UUID id) {
        User current = currentUserService.requireCurrentUser();
        Equipment e = requireEquipment(id, false);
        requirePlantReadAccess(e.plantCode);
        requireDomainReadAccess(current, domainOf(e));
        Map<String, Object> out = equipmentDetail(e);
        out.put("health", equipmentHealth(e));
        out.put("recentWorkOrders", listOrdersForEquipment(e.id, 10).stream()
                .filter(w -> canReadOrder(current, w))
                .map(this::workOrderSummary)
                .toList());
        out.put("plans", listPlanEntities(Set.of(e.plantCode), false).stream()
                .filter(p -> p.equipmentId.equals(e.id))
                .map(this::planView)
                .toList());
        out.put("audit", listAudit("EQUIPMENT", e.id));
        out.put("canManage", canManageAsset(current, domainOf(e)));
        return out;
    }

    public Map<String, Object> createEquipment(EquipmentUpsert request, Authentication auth) {
        require(request != null, "Request body is required");
        User current = currentUserService.requireCurrentUser();
        ServiceDomain domain = request.serviceDomain() == null ? ServiceDomain.MACHINE : request.serviceDomain();
        require(canManageAsset(current, domain), humanDomain(domain) + " head/admin permission is required");
        validateEquipment(request, null);
        requirePlantWriteAccess(request.plantCode());

        Equipment e = new Equipment();
        applyEquipment(e, request);
        e.createdBy = actor(auth);
        e.updatedBy = actor(auth);
        e.createdAt = LocalDateTime.now();
        e.updatedAt = e.createdAt;
        em.persist(e);
        audit("EQUIPMENT", e.id, "CREATED", null, e.status.name(), actor(auth),
                e.assetCode + " · " + e.name + " · " + humanDomain(domain));
        return equipmentDetail(e);
    }

    public Map<String, Object> updateEquipment(UUID id, EquipmentUpsert request, Authentication auth) {
        require(request != null, "Request body is required");
        User current = currentUserService.requireCurrentUser();
        Equipment e = requireEquipment(id, true);
        requirePlantWriteAccess(e.plantCode);
        require(canManageAsset(current, domainOf(e)), humanDomain(domainOf(e)) + " head/admin permission is required");
        checkVersion(e.version, request.version());

        ServiceDomain targetDomain = request.serviceDomain() == null ? domainOf(e) : request.serviceDomain();
        require(targetDomain == domainOf(e) || currentUserService.isAdmin(current),
                "Moving an asset between Machine Maintenance and IT is ADMIN-only");
        require(canManageAsset(current, targetDomain), "You cannot manage assets in " + humanDomain(targetDomain));

        validateEquipment(request, id);
        requirePlantWriteAccess(request.plantCode());
        applyEquipment(e, request);
        e.updatedBy = actor(auth);
        e.updatedAt = LocalDateTime.now();
        audit("EQUIPMENT", e.id, "UPDATED", e.status.name(), e.status.name(), actor(auth), "Asset master updated");
        return equipmentDetail(e);
    }

    private void validateEquipment(EquipmentUpsert request, UUID currentId) {
        require(request != null, "Request body is required");
        require(notBlank(request.assetCode()), "Asset code is required");
        require(notBlank(request.name()), "Asset name is required");
        require(notBlank(request.plantCode()), "Plant code is required");
        ServiceDomain requestedDomain = request.serviceDomain() == null ? ServiceDomain.MACHINE : request.serviceDomain();

        String duplicateJpql = "select count(e) from AssetFlowEquipment e where lower(e.assetCode)=:code"
                + (currentId == null ? "" : " and e.id<>:id");
        TypedQuery<Long> duplicateQuery = em.createQuery(duplicateJpql, Long.class)
                .setParameter("code", request.assetCode().trim().toLowerCase(Locale.ROOT));
        if (currentId != null) duplicateQuery.setParameter("id", currentId);
        require(duplicateQuery.getSingleResult() == 0L, "Asset code already exists");

        if (notBlank(request.maintenanceTeam())) {
            Team team = findTeamByName(request.maintenanceTeam());
            require(team != null && team.active, "Maintenance/service team not found or inactive");
            require(teamCanServePlant(team, request.plantCode()),
                    "Maintenance/service team cannot serve plant " + normalizePlant(request.plantCode()));
            require(domainOf(team) == requestedDomain,
                    "Selected team belongs to " + humanDomain(domainOf(team)) + ", not " + humanDomain(requestedDomain));
        }
        if (notBlank(request.primaryTechnician())) {
            validateAssignableUser(request.primaryTechnician(), request.plantCode(), requestedDomain, false);
        }
    }

    private void applyEquipment(Equipment e, EquipmentUpsert r) {
        ServiceDomain domain = r.serviceDomain() == null ? ServiceDomain.MACHINE : r.serviceDomain();
        e.assetCode = clean(r.assetCode()).toUpperCase(Locale.ROOT);
        e.name = clean(r.name());
        e.category = clean(r.category());
        e.serviceDomain = domain;
        e.assetKind = r.assetKind() == null ? defaultAssetKind(domain) : r.assetKind();
        e.plantCode = normalizePlant(r.plantCode());
        e.location = clean(r.location());
        e.workCenter = domain == ServiceDomain.MACHINE ? clean(r.workCenter()) : null;
        e.manufacturer = clean(r.manufacturer());
        e.model = clean(r.model());
        e.serialNumber = clean(r.serialNumber());
        e.criticality = r.criticality() == null ? Criticality.MEDIUM : r.criticality();
        e.status = r.status() == null ? EquipmentStatus.ACTIVE : r.status();
        e.maintenanceTeam = clean(r.maintenanceTeam());
        e.primaryTechnician = clean(r.primaryTechnician());
        e.owner = clean(r.owner());

        if (domain == ServiceDomain.IT) {
            e.assignedToCode = clean(r.assignedToCode());
            e.assignedToName = clean(r.assignedToName());
            e.assignedDepartment = clean(r.assignedDepartment());
            e.hostname = clean(r.hostname());
            e.ipAddress = clean(r.ipAddress());
            e.macAddress = clean(r.macAddress());
            e.operatingSystem = clean(r.operatingSystem());
        } else {
            e.assignedToCode = null;
            e.assignedToName = null;
            e.assignedDepartment = null;
            e.hostname = null;
            e.ipAddress = null;
            e.macAddress = null;
            e.operatingSystem = null;
        }

        e.purchaseDate = r.purchaseDate();
        e.commissionedDate = r.commissionedDate();
        e.warrantyExpiry = r.warrantyExpiry();
        if (r.qrEnabled() != null) e.qrEnabled = r.qrEnabled();
        if (e.qrToken == null) e.qrToken = UUID.randomUUID();
        e.description = clean(r.description());
        e.safetyNotes = clean(r.safetyNotes());
    }

    public Map<String, Object> rotateEquipmentQr(UUID id, Authentication auth) {
        User current = currentUserService.requireCurrentUser();
        Equipment e = requireEquipment(id, true);
        requirePlantWriteAccess(e.plantCode);
        require(canManageAsset(current, domainOf(e)), humanDomain(domainOf(e)) + " head/admin permission is required");
        e.qrToken = UUID.randomUUID();
        e.qrEnabled = true;
        e.updatedBy = actor(auth);
        e.updatedAt = LocalDateTime.now();
        audit("EQUIPMENT", e.id, "QR_ROTATED", null, null, actor(auth),
                humanDomain(domainOf(e)) + " asset QR token rotated");
        return equipmentDetail(e);
    }

    /* =============================== TEAMS =============================== */

    public List<Map<String, Object>> listTeams(String plantCode, ServiceDomain serviceDomain) {
        User current = currentUserService.requireCurrentUser();
        Set<String> scope = readPlantScope(plantCode);
        Set<ServiceDomain> domains = readDomainScope(current, serviceDomain);
        return em.createQuery(
                        "select t from AssetFlowTeam t where (t.plantCode is null or t.plantCode in :plants) "
                                + "and t.serviceDomain in :domains "
                                + "order by t.defaultForPlant desc, t.active desc, t.name",
                        Team.class)
                .setParameter("plants", scope)
                .setParameter("domains", domains)
                .getResultList()
                .stream()
                .map(this::teamView)
                .toList();
    }

    public Map<String, Object> saveTeam(UUID id, TeamUpsert request) {
        require(request != null && notBlank(request.name()), "Team name is required");
        User current = currentUserService.requireCurrentUser();
        ServiceDomain requestedDomain = request.serviceDomain() == null ? ServiceDomain.MACHINE : request.serviceDomain();

        Team t = id == null ? new Team() : em.find(Team.class, id, LockModeType.PESSIMISTIC_WRITE);
        if (id != null && t == null) throw notFound("Team not found");
        if (id != null) {
            checkVersion(t.version, request.version());
            require(canManageAsset(current, domainOf(t)), humanDomain(domainOf(t)) + " head/admin permission is required");
            if (domainOf(t) != requestedDomain) {
                require(currentUserService.isAdmin(current), "Moving a team between departments is ADMIN-only");
            }
            if (notBlank(t.plantCode)) requirePlantWriteAccess(t.plantCode);
        }
        require(canManageAsset(current, requestedDomain), humanDomain(requestedDomain) + " head/admin permission is required");

        String targetPlant = blankToNull(request.plantCode());
        if (targetPlant == null) {
            require(requestedDomain == ServiceDomain.IT,
                    "Machine Maintenance teams must be assigned to a specific plant");
            require(currentUserService.isAdmin(current),
                    "Only ADMIN can create a company-wide IT service team");
        } else {
            targetPlant = normalizePlant(targetPlant);
            requirePlantWriteAccess(targetPlant);
        }

        String lead = blankToNull(request.lead());
        if (lead != null) {
            validateHeadTechnician(lead, targetPlant, requestedDomain);
        }

        List<String> members = splitMembers(request.membersText());
        for (String member : members) {
            validateAssignableUser(member, targetPlant, requestedDomain, false);
        }
        if (lead != null && !members.stream().anyMatch(m -> m.equalsIgnoreCase(lead))) {
            members = new ArrayList<>(members);
            members.add(0, lead);
        }

        boolean defaultForPlant = Boolean.TRUE.equals(request.defaultForPlant());
        if (defaultForPlant) {
            require(targetPlant != null, "Only plant-specific teams can be the default plant route");
            String update = "update AssetFlowTeam t set t.defaultForPlant=false "
                    + "where t.plantCode=:plant and t.serviceDomain=:domain"
                    + (id == null ? "" : " and t.id<>:id");
            var q = em.createQuery(update)
                    .setParameter("plant", targetPlant)
                    .setParameter("domain", requestedDomain);
            if (id != null) q.setParameter("id", t.id);
            q.executeUpdate();
        }

        t.name = clean(request.name());
        t.plantCode = targetPlant;
        t.serviceDomain = requestedDomain;
        t.lead = lead;
        t.membersText = members.isEmpty() ? null : String.join(", ", members);
        t.defaultForPlant = defaultForPlant;
        if (t.requestToken == null) t.requestToken = UUID.randomUUID();
        if (request.publicReportingEnabled() != null) t.publicReportingEnabled = request.publicReportingEnabled();
        t.defaultCategories = clean(request.defaultCategories());
        if (request.active() != null) t.active = request.active();
        t.updatedAt = LocalDateTime.now();
        if (id == null) em.persist(t);
        return teamView(t);
    }

    /* =============================== PREVENTIVE PLANS =============================== */

    public List<Map<String, Object>> listPlans(String plantCode, ServiceDomain serviceDomain, Boolean activeOnly) {
        User current = currentUserService.requireCurrentUser();
        Set<String> scope = readPlantScope(plantCode);
        Set<ServiceDomain> domains = readDomainScope(current, serviceDomain);
        return listPlanEntities(scope, Boolean.TRUE.equals(activeOnly)).stream()
                .filter(p -> domains.contains(planDomain(p)))
                .map(this::planView)
                .toList();
    }

    public Map<String, Object> savePlan(UUID id, PreventivePlanUpsert request) {
        require(request != null, "Request body is required");
        require(request.equipmentId() != null, "Asset is required");
        require(notBlank(request.title()), "Plan title is required");
        require(request.intervalDays() != null && request.intervalDays() > 0, "Interval days must be greater than zero");
        require(request.nextDueDate() != null, "Next due date is required");

        User current = currentUserService.requireCurrentUser();
        Equipment equipment = requireEquipment(request.equipmentId(), false);
        requirePlantWriteAccess(equipment.plantCode);
        require(canManageAsset(current, domainOf(equipment)),
                humanDomain(domainOf(equipment)) + " head/admin permission is required to manage preventive plans");

        PreventivePlan p = id == null
                ? new PreventivePlan()
                : em.find(PreventivePlan.class, id, LockModeType.PESSIMISTIC_WRITE);
        if (id != null && p == null) throw notFound("Preventive plan not found");
        if (id != null) {
            checkVersion(p.version, request.version());
            Equipment previousEquipment = requireEquipment(p.equipmentId, false);
            requirePlantWriteAccess(previousEquipment.plantCode);
            require(canManageAsset(current, domainOf(previousEquipment)),
                    "You cannot edit a preventive plan owned by another department");
        }

        Team routedTeam = resolveRoutingTeam(equipment);
        String defaultTeam = routedTeam != null ? routedTeam.name : equipment.maintenanceTeam;
        String defaultResponsible = routedTeam != null ? routedTeam.lead : equipment.primaryTechnician;

        p.equipmentId = equipment.id;
        p.equipmentName = equipment.name;
        p.title = clean(request.title());
        p.intervalDays = request.intervalDays();
        p.leadDays = request.leadDays() == null ? 3 : Math.max(0, request.leadDays());
        p.nextDueDate = request.nextDueDate();
        p.scheduledTime = request.scheduledTime() == null ? LocalTime.of(9, 0) : request.scheduledTime();
        p.estimatedMinutes = request.estimatedMinutes() == null ? 60 : nonNegative(request.estimatedMinutes(), "Estimated minutes");
        p.defaultPriority = request.defaultPriority() == null ? Priority.NORMAL : request.defaultPriority();

        if (notBlank(request.teamName())) {
            Team selectedTeam = findTeamByName(request.teamName());
            require(selectedTeam != null && selectedTeam.active, "Preventive maintenance team not found or inactive");
            require(teamCanServePlant(selectedTeam, equipment.plantCode), "Preventive maintenance team cannot serve this plant");
            require(domainOf(selectedTeam) == domainOf(equipment),
                    "Preventive maintenance team belongs to " + humanDomain(domainOf(selectedTeam)) + ", not " + humanDomain(domainOf(equipment)));
        }
        p.teamName = firstNonBlank(request.teamName(), defaultTeam);
        p.responsible = firstNonBlank(request.responsible(), defaultResponsible);
        if (notBlank(p.responsible)) {
            validateAssignableUser(p.responsible, equipment.plantCode, domainOf(equipment), false);
        }
        p.requiresShutdown = Boolean.TRUE.equals(request.requiresShutdown());
        p.instructions = clean(request.instructions());
        p.checklistText = clean(request.checklistText());
        p.active = request.active() == null || request.active();
        p.updatedAt = LocalDateTime.now();
        if (id == null) em.persist(p);
        updateEquipmentNextMaintenance(equipment.id);
        return planView(p);
    }

    /**
     * Manual generation is constrained to the signed-in user's plants and department scope.
     * The scheduled run is system-wide and does not depend on a SecurityContext.
     */
    public int generateDuePreventiveOrders(ServiceDomain serviceDomain) {
        User current = currentUserService.requireCurrentUser();
        Set<ServiceDomain> domains = readDomainScope(current, serviceDomain);
        require(canManageAnyRequestedDomain(current, domains), "Department head/admin permission is required");
        return generateDuePreventiveOrdersForPlants(readPlantScope(null), domains, current.getUsername());
    }

    @Scheduled(cron = "0 10 1 * * *")
    public void generateDuePreventiveOrdersScheduled() {
        generateDuePreventiveOrdersForPlants(null, Set.of(ServiceDomain.MACHINE, ServiceDomain.IT), "SYSTEM");
    }

    private int generateDuePreventiveOrdersForPlants(Set<String> allowedPlants, Set<ServiceDomain> allowedDomains, String actor) {
        LocalDate today = LocalDate.now();
        StringBuilder jpql = new StringBuilder(
                "select p from AssetFlowPreventivePlan p where p.active=true and p.nextDueDate<=:cutoff");
        if (allowedPlants != null) {
            jpql.append(" and p.equipmentId in (select e.id from AssetFlowEquipment e where e.plantCode in :plants and e.serviceDomain in :domains)");
        } else {
            jpql.append(" and p.equipmentId in (select e.id from AssetFlowEquipment e where e.serviceDomain in :domains)");
        }
        jpql.append(" order by p.nextDueDate");

        TypedQuery<PreventivePlan> query = em.createQuery(jpql.toString(), PreventivePlan.class)
                .setParameter("cutoff", today.plusDays(30))
                .setParameter("domains", allowedDomains);
        if (allowedPlants != null) query.setParameter("plants", allowedPlants);
        List<PreventivePlan> plans = query.getResultList();

        int created = 0;
        for (PreventivePlan p : plans) {
            if (p.nextDueDate.isAfter(today.plusDays(p.leadDays))) continue;
            if (p.lastGeneratedFor != null && p.lastGeneratedFor.equals(p.nextDueDate)) continue;

            Equipment e = em.find(Equipment.class, p.equipmentId);
            if (e == null || e.status == EquipmentStatus.RETIRED) continue;
            if (!allowedDomains.contains(domainOf(e))) continue;
            if (allowedPlants != null && !allowedPlants.contains(normalizePlant(e.plantCode))) continue;

            Team route = resolveRoutingTeam(e);
            WorkOrder w = new WorkOrder();
            w.workNumber = nextWorkNumber();
            w.title = p.title + " · " + e.name;
            w.instructions = joinText(p.instructions, p.checklistText);
            w.equipmentId = e.id;
            w.equipmentName = e.name;
            w.equipmentCode = e.assetCode;
            w.serviceDomain = domainOf(e);
            w.requestCategory = "Preventive Maintenance";
            w.plantCode = e.plantCode;
            w.location = e.location;
            w.workCenter = e.workCenter;
            w.requestedBy = "AssetFlow PM Scheduler";
            w.teamName = firstNonBlank(p.teamName, route == null ? null : route.name);
            w.responsible = firstNonBlank(p.responsible, route == null ? null : route.lead);
            w.workType = WorkType.PREVENTIVE;
            w.status = notBlank(w.responsible) ? WorkStatus.ASSIGNED : WorkStatus.PLANNED;
            w.priority = p.defaultPriority;
            w.complaintSource = ComplaintSource.PREVENTIVE;
            w.requestedAt = LocalDateTime.now();
            w.requestedForAt = p.nextDueDate.atTime(p.scheduledTime == null ? LocalTime.of(9, 0) : p.scheduledTime);
            w.scheduledAt = w.requestedForAt;
            w.estimatedMinutes = p.estimatedMinutes == null ? 60 : p.estimatedMinutes;
            w.downtimeMinutes = 0;
            w.breakdown = false;
            w.productionStopped = p.requiresShutdown;
            w.preventivePlanId = p.id;
            if (notBlank(w.responsible)) {
                w.assignedAt = LocalDateTime.now();
                w.assignedBy = actor;
            }
            w.createdBy = actor;
            w.updatedBy = actor;
            w.createdAt = LocalDateTime.now();
            w.updatedAt = w.createdAt;
            em.persist(w);
            audit("WORK_ORDER", w.id, "PM_AUTO_CREATED", null, w.status.name(), actor, p.title);

            p.lastGeneratedFor = p.nextDueDate;
            p.nextDueDate = p.nextDueDate.plusDays(p.intervalDays);
            p.updatedAt = LocalDateTime.now();
            updateEquipmentNextMaintenance(e.id);
            created++;
        }
        return created;
    }

    /* =============================== CALENDAR / REPORTS =============================== */

    public List<Map<String, Object>> calendar(
            LocalDate from,
            LocalDate to,
            String plantCode,
            ServiceDomain serviceDomain) {
        User current = currentUserService.requireCurrentUser();
        Set<String> scope = readPlantScope(plantCode);
        Set<ServiceDomain> domains = readDomainScope(current, serviceDomain);
        LocalDate start = from == null ? LocalDate.now().with(java.time.DayOfWeek.MONDAY) : from;
        LocalDate end = to == null ? start.plusDays(13) : to;
        require(!end.isBefore(start), "Calendar end date cannot be before start date");
        LocalDateTime startAt = start.atStartOfDay();
        LocalDateTime endAt = end.plusDays(1).atStartOfDay();

        List<WorkOrder> orders = em.createQuery(
                        "select w from AssetFlowWorkOrder w where w.scheduledAt>=:from and w.scheduledAt<:to "
                                + "and w.plantCode in :plants and w.serviceDomain in :domains order by w.scheduledAt",
                        WorkOrder.class)
                .setParameter("from", startAt)
                .setParameter("to", endAt)
                .setParameter("plants", scope)
                .setParameter("domains", domains)
                .getResultList()
                .stream()
                .filter(w -> canReadOrder(current, w))
                .toList();

        List<Map<String, Object>> events = new ArrayList<>();
        for (WorkOrder w : orders) {
            events.add(map(
                    "id", w.id,
                    "kind", "WORK_ORDER",
                    "title", w.title,
                    "number", w.workNumber,
                    "serviceDomain", domainOf(w).name(),
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
            ServiceDomain domain = planDomain(p);
            if (!domains.contains(domain)) continue;
            if (p.nextDueDate.isBefore(start) || p.nextDueDate.isAfter(end)) continue;
            events.add(map(
                    "id", p.id,
                    "kind", "PM_DUE",
                    "title", p.title,
                    "serviceDomain", domain.name(),
                    "date", p.nextDueDate,
                    "responsible", p.responsible,
                    "equipment", p.equipmentName,
                    "priority", p.defaultPriority.name()
            ));
        }
        events.sort(Comparator.comparing(o -> String.valueOf(o.get("date"))));
        return events;
    }

    public Map<String, Object> reports(
            LocalDate from,
            LocalDate to,
            String plantCode,
            ServiceDomain serviceDomain) {
        User current = currentUserService.requireCurrentUser();
        require(canViewReports(current), "Reporting access is restricted to department heads, Director and ADMIN");
        Set<String> scope = readPlantScope(plantCode);
        Set<ServiceDomain> domains = readDomainScope(current, serviceDomain);
        LocalDate start = from == null ? LocalDate.now().minusMonths(6).withDayOfMonth(1) : from;
        LocalDate end = to == null ? LocalDate.now() : to;
        require(!end.isBefore(start), "Report end date cannot be before start date");
        LocalDateTime fromAt = start.atStartOfDay();
        LocalDateTime toAt = end.plusDays(1).atStartOfDay();

        List<WorkOrder> orders = listOrdersByCreatedRange(scope, fromAt, toAt).stream()
                .filter(w -> domains.contains(domainOf(w)))
                .filter(w -> canReadOrder(current, w))
                .toList();

        Map<String, List<WorkOrder>> byTechnician = orders.stream()
                .filter(w -> notBlank(w.responsible))
                .collect(Collectors.groupingBy(w -> w.responsible));
        List<Map<String, Object>> technicians = byTechnician.entrySet().stream()
                .map(e -> {
                    List<WorkOrder> list = e.getValue();
                    long closed = list.stream().filter(w -> w.status == WorkStatus.CLOSED || w.status == WorkStatus.REPAIRED).count();
                    double avgRepair = list.stream().map(this::resolvedActualMinutes).filter(Objects::nonNull)
                            .mapToInt(Integer::intValue).average().orElse(0);
                    long downtime = list.stream().map(w -> w.downtimeMinutes).filter(Objects::nonNull)
                            .mapToLong(Integer::longValue).sum();
                    double response = list.stream().map(this::responseMinutes).filter(Objects::nonNull)
                            .mapToInt(Integer::intValue).average().orElse(0);
                    return map(
                            "name", e.getKey(),
                            "orders", list.size(),
                            "closed", closed,
                            "avgResponseMinutes", round(response, 1),
                            "avgRepairHours", round(avgRepair / 60.0, 1),
                            "downtimeHours", round(downtime / 60.0, 1)
                    );
                })
                .sorted(Comparator.comparing(o -> -((Number) o.get("orders")).intValue()))
                .toList();

        Map<String, List<WorkOrder>> byEquipment = orders.stream()
                .filter(w -> notBlank(w.equipmentName))
                .collect(Collectors.groupingBy(w -> w.equipmentName));
        List<Map<String, Object>> assets = byEquipment.entrySet().stream()
                .map(e -> {
                    List<WorkOrder> list = e.getValue();
                    ServiceDomain domain = domainOf(list.get(0));
                    long failures = list.stream().filter(w -> w.breakdown).count();
                    long downtime = list.stream().map(w -> w.downtimeMinutes).filter(Objects::nonNull)
                            .mapToLong(Integer::longValue).sum();
                    BigDecimal cost = list.stream().map(this::totalCost).reduce(BigDecimal.ZERO, BigDecimal::add);
                    return map(
                            "name", e.getKey(),
                            "serviceDomain", domain.name(),
                            "orders", list.size(),
                            "failures", failures,
                            "downtimeHours", round(downtime / 60.0, 1),
                            "cost", cost
                    );
                })
                .sorted(Comparator.comparing(o -> -((Number) o.get("failures")).intValue()))
                .limit(25)
                .toList();

        Map<YearMonth, List<WorkOrder>> byMonth = orders.stream()
                .collect(Collectors.groupingBy(w -> YearMonth.from(w.createdAt)));
        List<Map<String, Object>> months = byMonth.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(e -> map(
                        "month", e.getKey().toString(),
                        "opened", e.getValue().size(),
                        "closed", e.getValue().stream().filter(w -> w.status == WorkStatus.CLOSED || w.status == WorkStatus.REPAIRED).count(),
                        "breakdowns", e.getValue().stream().filter(w -> w.breakdown).count(),
                        "downtimeHours", round(e.getValue().stream().map(w -> w.downtimeMinutes).filter(Objects::nonNull)
                                .mapToLong(Integer::longValue).sum() / 60.0, 1)
                ))
                .toList();

        BigDecimal totalCost = orders.stream().map(this::totalCost).reduce(BigDecimal.ZERO, BigDecimal::add);
        long corrective = orders.stream().filter(w -> w.workType == WorkType.CORRECTIVE).count();
        long preventive = orders.stream().filter(w -> w.workType == WorkType.PREVENTIVE).count();
        long completed = orders.stream().filter(w -> w.status == WorkStatus.CLOSED || w.status == WorkStatus.REPAIRED).count();

        List<Map<String, Object>> byServiceDomain = new ArrayList<>();
        for (ServiceDomain domain : ServiceDomain.values()) {
            if (!domains.contains(domain)) continue;
            List<WorkOrder> list = orders.stream().filter(w -> domainOf(w) == domain).toList();
            long done = list.stream().filter(w -> w.status == WorkStatus.CLOSED || w.status == WorkStatus.REPAIRED).count();
            long open = list.stream().filter(w -> !TERMINAL.contains(w.status)).count();
            long downtime = list.stream().map(w -> w.downtimeMinutes).filter(Objects::nonNull)
                    .mapToLong(Integer::longValue).sum();
            BigDecimal cost = list.stream().map(this::totalCost).reduce(BigDecimal.ZERO, BigDecimal::add);
            double response = list.stream().map(this::responseMinutes).filter(Objects::nonNull)
                    .mapToInt(Integer::intValue).average().orElse(0);
            double repair = list.stream().map(this::resolvedActualMinutes).filter(Objects::nonNull)
                    .mapToInt(Integer::intValue).average().orElse(0) / 60.0;
            long assetCount = listEquipmentEntities(scope, Set.of(domain), null, null, null).size();
            byServiceDomain.add(map(
                    "serviceDomain", domain.name(),
                    "label", humanDomain(domain),
                    "orders", list.size(),
                    "completed", done,
                    "open", open,
                    "avgResponseMinutes", round(response, 1),
                    "avgResolutionHours", round(repair, 1),
                    "downtimeHours", round(downtime / 60.0, 1),
                    "assets", assetCount,
                    "cost", cost
            ));
        }

        return map(
                "from", start,
                "to", end,
                "scope", serviceDomain == null && domains.size() > 1 ? "ALL" : domains.iterator().next().name(),
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
                "byServiceDomain", byServiceDomain,
                "monthly", months
        );
    }

    public List<Map<String, Object>> categories(ServiceDomain serviceDomain) {
        User current = currentUserService.requireCurrentUser();
        Set<String> scope = readPlantScope(null);
        Set<ServiceDomain> domains = readDomainScope(current, serviceDomain);
        List<String> names = em.createQuery(
                        "select distinct e.category from AssetFlowEquipment e where e.plantCode in :plants "
                                + "and e.serviceDomain in :domains and e.category is not null and e.category<>'' order by e.category",
                        String.class)
                .setParameter("plants", scope)
                .setParameter("domains", domains)
                .getResultList();
        return names.stream().map(n -> map("name", n)).toList();
    }

    public List<Map<String, Object>> plants() {
        User current = currentUserService.requireCurrentUser();
        return currentUserService.allowedPlants(current)
                .stream()
                .filter(Objects::nonNull)
                .map(AssetFlowService::normalizePlant)
                .filter(AssetFlowService::notBlank)
                .distinct()
                .sorted()
                .map(n -> map("name", n))
                .toList();
    }

    public List<Map<String, Object>> users(String plantCode, ServiceDomain serviceDomain) {
        User current = currentUserService.requireCurrentUser();
        Set<String> scope = readPlantScope(plantCode);
        Set<ServiceDomain> domains = readDomainScope(current, serviceDomain);
        boolean currentIsAdmin = currentUserService.isAdmin(current);

        return userRepository.findAll(Sort.by(Sort.Direction.ASC, "username"))
                .stream()
                .filter(User::isEnabled)
                .filter(this::isAssetFlowOperationalUser)
                .filter(user -> domains.stream().anyMatch(d -> hasDomainReadAccess(user, d)))
                .filter(user -> {
                    if (currentIsAdmin && !notBlank(plantCode)) return true;
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
                        "plantCodes", safePlants(user).stream().sorted().toList(),
                        "domains", ServiceDomain.values().length == 0 ? List.of() :
                                java.util.Arrays.stream(ServiceDomain.values())
                                        .filter(d -> hasDomainReadAccess(user, d))
                                        .map(Enum::name)
                                        .toList()
                ))
                .toList();
    }

    /* =============================== INTERNAL QUERIES =============================== */

    private QueryResult<WorkOrder> queryOrders(
            Set<String> plants,
            Set<ServiceDomain> domains,
            WorkStatus status,
            WorkType type,
            Priority priority,
            UUID equipmentId,
            String responsible,
            String requestedBy,
            String search,
            int page,
            int size
    ) {
        StringBuilder where = new StringBuilder(
                " where w.plantCode in :plants and w.serviceDomain in :domains ");
        Map<String, Object> params = new HashMap<>();
        params.put("plants", plants);
        params.put("domains", domains);

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
        if (notBlank(requestedBy)) {
            where.append(" and lower(w.requestedBy)=:requestedBy ");
            params.put("requestedBy", clean(requestedBy).toLowerCase(Locale.ROOT));
        }
        if (notBlank(search)) {
            where.append(" and (lower(w.title) like :search or lower(w.workNumber) like :search "
                    + "or lower(coalesce(w.equipmentName,'')) like :search "
                    + "or lower(coalesce(w.equipmentCode,'')) like :search "
                    + "or lower(coalesce(w.requestedBy,'')) like :search) ");
            params.put("search", "%" + clean(search).toLowerCase(Locale.ROOT) + "%");
        }

        TypedQuery<WorkOrder> query = em.createQuery(
                "select w from AssetFlowWorkOrder w" + where + " order by w.createdAt desc",
                WorkOrder.class);
        TypedQuery<Long> count = em.createQuery(
                "select count(w) from AssetFlowWorkOrder w" + where,
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
            Set<ServiceDomain> domains,
            EquipmentStatus status,
            String category,
            String search) {
        StringBuilder jpql = new StringBuilder(
                "select e from AssetFlowEquipment e where e.plantCode in :plants");
        Map<String, Object> params = new HashMap<>();
        params.put("plants", plants);
        if (domains != null && !domains.isEmpty()) {
            jpql.append(" and e.serviceDomain in :domains");
            params.put("domains", domains);
        }
        if (status != null) {
            jpql.append(" and e.status=:status");
            params.put("status", status);
        }
        if (notBlank(category)) {
            jpql.append(" and lower(e.category)=:category");
            params.put("category", clean(category).toLowerCase(Locale.ROOT));
        }
        if (notBlank(search)) {
            jpql.append(" and (lower(e.name) like :q or lower(e.assetCode) like :q "
                    + "or lower(coalesce(e.serialNumber,'')) like :q "
                    + "or lower(coalesce(e.category,'')) like :q "
                    + "or lower(coalesce(e.hostname,'')) like :q "
                    + "or lower(coalesce(e.assignedToName,'')) like :q)");
            params.put("q", "%" + clean(search).toLowerCase(Locale.ROOT) + "%");
        }
        jpql.append(" order by e.name");
        TypedQuery<Equipment> query = em.createQuery(jpql.toString(), Equipment.class);
        params.forEach(query::setParameter);
        return query.getResultList();
    }

    private List<Equipment> listEquipmentEntities(
            Set<String> plants,
            EquipmentStatus status,
            String category,
            String search) {
        return listEquipmentEntities(plants, null, status, category, search);
    }

    private List<PreventivePlan> listPlanEntities(Set<String> plants, boolean activeOnly) {
        StringBuilder jpql = new StringBuilder(
                "select p from AssetFlowPreventivePlan p where p.equipmentId in "
                        + "(select e.id from AssetFlowEquipment e where e.plantCode in :plants)");
        if (activeOnly) jpql.append(" and p.active=true");
        jpql.append(" order by p.nextDueDate, p.equipmentName");
        return em.createQuery(jpql.toString(), PreventivePlan.class)
                .setParameter("plants", plants)
                .getResultList();
    }

    private ServiceDomain planDomain(PreventivePlan p) {
        if (p == null || p.equipmentId == null) return ServiceDomain.MACHINE;
        Equipment e = em.find(Equipment.class, p.equipmentId);
        return domainOf(e);
    }

    private List<WorkOrder> listOrdersByCreatedRange(
            Set<String> plants,
            LocalDateTime from,
            LocalDateTime to) {
        return em.createQuery(
                        "select w from AssetFlowWorkOrder w where w.createdAt>=:from and w.createdAt<:to "
                                + "and w.plantCode in :plants order by w.createdAt",
                        WorkOrder.class)
                .setParameter("from", from)
                .setParameter("to", to)
                .setParameter("plants", plants)
                .getResultList();
    }

    private List<WorkOrder> listOrdersForEquipment(UUID equipmentId, int limit) {
        return em.createQuery(
                        "select w from AssetFlowWorkOrder w where w.equipmentId=:id order by w.createdAt desc",
                        WorkOrder.class)
                .setParameter("id", equipmentId)
                .setMaxResults(limit)
                .getResultList();
    }

    private Map<UUID, Long> openWorkOrderCountsByEquipment(Set<String> plants, Set<ServiceDomain> domains) {
        List<Object[]> rows = em.createQuery(
                        "select w.equipmentId, count(w) from AssetFlowWorkOrder w "
                                + "where w.equipmentId is not null and w.status not in :terminal "
                                + "and w.plantCode in :plants and w.serviceDomain in :domains group by w.equipmentId",
                        Object[].class)
                .setParameter("terminal", TERMINAL)
                .setParameter("plants", plants)
                .setParameter("domains", domains)
                .getResultList();
        return rows.stream().collect(Collectors.toMap(r -> (UUID) r[0], r -> (Long) r[1]));
    }

    private Map<UUID, Long> openWorkOrderCountsByEquipment(Set<String> plants) {
        return openWorkOrderCountsByEquipment(plants, Set.of(ServiceDomain.MACHINE, ServiceDomain.IT));
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

    private Equipment requireEquipmentByQr(UUID qrToken) {
        require(qrToken != null, "Machine QR token is required");
        List<Equipment> rows = em.createQuery(
                        "select e from AssetFlowEquipment e where e.qrToken=:token",
                        Equipment.class)
                .setParameter("token", qrToken)
                .setMaxResults(1)
                .getResultList();
        if (rows.isEmpty()) throw notFound("Machine QR code is invalid or has been replaced");
        return rows.get(0);
    }

    private Team findTeamByName(String name) {
        if (!notBlank(name)) return null;
        List<Team> rows = em.createQuery(
                        "select t from AssetFlowTeam t where lower(t.name)=:name",
                        Team.class)
                .setParameter("name", clean(name).toLowerCase(Locale.ROOT))
                .setMaxResults(1)
                .getResultList();
        return rows.isEmpty() ? null : rows.get(0);
    }

    private Team resolveRoutingTeam(Equipment equipment) {
        if (equipment == null) return null;
        return resolveRoutingTeam(equipment.plantCode, domainOf(equipment), equipment.maintenanceTeam);
    }

    private Team resolveRoutingTeam(String plantCode, ServiceDomain domain, String preferredTeamName) {
        String plant = normalizePlant(plantCode);
        ServiceDomain targetDomain = domain == null ? ServiceDomain.MACHINE : domain;

        Team explicit = findTeamByName(preferredTeamName);
        if (explicit != null && explicit.active && teamCanServePlant(explicit, plant) && domainOf(explicit) == targetDomain) {
            return explicit;
        }

        List<Team> defaults = em.createQuery(
                        "select t from AssetFlowTeam t where t.active=true and t.defaultForPlant=true "
                                + "and t.plantCode=:plant and (t.serviceDomain=:domain or (t.serviceDomain is null and :domain=:machineDomain)) "
                                + "order by t.updatedAt desc",
                        Team.class)
                .setParameter("plant", plant)
                .setParameter("domain", targetDomain)
                .setParameter("machineDomain", ServiceDomain.MACHINE)
                .setMaxResults(1)
                .getResultList();
        if (!defaults.isEmpty()) return defaults.get(0);

        List<Team> plantTeams = em.createQuery(
                        "select t from AssetFlowTeam t where t.active=true and (t.plantCode=:plant or t.plantCode is null) "
                                + "and (t.serviceDomain=:domain or (t.serviceDomain is null and :domain=:machineDomain)) "
                                + "order by case when t.plantCode=:plant then 0 else 1 end, t.name",
                        Team.class)
                .setParameter("plant", plant)
                .setParameter("domain", targetDomain)
                .setParameter("machineDomain", ServiceDomain.MACHINE)
                .setMaxResults(1)
                .getResultList();
        return plantTeams.isEmpty() ? null : plantTeams.get(0);
    }

    private String resolveHeadForEquipment(Equipment equipment) {
        Team team = resolveRoutingTeam(equipment);
        return team != null && notBlank(team.lead) ? team.lead : blankToNull(equipment.primaryTechnician);
    }

    private boolean teamCanServePlant(Team team, String plantCode) {
        if (team == null) return false;
        return !notBlank(team.plantCode) || normalizePlant(team.plantCode).equals(normalizePlant(plantCode));
    }

    private List<String> splitMembers(String text) {
        if (!notBlank(text)) return List.of();
        return java.util.Arrays.stream(text.split("\\s*,\\s*|\\s*\\n\\s*"))
                .map(String::trim)
                .filter(AssetFlowService::notBlank)
                .distinct()
                .toList();
    }

    private User findEnabledUser(String username) {
        if (!notBlank(username)) return null;
        User user = userRepository.findByUsernameIgnoreCase(clean(username)).orElse(null);
        return user != null && user.isEnabled() ? user : null;
    }

    private void validateHeadTechnician(
            String username,
            String plantCode,
            ServiceDomain domain) {
        User user = findEnabledUser(username);
        require(user != null, "Department head user not found or disabled: " + username);
        ServiceDomain target = domain == null ? ServiceDomain.MACHINE : domain;
        boolean validHead = currentUserService.isAdmin(user)
                || (target == ServiceDomain.MACHINE && currentUserService.hasAnyRole(
                        user,
                        "ASSETFLOW_MACHINE_HEAD",
                        "ASSETFLOW_HEAD_TECHNICIAN",
                        "ASSETFLOW_MANAGER",
                        "ASSETFLOW_PLANNER"))
                || (target == ServiceDomain.IT && currentUserService.hasRole(user, "ASSETFLOW_IT_HEAD"));
        require(validHead, "Selected team lead is not a " + humanDomain(target) + " head/coordinator");
        if (notBlank(plantCode) && !currentUserService.isAdmin(user)) {
            require(safePlants(user).contains(normalizePlant(plantCode)),
                    "Department head does not have access to plant " + normalizePlant(plantCode));
        }
    }

    private void validateAssignableUser(
            String username,
            String plantCode,
            ServiceDomain domain,
            boolean headPreferred) {
        User user = findEnabledUser(username);
        require(user != null, "Technician user not found or disabled: " + username);
        ServiceDomain target = domain == null ? ServiceDomain.MACHINE : domain;
        boolean valid = currentUserService.isAdmin(user)
                || (target == ServiceDomain.MACHINE && currentUserService.hasAnyRole(
                        user,
                        "ASSETFLOW_MACHINE_HEAD",
                        "ASSETFLOW_MACHINE_TECHNICIAN",
                        "ASSETFLOW_HEAD_TECHNICIAN",
                        "ASSETFLOW_TECHNICIAN",
                        "ASSETFLOW_MANAGER",
                        "ASSETFLOW_PLANNER"))
                || (target == ServiceDomain.IT && currentUserService.hasAnyRole(
                        user,
                        "ASSETFLOW_IT_HEAD",
                        "ASSETFLOW_IT_TECHNICIAN"));
        require(valid, "Selected user is not a " + humanDomain(target) + " technician");

        if (headPreferred && !currentUserService.isAdmin(user)) {
            require(canCoordinate(user, target),
                    "Auto-routing lead must be a " + humanDomain(target) + " head/coordinator");
        }
        if (notBlank(plantCode) && !currentUserService.isAdmin(user)) {
            require(safePlants(user).contains(normalizePlant(plantCode)),
                    "Selected technician does not have access to plant " + normalizePlant(plantCode));
        }
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
        w.equipmentCode = e.assetCode;
        w.serviceDomain = domainOf(e);
        w.plantCode = e.plantCode;
        w.location = e.location;
        w.workCenter = e.workCenter;
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

    private void completePreventiveCycleIfNeeded(WorkOrder w) {
        if (w.preventivePlanId == null || w.workType != WorkType.PREVENTIVE) return;
        PreventivePlan p = em.find(PreventivePlan.class, w.preventivePlanId, LockModeType.PESSIMISTIC_WRITE);
        if (p == null || !p.active) return;
        // The scheduler advances nextDueDate at generation time. This method intentionally
        // only refreshes equipment next-maintenance information after completion.
        updateEquipmentNextMaintenance(w.equipmentId);
    }

    private void syncEquipmentState(UUID equipmentId) {
        if (equipmentId == null) return;
        Equipment e = em.find(Equipment.class, equipmentId, LockModeType.PESSIMISTIC_WRITE);
        if (e == null || e.status == EquipmentStatus.RETIRED) return;

        List<WorkOrder> active = em.createQuery(
                        "select w from AssetFlowWorkOrder w where w.equipmentId=:id and w.status not in :terminal order by w.createdAt desc",
                        WorkOrder.class
                )
                .setParameter("id", equipmentId)
                .setParameter("terminal", TERMINAL)
                .getResultList();

        boolean stopped = active.stream().anyMatch(w -> w.productionStopped && (
                w.status == WorkStatus.NEW ||
                w.status == WorkStatus.PLANNED ||
                w.status == WorkStatus.ASSIGNED ||
                w.status == WorkStatus.ACCEPTED ||
                w.status == WorkStatus.IN_PROGRESS ||
                w.status == WorkStatus.WAITING_PARTS));
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
                        "select p.nextDueDate from AssetFlowPreventivePlan p where p.equipmentId=:id and p.active=true order by p.nextDueDate",
                        LocalDate.class
                )
                .setParameter("id", equipmentId)
                .setMaxResults(1)
                .getResultList();
        e.nextMaintenanceAt = dates.isEmpty() ? null : dates.get(0).atTime(9, 0);
    }

    private Map<String, Object> equipmentHealth(Equipment e) {
        List<WorkOrder> recent = em.createQuery(
                        "select w from AssetFlowWorkOrder w where w.equipmentId=:id and w.createdAt>=:from order by w.createdAt desc",
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
                        "select a from AssetFlowAuditEvent a where a.entityType=:type and a.entityId=:id order by a.createdAt desc",
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
                "equipmentCode", w.equipmentCode,
                "plantCode", w.plantCode,
                "location", w.location,
                "workCenter", w.workCenter,
                "serviceDomain", domainOf(w).name(),
                "requestCategory", w.requestCategory,
                "requestedBy", w.requestedBy,
                "reporterId", w.reporterId,
                "reporterCode", w.reporterCode,
                "reporterDepartment", w.reporterDepartment,
                "reporterContact", w.reporterContact,
                "operatorName", w.operatorName,
                "operatorContact", w.operatorContact,
                "teamName", w.teamName,
                "responsible", w.responsible,
                "assignedBy", w.assignedBy,
                "assignedAt", w.assignedAt,
                "acceptedBy", w.acceptedBy,
                "acceptedAt", w.acceptedAt,
                "complaintSource", w.complaintSource == null ? ComplaintSource.WEB.name() : w.complaintSource.name(),
                "workType", w.workType.name(),
                "status", w.status.name(),
                "priority", w.priority.name(),
                "requestedAt", w.requestedAt,
                "requestedForAt", w.requestedForAt,
                "scheduledAt", w.scheduledAt,
                "startedAt", w.startedAt,
                "repairedAt", w.repairedAt,
                "closedAt", w.closedAt,
                "estimatedMinutes", w.estimatedMinutes,
                "actualMinutes", resolvedActualMinutes(w),
                "responseMinutes", responseMinutes(w),
                "attendanceMinutes", attendanceMinutes(w),
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
                "serviceDomain", domainOf(e).name(),
                "assetKind", assetKindOf(e).name(),
                "plantCode", e.plantCode,
                "location", e.location,
                "workCenter", e.workCenter,
                "manufacturer", e.manufacturer,
                "model", e.model,
                "serialNumber", e.serialNumber,
                "criticality", e.criticality.name(),
                "status", e.status.name(),
                "maintenanceTeam", e.maintenanceTeam,
                "primaryTechnician", e.primaryTechnician,
                "assignedToCode", domainOf(e) == ServiceDomain.IT ? e.assignedToCode : null,
                "assignedToName", domainOf(e) == ServiceDomain.IT ? e.assignedToName : null,
                "assignedDepartment", domainOf(e) == ServiceDomain.IT ? e.assignedDepartment : null,
                "hostname", domainOf(e) == ServiceDomain.IT ? e.hostname : null,
                "ipAddress", domainOf(e) == ServiceDomain.IT ? e.ipAddress : null,
                "macAddress", domainOf(e) == ServiceDomain.IT ? e.macAddress : null,
                "operatingSystem", domainOf(e) == ServiceDomain.IT ? e.operatingSystem : null,
                "qrToken", e.qrToken,
                "qrEnabled", e.qrEnabled,
                "qrPath", qrPath(e.qrToken),
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
                "serviceDomain", domainOf(t).name(),
                "lead", t.lead,
                "membersText", t.membersText,
                "members", members,
                "defaultForPlant", t.defaultForPlant,
                "requestToken", t.requestToken,
                "publicReportingEnabled", t.publicReportingEnabled,
                "defaultCategories", t.defaultCategories,
                "categories", splitCategories(t.defaultCategories),
                "requestPath", serviceDeskPath(t.requestToken),
                "active", t.active,
                "version", t.version
        );
    }

    private Map<String, Object> planView(PreventivePlan p) {
        return map(
                "id", p.id,
                "equipmentId", p.equipmentId,
                "equipmentName", p.equipmentName,
                "serviceDomain", planDomain(p).name(),
                "title", p.title,
                "intervalDays", p.intervalDays,
                "leadDays", p.leadDays,
                "nextDueDate", p.nextDueDate,
                "scheduledTime", p.scheduledTime,
                "estimatedMinutes", p.estimatedMinutes,
                "defaultPriority", p.defaultPriority.name(),
                "teamName", p.teamName,
                "responsible", p.responsible,
                "requiresShutdown", p.requiresShutdown,
                "instructions", p.instructions,
                "checklistText", p.checklistText,
                "active", p.active,
                "lastGeneratedFor", p.lastGeneratedFor,
                "version", p.version
        );
    }


    /* =============================== REQUEST / REPORTER HELPERS =============================== */

    private Equipment resolveRequestEquipment(UUID equipmentId, UUID equipmentToken) {
        Equipment equipment = null;
        if (equipmentToken != null) {
            equipment = requireEquipmentByQr(equipmentToken);
            require(equipment.qrEnabled, "Asset QR reporting is disabled");
        } else if (equipmentId != null) {
            equipment = requireEquipment(equipmentId, false);
        }
        if (equipment != null) require(equipment.status != EquipmentStatus.RETIRED, "Cannot request maintenance for a retired asset");
        return equipment;
    }

    private Team resolveServiceDeskToken(UUID token, boolean requirePublic) {
        if (token == null) return null;
        List<Team> rows = em.createQuery(
                        "select t from AssetFlowTeam t where t.requestToken=:token",
                        Team.class)
                .setParameter("token", token)
                .setMaxResults(1)
                .getResultList();
        if (rows.isEmpty()) throw notFound("Service-desk QR/link is invalid or has been replaced");
        Team team = rows.get(0);
        if (requirePublic) require(team.publicReportingEnabled, "Public reporting is disabled for this service desk");
        return team;
    }

    private void validateRequestRoute(Team team, String plant, ServiceDomain domain) {
        if (team == null) return;
        require(team.active, "Selected service desk is inactive");
        require(teamCanServePlant(team, plant), "Selected service desk cannot serve this plant");
        require(domainOf(team) == domain, "Selected service desk belongs to " + humanDomain(domainOf(team)));
    }

    private void requireValidRequestPlantForAuthenticatedUser(User user, String plantCode) {
        String plant = normalizePlant(plantCode);
        require(notBlank(plant), "Plant is required");
        require(plantLocationService.isValidPlant(plant), "Invalid plant: " + plant);

        Set<String> explicit = safePlants(user);
        if (!explicit.isEmpty()) {
            require(explicit.contains(plant), "You cannot raise a request for plant " + plant);
        }
        // FlowSuite users without plant-scoped operational roles remain known/authenticated
        // employees and may raise their own service request for a valid company plant.
    }

    private Priority normalizeRequestPriority(Priority requested, Boolean productionStopped, Boolean safetyRisk, boolean coordinator) {
        if (Boolean.TRUE.equals(safetyRisk)) return Priority.CRITICAL;
        if (Boolean.TRUE.equals(productionStopped)) return Priority.HIGH;
        if (coordinator) return requested == null ? Priority.NORMAL : requested;
        if (requested == Priority.CRITICAL) return Priority.HIGH;
        return requested == null ? Priority.NORMAL : requested;
    }

    private Reporter authenticateReporter(String reporterCode, String pin) {
        require(notBlank(reporterCode), "Reporter Code / Employee Code is required");
        require(notBlank(pin), "Reporter PIN is required");
        List<Reporter> rows = em.createQuery(
                        "select r from AssetFlowReporter r where lower(r.reporterCode)=:code",
                        Reporter.class)
                .setParameter("code", clean(reporterCode).toLowerCase(Locale.ROOT))
                .setMaxResults(1)
                .getResultList();
        if (rows.isEmpty()) throw forbidden("Invalid Reporter Code or PIN");

        Reporter r = rows.get(0);
        LocalDateTime now = LocalDateTime.now();
        require(r.active, "This Reporter Pass is disabled");
        require(r.validUntil == null || !r.validUntil.isBefore(LocalDate.now()), "This Reporter Pass has expired");
        if (r.lockedUntil != null && r.lockedUntil.isAfter(now)) {
            throw forbidden("Reporter Pass is temporarily locked. Contact Maintenance/Admin or try later.");
        }

        boolean matches = r.pinHash != null && passwordEncoder.matches(pin.trim(), r.pinHash);
        if (!matches) {
            // Record the failure in an independent transaction before returning 403.
            // Otherwise the enclosing request transaction would roll this state back.
            reporterAuthStateService.recordFailure(r.id, now);
            throw forbidden("Invalid Reporter Code or PIN");
        }
        if (r.failedAttempts != 0 || r.lockedUntil != null) {
            reporterAuthStateService.clearFailureState(r.id, now);
        }
        return r;
    }

    private void validateReporterPin(String pin) {
        String clean = pin == null ? "" : pin.trim();
        require(clean.matches("\\d{4,8}"), "Reporter PIN must contain 4 to 8 digits");
    }

    private Set<ServiceDomain> reporterDomains(Reporter reporter) {
        if (reporter == null || !notBlank(reporter.allowedDomains)) {
            return Set.of(ServiceDomain.MACHINE);
        }
        LinkedHashSet<ServiceDomain> out = new LinkedHashSet<>();
        for (String token : reporter.allowedDomains.split("\\s*,\\s*")) {
            try {
                ServiceDomain domain = ServiceDomain.valueOf(token.trim().toUpperCase(Locale.ROOT));
                out.add(domain);
            } catch (Exception ignored) {
                // Ignore legacy values (ELECTRICAL/FACILITY/etc.) after upgrade.
            }
        }
        return out.isEmpty() ? Set.of(ServiceDomain.MACHINE) : Set.copyOf(out);
    }

    private Set<String> reporterPlants(Reporter reporter) {
        if (reporter == null) return Set.of();
        LinkedHashSet<String> plants = new LinkedHashSet<>();
        if (notBlank(reporter.plantCodes)) {
            for (String value : reporter.plantCodes.split("\\s*,\\s*")) {
                String plant = normalizePlant(value);
                if (notBlank(plant)) plants.add(plant);
            }
        }
        if (notBlank(reporter.plantCode)) plants.add(normalizePlant(reporter.plantCode));
        return Set.copyOf(plants);
    }

    private Reporter findLinkedReporter(String username) {
        if (!notBlank(username)) return null;
        List<Reporter> rows = em.createQuery(
                        "select r from AssetFlowReporter r where lower(r.linkedUsername)=:username",
                        Reporter.class)
                .setParameter("username", clean(username).toLowerCase(Locale.ROOT))
                .setMaxResults(1)
                .getResultList();
        if (rows.isEmpty()) return null;
        Reporter reporter = rows.get(0);
        if (!reporter.active) return null;
        if (reporter.validUntil != null && reporter.validUntil.isBefore(LocalDate.now())) return null;
        return reporter;
    }

    private void validateReporterCanUseAsset(Reporter reporter, Equipment equipment, Set<ServiceDomain> allowed) {
        require(equipment != null && equipment.qrEnabled, "Asset QR is not available");
        require(reporterPlants(reporter).contains(normalizePlant(equipment.plantCode)),
                "Your Reporter Pass is not permitted for this plant");
        require(allowed.contains(domainOf(equipment)),
                "Your Reporter Pass is not permitted for " + humanDomain(domainOf(equipment)) + " requests");
    }

    private void validateReporterCanUseDesk(Reporter reporter, Team desk, Set<ServiceDomain> allowed) {
        require(desk != null && desk.active && desk.publicReportingEnabled, "Service desk is unavailable");
        require(!notBlank(desk.plantCode) || reporterPlants(reporter).contains(normalizePlant(desk.plantCode)),
                "This service desk does not serve one of your authorised plants");
        require(allowed.contains(domainOf(desk)),
                "Your Reporter Pass is not permitted for " + humanDomain(domainOf(desk)) + " requests");
    }

    private List<Map<String, Object>> listPublicServiceDesks(Set<String> plants, Set<ServiceDomain> allowedDomains) {
        if (plants == null || plants.isEmpty()) return List.of();
        List<Team> teams = em.createQuery(
                        "select t from AssetFlowTeam t where t.active=true and t.publicReportingEnabled=true "
                                + "and (t.plantCode is null or t.plantCode in :plants) order by t.plantCode, t.name",
                        Team.class)
                .setParameter("plants", plants)
                .getResultList();
        return teams.stream()
                .filter(t -> allowedDomains == null || allowedDomains.contains(domainOf(t)))
                .map(this::publicDeskView)
                .toList();
    }

    private Map<String, Object> publicDeskView(Team t) {
        return map(
                "token", t.requestToken,
                "name", t.name,
                "plantCode", t.plantCode,
                "serviceDomain", domainOf(t).name(),
                "categories", splitCategories(t.defaultCategories),
                "requestPath", serviceDeskPath(t.requestToken)
        );
    }

    private Map<String, Object> reporterPublicView(Reporter r) {
        return map(
                "id", r.id,
                "reporterCode", r.reporterCode,
                "displayName", r.displayName,
                "reporterType", r.reporterType == null ? ReporterType.EMPLOYEE.name() : r.reporterType.name(),
                "plantCode", r.plantCode,
                "plantCodes", reporterPlants(r).stream().sorted().toList(),
                "department", r.department,
                "designation", r.designation,
                "phone", r.phone,
                "email", r.email,
                "validUntil", r.validUntil
        );
    }

    private Map<String, Object> reporterAdminView(Reporter r) {
        Map<String, Object> out = reporterPublicView(r);
        out.put("linkedUsername", r.linkedUsername);
        out.put("allowedDomains", reporterDomains(r).stream().map(Enum::name).sorted().toList());
        out.put("active", r.active);
        out.put("lockedUntil", r.lockedUntil);
        out.put("lastRequestAt", r.lastRequestAt);
        out.put("createdBy", r.createdBy);
        out.put("createdAt", r.createdAt);
        out.put("updatedBy", r.updatedBy);
        out.put("updatedAt", r.updatedAt);
        out.put("version", r.version);
        return out;
    }

    private List<String> splitCategories(String text) {
        if (!notBlank(text)) return List.of();
        return java.util.Arrays.stream(text.split("\\s*,\\s*|\\s*\\n\\s*"))
                .map(String::trim)
                .filter(AssetFlowService::notBlank)
                .distinct()
                .toList();
    }

    private ServiceDomain domainOf(WorkOrder w) {
        return w == null || w.serviceDomain == null ? ServiceDomain.MACHINE : w.serviceDomain;
    }

    private ServiceDomain domainOf(Equipment e) {
        return e == null || e.serviceDomain == null ? ServiceDomain.MACHINE : e.serviceDomain;
    }

    private ServiceDomain domainOf(Team t) {
        return t == null || t.serviceDomain == null ? ServiceDomain.MACHINE : t.serviceDomain;
    }

    private AssetKind assetKindOf(Equipment e) {
        return e == null || e.assetKind == null ? defaultAssetKind(domainOf(e)) : e.assetKind;
    }

    private AssetKind defaultAssetKind(ServiceDomain domain) {
        if (domain == null) return AssetKind.OTHER;
        return domain == ServiceDomain.IT ? AssetKind.IT_ASSET : AssetKind.PRODUCTION_MACHINE;
    }

    private String humanDomain(ServiceDomain domain) {
        return domain == ServiceDomain.IT ? "IT Support" : "Machine Maintenance";
    }

    /* =============================== ACCESS / USER HELPERS =============================== */

    private Set<String> readPlantScope(String requestedPlantCode) {
        User user = currentUserService.requireCurrentUser();
        Set<String> allowed = currentUserService.allowedPlants(user)
                .stream()
                .filter(Objects::nonNull)
                .map(AssetFlowService::normalizePlant)
                .filter(AssetFlowService::notBlank)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        if (allowed.isEmpty()) throw forbidden("No plant access assigned for AssetFlow");
        if (notBlank(requestedPlantCode)) {
            String requested = normalizePlant(requestedPlantCode);
            if (!allowed.contains(requested)) {
                throw forbidden("You do not have AssetFlow access to plant " + requested);
            }
            return Set.of(requested);
        }
        return Set.copyOf(allowed);
    }

    private Set<ServiceDomain> readDomainScope(User user, ServiceDomain requestedDomain) {
        if (user == null) throw forbidden("Authentication required");
        LinkedHashSet<ServiceDomain> allowed = new LinkedHashSet<>();
        for (ServiceDomain domain : ServiceDomain.values()) {
            if (hasDomainReadAccess(user, domain)) allowed.add(domain);
        }
        if (allowed.isEmpty()) throw forbidden("No AssetFlow department access assigned");
        if (requestedDomain != null) {
            if (!allowed.contains(requestedDomain)) {
                throw forbidden("You do not have access to " + humanDomain(requestedDomain));
            }
            return Set.of(requestedDomain);
        }
        return Set.copyOf(allowed);
    }

    private boolean hasDomainReadAccess(User user, ServiceDomain domain) {
        if (user == null || domain == null) return false;
        if (currentUserService.isAdmin(user)
                || currentUserService.hasRole(user, "ASSETFLOW_DIRECTOR")) return true;
        if (domain == ServiceDomain.MACHINE) {
            return currentUserService.hasAnyRole(
                    user,
                    "ASSETFLOW_MACHINE_HEAD",
                    "ASSETFLOW_MACHINE_TECHNICIAN",
                    "ASSETFLOW_HEAD_TECHNICIAN",
                    "ASSETFLOW_TECHNICIAN",
                    "ASSETFLOW_MANAGER",
                    "ASSETFLOW_PLANNER");
        }
        return currentUserService.hasAnyRole(
                user,
                "ASSETFLOW_IT_HEAD",
                "ASSETFLOW_IT_TECHNICIAN");
    }

    private void requireDomainReadAccess(User user, ServiceDomain domain) {
        if (!hasDomainReadAccess(user, domain)) {
            throw forbidden("You do not have access to " + humanDomain(domain));
        }
    }

    private boolean canCoordinate(User user, ServiceDomain domain) {
        if (user == null || domain == null) return false;
        if (currentUserService.isAdmin(user)) return true;
        if (domain == ServiceDomain.MACHINE) {
            return currentUserService.hasAnyRole(
                    user,
                    "ASSETFLOW_MACHINE_HEAD",
                    "ASSETFLOW_HEAD_TECHNICIAN",
                    "ASSETFLOW_MANAGER",
                    "ASSETFLOW_PLANNER");
        }
        return currentUserService.hasRole(user, "ASSETFLOW_IT_HEAD");
    }

    private boolean canManageAsset(User user, ServiceDomain domain) {
        return canCoordinate(user, domain);
    }

    private boolean canManageAnyRequestedDomain(User user, Set<ServiceDomain> domains) {
        return domains != null && !domains.isEmpty() && domains.stream().allMatch(d -> canCoordinate(user, d));
    }

    private boolean canViewReports(User user) {
        return user != null && (currentUserService.isAdmin(user)
                || currentUserService.hasAnyRole(
                        user,
                        "ASSETFLOW_DIRECTOR",
                        "ASSETFLOW_MANAGER",
                        "ASSETFLOW_PLANNER",
                        "ASSETFLOW_MACHINE_HEAD",
                        "ASSETFLOW_HEAD_TECHNICIAN",
                        "ASSETFLOW_IT_HEAD"));
    }

    private boolean isDirector(User user) {
        return user != null && currentUserService.hasRole(user, "ASSETFLOW_DIRECTOR");
    }

    private boolean isAssetFlowOperationalUser(User user) {
        return user != null && (currentUserService.isAdmin(user)
                || currentUserService.hasAnyRole(
                        user,
                        "ASSETFLOW_DIRECTOR",
                        "ASSETFLOW_MANAGER",
                        "ASSETFLOW_PLANNER",
                        "ASSETFLOW_MACHINE_HEAD",
                        "ASSETFLOW_MACHINE_TECHNICIAN",
                        "ASSETFLOW_IT_HEAD",
                        "ASSETFLOW_IT_TECHNICIAN",
                        "ASSETFLOW_HEAD_TECHNICIAN",
                        "ASSETFLOW_TECHNICIAN"));
    }

    private boolean canCreateOperationalOrder(User user, ServiceDomain domain) {
        return user != null && !isDirector(user) && hasDomainReadAccess(user, domain);
    }

    private boolean isTechnicianForDomain(User user, ServiceDomain domain) {
        if (user == null || domain == null) return false;
        if (domain == ServiceDomain.MACHINE) {
            return currentUserService.hasAnyRole(
                    user,
                    "ASSETFLOW_MACHINE_TECHNICIAN",
                    "ASSETFLOW_TECHNICIAN")
                    && !canCoordinate(user, domain);
        }
        return currentUserService.hasRole(user, "ASSETFLOW_IT_TECHNICIAN")
                && !canCoordinate(user, domain);
    }

    private boolean isRequesterOnly(User user) {
        return user != null
                && currentUserService.hasRole(user, "ASSETFLOW_REQUESTER")
                && !isAssetFlowOperationalUser(user)
                && !currentUserService.isAdmin(user);
    }

    private RequestPermission authenticatedRequestPermission(User user) {
        require(user != null && user.isEnabled(), "Authenticated FlowSuite user is required");

        if (isAssetFlowOperationalUser(user) || currentUserService.isAdmin(user)) {
            LinkedHashSet<String> plants = new LinkedHashSet<>(safePlants(user));
            if (plants.isEmpty()) plants.addAll(plantLocationService.getAllPlantCodes());
            LinkedHashSet<ServiceDomain> domains = new LinkedHashSet<>();
            for (ServiceDomain domain : ServiceDomain.values()) {
                if (hasDomainReadAccess(user, domain)) domains.add(domain);
            }
            if (domains.isEmpty()) domains.addAll(Set.of(ServiceDomain.MACHINE, ServiceDomain.IT));
            return new RequestPermission(null, Set.copyOf(plants), Set.copyOf(domains));
        }

        Reporter reporter = findLinkedReporter(user.getUsername());
        if (reporter == null) {
            throw forbidden("Maintenance request access is not assigned. Ask Admin to link your FlowSuite username to a AssetFlow Reporter profile.");
        }
        return new RequestPermission(reporter, reporterPlants(reporter), reporterDomains(reporter));
    }

    private void requirePlantReadAccess(String plantCode) {
        requirePlantAccess(plantCode);
    }

    private void requirePlantWriteAccess(String plantCode) {
        requirePlantAccess(plantCode);
    }

    private void requirePlantAccess(String plantCode) {
        String normalized = normalizePlant(plantCode);
        if (!notBlank(normalized)) throw forbidden("Plant access is required");
        User user = currentUserService.requireCurrentUser();
        if (!currentUserService.canAccessPlant(user, normalized)) {
            throw forbidden("You do not have AssetFlow access to plant " + normalized);
        }
    }

    private boolean canReadOrder(User user, WorkOrder w) {
        if (user == null || w == null) return false;
        ServiceDomain domain = domainOf(w);
        if (!hasDomainReadAccess(user, domain)) return false;
        if (currentUserService.isAdmin(user) || isDirector(user) || canCoordinate(user, domain)) return true;
        if (isTechnicianForDomain(user, domain)) {
            return notBlank(w.responsible) && w.responsible.equalsIgnoreCase(user.getUsername());
        }
        return false;
    }

    private boolean canExecuteOrder(User user, WorkOrder w) {
        if (user == null || w == null || isDirector(user)) return false;
        ServiceDomain domain = domainOf(w);
        if (canCoordinate(user, domain) || currentUserService.isAdmin(user)) return true;
        return isTechnicianForDomain(user, domain)
                && notBlank(w.responsible)
                && w.responsible.equalsIgnoreCase(user.getUsername());
    }

    private Set<WorkStatus> allowedTransitionsFor(User user, WorkOrder w) {
        Set<WorkStatus> base = TRANSITIONS.getOrDefault(w.status, Set.of());
        if (base.isEmpty() || user == null || w == null || isDirector(user)) return Set.of();

        ServiceDomain domain = domainOf(w);
        LinkedHashSet<WorkStatus> allowed = new LinkedHashSet<>();
        for (WorkStatus target : base) {
            if (target == WorkStatus.CLOSED) {
                if (canCoordinate(user, domain) || currentUserService.isAdmin(user)) allowed.add(target);
                continue;
            }
            if (w.status == WorkStatus.CLOSED && target == WorkStatus.IN_PROGRESS) {
                if (currentUserService.isAdmin(user) || canCoordinate(user, domain)) allowed.add(target);
                continue;
            }
            if (target == WorkStatus.PLANNED || target == WorkStatus.ASSIGNED || target == WorkStatus.SCRAPPED) {
                if (canCoordinate(user, domain) || currentUserService.isAdmin(user)) allowed.add(target);
                continue;
            }
            if (target == WorkStatus.CANCELLED) {
                if (canCoordinate(user, domain) || currentUserService.isAdmin(user)) allowed.add(target);
                continue;
            }
            if (target == WorkStatus.ACCEPTED || target == WorkStatus.IN_PROGRESS
                    || target == WorkStatus.WAITING_PARTS || target == WorkStatus.REPAIRED) {
                if (canExecuteOrder(user, w)) allowed.add(target);
                continue;
            }
            if (canCoordinate(user, domain) || currentUserService.isAdmin(user)) allowed.add(target);
        }
        return Set.copyOf(allowed);
    }

    private Set<String> safePlants(User user) {
        if (user == null || user.getEffectivePlantCodes() == null) return Set.of();
        return user.getEffectivePlantCodes()
                .stream()
                .filter(Objects::nonNull)
                .map(AssetFlowService::normalizePlant)
                .filter(AssetFlowService::notBlank)
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

    private Integer responseMinutes(WorkOrder w) {
        if (w == null || w.requestedAt == null || w.acceptedAt == null) return null;
        return Math.toIntExact(Math.max(0, Duration.between(w.requestedAt, w.acceptedAt).toMinutes()));
    }

    private Integer attendanceMinutes(WorkOrder w) {
        if (w == null || w.acceptedAt == null || w.startedAt == null) return null;
        return Math.toIntExact(Math.max(0, Duration.between(w.acceptedAt, w.startedAt).toMinutes()));
    }

    private String qrPath(UUID token) {
        return token == null ? null : "/assetflow/request?asset=" + token;
    }

    private String serviceDeskPath(UUID token) {
        return token == null ? null : "/assetflow/request?desk=" + token;
    }

    private static String humanStatus(WorkStatus status) {
        return status == null ? "status" : status.name().toLowerCase(Locale.ROOT).replace('_', ' ');
    }

    private static String joinText(String first, String second) {
        if (!notBlank(first)) return blankToNull(second);
        if (!notBlank(second)) return blankToNull(first);
        return clean(first) + "\n\n" + clean(second);
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

    private record RequestPermission(
            Reporter reporter,
            Set<String> plants,
            Set<ServiceDomain> domains
    ) {
    }

    private record QueryResult<T>(List<T> items, long total) {
    }
}
