package com.alsorg.packing.service.matflow;

import static com.alsorg.packing.controller.dto.matflow.MatFlowWorkspaceDtos.*;

import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.BomActionRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.BomDetailResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.BomSummaryResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowProjectDtos.ProductPortfolioRow;
import com.alsorg.packing.controller.dto.matflow.MatFlowProjectDtos.ProjectPortfolioResponse;
import com.alsorg.packing.domain.matflow.MatFlowAuditLog;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.matflow.MatFlowAuditLogRepository;
import com.alsorg.packing.service.UserService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/**
 * Design -> Engineering -> Production handover workspace for MatFlow.
 *
 * <p>The workspace is deliberately an append-only document/task layer over the
 * existing Project/Product and BOM aggregates. It does not change Store,
 * Purchase, GRN, QC, Processing, Production, Return or stock movement state.
 * BOM handover calls the existing MatFlowBomService submission action so the
 * existing Production technical-review state machine remains authoritative.</p>
 *
 * <p>State is stored as immutable snapshots in mf_audit_logs. Drawing files are
 * stored under the existing matflow.product-attachment-dir, inside a product
 * scoped workflow-drawings folder. Every submitted design and every Production
 * handover therefore keeps its exact revision/file instead of overwriting an
 * older released drawing.</p>
 */
@Service
public class MatFlowWorkspaceService {

    public static final String DESIGN_ENTITY = "MATFLOW_DESIGN_SUBMISSION";
    public static final String TASK_ENTITY = "MATFLOW_ENGINEERING_TASK";
    public static final String RECEIPT_ENTITY = "MATFLOW_NOTIFICATION_RECEIPT";

    public static final String DESIGN_TEMPLATE = "DESIGN_SUBMISSION_V1";
    public static final String WARDROBE_TEMPLATE = "WARDROBE_ENGINEERING_V1";
    public static final String GENERAL_ENGINEERING_TEMPLATE = "GENERAL_ENGINEERING_V1";

    private static final Set<String> PRIORITIES = Set.of("LOW", "NORMAL", "HIGH", "URGENT");
    private static final Set<String> COMPANY_CODES = Set.of("ALSORG", "CALLISTO");
    private static final Set<String> DESIGN_STATUSES = Set.of(
            "DRAFT", "SUBMITTED_TO_ENGINEERING", "RETURNED_FOR_CLARIFICATION", "ACCEPTED", "CANCELLED");
    private static final Set<String> TASK_STATUSES = Set.of(
            "AWAITING_ASSIGNMENT", "ASSIGNED", "IN_PROGRESS", "AWAITING_CLARIFICATION",
            "SUBMITTED_TO_PRODUCTION", "RETURNED", "COMPLETED", "SUPERSEDED", "CANCELLED");
    private static final Set<String> OPEN_TASK_STATUSES = Set.of(
            "AWAITING_ASSIGNMENT", "ASSIGNED", "IN_PROGRESS", "AWAITING_CLARIFICATION",
            "SUBMITTED_TO_PRODUCTION", "RETURNED");
    private static final Set<String> SUPERSEDABLE_TASK_STATUSES = Set.of(
            "AWAITING_ASSIGNMENT", "ASSIGNED", "IN_PROGRESS", "AWAITING_CLARIFICATION", "RETURNED");
    private static final Set<String> CHECK_STATES = Set.of("PENDING", "DONE", "NA");

    private static final long DRAWING_MAX_BYTES = 20L * 1024L * 1024L;
    private static final Set<String> DRAWING_EXTENSIONS = Set.of("pdf", "jpg", "jpeg", "png", "webp", "dwg", "dxf");

    private static final List<CheckDefinition> DESIGN_CHECKLIST = List.of(
            check("DES-01", "Product identification, PD / Project and Product / Drawing are confirmed.", false),
            check("DES-02", "Drawing number and the submission revision are confirmed.", false),
            check("DES-03", "Product dimensions are complete as L × B × H with the correct unit.", false),
            check("DES-04", "Material and finish specifications required for Engineering are identified.", true),
            check("DES-05", "Hardware requirements, codes or specifications required for Engineering are identified.", true),
            check("DES-06", "Relevant site measurement, interface and installation details are attached or confirmed.", true),
            check("DES-07", "Unresolved design queries are listed, with enough information for Engineering to proceed.", true));

    private static final List<CheckDefinition> GENERAL_ENGINEERING_CHECKLIST = List.of(
            check("ENG-01", "Drawing dimensions have been checked against the approved design / site information.", false),
            check("ENG-02", "Manufacturing and construction details required for Production are complete.", false),
            check("ENG-03", "Operational BOM material quantities and UOMs have been checked.", false),
            check("ENG-04", "Hardware, finish and specification details match the Production drawing and BOM.", true),
            check("ENG-05", "Relevant Processing / Production requirements and routing requirements have been checked.", true),
            check("ENG-06", "The correct Production drawing revision and BOM revision are selected for handover.", false));

    private static final List<CheckDefinition> WARDROBE_CHECKLIST = List.of(
            check("WRD-01", "Production drawings must be as per site measurements.", false),
            check("WRD-02", "Production drawings must be signed by the site supervisor.", true),
            check("WRD-03", "Shutter height should not exceed 3000 mm (add loft if required).", true),
            check("WRD-04", "Shutter width should not exceed 600 mm.", true),
            check("WRD-05", "Maximum thickness of a solid shutter should be 26 mm.", true),
            check("WRD-06", "Carcass height should not exceed 2400 mm (add loft if required).", true),
            check("WRD-07", "Back Ply should not exceed 1200 mm.", true),
            check("WRD-08", "Dummy side finish must be confirmed.", true),
            check("WRD-09", "Veneer grain direction must always be shown.", true),
            check("WRD-10", "Fluting detail blow-ups must always be shown.", true),
            check("WRD-11", "Handle cut blow-up details must always be shown.", true),
            check("WRD-12", "Sliding fitting code must be mentioned.", true),
            check("WRD-13", "Add joint lines in fillers if size exceeds 3000 mm.", true),
            check("WRD-14", "External shutter and drawer handle codes and sizes are required.", true),
            check("WRD-15", "External lock dimensions must be specified from floor level.", true),
            check("WRD-16", "Backside finish of mirror shutters must be specified.", true),
            check("WRD-17", "Backside finish of leather, fabric, wallpaper, and tile shutters must be specified.", true),
            check("WRD-18", "Cross-check all elevation dimensions with plans and sections.", false),
            check("WRD-19", "Internal laminate company name and code must be properly mentioned.", true),
            check("WRD-20", "Internal handle codes must be specified.", true),
            check("WRD-21", "Wooden part in glass pull-out must be a minimum of 95 mm in height.", true),
            check("WRD-22", "Key lock/digital lock is not possible on drawer fronts in case of end-to-end handle cuts.", true),
            check("WRD-23", "Lucas shelf (metal & glass) must be confirmed.", true),
            check("WRD-24", "Confirm whether Lucas shelf lighting is required on one side or both sides.", true),
            check("WRD-25", "Toughened glass shelf thickness should be 8 mm.", true),
            check("WRD-26", "Internal lit-up shelf lighting detail blow-ups are required.", true),
            check("WRD-27", "Trouser pull-out available sizes: 564 mm and 864 mm.", true),
            check("WRD-28", "Locker & watch winder (by Alsorg or client) must be specified.", true),
            check("WRD-29", "Accessory drawer suede code must be mentioned.", true),
            check("WRD-30", "Hanging rod name/specification must be mentioned.", true),
            check("WRD-31", "Hanging Rod height from floor level must be specified.", true),
            check("WRD-32", "In case of single shutter wardrobe - Runner panel of the drawer will be only one side (only hinge side).", true));

    private final MatFlowAuditLogRepository auditRepository;
    private final MatFlowAuditService auditService;
    private final MatFlowAccessService accessService;
    private final MatFlowProjectService projectService;
    private final MatFlowBomService bomService;
    private final UserService userService;
    private final ObjectMapper objectMapper;
    private final Path attachmentRoot;

    public MatFlowWorkspaceService(
            MatFlowAuditLogRepository auditRepository,
            MatFlowAuditService auditService,
            MatFlowAccessService accessService,
            MatFlowProjectService projectService,
            MatFlowBomService bomService,
            UserService userService,
            ObjectMapper objectMapper,
            @Value("${matflow.product-attachment-dir:}") String configuredAttachmentDirectory) {
        this.auditRepository = auditRepository;
        this.auditService = auditService;
        this.accessService = accessService;
        this.projectService = projectService;
        this.bomService = bomService;
        this.userService = userService;
        this.objectMapper = objectMapper;
        this.attachmentRoot = resolveAttachmentRoot(configuredAttachmentDirectory);
        try {
            Files.createDirectories(this.attachmentRoot);
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to initialize MatFlow workflow drawing directory", ex);
        }
    }

    /* =============================== DESIGN SUBMISSIONS =============================== */

