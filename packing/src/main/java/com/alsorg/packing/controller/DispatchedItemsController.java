package com.alsorg.packing.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;
import java.util.Map;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.service.DispatchedItemService;
import com.alsorg.packing.service.DispatchRegisterExportService;
import com.alsorg.packing.service.LogisticsDispatchTripService;
import com.alsorg.packing.service.DispatchedItemService.DispatchImportApplyRequest;
import com.alsorg.packing.service.DispatchedItemService.DispatchImportApplyResponse;
import com.alsorg.packing.service.DispatchedItemService.DispatchImportRow;
import com.alsorg.packing.service.DispatchedItemService.DispatchImportVerificationResponse;

import jakarta.validation.Valid;

import com.alsorg.packing.config.TimeZoneConfig;
import com.alsorg.packing.controller.dto.PlantAssignmentRequest;
import com.alsorg.packing.controller.dto.dispatch.AdminBulkDispatchEditRequest;
import com.alsorg.packing.controller.dto.dispatch.AdminBulkDispatchEditResponse;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.Set;
import java.util.List;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.UtlWorkflowService;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.time.temporal.ChronoUnit;

import org.springframework.http.MediaType;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

@RestController
@RequestMapping("/api/dispatched")
@PreAuthorize("isAuthenticated()")
public class DispatchedItemsController {

        private final DispatchedItemRepository repository;
        private final DispatchedItemService dispatchedItemService;
        private final CurrentUserService currentUserService;

        @org.springframework.beans.factory.annotation.Autowired(required = false)
        private UtlWorkflowService utlWorkflowService;

        /*
         * Read-only streaming export service. Optional injection preserves the
         * existing controller constructor used by direct unit tests while the
         * production Spring context wires this bean normally.
         */
        @org.springframework.beans.factory.annotation.Autowired(required = false)
        private DispatchRegisterExportService dispatchRegisterExportService;

        /*
         * Optional synchronization bridge for challans that were created through
         * the legacy LogisticsTrip table.  Keeping this optional preserves direct
         * controller tests while allowing Admin/Logistics end-time corrections to
         * update both data models when a linked trip exists.
         */
        @org.springframework.beans.factory.annotation.Autowired(required = false)
        private LogisticsDispatchTripService logisticsDispatchTripService;

        public DispatchedItemsController(
                        DispatchedItemRepository repository,
                        DispatchedItemService dispatchedItemService,
                        CurrentUserService currentUserService) {

                this.repository = repository;
                this.dispatchedItemService = dispatchedItemService;
                this.currentUserService = currentUserService;
        }

        /* ===================== FETCH ===================== */

        private static final int DEFAULT_DISPATCH_PAGE_SIZE = 100;
        private static final int MAX_DISPATCH_PAGE_SIZE = 100;
        private static final int DEFAULT_CHALLAN_PAGE_SIZE = 50;
        private static final int MAX_CHALLAN_PAGE_SIZE = 100;
        private static final int MAX_SEARCH_LENGTH = 300;
        private static final int MAX_FILTER_LENGTH = 200;
        private static final int MAX_ITEM_IDS_PER_MUTATION = 1000;

        private static final List<ItemDispatchStatus> CHALLAN_HISTORY_STATUSES = List.of(
                        ItemDispatchStatus.DISPATCHED,
                        ItemDispatchStatus.LOADED,
                        ItemDispatchStatus.OUT_FOR_DELIVERY,
                        ItemDispatchStatus.DELIVERED);

        /*
         * ============================================================
         * OPTIMIZED DISPATCH REGISTER SEARCH / PAGINATION
         * ============================================================
         *
         * Backward-compatible addition.
         *
         * IMPORTANT:
         * - The existing GET /api/dispatched endpoint remains unchanged.
         * - Existing clients and workflows can continue to use it.
         * - The optimized React Dispatch register uses /search so the
         * database performs filtering + pagination before JSON is sent.
         * - No Dispatch business state is changed by this read endpoint.
         */
        @GetMapping(value = "/search", produces = MediaType.APPLICATION_JSON_VALUE)
        public ResponseEntity<List<DispatchedItem>> searchDispatchedItems(

                        @RequestParam(defaultValue = "0") int page,

                        @RequestParam(defaultValue = "25") int size,

                        @RequestParam(defaultValue = "") String search,

                        @RequestParam(defaultValue = "ALL") String statuses,

                        @RequestParam(defaultValue = "ALL") String plant,

                        @RequestParam(defaultValue = "ACTIVITY") String dateMode,

                        @RequestParam(defaultValue = "") String dateFrom,

                        @RequestParam(defaultValue = "") String dateTo,

                        @RequestParam(defaultValue = "") String timeFrom,

                        @RequestParam(defaultValue = "") String timeTo,

                        @RequestParam(defaultValue = "NONE") String groupBy,

                        /*
                         * When false, the caller may reuse an already known total and
                         * the backend skips the expensive COUNT query for this page.
                         * Defaults keep every existing client fully backward compatible.
                         */
                        @RequestParam(defaultValue = "true") boolean includeTotal,

                        @RequestParam(required = false) Long knownTotalElements) {

                validateQueryText(search, MAX_SEARCH_LENGTH, "Search");
                validateQueryText(statuses, MAX_FILTER_LENGTH, "Status filter");
                validateQueryText(plant, 64, "Plant filter");
                validateQueryText(dateMode, 32, "Date mode");
                validateQueryText(dateFrom, 40, "Date from");
                validateQueryText(dateTo, 40, "Date to");
                validateQueryText(timeFrom, 20, "Time from");
                validateQueryText(timeTo, 20, "Time to");
                validateQueryText(groupBy, 32, "Group by");

                User user = currentUserService.requireCurrentUser();

                int safePage = Math.max(
                                page,
                                0);

                int safeSize = Math.min(
                                Math.max(
                                                size,
                                                1),
                                MAX_DISPATCH_PAGE_SIZE);

                Pageable pageable = PageRequest.of(
                                safePage,
                                safeSize,
                                buildDispatchRegisterSort(
                                                groupBy));

                boolean admin = currentUserService.isAdmin(
                                user);

                boolean completeRegisterAccess = admin;

                Set<String> allowedPlants = completeRegisterAccess
                                ? Set.of()
                                : currentUserService.allowedPlants(
                                                user);

                String ownerUsername = shouldRestrictDispatchReadToOwner(user)
                                ? user.getUsername()
                                : null;

                DispatchedItemService.DispatchRegisterWindow result = dispatchedItemService
                                .searchDispatchRegisterWindow(
                                                pageable,
                                                search,
                                                parseDispatchStatusFilter(
                                                                statuses),
                                                plant,
                                                dateMode,
                                                dateFrom,
                                                dateTo,
                                                timeFrom,
                                                timeTo,
                                                completeRegisterAccess,
                                                allowedPlants,
                                                ownerUsername,
                                                buildUtlReadContext(user),
                                                includeTotal,
                                                knownTotalElements);

                return ResponseEntity
                                .ok()
                                .contentType(
                                                MediaType.APPLICATION_JSON)
                                .header(
                                                HttpHeaders.CACHE_CONTROL,
                                                "no-store, no-cache, must-revalidate")
                                .header(
                                                "X-Total-Pages",
                                                String.valueOf(
                                                                result.totalPages()))
                                .header(
                                                "X-Total-Elements",
                                                String.valueOf(
                                                                result.totalElements()))
                                .header(
                                                "X-Page-Number",
                                                String.valueOf(
                                                                result.pageNumber()))
                                .header(
                                                "X-Page-Size",
                                                String.valueOf(
                                                                result.pageSize()))
                                .header(
                                                "X-Has-Next",
                                                String.valueOf(
                                                                result.hasNext()))
                                .header(
                                                "X-Dispatch-Query",
                                                "server-paged")
                                .header(
                                                "X-Dispatch-Count-Reused",
                                                String.valueOf(
                                                                result.countReused()))
                                .body(
                                                result.items());
        }

