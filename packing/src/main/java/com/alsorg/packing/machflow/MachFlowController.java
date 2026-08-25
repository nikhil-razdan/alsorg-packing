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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * MachFlow API.
 *
 * There are deliberately three access surfaces:
 *  1) /public/**   - no FlowSuite login, but Reporter Code + PIN is enforced
 *                    by MachFlowService before a request can be created.
 *  2) /requester/** - any authenticated FlowSuite employee may submit/track
 *                     only their own maintenance/service requests.
 *  3) operational endpoints - MachFlow maintenance roles only.
 *
 * This keeps occasional complainants out of the central FlowSuite user table
 * while preserving controlled posting and a full audit trail.
 */
@RestController
@RequestMapping("/api/machflow")
public class MachFlowController {

    private static final String MACHFLOW_READ =
            "hasAnyRole('ADMIN','MACHFLOW_MANAGER','MACHFLOW_PLANNER','MACHFLOW_HEAD_TECHNICIAN','MACHFLOW_TECHNICIAN','MACHFLOW_REQUESTER')";
    private static final String MACHFLOW_COORDINATE =
            "hasAnyRole('ADMIN','MACHFLOW_MANAGER','MACHFLOW_PLANNER','MACHFLOW_HEAD_TECHNICIAN')";
    private static final String MACHFLOW_CONFIG =
            "hasAnyRole('ADMIN','MACHFLOW_MANAGER','MACHFLOW_PLANNER')";

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
    @PreAuthorize(MACHFLOW_READ)
    public Map<String, Object> dashboard(@RequestParam(required = false) String plantCode) {
        return service.dashboard(plantCode);
    }

