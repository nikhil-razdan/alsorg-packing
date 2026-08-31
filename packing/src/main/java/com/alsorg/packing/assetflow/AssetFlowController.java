package com.alsorg.packing.assetflow;

import com.alsorg.packing.assetflow.AssetFlowData.AssignmentRequest;
import com.alsorg.packing.assetflow.AssetFlowData.AuthenticatedRequestCreate;
import com.alsorg.packing.assetflow.AssetFlowData.EquipmentStatus;
import com.alsorg.packing.assetflow.AssetFlowData.EquipmentUpsert;
import com.alsorg.packing.assetflow.AssetFlowData.CostBucket;
import com.alsorg.packing.assetflow.AssetFlowData.CostStatus;
import com.alsorg.packing.assetflow.AssetFlowData.ExpenseCategory;
import com.alsorg.packing.assetflow.AssetFlowData.MaintenanceCostImportConfirm;
import com.alsorg.packing.assetflow.AssetFlowData.MaintenanceCostUpsert;
import com.alsorg.packing.assetflow.AssetFlowData.MaintenanceCostVoidRequest;
import com.alsorg.packing.assetflow.AssetFlowData.PreventivePlanUpsert;
import com.alsorg.packing.assetflow.AssetFlowData.Priority;
import com.alsorg.packing.assetflow.AssetFlowData.PublicRequestCreate;
import com.alsorg.packing.assetflow.AssetFlowData.ReporterLogin;
import com.alsorg.packing.assetflow.AssetFlowData.ReporterUpsert;
import com.alsorg.packing.assetflow.AssetFlowData.ServiceDomain;
import com.alsorg.packing.assetflow.AssetFlowData.StatusChange;
import com.alsorg.packing.assetflow.AssetFlowData.TeamUpsert;
import com.alsorg.packing.assetflow.AssetFlowData.WorkOrderUpsert;
import com.alsorg.packing.assetflow.AssetFlowData.WorkStatus;
import com.alsorg.packing.assetflow.AssetFlowData.WorkType;

import jakarta.validation.Valid;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/**
 * AssetFlow / ServiceFlow API.
 *
 * Public Reporter Pass endpoints are isolated under /api/assetflow/public/**.
 * Service-level plant/domain checks remain authoritative for authenticated
 * operations.
 */
@RestController
@Validated
@RequestMapping("/api/assetflow")
public class AssetFlowController {

    private static final String OPERATIONAL_READ =
            "hasAnyAuthority('ADMIN','ASSETFLOW_DIRECTOR','ASSETFLOW_MACHINE_HEAD','ASSETFLOW_MACHINE_TECHNICIAN',"
                    + "'ASSETFLOW_IT_HEAD','ASSETFLOW_IT_TECHNICIAN','ASSETFLOW_MANAGER','ASSETFLOW_PLANNER',"
                    + "'ASSETFLOW_HEAD_TECHNICIAN','ASSETFLOW_TECHNICIAN')";

    private static final String OPERATIONAL_COORDINATE =
            "hasAnyAuthority('ADMIN','ASSETFLOW_MACHINE_HEAD','ASSETFLOW_IT_HEAD','ASSETFLOW_MANAGER',"
                    + "'ASSETFLOW_PLANNER','ASSETFLOW_HEAD_TECHNICIAN')";

    private static final String ASSET_MASTER_UPDATE =
            "hasAnyAuthority('ADMIN','ASSETFLOW_MACHINE_HEAD','ASSETFLOW_IT_HEAD','ASSETFLOW_HEAD_TECHNICIAN')";

    private static final String REPORT_READ =
            "hasAnyAuthority('ADMIN','ASSETFLOW_DIRECTOR','ASSETFLOW_MACHINE_HEAD','ASSETFLOW_IT_HEAD',"
                    + "'ASSETFLOW_MANAGER','ASSETFLOW_PLANNER','ASSETFLOW_HEAD_TECHNICIAN')";

    private static final String COST_READ = REPORT_READ;

    private static final String COST_WRITE =
            "hasAnyAuthority('ADMIN','ASSETFLOW_MACHINE_HEAD','ASSETFLOW_IT_HEAD','ASSETFLOW_MANAGER',"
                    + "'ASSETFLOW_PLANNER','ASSETFLOW_HEAD_TECHNICIAN')";

    private final AssetFlowService service;