        /*
         * ============================================================
         * MEMORY-BOUNDED DISPATCH REGISTER EXPORT / ID SELECTION
         * ============================================================
         *
         * These are read-only companions to /search. They reuse exactly the
         * same authorization, UTL routing, plant scope and filter builder, but
         * stream batches instead of materializing the full register in Java or
         * React memory.
         */
        @GetMapping(value = "/export.csv")
        public ResponseEntity<StreamingResponseBody> exportDispatchedCsv(
                        @RequestParam(defaultValue = "") String search,
                        @RequestParam(defaultValue = "ALL") String statuses,
                        @RequestParam(defaultValue = "ALL") String plant,
                        @RequestParam(defaultValue = "ACTIVITY") String dateMode,
                        @RequestParam(defaultValue = "") String dateFrom,
                        @RequestParam(defaultValue = "") String dateTo,
                        @RequestParam(defaultValue = "") String timeFrom,
                        @RequestParam(defaultValue = "") String timeTo,
                        @RequestParam(defaultValue = "NONE") String groupBy) {

                DispatchRegisterExportService.ExportRequest request =
                                buildDispatchExportRequest(
                                                search,
                                                statuses,
                                                plant,
                                                dateMode,
                                                dateFrom,
                                                dateTo,
                                                timeFrom,
                                                timeTo,
                                                groupBy);

                DispatchRegisterExportService exporter = requireDispatchExportService();

                StreamingResponseBody body = outputStream ->
                                exporter.writeCsv(outputStream, request);

                return ResponseEntity.ok()
                                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                                .header(
                                                HttpHeaders.CONTENT_DISPOSITION,
                                                "attachment; filename=\"ALSORG_Dispatch_Register.csv\"")
                                .header(HttpHeaders.CACHE_CONTROL, "no-store, no-cache, must-revalidate")
                                .header("X-Content-Type-Options", "nosniff")
                                .body(body);
        }

