package com.alsorg.packing.machflow;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.machflow.MachFlowData.AssignmentRequest;
import com.alsorg.packing.machflow.MachFlowData.AssetKind;
import com.alsorg.packing.machflow.MachFlowData.AuthenticatedRequestCreate;
import com.alsorg.packing.machflow.MachFlowData.AuditEvent;
import com.alsorg.packing.machflow.MachFlowData.ComplaintSource;
import com.alsorg.packing.machflow.MachFlowData.Criticality;
import com.alsorg.packing.machflow.MachFlowData.Equipment;
import com.alsorg.packing.machflow.MachFlowData.EquipmentStatus;
import com.alsorg.packing.machflow.MachFlowData.EquipmentUpsert;
import com.alsorg.packing.machflow.MachFlowData.PreventivePlan;
import com.alsorg.packing.machflow.MachFlowData.PreventivePlanUpsert;
import com.alsorg.packing.machflow.MachFlowData.Priority;
import com.alsorg.packing.machflow.MachFlowData.PublicRequestCreate;
import com.alsorg.packing.machflow.MachFlowData.Reporter;
import com.alsorg.packing.machflow.MachFlowData.ReporterLogin;
import com.alsorg.packing.machflow.MachFlowData.ReporterType;
import com.alsorg.packing.machflow.MachFlowData.ReporterUpsert;
import com.alsorg.packing.machflow.MachFlowData.ServiceDomain;
import com.alsorg.packing.machflow.MachFlowData.StatusChange;
import com.alsorg.packing.machflow.MachFlowData.Team;
import com.alsorg.packing.machflow.MachFlowData.TeamUpsert;
import com.alsorg.packing.machflow.MachFlowData.WorkOrder;
import com.alsorg.packing.machflow.MachFlowData.WorkOrderUpsert;
import com.alsorg.packing.machflow.MachFlowData.WorkStatus;
import com.alsorg.packing.machflow.MachFlowData.WorkType;
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
public class MachFlowService {

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
    private final MachFlowReporterAuthStateService reporterAuthStateService;

    public MachFlowService(
            CurrentUserService currentUserService,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            PlantLocationService plantLocationService,
            MachFlowReporterAuthStateService reporterAuthStateService) {
        this.currentUserService = currentUserService;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.plantLocationService = plantLocationService;
        this.reporterAuthStateService = reporterAuthStateService;
    }

    /* =============================== DASHBOARD =============================== */

    public Map<String, Object> dashboard(String plantCode) {
        User currentUser = currentUserService.requireCurrentUser();
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
                .getResultList()
                .stream()
                .filter(w -> canReadOrder(currentUser, w))
                .toList();

        long overdue = openOrders.stream()
                .filter(w -> w.scheduledAt != null && w.scheduledAt.isBefore(now))
                .count();
        long critical = openOrders.stream().filter(w -> w.priority == Priority.CRITICAL).count();
        long waitingParts = openOrders.stream().filter(w -> w.status == WorkStatus.WAITING_PARTS).count();

        List<WorkOrder> last90 = listOrdersByCreatedRange(scope, ninetyDaysAgo, now)
                .stream()
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
                "byServiceDomain", serviceCounts.entrySet().stream().collect(Collectors.toMap(e -> e.getKey().name(), Map.Entry::getValue, (a, b) -> a, LinkedHashMap::new)),
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
        User current = currentUserService.requireCurrentUser();
        Set<String> scope = readPlantScope(plantCode);
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(size, 1), 1000);

        String requestedByScope = isRequesterOnly(current) ? current.getUsername() : null;
        String responsibleScope = isTechnicianOnly(current) ? current.getUsername() : null;
        String effectiveResponsible = responsibleScope != null ? responsibleScope : responsible;

        QueryResult<WorkOrder> result = queryOrders(
                scope,
                status,
                type,
                priority,
                equipmentId,
                effectiveResponsible,
                requestedByScope,
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
        out.put("canAssign", canCoordinate(current));
        out.put("canClose", canCoordinate(current));
        out.put("canExecute", canExecuteOrder(current, w));
        return out;
    }