    @Transactional(readOnly = true)
    public List<DesignSubmissionResponse> listDesignSubmissions(
            String plantCode, String status, String search, UUID productId) {
        accessService.requireRead();
        String plant = cleanUpper(plantCode);
        if (plant != null) accessService.requirePlantAccess(plant);
        String wantedStatus = cleanUpper(status);
        String query = cleanLower(search);
        return latestStates(DESIGN_ENTITY).stream()
                .map(this::toDesignResponse)
                .filter(Objects::nonNull)
                .filter(row -> canReadPlant(row.plantCode()))
                .filter(row -> plant == null || plant.equals(cleanUpper(row.plantCode())))
                .filter(row -> wantedStatus == null || wantedStatus.equals(cleanUpper(row.status())))
                .filter(row -> productId == null || productId.equals(row.productId()))
                .filter(row -> designMatches(row, query))
                .sorted(Comparator.comparing(DesignSubmissionResponse::updatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    @Transactional(readOnly = true)
    public DesignSubmissionDetailResponse getDesignSubmission(UUID id) {
        accessService.requireRead();
        Map<String, Object> state = requireState(DESIGN_ENTITY, id, "Design submission");
        DesignSubmissionResponse response = toDesignResponse(state);
        requireCanReadPlant(response.plantCode());
        return new DesignSubmissionDetailResponse(response, history(DESIGN_ENTITY, id));
    }

    @Transactional
    public DesignSubmissionDetailResponse createDesignSubmission(DesignSubmissionCreateRequest request) {
        requireDesignWrite();
        if (request == null || request.projectId() == null || request.productId() == null) {
            throw badRequest("Project and Product are required");
        }
        ProjectProductRef ref = requireProduct(request.projectId(), request.productId());
        accessService.requirePlantAccess(ref.project().plantCode());

        /*
         * Draft means draft: Project/Product are the only hard requirements at
         * creation time. Designing can attach/complete the drawing revision,
         * Head/Production routing and checklist later. The strict gate is the
         * Submit to Engineering action below, not Product/submission creation.
         */
        String actor = accessService.actor();
        String designer = clean(request.designer());
        if (designer == null) designer = actor;
        requirePersonRole(designer, ref.project().plantCode(),
                Set.of("ADMIN", "MATFLOW_MANAGER", "MATFLOW_ENGINEERING"), "Designer / Designing owner");

        String designRevision = clean(request.designDrawingRevision());
        String engineeringHead = clean(request.engineeringHead());
        String productionRecipient = clean(request.productionRecipient());
        if (engineeringHead != null) {
            requirePersonRole(engineeringHead, ref.project().plantCode(),
                    Set.of("ADMIN", "MATFLOW_MANAGER"), "Engineering Head");
        }
        if (productionRecipient != null) {
            requirePersonRole(productionRecipient, ref.project().plantCode(),
                    Set.of("ADMIN", "MATFLOW_MANAGER", "MATFLOW_PRODUCTION"), "Production recipient");
        }

        UUID id = UUID.randomUUID();
        String now = LocalDateTime.now().toString();
        Map<String, Object> state = new LinkedHashMap<>();
        state.put("id", id.toString());
        state.put("submissionNumber", submissionNumber(id));
        state.put("status", "DRAFT");
        applyProjectProductSnapshot(state, ref);
        state.put("productMasterRevisionAtCreation", ref.product().drawingRevision());
        state.put("designDrawingRevision", designRevision);
        state.put("designer", designer);
        state.put("engineeringHead", engineeringHead);
        state.put("productionRecipient", productionRecipient);
        state.put("engineeringChecklistTemplateKey", engineeringTemplate(request.engineeringChecklistTemplateKey()));
        state.put("reference", clean(request.reference()));
        state.put("companyCode", companyCode(request.companyCode()));
        state.put("remarks", clean(request.remarks()));
        state.put("designDrawing", emptyFile());
        state.put("checklist", newChecklist(DESIGN_CHECKLIST));
        state.put("taskId", null);
        state.put("version", 1);
        state.put("createdBy", actor);
        state.put("createdAt", now);
        state.put("updatedBy", actor);
        state.put("updatedAt", now);
        record(DESIGN_ENTITY, id, "DESIGN_SUBMISSION_DRAFT_CREATED", state);
        return getDesignSubmission(id);
    }

    @Transactional
    public DesignSubmissionDetailResponse updateDesignSubmission(UUID id, DesignSubmissionUpdateRequest request) {
        requireDesignWrite();
        if (request == null) throw badRequest("Design submission update is required");
        Map<String, Object> state = requireState(DESIGN_ENTITY, id, "Design submission");
        requireDesignOwnerOrManager(state);
        assertVersion(request.version(), integer(state.get("version"), 0), "Design submission");
        requireDesignEditable(state);

        String plant = string(state.get("plantCode"));
        if (request.designer() != null) {
            String designer = requiredText(request.designer(), "Designer / Designing owner");
            requirePersonRole(designer, plant,
                    Set.of("ADMIN", "MATFLOW_MANAGER", "MATFLOW_ENGINEERING"),
                    "Designer / Designing owner");
            state.put("designer", designer);
        }
        if (request.designDrawingRevision() != null) state.put("designDrawingRevision", requiredText(request.designDrawingRevision(), "Design drawing revision"));
        if (request.engineeringHead() != null) {
            String head = requiredText(request.engineeringHead(), "Engineering Head");
            requirePersonRole(head, plant, Set.of("ADMIN", "MATFLOW_MANAGER"), "Engineering Head");
            state.put("engineeringHead", head);
        }
        if (request.productionRecipient() != null) {
            String recipient = requiredText(request.productionRecipient(), "Production recipient");
            requirePersonRole(recipient, plant, Set.of("ADMIN", "MATFLOW_MANAGER", "MATFLOW_PRODUCTION"), "Production recipient");
            state.put("productionRecipient", recipient);
        }
        if (request.engineeringChecklistTemplateKey() != null) {
            state.put("engineeringChecklistTemplateKey", engineeringTemplate(request.engineeringChecklistTemplateKey()));
        }
        if (request.reference() != null) state.put("reference", clean(request.reference()));
        if (request.companyCode() != null) state.put("companyCode", companyCode(request.companyCode()));
        if (request.remarks() != null) state.put("remarks", clean(request.remarks()));
        touch(state);
        record(DESIGN_ENTITY, id, "DESIGN_SUBMISSION_UPDATED", state);
        return getDesignSubmission(id);
    }

    @Transactional
    public DesignSubmissionDetailResponse updateDesignChecklist(
            UUID id, String itemKey, ChecklistItemUpdateRequest request) {
        requireDesignWrite();
        if (request == null) throw badRequest("Checklist update is required");
        Map<String, Object> state = requireState(DESIGN_ENTITY, id, "Design submission");
        requireDesignOwnerOrManager(state);
        assertVersion(request.version(), integer(state.get("version"), 0), "Design submission");
        requireDesignEditable(state);
        updateChecklistItem(state, itemKey, request);
        touch(state);
        record(DESIGN_ENTITY, id, "DESIGN_CHECKLIST_UPDATED", state);
        return getDesignSubmission(id);
    }

    @Transactional
    public DesignSubmissionDetailResponse uploadDesignDrawing(
            UUID id, String revision, MultipartFile file, Integer version) {
        requireDesignWrite();
        Map<String, Object> state = requireState(DESIGN_ENTITY, id, "Design submission");
        requireDesignOwnerOrManager(state);
        assertVersion(version, integer(state.get("version"), 0), "Design submission");
        requireDesignEditable(state);
        String cleanRevision = requiredText(revision, "Design drawing revision");
        state.put("designDrawingRevision", cleanRevision);
        state.put("designDrawing", saveWorkflowFile(state, "design", cleanRevision, file));
        touch(state);
        record(DESIGN_ENTITY, id, "DESIGN_DRAWING_UPLOADED", state);
        return getDesignSubmission(id);
    }

    @Transactional
    public DesignSubmissionDetailResponse submitDesignSubmission(UUID id, Integer version) {
        requireDesignWrite();
        Map<String, Object> state = requireState(DESIGN_ENTITY, id, "Design submission");
        requireDesignOwnerOrManager(state);
        assertVersion(version, integer(state.get("version"), 0), "Design submission");
        String status = cleanUpper(string(state.get("status")));
        if (!Set.of("DRAFT", "RETURNED_FOR_CLARIFICATION").contains(status)) {
            throw conflict("Only Draft or Returned-for-Clarification design submissions can be submitted");
        }
        requireSubmissionReady(state);
        state.put("status", "SUBMITTED_TO_ENGINEERING");
        state.put("submittedBy", accessService.actor());
        state.put("submittedAt", LocalDateTime.now().toString());
        state.put("returnReason", null);
        touch(state);
        record(DESIGN_ENTITY, id, "DESIGN_SUBMITTED_TO_ENGINEERING", state);
        flagOpenTasksForNewRevision(state);
        return getDesignSubmission(id);
    }

    @Transactional
    public DesignSubmissionDetailResponse reviewDesignSubmission(UUID id, DesignSubmissionActionRequest request) {
        requireEngineeringHead();
        if (request == null) throw badRequest("Design review action is required");
        Map<String, Object> state = requireState(DESIGN_ENTITY, id, "Design submission");
        requireCanReadPlant(string(state.get("plantCode")));
        assertVersion(request.version(), integer(state.get("version"), 0), "Design submission");
        if (!"SUBMITTED_TO_ENGINEERING".equals(cleanUpper(string(state.get("status"))))) {
            throw conflict("Only a Design submission waiting with Engineering can be reviewed");
        }
        String actor = accessService.actor();
        String assignedHead = clean(string(state.get("engineeringHead")));
        if (!isManager() && !same(actor, assignedHead)) {
            throw forbidden("This Design submission is assigned to Engineering Head " + assignedHead);
        }

        String action = cleanUpper(request.action());
        if ("RETURN".equals(action)) {
            String reason = requiredText(request.note(), "Return / clarification reason");
            state.put("status", "RETURNED_FOR_CLARIFICATION");
            state.put("returnReason", reason);
            state.put("reviewedBy", actor);
            state.put("reviewedAt", LocalDateTime.now().toString());
            touch(state);
            record(DESIGN_ENTITY, id, "DESIGN_RETURNED_FOR_CLARIFICATION", state);
            clearRevisionReviewFlagsForSubmission(id, "DESIGN_REVISION_REVIEW_CLEARED_AFTER_RETURN");
            return getDesignSubmission(id);
        }
        if (!"ACCEPT".equals(action)) {
            throw badRequest("Design review action must be ACCEPT or RETURN");
        }

        UUID taskId = uuid(state.get("taskId"));
        if (taskId == null) {
            taskId = createTaskFromSubmission(state, request);
            state.put("taskId", taskId.toString());
        }
        supersedeOlderTasksForAcceptedRevision(state, taskId);
        state.put("status", "ACCEPTED");
        state.put("reviewedBy", actor);
        state.put("reviewedAt", LocalDateTime.now().toString());
        state.put("returnReason", null);
        touch(state);
        record(DESIGN_ENTITY, id, "DESIGN_ACCEPTED_BY_ENGINEERING", state);
        return getDesignSubmission(id);
    }

    /* =============================== ENGINEERING TASKS =============================== */

    @Transactional(readOnly = true)
    public List<EngineeringTaskResponse> listTasks(String plantCode, String status, String scope, String search) {
        accessService.requireRead();
        String plant = cleanUpper(plantCode);
        if (plant != null) accessService.requirePlantAccess(plant);
        String wantedStatus = cleanUpper(status);
        String actor = accessService.actor();
        String wantedScope = cleanUpper(scope);
        String query = cleanLower(search);
        boolean manager = isManager() || isEngineeringHead();

        return latestStates(TASK_ENTITY).stream()
                .map(state -> toTaskResponse(state, false))
                .filter(Objects::nonNull)
                .filter(row -> canReadPlant(row.plantCode()))
                .filter(row -> plant == null || plant.equals(cleanUpper(row.plantCode())))
                .filter(row -> wantedStatus == null || wantedStatus.equals(cleanUpper(row.status())))
                .filter(row -> taskScopeAllows(row, wantedScope, actor, manager))
                .filter(row -> taskMatches(row, query))
                .sorted(taskComparator(actor))
                .toList();
    }

    @Transactional(readOnly = true)
    public EngineeringTaskDetailResponse getTask(UUID id) {
        accessService.requireRead();
        Map<String, Object> state = requireState(TASK_ENTITY, id, "Engineering task");
        EngineeringTaskResponse response = toTaskResponse(state, true);
        requireCanReadTask(response);
        return new EngineeringTaskDetailResponse(response, history(TASK_ENTITY, id));
    }

    @Transactional
    public EngineeringTaskDetailResponse assignTask(UUID id, EngineeringTaskAssignRequest request) {
        requireEngineeringHead();
        if (request == null) throw badRequest("Task assignment is required");
        Map<String, Object> state = requireState(TASK_ENTITY, id, "Engineering task");
        EngineeringTaskResponse current = toTaskResponse(state, false);
        requireCanReadPlant(current.plantCode());
        assertVersion(request.version(), current.version(), "Engineering task");
        if (Set.of("COMPLETED", "SUPERSEDED", "CANCELLED", "SUBMITTED_TO_PRODUCTION").contains(cleanUpper(current.status()))) {
            throw conflict("This task cannot be reassigned in its current status");
        }
        String assignedTo = requiredText(request.assignedTo(), "Assigned engineer");
        requirePersonRole(assignedTo, current.plantCode(),
                Set.of("ADMIN", "MATFLOW_MANAGER", "MATFLOW_ENGINEERING"),
                "Engineering assignee");
        state.put("assignedTo", assignedTo);
        state.put("dueDate", request.dueDate() == null ? string(state.get("dueDate")) : isoDate(request.dueDate(), "Due date"));
        state.put("priority", request.priority() == null ? string(state.get("priority")) : priority(request.priority()));
        state.put("status", "ASSIGNED");
        appendNote(state, request.note(), "assignmentNote");
        touch(state);
        record(TASK_ENTITY, id, "ENGINEERING_TASK_ASSIGNED", state);
        return getTask(id);
    }

    @Transactional
    public EngineeringTaskDetailResponse updateTask(UUID id, EngineeringTaskUpdateRequest request) {
        if (request == null) throw badRequest("Task update is required");
        Map<String, Object> state = requireState(TASK_ENTITY, id, "Engineering task");
        EngineeringTaskResponse current = toTaskResponse(state, false);
        requireTaskWorkerOrHead(current);
        assertVersion(request.version(), current.version(), "Engineering task");
        if (Set.of("SUBMITTED_TO_PRODUCTION", "COMPLETED", "SUPERSEDED", "CANCELLED").contains(cleanUpper(current.status()))) {
            throw conflict("Submitted / completed / superseded / cancelled tasks are read-only");
        }
        if (request.dueDate() != null) state.put("dueDate", isoDate(request.dueDate(), "Due date"));
        if (request.priority() != null) state.put("priority", priority(request.priority()));
        if (request.outstandingIssues() != null) state.put("outstandingIssues", clean(request.outstandingIssues()));
        if (request.remarks() != null) state.put("remarks", clean(request.remarks()));
        if (request.productionRecipient() != null) {
            if (!isManager() && !isEngineeringHead()) throw forbidden("Only Engineering Head / Manager can change the Production recipient");
            String recipient = requiredText(request.productionRecipient(), "Production recipient");
            requirePersonRole(recipient, current.plantCode(), Set.of("ADMIN", "MATFLOW_MANAGER", "MATFLOW_PRODUCTION"), "Production recipient");
            state.put("productionRecipient", recipient);
        }
        touch(state);
        record(TASK_ENTITY, id, "ENGINEERING_TASK_UPDATED", state);
        return getTask(id);
    }

    @Transactional
    public EngineeringTaskDetailResponse updateTaskChecklist(
            UUID id, String itemKey, ChecklistItemUpdateRequest request) {
        if (request == null) throw badRequest("Checklist update is required");
        Map<String, Object> state = requireState(TASK_ENTITY, id, "Engineering task");
        EngineeringTaskResponse current = toTaskResponse(state, false);
        requireTaskWorkerOrHead(current);
        assertVersion(request.version(), current.version(), "Engineering task");
        if (Set.of("SUBMITTED_TO_PRODUCTION", "COMPLETED", "SUPERSEDED", "CANCELLED").contains(cleanUpper(current.status()))) {
            throw conflict("Engineering checklist is locked after Production handover / supersession");
        }
        updateChecklistItem(state, itemKey, request);
        touch(state);
        record(TASK_ENTITY, id, "ENGINEERING_CHECKLIST_UPDATED", state);
        return getTask(id);
    }

    @Transactional
    public EngineeringTaskDetailResponse setTaskStatus(UUID id, EngineeringTaskStatusRequest request) {
        if (request == null) throw badRequest("Task status action is required");
        Map<String, Object> state = requireState(TASK_ENTITY, id, "Engineering task");
        EngineeringTaskResponse current = toTaskResponse(state, true);
        requireTaskWorkerOrHead(current);
        assertVersion(request.version(), current.version(), "Engineering task");
        String next = cleanUpper(request.status());
        if (!TASK_STATUSES.contains(next)) throw badRequest("Unsupported Engineering task status: " + request.status());
        String before = cleanUpper(current.status());
        if (Objects.equals(before, next)) return getTask(id);
        validateTaskTransition(current, next);

        if ("IN_PROGRESS".equals(next) && state.get("startedAt") == null) {
            state.put("startedAt", LocalDateTime.now().toString());
        }
        if ("AWAITING_CLARIFICATION".equals(next)) {
            state.put("outstandingIssues", firstNonBlank(request.note(), string(state.get("outstandingIssues"))));
        }
        if ("RETURNED".equals(next)) {
            if (!current.productionReturnPending() && !"AWAITING_CLARIFICATION".equals(before)) {
                throw conflict("Returned status is available when Production has returned the linked BOM or when clarification work is being resumed");
            }
        }
        if ("COMPLETED".equals(next)) {
            ensureTaskRevisionCurrent(current, "Engineering task closure");
            LinkedBomResponse linked = current.linkedBom();
            if (linked == null || !linked.effective() || !"APPROVED".equals(cleanUpper(linked.status()))) {
                throw conflict("Engineering task can be completed only after the linked BOM is Production-reviewed and effective");
            }
            state.put("completedBy", accessService.actor());
            state.put("completedAt", LocalDateTime.now().toString());
        }
        state.put("status", next);
        appendNote(state, request.note(), "statusNote");
        touch(state);
        record(TASK_ENTITY, id, "ENGINEERING_TASK_STATUS_" + next, state);
        return getTask(id);
    }

    @Transactional
    public EngineeringTaskDetailResponse uploadProductionDrawing(
            UUID id, String revision, MultipartFile file, Integer version) {
        Map<String, Object> state = requireState(TASK_ENTITY, id, "Engineering task");
        EngineeringTaskResponse current = toTaskResponse(state, false);
        requireTaskWorkerOrHead(current);
        assertVersion(version, current.version(), "Engineering task");
        if (Set.of("SUBMITTED_TO_PRODUCTION", "COMPLETED", "SUPERSEDED", "CANCELLED").contains(cleanUpper(current.status()))) {
            throw conflict("Production drawing is locked after handover / supersession");
        }
        String cleanRevision = requiredText(revision, "Engineering Production drawing revision");
        state.put("engineeringDrawingRevision", cleanRevision);
        state.put("productionDrawing", saveWorkflowFile(state, "engineering", cleanRevision, file));
        touch(state);
        record(TASK_ENTITY, id, "ENGINEERING_PRODUCTION_DRAWING_UPLOADED", state);
        return getTask(id);
    }

    @Transactional
    public EngineeringTaskDetailResponse handoverToProduction(UUID id, EngineeringHandoverRequest request) {
        if (request == null || request.bomId() == null) throw badRequest("BOM is required for Production handover");
        Map<String, Object> state = requireState(TASK_ENTITY, id, "Engineering task");
        EngineeringTaskResponse current = toTaskResponse(state, false);
        requireTaskWorkerOrHead(current);
        /*
         * The existing MatFlowBomService.submit(...) gate is Engineering-owned.
         * Keep this handover aligned with that unchanged BOM workflow: an
         * Engineering Head may manage/review the task, but a head-only profile
         * does not silently gain BOM-edit/submission authority.
         */
        requireAnyRole("ADMIN", "MATFLOW_MANAGER", "MATFLOW_ENGINEERING");
        assertVersion(request.version(), current.version(), "Engineering task");
        String status = cleanUpper(current.status());
        if (!Set.of("ASSIGNED", "IN_PROGRESS", "RETURNED", "AWAITING_CLARIFICATION").contains(status)) {
            throw conflict("Task is not in an Engineering-working status");
        }
        ensureTaskRevisionCurrent(current, "Production handover");
        if (!checklistProgress(checklistMaps(state)).complete()) {
            throw conflict("Complete the Engineering checklist before Production handover");
        }
        Map<String, Object> file = map(state.get("productionDrawing"));
        String engineeringRevision = clean(string(state.get("engineeringDrawingRevision")));
        if (!bool(file.get("available")) || engineeringRevision == null) {
            throw conflict("Upload the exact Engineering Production drawing revision before handover");
        }
        String uploadedEngineeringRevision = clean(string(file.get("revision")));
        if (uploadedEngineeringRevision == null || !same(engineeringRevision, uploadedEngineeringRevision)) {
            throw conflict("The uploaded Engineering Production drawing revision does not match the handover revision. Upload the exact revision before handover");
        }

        BomDetailResponse bom = bomService.get(request.bomId());
        if (bom.project() == null || !Objects.equals(current.productId(), bom.project().id())) {
            throw conflict("Selected BOM does not belong to this Engineering task Product / Drawing");
        }
        if (!bom.latestRevision()) {
            throw conflict("Only the latest BOM revision can be handed over to Production");
        }
        String bomStatus = bom.status() == null ? "" : bom.status().name();
        if (!Set.of("DRAFT", "RETURNED").contains(bomStatus)) {
            throw conflict("Only a Draft or Production-returned BOM can be handed over");
        }
        if (request.bomRowVersion() == null || !Objects.equals(request.bomRowVersion(), bom.rowVersion())) {
            throw conflict("BOM changed after it was selected. Refresh and retry the handover");
        }

        BomDetailResponse submitted = bomService.submit(
                request.bomId(),
                new BomActionRequest(request.bomRowVersion(), clean(request.handoverRemarks())));

        state.put("linkedBomId", submitted.id().toString());
        state.put("linkedBomNumber", submitted.bomNumber());
        state.put("linkedBomRevision", submitted.revisionNo());
        state.put("linkedBomStatusAtHandover", submitted.status() == null ? null : submitted.status().name());
        state.put("handoverRemarks", clean(request.handoverRemarks()));
        state.put("handedOverBy", accessService.actor());
        state.put("handedOverAt", LocalDateTime.now().toString());
        state.put("status", "SUBMITTED_TO_PRODUCTION");
        state.put("revisionReviewRequired", false);
        state.put("pendingDesignSubmissionId", null);
        state.put("pendingDesignRevision", null);
        touch(state);
        record(TASK_ENTITY, id, "ENGINEERING_PACKAGE_SUBMITTED_TO_PRODUCTION", state);
        return getTask(id);
    }

    /* =============================== CONTEXT / PEOPLE / TEMPLATES =============================== */

    @Transactional(readOnly = true)
    public ProductEngineeringContextResponse productContext(UUID projectId, UUID productId) {
        accessService.requireRead();
        ProjectProductRef ref = requireProduct(projectId, productId);
        List<DesignSubmissionResponse> submissions = listDesignSubmissions(ref.project().plantCode(), null, null, productId);
        List<EngineeringTaskResponse> tasks = latestStates(TASK_ENTITY).stream()
                .filter(state -> productId.equals(uuid(state.get("productId"))))
                .map(state -> toTaskResponse(state, true))
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(EngineeringTaskResponse::updatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
        List<LinkedBomResponse> boms = bomService.list(null, null, false).stream()
                .filter(row -> productId.equals(row.projectDrawingId()))
                .sorted(Comparator.comparing(BomSummaryResponse::revisionNo, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::linkedBomFromSummary)
                .toList();
        return new ProductEngineeringContextResponse(
                ref.project().id(), ref.product().id(), ref.project().projectCode(), ref.project().projectName(),
                ref.project().clientName(), ref.project().plantCode(), ref.product().productName(), ref.product().drawingNo(),
                ref.product().drawingRevision(), submissions, tasks, boms, LocalDateTime.now().toString());
    }

    @Transactional(readOnly = true)
    public List<WorkspacePerson> people(String plantCode) {
        accessService.requireRead();
        String plant = cleanUpper(plantCode);
        if (plant != null) accessService.requirePlantAccess(plant);
        return userService.getAllUsers().stream()
                .filter(User::isEnabled)
                .filter(this::isMatFlowPerson)
                .filter(user -> plant == null || canUserAccessPlant(user, plant))
                .map(user -> {
                    Set<String> roles = normalizedRoles(user);
                    return new WorkspacePerson(
                            user.getUsername(), user.getUsername(), roles.stream().sorted().toList(),
                            user.getEffectivePlantCodes().stream().sorted().toList(),
                            hasAny(roles, "ADMIN", "MATFLOW_MANAGER", "MATFLOW_ENGINEERING"),
                            hasAny(roles, "ADMIN", "MATFLOW_MANAGER"),
                            hasAny(roles, "ADMIN", "MATFLOW_MANAGER", "MATFLOW_ENGINEERING"),
                            hasAny(roles, "ADMIN", "MATFLOW_MANAGER", "MATFLOW_PRODUCTION"));
                })
                .sorted(Comparator.comparing(WorkspacePerson::username, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ChecklistTemplateResponse> templates() {
        accessService.requireRead();
        return List.of(
                template(DESIGN_TEMPLATE, "Design Submission Checklist", "DESIGN", DESIGN_CHECKLIST,
                        "Mandatory at Submit to Engineering; Product may still be saved as a normal approval-free draft."),
                template(WARDROBE_TEMPLATE, "Wardrobe Engineering Checklist", "ENGINEERING / WARDROBE", WARDROBE_CHECKLIST,
                        "32-point Wardrobe production-drawing checklist captured from the supplied Engineering standard."),
                template(GENERAL_ENGINEERING_TEMPLATE, "General Engineering Handover Checklist", "ENGINEERING", GENERAL_ENGINEERING_CHECKLIST,
                        "Generic Engineering handover controls for non-Wardrobe Products. Template definitions can be extended without rewriting old task snapshots."));
    }

    /* =============================== NOTIFICATIONS =============================== */

    @Transactional(readOnly = true)
    public WorkspaceNotificationFeedResponse notifications(String plantCode, Integer limit) {
        accessService.requireRead();
        String plant = cleanUpper(plantCode);
        if (plant != null) accessService.requirePlantAccess(plant);
        int max = Math.max(1, Math.min(limit == null ? 40 : limit, 100));
        String actor = accessService.actor();
        List<WorkspaceNotificationResponse> all = new ArrayList<>();

        for (Map<String, Object> state : latestStates(DESIGN_ENTITY)) {
            DesignSubmissionResponse row = toDesignResponse(state);
            if (row == null || !canReadPlant(row.plantCode()) || (plant != null && !plant.equals(cleanUpper(row.plantCode())))) continue;
            if (!designNotificationRelevant(row, actor)) continue;
            all.add(designNotification(row, actor));
        }
        for (Map<String, Object> state : latestStates(TASK_ENTITY)) {
            EngineeringTaskResponse row = toTaskResponse(state, false);
            if (row == null || !canReadPlant(row.plantCode()) || (plant != null && !plant.equals(cleanUpper(row.plantCode())))) continue;
            if (!taskNotificationRelevant(row, actor)) continue;
            all.add(taskNotification(row, actor));
        }
        all.sort(Comparator.comparing(WorkspaceNotificationResponse::updatedAt,
                Comparator.nullsLast(Comparator.reverseOrder())));
        int unread = (int) all.stream().filter(row -> !row.read()).count();
        return new WorkspaceNotificationFeedResponse(unread, all.stream().limit(max).toList(), LocalDateTime.now().toString());
    }

    @Transactional
    public WorkspaceNotificationFeedResponse markNotificationRead(
            String referenceType, UUID referenceId, String plantCode) {
        accessService.requireRead();
        String entityType = notificationEntity(referenceType);
        Map<String, Object> state = requireState(entityType, referenceId, "Notification source");
        requireCanReadPlant(string(state.get("plantCode")));
        String actor = accessService.actor();
        auditService.record(
                RECEIPT_ENTITY,
                receiptId(entityType, referenceId, actor),
                "READ",
                string(state.get("plantCode")),
                string(state.get("projectCode")),
                string(state.get("drawingNo")),
                auditService.details(
                        "referenceType", entityType,
                        "referenceId", referenceId.toString(),
                        "username", actor,
                        "readAt", LocalDateTime.now().toString(),
                        "sourceUpdatedAt", string(state.get("updatedAt"))));
        return notifications(plantCode, 40);
    }

    @Transactional
    public WorkspaceNotificationFeedResponse markAllNotificationsRead(String plantCode) {
        WorkspaceNotificationFeedResponse feed = notifications(plantCode, 100);
        for (WorkspaceNotificationResponse row : feed.notifications()) {
            if (!row.read()) markNotificationRead(row.referenceType(), row.referenceId(), plantCode);
        }
        return notifications(plantCode, 40);
    }

    /* =============================== DRAWING DOWNLOAD =============================== */

    @Transactional(readOnly = true)
    public WorkspaceFileResource designDrawing(UUID id) {
        Map<String, Object> state = requireState(DESIGN_ENTITY, id, "Design submission");
        requireCanReadPlant(string(state.get("plantCode")));
        return fileResource(map(state.get("designDrawing")));
    }

    @Transactional(readOnly = true)
    public WorkspaceFileResource productionDrawing(UUID id) {
        Map<String, Object> state = requireState(TASK_ENTITY, id, "Engineering task");
        requireCanReadPlant(string(state.get("plantCode")));
        return fileResource(map(state.get("productionDrawing")));
    }

    public record WorkspaceFileResource(Resource resource, String contentType, String fileName) {}

    /* =============================== RESPONSE MAPPING =============================== */

    private DesignSubmissionResponse toDesignResponse(Map<String, Object> state) {
        if (state == null || state.isEmpty() || uuid(state.get("id")) == null) return null;
        List<ChecklistItemResponse> checklist = checklistResponse(state);
        return new DesignSubmissionResponse(
                uuid(state.get("id")), string(state.get("submissionNumber")), string(state.get("status")),
                uuid(state.get("projectId")), uuid(state.get("productId")), string(state.get("projectCode")),
                string(state.get("projectName")), string(state.get("clientName")), string(state.get("plantCode")),
                string(state.get("productName")), string(state.get("drawingNo")), string(state.get("productMasterRevisionAtCreation")),
                string(state.get("designDrawingRevision")), string(state.get("designer")), string(state.get("engineeringHead")),
                string(state.get("productionRecipient")), string(state.get("engineeringChecklistTemplateKey")),
                string(state.get("reference")), string(state.get("companyCode")), string(state.get("remarks")),
                string(state.get("submittedBy")), string(state.get("submittedAt")), string(state.get("reviewedBy")),
                string(state.get("reviewedAt")), string(state.get("returnReason")), uuid(state.get("taskId")),
                integer(state.get("version"), 1), string(state.get("createdBy")), string(state.get("createdAt")),
                string(state.get("updatedBy")), string(state.get("updatedAt")), fileResponse(map(state.get("designDrawing"))),
                checklistProgress(checklistMaps(state)), checklist);
    }

    private EngineeringTaskResponse toTaskResponse(Map<String, Object> state, boolean hydrateBom) {
        if (state == null || state.isEmpty() || uuid(state.get("id")) == null) return null;
        LinkedBomResponse linked = hydrateBom ? liveLinkedBom(state) : snapshotLinkedBom(state);
        boolean returned = linked != null && "RETURNED".equals(cleanUpper(linked.status()))
                && "SUBMITTED_TO_PRODUCTION".equals(cleanUpper(string(state.get("status"))));
        String due = string(state.get("dueDate"));
        String status = string(state.get("status"));
        return new EngineeringTaskResponse(
                uuid(state.get("id")), string(state.get("taskNumber")), status, string(state.get("priority")),
                uuid(state.get("submissionId")), uuid(state.get("projectId")), uuid(state.get("productId")),
                string(state.get("projectCode")), string(state.get("projectName")), string(state.get("clientName")),
                string(state.get("plantCode")), string(state.get("productName")), string(state.get("drawingNo")),
                string(state.get("designDrawingRevision")), string(state.get("engineeringDrawingRevision")),
                string(state.get("engineeringHead")), string(state.get("assignedTo")), string(state.get("productionRecipient")),
                due, string(state.get("startedAt")), string(state.get("outstandingIssues")), string(state.get("remarks")),
                string(state.get("handoverRemarks")), string(state.get("handedOverBy")), string(state.get("handedOverAt")),
                bool(state.get("revisionReviewRequired")), uuid(state.get("pendingDesignSubmissionId")), string(state.get("pendingDesignRevision")),
                string(state.get("checklistTemplateKey")), checklistProgress(checklistMaps(state)), checklistResponse(state),
                fileResponse(map(state.get("designDrawing"))), fileResponse(map(state.get("productionDrawing"))),
                linked, returned, isOverdue(due, status), integer(state.get("version"), 1),
                string(state.get("createdBy")), string(state.get("createdAt")), string(state.get("updatedBy")), string(state.get("updatedAt")));
    }

    private LinkedBomResponse liveLinkedBom(Map<String, Object> state) {
        UUID bomId = uuid(state.get("linkedBomId"));
        if (bomId == null) return null;
        try {
            return linkedBom(bomService.get(bomId));
        } catch (RuntimeException ignored) {
            return snapshotLinkedBom(state);
        }
    }

    private LinkedBomResponse snapshotLinkedBom(Map<String, Object> state) {
        UUID id = uuid(state.get("linkedBomId"));
        if (id == null) return null;
        return new LinkedBomResponse(id, string(state.get("linkedBomNumber")), integerObject(state.get("linkedBomRevision")),
                string(state.get("linkedBomStatusAtHandover")), false, null, null, null, null, null, null, null, null, null);
    }

    private LinkedBomResponse linkedBom(BomDetailResponse bom) {
        if (bom == null) return null;
        return new LinkedBomResponse(
                bom.id(), bom.bomNumber(), bom.revisionNo(), bom.status() == null ? null : bom.status().name(), bom.effective(),
                bom.submittedBy(), bom.submittedAt() == null ? null : bom.submittedAt().toString(),
                bom.productionReviewedBy(), bom.productionReviewedAt() == null ? null : bom.productionReviewedAt().toString(),
                bom.productionReviewRemarks(), bom.returnedBy(), bom.returnedAt() == null ? null : bom.returnedAt().toString(),
                bom.returnRemarks(), bom.rowVersion());
    }

    private LinkedBomResponse linkedBomFromSummary(BomSummaryResponse bom) {
        if (bom == null) return null;
        return new LinkedBomResponse(
                bom.id(), bom.bomNumber(), bom.revisionNo(), bom.status() == null ? null : bom.status().name(), bom.effective(),
                null, null, bom.productionReviewedBy(),
                bom.productionReviewedAt() == null ? null : bom.productionReviewedAt().toString(),
                bom.productionReviewRemarks(), null, null, null, bom.rowVersion());
    }

    /* =============================== TASK / SUBMISSION CREATION HELPERS =============================== */

    private UUID createTaskFromSubmission(Map<String, Object> submission, DesignSubmissionActionRequest request) {
        UUID id = UUID.randomUUID();
        String assignee = clean(request.assignedTo());
        if (assignee != null) {
            requirePersonRole(assignee, string(submission.get("plantCode")),
                    Set.of("ADMIN", "MATFLOW_MANAGER", "MATFLOW_ENGINEERING"),
                    "Engineering assignee");
        }
        String template = engineeringTemplate(string(submission.get("engineeringChecklistTemplateKey")));
        Map<String, Object> task = new LinkedHashMap<>();
        task.put("id", id.toString());
        task.put("taskNumber", taskNumber(id));
        task.put("status", assignee == null ? "AWAITING_ASSIGNMENT" : "ASSIGNED");
        task.put("priority", priority(request.priority()));
        task.put("submissionId", string(submission.get("id")));
        copyProjectProductSnapshot(submission, task);
        task.put("designDrawingRevision", string(submission.get("designDrawingRevision")));
        task.put("engineeringDrawingRevision", null);
        task.put("engineeringHead", string(submission.get("engineeringHead")));
        task.put("assignedTo", assignee);
        task.put("productionRecipient", string(submission.get("productionRecipient")));
        task.put("dueDate", isoDate(request.dueDate(), "Due date"));
        task.put("startedAt", null);
        task.put("outstandingIssues", null);
        task.put("remarks", clean(request.note()));
        task.put("handoverRemarks", null);
        task.put("handedOverBy", null);
        task.put("handedOverAt", null);
        task.put("revisionReviewRequired", false);
        task.put("pendingDesignSubmissionId", null);
        task.put("pendingDesignRevision", null);
        task.put("checklistTemplateKey", template);
        task.put("checklist", newChecklist(checkDefinitions(template)));
        task.put("designDrawing", deepCopyMap(map(submission.get("designDrawing"))));
        task.put("productionDrawing", emptyFile());
        task.put("linkedBomId", null);
        task.put("version", 1);
        String actor = accessService.actor();
        String now = LocalDateTime.now().toString();
        task.put("createdBy", actor);
        task.put("createdAt", now);
        task.put("updatedBy", actor);
        task.put("updatedAt", now);
        record(TASK_ENTITY, id, assignee == null ? "ENGINEERING_TASK_CREATED" : "ENGINEERING_TASK_CREATED_AND_ASSIGNED", task);
        return id;
    }

    private void flagOpenTasksForNewRevision(Map<String, Object> submitted) {
        UUID productId = uuid(submitted.get("productId"));
        UUID submissionId = uuid(submitted.get("id"));
        String revision = string(submitted.get("designDrawingRevision"));
        if (productId == null || submissionId == null) return;
        for (Map<String, Object> task : latestStates(TASK_ENTITY)) {
            if (!productId.equals(uuid(task.get("productId")))) continue;
            if (!OPEN_TASK_STATUSES.contains(cleanUpper(string(task.get("status"))))) continue;
            if (same(revision, string(task.get("designDrawingRevision")))) continue;
            task = new LinkedHashMap<>(task);
            task.put("revisionReviewRequired", true);
            task.put("pendingDesignSubmissionId", submissionId.toString());
            task.put("pendingDesignRevision", revision);
            touch(task);
            record(TASK_ENTITY, uuid(task.get("id")), "NEW_DESIGN_REVISION_REQUIRES_REVIEW", task);
        }
    }

    /**
     * Returning a proposed Design revision is an explicit Engineering-Head
     * decision that the pending revision is not yet the active Engineering
     * input. Clear only the task flags created by that exact submission so the
     * earlier accepted revision can continue without silently adopting the
     * returned drawing.
     */
    private void clearRevisionReviewFlagsForSubmission(UUID submissionId, String action) {
        if (submissionId == null) return;
        for (Map<String, Object> raw : latestStates(TASK_ENTITY)) {
            if (!submissionId.equals(uuid(raw.get("pendingDesignSubmissionId")))) continue;
            if (!bool(raw.get("revisionReviewRequired"))) continue;
            Map<String, Object> task = new LinkedHashMap<>(raw);
            task.put("revisionReviewRequired", false);
            task.put("pendingDesignSubmissionId", null);
            task.put("pendingDesignRevision", null);
            touch(task);
            UUID taskId = uuid(task.get("id"));
            if (taskId != null) record(TASK_ENTITY, taskId, action, task);
        }
    }

    /**
     * Once Engineering accepts a newer Design revision, the task created from
     * that accepted submission becomes the active work item. Older open tasks
     * that were explicitly flagged by this revision are archived as
     * SUPERSEDED. Their immutable snapshots, linked drawings and any BOM already
     * submitted to Production remain untouched for traceability.
     */
    private void supersedeOlderTasksForAcceptedRevision(
            Map<String, Object> acceptedSubmission,
            UUID replacementTaskId) {
        UUID productId = uuid(acceptedSubmission.get("productId"));
        UUID submissionId = uuid(acceptedSubmission.get("id"));
        String revision = string(acceptedSubmission.get("designDrawingRevision"));
        if (productId == null || submissionId == null) return;

        for (Map<String, Object> raw : latestStates(TASK_ENTITY)) {
            UUID taskId = uuid(raw.get("id"));
            if (taskId == null || taskId.equals(replacementTaskId)) continue;
            if (!productId.equals(uuid(raw.get("productId")))) continue;
            if (!SUPERSEDABLE_TASK_STATUSES.contains(cleanUpper(string(raw.get("status"))))) continue;
            if (!submissionId.equals(uuid(raw.get("pendingDesignSubmissionId")))) continue;

            Map<String, Object> task = new LinkedHashMap<>(raw);
            task.put("status", "SUPERSEDED");
            task.put("revisionReviewRequired", false);
            task.put("pendingDesignSubmissionId", null);
            task.put("pendingDesignRevision", null);
            task.put("supersededByTaskId", replacementTaskId == null ? null : replacementTaskId.toString());
            task.put("supersededByDesignSubmissionId", submissionId.toString());
            task.put("supersededByDesignRevision", revision);
            task.put("supersededBy", accessService.actor());
            task.put("supersededAt", LocalDateTime.now().toString());
            task.put("statusNote", "Superseded after Engineering accepted Design revision " + firstNonBlank(revision, "-"));
            touch(task);
            record(TASK_ENTITY, taskId, "ENGINEERING_TASK_SUPERSEDED_BY_DESIGN_REVISION", task);
        }
    }

    /**
     * Server-side stale-revision lock. UI warning flags are helpful, but the
     * Production handover/closure gate must not trust the browser or one prior
     * task snapshot. Re-read the latest Design submissions for the same Product
     * and block whenever a newer submitted/accepted revision exists.
     */
    private void ensureTaskRevisionCurrent(EngineeringTaskResponse task, String operation) {
        if (task == null) throw conflict((operation == null ? "Engineering action" : operation) + " requires a valid task");
        if (task.revisionReviewRequired()) {
            throw conflict((operation == null ? "Engineering action" : operation)
                    + " is blocked because Design revision " + firstNonBlank(task.pendingDesignRevision(), "-")
                    + " is waiting for Engineering review. Review that Design submission first.");
        }

        UUID productId = task.productId();
        UUID sourceSubmissionId = task.submissionId();
        if (productId == null || sourceSubmissionId == null) return;

        Map<String, Object> source = requireState(DESIGN_ENTITY, sourceSubmissionId, "Task source Design submission");
        String sourceRevision = string(source.get("designDrawingRevision"));
        String sourceMoment = submissionSequenceMoment(source);

        Map<String, Object> newer = latestStates(DESIGN_ENTITY).stream()
                .filter(candidate -> productId.equals(uuid(candidate.get("productId"))))
                .filter(candidate -> !sourceSubmissionId.equals(uuid(candidate.get("id"))))
                .filter(candidate -> Set.of("SUBMITTED_TO_ENGINEERING", "ACCEPTED")
                        .contains(cleanUpper(string(candidate.get("status")))))
                .filter(candidate -> !same(sourceRevision, string(candidate.get("designDrawingRevision"))))
                .filter(candidate -> isLater(submissionSequenceMoment(candidate), sourceMoment))
                .max(Comparator.comparing(this::submissionSequenceMoment,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .orElse(null);

        if (newer != null) {
            throw conflict((operation == null ? "Engineering action" : operation)
                    + " is blocked because a newer Design revision "
                    + firstNonBlank(string(newer.get("designDrawingRevision")), "-")
                    + " has been submitted/accepted for this Product. Open the Design & Engineering workspace and review it first.");
        }
    }

    private String submissionSequenceMoment(Map<String, Object> state) {
        return firstNonBlank(
                string(state.get("submittedAt")),
                string(state.get("reviewedAt")),
                string(state.get("createdAt")),
                string(state.get("updatedAt")));
    }

    private boolean isLater(String candidate, String baseline) {
        if (candidate == null) return false;
        if (baseline == null) return true;
        return candidate.compareTo(baseline) > 0;
    }

    /* =============================== CHECKLIST HELPERS =============================== */

    private void updateChecklistItem(Map<String, Object> state, String itemKey, ChecklistItemUpdateRequest request) {
        String key = requiredText(itemKey, "Checklist item key");
        String nextState = cleanUpper(request.state());
        if (!CHECK_STATES.contains(nextState)) throw badRequest("Checklist state must be PENDING, DONE or NA");
        List<Map<String, Object>> items = checklistMaps(state);
        Map<String, Object> item = items.stream().filter(row -> same(key, string(row.get("key")))).findFirst()
                .orElseThrow(() -> notFound("Checklist item not found: " + key));
        if ("NA".equals(nextState) && !bool(item.get("naAllowed"))) {
            throw conflict("This mandatory checklist point cannot be marked Not applicable");
        }
        String naReason = clean(request.naReason());
        if ("NA".equals(nextState) && naReason == null) throw badRequest("Not applicable reason is required");
        item.put("state", nextState);
        item.put("naReason", "NA".equals(nextState) ? naReason : null);
        item.put("remarks", clean(request.remarks()));
        item.put("checkedBy", "PENDING".equals(nextState) ? null : accessService.actor());
        item.put("checkedAt", "PENDING".equals(nextState) ? null : LocalDateTime.now().toString());
        state.put("checklist", items);
    }

    private List<Map<String, Object>> newChecklist(List<CheckDefinition> definitions) {
        List<Map<String, Object>> rows = new ArrayList<>();
        int no = 1;
        for (CheckDefinition definition : definitions) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("key", definition.key());
            row.put("no", no++);
            row.put("text", definition.text());
            row.put("naAllowed", definition.naAllowed());
            row.put("state", "PENDING");
            row.put("naReason", null);
            row.put("remarks", null);
            row.put("checkedBy", null);
            row.put("checkedAt", null);
            rows.add(row);
        }
        return rows;
    }

    private ChecklistProgress checklistProgress(List<Map<String, Object>> items) {
        int total = items == null ? 0 : items.size();
        int done = 0;
        int na = 0;
        if (items != null) {
            for (Map<String, Object> item : items) {
                String state = cleanUpper(string(item.get("state")));
                if ("DONE".equals(state)) done++;
                else if ("NA".equals(state)) na++;
            }
        }
        int pending = Math.max(0, total - done - na);
        int percent = total == 0 ? 100 : Math.round(((done + na) * 100f) / total);
        return new ChecklistProgress(total, done, na, pending, percent, pending == 0);
    }

    private List<ChecklistItemResponse> checklistResponse(Map<String, Object> state) {
        return checklistMaps(state).stream()
                .map(row -> new ChecklistItemResponse(
                        string(row.get("key")), integer(row.get("no"), 0), string(row.get("text")),
                        bool(row.get("naAllowed")), firstNonBlank(string(row.get("state")), "PENDING"),
                        string(row.get("naReason")), string(row.get("remarks")), string(row.get("checkedBy")), string(row.get("checkedAt"))))
                .toList();
    }

    private List<CheckDefinition> checkDefinitions(String template) {
        String key = engineeringTemplate(template);
        return WARDROBE_TEMPLATE.equals(key) ? WARDROBE_CHECKLIST : GENERAL_ENGINEERING_CHECKLIST;
    }

    private ChecklistTemplateResponse template(
            String key, String name, String area, List<CheckDefinition> definitions, String description) {
        return new ChecklistTemplateResponse(
                key, name, area, true, true, description, definitions.size(),
                definitions.stream().map(def -> Map.<String, Object>of(
                        "key", def.key(), "text", def.text(), "naAllowed", def.naAllowed())).toList());
    }

    private static CheckDefinition check(String key, String text, boolean naAllowed) {
        return new CheckDefinition(key, text, naAllowed);
    }

    private record CheckDefinition(String key, String text, boolean naAllowed) {}

    /* =============================== FILE HELPERS =============================== */

    private Map<String, Object> saveWorkflowFile(
            Map<String, Object> state, String kind, String revision, MultipartFile file) {
        if (file == null || file.isEmpty()) throw badRequest("Drawing file is required");
        if (file.getSize() <= 0 || file.getSize() > DRAWING_MAX_BYTES) {
            throw badRequest("Drawing file must be greater than 0 bytes and not exceed 20 MB");
        }
        String original = clean(file.getOriginalFilename());
        String extension = extension(original);
        if (!DRAWING_EXTENSIONS.contains(extension)) {
            throw badRequest("Drawing must be PDF, JPG, JPEG, PNG, WEBP, DWG or DXF");
        }
        UUID productId = uuid(state.get("productId"));
        UUID entityId = uuid(state.get("id"));
        if (productId == null || entityId == null) throw conflict("Workflow drawing has no Product / record identity");
        Path directory = attachmentRoot.resolve(productId.toString()).resolve("workflow-drawings")
                .resolve(kind).resolve(entityId.toString()).normalize();
        if (!directory.startsWith(attachmentRoot)) throw conflict("Invalid workflow drawing path");
        try {
            Files.createDirectories(directory);
            String storedName = "drawing-" + safeFileToken(revision) + "." + extension;
            Path target = directory.resolve(storedName).normalize();
            if (!target.startsWith(directory)) throw conflict("Invalid workflow drawing file name");
            try (var input = file.getInputStream()) {
                Files.copy(input, target, StandardCopyOption.REPLACE_EXISTING);
            }
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("available", true);
            result.put("originalFileName", original == null ? target.getFileName().toString() : original);
            result.put("contentType", firstNonBlank(clean(file.getContentType()), contentType(target)));
            result.put("sizeBytes", Files.size(target));
            result.put("revision", revision);
            result.put("uploadedBy", accessService.actor());
            result.put("uploadedAt", LocalDateTime.now().toString());
            result.put("relativePath", attachmentRoot.relativize(target).toString().replace('\\', '/'));
            return result;
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to store workflow drawing", ex);
        }
    }

    private WorkspaceFileResource fileResource(Map<String, Object> file) {
        if (!bool(file.get("available"))) throw notFound("Drawing file is not available");
        String relative = clean(string(file.get("relativePath")));
        if (relative == null) throw notFound("Drawing storage reference is missing");
        Path path = attachmentRoot.resolve(relative).normalize();
        if (!path.startsWith(attachmentRoot) || !Files.isRegularFile(path)) throw notFound("Drawing file was not found");
        return new WorkspaceFileResource(
                new FileSystemResource(path), firstNonBlank(string(file.get("contentType")), contentType(path)),
                firstNonBlank(string(file.get("originalFileName")), path.getFileName().toString()));
    }

    private WorkspaceFileResponse fileResponse(Map<String, Object> file) {
        return new WorkspaceFileResponse(
                bool(file.get("available")), string(file.get("originalFileName")), string(file.get("contentType")),
                longObject(file.get("sizeBytes")), string(file.get("revision")), string(file.get("uploadedBy")), string(file.get("uploadedAt")));
    }

    private Map<String, Object> emptyFile() {
        Map<String, Object> file = new LinkedHashMap<>();
        file.put("available", false);
        return file;
    }

    private String contentType(Path path) {
        try {
            String value = Files.probeContentType(path);
            return value == null ? "application/octet-stream" : value;
        } catch (IOException ignored) {
            return "application/octet-stream";
        }
    }

    /* =============================== NOTIFICATION HELPERS =============================== */

    private boolean designNotificationRelevant(DesignSubmissionResponse row, String actor) {
        if (isManager()) return true;
        String status = cleanUpper(row.status());
        if ("SUBMITTED_TO_ENGINEERING".equals(status) && same(actor, row.engineeringHead())) return true;
        if ("RETURNED_FOR_CLARIFICATION".equals(status) && (same(actor, row.createdBy()) || same(actor, row.designer()))) return true;
        return same(actor, row.createdBy());
    }

    private boolean taskNotificationRelevant(EngineeringTaskResponse row, String actor) {
        if (isManager()) return true;
        if (same(actor, row.engineeringHead()) || same(actor, row.assignedTo())) return true;
        return "SUBMITTED_TO_PRODUCTION".equals(cleanUpper(row.status())) && same(actor, row.productionRecipient());
    }

    private WorkspaceNotificationResponse designNotification(DesignSubmissionResponse row, String actor) {
        String message = switch (cleanUpper(row.status())) {
            case "SUBMITTED_TO_ENGINEERING" -> "Design submission is waiting for Engineering review / assignment.";
            case "RETURNED_FOR_CLARIFICATION" -> "Engineering returned the design submission for clarification.";
            case "ACCEPTED" -> "Design submission was accepted and linked to an Engineering task.";
            default -> "Design submission updated.";
        };
        return new WorkspaceNotificationResponse(
                "DESIGN_SUBMISSION", row.id(), row.submissionNumber(), "Design submission · " + row.productName(), row.status(), null,
                row.projectCode(), row.productName(), row.plantCode(), message, row.updatedAt(),
                "/matflow/work?submissionId=" + row.id(), isRead(DESIGN_ENTITY, row.id(), actor, row.updatedAt()));
    }

    private WorkspaceNotificationResponse taskNotification(EngineeringTaskResponse row, String actor) {
        String message = row.revisionReviewRequired()
                ? "A newer Design revision is available and this Engineering task requires review."
                : switch (cleanUpper(row.status())) {
                    case "AWAITING_ASSIGNMENT" -> "Engineering task is waiting for assignment.";
                    case "ASSIGNED" -> "Engineering task was assigned.";
                    case "AWAITING_CLARIFICATION" -> "Engineering task is waiting for design clarification.";
                    case "SUBMITTED_TO_PRODUCTION" -> "Engineering package and BOM were submitted to Production review.";
                    case "RETURNED" -> "Engineering package requires correction after return.";
                    case "COMPLETED" -> "Engineering task is complete.";
                    case "SUPERSEDED" -> "Engineering accepted a newer Design revision; this task is archived for traceability.";
                    default -> "Engineering task updated.";
                };
        return new WorkspaceNotificationResponse(
                "ENGINEERING_TASK", row.id(), row.taskNumber(), "Engineering · " + row.productName(), row.status(), row.priority(),
                row.projectCode(), row.productName(), row.plantCode(), message, row.updatedAt(),
                "/matflow/work?taskId=" + row.id(), isRead(TASK_ENTITY, row.id(), actor, row.updatedAt()));
    }

    private boolean isRead(String sourceType, UUID sourceId, String actor, String updatedAt) {
        UUID receiptId = receiptId(sourceType, sourceId, actor);
        List<MatFlowAuditLog> receipts = auditRepository.findByEntityTypeAndEntityIdOrderByActionAtAsc(RECEIPT_ENTITY, receiptId);
        if (receipts.isEmpty()) return false;
        Map<String, Object> latest = parse(receipts.get(receipts.size() - 1).getDetailsJson());
        LocalDateTime readAt = dateTime(latest.get("readAt"));
        LocalDateTime sourceAt = dateTime(updatedAt);
        return readAt != null && (sourceAt == null || !readAt.isBefore(sourceAt));
    }

    private String notificationEntity(String referenceType) {
        String value = cleanUpper(referenceType);
        if ("DESIGN_SUBMISSION".equals(value) || DESIGN_ENTITY.equals(value)) return DESIGN_ENTITY;
        if ("ENGINEERING_TASK".equals(value) || TASK_ENTITY.equals(value)) return TASK_ENTITY;
        throw badRequest("Unsupported notification reference type");
    }

    /* =============================== AUDIT / STATE HELPERS =============================== */

    private List<Map<String, Object>> latestStates(String entityType) {
        Map<UUID, Map<String, Object>> latest = new LinkedHashMap<>();
        for (MatFlowAuditLog row : auditRepository.findByEntityTypeOrderByActionAtDesc(entityType)) {
            if (row == null || row.getEntityId() == null || latest.containsKey(row.getEntityId())) continue;
            Map<String, Object> state = parse(row.getDetailsJson());
            if (!state.isEmpty()) latest.put(row.getEntityId(), state);
        }
        return new ArrayList<>(latest.values());
    }

    private Map<String, Object> requireState(String entityType, UUID id, String label) {
        if (id == null) throw badRequest(label + " ID is required");
        List<MatFlowAuditLog> rows = auditRepository.findByEntityTypeAndEntityIdOrderByActionAtAsc(entityType, id);
        if (rows.isEmpty()) throw notFound(label + " not found");
        Map<String, Object> state = parse(rows.get(rows.size() - 1).getDetailsJson());
        if (state.isEmpty()) throw conflict(label + " history exists but latest state is unreadable");
        return new LinkedHashMap<>(state);
    }

    private List<WorkspaceHistoryRow> history(String entityType, UUID id) {
        return auditRepository.findByEntityTypeAndEntityIdOrderByActionAtAsc(entityType, id).stream()
                .map(row -> {
                    Map<String, Object> state = parse(row.getDetailsJson());
                    return new WorkspaceHistoryRow(
                            row.getAction(), row.getActor(), row.getActionAt() == null ? null : row.getActionAt().toString(),
                            string(state.get("status")), firstNonBlank(string(state.get("statusNote")), string(state.get("assignmentNote")),
                                    string(state.get("returnReason")), string(state.get("handoverRemarks")), string(state.get("remarks"))));
                }).toList();
    }

    private void record(String entityType, UUID id, String action, Map<String, Object> state) {
        auditService.record(entityType, id, action,
                string(state.get("plantCode")), string(state.get("projectCode")), string(state.get("drawingNo")), state);
    }

    private void touch(Map<String, Object> state) {
        state.put("version", integer(state.get("version"), 0) + 1);
        state.put("updatedBy", accessService.actor());
        state.put("updatedAt", LocalDateTime.now().toString());
    }

    /* =============================== SECURITY / VALIDATION =============================== */

    private void requireDesignWrite() {
        requireAnyRole("ADMIN", "MATFLOW_MANAGER", "MATFLOW_ENGINEERING");
    }

    private void requireEngineeringHead() {
        requireAnyRole("ADMIN", "MATFLOW_MANAGER");
    }

    private void requireDesignOwnerOrManager(Map<String, Object> state) {
        requireCanReadPlant(string(state.get("plantCode")));
        if (isManager()) return;
        String actor = accessService.actor();
        if (!same(actor, string(state.get("createdBy"))) && !same(actor, string(state.get("designer")))) {
            throw forbidden("Only the Designing owner or MatFlow Manager can change this submission");
        }
    }

    private void requireTaskWorkerOrHead(EngineeringTaskResponse task) {
        requireCanReadTask(task);
        if (isManager()) return;
        String actor = accessService.actor();
        if (same(actor, task.assignedTo()) || same(actor, task.engineeringHead())) return;
        throw forbidden("Only the assigned Engineer or Engineering Head can change this task");
    }

    private void requireCanReadTask(EngineeringTaskResponse task) {
        if (task == null) throw notFound("Engineering task not found");
        requireCanReadPlant(task.plantCode());
    }

    private void requireCanReadPlant(String plantCode) {
        if (!canReadPlant(plantCode)) accessService.requirePlantAccess(plantCode);
    }

    private boolean canReadPlant(String plantCode) {
        return plantCode != null && accessService.canAccessPlant(plantCode);
    }

    private void requireAnyRole(String... allowed) {
        Set<String> roles = currentRoles();
        if (!hasAny(roles, allowed)) throw forbidden("You do not have permission for this MatFlow workspace action");
    }

    private Set<String> currentRoles() {
        return normalizedRoles(accessService.currentUser());
    }

    private boolean isManager() {
        return hasAny(currentRoles(), "ADMIN", "MATFLOW_MANAGER");
    }

    private boolean isEngineeringHead() {
        return hasAny(currentRoles(), "ADMIN", "MATFLOW_MANAGER");
    }

    private Set<String> normalizedRoles(User user) {
        if (user == null) return Set.of();
        Set<String> roles = new LinkedHashSet<>();
        if (user.getEffectiveRoles() != null) {
            user.getEffectiveRoles().forEach(role -> {
                String value = cleanUpper(role);
                if (value != null) roles.add(value.replaceFirst("^ROLE_", ""));
            });
        }
        String primary = cleanUpper(user.getRole());
        if (primary != null) roles.add(primary.replaceFirst("^ROLE_", ""));
        return roles;
    }

    private boolean hasAny(Set<String> roles, String... allowed) {
        if (roles == null) return false;
        for (String role : allowed) if (roles.contains(cleanUpper(role))) return true;
        return false;
    }

    private void requirePersonRole(String username, String plantCode, Set<String> allowedRoles, String label) {
        String wanted = requiredText(username, label);
        User user = userService.getAllUsers().stream()
                .filter(User::isEnabled)
                .filter(candidate -> same(candidate.getUsername(), wanted))
                .findFirst()
                .orElseThrow(() -> badRequest(label + " user not found or disabled: " + wanted));
        Set<String> roles = normalizedRoles(user);
        boolean allowed = allowedRoles.stream().anyMatch(roles::contains);
        if (!allowed) throw badRequest(label + " does not have the required MatFlow role: " + wanted);
        if (!canUserAccessPlant(user, cleanUpper(plantCode))) throw badRequest(label + " has no access to plant " + plantCode);
    }

    private boolean isMatFlowPerson(User user) {
        return normalizedRoles(user).stream().anyMatch(role -> role.equals("ADMIN") || role.startsWith("MATFLOW_"));
    }

    private boolean canUserAccessPlant(User user, String plant) {
        if (user == null || plant == null) return false;
        Set<String> roles = normalizedRoles(user);
        if (roles.contains("ADMIN")) return true;
        Set<String> plants = user.getEffectivePlantCodes();
        return plants != null && plants.stream().map(this::cleanUpper).anyMatch(plant::equals);
    }

    private void validateTaskTransition(EngineeringTaskResponse current, String next) {
        String before = cleanUpper(current.status());
        Map<String, Set<String>> allowed = Map.ofEntries(
                Map.entry("AWAITING_ASSIGNMENT", Set.of("ASSIGNED", "CANCELLED")),
                Map.entry("ASSIGNED", Set.of("IN_PROGRESS", "AWAITING_CLARIFICATION", "CANCELLED")),
                Map.entry("IN_PROGRESS", Set.of("AWAITING_CLARIFICATION", "RETURNED", "CANCELLED")),
                Map.entry("AWAITING_CLARIFICATION", Set.of("IN_PROGRESS", "RETURNED", "CANCELLED")),
                Map.entry("SUBMITTED_TO_PRODUCTION", Set.of("RETURNED", "COMPLETED")),
                Map.entry("RETURNED", Set.of("IN_PROGRESS", "AWAITING_CLARIFICATION", "CANCELLED")),
                Map.entry("COMPLETED", Set.of()),
                Map.entry("SUPERSEDED", Set.of()),
                Map.entry("CANCELLED", Set.of()));
        if (!allowed.getOrDefault(before, Set.of()).contains(next)) {
            throw conflict("Engineering task cannot move from " + before + " to " + next);
        }
        if (Set.of("ASSIGNED", "IN_PROGRESS", "AWAITING_CLARIFICATION", "RETURNED").contains(next)
                && clean(current.assignedTo()) == null) {
            throw conflict("Assign the Engineering task before moving it forward");
        }
    }

    private void requireDesignEditable(Map<String, Object> state) {
        String status = cleanUpper(string(state.get("status")));
        if (!Set.of("DRAFT", "RETURNED_FOR_CLARIFICATION").contains(status)) {
            throw conflict("Submitted / accepted Design revisions are immutable. Create a new submission for a new Design revision.");
        }
    }

    private void requireSubmissionReady(Map<String, Object> state) {
        /*
         * Product creation itself stays approval-free. At the actual
         * Submit-to-Engineering gate, however, refresh the same canonical
         * Project/Product so the submitted snapshot cannot carry stale
         * dimensions, drawing identity or Plant information from an older draft.
         */
        UUID projectId = uuid(state.get("projectId"));
        UUID productId = uuid(state.get("productId"));
        if (projectId == null || productId == null) {
            throw conflict("Design submission is no longer linked to a valid Project / Product");
        }
        ProjectProductRef currentRef = requireProduct(projectId, productId);
        applyProjectProductSnapshot(state, currentRef);

        if (state.get("dimensionLength") == null
                || state.get("dimensionBreadth") == null
                || state.get("dimensionHeight") == null
                || clean(string(state.get("dimensionUom"))) == null) {
            throw conflict("Complete the Product dimensions as L × B × H with unit before Submit to Engineering");
        }

        if (!checklistProgress(checklistMaps(state)).complete()) {
            throw conflict("Complete the Design submission checklist before Submit to Engineering");
        }
        Map<String, Object> file = map(state.get("designDrawing"));
        if (!bool(file.get("available"))) {
            throw conflict("Upload the initial Design drawing before Submit to Engineering");
        }

        String revision = requiredText(string(state.get("designDrawingRevision")), "Design drawing revision");
        String uploadedRevision = clean(string(file.get("revision")));
        if (uploadedRevision == null || !same(revision, uploadedRevision)) {
            throw conflict("The uploaded Design drawing revision does not match the submission revision. Upload the exact revision before Submit to Engineering");
        }

        UUID currentSubmissionId = uuid(state.get("id"));
        boolean duplicateReleasedRevision = latestStates(DESIGN_ENTITY).stream()
                .filter(other -> currentSubmissionId == null || !currentSubmissionId.equals(uuid(other.get("id"))))
                .filter(other -> productId.equals(uuid(other.get("productId"))))
                .filter(other -> Set.of("SUBMITTED_TO_ENGINEERING", "ACCEPTED")
                        .contains(cleanUpper(string(other.get("status")))))
                .anyMatch(other -> same(revision, string(other.get("designDrawingRevision"))));
        if (duplicateReleasedRevision) {
            throw conflict("Design revision " + revision
                    + " is already submitted/accepted for this Product. Continue the existing returned submission or use a new drawing revision so revision history remains unambiguous");
        }

        String plant = requiredText(string(state.get("plantCode")), "Plant");
        String designer = requiredText(string(state.get("designer")), "Designer / Designing owner");
        String head = requiredText(string(state.get("engineeringHead")), "Engineering Head");
        String productionRecipient = requiredText(string(state.get("productionRecipient")), "Production recipient");
        requirePersonRole(designer, plant,
                Set.of("ADMIN", "MATFLOW_MANAGER", "MATFLOW_ENGINEERING"), "Designer / Designing owner");
        requirePersonRole(head, plant,
                Set.of("ADMIN", "MATFLOW_MANAGER"), "Engineering Head");
        requirePersonRole(productionRecipient, plant,
                Set.of("ADMIN", "MATFLOW_MANAGER", "MATFLOW_PRODUCTION"), "Production recipient");
    }

    /* =============================== PROJECT / PRODUCT HELPERS =============================== */

    private ProjectProductRef requireProduct(UUID projectId, UUID productId) {
        ProjectPortfolioResponse project = projectService.get(projectId);
        accessService.requirePlantAccess(project.plantCode());
        ProductPortfolioRow product = (project.products() == null ? List.<ProductPortfolioRow>of() : project.products()).stream()
                .filter(row -> row != null && productId.equals(row.id()))
                .findFirst()
                .orElseThrow(() -> badRequest("Selected Product / Drawing does not belong to this Project"));
        if (!project.active() || !product.active()) throw conflict("Inactive Project / Product cannot enter the Design & Engineering workflow");
        return new ProjectProductRef(project, product);
    }

    private void applyProjectProductSnapshot(Map<String, Object> state, ProjectProductRef ref) {
        ProjectPortfolioResponse project = ref.project();
        ProductPortfolioRow product = ref.product();
        state.put("projectId", project.id().toString());
        state.put("productId", product.id().toString());
        state.put("projectCode", project.projectCode());
        state.put("projectName", project.projectName());
        state.put("clientName", project.clientName());
        state.put("plantCode", cleanUpper(project.plantCode()));
        state.put("productName", product.productName());
        state.put("drawingNo", product.drawingNo());
        state.put("dimensionLength", product.dimensionLength());
        state.put("dimensionBreadth", product.dimensionBreadth());
        state.put("dimensionHeight", product.dimensionHeight());
        state.put("dimensionUom", product.dimensionUom());
    }

    private void copyProjectProductSnapshot(Map<String, Object> source, Map<String, Object> target) {
        for (String key : List.of(
                "projectId", "productId", "projectCode", "projectName", "clientName", "plantCode", "productName", "drawingNo",
                "dimensionLength", "dimensionBreadth", "dimensionHeight", "dimensionUom")) {
            target.put(key, source.get(key));
        }
    }

    private record ProjectProductRef(ProjectPortfolioResponse project, ProductPortfolioRow product) {}

    /* =============================== FILTERS / SORT =============================== */

    private boolean designMatches(DesignSubmissionResponse row, String query) {
        if (query == null) return true;
        return searchText(row.submissionNumber(), row.projectCode(), row.projectName(), row.clientName(), row.productName(),
                row.drawingNo(), row.designDrawingRevision(), row.designer(), row.engineeringHead(), row.productionRecipient()).contains(query);
    }

    private boolean taskMatches(EngineeringTaskResponse row, String query) {
        if (query == null) return true;
        return searchText(row.taskNumber(), row.projectCode(), row.projectName(), row.clientName(), row.productName(), row.drawingNo(),
                row.designDrawingRevision(), row.engineeringDrawingRevision(), row.assignedTo(), row.engineeringHead(), row.productionRecipient()).contains(query);
    }

    private boolean taskScopeAllows(EngineeringTaskResponse row, String scope, String actor, boolean manager) {
        if (scope == null || "ALL".equals(scope)) return manager || same(actor, row.assignedTo()) || same(actor, row.engineeringHead()) || same(actor, row.productionRecipient());
        if ("MY".equals(scope)) return same(actor, row.assignedTo());
        if ("HEAD".equals(scope)) return same(actor, row.engineeringHead());
        if ("PRODUCTION".equals(scope)) return same(actor, row.productionRecipient());
        if ("UNASSIGNED".equals(scope)) return row.assignedTo() == null && manager;
        return true;
    }

    private Comparator<EngineeringTaskResponse> taskComparator(String actor) {
        return Comparator
                .comparing((EngineeringTaskResponse row) -> !same(actor, row.assignedTo()))
                .thenComparing((EngineeringTaskResponse row) -> !row.revisionReviewRequired())
                .thenComparing(EngineeringTaskResponse::overdue, Comparator.reverseOrder())
                .thenComparing(row -> priorityRank(row.priority()), Comparator.reverseOrder())
                .thenComparing(EngineeringTaskResponse::updatedAt, Comparator.nullsLast(Comparator.reverseOrder()));
    }

    private int priorityRank(String priority) {
        return switch (cleanUpper(priority)) {
            case "URGENT" -> 4;
            case "HIGH" -> 3;
            case "NORMAL" -> 2;
            case "LOW" -> 1;
            default -> 0;
        };
    }

    private boolean isOverdue(String dueDate, String status) {
        if (dueDate == null || Set.of("COMPLETED", "SUPERSEDED", "CANCELLED").contains(cleanUpper(status))) return false;
        try { return LocalDate.parse(dueDate).isBefore(LocalDate.now()); }
        catch (DateTimeParseException ignored) { return false; }
    }

    /* =============================== GENERIC CONVERSIONS =============================== */

    private List<Map<String, Object>> checklistMaps(Map<String, Object> state) {
        Object value = state.get("checklist");
        if (!(value instanceof List<?> list)) return new ArrayList<>();
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Object item : list) rows.add(new LinkedHashMap<>(map(item)));
        return rows;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> map(Object value) {
        if (value instanceof Map<?, ?> raw) {
            Map<String, Object> result = new LinkedHashMap<>();
            raw.forEach((key, item) -> { if (key != null) result.put(String.valueOf(key), item); });
            return result;
        }
        return new LinkedHashMap<>();
    }

    private Map<String, Object> deepCopyMap(Map<String, Object> source) {
        if (source == null || source.isEmpty()) return new LinkedHashMap<>();
        return objectMapper.convertValue(source, new TypeReference<LinkedHashMap<String, Object>>() {});
    }

    private Map<String, Object> parse(String json) {
        if (json == null || json.isBlank()) return new LinkedHashMap<>();
        try { return objectMapper.readValue(json, new TypeReference<LinkedHashMap<String, Object>>() {}); }
        catch (Exception ignored) { return new LinkedHashMap<>(); }
    }

    private String engineeringTemplate(String value) {
        String key = cleanUpper(value);
        if (key == null) return GENERAL_ENGINEERING_TEMPLATE;
        if (WARDROBE_TEMPLATE.equals(key) || GENERAL_ENGINEERING_TEMPLATE.equals(key)) return key;
        throw badRequest("Unsupported Engineering checklist template: " + value);
    }

    private String companyCode(String value) {
        String normalized = cleanUpper(value);
        if (normalized == null) return "ALSORG";
        if (!COMPANY_CODES.contains(normalized)) {
            throw badRequest("Callisto / Alsorg must be ALSORG or CALLISTO");
        }
        return normalized;
    }

    private String priority(String value) {
        String clean = cleanUpper(value);
        if (clean == null) return "NORMAL";
        if (!PRIORITIES.contains(clean)) throw badRequest("Unsupported priority: " + value);
        return clean;
    }

    private String isoDate(String value, String label) {
        String clean = clean(value);
        if (clean == null) return null;
        try { return LocalDate.parse(clean).toString(); }
        catch (DateTimeParseException ex) { throw badRequest(label + " must use yyyy-MM-dd"); }
    }

    private String requiredText(String value, String label) {
        String clean = clean(value);
        if (clean == null) throw badRequest(label + " is required");
        return clean;
    }

    private void assertVersion(Integer requested, Integer current, String label) {
        if (requested == null) throw badRequest(label + " version is required");
        if (!Objects.equals(requested, current)) throw conflict(label + " changed. Refresh and retry.");
    }

    private String taskNumber(UUID id) { return "ENG-" + LocalDate.now().getYear() + "-" + shortId(id); }
    private String submissionNumber(UUID id) { return "DES-" + LocalDate.now().getYear() + "-" + shortId(id); }
    private String shortId(UUID id) { return id.toString().replace("-", "").substring(0, 8).toUpperCase(Locale.ROOT); }

    private UUID receiptId(String sourceType, UUID sourceId, String actor) {
        return UUID.nameUUIDFromBytes((sourceType + "|" + sourceId + "|" + cleanLower(actor)).getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    private Path resolveAttachmentRoot(String configured) {
        String clean = clean(configured);
        if (clean != null) return Path.of(clean).toAbsolutePath().normalize();
        return Path.of(System.getProperty("user.home"), ".flowsuite", "matflow", "product-attachments").toAbsolutePath().normalize();
    }

    private String extension(String fileName) {
        String clean = clean(fileName);
        if (clean == null || !clean.contains(".")) return "";
        return clean.substring(clean.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    private String safeFileToken(String value) {
        String clean = requiredText(value, "Drawing revision").replaceAll("[^A-Za-z0-9._-]", "_");
        return clean.length() > 80 ? clean.substring(0, 80) : clean;
    }

    private void appendNote(Map<String, Object> state, String note, String key) {
        String value = clean(note);
        if (value != null) state.put(key, value);
    }

    private String searchText(Object... values) {
        StringBuilder out = new StringBuilder();
        for (Object value : values) if (value != null) out.append(' ').append(value);
        return out.toString().toLowerCase(Locale.ROOT);
    }

    private String clean(String value) {
        if (value == null) return null;
        String out = value.trim();
        return out.isBlank() ? null : out;
    }

    private String cleanUpper(String value) {
        String out = clean(value);
        return out == null ? null : out.toUpperCase(Locale.ROOT).replaceFirst("^ROLE_", "");
    }

    private String cleanLower(String value) {
        String out = clean(value);
        return out == null ? null : out.toLowerCase(Locale.ROOT);
    }

    private String string(Object value) { return value == null ? null : String.valueOf(value); }

    private UUID uuid(Object value) {
        String text = clean(string(value));
        if (text == null) return null;
        try { return UUID.fromString(text); }
        catch (IllegalArgumentException ignored) { return null; }
    }

    private int integer(Object value, int fallback) {
        if (value instanceof Number number) return number.intValue();
        try { return value == null ? fallback : Integer.parseInt(String.valueOf(value)); }
        catch (NumberFormatException ignored) { return fallback; }
    }

    private Integer integerObject(Object value) {
        if (value == null) return null;
        return integer(value, 0);
    }

    private Long longObject(Object value) {
        if (value instanceof Number number) return number.longValue();
        try { return value == null ? null : Long.valueOf(String.valueOf(value)); }
        catch (NumberFormatException ignored) { return null; }
    }

    private boolean bool(Object value) {
        if (value instanceof Boolean b) return b;
        return value != null && Boolean.parseBoolean(String.valueOf(value));
    }

    private LocalDateTime dateTime(Object value) {
        String text = clean(string(value));
        if (text == null) return null;
        try { return LocalDateTime.parse(text); }
        catch (DateTimeParseException ignored) { return null; }
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            String clean = clean(value);
            if (clean != null) return clean;
        }
        return null;
    }

    private boolean same(String left, String right) {
        String a = clean(left);
        String b = clean(right);
        return a != null && b != null && a.equalsIgnoreCase(b);
    }

    private ResponseStatusException badRequest(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
    private ResponseStatusException conflict(String message) { return new ResponseStatusException(HttpStatus.CONFLICT, message); }
    private ResponseStatusException notFound(String message) { return new ResponseStatusException(HttpStatus.NOT_FOUND, message); }
    private ResponseStatusException forbidden(String message) { return new ResponseStatusException(HttpStatus.FORBIDDEN, message); }
}