        @GetMapping(value = "/export.xlsx")
        public ResponseEntity<StreamingResponseBody> exportDispatchedXlsx(
                        @RequestParam(defaultValue = "") String search,
                        @RequestParam(defaultValue = "ALL") String statuses,
                        @RequestParam(defaultValue = "ALL") String plant,
                        @RequestParam(defaultValue = "ACTIVITY") String dateMode,
                        @RequestParam(defaultValue = "") String dateFrom,
                        @RequestParam(defaultValue = "") String dateTo,
                        @RequestParam(defaultValue = "") String timeFrom,
                        @RequestParam(defaultValue = "") String timeTo,
                        @RequestParam(defaultValue = "NONE") String groupBy) {

                DispatchRegisterExportService.ExportRequest request =
                                buildDispatchExportRequest(
                                                search,
                                                statuses,
                                                plant,
                                                dateMode,
                                                dateFrom,
                                                dateTo,
                                                timeFrom,
                                                timeTo,
                                                groupBy);

                DispatchRegisterExportService exporter = requireDispatchExportService();

                StreamingResponseBody body = outputStream ->
                                exporter.writeXlsx(outputStream, request);

                return ResponseEntity.ok()
                                .contentType(MediaType.parseMediaType(
                                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                                .header(
                                                HttpHeaders.CONTENT_DISPOSITION,
                                                "attachment; filename=\"ALSORG_Dispatch_Register.xlsx\"")
                                .header(HttpHeaders.CACHE_CONTROL, "no-store, no-cache, must-revalidate")
                                .header("X-Content-Type-Options", "nosniff")
                                .body(body);
        }

        @GetMapping(value = "/search/ids", produces = MediaType.APPLICATION_JSON_VALUE)
        public ResponseEntity<StreamingResponseBody> searchDispatchedItemIds(
                        @RequestParam(defaultValue = "") String search,
                        @RequestParam(defaultValue = "ALL") String statuses,
                        @RequestParam(defaultValue = "ALL") String plant,
                        @RequestParam(defaultValue = "ACTIVITY") String dateMode,
                        @RequestParam(defaultValue = "") String dateFrom,
                        @RequestParam(defaultValue = "") String dateTo,
                        @RequestParam(defaultValue = "") String timeFrom,
                        @RequestParam(defaultValue = "") String timeTo,
                        @RequestParam(defaultValue = "NONE") String groupBy) {

                DispatchRegisterExportService.ExportRequest request =
                                buildDispatchExportRequest(
                                                search,
                                                statuses,
                                                plant,
                                                dateMode,
                                                dateFrom,
                                                dateTo,
                                                timeFrom,
                                                timeTo,
                                                groupBy);

                DispatchRegisterExportService exporter = requireDispatchExportService();

                StreamingResponseBody body = outputStream ->
                                exporter.writeIdsJson(outputStream, request);

                return ResponseEntity.ok()
                                .contentType(MediaType.APPLICATION_JSON)
                                .header(HttpHeaders.CACHE_CONTROL, "no-store, no-cache, must-revalidate")
                                .header("X-Content-Type-Options", "nosniff")
                                .body(body);
        }

        private DispatchRegisterExportService.ExportRequest buildDispatchExportRequest(
                        String search,
                        String statuses,
                        String plant,
                        String dateMode,
                        String dateFrom,
                        String dateTo,
                        String timeFrom,
                        String timeTo,
                        String groupBy) {

                validateQueryText(search, MAX_SEARCH_LENGTH, "Search");
                validateQueryText(statuses, MAX_FILTER_LENGTH, "Status filter");
                validateQueryText(plant, 64, "Plant filter");
                validateQueryText(dateMode, 32, "Date mode");
                validateQueryText(dateFrom, 40, "Date from");
                validateQueryText(dateTo, 40, "Date to");
                validateQueryText(timeFrom, 20, "Time from");
                validateQueryText(timeTo, 20, "Time to");
                validateQueryText(groupBy, 32, "Group by");

                User user = currentUserService.requireCurrentUser();
                boolean admin = currentUserService.isAdmin(user);

                Set<String> allowedPlants = admin
                                ? Set.of()
                                : currentUserService.allowedPlants(user);

                String ownerUsername = shouldRestrictDispatchReadToOwner(user)
                                ? user.getUsername()
                                : null;

                return new DispatchRegisterExportService.ExportRequest(
                                search,
                                parseDispatchStatusFilter(statuses),
                                plant,
                                dateMode,
                                dateFrom,
                                dateTo,
                                timeFrom,
                                timeTo,
                                groupBy,
                                admin,
                                allowedPlants,
                                ownerUsername,
                                buildUtlReadContext(user));
        }

        private DispatchRegisterExportService requireDispatchExportService() {
                if (dispatchRegisterExportService == null) {
                        throw new ResponseStatusException(
                                        HttpStatus.SERVICE_UNAVAILABLE,
                                        "Dispatch export service is unavailable");
                }

                return dispatchRegisterExportService;
        }

        /*
         * Keep the table's existing grouping choices stable while pushing
         * ordering into PostgreSQL. zohoItemId is always the final
         * tie-breaker so page boundaries cannot randomly shuffle rows.
         */
        private Sort buildDispatchRegisterSort(
                        String groupBy) {

                String cleanGroup = groupBy == null
                                ? "NONE"
                                : groupBy.trim()
                                                .toUpperCase();

                Sort tieBreaker = Sort.by(
                                Sort.Direction.ASC,
                                "zohoItemId");

                if ("STATUS".equals(
                                cleanGroup)) {

                        return Sort.by(
                                        Sort.Order.asc(
                                                        "status"),
                                        Sort.Order.asc(
                                                        "name"),
                                        Sort.Order.desc(
                                                        "createdAt"))
                                        .and(
                                                        tieBreaker);
                }

                if ("CLIENT".equals(
                                cleanGroup)) {

                        return Sort.by(
                                        Sort.Order.asc(
                                                        "clientName"),
                                        Sort.Order.asc(
                                                        "name"),
                                        Sort.Order.desc(
                                                        "createdAt"))
                                        .and(
                                                        tieBreaker);
                }

                if ("PLANT".equals(
                                cleanGroup)) {

                        return Sort.by(
                                        Sort.Order.asc(
                                                        "plantCode"),
                                        Sort.Order.asc(
                                                        "name"),
                                        Sort.Order.desc(
                                                        "createdAt"))
                                        .and(
                                                        tieBreaker);
                }

                return Sort.by(
                                Sort.Direction.DESC,
                                "createdAt")
                                .and(
                                                tieBreaker);
        }

        /*
         * Empty list means "ALL", matching the existing frontend semantics.
         */
        private List<ItemDispatchStatus> parseDispatchStatusFilter(
                        String value) {

                if (value == null ||
                                value.isBlank()) {

                        return List.of();
                }

                String[] values = value.split(",");

                java.util.LinkedHashSet<ItemDispatchStatus> parsed = new java.util.LinkedHashSet<>();

                for (String rawValue : values) {

                        String clean = rawValue == null
                                        ? ""
                                        : rawValue.trim()
                                                        .toUpperCase();

                        if (clean.isBlank() ||
                                        "ALL".equals(
                                                        clean)) {

                                return List.of();
                        }

                        try {

                                parsed.add(
                                                ItemDispatchStatus.valueOf(
                                                                clean));

                        } catch (IllegalArgumentException exception) {

                                throw new ResponseStatusException(
                                                HttpStatus.BAD_REQUEST,
                                                "Invalid dispatch status: "
                                                                + clean);
                        }
                }

                return List.copyOf(
                                parsed);
        }

        @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
        public ResponseEntity<List<DispatchedItem>> getDispatchedItems(

                        @RequestParam(defaultValue = "0") int page,

                        @RequestParam(defaultValue = "" + DEFAULT_DISPATCH_PAGE_SIZE) int size) {

                User user = currentUserService.requireCurrentUser();

                int safePage = Math.max(page, 0);

                int safeSize = Math.min(
                                Math.max(size, 1),
                                MAX_DISPATCH_PAGE_SIZE);

                Sort stableSort = Sort.by(
                                Sort.Direction.DESC,
                                "createdAt")
                                .and(
                                                Sort.by(
                                                                Sort.Direction.ASC,
                                                                "zohoItemId"));

                Pageable pageable = PageRequest.of(
                                safePage,
                                safeSize,
                                stableSort);

                boolean canViewCompleteDispatchRegister = currentUserService.isAdmin(user);

                Set<String> allowedPlants = canViewCompleteDispatchRegister
                                ? Set.of()
                                : currentUserService.allowedPlants(user);

                Page<DispatchedItem> result;

                if (canViewCompleteDispatchRegister) {
                        result = repository.findAll(pageable);
                } else {
                        result = dispatchedItemService.searchDispatchRegister(
                                        pageable,
                                        "",
                                        List.of(),
                                        "ALL",
                                        "ACTIVITY",
                                        "",
                                        "",
                                        "",
                                        "",
                                        false,
                                        allowedPlants,
                                        shouldRestrictDispatchReadToOwner(user)
                                                        ? user.getUsername()
                                                        : null,
                                        buildUtlReadContext(user));
                }

                return ResponseEntity
                                .ok()
                                .contentType(
                                                MediaType.APPLICATION_JSON)
                                .header(
                                                HttpHeaders.CACHE_CONTROL,
                                                "no-store, no-cache, must-revalidate")
                                .header(
                                                "X-Total-Pages",
                                                String.valueOf(
                                                                result.getTotalPages()))
                                .header(
                                                "X-Total-Elements",
                                                String.valueOf(
                                                                result.getTotalElements()))
                                .header(
                                                "X-Page-Number",
                                                String.valueOf(
                                                                result.getNumber()))
                                .header(
                                                "X-Page-Size",
                                                String.valueOf(
                                                                result.getSize()))
                                .header(
                                                "X-Has-Next",
                                                String.valueOf(
                                                                result.hasNext()))
                                .body(
                                                result.getContent());
        }

        private DispatchedItemService.UtlReadContext buildUtlReadContext(User user) {
                if (user == null || currentUserService.isAdmin(user)) {
                        return null;
                }

                boolean utlPacking =
                                currentUserService.isUtlPacking(user);

                boolean utlDispatch =
                                currentUserService.isUtlDispatch(user);

                boolean internalDispatch =
                                currentUserService.isDispatch(user);

                boolean warehouse =
                                currentUserService.isWarehouse(user);

                boolean logistics =
                                currentUserService.isLogistics(user);

                /*
                 * UTL identities remain isolated from the ordinary plant-wide
                 * Dispatch/Warehouse/Logistics register. UserService already keeps
                 * UTL roles in their own profile, but deriving this explicitly here
                 * keeps the read context correct even for migrated/legacy accounts.
                 */
                boolean utlOnlyIdentity =
                                (utlPacking || utlDispatch)
                                                && !internalDispatch
                                                && !warehouse
                                                && !logistics;

                /*
                 * Normal Warehouse/Logistics may receive only UTL-origin rows that
                 * were explicitly routed as INTERNAL. Pure UTL identities never get
                 * this plant-wide operational branch.
                 */
                boolean internalOperationalPlantRead =
                                !utlOnlyIdentity
                                                && (warehouse || logistics);

                /*
                 * WR-38 is the deliberate business exception: a normal WR-38
                 * operational PackFlow user sees the combined normal + UTL WR-38
                 * register. This must never widen AL-P3 UTL visibility.
                 */
                boolean wr38CombinedRead =
                                !utlOnlyIdentity
                                                && currentUserService.hasAnyRole(
                                                                user,
                                                                "PACKING",
                                                                "WAREHOUSE",
                                                                "DISPATCH",
                                                                "LOGISTICS")
                                                && currentUserService.allowedPlants(user)
                                                                .stream()
                                                                .filter(java.util.Objects::nonNull)
                                                                .map(String::trim)
                                                                .anyMatch(
                                                                                plantCode ->
                                                                                                "WR-38".equalsIgnoreCase(
                                                                                                                plantCode));

                return new DispatchedItemService.UtlReadContext(
                                user.getUsername(),
                                utlPacking,
                                internalDispatch || utlDispatch,
                                internalOperationalPlantRead,
                                wr38CombinedRead,
                                utlOnlyIdentity);
        }

        private boolean shouldRestrictDispatchReadToOwner(User user) {
                if (user == null || currentUserService.isAdmin(user)) {
                        return false;
                }

                /*
                 * Personal PACKING users keep the same ownership privacy as the
                 * Inventory page. Dedicated WAREHOUSE/DISPATCH/LOGISTICS roles are
                 * operational hand-off roles: they must see the assigned-plant queue
                 * irrespective of who originally packed the item, otherwise the
                 * existing Ready -> Warehouse/FG -> Dispatch workflow would break.
                 */
                return (currentUserService.isPacking(user)
                                || currentUserService.isUtlPacking(user))
                                && !currentUserService.hasAnyRole(
                                                user,
                                                "WAREHOUSE",
                                                "DISPATCH",
                                                "UTL_DISPATCH",
                                                "LOGISTICS");
        }

        @PostMapping("/{zohoItemId:.+}/move-to-fg")
        public ResponseEntity<?> moveToFg(
                        @PathVariable String zohoItemId,
                        @RequestParam(required = false) String fgZoneCode) {
                User user = currentUserService.requireCurrentUser();

                if (!currentUserService.isDispatch(user)
                                && !currentUserService.isUtlDispatch(user)
                                && !currentUserService.isAdmin(user)) {
                        return ResponseEntity
                                        .status(403)
                                        .body("Only DISPATCH / UTL_DISPATCH / ADMIN user can move item to FG");
                }

                dispatchedItemService.movePackedItemToFg(
                                zohoItemId,
                                fgZoneCode,
                                user.getUsername(),
                                currentUserService.allowedPlants(user));

                return ResponseEntity.ok(
                                java.util.Map.of(
                                                "message", "Moved to FG successfully",
                                                "zohoItemId", zohoItemId,
                                                "fgZoneCode", fgZoneCode == null ? "" : fgZoneCode));
        }

        /* ===================== REQUEST RESTORE ===================== */

        @PostMapping("/{zohoItemId:.+}/request-restore")
        public ResponseEntity<?> requestRestore(
                        @PathVariable String zohoItemId) {
                User user = currentUserService.requireCurrentUser();

                dispatchedItemService.requestRestore(
                                zohoItemId,
                                user.getUsername(),
                                user.getRole());

                return ResponseEntity.ok().build();
        }

        /* ===================== APPROVE RESTORE ===================== */

        @PostMapping("/{zohoItemId:.+}/approve-restore")
        public ResponseEntity<?> approveRestore(
                        @PathVariable String zohoItemId) {
                User user = currentUserService.requireCurrentUser();

                if (!currentUserService.isAdmin(user)) {
                        return ResponseEntity.status(403).build();
                }

                dispatchedItemService.approveRestore(
                                zohoItemId,
                                user.getUsername());

                return ResponseEntity.ok().build();
        }

        /* ===================== REJECT RESTORE ===================== */

        @PostMapping("/{zohoItemId:.+}/reject-restore")
        public ResponseEntity<?> rejectRestore(
                        @PathVariable String zohoItemId) {
                User user = currentUserService.requireCurrentUser();

                if (!currentUserService.isAdmin(user)) {
                        return ResponseEntity.status(403).build();
                }

                dispatchedItemService.rejectRestore(
                                zohoItemId,
                                user.getUsername());

                return ResponseEntity.ok().build();
        }

        /*
         * ============================================================
         * VERIFIED XLSX DISPATCH IMPORT
         * ============================================================
         *
         * Additive endpoints only. Existing Dispatch transitions, warehouse,
         * restore, challan, QR and Admin Edit endpoints remain unchanged.
         */

        @PostMapping(value = "/import/verify", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
        public ResponseEntity<DispatchImportVerificationResponse> verifyDispatchImport(
                        @RequestBody List<DispatchImportRow> rows) {

                User user = currentUserService.requireCurrentUser();

                if (!currentUserService.isDispatch(user)
                                && !currentUserService.isAdmin(user)) {
                        return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
                }

                return ResponseEntity.ok(
                                dispatchedItemService.verifyDispatchImport(rows));
        }

        @PostMapping(value = "/import/apply", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
        public ResponseEntity<DispatchImportApplyResponse> applyDispatchImport(
                        @RequestBody DispatchImportApplyRequest request) {

                User user = currentUserService.requireCurrentUser();

                if (!currentUserService.isDispatch(user)
                                && !currentUserService.isAdmin(user)) {
                        return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
                }

                return ResponseEntity.ok(
                                dispatchedItemService.applyVerifiedDispatchImport(
                                                request,
                                                user.getUsername()));
        }

        /* ===================== DISPATCH STATUS ===================== */

        @PostMapping("/{zohoItemId:.+}/dispatch")
        public ResponseEntity<?> updateDispatchStatus(
                        @PathVariable String zohoItemId,
                        @RequestParam String status) {
                User user = currentUserService.requireCurrentUser();

                if (!currentUserService.isDispatch(user)
                                && !currentUserService.isUtlDispatch(user)) {
                        return ResponseEntity.status(403).build();
                }
                ItemDispatchStatus parsedStatus;

                try {
                        parsedStatus = ItemDispatchStatus.valueOf(status);
                } catch (Exception e) {
                        return ResponseEntity.badRequest().body("Invalid status: " + status);
                }

                dispatchedItemService.updateDispatchStatus(
                                zohoItemId,
                                parsedStatus,
                                user.getUsername(),
                                currentUserService.allowedPlants(user));
                return ResponseEntity.ok().build();

        }

        /* ===================== MOVE TO WAREHOUSE ===================== */

        @PostMapping("/{zohoItemId:.+}/store")
        public ResponseEntity<?> moveToWarehouse(
                        @PathVariable String zohoItemId,
                        @RequestParam String warehouseCode,
                        @RequestParam(required = false) String fromLocation) {
                User user = currentUserService.requireCurrentUser();

                if (!currentUserService.canGenerateWarehouseGatePass(user)) {
                        return ResponseEntity
                                        .status(403)
                                        .body("Only DISPATCH / ADMIN user can generate warehouse gate pass");
                }

                if (warehouseCode == null || warehouseCode.isBlank()) {
                        return ResponseEntity.badRequest().body("Warehouse code required");
                }

                String gatePass = dispatchedItemService.moveToWarehouse(
                                zohoItemId,
                                warehouseCode,
                                fromLocation,
                                user.getUsername(),
                                currentUserService.allowedPlants(user));

                return ResponseEntity.ok(
                                java.util.Map.of(
                                                "gatePass", gatePass,
                                                "status", "WAREHOUSE_REQUESTED",
                                                "message", "Gate pass generated. Awaiting warehouse approval."));
        }

        @PostMapping("/bulk/store")
        public ResponseEntity<?> bulkMoveToWarehouse(
                        @RequestBody List<String> itemIds,
                        @RequestParam String warehouseCode,
                        @RequestParam(required = false) String fromLocation) {
                User user = currentUserService.requireCurrentUser();

                if (!currentUserService.canGenerateWarehouseGatePass(user)) {
                        return ResponseEntity
                                        .status(403)
                                        .body("Only DISPATCH / ADMIN user can generate warehouse gate pass");
                }

                String gatePass = dispatchedItemService.bulkMoveToWarehouse(
                                itemIds,
                                warehouseCode,
                                fromLocation,
                                user.getUsername(),
                                currentUserService.allowedPlants(user));

                return ResponseEntity.ok(
                                java.util.Map.of(
                                                "gatePass", gatePass,
                                                "status", "WAREHOUSE_REQUESTED",
                                                "message", "Bulk gate pass generated. Awaiting warehouse approval."));
        }

        @PostMapping("/bulk/status")
        public ResponseEntity<?> bulkStatusUpdate(
                        @RequestBody List<String> ids,
                        @RequestParam String status) {
                User user = currentUserService.requireCurrentUser();

                if (!currentUserService.isDispatch(user)
                                && !currentUserService.isUtlDispatch(user)) {
                        return ResponseEntity.status(403).build();
                }

                dispatchedItemService.bulkUpdateStatus(
                                ids,
                                ItemDispatchStatus.valueOf(status),
                                user.getUsername(),
                                currentUserService.allowedPlants(user));

                return ResponseEntity.ok().build();
        }

        @PostMapping("/{zohoItemId:.+}/request-return")
        public ResponseEntity<?> requestReturn(
                        @PathVariable String zohoItemId) {
                User user = currentUserService.requireCurrentUser();

                if (!currentUserService.isDispatch(user)) {
                        return ResponseEntity.status(403).build();
                }

                dispatchedItemService.requestReturnToDispatch(
                                zohoItemId,
                                user.getUsername());

                return ResponseEntity.ok().build();
        }

        @PostMapping("/{zohoItemId:.+}/approve-return")
        public ResponseEntity<?> approveReturn(
                        @PathVariable String zohoItemId) {
                User user = currentUserService.requireCurrentUser();

                if (!currentUserService.isAdmin(user)) {
                        return ResponseEntity.status(403).build();
                }

                dispatchedItemService.approveReturnToDispatch(
                                zohoItemId,
                                user.getUsername());

                return ResponseEntity.ok().build();
        }

        @PostMapping("/{zohoItemId:.+}/reject-return")
        public ResponseEntity<?> rejectReturn(
                        @PathVariable String zohoItemId) {
                User user = currentUserService.requireCurrentUser();

                if (!currentUserService.isAdmin(user)) {
                        return ResponseEntity.status(403).build();
                }

                dispatchedItemService.rejectReturnToDispatch(
                                zohoItemId,
                                user.getUsername());

                return ResponseEntity.ok().build();
        }

        @PatchMapping("/{zohoItemId:.+}/plant-location")
        public ResponseEntity<?> assignPlantLocation(
                        @PathVariable String zohoItemId,
                        @RequestBody PlantAssignmentRequest req) {
                User user = currentUserService.requireCurrentUser();

                if (!currentUserService.isAdmin(user)) {
                        return ResponseEntity.status(403)
                                        .body("Only ADMIN can assign plant/location");
                }

                if (req.getPlantCode() == null || req.getPlantCode().isBlank()) {
                        return ResponseEntity.badRequest().body("Plant code required");
                }

                return ResponseEntity.ok(
                                dispatchedItemService.assignPlantLocationToDispatchedItem(
                                                zohoItemId,
                                                req.getPlantCode(),
                                                req.getCurrentLocationCode(),
                                                req.getFgZoneCode(),
                                                req.getWarehouseCode(),
                                                user.getUsername()));
        }

        /*
         * ============================================================
         * PAGED DISPATCH CHALLAN HISTORY
         * ============================================================
         *
         * Additive endpoint used by the optimized Dispatch UI.
         * The legacy /challans endpoint remains available for older clients.
         */
        @GetMapping("/challans/search")
        public ResponseEntity<List<DispatchedChallanResponse>> searchDispatchedChallans(
                        @RequestParam(defaultValue = "0") int page,
                        @RequestParam(defaultValue = "" + DEFAULT_CHALLAN_PAGE_SIZE) int size) {

                User user = currentUserService.requireCurrentUser();

                int safePage = Math.max(page, 0);
                int safeSize = Math.min(
                                Math.max(size, 1),
                                MAX_CHALLAN_PAGE_SIZE);

                Pageable pageable = PageRequest.of(
                                safePage,
                                safeSize);

                Page<String> challanNumbersPage;

                if (currentUserService.isAdmin(user)) {
                        challanNumbersPage = dispatchedItemService.searchAllChallanNumbers(
                                        pageable);
                } else if (currentUserService.isUtlUser(user)) {
                        challanNumbersPage = dispatchedItemService.searchUtlVisibleChallanNumbers(
                                        user.getUsername(),
                                        pageable);
                } else if (currentUserService.isLogistics(user)) {
                        /* Logistics reads the plant-visible operational history, not dispatch ownership. */
                        challanNumbersPage = dispatchedItemService.searchPlantVisibleChallanNumbers(
                                        currentUserService.allowedPlants(user),
                                        pageable);
                } else {
                        challanNumbersPage = repository.findVisibleChallanNumbersPageForUser(
                                        ItemDispatchStatus.DISPATCHED,
                                        cleanLower(user.getUsername()),
                                        currentUserService.allowedPlants(user),
                                        pageable);
                }

                List<String> challanNumbers = challanNumbersPage.getContent();

                if (challanNumbers.isEmpty()) {
                        return ResponseEntity
                                        .ok()
                                        .header(
                                                        "X-Total-Pages",
                                                        String.valueOf(challanNumbersPage.getTotalPages()))
                                        .header(
                                                        "X-Total-Elements",
                                                        String.valueOf(challanNumbersPage.getTotalElements()))
                                        .header(
                                                        "X-Page-Number",
                                                        String.valueOf(challanNumbersPage.getNumber()))
                                        .header(
                                                        "X-Page-Size",
                                                        String.valueOf(challanNumbersPage.getSize()))
                                        .header(
                                                        "X-Has-Next",
                                                        String.valueOf(challanNumbersPage.hasNext()))
                                        .body(List.of());
                }

                List<DispatchedItem> pageItems = repository.findAllByChalaanNumberIn(
                                challanNumbers);

                String currentUsername = cleanLower(user.getUsername());
                Set<String> allowedPlants = currentUserService.isAdmin(user)
                                ? Set.of()
                                : currentUserService.allowedPlants(user);

                Map<String, List<DispatchedItem>> grouped = new LinkedHashMap<>();

                for (String challanNumber : challanNumbers) {
                        grouped.put(challanNumber, new ArrayList<>());
                }

                for (DispatchedItem item : pageItems) {
                        if (item == null
                                        || !isChallanHistoryStatus(item.getStatus())
                                        || item.getChalaanNumber() == null
                                        || item.getChalaanNumber().isBlank()) {
                                continue;
                        }

                        if (!currentUserService.isAdmin(user)) {
                                if (currentUserService.isUtlUser(user)) {
                                        if (utlWorkflowService == null
                                                        || !utlWorkflowService.canCurrentUserRead(item)) {
                                                continue;
                                        }
                                } else if (currentUserService.isLogistics(user)) {
                                        if (!isVisiblePlant(item.getPlantCode(), allowedPlants)) {
                                                continue;
                                        }
                                } else {
                                        if (!cleanLower(item.getDispatchedBy()).equals(currentUsername)) {
                                                continue;
                                        }

                                        if (!isVisiblePlant(item.getPlantCode(), allowedPlants)) {
                                                continue;
                                        }
                                }
                        }

                        List<DispatchedItem> bucket = grouped.get(
                                        item.getChalaanNumber().trim());

                        if (bucket != null) {
                                bucket.add(item);
                        }
                }

                List<DispatchedChallanResponse> response = new ArrayList<>();

                for (String challanNumber : challanNumbers) {
                        List<DispatchedItem> items = grouped.getOrDefault(
                                        challanNumber,
                                        List.of());

                        if (items.isEmpty()) {
                                continue;
                        }

                        response.add(
                                        buildDispatchedChallanResponse(
                                                        challanNumber,
                                                        items));
                }

                return ResponseEntity
                                .ok()
                                .header(
                                                HttpHeaders.CACHE_CONTROL,
                                                "no-store, no-cache, must-revalidate")
                                .header(
                                                "X-Total-Pages",
                                                String.valueOf(challanNumbersPage.getTotalPages()))
                                .header(
                                                "X-Total-Elements",
                                                String.valueOf(challanNumbersPage.getTotalElements()))
                                .header(
                                                "X-Page-Number",
                                                String.valueOf(challanNumbersPage.getNumber()))
                                .header(
                                                "X-Page-Size",
                                                String.valueOf(challanNumbersPage.getSize()))
                                .header(
                                                "X-Has-Next",
                                                String.valueOf(challanNumbersPage.hasNext()))
                                .body(response);
        }

        @GetMapping("/challans/{challanNumber:.+}")
        public ResponseEntity<DispatchedChallanResponse> getDispatchedChallan(
                        @PathVariable String challanNumber) {

                User user = currentUserService.requireCurrentUser();

                String cleanChallanNumber = challanNumber == null
                                ? ""
                                : challanNumber.trim();

                validateChallanNumber(cleanChallanNumber);

                if (cleanChallanNumber.isBlank()) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Challan number is required");
                }

                List<DispatchedItem> items = repository
                                .findAllByChalaanNumberIn(
                                                List.of(cleanChallanNumber))
                                .stream()
                                .filter(item -> item != null
                                                && isChallanHistoryStatus(item.getStatus())
                                                && item.getChalaanNumber() != null
                                                && cleanChallanNumber.equals(item.getChalaanNumber().trim()))
                                .toList();

                if (!currentUserService.isAdmin(user)) {
                        if (currentUserService.isUtlUser(user)) {
                                items = items
                                                .stream()
                                                .filter(item -> utlWorkflowService != null
                                                                && utlWorkflowService.canCurrentUserRead(item))
                                                .toList();
                        } else if (currentUserService.isLogistics(user)) {
                                Set<String> allowedPlants = currentUserService.allowedPlants(user);

                                items = items
                                                .stream()
                                                .filter(item -> isVisiblePlant(item.getPlantCode(), allowedPlants))
                                                .toList();
                        } else {
                                String currentUsername = cleanLower(user.getUsername());
                                Set<String> allowedPlants = currentUserService.allowedPlants(user);

                                items = items
                                                .stream()
                                                .filter(item -> cleanLower(item.getDispatchedBy())
                                                                .equals(currentUsername))
                                                .filter(item -> isVisiblePlant(item.getPlantCode(), allowedPlants))
                                                .toList();
                        }
                }

                if (items.isEmpty()) {
                        throw new ResponseStatusException(
                                        HttpStatus.NOT_FOUND,
                                        "Dispatched challan not found");
                }

                return ResponseEntity.ok(
                                buildDispatchedChallanResponse(
                                                cleanChallanNumber,
                                                items));
        }

        @GetMapping("/challans")
        public ResponseEntity<List<DispatchedChallanResponse>> getDispatchedChallans(
                        ) {
                User user = currentUserService.requireCurrentUser();

                List<ItemDispatchStatus> statuses = CHALLAN_HISTORY_STATUSES;

                List<DispatchedItem> sourceItems;

                if (currentUserService.isAdmin(user)
                                || currentUserService.isUtlUser(user)) {
                        /*
                         * UTL creator visibility can cross the physical source/target plant
                         * boundary, so legacy all-challans reads must start from dispatched
                         * rows and then apply the persisted UTL routing predicate.
                         */
                        sourceItems = repository.findByStatusIn(statuses);
                } else {
                        sourceItems = repository.findVisibleByStatusesAndPlantsIncludingLegacy(
                                        statuses,
                                        currentUserService.allowedPlants(user));
                }

                String currentUsername = cleanLower(user.getUsername());

                List<DispatchedItem> dispatchedItems = sourceItems
                                .stream()
                                .filter(item -> item.getChalaanNumber() != null
                                                && !item.getChalaanNumber().isBlank())
                                .filter(item -> {
                                        if (currentUserService.isAdmin(user)) {
                                                return true;
                                        }

                                        if (currentUserService.isUtlUser(user)) {
                                                return utlWorkflowService != null
                                                                && utlWorkflowService.canCurrentUserRead(item);
                                        }

                                        if (currentUserService.isLogistics(user)) {
                                                return true;
                                        }

                                        return cleanLower(item.getDispatchedBy())
                                                        .equals(currentUsername);
                                })
                                .toList();

                LinkedHashMap<String, List<DispatchedItem>> grouped = new LinkedHashMap<>();

                for (DispatchedItem item : dispatchedItems) {
                        String challanNumber = item.getChalaanNumber().trim();

                        grouped
                                        .computeIfAbsent(
                                                        challanNumber,
                                                        key -> new ArrayList<>())
                                        .add(item);
                }

                List<DispatchedChallanResponse> response = new ArrayList<>();

                for (Map.Entry<String, List<DispatchedItem>> entry : grouped.entrySet()) {
                        List<DispatchedItem> items = entry.getValue();

                        DispatchedItem first = items.get(0);

                        LocalDateTime dispatchedAt = items
                                        .stream()
                                        .map(DispatchedItem::getDispatchedAt)
                                        .filter(date -> date != null)
                                        .min(LocalDateTime::compareTo)
                                        .orElse(null);

                        LocalDateTime tripStartedAt = items
                                        .stream()
                                        .map(DispatchedItem::getTripStartedAt)
                                        .filter(date -> date != null)
                                        .min(LocalDateTime::compareTo)
                                        .orElse(dispatchedAt);

                        LocalDateTime tripEndedAt = items
                                        .stream()
                                        .map(DispatchedItem::getTripEndedAt)
                                        .filter(date -> date != null)
                                        .max(LocalDateTime::compareTo)
                                        .orElse(null);

                        LocalDateTime durationEnd = tripEndedAt != null
                                        ? tripEndedAt
                                        : LocalDateTime.now(TimeZoneConfig.APP_ZONE);

                        Long tripDurationMinutes = tripStartedAt == null
                                        ? null
                                        : ChronoUnit.MINUTES.between(
                                                        tripStartedAt,
                                                        durationEnd);

                        String tripStatus = tripEndedAt == null
                                        ? "RUNNING"
                                        : "ENDED";

                        List<DispatchedChallanItemResponse> itemResponses = items
                                        .stream()
                                        .map(this::toDispatchedChallanItemResponse)
                                        .toList();

                        response.add(
                                        new DispatchedChallanResponse(
                                                        entry.getKey(),
                                                        first.getDriverId(),
                                                        first.getDriverName(),
                                                        first.getVehicleId(),
                                                        first.getVehicleNumber(),
                                                        first.getHelperLoaderCount(),
                                                        dispatchedAt,
                                                        first.getDispatchedBy(),
                                                        tripStartedAt,
                                                        tripEndedAt,
                                                        tripDurationMinutes,
                                                        tripStatus,
                                                        items.size(),
                                                        itemResponses));
                }

                response.sort((a, b) -> {
                        LocalDateTime da = a.dispatchedAt();
                        LocalDateTime db = b.dispatchedAt();

                        if (da == null && db == null) {
                                return 0;
                        }

                        if (da == null) {
                                return 1;
                        }

                        if (db == null) {
                                return -1;
                        }

                        return db.compareTo(da);
                });

                return ResponseEntity.ok(response);
        }

        @Transactional
        @PostMapping("/challans/{challanNumber:.+}/end-trip")
        public ResponseEntity<?> endDispatchedChallanTrip(
                        @PathVariable String challanNumber,
                        @RequestBody(required = false) EndTripRequest request) {

                User user = currentUserService.requireCurrentUser();

                if (!currentUserService.isLogistics(user)
                                && !currentUserService.isAdmin(user)) {
                        return ResponseEntity
                                        .status(403)
                                        .body("Only LOGISTICS / ADMIN user can end trip");
                }

                String cleanChallanNumber = challanNumber == null
                                ? ""
                                : challanNumber.trim();

                validateChallanNumber(cleanChallanNumber);

                if (cleanChallanNumber.isBlank()) {
                        return ResponseEntity
                                        .badRequest()
                                        .body(
                                                        "Challan number is required");
                }

                List<DispatchedItem> items = repository
                                .findAllByChalaanNumberIn(
                                                List.of(cleanChallanNumber))
                                .stream()
                                .filter(item -> item != null
                                                && isChallanHistoryStatus(item.getStatus())
                                                && item.getChalaanNumber() != null
                                                && cleanChallanNumber.equals(item.getChalaanNumber().trim()))
                                .toList();

                if (!currentUserService.isAdmin(user)) {
                        Set<String> allowedPlants = currentUserService.allowedPlants(user);

                        items = items
                                        .stream()
                                        .filter(item -> isVisiblePlant(item.getPlantCode(), allowedPlants))
                                        .toList();
                }

                if (items.isEmpty()) {
                        return ResponseEntity
                                        .badRequest()
                                        .body("No dispatched items found for challan: " + challanNumber);
                }

                items = lockDispatchItemsForMutation(items);

                LocalDateTime nowIst = LocalDateTime.now(TimeZoneConfig.APP_ZONE);

                LocalDateTime selectedEndTime = firstNonNull(
                                request == null ? null : request.tripEndedAt(),
                                request == null ? null : request.endTime(),
                                request == null ? null : request.tripEnd());

                LocalDateTime finalEndTime = selectedEndTime != null
                                ? selectedEndTime
                                : nowIst;

                LocalDateTime tripStartedAt = items
                                .stream()
                                .map(DispatchedItem::getTripStartedAt)
                                .filter(date -> date != null)
                                .min(LocalDateTime::compareTo)
                                .orElse(null);

                if (tripStartedAt == null) {
                        tripStartedAt = items
                                        .stream()
                                        .map(DispatchedItem::getDispatchedAt)
                                        .filter(date -> date != null)
                                        .min(LocalDateTime::compareTo)
                                        .orElse(finalEndTime);
                }

                if (finalEndTime.isBefore(tripStartedAt)) {
                        return ResponseEntity
                                        .badRequest()
                                        .body("Trip end time cannot be before trip start time");
                }

                for (DispatchedItem item : items) {
                        if (item.getTripStartedAt() == null) {
                                item.setTripStartedAt(
                                                item.getDispatchedAt() != null
                                                                ? item.getDispatchedAt()
                                                                : tripStartedAt);
                        }

                        item.setTripEndedAt(finalEndTime);

                        /*
                         * If mobile/scan delivery already completed the row, the
                         * delivery timestamp represents the same physical end event.
                         * Keep it aligned when Admin/Logistics corrects that end time.
                         */
                        if (item.getStatus() == ItemDispatchStatus.DELIVERED) {
                                item.setDeliveredAt(finalEndTime);
                        }
                }

                repository.saveAll(items);

                if (logisticsDispatchTripService != null) {
                        logisticsDispatchTripService.updateLinkedTripEndTime(
                                        items,
                                        finalEndTime,
                                        user);
                }

                Long durationMinutes = ChronoUnit.MINUTES.between(
                                tripStartedAt,
                                finalEndTime);

                return ResponseEntity.ok(
                                Map.of(
                                                "message", "Trip end time saved successfully",
                                                "challanNumber", cleanChallanNumber,
                                                "tripStartedAt", tripStartedAt.toString(),
                                                "tripEndedAt", finalEndTime.toString(),
                                                "tripDurationMinutes", durationMinutes));
        }

        @Transactional
        @PostMapping("/challans/{challanNumber:.+}/helpers")
        public ResponseEntity<?> updateChallanHelpers(
                        @PathVariable String challanNumber,
                        @RequestBody(required = false) UpdateHelpersRequest request) {

                User user = currentUserService.requireCurrentUser();

                boolean permitted = currentUserService.isAdmin(user) ||
                                currentUserService.isDispatch(user) ||
                                currentUserService.isUtlDispatch(user) ||
                                currentUserService.isLogistics(user);

                if (!permitted) {
                        return ResponseEntity
                                        .status(403)
                                        .body(
                                                        "Only DISPATCH / UTL_DISPATCH / LOGISTICS / ADMIN can update helpers/loaders");
                }

                String cleanChallanNumber = challanNumber == null
                                ? ""
                                : challanNumber.trim();

                validateChallanNumber(cleanChallanNumber);

                if (cleanChallanNumber.isBlank()) {
                        return ResponseEntity
                                        .badRequest()
                                        .body("Challan number is required");
                }

                Integer helperLoaderCount = normalizeHelperLoaderCount(
                                request == null
                                                ? null
                                                : request.helperLoaderCount());

                List<DispatchedItem> challanItems = repository
                                .findAllByChalaanNumberIn(
                                                List.of(cleanChallanNumber))
                                .stream()
                                .filter(item -> item != null
                                                && isChallanHistoryStatus(item.getStatus())
                                                && item.getChalaanNumber() != null
                                                && cleanChallanNumber.equals(item.getChalaanNumber().trim()))
                                .toList();

                if (!currentUserService.isAdmin(user)) {
                        Set<String> allowedPlants = currentUserService.allowedPlants(user);

                        challanItems = challanItems
                                        .stream()
                                        .filter(item -> isVisiblePlant(item.getPlantCode(), allowedPlants))
                                        .toList();
                }

                /*
                 * Logistics can maintain any challan visible to its plants.
                 * Dispatch keeps the existing rule that it may maintain its own
                 * challans only. Filtering happens after the indexed challan lookup,
                 * so this no longer scans the complete DISPATCHED register.
                 */
                if (!currentUserService.isAdmin(user)
                                && !currentUserService.isLogistics(user)) {
                        String currentUsername = cleanLower(user.getUsername());

                        challanItems = challanItems
                                        .stream()
                                        .filter(item -> cleanLower(item.getDispatchedBy())
                                                        .equals(currentUsername))
                                        .toList();
                }

                if (challanItems.isEmpty()) {
                        return ResponseEntity
                                        .status(404)
                                        .body(
                                                        "No accessible dispatched items found for challan: "
                                                                        + cleanChallanNumber);
                }

                challanItems = lockDispatchItemsForMutation(challanItems);

                for (DispatchedItem item : challanItems) {
                        item.setHelperLoaderCount(
                                        helperLoaderCount);
                }

                repository.saveAll(
                                challanItems);

                Map<String, Object> response = new LinkedHashMap<>();

                response.put(
                                "challanNumber",
                                cleanChallanNumber);

                response.put(
                                "helperLoaderCount",
                                helperLoaderCount);

                response.put(
                                "message",
                                helperLoaderCount == null
                                                ? "Helpers/loaders cleared"
                                                : "Helpers/loaders updated successfully");

                return ResponseEntity.ok(
                                response);
        }

        public record UpdateHelpersRequest(
                        Integer helperLoaderCount) {
        }

        private Integer normalizeHelperLoaderCount(
                        Integer value) {

                if (value == null ||
                                value == 0) {
                        return null;
                }

                if (value < 0) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Helpers/loaders count cannot be negative");
                }

                if (value > 999) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Helpers/loaders count cannot exceed 999");
                }

                return value;
        }

        private DispatchedChallanResponse buildDispatchedChallanResponse(
                        String challanNumber,
                        List<DispatchedItem> items) {

                if (items == null || items.isEmpty()) {
                        throw new ResponseStatusException(
                                        HttpStatus.NOT_FOUND,
                                        "Dispatched challan not found");
                }

                DispatchedItem first = items.get(0);

                LocalDateTime dispatchedAt = items
                                .stream()
                                .map(DispatchedItem::getDispatchedAt)
                                .filter(date -> date != null)
                                .min(LocalDateTime::compareTo)
                                .orElse(null);

                LocalDateTime tripStartedAt = items
                                .stream()
                                .map(DispatchedItem::getTripStartedAt)
                                .filter(date -> date != null)
                                .min(LocalDateTime::compareTo)
                                .orElse(dispatchedAt);

                LocalDateTime tripEndedAt = items
                                .stream()
                                .map(DispatchedItem::getTripEndedAt)
                                .filter(date -> date != null)
                                .max(LocalDateTime::compareTo)
                                .orElse(null);

                LocalDateTime durationEnd = tripEndedAt != null
                                ? tripEndedAt
                                : LocalDateTime.now(TimeZoneConfig.APP_ZONE);

                Long tripDurationMinutes = tripStartedAt == null
                                ? null
                                : ChronoUnit.MINUTES.between(
                                                tripStartedAt,
                                                durationEnd);

                String tripStatus = tripEndedAt == null
                                ? "RUNNING"
                                : "ENDED";

                List<DispatchedChallanItemResponse> itemResponses = items
                                .stream()
                                .map(this::toDispatchedChallanItemResponse)
                                .toList();

                return new DispatchedChallanResponse(
                                challanNumber,
                                first.getDriverId(),
                                first.getDriverName(),
                                first.getVehicleId(),
                                first.getVehicleNumber(),
                                first.getHelperLoaderCount(),
                                dispatchedAt,
                                first.getDispatchedBy(),
                                tripStartedAt,
                                tripEndedAt,
                                tripDurationMinutes,
                                tripStatus,
                                items.size(),
                                itemResponses);
        }

        private boolean isVisiblePlant(
                        String plantCode,
                        Set<String> allowedPlants) {

                if (plantCode == null || plantCode.trim().isBlank()) {
                        return true;
                }

                if (allowedPlants == null || allowedPlants.isEmpty()) {
                        return false;
                }

                String cleanPlant = plantCode.trim();

                return allowedPlants.stream()
                                .filter(value -> value != null)
                                .map(String::trim)
                                .anyMatch(cleanPlant::equalsIgnoreCase);
        }

        private DispatchedChallanItemResponse toDispatchedChallanItemResponse(
                        DispatchedItem item) {
                return new DispatchedChallanItemResponse(
                                item.getZohoItemId(),
                                item.getName(),
                                item.getSku(),
                                item.getPdNo(),
                                item.getDrawingNo(),
                                item.getClientName(),
                                item.getClientAddress(),
                                item.getDescription(),
                                item.getRemarks(),
                                item.getPlantCode(),
                                firstNonBlank(
                                                item.getCurrentLocationCode(),
                                                item.getLocation()),
                                item.getStatus() == null
                                                ? ""
                                                : item.getStatus().name(),
                                item.getQuantity(),
                                item.getDispatchedAt(),
                                item.getDispatchedBy());
        }

        @PutMapping("/admin/bulk-edit")
        public ResponseEntity<AdminBulkDispatchEditResponse> adminBulkEdit(
                        @Valid @RequestBody AdminBulkDispatchEditRequest request) {
                User user = currentUserService.requireCurrentUser();

                if (!currentUserService.isAdmin(user)) {
                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "Only ADMIN can edit dispatch item details");
                }

                return ResponseEntity.ok(
                                dispatchedItemService.adminBulkEdit(
                                                request,
                                                user.getUsername()));
        }

