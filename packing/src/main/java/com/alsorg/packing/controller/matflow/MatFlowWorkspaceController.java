package com.alsorg.packing.controller.matflow;

import static com.alsorg.packing.controller.dto.matflow.MatFlowWorkspaceDtos.*;
import com.alsorg.packing.service.matflow.MatFlowWorkspaceService;
import com.alsorg.packing.service.matflow.MatFlowWorkspaceService.RevisionFileResource;
import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/matflow/workspace")
@PreAuthorize("isAuthenticated()")
public class MatFlowWorkspaceController {
    private final MatFlowWorkspaceService service;
    public MatFlowWorkspaceController(MatFlowWorkspaceService service){this.service=service;}

    @GetMapping("/files") public List<ProductionFileResponse> files(@RequestParam(required=false)String plantCode,@RequestParam(required=false)String stage,@RequestParam(required=false)String health,@RequestParam(required=false)String search){return service.list(plantCode,stage,health,search);}
    @GetMapping("/design-tasks") public List<DesignTaskQueueResponse> designTasks(@RequestParam(required=false)String plantCode,@RequestParam(required=false)String assignee,@RequestParam(required=false)String status,@RequestParam(required=false)String search){return service.listDesignTasks(plantCode,assignee,status,search);}
    @GetMapping("/files/{fileId}") public ProductionFileDetailResponse file(@PathVariable UUID fileId){return service.get(fileId);}
    @PutMapping("/files/{fileId}/setup") public ProductionFileDetailResponse setup(@PathVariable UUID fileId,@Valid @RequestBody ProductionFileSetupRequest request){return service.updateSetup(fileId,request);}
    @PutMapping("/files/{fileId}/checklists/{area}/{itemKey}") public ProductionFileDetailResponse checklist(@PathVariable UUID fileId,@PathVariable String area,@PathVariable String itemKey,@Valid @RequestBody ChecklistUpdateRequest request){return service.updateChecklist(fileId,area,itemKey,request);}
    @PostMapping("/files/{fileId}/design-tasks") public ProductionFileDetailResponse createDesignTask(@PathVariable UUID fileId,@Valid @RequestBody DesignTaskCreateRequest request){return service.createDesignTask(fileId,request);}
    @PutMapping("/files/{fileId}/design-tasks/{taskId}") public ProductionFileDetailResponse updateDesignTask(@PathVariable UUID fileId,@PathVariable UUID taskId,@Valid @RequestBody DesignTaskUpdateRequest request){return service.updateDesignTask(fileId,taskId,request);}
    @PostMapping("/files/{fileId}/design-tasks/{taskId}/status") public ProductionFileDetailResponse designTaskStatus(@PathVariable UUID fileId,@PathVariable UUID taskId,@Valid @RequestBody DesignTaskStatusRequest request){return service.setDesignTaskStatus(fileId,taskId,request);}
    @PostMapping("/files/{fileId}/design-head-review") public ProductionFileDetailResponse designHeadReview(@PathVariable UUID fileId,@Valid @RequestBody DesignHeadReviewRequest request){return service.designHeadReview(fileId,request);}
    @PostMapping("/files/{fileId}/designer-submit") public ProductionFileDetailResponse designerSubmit(@PathVariable UUID fileId,@Valid @RequestBody DesignSubmitRequest request){return service.submitDesign(fileId,request);}
    @PostMapping("/files/{fileId}/ppc-gate-1") public ProductionFileDetailResponse ppcGate1(@PathVariable UUID fileId,@Valid @RequestBody GateDecisionRequest request){return service.ppcGate1(fileId,request);}
    @PostMapping("/files/{fileId}/engineering-decision") public ProductionFileDetailResponse engineeringDecision(@PathVariable UUID fileId,@Valid @RequestBody EngineeringDecisionRequest request){return service.engineeringDecision(fileId,request);}

    @PostMapping("/files/{fileId}/queries") public ProductionFileDetailResponse createQuery(@PathVariable UUID fileId,@Valid @RequestBody QueryCreateRequest request){return service.createQuery(fileId,request);}
    @PostMapping("/files/{fileId}/queries/{queryId}/respond") public ProductionFileDetailResponse respondQuery(@PathVariable UUID fileId,@PathVariable UUID queryId,@Valid @RequestBody QueryResponseRequest request){return service.respondQuery(fileId,queryId,request);}
    @PostMapping("/files/{fileId}/queries/{queryId}/close") public ProductionFileDetailResponse closeQuery(@PathVariable UUID fileId,@PathVariable UUID queryId,@Valid @RequestBody QueryCloseRequest request){return service.closeQuery(fileId,queryId,request);}

    @PostMapping("/files/{fileId}/tasks") public ProductionFileDetailResponse createTask(@PathVariable UUID fileId,@Valid @RequestBody TaskCreateRequest request){return service.createTask(fileId,request);}
    @PutMapping("/files/{fileId}/tasks/{taskId}") public ProductionFileDetailResponse updateTask(@PathVariable UUID fileId,@PathVariable UUID taskId,@Valid @RequestBody TaskUpdateRequest request){return service.updateTask(fileId,taskId,request);}
    @PostMapping("/files/{fileId}/tasks/{taskId}/status") public ProductionFileDetailResponse taskStatus(@PathVariable UUID fileId,@PathVariable UUID taskId,@Valid @RequestBody TaskStatusRequest request){return service.setTaskStatus(fileId,taskId,request);}

    @PostMapping(value="/files/{fileId}/revisions",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public ProductionFileDetailResponse uploadRevision(@PathVariable UUID fileId,@RequestParam String type,@RequestParam String revisionNo,@RequestParam(required=false)String changeSummary,@RequestParam("file")MultipartFile file){return service.uploadRevision(fileId,type,revisionNo,changeSummary,file);}
    @GetMapping("/files/{fileId}/revisions/{revisionId}/file") public ResponseEntity<Resource> revisionFile(@PathVariable UUID fileId,@PathVariable UUID revisionId){RevisionFileResource r=service.revisionFile(fileId,revisionId);MediaType type;try{type=MediaType.parseMediaType(r.contentType());}catch(Exception ex){type=MediaType.APPLICATION_OCTET_STREAM;}return ResponseEntity.ok().contentType(type).header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.inline().filename(r.fileName(),StandardCharsets.UTF_8).build().toString()).body(r.resource());}
    @PostMapping("/files/{fileId}/revisions/{revisionId}/impact") public ProductionFileDetailResponse revisionImpact(@PathVariable UUID fileId,@PathVariable UUID revisionId,@Valid @RequestBody RevisionImpactRequest request){return service.reviewRevisionImpact(fileId,revisionId,request);}

    @PostMapping("/files/{fileId}/ppc-gate-2") public ProductionFileDetailResponse ppcGate2(@PathVariable UUID fileId,@Valid @RequestBody GateDecisionRequest request){return service.ppcGate2(fileId,request);}
    @GetMapping("/notifications") public NotificationFeedResponse notifications(@RequestParam(required=false)Integer limit){return service.notifications(limit);}
    @PostMapping("/notifications/{workItemId}/read") public NotificationFeedResponse read(@PathVariable UUID workItemId,@RequestParam(required=false)Integer limit){return service.markNotificationRead(workItemId,limit);}
    @PostMapping("/notifications/read-all") public NotificationFeedResponse readAll(@RequestParam(required=false)Integer limit){return service.markAllNotificationsRead(limit);}
}
