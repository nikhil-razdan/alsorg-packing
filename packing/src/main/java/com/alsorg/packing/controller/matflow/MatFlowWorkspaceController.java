package com.alsorg.packing.controller.matflow;

import static com.alsorg.packing.controller.dto.matflow.MatFlowWorkspaceDtos.*;

import com.alsorg.packing.service.matflow.MatFlowWorkspaceService;
import com.alsorg.packing.service.matflow.MatFlowWorkspaceService.WorkspaceFileResource;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * MatFlow Design / Engineering work-management API.
 * Material execution remains owned by the existing MatFlow services.
 */
@RestController
@RequestMapping("/api/matflow/workspace")
@PreAuthorize("isAuthenticated()")
public class MatFlowWorkspaceController {

    private final MatFlowWorkspaceService service;

    public MatFlowWorkspaceController(MatFlowWorkspaceService service) {
        this.service = service;
    }

    /* =============================== DESIGN =============================== */

    @GetMapping("/design-submissions")
    public List<DesignSubmissionResponse> designSubmissions(
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) UUID productId) {
        return service.listDesignSubmissions(plantCode, status, search, productId);
    }

    @GetMapping("/design-submissions/{id}")
    public DesignSubmissionDetailResponse designSubmission(@PathVariable UUID id) {
        return service.getDesignSubmission(id);
    }

    @PostMapping("/design-submissions")
    public DesignSubmissionDetailResponse createDesignSubmission(@RequestBody DesignSubmissionCreateRequest request) {
        return service.createDesignSubmission(request);
    }

    @PutMapping("/design-submissions/{id}")
    public DesignSubmissionDetailResponse updateDesignSubmission(
            @PathVariable UUID id,
            @RequestBody DesignSubmissionUpdateRequest request) {
        return service.updateDesignSubmission(id, request);
    }

    @PutMapping("/design-submissions/{id}/checklist/{itemKey}")
    public DesignSubmissionDetailResponse updateDesignChecklist(
            @PathVariable UUID id,
            @PathVariable String itemKey,
            @RequestBody ChecklistItemUpdateRequest request) {
        return service.updateDesignChecklist(id, itemKey, request);
    }

    @PostMapping(value = "/design-submissions/{id}/drawing", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public DesignSubmissionDetailResponse uploadDesignDrawing(
            @PathVariable UUID id,
            @RequestParam String revision,
            @RequestParam Integer version,
            @RequestParam("file") MultipartFile file) {
        return service.uploadDesignDrawing(id, revision, file, version);
    }

    @GetMapping("/design-submissions/{id}/drawing")
    public ResponseEntity<Resource> designDrawing(@PathVariable UUID id) {
        return download(service.designDrawing(id));
    }

    @PostMapping("/design-submissions/{id}/submit")
    public DesignSubmissionDetailResponse submitDesignSubmission(
            @PathVariable UUID id,
            @RequestParam Integer version) {
        return service.submitDesignSubmission(id, version);
    }

    @PostMapping("/design-submissions/{id}/review")
    public DesignSubmissionDetailResponse reviewDesignSubmission(
            @PathVariable UUID id,
            @RequestBody DesignSubmissionActionRequest request) {
        return service.reviewDesignSubmission(id, request);
    }

    /* =============================== ENGINEERING TASKS =============================== */

    @GetMapping("/tasks")
    public List<EngineeringTaskResponse> tasks(
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) String status,
            @RequestParam(required = false, defaultValue = "ALL") String scope,
            @RequestParam(required = false) String search) {
        return service.listTasks(plantCode, status, scope, search);
    }

    @GetMapping("/tasks/{id}")
    public EngineeringTaskDetailResponse task(@PathVariable UUID id) {
        return service.getTask(id);
    }

    @PostMapping("/tasks/{id}/assign")
    public EngineeringTaskDetailResponse assignTask(
            @PathVariable UUID id,
            @RequestBody EngineeringTaskAssignRequest request) {
        return service.assignTask(id, request);
    }

    @PutMapping("/tasks/{id}")
    public EngineeringTaskDetailResponse updateTask(
            @PathVariable UUID id,
            @RequestBody EngineeringTaskUpdateRequest request) {
        return service.updateTask(id, request);
    }

    @PutMapping("/tasks/{id}/checklist/{itemKey}")
    public EngineeringTaskDetailResponse updateTaskChecklist(
            @PathVariable UUID id,
            @PathVariable String itemKey,
            @RequestBody ChecklistItemUpdateRequest request) {
        return service.updateTaskChecklist(id, itemKey, request);
    }

    @PostMapping("/tasks/{id}/status")
    public EngineeringTaskDetailResponse taskStatus(
            @PathVariable UUID id,
            @RequestBody EngineeringTaskStatusRequest request) {
        return service.setTaskStatus(id, request);
    }

    @PostMapping(value = "/tasks/{id}/production-drawing", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public EngineeringTaskDetailResponse uploadProductionDrawing(
            @PathVariable UUID id,
            @RequestParam String revision,
            @RequestParam Integer version,
            @RequestParam("file") MultipartFile file) {
        return service.uploadProductionDrawing(id, revision, file, version);
    }

    @GetMapping("/tasks/{id}/production-drawing")
    public ResponseEntity<Resource> productionDrawing(@PathVariable UUID id) {
        return download(service.productionDrawing(id));
    }

    @PostMapping("/tasks/{id}/handover")
    public EngineeringTaskDetailResponse handover(
            @PathVariable UUID id,
            @RequestBody EngineeringHandoverRequest request) {
        return service.handoverToProduction(id, request);
    }

    /* =============================== SHARED =============================== */

    @GetMapping("/product-context")
    public ProductEngineeringContextResponse productContext(
            @RequestParam UUID projectId,
            @RequestParam UUID productId) {
        return service.productContext(projectId, productId);
    }

    @GetMapping("/people")
    public List<WorkspacePerson> people(@RequestParam(required = false) String plantCode) {
        return service.people(plantCode);
    }

    @GetMapping("/checklist-templates")
    public List<ChecklistTemplateResponse> templates() {
        return service.templates();
    }

    @GetMapping("/notifications")
    public WorkspaceNotificationFeedResponse notifications(
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false, defaultValue = "40") Integer limit) {
        return service.notifications(plantCode, limit);
    }

    @PostMapping("/notifications/{referenceType}/{referenceId}/read")
    public WorkspaceNotificationFeedResponse read(
            @PathVariable String referenceType,
            @PathVariable UUID referenceId,
            @RequestParam(required = false) String plantCode) {
        return service.markNotificationRead(referenceType, referenceId, plantCode);
    }

    @PostMapping("/notifications/read-all")
    public WorkspaceNotificationFeedResponse readAll(@RequestParam(required = false) String plantCode) {
        return service.markAllNotificationsRead(plantCode);
    }

    private ResponseEntity<Resource> download(WorkspaceFileResource file) {
        MediaType mediaType;
        try {
            mediaType = MediaType.parseMediaType(file.contentType());
        } catch (Exception ignored) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }
        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline()
                                .filename(file.fileName(), StandardCharsets.UTF_8)
                                .build()
                                .toString())
                .body(file.resource());
    }
}
