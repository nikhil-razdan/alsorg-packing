package com.alsorg.packing.assetflow;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.assetflow.AssetFlowData.AssignmentRequest;
import com.alsorg.packing.assetflow.AssetFlowData.AssetKind;
import com.alsorg.packing.assetflow.AssetFlowData.AuthenticatedRequestCreate;
import com.alsorg.packing.assetflow.AssetFlowData.AuditEvent;
import com.alsorg.packing.assetflow.AssetFlowData.ComplaintSource;
import com.alsorg.packing.assetflow.AssetFlowData.Criticality;
import com.alsorg.packing.assetflow.AssetFlowData.CostBucket;
import com.alsorg.packing.assetflow.AssetFlowData.CostSource;
import com.alsorg.packing.assetflow.AssetFlowData.CostStatus;
import com.alsorg.packing.assetflow.AssetFlowData.ExpenseCategory;
import com.alsorg.packing.assetflow.AssetFlowData.MaintenanceCost;
import com.alsorg.packing.assetflow.AssetFlowData.MaintenanceCostImportConfirm;
import com.alsorg.packing.assetflow.AssetFlowData.MaintenanceCostImportRow;
import com.alsorg.packing.assetflow.AssetFlowData.MaintenanceCostLineUpsert;
import com.alsorg.packing.assetflow.AssetFlowData.MaintenanceCostUpsert;
import com.alsorg.packing.assetflow.AssetFlowData.MaintenanceCostVoidRequest;
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

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
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
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

@Service
@Transactional
public class AssetFlowService {