        private List<DispatchedItem> lockDispatchItemsForMutation(
                        List<DispatchedItem> visibleItems) {

                if (visibleItems == null || visibleItems.isEmpty()) {
                        return List.of();
                }

                java.util.LinkedHashSet<String> ids = visibleItems.stream()
                                .map(DispatchedItem::getZohoItemId)
                                .filter(java.util.Objects::nonNull)
                                .map(String::trim)
                                .filter(value -> !value.isBlank())
                                .collect(java.util.stream.Collectors.toCollection(
                                                java.util.LinkedHashSet::new));

                if (ids.isEmpty() || ids.size() != visibleItems.size()) {
                        throw new ResponseStatusException(
                                        HttpStatus.CONFLICT,
                                        "One or more dispatch rows no longer has a valid ID");
                }

                if (ids.size() > MAX_ITEM_IDS_PER_MUTATION) {
                        throw new ResponseStatusException(
                                        HttpStatus.PAYLOAD_TOO_LARGE,
                                        "A challan cannot update more than "
                                                        + MAX_ITEM_IDS_PER_MUTATION
                                                        + " dispatch rows at once");
                }

                List<DispatchedItem> locked = repository.findAllByIdForDispatchUpdate(ids);

                if (locked.size() != ids.size()) {
                        throw new ResponseStatusException(
                                        HttpStatus.CONFLICT,
                                        "One or more dispatch rows changed while the challan was being updated. Refresh and try again.");
                }

                Map<String, DispatchedItem> byId = locked.stream()
                                .collect(java.util.stream.Collectors.toMap(
                                                DispatchedItem::getZohoItemId,
                                                java.util.function.Function.identity(),
                                                (first, ignored) -> first,
                                                java.util.LinkedHashMap::new));

                return ids.stream()
                                .map(byId::get)
                                .toList();
        }

