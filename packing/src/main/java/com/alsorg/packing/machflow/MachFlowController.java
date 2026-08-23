package com.alsorg.packing.machflow;

import com.alsorg.packing.machflow.MachFlowData.AssignmentRequest;
import com.alsorg.packing.machflow.MachFlowData.AuthenticatedRequestCreate;
import com.alsorg.packing.machflow.MachFlowData.EquipmentStatus;
import com.alsorg.packing.machflow.MachFlowData.EquipmentUpsert;
import com.alsorg.packing.machflow.MachFlowData.PreventivePlanUpsert;
import com.alsorg.packing.machflow.MachFlowData.Priority;
import com.alsorg.packing.machflow.MachFlowData.PublicRequestCreate;
import com.alsorg.packing.machflow.MachFlowData.ReporterLogin;
import com.alsorg.packing.machflow.MachFlowData.ReporterUpsert;
import com.alsorg.packing.machflow.MachFlowData.ServiceDomain;
import com.alsorg.packing.machflow.MachFlowData.StatusChange;
import com.alsorg.packing.machflow.MachFlowData.TeamUpsert;
import com.alsorg.packing.machflow.MachFlowData.WorkOrderUpsert;
import com.alsorg.packing.machflow.MachFlowData.WorkStatus;
import com.alsorg.packing.machflow.MachFlowData.WorkType;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * MachFlow / ServiceFlow API.
 *
 * Security is deliberately split into:
 *  - public QR gateway: Reporter Code + PIN is validated inside MachFlowService;
 *  - authenticated request gateway: a FlowSuite user must have a linked Reporter
 *    profile (or be operational MachFlow staff);
 *  - operational endpoints: domain-scoped Machine Maintenance / IT roles.
 *
 * Service-level checks are authoritative. Controller authorities only decide
 * which surface a signed-in user may attempt to call.
 */
@RestController
@RequestMapping("/api/machflow")
public class MachFlowController {

    private static final String OPERATIONAL_READ =
            "hasAnyAuthority('ADMIN','MACHFLOW_DIRECTOR','MACHFLOW_MACHINE_HEAD','MACHFLOW_MACHINE_TECHNICIAN',"
                    + "'MACHFLOW_IT_HEAD','MACHFLOW_IT_TECHNICIAN','MACHFLOW_MANAGER','MACHFLOW_PLANNER',"
                    + "'MACHFLOW_HEAD_TECHNICIAN','MACHFLOW_TECHNICIAN')";

    private static final String OPERATIONAL_COORDINATE =
            "hasAnyAuthority('ADMIN','MACHFLOW_MACHINE_HEAD','MACHFLOW_IT_HEAD','MACHFLOW_MANAGER',"
                    + "'MACHFLOW_PLANNER','MACHFLOW_HEAD_TECHNICIAN')";

    private static final String REPORT_READ =
            "hasAnyAuthority('ADMIN','MACHFLOW_DIRECTOR','MACHFLOW_MACHINE_HEAD','MACHFLOW_IT_HEAD',"
                    + "'MACHFLOW_MANAGER','MACHFLOW_PLANNER','MACHFLOW_HEAD_TECHNICIAN')";

    private final MachFlowService service;

    public MachFlowController(MachFlowService service) {
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
    public Map<String, Object> authoriseReporter(@RequestBody ReporterLogin request) {
        return service.authoriseReporter(request);
    }

    @PostMapping("/public/requests/mine")
    public List<Map<String, Object>> reporterRequests(@RequestBody ReporterLogin request) {
        return service.reporterRequests(request);
    }

    @PostMapping("/public/requests")
    public Map<String, Object> createPublicRequest(@RequestBody PublicRequestCreate request) {
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
            @RequestBody AuthenticatedRequestCreate request,
            Authentication auth) {
        return service.createAuthenticatedRequest(request, auth);
    }

    /* =========================== OPERATIONAL MACHFLOW =========================== */

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
            @RequestBody WorkOrderUpsert request,
            Authentication auth) {
        return service.createWorkOrder(request, auth);
    }

    @PutMapping("/work-orders/{id}")
    @PreAuthorize(OPERATIONAL_COORDINATE)
    public Map<String, Object> updateWorkOrder(
            @PathVariable UUID id,
            @RequestBody WorkOrderUpsert request,
            Authentication auth) {
        return service.updateWorkOrder(id, request, auth);
    }

    @PostMapping("/work-orders/{id}/assign")
    @PreAuthorize(OPERATIONAL_COORDINATE)
    public Map<String, Object> assignWorkOrder(
            @PathVariable UUID id,
            @RequestBody AssignmentRequest request,
            Authentication auth) {
        return service.assignWorkOrder(id, request, auth);
    }

    @PostMapping("/work-orders/{id}/status")
    @PreAuthorize(OPERATIONAL_READ)
    public Map<String, Object> changeStatus(
            @PathVariable UUID id,
            @RequestBody StatusChange request,
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
            @RequestBody WorkOrderUpsert request,
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
            @RequestBody EquipmentUpsert request,
            Authentication auth) {
        return service.createEquipment(request, auth);
    }

    @PutMapping("/equipment/{id}")
    @PreAuthorize(OPERATIONAL_COORDINATE)
    public Map<String, Object> updateEquipment(
            @PathVariable UUID id,
            @RequestBody EquipmentUpsert request,
            Authentication auth) {
        return service.updateEquipment(id, request, auth);
    }

    @PostMapping("/equipment/{id}/qr/rotate")
    @PreAuthorize(OPERATIONAL_COORDINATE)
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
    public Map<String, Object> createTeam(@RequestBody TeamUpsert request) {
        return service.saveTeam(null, request);
    }

    @PutMapping("/teams/{id}")
    @PreAuthorize(OPERATIONAL_COORDINATE)
    public Map<String, Object> updateTeam(
            @PathVariable UUID id,
            @RequestBody TeamUpsert request) {
        return service.saveTeam(id, request);
    }

    /**
     * Reporter directory is central identity data, not a department data set.
     * Only ADMIN can create/link/disable Reporter Passes.
     */
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
            @RequestBody ReporterUpsert request,
            Authentication auth) {
        return service.saveReporter(null, request, auth);
    }

    @PutMapping("/reporters/{id}")
    @PreAuthorize("hasAuthority('ADMIN')")
    public Map<String, Object> updateReporter(
            @PathVariable UUID id,
            @RequestBody ReporterUpsert request,
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
    public Map<String, Object> createPlan(@RequestBody PreventivePlanUpsert request) {
        return service.savePlan(null, request);
    }

    @PutMapping("/preventive-plans/{id}")
    @PreAuthorize(OPERATIONAL_COORDINATE)
    public Map<String, Object> updatePlan(
            @PathVariable UUID id,
            @RequestBody PreventivePlanUpsert request) {
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