    public AssetFlowController(AssetFlowService service) {
        this.service = service;
    }

    /* ========================= CONTROLLED PUBLIC GATEWAY ========================= */

    @GetMapping("/public/context")
    public Map<String, Object> publicContext(
            @RequestParam(required = false) UUID asset,
            @RequestParam(required = false) UUID desk) {
        return service.publicContext(asset, desk);
    }

    @PostMapping("/public/authorise")
    public Map<String, Object> authoriseReporter(
            @Valid @RequestBody ReporterLogin request) {
        return service.authoriseReporter(request);
    }

    @PostMapping("/public/requests/mine")
    public List<Map<String, Object>> reporterRequests(
            @Valid @RequestBody ReporterLogin request) {
        return service.reporterRequests(request);
    }

    @PostMapping("/public/requests")
    public Map<String, Object> createPublicRequest(
            @Valid @RequestBody PublicRequestCreate request) {
        return service.createPublicRequest(request);
    }

    /* ======================= FLOW SUITE EMPLOYEE GATEWAY ======================== */

    @GetMapping("/requester/context")
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> requesterContext() {
        return service.requesterContext();
    }

    @GetMapping("/requester/requests")
    @PreAuthorize("isAuthenticated()")
    public List<Map<String, Object>> myRequests() {
        return service.myRequests();
    }

    @PostMapping("/requester/requests")
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> createAuthenticatedRequest(
            @Valid @RequestBody AuthenticatedRequestCreate request,
            Authentication auth) {
        return service.createAuthenticatedRequest(request, auth);
    }

    /* =========================== OPERATIONAL ASSETFLOW =========================== */