        private void validateQueryText(
                        String value,
                        int maxLength,
                        String fieldName) {

                if (value != null && value.length() > maxLength) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        fieldName + " cannot exceed " + maxLength + " characters");
                }
        }

        private boolean isChallanHistoryStatus(
                        ItemDispatchStatus status) {

                return status != null
                                && CHALLAN_HISTORY_STATUSES.contains(status);
        }

        private void validateChallanNumber(
                        String value) {

                validateQueryText(value, 220, "Challan number");
        }

        private String firstNonBlank(
                        String... values) {
                if (values == null) {
                        return "";
                }

                for (String value : values) {
                        if (value != null && !value.trim().isBlank()) {
                                return value.trim();
                        }
                }

                return "";
        }

        public record DispatchedChallanResponse(
                        String challanNumber,
                        java.util.UUID driverId,
                        String driverName,
                        java.util.UUID vehicleId,
                        String vehicleNumber,
                        Integer helperLoaderCount,
                        LocalDateTime dispatchedAt,
                        String dispatchedBy,
                        LocalDateTime tripStartedAt,
                        LocalDateTime tripEndedAt,
                        Long tripDurationMinutes,
                        String tripStatus,
                        int totalItems,
                        List<DispatchedChallanItemResponse> items) {
        }

        public record DispatchedChallanItemResponse(
                        String zohoItemId,
                        String name,
                        String sku,
                        String pdNo,
                        String drawingNo,
                        String clientName,
                        String clientAddress,
                        String description,
                        String remarks,
                        String plantCode,
                        String currentLocationCode,
                        String status,
                        Integer quantity,
                        LocalDateTime dispatchedAt,
                        String dispatchedBy) {
        }

        private LocalDateTime firstNonNull(
                        LocalDateTime first,
                        LocalDateTime second,
                        LocalDateTime third) {
                if (first != null) {
                        return first;
                }

                if (second != null) {
                        return second;
                }

                return third;
        }

        public record EndTripRequest(
                        LocalDateTime tripEndedAt,
                        LocalDateTime endTime,
                        LocalDateTime tripEnd) {
        }

        private String cleanLower(String value) {
                if (value == null) {
                        return "";
                }

                return value.trim().toLowerCase();
        }
}