    @GetMapping("/work-orders")
    @PreAuthorize(MACHFLOW_READ)
    public Map<String, Object> workOrders(
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) WorkStatus status,
            @RequestParam(required = false) WorkType type,
            @RequestParam(required = false) Priority priority,
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
                equipmentId,
                responsible,
                search,
                page,
                size);
    }

    @GetMapping("/work-orders/{id}")
    @PreAuthorize(MACHFLOW_READ)
    public Map<String, Object> workOrder(@PathVariable UUID id) {
        return service.getWorkOrder(id);
    }

    @PostMapping("/work-orders")
    @PreAuthorize(MACHFLOW_READ)
    public Map<String, Object> createWorkOrder(
            @RequestBody WorkOrderUpsert request,
            Authentication auth) {
        return service.createWorkOrder(request, auth);
    }

    @PutMapping("/work-orders/{id}")
    @PreAuthorize(MACHFLOW_COORDINATE)
    public Map<String, Object> updateWorkOrder(
            @PathVariable UUID id,
            @RequestBody WorkOrderUpsert request,
            Authentication auth) {
        return service.updateWorkOrder(id, request, auth);
    }

    @PostMapping("/work-orders/{id}/assign")
    @PreAuthorize(MACHFLOW_COORDINATE)
    public Map<String, Object> assignWorkOrder(
            @PathVariable UUID id,
            @RequestBody AssignmentRequest request,
            Authentication auth) {
        return service.assignWorkOrder(id, request, auth);
    }

    @PostMapping("/work-orders/{id}/status")
    @PreAuthorize(MACHFLOW_READ)
    public Map<String, Object> changeStatus(
            @PathVariable UUID id,
            @RequestBody StatusChange request,
            Authentication auth) {
        return service.changeStatus(id, request, auth);
    }

    /** Legacy authenticated QR endpoint kept for backward compatibility. */
    @GetMapping("/qr/{token}")
    @PreAuthorize(MACHFLOW_READ)
    public Map<String, Object> qrEquipment(@PathVariable UUID token) {
        return service.getEquipmentByQr(token);
    }

    /** Legacy authenticated QR request endpoint kept for old printed links. */
    @PostMapping("/qr/{token}/request")
    @PreAuthorize(MACHFLOW_READ)
    public Map<String, Object> qrComplaint(
            @PathVariable UUID token,
            @RequestBody WorkOrderUpsert request,
            Authentication auth) {
        return service.createQrComplaint(token, request, auth);
    }

    @GetMapping("/equipment")
    @PreAuthorize(MACHFLOW_READ)
    public Map<String, Object> equipment(
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) EquipmentStatus status,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String search) {
        return service.listEquipment(plantCode, status, category, search);
    }

    @GetMapping("/equipment/{id}")
    @PreAuthorize(MACHFLOW_READ)
    public Map<String, Object> equipment(@PathVariable UUID id) {
        return service.getEquipment(id);
    }

    @PostMapping("/equipment")
    @PreAuthorize(MACHFLOW_CONFIG)
    public Map<String, Object> createEquipment(
            @RequestBody EquipmentUpsert request,
            Authentication auth) {
        return service.createEquipment(request, auth);
    }

    @PutMapping("/equipment/{id}")
    @PreAuthorize(MACHFLOW_CONFIG)
    public Map<String, Object> updateEquipment(
            @PathVariable UUID id,
            @RequestBody EquipmentUpsert request,
            Authentication auth) {
        return service.updateEquipment(id, request, auth);
    }

    @PostMapping("/equipment/{id}/qr/rotate")
    @PreAuthorize(MACHFLOW_CONFIG)
    public Map<String, Object> rotateEquipmentQr(
            @PathVariable UUID id,
            Authentication auth) {
        return service.rotateEquipmentQr(id, auth);
    }

    @GetMapping("/teams")
    @PreAuthorize(MACHFLOW_READ)
    public List<Map<String, Object>> teams(@RequestParam(required = false) String plantCode) {
        return service.listTeams(plantCode);
    }

    @PostMapping("/teams")
    @PreAuthorize(MACHFLOW_CONFIG)
    public Map<String, Object> createTeam(@RequestBody TeamUpsert request) {
        return service.saveTeam(null, request);
    }

    @PutMapping("/teams/{id}")
    @PreAuthorize(MACHFLOW_CONFIG)
    public Map<String, Object> updateTeam(
            @PathVariable UUID id,
            @RequestBody TeamUpsert request) {
        return service.saveTeam(id, request);
    }

    @GetMapping("/reporters")
    @PreAuthorize(MACHFLOW_CONFIG)
    public List<Map<String, Object>> reporters(
            @RequestParam(required = false) String plantCode,
            @RequestParam(defaultValue = "false") boolean activeOnly,
            @RequestParam(required = false) String search) {
        return service.listReporters(plantCode, activeOnly, search);
    }

    @PostMapping("/reporters")
    @PreAuthorize(MACHFLOW_CONFIG)
    public Map<String, Object> createReporter(
            @RequestBody ReporterUpsert request,
            Authentication auth) {
        return service.saveReporter(null, request, auth);
    }

    @PutMapping("/reporters/{id}")
    @PreAuthorize(MACHFLOW_CONFIG)
    public Map<String, Object> updateReporter(
            @PathVariable UUID id,
            @RequestBody ReporterUpsert request,
            Authentication auth) {
        return service.saveReporter(id, request, auth);
    }

    @GetMapping("/preventive-plans")
    @PreAuthorize(MACHFLOW_READ)
    public List<Map<String, Object>> plans(
            @RequestParam(required = false) String plantCode,
            @RequestParam(defaultValue = "false") boolean activeOnly) {
        return service.listPlans(plantCode, activeOnly);
    }

    @PostMapping("/preventive-plans")
    @PreAuthorize(MACHFLOW_CONFIG)
    public Map<String, Object> createPlan(@RequestBody PreventivePlanUpsert request) {
        return service.savePlan(null, request);
    }

    @PutMapping("/preventive-plans/{id}")
    @PreAuthorize(MACHFLOW_CONFIG)
    public Map<String, Object> updatePlan(
            @PathVariable UUID id,
            @RequestBody PreventivePlanUpsert request) {
        return service.savePlan(id, request);
    }

    @PostMapping("/preventive-plans/generate-due")
    @PreAuthorize(MACHFLOW_CONFIG)
    public Map<String, Object> generateDue() {
        return Map.of("created", service.generateDuePreventiveOrders());
    }

    @GetMapping("/calendar")
    @PreAuthorize(MACHFLOW_READ)
    public List<Map<String, Object>> calendar(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String plantCode) {
        return service.calendar(from, to, plantCode);
    }

    @GetMapping("/reports")
    @PreAuthorize(MACHFLOW_COORDINATE)
    public Map<String, Object> reports(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String plantCode) {
        return service.reports(from, to, plantCode);
    }

    @GetMapping("/categories")
    @PreAuthorize(MACHFLOW_READ)
    public List<Map<String, Object>> categories() {
        return service.categories();
    }

    @GetMapping("/plants")
    @PreAuthorize(MACHFLOW_READ)
    public List<Map<String, Object>> plants() {
        return service.plants();
    }

    @GetMapping("/users")
    @PreAuthorize(MACHFLOW_READ)
    public List<Map<String, Object>> users(@RequestParam(required = false) String plantCode) {
        return service.users(plantCode);
    }
}