    private static final int MAX_WORK_ORDER_PAGE_SIZE = 200;
    private static final int MAX_REPORTER_DIRECTORY_ROWS = 2000;
    private static final int MAX_EQUIPMENT_ROWS = 5000;
    private static final int MAX_TEAM_ROWS = 1000;
    private static final int MAX_PLAN_ROWS = 5000;
    private static final int MAX_USER_DIRECTORY_ROWS = 5000;
    private static final int MAX_COST_PAGE_SIZE = 250;
    private static final int MAX_COST_SUMMARY_ROWS = 50000;
    private static final int MAX_COST_IMPORT_ROWS = 5000;

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
                        WorkOrder.class)
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
        boolean costVisible = canViewReports(currentUser);
        if (costVisible) {
            backfillLegacyWorkOrderCosts(scope, domainScope, LocalDate.now().withDayOfYear(1), LocalDate.now());
        }
        List<MaintenanceCost> ytdCostRows = costVisible
                ? findMaintenanceCostEntities(
                        scope, domainScope, LocalDate.now().withDayOfYear(1), LocalDate.now(),
                        null, null, null, null, null, null, MAX_COST_SUMMARY_ROWS)
                : List.of();
        List<MaintenanceCost> verifiedYtdCosts = ytdCostRows.stream()
                .filter(c -> c.status == CostStatus.VERIFIED)
                .toList();
        BigDecimal maintenanceSpendYtd = sumMaintenanceCosts(verifiedYtdCosts);
        BigDecimal maintenanceSpendMtd = sumMaintenanceCosts(verifiedYtdCosts.stream()
                .filter(c -> YearMonth.from(c.costDate).equals(YearMonth.now()))
                .toList());
        BigDecimal pendingCostYtd = sumMaintenanceCosts(ytdCostRows.stream()
                .filter(c -> c.status == CostStatus.DRAFT)
                .toList());
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
                    "assetsDown", domainAssets.stream().filter(e -> e.status == EquipmentStatus.DOWN || e.status == EquipmentStatus.UNDER_MAINTENANCE).count(),
                    "maintenanceCostYtd", costVisible ? sumMaintenanceCosts(verifiedYtdCosts.stream().filter(c -> domainOf(c) == domain).toList()) : null,
                    "pendingCostYtd", costVisible ? sumMaintenanceCosts(ytdCostRows.stream().filter(c -> c.status == CostStatus.DRAFT && domainOf(c) == domain).toList()) : null
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
                "equipmentCount", equipment.size(),
                "maintenanceSpendMtd", costVisible ? maintenanceSpendMtd : null,
                "maintenanceSpendYtd", costVisible ? maintenanceSpendYtd : null,
                "pendingCostYtd", costVisible ? pendingCostYtd : null
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
        int safeSize = Math.min(Math.max(size, 1), MAX_WORK_ORDER_PAGE_SIZE);

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
        if (tokenTeam != null) validateRequestRoute(tokenTeam, plant, domain);

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

    public Map<String, Object> publicContext(UUID equipmentToken, UUID serviceDeskToken) {
        Equipment equipment = equipmentToken == null ? null : requireEquipmentByQr(equipmentToken);
        Team team = serviceDeskToken == null ? null : resolveServiceDeskToken(serviceDeskToken, true);

        if (equipment != null) require(equipment.qrEnabled, "QR reporting is disabled for this asset");
        if (team != null) require(team.active && team.publicReportingEnabled, "This service-desk request link is disabled");

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
        if (notBlank(search)) query.setParameter("search", "%" + boundedSearch(search) + "%");
        query.setMaxResults(MAX_REPORTER_DIRECTORY_ROWS);

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
            require(readDomainScope(current, request.serviceDomain()).contains(request.serviceDomain()),
                    "You cannot move work into another maintenance department");
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

            // New clients submit detailed cost lines. Older clients may continue
            // sending only the three scalar totals; both paths are supported.
            if (request.costLines() != null) {
                replaceWorkOrderCostLines(w, request.costLines(), actor(auth));
                if (!notBlank(w.partsUsed)) {
                    w.partsUsed = request.costLines().stream()
                            .filter(line -> line != null && (line.costBucket() == null || line.costBucket() == CostBucket.MATERIAL))
                            .map(MaintenanceCostLineUpsert::description)
                            .filter(AssetFlowService::notBlank)
                            .map(AssetFlowService::clean)
                            .distinct()
                            .collect(Collectors.joining(", "));
                }
            } else if (request.partsCost() != null || request.laborCost() != null || request.externalCost() != null) {
                upsertLegacyWorkOrderCostSummary(w, request, actor(auth));
            }
            if (hasActiveCostLedgerRows(w.id)) {
                recalculateWorkOrderCostTotals(w);
            } else {
                if (request.partsCost() != null) w.partsCost = money(request.partsCost());
                if (request.laborCost() != null) w.laborCost = money(request.laborCost());
                if (request.externalCost() != null) w.externalCost = money(request.externalCost());
            }

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
            verifyWorkOrderCostLines(w, actor(auth));
            if (hasActiveCostLedgerRows(w.id)) recalculateWorkOrderCostTotals(w);
            registerFailureOnce(w);
            completePreventiveCycleIfNeeded(w);
        }

        if (to == WorkStatus.CANCELLED || to == WorkStatus.SCRAPPED) {
            require(notBlank(request.note()), "A reason is required for " + humanStatus(to));
        }

        if (from == WorkStatus.CLOSED && to == WorkStatus.IN_PROGRESS) {
            require(currentUserService.isAdmin(current) || canCoordinate(current, domainOf(w)),
                    "Only the department head/admin can reopen a closed job");
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
        out.put("canEdit", canEditAssetMaster(current, domainOf(e)));
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
        require(canEditAssetMaster(current, domainOf(e)), humanDomain(domainOf(e)) + " head/admin permission is required to edit this asset");
        checkVersion(e.version, request.version());

        ServiceDomain targetDomain = request.serviceDomain() == null ? domainOf(e) : request.serviceDomain();
        require(targetDomain == domainOf(e) || currentUserService.isAdmin(current),
                "Moving an asset between Machine Maintenance and IT is ADMIN-only");
        require(canEditAssetMaster(current, targetDomain), "You cannot edit assets in " + humanDomain(targetDomain));

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
        require(canEditAssetMaster(current, domainOf(e)), humanDomain(domainOf(e)) + " head/admin permission is required to rotate this asset QR");
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
                .setMaxResults(MAX_TEAM_ROWS)
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
        if (lead != null) validateHeadTechnician(lead, targetPlant, requestedDomain);

        List<String> members = splitMembers(request.membersText());
        for (String member : members) validateAssignableUser(member, targetPlant, requestedDomain, false);
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

    public int generateDuePreventiveOrders(ServiceDomain serviceDomain) {
        User current = currentUserService.requireCurrentUser();
        Set<ServiceDomain> domains = readDomainScope(current, serviceDomain);
        require(canManageAnyRequestedDomain(current, domains), "Department head/admin permission is required");
        return generateDuePreventiveOrdersForPlants(readPlantScope(null), domains, current.getUsername());
    }

    @Scheduled(cron = "0 10 1 * * *", zone = "${app.time-zone:Asia/Kolkata}")
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
                .setParameter("domains", allowedDomains)
                .setMaxResults(MAX_PLAN_ROWS);
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
        require(ChronoUnit.DAYS.between(start, end) <= 366, "Calendar range cannot exceed 366 days");
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
                .setMaxResults(10000)
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

    /* =============================== MAINTENANCE COSTING =============================== */

    public Map<String, Object> listMaintenanceCosts(
            LocalDate from,
            LocalDate to,
            String plantCode,
            ServiceDomain serviceDomain,
            UUID equipmentId,
            UUID workOrderId,
            CostBucket costBucket,
            ExpenseCategory expenseCategory,
            CostStatus status,
            String search,
            int page,
            int size) {
        User current = currentUserService.requireCurrentUser();
        require(canViewReports(current), "Maintenance costing access is restricted to department heads, Director and ADMIN");
        Set<String> scope = readPlantScope(plantCode);
        Set<ServiceDomain> domains = readDomainScope(current, serviceDomain);
        LocalDate start = from == null ? LocalDate.now().withDayOfYear(1) : from;
        LocalDate end = to == null ? LocalDate.now() : to;
        require(!end.isBefore(start), "Costing end date cannot be before start date");
        require(ChronoUnit.DAYS.between(start, end) <= 1096, "Costing range cannot exceed 3 years");
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(size, 1), MAX_COST_PAGE_SIZE);

        backfillLegacyWorkOrderCosts(scope, domains, start, end);

        StringBuilder where = new StringBuilder(" where c.plantCode in :plants and c.serviceDomain in :domains and c.costDate>=:from and c.costDate<=:to");
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("plants", scope);
        params.put("domains", domains);
        params.put("from", start);
        params.put("to", end);
        if (equipmentId != null) { where.append(" and c.equipmentId=:equipmentId"); params.put("equipmentId", equipmentId); }
        if (workOrderId != null) { where.append(" and c.workOrderId=:workOrderId"); params.put("workOrderId", workOrderId); }
        if (costBucket != null) { where.append(" and c.costBucket=:costBucket"); params.put("costBucket", costBucket); }
        if (expenseCategory != null) { where.append(" and c.expenseCategory=:expenseCategory"); params.put("expenseCategory", expenseCategory); }
        if (status != null) { where.append(" and c.status=:status"); params.put("status", status); }
        else where.append(" and c.status<>:voidStatus");
        if (status == null) params.put("voidStatus", CostStatus.VOID);
        if (notBlank(search)) {
            where.append(" and (lower(c.description) like :search or lower(coalesce(c.equipmentName,'')) like :search "
                    + "or lower(coalesce(c.legacyMachineName,'')) like :search or lower(coalesce(c.equipmentCode,'')) like :search "
                    + "or lower(coalesce(c.workNumber,'')) like :search or lower(coalesce(c.vendorName,'')) like :search "
                    + "or lower(coalesce(c.poNumber,'')) like :search or lower(coalesce(c.invoiceNumber,'')) like :search)");
            params.put("search", "%" + clean(search).toLowerCase(Locale.ROOT) + "%");
        }

        TypedQuery<MaintenanceCost> rowsQuery = em.createQuery(
                "select c from AssetFlowMaintenanceCost c" + where + " order by c.costDate desc, c.createdAt desc",
                MaintenanceCost.class);
        TypedQuery<Long> countQuery = em.createQuery(
                "select count(c) from AssetFlowMaintenanceCost c" + where,
                Long.class);
        params.forEach((key, value) -> { rowsQuery.setParameter(key, value); countQuery.setParameter(key, value); });
        List<MaintenanceCost> rows = rowsQuery
                .setFirstResult(safePage * safeSize)
                .setMaxResults(safeSize)
                .getResultList();
        long total = countQuery.getSingleResult();

        return map(
                "items", rows.stream().map(this::maintenanceCostView).toList(),
                "page", safePage,
                "size", safeSize,
                "total", total,
                "pages", Math.max(1, (long) Math.ceil(total / (double) safeSize)),
                "from", start,
                "to", end
        );
    }

    public Map<String, Object> maintenanceCostSummary(
            LocalDate from,
            LocalDate to,
            String plantCode,
            ServiceDomain serviceDomain,
            UUID equipmentId,
            CostBucket costBucket,
            ExpenseCategory expenseCategory) {
        User current = currentUserService.requireCurrentUser();
        require(canViewReports(current), "Maintenance costing access is restricted to department heads, Director and ADMIN");
        Set<String> scope = readPlantScope(plantCode);
        Set<ServiceDomain> domains = readDomainScope(current, serviceDomain);
        LocalDate start = from == null ? LocalDate.now().withDayOfYear(1) : from;
        LocalDate end = to == null ? LocalDate.now() : to;
        require(!end.isBefore(start), "Costing end date cannot be before start date");
        require(ChronoUnit.DAYS.between(start, end) <= 1096, "Costing range cannot exceed 3 years");

        backfillLegacyWorkOrderCosts(scope, domains, start, end);
        List<MaintenanceCost> rows = findMaintenanceCostEntities(
                scope, domains, start, end, equipmentId, null, costBucket, expenseCategory, null, null, MAX_COST_SUMMARY_ROWS);
        return maintenanceCostSummaryFromRows(rows, start, end, serviceDomain, domains);
    }

    public Map<String, Object> saveMaintenanceCost(UUID id, MaintenanceCostUpsert request, Authentication auth) {
        require(request != null, "Cost entry is required");
        User current = currentUserService.requireCurrentUser();
        MaintenanceCost c = id == null ? new MaintenanceCost() : requireMaintenanceCost(id, true);
        if (id != null) {
            checkVersion(c.version, request.version());
            require(c.status != CostStatus.VOID, "A voided cost entry cannot be edited");
            requirePlantWriteAccess(c.plantCode);
            require(canCoordinate(current, domainOf(c)), "Department head/coordinator permission is required to edit maintenance cost");
        }

        WorkOrder workOrder = request.workOrderId() == null ? null : requireOrder(request.workOrderId(), false);
        Equipment equipment = request.equipmentId() == null ? null : requireEquipment(request.equipmentId(), false);
        if (workOrder != null && equipment == null && workOrder.equipmentId != null) {
            equipment = requireEquipment(workOrder.equipmentId, false);
        }
        if (workOrder != null && equipment != null && workOrder.equipmentId != null) {
            require(workOrder.equipmentId.equals(equipment.id), "Selected asset does not match the selected work order");
        }

        String targetPlant = workOrder != null ? normalizePlant(workOrder.plantCode)
                : equipment != null ? normalizePlant(equipment.plantCode)
                : normalizePlant(request.plantCode());
        require(notBlank(targetPlant), "Plant is required for a maintenance cost entry");
        requirePlantWriteAccess(targetPlant);

        ServiceDomain domain = workOrder != null ? domainOf(workOrder)
                : equipment != null ? domainOf(equipment)
                : request.serviceDomain() == null ? ServiceDomain.MACHINE : request.serviceDomain();
        requireDomainReadAccess(current, domain);
        require(canCoordinate(current, domain), "Department head/coordinator permission is required to manage maintenance cost");

        if (workOrder != null) ensureLegacyWorkOrderSummaryLedger(workOrder, actor(auth));

        c.costDate = request.costDate() == null ? LocalDate.now() : request.costDate();
        c.serviceDomain = domain;
        c.plantCode = targetPlant;
        c.equipmentId = equipment != null ? equipment.id : workOrder != null ? workOrder.equipmentId : null;
        c.equipmentCode = equipment != null ? equipment.assetCode : workOrder != null ? workOrder.equipmentCode : null;
        c.equipmentName = equipment != null ? equipment.name : workOrder != null ? workOrder.equipmentName : null;
        c.workOrderId = workOrder == null ? null : workOrder.id;
        c.workNumber = workOrder == null ? null : workOrder.workNumber;
        c.costBucket = request.costBucket() == null ? CostBucket.MATERIAL : request.costBucket();
        c.expenseCategory = request.expenseCategory() == null ? defaultExpenseCategory(c.costBucket) : request.expenseCategory();
        c.description = clean(request.description());
        require(notBlank(c.description), "Cost description is required");
        c.quantity = positiveQuantity(request.quantity());
        c.uom = firstNonBlank(request.uom(), defaultUom(c.costBucket));
        c.unitRate = request.unitRate() == null ? null : money(request.unitRate());
        c.amount = resolveCostAmount(c.quantity, c.unitRate, request.amount());
        require(c.amount.compareTo(BigDecimal.ZERO) > 0, "Cost amount must be greater than zero");
        c.vendorName = clean(request.vendorName());
        c.poNumber = clean(request.poNumber());
        c.invoiceNumber = clean(request.invoiceNumber());
        c.legacyMachineSerial = clean(request.legacyMachineSerial());
        c.legacyMachineName = clean(request.legacyMachineName());
        c.remarks = clean(request.remarks());
        c.source = id == null ? CostSource.DIRECT_ENTRY : c.source;
        if (c.source == null) c.source = CostSource.DIRECT_ENTRY;

        CostStatus requestedStatus = request.status() == null ? CostStatus.VERIFIED : request.status();
        require(requestedStatus != CostStatus.VOID, "Use the Void action instead of setting VOID directly");
        c.status = requestedStatus;
        LocalDateTime now = LocalDateTime.now();
        String actor = actor(auth);
        c.updatedBy = actor;
        c.updatedAt = now;
        if (c.status == CostStatus.VERIFIED) {
            c.verifiedBy = actor;
            c.verifiedAt = now;
        } else {
            c.verifiedBy = null;
            c.verifiedAt = null;
        }
        if (id == null) {
            c.createdBy = actor;
            c.createdAt = now;
            em.persist(c);
        }
        audit("MAINTENANCE_COST", c.id, id == null ? "CREATED" : "UPDATED", null, c.status.name(), actor,
                c.description + " · " + c.amount);
        if (workOrder != null) recalculateWorkOrderCostTotals(workOrder);
        return maintenanceCostView(c);
    }

    public Map<String, Object> verifyMaintenanceCost(UUID id, Long version, Authentication auth) {
        MaintenanceCost c = requireMaintenanceCost(id, true);
        checkVersion(c.version, version);
        require(c.status != CostStatus.VOID, "Voided cost entries cannot be verified");
        User current = currentUserService.requireCurrentUser();
        requirePlantWriteAccess(c.plantCode);
        require(canCoordinate(current, domainOf(c)), "Department head/coordinator permission is required to verify maintenance cost");
        c.status = CostStatus.VERIFIED;
        c.verifiedBy = actor(auth);
        c.verifiedAt = LocalDateTime.now();
        c.updatedBy = actor(auth);
        c.updatedAt = c.verifiedAt;
        audit("MAINTENANCE_COST", c.id, "VERIFIED", null, c.status.name(), actor(auth), c.description);
        if (c.workOrderId != null) recalculateWorkOrderCostTotals(requireOrder(c.workOrderId, true));
        return maintenanceCostView(c);
    }

    public Map<String, Object> voidMaintenanceCost(UUID id, MaintenanceCostVoidRequest request, Authentication auth) {
        require(request != null && notBlank(request.reason()), "Void reason is required");
        MaintenanceCost c = requireMaintenanceCost(id, true);
        checkVersion(c.version, request.version());
        require(c.status != CostStatus.VOID, "Cost entry is already voided");
        User current = currentUserService.requireCurrentUser();
        requirePlantWriteAccess(c.plantCode);
        require(canCoordinate(current, domainOf(c)), "Department head/coordinator permission is required to void maintenance cost");
        CostStatus from = c.status;
        c.status = CostStatus.VOID;
        c.voidReason = clean(request.reason());
        c.voidedBy = actor(auth);
        c.voidedAt = LocalDateTime.now();
        c.updatedBy = actor(auth);
        c.updatedAt = c.voidedAt;
        audit("MAINTENANCE_COST", c.id, "VOIDED", from.name(), CostStatus.VOID.name(), actor(auth), c.voidReason);
        if (c.workOrderId != null) recalculateWorkOrderCostTotals(requireOrder(c.workOrderId, true));
        return maintenanceCostView(c);
    }


    public Map<String, Object> previewMaintenanceCostWorkbook(MultipartFile file) {
        User current = currentUserService.requireCurrentUser();
        require(file != null && !file.isEmpty(), "Select a Maintenance Costing XLSX file");
        require(file.getSize() <= 15L * 1024L * 1024L, "Maintenance Costing XLSX must be 15 MB or smaller");
        Set<String> scope = readPlantScope(null);
        Set<ServiceDomain> domains = readDomainScope(current, null);
        require(domains.stream().anyMatch(d -> canCoordinate(current, d)),
                "Department head/coordinator permission is required to import maintenance costing");

        List<Map<String, String>> sourceRows;
        try {
            sourceRows = readMaintenanceCostWorkbook(file.getBytes());
        } catch (IOException ex) {
            throw badRequest("Could not read Maintenance Costing workbook: " + ex.getMessage());
        }
        require(!sourceRows.isEmpty(), "No usable rows were found in the SPARE ENTRY sheet");

        List<Equipment> equipment = listEquipmentEntities(scope, domains, null, null, null);
        Map<String, Equipment> equipmentBySerial = new HashMap<>();
        Map<String, List<Equipment>> equipmentByName = new HashMap<>();
        for (Equipment e : equipment) {
            if (notBlank(e.serialNumber)) equipmentBySerial.put(clean(e.serialNumber).toUpperCase(Locale.ROOT), e);
            equipmentByName.computeIfAbsent(machineMatchKey(e.name), ignored -> new ArrayList<>()).add(e);
        }

        List<Map<String, Object>> preview = new ArrayList<>();
        int ready = 0;
        int skippedYear = 0;
        int invalid = 0;
        List<LocalDate> parsedDates = new ArrayList<>();

        for (Map<String, String> raw : sourceRows) {
            int rowNumber = parseInt(raw.get("_ROW"), preview.size() + 2);
            String rawMonth = clean(raw.get("MONTH"));
            String rawDate = clean(raw.get("DATE"));
            String rawPlant = clean(raw.get("PLANT"));
            String rawMachine = clean(raw.get("MACHINE"));
            String rawDescription = clean(raw.get("DESCRIPTION"));
            String rawPo = clean(raw.get("PO"));
            String rawSerial = clean(raw.get("SERIAL"));
            String rawCost = clean(raw.get("COST"));
            List<String> issues = new ArrayList<>();
            List<String> warnings = new ArrayList<>();

            if ("YEAR".equalsIgnoreCase(rawMonth)) {
                skippedYear++;
                preview.add(map(
                        "rowNumber", rowNumber,
                        "rawDate", rawDate,
                        "rawMonth", rawMonth,
                        "rawPlant", rawPlant,
                        "rawMachine", rawMachine,
                        "description", rawDescription,
                        "poNumber", rawPo,
                        "legacyMachineSerial", rawSerial,
                        "rawCost", rawCost,
                        "ready", false,
                        "include", false,
                        "status", "SKIPPED_YEAR",
                        "issues", List.of("YEAR summary rows are intentionally not imported; annual totals are derived from dated transactions."),
                        "warnings", List.of()
                ));
                continue;
            }

            LocalDate costDate = parseLegacyCostDate(rawDate);
            if (costDate == null) issues.add("INVALID_DATE");
            else parsedDates.add(costDate);

            String plant = resolveLegacyPlant(rawPlant, scope);
            if (!notBlank(plant)) issues.add("UNKNOWN_PLANT");

            BigDecimal amount = parseLegacyMoney(rawCost);
            if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) issues.add("INVALID_COST");
            if (!notBlank(rawDescription)) issues.add("MISSING_DESCRIPTION");

            Equipment resolved = resolveLegacyEquipment(rawMachine, rawSerial, plant, equipmentBySerial, equipmentByName);
            if (notBlank(rawMachine) && resolved == null) warnings.add("UNMAPPED_ASSET_REFERENCE_PRESERVED");
            ServiceDomain domain = resolved == null ? ServiceDomain.MACHINE : domainOf(resolved);
            if (!domains.contains(domain)) issues.add("UNAUTHORISED_DOMAIN");

            CostBucket bucket = inferLegacyCostBucket(rawDescription);
            ExpenseCategory category = inferLegacyExpenseCategory(rawDescription, bucket);
            boolean rowReady = issues.isEmpty();
            if (rowReady) ready++; else invalid++;

            preview.add(map(
                    "rowNumber", rowNumber,
                    "rawDate", rawDate,
                    "rawMonth", rawMonth,
                    "rawPlant", rawPlant,
                    "rawMachine", rawMachine,
                    "costDate", costDate,
                    "plantCode", plant,
                    "equipmentId", resolved == null ? null : resolved.id,
                    "equipmentName", resolved == null ? null : resolved.name,
                    "legacyMachineName", resolved == null ? blankToNull(rawMachine) : null,
                    "equipmentCode", resolved == null ? null : resolved.assetCode,
                    "serviceDomain", domain.name(),
                    "costBucket", bucket.name(),
                    "expenseCategory", category.name(),
                    "description", rawDescription,
                    "poNumber", rawPo,
                    "legacyMachineSerial", rawSerial,
                    "amount", amount,
                    "ready", rowReady,
                    "include", rowReady,
                    "status", rowReady ? (warnings.isEmpty() ? "READY" : "READY_WITH_WARNING") : "REVIEW",
                    "issues", issues,
                    "warnings", warnings
            ));
        }

        // Duplicate detection is based on dated transaction fingerprints, not YEAR summary rows.
        if (!parsedDates.isEmpty()) {
            LocalDate minDate = parsedDates.stream().min(LocalDate::compareTo).orElse(LocalDate.now());
            LocalDate maxDate = parsedDates.stream().max(LocalDate::compareTo).orElse(LocalDate.now());
            Set<String> existingFingerprints = findMaintenanceCostEntities(
                    scope, domains, minDate, maxDate, null, null, null, null, null, null, MAX_COST_SUMMARY_ROWS)
                    .stream().map(this::costFingerprint).collect(Collectors.toSet());
            for (Map<String, Object> row : preview) {
                if (!Boolean.TRUE.equals(row.get("ready"))) continue;
                String fingerprint = previewFingerprint(row);
                if (existingFingerprints.contains(fingerprint)) {
                    @SuppressWarnings("unchecked")
                    List<String> issues = new ArrayList<>((List<String>) row.get("issues"));
                    issues.add("POSSIBLE_DUPLICATE");
                    row.put("issues", issues);
                    row.put("ready", false);
                    row.put("include", false);
                    row.put("status", "DUPLICATE");
                    ready--;
                    invalid++;
                }
            }
        }

        return map(
                "fileName", file.getOriginalFilename(),
                "rows", preview,
                "summary", map(
                        "sourceRows", sourceRows.size(),
                        "ready", Math.max(0, ready),
                        "review", invalid,
                        "skippedYear", skippedYear
                )
        );
    }

    public Map<String, Object> confirmMaintenanceCostImport(MaintenanceCostImportConfirm request, Authentication auth) {
        require(request != null && request.rows() != null && !request.rows().isEmpty(), "Import preview rows are required");
        require(request.rows().size() <= MAX_COST_IMPORT_ROWS, "Import exceeds the maximum of " + MAX_COST_IMPORT_ROWS + " rows");
        User current = currentUserService.requireCurrentUser();
        Set<String> scope = readPlantScope(null);
        Set<ServiceDomain> domains = readDomainScope(current, null);
        UUID batchId = UUID.randomUUID();
        String actor = actor(auth);
        int created = 0;
        int skipped = 0;
        List<Map<String, Object>> rejected = new ArrayList<>();

        for (MaintenanceCostImportRow row : request.rows()) {
            if (row == null || Boolean.FALSE.equals(row.include())) { skipped++; continue; }
            List<String> issues = new ArrayList<>();
            String plant = resolveLegacyPlant(row.plantCode(), scope);
            if (!notBlank(plant)) issues.add("UNKNOWN_PLANT");
            if (row.costDate() == null) issues.add("INVALID_DATE");
            BigDecimal amount = money(row.amount());
            if (amount.compareTo(BigDecimal.ZERO) <= 0) issues.add("INVALID_COST");
            if (!notBlank(row.description())) issues.add("MISSING_DESCRIPTION");

            Equipment equipment = row.equipmentId() == null ? null : em.find(Equipment.class, row.equipmentId());
            if (row.equipmentId() != null && equipment == null) issues.add("ASSET_NOT_FOUND");
            ServiceDomain domain = equipment != null ? domainOf(equipment)
                    : row.serviceDomain() == null ? ServiceDomain.MACHINE : row.serviceDomain();
            if (!domains.contains(domain) || !canCoordinate(current, domain)) issues.add("UNAUTHORISED_DOMAIN");
            if (equipment != null && !normalizePlant(equipment.plantCode).equals(plant)) issues.add("ASSET_PLANT_MISMATCH");

            if (!issues.isEmpty()) {
                rejected.add(map("rowNumber", row.rowNumber(), "issues", issues));
                continue;
            }

            MaintenanceCost c = new MaintenanceCost();
            c.costDate = row.costDate();
            c.plantCode = plant;
            c.serviceDomain = domain;
            c.equipmentId = equipment == null ? null : equipment.id;
            c.equipmentCode = equipment == null ? null : equipment.assetCode;
            c.equipmentName = equipment == null ? null : equipment.name;
            c.legacyMachineName = equipment == null ? clean(row.equipmentName()) : null;
            c.costBucket = row.costBucket() == null ? inferLegacyCostBucket(row.description()) : row.costBucket();
            c.expenseCategory = row.expenseCategory() == null ? inferLegacyExpenseCategory(row.description(), c.costBucket) : row.expenseCategory();
            c.description = clean(row.description());
            c.quantity = BigDecimal.ONE.setScale(3);
            c.uom = "LOT";
            c.amount = amount;
            c.poNumber = clean(row.poNumber());
            c.legacyMachineSerial = clean(row.legacyMachineSerial());
            c.status = CostStatus.VERIFIED;
            c.source = CostSource.EXCEL_IMPORT;
            c.importBatchId = batchId;
            c.legacyRowNumber = row.rowNumber();
            c.createdBy = actor;
            c.createdAt = LocalDateTime.now();
            c.updatedBy = actor;
            c.updatedAt = c.createdAt;
            c.verifiedBy = actor;
            c.verifiedAt = c.createdAt;

            if (maintenanceCostDuplicateExists(c)) {
                skipped++;
                continue;
            }
            em.persist(c);
            audit("MAINTENANCE_COST", c.id, "IMPORTED", null, CostStatus.VERIFIED.name(), actor,
                    "Batch " + batchId + " · row " + row.rowNumber() + " · " + c.description);
            created++;
        }

        return map(
                "batchId", batchId,
                "created", created,
                "skipped", skipped,
                "rejected", rejected,
                "rejectedCount", rejected.size()
        );
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
        require(ChronoUnit.DAYS.between(start, end) <= 1096, "Report range cannot exceed 3 years");
        LocalDateTime fromAt = start.atStartOfDay();
        LocalDateTime toAt = end.plusDays(1).atStartOfDay();

        List<WorkOrder> orders = listOrdersByCreatedRange(scope, fromAt, toAt).stream()
                .filter(w -> domains.contains(domainOf(w)))
                .filter(w -> canReadOrder(current, w))
                .toList();
        backfillLegacyWorkOrderCosts(scope, domains, start, end);
        List<MaintenanceCost> reportCostRows = findMaintenanceCostEntities(
                scope, domains, start, end, null, null, null, null, null, null, MAX_COST_SUMMARY_ROWS);
        List<MaintenanceCost> verifiedReportCosts = reportCostRows.stream()
                .filter(c -> c.status == CostStatus.VERIFIED)
                .toList();
        Map<String, BigDecimal> costByEquipment = verifiedReportCosts.stream()
                .filter(c -> c.equipmentId != null || notBlank(c.equipmentName))
                .collect(Collectors.groupingBy(
                        this::equipmentCostKey,
                        Collectors.reducing(BigDecimal.ZERO.setScale(2), c -> money(c.amount), BigDecimal::add)));

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
                .filter(w -> w.equipmentId != null || notBlank(w.equipmentName))
                .collect(Collectors.groupingBy(this::equipmentWorkKey));
        List<Map<String, Object>> assets = byEquipment.entrySet().stream()
                .map(e -> {
                    List<WorkOrder> list = e.getValue();
                    WorkOrder first = list.get(0);
                    ServiceDomain domain = domainOf(first);
                    long failures = list.stream().filter(w -> w.breakdown).count();
                    long downtime = list.stream().map(w -> w.downtimeMinutes).filter(Objects::nonNull)
                            .mapToLong(Integer::longValue).sum();
                    BigDecimal cost = costByEquipment.getOrDefault(e.getKey(), BigDecimal.ZERO.setScale(2));
                    return map(
                            "equipmentId", first.equipmentId,
                            "equipmentCode", first.equipmentCode,
                            "name", firstNonBlank(first.equipmentName, "General / Unmapped"),
                            "plantCode", first.plantCode,
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
                                .mapToLong(Integer::longValue).sum() / 60.0, 1),
                        "cost", sumMaintenanceCosts(verifiedReportCosts.stream()
                                .filter(c -> YearMonth.from(c.costDate).equals(e.getKey()))
                                .toList())
                ))
                .toList();

        BigDecimal totalCost = sumMaintenanceCosts(verifiedReportCosts);
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
            BigDecimal cost = sumMaintenanceCosts(verifiedReportCosts.stream().filter(c -> domainOf(c) == domain).toList());
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
                .setMaxResults(1000)
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

        return userRepository.findAll(PageRequest.of(
                        0,
                        MAX_USER_DIRECTORY_ROWS,
                        Sort.by(Sort.Direction.ASC, "username")))
                .getContent()
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
                        "roles", user.getEffectiveRoles() == null
                                ? List.of()
                                : user.getEffectiveRoles().stream()
                                        .filter(Objects::nonNull)
                                        .map(String::trim)
                                        .sorted()
                                        .toList(),
                        "plantCodes", safePlants(user).stream().sorted().toList(),
                        "domains", java.util.Arrays.stream(ServiceDomain.values())
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
            params.put("search", "%" + boundedSearch(search) + "%");
        }

        TypedQuery<WorkOrder> query = em.createQuery(
                "select w from AssetFlowWorkOrder w" + where + " order by w.createdAt desc, w.id desc",
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
            params.put("q", "%" + boundedSearch(search) + "%");
        }
        jpql.append(" order by e.name, e.id");
        TypedQuery<Equipment> query = em.createQuery(jpql.toString(), Equipment.class);
        params.forEach(query::setParameter);
        query.setMaxResults(MAX_EQUIPMENT_ROWS);
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
                .setMaxResults(MAX_PLAN_ROWS)
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
                .setMaxResults(50000)
                .getResultList();
    }

    private List<WorkOrder> listOrdersForEquipment(UUID equipmentId, int limit) {
        return em.createQuery(
                        "select w from AssetFlowWorkOrder w where w.equipmentId=:id order by w.createdAt desc",
                        WorkOrder.class)
                .setParameter("id", equipmentId)
                .setMaxResults(Math.max(1, Math.min(limit, 100)))
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

    private MaintenanceCost requireMaintenanceCost(UUID id, boolean lock) {
        require(id != null, "Maintenance cost ID is required");
        MaintenanceCost c = lock
                ? em.find(MaintenanceCost.class, id, LockModeType.PESSIMISTIC_WRITE)
                : em.find(MaintenanceCost.class, id);
        if (c == null) throw notFound("Maintenance cost entry not found");
        return c;
    }

    private ServiceDomain domainOf(MaintenanceCost c) {
        return c == null || c.serviceDomain == null ? ServiceDomain.MACHINE : c.serviceDomain;
    }

    private List<MaintenanceCost> findMaintenanceCostEntities(
            Set<String> plants,
            Set<ServiceDomain> domains,
            LocalDate from,
            LocalDate to,
            UUID equipmentId,
            UUID workOrderId,
            CostBucket costBucket,
            ExpenseCategory expenseCategory,
            CostStatus status,
            String search,
            int maxRows) {
        StringBuilder jpql = new StringBuilder(
                "select c from AssetFlowMaintenanceCost c where c.plantCode in :plants and c.serviceDomain in :domains");
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("plants", plants);
        params.put("domains", domains);
        if (from != null) { jpql.append(" and c.costDate>=:from"); params.put("from", from); }
        if (to != null) { jpql.append(" and c.costDate<=:to"); params.put("to", to); }
        if (equipmentId != null) { jpql.append(" and c.equipmentId=:equipmentId"); params.put("equipmentId", equipmentId); }
        if (workOrderId != null) { jpql.append(" and c.workOrderId=:workOrderId"); params.put("workOrderId", workOrderId); }
        if (costBucket != null) { jpql.append(" and c.costBucket=:bucket"); params.put("bucket", costBucket); }
        if (expenseCategory != null) { jpql.append(" and c.expenseCategory=:category"); params.put("category", expenseCategory); }
        if (status != null) { jpql.append(" and c.status=:status"); params.put("status", status); }
        else { jpql.append(" and c.status<>:voidStatus"); params.put("voidStatus", CostStatus.VOID); }
        if (notBlank(search)) {
            jpql.append(" and (lower(c.description) like :search or lower(coalesce(c.equipmentName,'')) like :search "
                    + "or lower(coalesce(c.legacyMachineName,'')) like :search or lower(coalesce(c.workNumber,'')) like :search "
                    + "or lower(coalesce(c.vendorName,'')) like :search or lower(coalesce(c.poNumber,'')) like :search "
                    + "or lower(coalesce(c.invoiceNumber,'')) like :search)");
            params.put("search", "%" + clean(search).toLowerCase(Locale.ROOT) + "%");
        }
        jpql.append(" order by c.costDate desc, c.createdAt desc");
        TypedQuery<MaintenanceCost> query = em.createQuery(jpql.toString(), MaintenanceCost.class);
        params.forEach(query::setParameter);
        return query.setMaxResults(Math.max(1, maxRows)).getResultList();
    }

    private Map<String, Object> maintenanceCostSummaryFromRows(
            List<MaintenanceCost> rows,
            LocalDate start,
            LocalDate end,
            ServiceDomain requestedDomain,
            Set<ServiceDomain> domains) {
        List<MaintenanceCost> verified = rows.stream().filter(c -> c.status == CostStatus.VERIFIED).toList();
        List<MaintenanceCost> draft = rows.stream().filter(c -> c.status == CostStatus.DRAFT).toList();
        BigDecimal total = sumMaintenanceCosts(verified);
        BigDecimal pending = sumMaintenanceCosts(draft);
        EnumMap<CostBucket, BigDecimal> byBucket = new EnumMap<>(CostBucket.class);
        for (CostBucket bucket : CostBucket.values()) byBucket.put(bucket, BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        for (MaintenanceCost c : verified) byBucket.merge(c.costBucket, money(c.amount), BigDecimal::add);

        Map<YearMonth, List<MaintenanceCost>> monthGroups = rows.stream()
                .collect(Collectors.groupingBy(c -> YearMonth.from(c.costDate)));
        List<Map<String, Object>> monthly = monthGroups.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> {
                    List<MaintenanceCost> monthRows = entry.getValue();
                    List<MaintenanceCost> monthVerified = monthRows.stream().filter(c -> c.status == CostStatus.VERIFIED).toList();
                    return map(
                            "month", entry.getKey().toString(),
                            "materialCost", sumMaintenanceCosts(monthVerified.stream().filter(c -> c.costBucket == CostBucket.MATERIAL).toList()),
                            "laborCost", sumMaintenanceCosts(monthVerified.stream().filter(c -> c.costBucket == CostBucket.INTERNAL_LABOUR).toList()),
                            "externalCost", sumMaintenanceCosts(monthVerified.stream().filter(c -> c.costBucket == CostBucket.EXTERNAL_SERVICE).toList()),
                            "otherCost", sumMaintenanceCosts(monthVerified.stream().filter(c -> c.costBucket == CostBucket.OTHER).toList()),
                            "totalCost", sumMaintenanceCosts(monthVerified),
                            "pendingCost", sumMaintenanceCosts(monthRows.stream().filter(c -> c.status == CostStatus.DRAFT).toList()),
                            "entries", monthVerified.size()
                    );
                })
                .toList();

        List<Map<String, Object>> byPlant = verified.stream()
                .collect(Collectors.groupingBy(c -> c.plantCode))
                .entrySet().stream()
                .map(e -> map("plantCode", e.getKey(), "cost", sumMaintenanceCosts(e.getValue()), "entries", e.getValue().size()))
                .sorted(Comparator.comparing((Map<String, Object> o) -> (BigDecimal) o.get("cost"), Comparator.reverseOrder()))
                .toList();

        List<Map<String, Object>> byEquipment = verified.stream()
                .filter(c -> c.equipmentId != null || notBlank(c.equipmentName) || notBlank(c.legacyMachineName))
                .collect(Collectors.groupingBy(this::equipmentCostKey, LinkedHashMap::new, Collectors.toList()))
                .values().stream()
                .map(list -> {
                    MaintenanceCost first = list.get(0);
                    return map(
                            "equipmentId", first.equipmentId,
                            "equipmentCode", first.equipmentCode,
                            "name", firstNonBlank(first.equipmentName, first.legacyMachineName, "General / Unmapped"),
                            "plantCode", first.plantCode,
                            "serviceDomain", domainOf(first).name(),
                            "cost", sumMaintenanceCosts(list),
                            "entries", list.size()
                    );
                })
                .sorted(Comparator.comparing((Map<String, Object> o) -> (BigDecimal) o.get("cost"), Comparator.reverseOrder()))
                .limit(25)
                .toList();

        List<Map<String, Object>> byCategory = verified.stream()
                .collect(Collectors.groupingBy(c -> c.expenseCategory))
                .entrySet().stream()
                .map(e -> map("category", e.getKey().name(), "cost", sumMaintenanceCosts(e.getValue()), "entries", e.getValue().size()))
                .sorted(Comparator.comparing((Map<String, Object> o) -> (BigDecimal) o.get("cost"), Comparator.reverseOrder()))
                .toList();

        List<Map<String, Object>> byServiceDomain = new ArrayList<>();
        for (ServiceDomain domain : ServiceDomain.values()) {
            if (!domains.contains(domain)) continue;
            List<MaintenanceCost> list = verified.stream().filter(c -> domainOf(c) == domain).toList();
            byServiceDomain.add(map(
                    "serviceDomain", domain.name(),
                    "label", humanDomain(domain),
                    "cost", sumMaintenanceCosts(list),
                    "entries", list.size()
            ));
        }

        long workOrderCount = verified.stream().map(c -> c.workOrderId).filter(Objects::nonNull).distinct().count();
        List<Map<String, Object>> topExpenses = verified.stream()
                .sorted(Comparator.comparing((MaintenanceCost c) -> money(c.amount)).reversed())
                .limit(12)
                .map(this::maintenanceCostView)
                .toList();

        return map(
                "from", start,
                "to", end,
                "scope", requestedDomain == null && domains.size() > 1 ? "ALL" : domains.iterator().next().name(),
                "summary", map(
                        "totalCost", total,
                        "pendingCost", pending,
                        "materialCost", byBucket.get(CostBucket.MATERIAL),
                        "laborCost", byBucket.get(CostBucket.INTERNAL_LABOUR),
                        "externalCost", byBucket.get(CostBucket.EXTERNAL_SERVICE),
                        "otherCost", byBucket.get(CostBucket.OTHER),
                        "verifiedEntries", verified.size(),
                        "pendingEntries", draft.size(),
                        "workOrders", workOrderCount,
                        "costPerWorkOrder", workOrderCount == 0 ? BigDecimal.ZERO.setScale(2) : total.divide(BigDecimal.valueOf(workOrderCount), 2, RoundingMode.HALF_UP)
                ),
                "monthly", monthly,
                "byPlant", byPlant,
                "byEquipment", byEquipment,
                "byCategory", byCategory,
                "byServiceDomain", byServiceDomain,
                "topExpenses", topExpenses
        );
    }

    private BigDecimal sumMaintenanceCosts(List<MaintenanceCost> rows) {
        return rows.stream().map(c -> money(c.amount)).reduce(BigDecimal.ZERO.setScale(2), BigDecimal::add);
    }

    private String equipmentCostKey(MaintenanceCost c) {
        if (c.equipmentId != null) return "ID:" + c.equipmentId;
        return "SNAP:" + normalizePlant(c.plantCode) + "|" + clean(firstNonBlank(c.equipmentCode, c.equipmentName, c.legacyMachineName)).toUpperCase(Locale.ROOT);
    }

    private String equipmentWorkKey(WorkOrder w) {
        if (w.equipmentId != null) return "ID:" + w.equipmentId;
        return "SNAP:" + normalizePlant(w.plantCode) + "|" + clean(firstNonBlank(w.equipmentCode, w.equipmentName)).toUpperCase(Locale.ROOT);
    }

    private CostBucket normalizeCostBucket(CostBucket bucket) {
        return bucket == null ? CostBucket.MATERIAL : bucket;
    }

    private ExpenseCategory defaultExpenseCategory(CostBucket bucket) {
        return switch (normalizeCostBucket(bucket)) {
            case MATERIAL -> ExpenseCategory.SPARE_PART;
            case INTERNAL_LABOUR -> ExpenseCategory.OTHER;
            case EXTERNAL_SERVICE -> ExpenseCategory.REPAIR_SERVICE;
            case OTHER -> ExpenseCategory.OTHER;
        };
    }

    private String defaultUom(CostBucket bucket) {
        return bucket == CostBucket.INTERNAL_LABOUR ? "HR" : "NOS";
    }

    private BigDecimal positiveQuantity(BigDecimal quantity) {
        BigDecimal q = quantity == null ? BigDecimal.ONE : quantity;
        require(q.compareTo(BigDecimal.ZERO) > 0, "Cost quantity must be greater than zero");
        return q.setScale(3, RoundingMode.HALF_UP);
    }

    private BigDecimal resolveCostAmount(BigDecimal quantity, BigDecimal unitRate, BigDecimal suppliedAmount) {
        if (suppliedAmount != null) return money(suppliedAmount);
        require(unitRate != null, "Amount or unit rate is required");
        return money(quantity.multiply(unitRate));
    }

    private boolean hasActiveCostLedgerRows(UUID workOrderId) {
        if (workOrderId == null) return false;
        Long count = em.createQuery(
                        "select count(c) from AssetFlowMaintenanceCost c where c.workOrderId=:id and c.status<>:voidStatus",
                        Long.class)
                .setParameter("id", workOrderId)
                .setParameter("voidStatus", CostStatus.VOID)
                .getSingleResult();
        return count != null && count > 0;
    }

    private List<MaintenanceCost> activeWorkOrderCosts(UUID workOrderId) {
        if (workOrderId == null) return List.of();
        return em.createQuery(
                        "select c from AssetFlowMaintenanceCost c where c.workOrderId=:id and c.status<>:voidStatus order by c.costDate, c.createdAt",
                        MaintenanceCost.class)
                .setParameter("id", workOrderId)
                .setParameter("voidStatus", CostStatus.VOID)
                .setMaxResults(1000)
                .getResultList();
    }

    private void replaceWorkOrderCostLines(WorkOrder w, List<MaintenanceCostLineUpsert> lines, String actor) {
        require(w != null, "Work order is required for cost lines");
        List<MaintenanceCost> existing = em.createQuery(
                        "select c from AssetFlowMaintenanceCost c where c.workOrderId=:id and c.status<>:voidStatus "
                                + "and c.source in :sources",
                        MaintenanceCost.class)
                .setParameter("id", w.id)
                .setParameter("voidStatus", CostStatus.VOID)
                .setParameter("sources", Set.of(CostSource.WORK_ORDER, CostSource.LEGACY_WORK_ORDER_SUMMARY))
                .getResultList();
        LocalDateTime now = LocalDateTime.now();
        for (MaintenanceCost c : existing) {
            c.status = CostStatus.VOID;
            c.voidReason = "Replaced by work-order repair cost breakdown";
            c.voidedBy = actor;
            c.voidedAt = now;
            c.updatedBy = actor;
            c.updatedAt = now;
        }

        int index = 0;
        for (MaintenanceCostLineUpsert line : lines) {
            if (line == null) continue;
            index++;
            CostBucket bucket = normalizeCostBucket(line.costBucket());
            String description = clean(line.description());
            require(notBlank(description), "Cost line " + index + " description is required");
            BigDecimal qty = positiveQuantity(line.quantity());
            BigDecimal rate = line.unitRate() == null ? null : money(line.unitRate());
            BigDecimal amount = resolveCostAmount(qty, rate, line.amount());
            require(amount.compareTo(BigDecimal.ZERO) > 0, "Cost line " + index + " amount must be greater than zero");

            MaintenanceCost c = new MaintenanceCost();
            hydrateCostFromWorkOrder(c, w);
            c.costDate = line.costDate() == null ? LocalDate.now() : line.costDate();
            c.costBucket = bucket;
            c.expenseCategory = line.expenseCategory() == null ? defaultExpenseCategory(bucket) : line.expenseCategory();
            c.description = description;
            c.quantity = qty;
            c.uom = firstNonBlank(line.uom(), defaultUom(bucket));
            c.unitRate = rate;
            c.amount = amount;
            c.vendorName = clean(line.vendorName());
            c.poNumber = clean(line.poNumber());
            c.invoiceNumber = clean(line.invoiceNumber());
            c.remarks = clean(line.remarks());
            c.status = CostStatus.DRAFT;
            c.source = CostSource.WORK_ORDER;
            c.createdBy = actor;
            c.createdAt = now;
            c.updatedBy = actor;
            c.updatedAt = now;
            em.persist(c);
        }
    }

    private void upsertLegacyWorkOrderCostSummary(WorkOrder w, StatusChange request, String actor) {
        List<MaintenanceCost> detailed = em.createQuery(
                        "select c from AssetFlowMaintenanceCost c where c.workOrderId=:id and c.status<>:voidStatus "
                                + "and c.source<>:legacySource",
                        MaintenanceCost.class)
                .setParameter("id", w.id)
                .setParameter("voidStatus", CostStatus.VOID)
                .setParameter("legacySource", CostSource.LEGACY_WORK_ORDER_SUMMARY)
                .setMaxResults(1)
                .getResultList();
        if (!detailed.isEmpty()) return;

        List<MaintenanceCost> legacy = em.createQuery(
                        "select c from AssetFlowMaintenanceCost c where c.workOrderId=:id and c.status<>:voidStatus and c.source=:source",
                        MaintenanceCost.class)
                .setParameter("id", w.id)
                .setParameter("voidStatus", CostStatus.VOID)
                .setParameter("source", CostSource.LEGACY_WORK_ORDER_SUMMARY)
                .getResultList();
        LocalDateTime now = LocalDateTime.now();
        for (MaintenanceCost c : legacy) {
            c.status = CostStatus.VOID;
            c.voidReason = "Legacy work-order totals refreshed";
            c.voidedBy = actor;
            c.voidedAt = now;
            c.updatedBy = actor;
            c.updatedAt = now;
        }
        createLegacySummaryLine(w, CostBucket.MATERIAL, ExpenseCategory.SPARE_PART,
                "Work-order parts / consumables summary", request.partsCost(), actor, now);
        createLegacySummaryLine(w, CostBucket.INTERNAL_LABOUR, ExpenseCategory.OTHER,
                "Work-order labour summary", request.laborCost(), actor, now);
        createLegacySummaryLine(w, CostBucket.EXTERNAL_SERVICE, ExpenseCategory.REPAIR_SERVICE,
                "Work-order external / vendor summary", request.externalCost(), actor, now);
    }

    /**
     * One-time/lazy compatibility bridge for work orders created before the detailed
     * maintenance-cost ledger existed. It does not change workflow state or totals;
     * it only snapshots the already-stored scalar costs into dated ledger rows.
     */
    private void backfillLegacyWorkOrderCosts(
            Set<String> plants, Set<ServiceDomain> domains, LocalDate from, LocalDate to) {
        if (plants == null || plants.isEmpty() || domains == null || domains.isEmpty()) return;
        BigDecimal zero = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        List<WorkOrder> candidates = em.createQuery(
                        "select w from AssetFlowWorkOrder w where w.plantCode in :plants "
                                + "and (w.partsCost>:zero or w.laborCost>:zero or w.externalCost>:zero)",
                        WorkOrder.class)
                .setParameter("plants", plants)
                .setParameter("zero", zero)
                .setMaxResults(MAX_EQUIPMENT_ROWS)
                .getResultList();

        for (WorkOrder w : candidates) {
            if (!domains.contains(domainOf(w))) continue;
            LocalDateTime source = w.repairedAt != null ? w.repairedAt
                    : w.closedAt != null ? w.closedAt
                    : w.updatedAt != null ? w.updatedAt
                    : w.createdAt;
            LocalDate date = source == null ? LocalDate.now() : source.toLocalDate();
            if (from != null && date.isBefore(from)) continue;
            if (to != null && date.isAfter(to)) continue;
            ensureLegacyWorkOrderSummaryLedger(w, "SYSTEM_LEGACY_COST_MIGRATION");
        }
        // Subsequent ledger queries in the same transaction must see newly persisted rows.
        em.flush();
    }

    private void ensureLegacyWorkOrderSummaryLedger(WorkOrder w, String actor) {
        if (w == null || hasActiveCostLedgerRows(w.id) || totalCost(w).compareTo(BigDecimal.ZERO) <= 0) return;
        LocalDateTime now = LocalDateTime.now();
        CostStatus status = (w.status == WorkStatus.CLOSED || w.status == WorkStatus.REPAIRED)
                ? CostStatus.VERIFIED
                : CostStatus.DRAFT;
        createLegacySummaryLine(w, CostBucket.MATERIAL, ExpenseCategory.SPARE_PART,
                "Migrated legacy parts / consumables total", w.partsCost, actor, now, status);
        createLegacySummaryLine(w, CostBucket.INTERNAL_LABOUR, ExpenseCategory.OTHER,
                "Migrated legacy labour total", w.laborCost, actor, now, status);
        createLegacySummaryLine(w, CostBucket.EXTERNAL_SERVICE, ExpenseCategory.REPAIR_SERVICE,
                "Migrated legacy external / vendor total", w.externalCost, actor, now, status);
    }

    private void createLegacySummaryLine(
            WorkOrder w, CostBucket bucket, ExpenseCategory category, String description,
            BigDecimal amount, String actor, LocalDateTime now) {
        createLegacySummaryLine(w, bucket, category, description, amount, actor, now, CostStatus.DRAFT);
    }

    private void createLegacySummaryLine(
            WorkOrder w, CostBucket bucket, ExpenseCategory category, String description,
            BigDecimal amount, String actor, LocalDateTime now, CostStatus status) {
        BigDecimal value = money(amount);
        if (value.compareTo(BigDecimal.ZERO) <= 0) return;
        MaintenanceCost c = new MaintenanceCost();
        hydrateCostFromWorkOrder(c, w);
        LocalDateTime sourceDate = w.repairedAt != null ? w.repairedAt : w.closedAt != null ? w.closedAt : w.updatedAt;
        c.costDate = sourceDate == null ? LocalDate.now() : sourceDate.toLocalDate();
        c.costBucket = bucket;
        c.expenseCategory = category;
        c.description = description;
        c.quantity = BigDecimal.ONE.setScale(3);
        c.uom = bucket == CostBucket.INTERNAL_LABOUR ? "JOB" : "LOT";
        c.amount = value;
        c.status = status;
        c.source = CostSource.LEGACY_WORK_ORDER_SUMMARY;
        c.createdBy = actor;
        c.createdAt = now;
        c.updatedBy = actor;
        c.updatedAt = now;
        if (status == CostStatus.VERIFIED) {
            c.verifiedBy = actor;
            c.verifiedAt = now;
        }
        em.persist(c);
    }

    private void hydrateCostFromWorkOrder(MaintenanceCost c, WorkOrder w) {
        c.workOrderId = w.id;
        c.workNumber = w.workNumber;
        c.serviceDomain = domainOf(w);
        c.plantCode = normalizePlant(w.plantCode);
        c.equipmentId = w.equipmentId;
        c.equipmentCode = w.equipmentCode;
        c.equipmentName = w.equipmentName;
    }

    private void verifyWorkOrderCostLines(WorkOrder w, String actor) {
        if (w == null) return;
        ensureLegacyWorkOrderSummaryLedger(w, actor);
        LocalDateTime now = LocalDateTime.now();
        List<MaintenanceCost> draft = em.createQuery(
                        "select c from AssetFlowMaintenanceCost c where c.workOrderId=:id and c.status=:status",
                        MaintenanceCost.class)
                .setParameter("id", w.id)
                .setParameter("status", CostStatus.DRAFT)
                .getResultList();
        for (MaintenanceCost c : draft) {
            c.status = CostStatus.VERIFIED;
            c.verifiedBy = actor;
            c.verifiedAt = now;
            c.updatedBy = actor;
            c.updatedAt = now;
        }
    }

    private void recalculateWorkOrderCostTotals(WorkOrder w) {
        if (w == null) return;
        List<MaintenanceCost> rows = activeWorkOrderCosts(w.id);
        if (rows.isEmpty()) return;
        w.partsCost = sumMaintenanceCosts(rows.stream().filter(c -> c.costBucket == CostBucket.MATERIAL).toList());
        w.laborCost = sumMaintenanceCosts(rows.stream().filter(c -> c.costBucket == CostBucket.INTERNAL_LABOUR).toList());
        w.externalCost = sumMaintenanceCosts(rows.stream()
                .filter(c -> c.costBucket == CostBucket.EXTERNAL_SERVICE || c.costBucket == CostBucket.OTHER)
                .toList());
    }

    private Map<String, Object> maintenanceCostView(MaintenanceCost c) {
        return map(
                "id", c.id,
                "costDate", c.costDate,
                "month", c.costDate == null ? null : YearMonth.from(c.costDate).toString(),
                "serviceDomain", domainOf(c).name(),
                "plantCode", c.plantCode,
                "equipmentId", c.equipmentId,
                "equipmentCode", c.equipmentCode,
                "equipmentName", c.equipmentName,
                "workOrderId", c.workOrderId,
                "workNumber", c.workNumber,
                "costBucket", c.costBucket == null ? CostBucket.MATERIAL.name() : c.costBucket.name(),
                "expenseCategory", c.expenseCategory == null ? defaultExpenseCategory(c.costBucket).name() : c.expenseCategory.name(),
                "description", c.description,
                "quantity", c.quantity,
                "uom", c.uom,
                "unitRate", c.unitRate,
                "amount", money(c.amount),
                "vendorName", c.vendorName,
                "poNumber", c.poNumber,
                "invoiceNumber", c.invoiceNumber,
                "legacyMachineSerial", c.legacyMachineSerial,
                "legacyMachineName", c.legacyMachineName,
                "remarks", c.remarks,
                "status", c.status == null ? CostStatus.DRAFT.name() : c.status.name(),
                "source", c.source == null ? CostSource.DIRECT_ENTRY.name() : c.source.name(),
                "importBatchId", c.importBatchId,
                "legacyRowNumber", c.legacyRowNumber,
                "createdBy", c.createdBy,
                "createdAt", c.createdAt,
                "updatedBy", c.updatedBy,
                "updatedAt", c.updatedAt,
                "verifiedBy", c.verifiedBy,
                "verifiedAt", c.verifiedAt,
                "voidedBy", c.voidedBy,
                "voidedAt", c.voidedAt,
                "voidReason", c.voidReason,
                "version", c.version
        );
    }


    private List<Map<String, String>> readMaintenanceCostWorkbook(byte[] workbookBytes) throws IOException {
        require(workbookBytes != null && workbookBytes.length > 0, "Maintenance Costing workbook is empty");
        Map<String, byte[]> zip = new LinkedHashMap<>();
        long expanded = 0;
        try (ZipInputStream zin = new ZipInputStream(new ByteArrayInputStream(workbookBytes))) {
            ZipEntry entry;
            while ((entry = zin.getNextEntry()) != null) {
                if (entry.isDirectory()) continue;
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buffer = new byte[8192];
                int read;
                while ((read = zin.read(buffer)) >= 0) {
                    out.write(buffer, 0, read);
                    expanded += read;
                    if (expanded > 40L * 1024L * 1024L) throw new IOException("Workbook expands beyond the safe 40 MB limit");
                }
                zip.put(entry.getName(), out.toByteArray());
            }
        }
        require(zip.keySet().stream().anyMatch(name -> name.startsWith("xl/worksheets/")), "File is not a readable XLSX workbook");

        List<String> sharedStrings = parseSharedStrings(zip.get("xl/sharedStrings.xml"));
        List<String> sheetNames = zip.keySet().stream()
                .filter(name -> name.startsWith("xl/worksheets/sheet") && name.endsWith(".xml"))
                .sorted()
                .toList();
        for (String sheetName : sheetNames) {
            List<Map<String, String>> rows = parseMaintenanceSheet(zip.get(sheetName), sharedStrings);
            if (!rows.isEmpty()) return rows;
        }
        return List.of();
    }

    private List<String> parseSharedStrings(byte[] xml) throws IOException {
        if (xml == null || xml.length == 0) return List.of();
        Document doc = parseXml(xml);
        NodeList items = doc.getElementsByTagName("si");
        List<String> strings = new ArrayList<>(items.getLength());
        for (int i = 0; i < items.getLength(); i++) {
            Node si = items.item(i);
            NodeList texts = ((Element) si).getElementsByTagName("t");
            StringBuilder value = new StringBuilder();
            for (int j = 0; j < texts.getLength(); j++) value.append(texts.item(j).getTextContent());
            strings.add(value.toString());
        }
        return strings;
    }

    private List<Map<String, String>> parseMaintenanceSheet(byte[] xml, List<String> sharedStrings) throws IOException {
        if (xml == null || xml.length == 0) return List.of();
        Document doc = parseXml(xml);
        NodeList rowNodes = doc.getElementsByTagName("row");
        Map<String, String> columns = null;
        int headerRow = -1;

        for (int i = 0; i < Math.min(rowNodes.getLength(), 25); i++) {
            Element row = (Element) rowNodes.item(i);
            Map<String, String> cells = readXlsxRow(row, sharedStrings);
            Map<String, String> candidate = identifyMaintenanceColumns(cells);
            if (candidate.keySet().containsAll(Set.of("DATE", "PLANT", "DESCRIPTION", "COST"))) {
                columns = candidate;
                headerRow = parseInt(row.getAttribute("r"), i + 1);
                break;
            }
        }
        if (columns == null) return List.of();

        List<Map<String, String>> out = new ArrayList<>();
        int trailingTemplateYearRows = 0;
        for (int i = 0; i < rowNodes.getLength() && out.size() < MAX_COST_IMPORT_ROWS; i++) {
            Element row = (Element) rowNodes.item(i);
            int rowNumber = parseInt(row.getAttribute("r"), i + 1);
            if (rowNumber <= headerRow) continue;
            Map<String, String> cells = readXlsxRow(row, sharedStrings);
            LinkedHashMap<String, String> item = new LinkedHashMap<>();
            item.put("_ROW", String.valueOf(rowNumber));
            for (String field : List.of("DATE", "MONTH", "PLANT", "MACHINE", "DESCRIPTION", "PO", "SERIAL", "COST")) {
                String column = columns.get(field);
                item.put(field, column == null ? "" : cells.getOrDefault(column, ""));
            }

            boolean blank = item.entrySet().stream()
                    .filter(e -> !"_ROW".equals(e.getKey()))
                    .allMatch(e -> !notBlank(e.getValue()));
            if (blank) continue;

            boolean emptyYearTemplate = "YEAR".equalsIgnoreCase(clean(item.get("MONTH")))
                    && List.of("DATE", "PLANT", "MACHINE", "DESCRIPTION", "PO", "SERIAL", "COST").stream()
                    .allMatch(field -> !notBlank(item.get(field)));
            if (emptyYearTemplate) {
                trailingTemplateYearRows++;
                // The source workbook carries thousands of formatted YEAR template rows.
                // They are layout artifacts, not transactions; do not flood the preview.
                if (trailingTemplateYearRows >= 50) break;
                continue;
            }

            trailingTemplateYearRows = 0;
            out.add(item);
        }
        return out;
    }

    private Map<String, String> identifyMaintenanceColumns(Map<String, String> cells) {
        Map<String, String> out = new LinkedHashMap<>();
        for (Map.Entry<String, String> entry : cells.entrySet()) {
            String header = canonicalHeader(entry.getValue());
            if (!notBlank(header)) continue;
            if (header.equals("DATE")) out.put("DATE", entry.getKey());
            else if (header.equals("MONTH")) out.put("MONTH", entry.getKey());
            else if (header.equals("PLANT") || header.equals("PLANTCODE")) out.put("PLANT", entry.getKey());
            else if (header.equals("MACHINE") || header.equals("ASSET") || header.equals("EQUIPMENT")) out.put("MACHINE", entry.getKey());
            else if (header.contains("SPARESDESCRIPTION") || header.equals("DESCRIPTION") || header.contains("SPAREDESCRIPTION")) out.put("DESCRIPTION", entry.getKey());
            else if (header.equals("PONUMBER") || header.equals("PONO") || header.equals("PO")) out.put("PO", entry.getKey());
            else if (header.contains("MCSRNO") || header.contains("MACHINESRNO") || header.contains("SERIALNO")) out.put("SERIAL", entry.getKey());
            else if (header.equals("COST") || header.equals("AMOUNT") || header.equals("TOTALCOST")) out.put("COST", entry.getKey());
        }
        return out;
    }

    private Map<String, String> readXlsxRow(Element row, List<String> sharedStrings) {
        Map<String, String> cells = new LinkedHashMap<>();
        NodeList cellNodes = row.getElementsByTagName("c");
        for (int i = 0; i < cellNodes.getLength(); i++) {
            Element cell = (Element) cellNodes.item(i);
            String ref = cell.getAttribute("r");
            String column = ref.replaceAll("[^A-Za-z]", "").toUpperCase(Locale.ROOT);
            if (!notBlank(column)) continue;
            cells.put(column, xlsxCellText(cell, sharedStrings));
        }
        return cells;
    }

    private String xlsxCellText(Element cell, List<String> sharedStrings) {
        String type = cell.getAttribute("t");
        if ("inlineStr".equals(type)) {
            NodeList texts = cell.getElementsByTagName("t");
            StringBuilder out = new StringBuilder();
            for (int i = 0; i < texts.getLength(); i++) out.append(texts.item(i).getTextContent());
            return out.toString().trim();
        }
        NodeList values = cell.getElementsByTagName("v");
        if (values.getLength() == 0) return "";
        String value = values.item(0).getTextContent();
        if ("s".equals(type)) {
            int index = parseInt(value, -1);
            return index >= 0 && index < sharedStrings.size() ? sharedStrings.get(index).trim() : "";
        }
        return value == null ? "" : value.trim();
    }

    private Document parseXml(byte[] xml) throws IOException {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(false);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            try { factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, ""); } catch (IllegalArgumentException ignored) { }
            try { factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, ""); } catch (IllegalArgumentException ignored) { }
            try (InputStream in = new ByteArrayInputStream(xml)) {
                return factory.newDocumentBuilder().parse(in);
            }
        } catch (Exception ex) {
            throw new IOException("Invalid XLSX XML", ex);
        }
    }

    private LocalDate parseLegacyCostDate(String raw) {
        if (!notBlank(raw)) return null;
        String text = clean(raw).replace("Febuary", "February").replace("FEBUARY", "FEBRUARY");
        try {
            BigDecimal serial = new BigDecimal(text);
            long wholeDays = serial.longValue();
            if (wholeDays > 0 && wholeDays < 100000) return LocalDate.of(1899, 12, 30).plusDays(wholeDays);
        } catch (NumberFormatException ignored) { }
        for (DateTimeFormatter formatter : List.of(
                DateTimeFormatter.ISO_LOCAL_DATE,
                DateTimeFormatter.ofPattern("d/M/uuuu"),
                DateTimeFormatter.ofPattern("d-M-uuuu"),
                DateTimeFormatter.ofPattern("d.M.uuuu"),
                DateTimeFormatter.ofPattern("d MMM uuuu", Locale.ENGLISH),
                DateTimeFormatter.ofPattern("d MMMM uuuu", Locale.ENGLISH))) {
            try { return LocalDate.parse(text, formatter); } catch (Exception ignored) { }
        }
        return null;
    }

    private BigDecimal parseLegacyMoney(String raw) {
        if (!notBlank(raw)) return null;
        String cleaned = raw.replaceAll("[^0-9.\\-]", "");
        if (!notBlank(cleaned) || "-".equals(cleaned)) return null;
        try { return money(new BigDecimal(cleaned)); } catch (NumberFormatException ex) { return null; }
    }

    private int parseInt(String value, int fallback) {
        try { return Integer.parseInt(String.valueOf(value).trim()); } catch (Exception ex) { return fallback; }
    }

    private String canonicalHeader(String value) {
        return notBlank(value) ? value.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "") : "";
    }

    private String resolveLegacyPlant(String rawPlant, Set<String> allowedPlants) {
        if (!notBlank(rawPlant) || allowedPlants == null || allowedPlants.isEmpty()) return null;
        String exact = normalizePlant(rawPlant);
        if (allowedPlants.contains(exact)) return exact;
        String key = plantMatchKey(rawPlant);
        List<String> matches = allowedPlants.stream().filter(p -> plantMatchKey(p).equals(key)).toList();
        return matches.size() == 1 ? matches.get(0) : null;
    }

    private String plantMatchKey(String value) {
        String key = clean(value).toUpperCase(Locale.ROOT).replace("WRIVER", "WR").replaceAll("[^A-Z0-9]", "");
        return key.replaceAll("([A-Z])0+(\\d)", "$1$2");
    }

    private String machineMatchKey(String value) {
        return notBlank(value) ? clean(value).toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "") : "";
    }

    private Equipment resolveLegacyEquipment(
            String rawMachine,
            String rawSerial,
            String plant,
            Map<String, Equipment> bySerial,
            Map<String, List<Equipment>> byName) {
        if (notBlank(rawSerial)) {
            Equipment serial = bySerial.get(clean(rawSerial).toUpperCase(Locale.ROOT));
            if (serial != null && (!notBlank(plant) || normalizePlant(serial.plantCode).equals(plant))) return serial;
        }
        if (!notBlank(rawMachine)) return null;
        List<Equipment> candidates = byName.getOrDefault(machineMatchKey(rawMachine), List.of()).stream()
                .filter(e -> !notBlank(plant) || normalizePlant(e.plantCode).equals(plant))
                .toList();
        return candidates.size() == 1 ? candidates.get(0) : null;
    }

    private CostBucket inferLegacyCostBucket(String description) {
        String text = notBlank(description) ? clean(description).toUpperCase(Locale.ROOT) : "";
        if (text.matches(".*(LABOUR|LABOR|MANPOWER|TECHNICIAN CHARGE|SERVICE ENGINEER).*")) return CostBucket.INTERNAL_LABOUR;
        if (text.matches(".*(SERVICE|REPAIR|REWIND|INSTALL|CALIBRAT|AMC|GAS CHARG|COATING|EARTHING|WORK CHARGE|VENDOR).*")) return CostBucket.EXTERNAL_SERVICE;
        if (text.matches(".*(BILL|UTILITY|PNG|ELECTRICITY).*")) return CostBucket.OTHER;
        return CostBucket.MATERIAL;
    }

    private ExpenseCategory inferLegacyExpenseCategory(String description, CostBucket bucket) {
        String text = notBlank(description) ? clean(description).toUpperCase(Locale.ROOT) : "";
        if (text.contains("AMC")) return ExpenseCategory.AMC;
        if (text.contains("CALIBRAT")) return ExpenseCategory.CALIBRATION;
        if (text.contains("INSTALL")) return ExpenseCategory.INSTALLATION;
        if (text.matches(".*(ELECTRIC|CABLE|EARTHING|MCB|CONTACTOR|RELAY).*")) return ExpenseCategory.ELECTRICAL;
        if (text.matches(".*(SOFTWARE|LICENSE|LICENCE).*")) return ExpenseCategory.SOFTWARE_LICENSE;
        if (text.matches(".*(LAPTOP|COMPUTER|PC |PRINTER|ROUTER|SWITCH|SSD|RAM|HDD).*")) return ExpenseCategory.IT_HARDWARE;
        if (bucket == CostBucket.EXTERNAL_SERVICE) return ExpenseCategory.REPAIR_SERVICE;
        if (bucket == CostBucket.MATERIAL && text.matches(".*(OIL|GREASE|CHEMICAL|GAS|FILTER|TAPE|CLEANER).*")) return ExpenseCategory.CONSUMABLE;
        if (bucket == CostBucket.MATERIAL) return ExpenseCategory.SPARE_PART;
        if (bucket == CostBucket.OTHER) return ExpenseCategory.FACILITY_UTILITY;
        return ExpenseCategory.OTHER;
    }

    private String costFingerprint(MaintenanceCost c) {
        return String.join("|",
                String.valueOf(c.costDate),
                normalizePlant(c.plantCode),
                c.equipmentId == null ? machineMatchKey(firstNonBlank(c.equipmentCode, c.equipmentName, c.legacyMachineName)) : c.equipmentId.toString(),
                machineMatchKey(c.description),
                money(c.amount).toPlainString(),
                machineMatchKey(c.poNumber));
    }

    private String previewFingerprint(Map<String, Object> row) {
        Object equipmentId = row.get("equipmentId");
        String equipmentCode = row.get("equipmentCode") == null ? null : String.valueOf(row.get("equipmentCode"));
        String equipmentName = row.get("equipmentName") == null ? null : String.valueOf(row.get("equipmentName"));
        String legacyMachineName = row.get("legacyMachineName") == null ? null : String.valueOf(row.get("legacyMachineName"));
        String equipmentKey = equipmentId == null
                ? machineMatchKey(firstNonBlank(equipmentCode, equipmentName, legacyMachineName))
                : String.valueOf(equipmentId);
        BigDecimal amount = row.get("amount") instanceof BigDecimal bd ? bd
                : parseLegacyMoney(row.get("amount") == null ? null : String.valueOf(row.get("amount")));
        return String.join("|",
                String.valueOf(row.get("costDate")),
                normalizePlant(row.get("plantCode") == null ? null : String.valueOf(row.get("plantCode"))),
                equipmentKey,
                machineMatchKey(row.get("description") == null ? null : String.valueOf(row.get("description"))),
                money(amount).toPlainString(),
                machineMatchKey(row.get("poNumber") == null ? null : String.valueOf(row.get("poNumber"))));
    }

    private boolean maintenanceCostDuplicateExists(MaintenanceCost candidate) {
        List<MaintenanceCost> possible = em.createQuery(
                        "select c from AssetFlowMaintenanceCost c where c.costDate=:date and c.plantCode=:plant and c.amount=:amount and c.status<>:voidStatus",
                        MaintenanceCost.class)
                .setParameter("date", candidate.costDate)
                .setParameter("plant", candidate.plantCode)
                .setParameter("amount", money(candidate.amount))
                .setParameter("voidStatus", CostStatus.VOID)
                .setMaxResults(100)
                .getResultList();
        String fingerprint = costFingerprint(candidate);
        return possible.stream().map(this::costFingerprint).anyMatch(fingerprint::equals);
    }


    private WorkOrder requireOrder(UUID id, boolean lock) {
        require(id != null, "Work order ID is required");
        WorkOrder w = lock
                ? em.find(WorkOrder.class, id, LockModeType.PESSIMISTIC_WRITE)
                : em.find(WorkOrder.class, id);
        if (w == null) throw notFound("Work order not found");
        return w;
    }

    private Equipment requireEquipment(UUID id, boolean lock) {
        require(id != null, "Equipment ID is required");
        Equipment e = lock
                ? em.find(Equipment.class, id, LockModeType.PESSIMISTIC_WRITE)
                : em.find(Equipment.class, id);
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
                .limit(200)
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
        updateEquipmentNextMaintenance(w.equipmentId);
    }

    private void syncEquipmentState(UUID equipmentId) {
        if (equipmentId == null) return;
        Equipment e = em.find(Equipment.class, equipmentId, LockModeType.PESSIMISTIC_WRITE);
        if (e == null || e.status == EquipmentStatus.RETIRED) return;

        List<WorkOrder> active = em.createQuery(
                        "select w from AssetFlowWorkOrder w where w.equipmentId=:id and w.status not in :terminal order by w.createdAt desc",
                        WorkOrder.class)
                .setParameter("id", equipmentId)
                .setParameter("terminal", TERMINAL)
                .setMaxResults(10000)
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
                        LocalDate.class)
                .setParameter("id", equipmentId)
                .setMaxResults(1)
                .getResultList();
        e.nextMaintenanceAt = dates.isEmpty() ? null : dates.get(0).atTime(9, 0);
    }

    private Map<String, Object> equipmentHealth(Equipment e) {
        List<WorkOrder> recent = em.createQuery(
                        "select w from AssetFlowWorkOrder w where w.equipmentId=:id and w.createdAt>=:from order by w.createdAt desc",
                        WorkOrder.class)
                .setParameter("id", e.id)
                .setParameter("from", LocalDateTime.now().minusDays(90))
                .setMaxResults(10000)
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
        event.entityType = truncate(entityType, 60);
        event.entityId = entityId;
        event.action = truncate(action, 100);
        event.fromStatus = truncate(from, 60);
        event.toStatus = truncate(to, 60);
        event.actor = truncate(actor, 180);
        event.note = truncate(note, 30000);
        event.createdAt = LocalDateTime.now();
        em.persist(event);
    }

    private List<Map<String, Object>> listAudit(String entityType, UUID entityId) {
        return em.createQuery(
                        "select a from AssetFlowAuditEvent a where a.entityType=:type and a.entityId=:id order by a.createdAt desc",
                        AuditEvent.class)
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
        List<MaintenanceCost> activeCosts = activeWorkOrderCosts(w.id);
        out.put("costLines", activeCosts.stream().map(this::maintenanceCostView).toList());
        out.put("costLedgerStatus", activeCosts.isEmpty() ? "LEGACY_SUMMARY_ONLY" : "LEDGER");
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
        User current = currentUserService.requireCurrentUser();
        if (canViewReports(current)) {
            out.put("costEconomics", equipmentCostEconomics(e));
        }
        return out;
    }

    private Map<String, Object> equipmentCostEconomics(Equipment e) {
        LocalDate today = LocalDate.now();
        backfillLegacyWorkOrderCosts(Set.of(normalizePlant(e.plantCode)), Set.of(domainOf(e)), null, today);
        List<MaintenanceCost> rows = findMaintenanceCostEntities(
                Set.of(normalizePlant(e.plantCode)),
                Set.of(domainOf(e)),
                null,
                today,
                e.id,
                null,
                null,
                null,
                null,
                null,
                MAX_COST_SUMMARY_ROWS);
        List<MaintenanceCost> verified = rows.stream().filter(c -> c.status == CostStatus.VERIFIED).toList();
        List<MaintenanceCost> pending = rows.stream().filter(c -> c.status == CostStatus.DRAFT).toList();
        LocalDate yearStart = today.withDayOfYear(1);
        LocalDate last12Start = today.minusMonths(12).plusDays(1);
        return map(
                "ytd", sumMaintenanceCosts(verified.stream().filter(c -> !c.costDate.isBefore(yearStart)).toList()),
                "last12Months", sumMaintenanceCosts(verified.stream().filter(c -> !c.costDate.isBefore(last12Start)).toList()),
                "lifetime", sumMaintenanceCosts(verified),
                "pending", sumMaintenanceCosts(pending),
                "verifiedEntries", verified.size(),
                "recentCosts", rows.stream()
                        .filter(c -> c.status != CostStatus.VOID)
                        .sorted(Comparator.comparing((MaintenanceCost c) -> c.costDate).reversed().thenComparing(c -> c.createdAt, Comparator.reverseOrder()))
                        .limit(10)
                        .map(this::maintenanceCostView)
                        .toList()
        );
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
        validateReporterPin(pin);

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
                // Ignore legacy values after domain consolidation.
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
                .setMaxResults(MAX_TEAM_ROWS)
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
                .limit(100)
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

    private boolean canEditAssetMaster(User user, ServiceDomain domain) {
        if (user == null || domain == null) return false;
        if (currentUserService.isAdmin(user)) return true;
        if (domain == ServiceDomain.MACHINE) {
            return currentUserService.hasAnyRole(
                    user,
                    "ASSETFLOW_MACHINE_HEAD",
                    "ASSETFLOW_HEAD_TECHNICIAN");
        }
        return currentUserService.hasRole(user, "ASSETFLOW_IT_HEAD");
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
            throw forbidden("Maintenance request access is not assigned. Ask Admin to link your FlowSuite username to an AssetFlow Reporter profile.");
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
        if (w == null) return Set.of();
        Set<WorkStatus> base = TRANSITIONS.getOrDefault(w.status, Set.of());
        if (base.isEmpty() || user == null || isDirector(user)) return Set.of();

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
        if (w.startedAt != null && end != null) {
            return Math.toIntExact(Math.max(0, Duration.between(w.startedAt, end).toMinutes()));
        }
        return null;
    }

    private BigDecimal totalCost(WorkOrder w) {
        return money(w.partsCost).add(money(w.laborCost)).add(money(w.externalCost));
    }

    private BigDecimal money(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value)
                .max(BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);
    }

    private Integer nonNegative(Integer value, String field) {
        if (value == null) return null;
        require(value >= 0, field + " cannot be negative");
        return value;
    }

    /**
     * Mutating existing records must carry the version returned by the API.
     * This closes the old null-version bypass while retaining JPA @Version.
     */
    private void checkVersion(long current, Long supplied) {
        if (supplied == null) {
            throw badRequest("Record version is required. Refresh and retry.");
        }
        if (supplied < 0) {
            throw badRequest("Record version is invalid.");
        }
        if (supplied != current) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This record changed after you opened it. Refresh and retry.");
        }
    }

    private String actor(Authentication auth) {
        if (auth == null
                || !auth.isAuthenticated()
                || auth instanceof AnonymousAuthenticationToken
                || !notBlank(auth.getName())
                || "anonymousUser".equalsIgnoreCase(auth.getName())) {
            return "SYSTEM";
        }
        return truncate(auth.getName().trim(), 180);
    }

    private String boundedSearch(String value) {
        String cleaned = clean(value);
        if (cleaned == null) return "";
        if (cleaned.length() > 200) throw badRequest("Search text is too long");
        return cleaned.toLowerCase(Locale.ROOT);
    }

    private static String truncate(String value, int maxLength) {
        if (value == null) return null;
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
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

    private static String firstNonBlank(String first, String second, String third) {
        if (notBlank(first)) return clean(first);
        if (notBlank(second)) return clean(second);
        return clean(third);
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