    public Map<String, Object> getEquipmentByQr(UUID qrToken) {
        User current = currentUserService.requireCurrentUser();
        Equipment e = requireEquipmentByQr(qrToken);
        require(e.qrEnabled, "QR reporting is disabled for this equipment");
        requirePlantReadAccess(e.plantCode);
        require(isMachFlowUser(current) || currentUserService.isAdmin(current), "MachFlow access is required");

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
        boolean coordinator = canCoordinate(currentUser);
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
                : (request.serviceDomain() == null ? ServiceDomain.GENERAL : request.serviceDomain());

        Team routedTeam = resolveRoutingTeam(
                targetPlant,
                domain,
                equipment != null ? equipment.maintenanceTeam : request.teamName());
        String autoHead = routedTeam != null
                ? blankToNull(routedTeam.lead)
                : equipment != null ? blankToNull(equipment.primaryTechnician) : null;
        if (autoHead != null) {
            validateAssignableUser(autoHead, targetPlant, false);
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
            validateAssignableUser(request.responsible(), targetPlant, false);
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
     * Minimal context for any authenticated FlowSuite employee. No MachFlow role is
     * required to raise a request. Existing plant access is honoured when present;
     * users without plant-scoped modules may still choose a valid company plant,
     * but can only read back their own requests.
     */
    public Map<String, Object> requesterContext() {
        User current = currentUserService.requireCurrentUser();
        Set<String> explicit = safePlants(current);
        Set<String> availablePlants = explicit.isEmpty()
                ? plantLocationService.getAllPlantCodes().stream()
                    .filter(Objects::nonNull)
                    .map(MachFlowService::normalizePlant)
                    .filter(MachFlowService::notBlank)
                    .collect(Collectors.toCollection(LinkedHashSet::new))
                : explicit;

        List<Map<String, Object>> desks = listPublicServiceDesks(availablePlants, null);
        return map(
                "username", current.getUsername(),
                "plants", availablePlants.stream().sorted().toList(),
                "serviceDomains", java.util.Arrays.stream(ServiceDomain.values()).map(Enum::name).toList(),
                "serviceDesks", desks
        );
    }

    public List<Map<String, Object>> myRequests() {
        User current = currentUserService.requireCurrentUser();
        return em.createQuery(
                        "select w from MachFlowWorkOrder w where lower(w.requestedBy)=:user and w.reporterId is null order by w.createdAt desc",
                        WorkOrder.class)
                .setParameter("user", current.getUsername().toLowerCase(Locale.ROOT))
                .setMaxResults(200)
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
        Equipment equipment = resolveRequestEquipment(request.equipmentId(), request.equipmentToken());
        Team tokenTeam = resolveServiceDeskToken(request.serviceDeskToken(), false);

        String plant = equipment != null
                ? normalizePlant(equipment.plantCode)
                : normalizePlant(request.plantCode());
        if (!notBlank(plant) && tokenTeam != null && notBlank(tokenTeam.plantCode)) {
            plant = normalizePlant(tokenTeam.plantCode);
        }
        require(notBlank(plant), "Select the plant/location for this request");
        requireValidRequestPlantForAuthenticatedUser(current, plant);

        ServiceDomain domain = equipment != null
                ? domainOf(equipment)
                : tokenTeam != null ? domainOf(tokenTeam)
                : request.serviceDomain() == null ? ServiceDomain.GENERAL : request.serviceDomain();

        Team route = tokenTeam != null
                ? tokenTeam
                : resolveRoutingTeam(plant, domain, equipment == null ? null : equipment.maintenanceTeam);
        validateRequestRoute(route, plant, domain);

        WorkOrder w = createGatewayOrder(
                current.getUsername(),
                null,
                null,
                null,
                null,
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
                ComplaintSource.FLOW_SUITE_REQUEST,
                actor(auth)
        );
        return workOrderDetail(w);
    }

    /** Public QR/desk context contains no user list and no internal history. */
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
                "token", equipment.qrToken,
                "assetCode", equipment.assetCode,
                "name", equipment.name,
                "category", equipment.category,
                "serviceDomain", domainOf(equipment).name(),
                "assetKind", assetKindOf(equipment).name(),
                "plantCode", equipment.plantCode,
                "location", equipment.location,
                "workCenter", equipment.workCenter,
                "criticality", equipment.criticality.name(),
                "safetyNotes", equipment.safetyNotes
        );

        Map<String, Object> desk = team == null ? null : publicDeskView(team);
        return map(
                "asset", asset,
                "serviceDesk", desk,
                "requiresReporterAuthentication", true,
                "message", "Use your MachFlow Reporter Code and PIN, or continue with an existing FlowSuite login."
        );
    }