    @GetMapping("/dashboard")
    @PreAuthorize(OPERATIONAL_READ)
    public Map<String, Object> dashboard(
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) ServiceDomain serviceDomain) {
        return service.dashboard(plantCode, serviceDomain);
    }

    @GetMapping("/work-orders")
    @PreAuthorize(OPERATIONAL_READ)
    public Map<String, Object> workOrders(
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) WorkStatus status,
            @RequestParam(required = false) WorkType type,
            @RequestParam(required = false) Priority priority,
            @RequestParam(required = false) ServiceDomain serviceDomain,
            @RequestParam(required = false) UUID equipmentId,
            @RequestParam(required = false) String responsible,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size) {
        return service.listWorkOrders(
                plantCode,
                status,
                type,
                priority,
                serviceDomain,
                equipmentId,
                responsible,
                search,
                page,
                size);
    }

    @GetMapping("/work-orders/{id}")
    @PreAuthorize(OPERATIONAL_READ)
    public Map<String, Object> workOrder(@PathVariable UUID id) {
        return service.getWorkOrder(id);
    }

    @PostMapping("/work-orders")
    @PreAuthorize(OPERATIONAL_READ)
    public Map<String, Object> createWorkOrder(
            @Valid @RequestBody WorkOrderUpsert request,
            Authentication auth) {
        return service.createWorkOrder(request, auth);
    }

    @PutMapping("/work-orders/{id}")
    @PreAuthorize(OPERATIONAL_COORDINATE)
    public Map<String, Object> updateWorkOrder(
            @PathVariable UUID id,
            @Valid @RequestBody WorkOrderUpsert request,
            Authentication auth) {
        return service.updateWorkOrder(id, request, auth);
    }

    @PostMapping("/work-orders/{id}/assign")
    @PreAuthorize(OPERATIONAL_COORDINATE)
    public Map<String, Object> assignWorkOrder(
            @PathVariable UUID id,
            @Valid @RequestBody AssignmentRequest request,
            Authentication auth) {
        return service.assignWorkOrder(id, request, auth);
    }

    @PostMapping("/work-orders/{id}/status")
    @PreAuthorize(OPERATIONAL_READ)
    public Map<String, Object> changeStatus(
            @PathVariable UUID id,
            @Valid @RequestBody StatusChange request,
            Authentication auth) {
        return service.changeStatus(id, request, auth);
    }

    @GetMapping("/qr/{token}")
    @PreAuthorize(OPERATIONAL_READ)
    public Map<String, Object> qrEquipment(@PathVariable UUID token) {
        return service.getEquipmentByQr(token);
    }

    @PostMapping("/qr/{token}/request")
    @PreAuthorize(OPERATIONAL_READ)
    public Map<String, Object> qrComplaint(
            @PathVariable UUID token,
            @Valid @RequestBody WorkOrderUpsert request,
            Authentication auth) {
        return service.createQrComplaint(token, request, auth);
    }

    @GetMapping("/equipment")
    @PreAuthorize(OPERATIONAL_READ)
    public Map<String, Object> equipment(
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) ServiceDomain serviceDomain,
            @RequestParam(required = false) EquipmentStatus status,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String search) {
        return service.listEquipment(plantCode, serviceDomain, status, category, search);
    }

    @GetMapping("/equipment/{id}")
    @PreAuthorize(OPERATIONAL_READ)
    public Map<String, Object> equipment(@PathVariable UUID id) {
        return service.getEquipment(id);
    }

    @PostMapping("/equipment")
    @PreAuthorize(OPERATIONAL_COORDINATE)
    public Map<String, Object> createEquipment(
            @Valid @RequestBody EquipmentUpsert request,
            Authentication auth) {
        return service.createEquipment(request, auth);
    }

    @PutMapping("/equipment/{id}")
    @PreAuthorize(ASSET_MASTER_UPDATE)
    public Map<String, Object> updateEquipment(
            @PathVariable UUID id,
            @Valid @RequestBody EquipmentUpsert request,
            Authentication auth) {
        return service.updateEquipment(id, request, auth);
    }

    @PostMapping("/equipment/{id}/qr/rotate")
    @PreAuthorize(ASSET_MASTER_UPDATE)
    public Map<String, Object> rotateEquipmentQr(
            @PathVariable UUID id,
            Authentication auth) {
        return service.rotateEquipmentQr(id, auth);
    }

    @GetMapping("/teams")
    @PreAuthorize(OPERATIONAL_READ)
    public List<Map<String, Object>> teams(
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) ServiceDomain serviceDomain) {
        return service.listTeams(plantCode, serviceDomain);
    }

    @PostMapping("/teams")
    @PreAuthorize(OPERATIONAL_COORDINATE)
    public Map<String, Object> createTeam(@Valid @RequestBody TeamUpsert request) {
        return service.saveTeam(null, request);
    }

    @PutMapping("/teams/{id}")
    @PreAuthorize(OPERATIONAL_COORDINATE)
    public Map<String, Object> updateTeam(
            @PathVariable UUID id,
            @Valid @RequestBody TeamUpsert request) {
        return service.saveTeam(id, request);
    }

    @GetMapping("/reporters")
    @PreAuthorize("hasAuthority('ADMIN')")
    public List<Map<String, Object>> reporters(
            @RequestParam(required = false) String plantCode,
            @RequestParam(defaultValue = "false") boolean activeOnly,
            @RequestParam(required = false) String search) {
        return service.listReporters(plantCode, activeOnly, search);
    }

    @PostMapping("/reporters")
    @PreAuthorize("hasAuthority('ADMIN')")
    public Map<String, Object> createReporter(
            @Valid @RequestBody ReporterUpsert request,
            Authentication auth) {
        return service.saveReporter(null, request, auth);
    }

    @PutMapping("/reporters/{id}")
    @PreAuthorize("hasAuthority('ADMIN')")
    public Map<String, Object> updateReporter(
            @PathVariable UUID id,
            @Valid @RequestBody ReporterUpsert request,
            Authentication auth) {
        return service.saveReporter(id, request, auth);
    }

    @GetMapping("/preventive-plans")
    @PreAuthorize(OPERATIONAL_READ)
    public List<Map<String, Object>> plans(
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) ServiceDomain serviceDomain,
            @RequestParam(defaultValue = "false") boolean activeOnly) {
        return service.listPlans(plantCode, serviceDomain, activeOnly);
    }

    @PostMapping("/preventive-plans")
    @PreAuthorize(OPERATIONAL_COORDINATE)
    public Map<String, Object> createPlan(@Valid @RequestBody PreventivePlanUpsert request) {
        return service.savePlan(null, request);
    }

    @PutMapping("/preventive-plans/{id}")
    @PreAuthorize(OPERATIONAL_COORDINATE)
    public Map<String, Object> updatePlan(
            @PathVariable UUID id,
            @Valid @RequestBody PreventivePlanUpsert request) {
        return service.savePlan(id, request);
    }

    @PostMapping("/preventive-plans/generate-due")
    @PreAuthorize(OPERATIONAL_COORDINATE)
    public Map<String, Object> generateDue(
            @RequestParam(required = false) ServiceDomain serviceDomain) {
        return Map.of("created", service.generateDuePreventiveOrders(serviceDomain));
    }

    @GetMapping("/calendar")
    @PreAuthorize(OPERATIONAL_READ)
    public List<Map<String, Object>> calendar(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) ServiceDomain serviceDomain) {
        return service.calendar(from, to, plantCode, serviceDomain);
    }

    /* =========================== MAINTENANCE COSTING =========================== */

    @GetMapping("/costs")
    @PreAuthorize(COST_READ)
    public Map<String, Object> costs(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) ServiceDomain serviceDomain,
            @RequestParam(required = false) UUID equipmentId,
            @RequestParam(required = false) UUID workOrderId,
            @RequestParam(required = false) CostBucket costBucket,
            @RequestParam(required = false) ExpenseCategory expenseCategory,
            @RequestParam(required = false) CostStatus status,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size) {
        return service.listMaintenanceCosts(
                from, to, plantCode, serviceDomain, equipmentId, workOrderId,
                costBucket, expenseCategory, status, search, page, size);
    }

    @GetMapping("/costs/summary")
    @PreAuthorize(COST_READ)
    public Map<String, Object> costSummary(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) ServiceDomain serviceDomain,
            @RequestParam(required = false) UUID equipmentId,
            @RequestParam(required = false) CostBucket costBucket,
            @RequestParam(required = false) ExpenseCategory expenseCategory) {
        return service.maintenanceCostSummary(
                from, to, plantCode, serviceDomain, equipmentId, costBucket, expenseCategory);
    }

    @PostMapping("/costs")
    @PreAuthorize(COST_WRITE)
    public Map<String, Object> createCost(
            @Valid @RequestBody MaintenanceCostUpsert request,
            Authentication auth) {
        return service.saveMaintenanceCost(null, request, auth);
    }

    @PutMapping("/costs/{id}")
    @PreAuthorize(COST_WRITE)
    public Map<String, Object> updateCost(
            @PathVariable UUID id,
            @Valid @RequestBody MaintenanceCostUpsert request,
            Authentication auth) {
        return service.saveMaintenanceCost(id, request, auth);
    }

    @PostMapping("/costs/{id}/verify")
    @PreAuthorize(COST_WRITE)
    public Map<String, Object> verifyCost(
            @PathVariable UUID id,
            @RequestParam Long version,
            Authentication auth) {
        return service.verifyMaintenanceCost(id, version, auth);
    }

    @PostMapping("/costs/{id}/void")
    @PreAuthorize(COST_WRITE)
    public Map<String, Object> voidCost(
            @PathVariable UUID id,
            @Valid @RequestBody MaintenanceCostVoidRequest request,
            Authentication auth) {
        return service.voidMaintenanceCost(id, request, auth);
    }

    @PostMapping(value = "/costs/import/preview", consumes = "multipart/form-data")
    @PreAuthorize(COST_WRITE)
    public Map<String, Object> previewCostImport(
            @RequestPart("file") MultipartFile file) {
        return service.previewMaintenanceCostWorkbook(file);
    }

    @PostMapping("/costs/import/confirm")
    @PreAuthorize(COST_WRITE)
    public Map<String, Object> confirmCostImport(
            @Valid @RequestBody MaintenanceCostImportConfirm request,
            Authentication auth) {
        return service.confirmMaintenanceCostImport(request, auth);
    }

    @GetMapping("/reports")
    @PreAuthorize(REPORT_READ)
    public Map<String, Object> reports(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) ServiceDomain serviceDomain) {
        return service.reports(from, to, plantCode, serviceDomain);
    }

    @GetMapping("/categories")
    @PreAuthorize(OPERATIONAL_READ)
    public List<Map<String, Object>> categories(
            @RequestParam(required = false) ServiceDomain serviceDomain) {
        return service.categories(serviceDomain);
    }

    @GetMapping("/plants")
    @PreAuthorize(OPERATIONAL_READ)
    public List<Map<String, Object>> plants() {
        return service.plants();
    }

    @GetMapping("/users")
    @PreAuthorize(OPERATIONAL_READ)
    public List<Map<String, Object>> users(
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) ServiceDomain serviceDomain) {
        return service.users(plantCode, serviceDomain);
    }
}
