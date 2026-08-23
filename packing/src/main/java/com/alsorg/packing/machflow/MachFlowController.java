package com.alsorg.packing.machflow;

import com.alsorg.packing.machflow.MachFlowData.EquipmentStatus;
import com.alsorg.packing.machflow.MachFlowData.EquipmentUpsert;
import com.alsorg.packing.machflow.MachFlowData.PreventivePlanUpsert;
import com.alsorg.packing.machflow.MachFlowData.Priority;
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
 * Isolated MachFlow API.
 *
 * It reuses only FlowSuite's existing authenticated user/plant access model.
 * It does not call or mutate PackFlow, BOMFlow, MatFlow, HRFlow or Client Master.
 */
@RestController
@RequestMapping("/api/machflow")
@PreAuthorize("hasAnyRole('ADMIN','MACHFLOW_MANAGER','MACHFLOW_PLANNER','MACHFLOW_TECHNICIAN','MACHFLOW_REQUESTER')")
public class MachFlowController {

    private final MachFlowService service;

    public MachFlowController(MachFlowService service) {
        this.service = service;
    }

    @GetMapping("/dashboard")
    public Map<String, Object> dashboard(
            @RequestParam(required = false) String plantCode) {
        return service.dashboard(plantCode);
    }

    @GetMapping("/work-orders")
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
    public Map<String, Object> workOrder(@PathVariable UUID id) {
        return service.getWorkOrder(id);
    }

    @PostMapping("/work-orders")
    public Map<String, Object> createWorkOrder(
            @RequestBody WorkOrderUpsert request,
            Authentication auth) {
        return service.createWorkOrder(request, auth);
    }

    @PutMapping("/work-orders/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MACHFLOW_MANAGER','MACHFLOW_PLANNER')")
    public Map<String, Object> updateWorkOrder(
            @PathVariable UUID id,
            @RequestBody WorkOrderUpsert request,
            Authentication auth) {
        return service.updateWorkOrder(id, request, auth);
    }

    @PostMapping("/work-orders/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','MACHFLOW_MANAGER','MACHFLOW_PLANNER','MACHFLOW_TECHNICIAN')")
    public Map<String, Object> changeStatus(
            @PathVariable UUID id,
            @RequestBody StatusChange request,
            Authentication auth) {
        return service.changeStatus(id, request, auth);
    }

    @GetMapping("/equipment")
    public Map<String, Object> equipment(
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) EquipmentStatus status,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String search) {
        return service.listEquipment(plantCode, status, category, search);
    }

    @GetMapping("/equipment/{id}")
    public Map<String, Object> equipment(@PathVariable UUID id) {
        return service.getEquipment(id);
    }

    @PostMapping("/equipment")
    @PreAuthorize("hasAnyRole('ADMIN','MACHFLOW_MANAGER','MACHFLOW_PLANNER')")
    public Map<String, Object> createEquipment(
            @RequestBody EquipmentUpsert request,
            Authentication auth) {
        return service.createEquipment(request, auth);
    }

    @PutMapping("/equipment/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MACHFLOW_MANAGER','MACHFLOW_PLANNER')")
    public Map<String, Object> updateEquipment(
            @PathVariable UUID id,
            @RequestBody EquipmentUpsert request,
            Authentication auth) {
        return service.updateEquipment(id, request, auth);
    }

    @GetMapping("/teams")
    public List<Map<String, Object>> teams(
            @RequestParam(required = false) String plantCode) {
        return service.listTeams(plantCode);
    }

    @PostMapping("/teams")
    @PreAuthorize("hasAnyRole('ADMIN','MACHFLOW_MANAGER','MACHFLOW_PLANNER')")
    public Map<String, Object> createTeam(@RequestBody TeamUpsert request) {
        return service.saveTeam(null, request);
    }

    @PutMapping("/teams/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MACHFLOW_MANAGER','MACHFLOW_PLANNER')")
    public Map<String, Object> updateTeam(
            @PathVariable UUID id,
            @RequestBody TeamUpsert request) {
        return service.saveTeam(id, request);
    }

    @GetMapping("/preventive-plans")
    public List<Map<String, Object>> plans(
            @RequestParam(required = false) String plantCode,
            @RequestParam(defaultValue = "false") boolean activeOnly) {
        return service.listPlans(plantCode, activeOnly);
    }

    @PostMapping("/preventive-plans")
    @PreAuthorize("hasAnyRole('ADMIN','MACHFLOW_MANAGER','MACHFLOW_PLANNER')")
    public Map<String, Object> createPlan(
            @RequestBody PreventivePlanUpsert request) {
        return service.savePlan(null, request);
    }

    @PutMapping("/preventive-plans/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MACHFLOW_MANAGER','MACHFLOW_PLANNER')")
    public Map<String, Object> updatePlan(
            @PathVariable UUID id,
            @RequestBody PreventivePlanUpsert request) {
        return service.savePlan(id, request);
    }

    @PostMapping("/preventive-plans/generate-due")
    @PreAuthorize("hasAnyRole('ADMIN','MACHFLOW_MANAGER','MACHFLOW_PLANNER')")
    public Map<String, Object> generateDue() {
        return Map.of(
                "created",
                service.generateDuePreventiveOrders());
    }

    @GetMapping("/calendar")
    public List<Map<String, Object>> calendar(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String plantCode) {
        return service.calendar(from, to, plantCode);
    }

    @GetMapping("/reports")
    @PreAuthorize("hasAnyRole('ADMIN','MACHFLOW_MANAGER','MACHFLOW_PLANNER')")
    public Map<String, Object> reports(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String plantCode) {
        return service.reports(from, to, plantCode);
    }

    @GetMapping("/categories")
    public List<Map<String, Object>> categories() {
        return service.categories();
    }

    @GetMapping("/plants")
    public List<Map<String, Object>> plants() {
        return service.plants();
    }

    @GetMapping("/users")
    public List<Map<String, Object>> users(
            @RequestParam(required = false) String plantCode) {
        return service.users(plantCode);
    }
}