    public Map<String, Object> authoriseReporter(ReporterLogin login) {
        require(login != null, "Reporter credentials are required");
        Reporter reporter = authenticateReporter(login.reporterCode(), login.accessPin());
        Equipment equipment = login.equipmentToken() == null ? null : requireEquipmentByQr(login.equipmentToken());
        Team desk = login.serviceDeskToken() == null ? null : resolveServiceDeskToken(login.serviceDeskToken(), true);

        Set<ServiceDomain> allowed = reporterDomains(reporter);
        if (equipment != null) {
            validateReporterCanUseAsset(reporter, equipment, allowed);
        }
        if (desk != null) {
            validateReporterCanUseDesk(reporter, desk, allowed);
        }

        Set<String> plantScope = Set.of(normalizePlant(reporter.plantCode));
        return map(
                "reporter", reporterPublicView(reporter),
                "allowedDomains", allowed.stream().map(Enum::name).sorted().toList(),
                "serviceDesks", listPublicServiceDesks(plantScope, allowed),
                "asset", equipment == null ? null : map(
                        "token", equipment.qrToken,
                        "assetCode", equipment.assetCode,
                        "name", equipment.name,
                        "serviceDomain", domainOf(equipment).name(),
                        "plantCode", equipment.plantCode,
                        "location", equipment.location,
                        "workCenter", equipment.workCenter,
                        "safetyNotes", equipment.safetyNotes
                ),
                "serviceDesk", desk == null ? null : publicDeskView(desk)
        );
    }

    public List<Map<String, Object>> reporterRequests(ReporterLogin login) {
        require(login != null, "Reporter credentials are required");
        Reporter reporter = authenticateReporter(login.reporterCode(), login.accessPin());
        return em.createQuery(
                        "select w from MachFlowWorkOrder w where w.reporterId=:reporter order by w.createdAt desc",
                        WorkOrder.class)
                .setParameter("reporter", reporter.id)
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
        Equipment equipment = request.equipmentToken() == null ? null : requireEquipmentByQr(request.equipmentToken());
        Team tokenTeam = request.serviceDeskToken() == null ? null : resolveServiceDeskToken(request.serviceDeskToken(), true);

        if (equipment != null) validateReporterCanUseAsset(reporter, equipment, allowed);
        if (tokenTeam != null) validateReporterCanUseDesk(reporter, tokenTeam, allowed);

        String plant = normalizePlant(reporter.plantCode);
        ServiceDomain domain = equipment != null
                ? domainOf(equipment)
                : tokenTeam != null ? domainOf(tokenTeam)
                : request.serviceDomain() == null ? ServiceDomain.GENERAL : request.serviceDomain();
        require(allowed.contains(domain), "Your Reporter Pass is not permitted for " + humanDomain(domain) + " requests");

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
                        : "Request submitted to the " + humanDomain(domain) + " maintenance queue"
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
        w.serviceDomain = domain == null ? ServiceDomain.GENERAL : domain;
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
        w.breakdown = w.serviceDomain == ServiceDomain.MACHINE || equipment != null;
        w.priority = normalizeRequestPriority(requestedPriority, productionStopped, safetyRisk, false);
        w.complaintSource = source == null ? ComplaintSource.REPORTER_PORTAL : source;
        w.partsCost = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        w.laborCost = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        w.externalCost = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        w.downtimeMinutes = 0;

        if (equipment != null) {
            w.equipmentId = equipment.id;
            w.equipmentName = equipment.name;
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
            w.assignedBy = "AUTO_ROUTE";
            w.assignedAt = LocalDateTime.now();
        } else {
            w.status = WorkStatus.NEW;
        }
        w.createdBy = actor;
        w.updatedBy = actor;
        w.createdAt = LocalDateTime.now();
        w.updatedAt = w.createdAt;
        em.persist(w);

        audit("WORK_ORDER", w.id, "REQUEST_SUBMITTED", null, w.status.name(), actor,
                humanDomain(w.serviceDomain) + " · " + w.title);
        if (notBlank(w.responsible)) {
            audit("WORK_ORDER", w.id, "AUTO_ASSIGNED", WorkStatus.NEW.name(), WorkStatus.ASSIGNED.name(),
                    "AUTO_ROUTE", "Assigned to " + w.responsible + " via " + firstNonBlank(w.teamName, "service route"));
        }
        syncEquipmentState(w.equipmentId);
        return w;
    }

    /* =============================== REPORTER DIRECTORY =============================== */

    public List<Map<String, Object>> listReporters(String plantCode, Boolean activeOnly, String search) {
        User current = currentUserService.requireCurrentUser();
        require(canManage(current) || currentUserService.hasRole(current, "MACHFLOW_PLANNER"),
                "Maintenance management permission is required");
        Set<String> scope = readPlantScope(plantCode);

        StringBuilder jpql = new StringBuilder("select r from MachFlowReporter r where r.plantCode in :plants");
        if (Boolean.TRUE.equals(activeOnly)) jpql.append(" and r.active=true");
        if (notBlank(search)) {
            jpql.append(" and (lower(r.reporterCode) like :search or lower(r.displayName) like :search or lower(coalesce(r.department,'')) like :search)");
        }
        jpql.append(" order by r.active desc, r.displayName");
        TypedQuery<Reporter> query = em.createQuery(jpql.toString(), Reporter.class).setParameter("plants", scope);
        if (notBlank(search)) query.setParameter("search", "%" + clean(search).toLowerCase(Locale.ROOT) + "%");
        return query.getResultList().stream().map(this::reporterAdminView).toList();
    }

    public Map<String, Object> saveReporter(UUID id, ReporterUpsert request, Authentication auth) {
        require(request != null, "Reporter request is required");
        User current = currentUserService.requireCurrentUser();
        require(canManage(current) || currentUserService.hasRole(current, "MACHFLOW_PLANNER"),
                "Maintenance management permission is required");
        require(notBlank(request.reporterCode()), "Reporter Code / Employee Code is required");
        require(notBlank(request.displayName()), "Reporter name is required");
        require(notBlank(request.plantCode()), "Reporter plant is required");
        requirePlantWriteAccess(request.plantCode());

        Reporter r = id == null ? new Reporter() : em.find(Reporter.class, id, LockModeType.PESSIMISTIC_WRITE);
        if (id != null && r == null) throw notFound("Reporter not found");
        if (id != null) {
            requirePlantWriteAccess(r.plantCode);
            checkVersion(r.version, request.version());
        }

        String code = clean(request.reporterCode()).toUpperCase(Locale.ROOT);
        String duplicateJpql = "select count(r) from MachFlowReporter r where lower(r.reporterCode)=:code"
                + (id == null ? "" : " and r.id<>:id");
        TypedQuery<Long> duplicateQuery = em.createQuery(duplicateJpql, Long.class)
                .setParameter("code", code.toLowerCase(Locale.ROOT));
        if (id != null) duplicateQuery.setParameter("id", id);
        Long duplicates = duplicateQuery.getSingleResult();
        require(duplicates == 0L, "Reporter Code already exists");

        Set<ServiceDomain> domains = request.allowedDomains() == null || request.allowedDomains().isEmpty()
                ? Set.of(ServiceDomain.MACHINE, ServiceDomain.IT, ServiceDomain.ELECTRICAL, ServiceDomain.FACILITY, ServiceDomain.UTILITY, ServiceDomain.GENERAL)
                : EnumSet.copyOf(request.allowedDomains());

        r.reporterCode = code;
        r.displayName = clean(request.displayName());
        r.reporterType = request.reporterType() == null ? ReporterType.EMPLOYEE : request.reporterType();
        r.plantCode = normalizePlant(request.plantCode());
        r.department = clean(request.department());
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
        require(canCoordinate(current), "Maintenance coordination permission is required");

        WorkOrder w = requireOrder(id, true);
        requirePlantWriteAccess(w.plantCode);
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
            if (notBlank(request.responsible())) validateAssignableUser(request.responsible(), w.plantCode, false);
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
        require(canCoordinate(current), "Only maintenance coordinators / head technicians can assign work");

        WorkOrder w = requireOrder(id, true);
        requirePlantWriteAccess(w.plantCode);
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
            validateAssignableUser(request.responsible(), w.plantCode, false);
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
            require(canCoordinate(current), "Planning permission is required");
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
            require(canCoordinate(current), "Head technician / maintenance management verification is required to close a job");
            String verification = firstNonBlank(request.verificationNote(), w.verificationNote);
            require(notBlank(verification), "Machine test / handover verification note is required before closing");
            w.verificationNote = verification;
            w.closedAt = now;
            registerFailureOnce(w);
            completePreventiveCycleIfNeeded(w);
        }

        if (to == WorkStatus.CANCELLED || to == WorkStatus.SCRAPPED) {
            require(notBlank(request.note()), "A reason is required for " + humanStatus(to));
        }

        if (from == WorkStatus.CLOSED && to == WorkStatus.IN_PROGRESS) {
            require(canManage(current), "Only maintenance management can reopen a closed job");
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
        checkVersion(e.version, request == null ? null : request.version());
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

        if (notBlank(request.maintenanceTeam())) {
            Team team = findTeamByName(request.maintenanceTeam());
            require(team != null && team.active, "Maintenance team not found or inactive");
            require(teamCanServePlant(team, request.plantCode()), "Maintenance team cannot serve plant " + normalizePlant(request.plantCode()));
            ServiceDomain requestedDomain = request.serviceDomain() == null ? ServiceDomain.MACHINE : request.serviceDomain();
            require(domainOf(team) == requestedDomain, "Maintenance team belongs to " + domainOf(team) + " service, not " + requestedDomain);
        }
        if (notBlank(request.primaryTechnician())) {
            validateAssignableUser(request.primaryTechnician(), request.plantCode(), false);
        }
    }

    private void applyEquipment(Equipment e, EquipmentUpsert r) {
        e.assetCode = clean(r.assetCode()).toUpperCase(Locale.ROOT);
        e.name = clean(r.name());
        e.category = clean(r.category());
        e.serviceDomain = r.serviceDomain() == null ? ServiceDomain.MACHINE : r.serviceDomain();
        e.assetKind = r.assetKind() == null ? defaultAssetKind(e.serviceDomain) : r.assetKind();
        e.plantCode = normalizePlant(r.plantCode());
        e.location = clean(r.location());
        e.workCenter = clean(r.workCenter());
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
        if (r.qrEnabled() != null) e.qrEnabled = r.qrEnabled();
        if (e.qrToken == null) e.qrToken = UUID.randomUUID();
        e.description = clean(r.description());
        e.safetyNotes = clean(r.safetyNotes());
    }

    public Map<String, Object> rotateEquipmentQr(UUID id, Authentication auth) {
        User current = currentUserService.requireCurrentUser();
        require(canManage(current) || currentUserService.hasRole(current, "MACHFLOW_PLANNER"),
                "Maintenance manager / planner permission is required to rotate QR codes");
        Equipment e = requireEquipment(id, true);
        requirePlantWriteAccess(e.plantCode);
        e.qrToken = UUID.randomUUID();
        e.qrEnabled = true;
        e.updatedBy = actor(auth);
        e.updatedAt = LocalDateTime.now();
        audit("EQUIPMENT", e.id, "QR_ROTATED", null, null, actor(auth), "Machine QR token rotated");
        return equipmentDetail(e);
    }

    /* =============================== TEAMS =============================== */

    public List<Map<String, Object>> listTeams(String plantCode) {
        Set<String> scope = readPlantScope(plantCode);
        return em.createQuery(
                        "select t from MachFlowTeam t where t.plantCode is null or t.plantCode in :plants "
                                + "order by t.defaultForPlant desc, t.active desc, t.name",
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
        require(canManage(current) || currentUserService.hasRole(current, "MACHFLOW_PLANNER"),
                "Maintenance manager / planner permission is required");

        Team t = id == null ? new Team() : em.find(Team.class, id, LockModeType.PESSIMISTIC_WRITE);
        if (id != null && t == null) throw notFound("Team not found");
        if (id != null) checkVersion(t.version, request.version());
        if (id != null && notBlank(t.plantCode)) requirePlantWriteAccess(t.plantCode);

        String targetPlant = blankToNull(request.plantCode());
        if (targetPlant == null) {
            require(currentUserService.isAdmin(current) || canManage(current),
                    "Only maintenance management can create a company-wide team");
        } else {
            targetPlant = normalizePlant(targetPlant);
            requirePlantWriteAccess(targetPlant);
        }

        String lead = blankToNull(request.lead());
        if (lead != null) {
            validateHeadTechnician(lead, targetPlant);
        }

        List<String> members = splitMembers(request.membersText());
        for (String member : members) {
            validateAssignableUser(member, targetPlant, false);
        }
        if (lead != null && !members.stream().anyMatch(m -> m.equalsIgnoreCase(lead))) {
            members = new ArrayList<>(members);
            members.add(0, lead);
        }

        ServiceDomain domain = request.serviceDomain() == null ? ServiceDomain.MACHINE : request.serviceDomain();
        boolean defaultForPlant = Boolean.TRUE.equals(request.defaultForPlant());
        if (defaultForPlant) {
            require(targetPlant != null, "Only plant-specific teams can be the default routing team");
            em.createQuery("update MachFlowTeam t set t.defaultForPlant=false where t.plantCode=:plant and (t.serviceDomain=:domain or (t.serviceDomain is null and :domain=:machineDomain)) and t.id<>:id")
                    .setParameter("plant", targetPlant)
                    .setParameter("domain", domain)
                    .setParameter("machineDomain", ServiceDomain.MACHINE)
                    .setParameter("id", t.id)
                    .executeUpdate();
        }

        t.name = clean(request.name());
        t.plantCode = targetPlant;
        t.serviceDomain = domain;
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
            checkVersion(p.version, request.version());
            Equipment previousEquipment = requireEquipment(p.equipmentId, false);
            requirePlantWriteAccess(previousEquipment.plantCode);
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
        if (notBlank(p.responsible)) validateAssignableUser(p.responsible, equipment.plantCode, false);
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
            w.workCenter = e.workCenter;
            w.requestedBy = "MachFlow PM Scheduler";
            w.teamName = firstNonBlank(p.teamName, e.maintenanceTeam);
            w.responsible = firstNonBlank(p.responsible, resolveHeadForEquipment(e));
            w.complaintSource = ComplaintSource.PREVENTIVE;
            w.workType = WorkType.PREVENTIVE;
            w.serviceDomain = domainOf(e);
            w.requestCategory = "PREVENTIVE_MAINTENANCE";
            w.status = notBlank(w.responsible) ? WorkStatus.ASSIGNED : WorkStatus.PLANNED;
            w.priority = p.defaultPriority;
            w.requestedAt = LocalDateTime.now();
            w.scheduledAt = p.nextDueDate.atTime(p.scheduledTime == null ? LocalTime.of(9, 0) : p.scheduledTime);
            w.requestedForAt = w.scheduledAt;
            w.estimatedMinutes = p.estimatedMinutes == null ? 60 : p.estimatedMinutes;
            w.downtimeMinutes = 0;
            w.breakdown = false;
            w.productionStopped = p.requiresShutdown;
            w.instructions = joinText(p.instructions, p.checklistText == null ? null : "Checklist:\n" + p.checklistText);
            if (notBlank(w.responsible)) {
                w.assignedBy = "PM_AUTO_ROUTE";
                w.assignedAt = LocalDateTime.now();
            }
            w.preventivePlanId = p.id;
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

    public List<Map<String, Object>> calendar(LocalDate from, LocalDate to, String plantCode) {
        User current = currentUserService.requireCurrentUser();
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

        Map<String, List<WorkOrder>> groupedDomains = orders.stream()
                .collect(Collectors.groupingBy(w -> domainOf(w).name()));
        List<Map<String, Object>> byServiceDomain = groupedDomains.entrySet().stream()
                .map(entry -> {
                    List<WorkOrder> list = entry.getValue();
                    long done = list.stream().filter(w -> w.status == WorkStatus.CLOSED || w.status == WorkStatus.REPAIRED).count();
                    long open = list.size() - done;
                    long downtime = list.stream().map(w -> w.downtimeMinutes).filter(Objects::nonNull).mapToLong(Integer::longValue).sum();
                    BigDecimal cost = list.stream().map(this::totalCost).reduce(BigDecimal.ZERO, BigDecimal::add);
                    return map(
                            "serviceDomain", entry.getKey(),
                            "orders", list.size(),
                            "completed", done,
                            "open", open,
                            "downtimeHours", round(downtime / 60.0, 1),
                            "cost", cost
                    );
                })
                .sorted(Comparator.comparing(o -> -((Number) o.get("orders")).intValue()))
                .toList();

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
                "byServiceDomain", byServiceDomain,
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
            String requestedBy,
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
        if (notBlank(requestedBy)) {
            where.append(" and lower(w.requestedBy)=:requestedBy ");
            params.put("requestedBy", clean(requestedBy).toLowerCase(Locale.ROOT));
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

    private Equipment requireEquipmentByQr(UUID qrToken) {
        require(qrToken != null, "Machine QR token is required");
        List<Equipment> rows = em.createQuery(
                        "select e from MachFlowEquipment e where e.qrToken=:token",
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
                        "select t from MachFlowTeam t where lower(t.name)=:name",
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
                        "select t from MachFlowTeam t where t.active=true and t.defaultForPlant=true "
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
                        "select t from MachFlowTeam t where t.active=true and (t.plantCode=:plant or t.plantCode is null) "
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
                .filter(MachFlowService::notBlank)
                .distinct()
                .toList();
    }

    private User findEnabledUser(String username) {
        if (!notBlank(username)) return null;
        User user = userRepository.findByUsernameIgnoreCase(clean(username)).orElse(null);
        return user != null && user.isEnabled() ? user : null;
    }

    private void validateHeadTechnician(String username, String plantCode) {
        User user = findEnabledUser(username);
        require(user != null, "Head technician user not found or disabled: " + username);
        require(currentUserService.isAdmin(user) || currentUserService.hasAnyRole(
                        user,
                        "MACHFLOW_MANAGER",
                        "MACHFLOW_HEAD_TECHNICIAN"),
                "Team head must have MACHFLOW_HEAD_TECHNICIAN or MACHFLOW_MANAGER role");
        if (notBlank(plantCode) && !currentUserService.isAdmin(user)) {
            require(safePlants(user).contains(normalizePlant(plantCode)),
                    "Head technician does not have access to plant " + normalizePlant(plantCode));
        }
    }

    private void validateAssignableUser(String username, String plantCode, boolean headPreferred) {
        User user = findEnabledUser(username);
        require(user != null, "Technician user not found or disabled: " + username);
        boolean valid = currentUserService.isAdmin(user) || currentUserService.hasAnyRole(
                user,
                "MACHFLOW_MANAGER",
                "MACHFLOW_PLANNER",
                "MACHFLOW_HEAD_TECHNICIAN",
                "MACHFLOW_TECHNICIAN");
        require(valid, "Selected user is not a MachFlow maintenance technician");
        if (headPreferred && !currentUserService.isAdmin(user)) {
            require(currentUserService.hasAnyRole(user, "MACHFLOW_MANAGER", "MACHFLOW_HEAD_TECHNICIAN"),
                    "Auto-routing head must have MACHFLOW_HEAD_TECHNICIAN or MACHFLOW_MANAGER role");
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
                        "select w from MachFlowWorkOrder w where w.equipmentId=:id and w.status not in :terminal order by w.createdAt desc",
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
                        "select t from MachFlowTeam t where t.requestToken=:token",
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
                        "select r from MachFlowReporter r where lower(r.reporterCode)=:code",
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
        if (reporter == null || !notBlank(reporter.allowedDomains)) return Set.of(ServiceDomain.MACHINE);
        LinkedHashSet<ServiceDomain> out = new LinkedHashSet<>();
        for (String token : reporter.allowedDomains.split("\\s*,\\s*")) {
            try {
                out.add(ServiceDomain.valueOf(token.trim().toUpperCase(Locale.ROOT)));
            } catch (Exception ignored) {
                // Ignore stale/legacy values rather than breaking a valid reporter record.
            }
        }
        return out.isEmpty() ? Set.of(ServiceDomain.MACHINE) : Set.copyOf(out);
    }

    private void validateReporterCanUseAsset(Reporter reporter, Equipment equipment, Set<ServiceDomain> allowed) {
        require(equipment != null && equipment.qrEnabled, "Asset QR is not available");
        require(normalizePlant(reporter.plantCode).equals(normalizePlant(equipment.plantCode)),
                "Your Reporter Pass belongs to another plant");
        require(allowed.contains(domainOf(equipment)),
                "Your Reporter Pass is not permitted for " + humanDomain(domainOf(equipment)) + " requests");
    }

    private void validateReporterCanUseDesk(Reporter reporter, Team desk, Set<ServiceDomain> allowed) {
        require(desk != null && desk.active && desk.publicReportingEnabled, "Service desk is unavailable");
        require(teamCanServePlant(desk, reporter.plantCode), "This service desk does not serve your plant");
        require(allowed.contains(domainOf(desk)),
                "Your Reporter Pass is not permitted for " + humanDomain(domainOf(desk)) + " requests");
    }

    private List<Map<String, Object>> listPublicServiceDesks(Set<String> plants, Set<ServiceDomain> allowedDomains) {
        if (plants == null || plants.isEmpty()) return List.of();
        List<Team> teams = em.createQuery(
                        "select t from MachFlowTeam t where t.active=true and t.publicReportingEnabled=true "
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
                "department", r.department,
                "phone", r.phone,
                "email", r.email,
                "validUntil", r.validUntil
        );
    }

    private Map<String, Object> reporterAdminView(Reporter r) {
        Map<String, Object> out = reporterPublicView(r);
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
                .filter(MachFlowService::notBlank)
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
        return switch (domain) {
            case MACHINE -> AssetKind.PRODUCTION_MACHINE;
            case IT -> AssetKind.IT_ASSET;
            case ELECTRICAL -> AssetKind.ELECTRICAL_ASSET;
            case FACILITY -> AssetKind.FACILITY_ASSET;
            case UTILITY -> AssetKind.UTILITY_ASSET;
            case GENERAL -> AssetKind.OTHER;
        };
    }

    private String humanDomain(ServiceDomain domain) {
        if (domain == null) return "General";
        return switch (domain) {
            case MACHINE -> "Machine Maintenance";
            case IT -> "IT Support";
            case ELECTRICAL -> "Electrical Maintenance";
            case FACILITY -> "Facility Maintenance";
            case UTILITY -> "Utilities Maintenance";
            case GENERAL -> "General Maintenance";
        };
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

    private boolean canManage(User user) {
        return currentUserService.isAdmin(user)
                || currentUserService.hasRole(user, "MACHFLOW_MANAGER");
    }

    private boolean canPlan(User user) {
        return canManage(user)
                || currentUserService.hasAnyRole(
                        user,
                        "MACHFLOW_PLANNER",
                        "MACHFLOW_HEAD_TECHNICIAN");
    }

    private boolean canCoordinate(User user) {
        return canPlan(user);
    }

    private boolean isHeadTechnician(User user) {
        return user != null && currentUserService.hasRole(user, "MACHFLOW_HEAD_TECHNICIAN");
    }

    private boolean isTechnicianOnly(User user) {
        return user != null
                && currentUserService.hasRole(user, "MACHFLOW_TECHNICIAN")
                && !canCoordinate(user)
                && !currentUserService.isAdmin(user);
    }

    private boolean isRequesterOnly(User user) {
        return user != null
                && currentUserService.hasRole(user, "MACHFLOW_REQUESTER")
                && !currentUserService.hasAnyRole(
                        user,
                        "MACHFLOW_MANAGER",
                        "MACHFLOW_PLANNER",
                        "MACHFLOW_HEAD_TECHNICIAN",
                        "MACHFLOW_TECHNICIAN")
                && !currentUserService.isAdmin(user);
    }

    private boolean isMachFlowUser(User user) {
        return currentUserService.isAdmin(user)
                || currentUserService.hasAnyRole(
                        user,
                        "MACHFLOW_MANAGER",
                        "MACHFLOW_PLANNER",
                        "MACHFLOW_HEAD_TECHNICIAN",
                        "MACHFLOW_TECHNICIAN",
                        "MACHFLOW_REQUESTER");
    }

    private boolean canReadOrder(User user, WorkOrder w) {
        if (user == null || w == null) return false;
        if (canCoordinate(user) || currentUserService.isAdmin(user)) return true;
        if (isTechnicianOnly(user)) {
            return notBlank(w.responsible) && w.responsible.equalsIgnoreCase(user.getUsername());
        }
        if (isRequesterOnly(user)) {
            return notBlank(w.requestedBy) && w.requestedBy.equalsIgnoreCase(user.getUsername());
        }
        return false;
    }

    private boolean canExecuteOrder(User user, WorkOrder w) {
        if (user == null || w == null) return false;
        if (canCoordinate(user) || currentUserService.isAdmin(user)) return true;
        return isTechnicianOnly(user)
                && notBlank(w.responsible)
                && w.responsible.equalsIgnoreCase(user.getUsername());
    }

    private Set<WorkStatus> allowedTransitionsFor(User user, WorkOrder w) {
        Set<WorkStatus> base = TRANSITIONS.getOrDefault(w.status, Set.of());
        if (base.isEmpty()) return Set.of();

        LinkedHashSet<WorkStatus> allowed = new LinkedHashSet<>();
        for (WorkStatus target : base) {
            if (target == WorkStatus.CLOSED) {
                if (canCoordinate(user)) allowed.add(target);
                continue;
            }
            if (w.status == WorkStatus.CLOSED && target == WorkStatus.IN_PROGRESS) {
                if (canManage(user)) allowed.add(target);
                continue;
            }
            if (target == WorkStatus.PLANNED || target == WorkStatus.ASSIGNED || target == WorkStatus.SCRAPPED) {
                if (canCoordinate(user)) allowed.add(target);
                continue;
            }
            if (target == WorkStatus.CANCELLED) {
                boolean ownNewRequest = isRequesterOnly(user)
                        && w.status == WorkStatus.NEW
                        && notBlank(w.requestedBy)
                        && w.requestedBy.equalsIgnoreCase(user.getUsername());
                if (canCoordinate(user) || ownNewRequest) allowed.add(target);
                continue;
            }
            if (target == WorkStatus.ACCEPTED || target == WorkStatus.IN_PROGRESS
                    || target == WorkStatus.WAITING_PARTS || target == WorkStatus.REPAIRED) {
                if (canExecuteOrder(user, w)) allowed.add(target);
                continue;
            }
            if (canCoordinate(user)) allowed.add(target);
        }
        return Set.copyOf(allowed);
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

    private Integer responseMinutes(WorkOrder w) {
        if (w == null || w.requestedAt == null || w.acceptedAt == null) return null;
        return Math.toIntExact(Math.max(0, Duration.between(w.requestedAt, w.acceptedAt).toMinutes()));
    }

    private Integer attendanceMinutes(WorkOrder w) {
        if (w == null || w.acceptedAt == null || w.startedAt == null) return null;
        return Math.toIntExact(Math.max(0, Duration.between(w.acceptedAt, w.startedAt).toMinutes()));
    }

    private String qrPath(UUID token) {
        return token == null ? null : "/machflow/request?asset=" + token;
    }

    private String serviceDeskPath(UUID token) {
        return token == null ? null : "/machflow/request?desk=" + token;
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

    private record QueryResult<T>(List<T> items, long total) {
    }
}
