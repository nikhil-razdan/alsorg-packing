package com.alsorg.packing.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.controller.dto.dispatch.AdminBulkDispatchEditRequest;
import com.alsorg.packing.controller.dto.dispatch.AdminBulkDispatchEditResponse;
import com.alsorg.packing.controller.dto.dispatch.AdminDispatchEditField;
import com.alsorg.packing.controller.dto.dispatch.AdminUpdatedDispatchRow;
import com.alsorg.packing.domain.common.ApprovalStatus;
import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.domain.common.PacketItemType;
import com.alsorg.packing.domain.common.PacketStatus;
import com.alsorg.packing.domain.dispatch.DispatchedItem;
import com.alsorg.packing.domain.item.PacketItem;
import com.alsorg.packing.domain.logistics.Driver;
import com.alsorg.packing.domain.logistics.Vehicle;
import com.alsorg.packing.domain.packet.Packet;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.repository.DriverRepository;
import com.alsorg.packing.repository.PacketItemRepository;
import com.alsorg.packing.repository.PacketRepository;
import com.alsorg.packing.repository.VehicleRepository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.transaction.Transactional;

@Service
@Transactional
public class DispatchedItemService {

        private static final java.time.ZoneId APP_ZONE = java.time.ZoneId.of("Asia/Kolkata");

        private static final Set<String> FIXED_WAREHOUSE_CODES = Set.of(
                        "BLS-WH-1",
                        "RTP-WH-2",
                        "AL-P1",
                        "AL-P2",
                        "AL-P3",
                        "AL-P4");

        private static final Set<String> FIXED_FROM_LOCATION_CODES = Set.of(
                        "AL-P1-FG-1-A",
                        "AL-P1-FG-1-B",
                        "AL-P1-FG-1-C",
                        "AL-P2-FG-2",
                        "AL-P3-FG-3",
                        "AL-P4-FG-4",
                        "AL-P1",
                        "AL-P2",
                        "AL-P3",
                        "AL-P4",
                        "AL-P1-PKD-1",
                        "AL-P2-PKD-2",
                        "AL-P3-PKD-3",
                        "AL-P4-PKD-4");

        private final DispatchedItemRepository dispatchedRepo;
        private final AuditLogService auditLogService;
        private final ActivityLogService activityLogService;
        private final PacketItemRepository packetItemRepo;
        private final PacketRepository packetRepository;
        private final PlantLocationService plantLocationService;
        private final DriverRepository driverRepository;
        private final VehicleRepository vehicleRepository;
        private final StickerHistoryPdfRefreshService stickerHistoryPdfRefreshService;

        /*
         * Read-only Dispatch register queries sometimes need a content-only page
         * without Spring Data's automatic COUNT query. Field injection keeps the
         * existing constructor contract completely unchanged.
         */
        @PersistenceContext
        private EntityManager entityManager;

        private static final Set<AdminDispatchEditField> STICKER_PDF_CONTENT_FIELDS = Set.of(
                        AdminDispatchEditField.ITEM_NAME,
                        AdminDispatchEditField.PACKET_NUMBER,
                        AdminDispatchEditField.PD_NO,
                        AdminDispatchEditField.DRAWING_NO,
                        AdminDispatchEditField.CLIENT_NAME,
                        AdminDispatchEditField.CLIENT_ADDRESS,
                        AdminDispatchEditField.FLOOR,
                        AdminDispatchEditField.DESCRIPTION,
                        AdminDispatchEditField.WEIGHT,
                        AdminDispatchEditField.DIMENSIONS,
                        AdminDispatchEditField.REMARKS,
                        AdminDispatchEditField.STICKER_LOCATION);

        public DispatchedItemService(
                        DispatchedItemRepository dispatchedRepo,
                        AuditLogService auditLogService,
                        ActivityLogService activityLogService,
                        PacketItemRepository packetItemRepo,
                        PacketRepository packetRepository,
                        PlantLocationService plantLocationService,
                        DriverRepository driverRepository,
                        VehicleRepository vehicleRepository,
                        StickerHistoryPdfRefreshService stickerHistoryPdfRefreshService) {

                this.dispatchedRepo = dispatchedRepo;
                this.auditLogService = auditLogService;
                this.activityLogService = activityLogService;
                this.packetItemRepo = packetItemRepo;
                this.packetRepository = packetRepository;
                this.plantLocationService = plantLocationService;
                this.driverRepository = driverRepository;
                this.vehicleRepository = vehicleRepository;
                this.stickerHistoryPdfRefreshService = stickerHistoryPdfRefreshService;
        }

        /*
         * ============================================================
         * HIGH-PERFORMANCE DISPATCH REGISTER READ
         * ============================================================
         *
         * The legacy GET /api/dispatched endpoint remains untouched for
         * compatibility. The optimized frontend uses /api/dispatched/search,
         * which delegates here so filtering and pagination happen in PostgreSQL
         * instead of downloading the complete dispatch history into the browser.
         *
         * This method is read-only from a business-workflow perspective: it does
         * not modify status, stock, packet linkage, audit data, stickers, challans,
         * warehouse state, or any other dispatch record.
         */
        public Page<DispatchedItem> searchDispatchRegister(
                        Pageable pageable,
                        String search,
                        Collection<ItemDispatchStatus> statuses,
                        String plantFilter,
                        String dateMode,
                        String dateFrom,
                        String dateTo,
                        String timeFrom,
                        String timeTo,
                        boolean completeRegisterAccess,
                        Set<String> allowedPlants) {

                if (pageable == null) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Dispatch page request is required");
                }

                Specification<DispatchedItem> specification = buildDispatchRegisterSpecification(
                                search,
                                statuses,
                                plantFilter,
                                dateMode,
                                dateFrom,
                                dateTo,
                                timeFrom,
                                timeTo,
                                completeRegisterAccess,
                                allowedPlants);

                return dispatchedRepo.findAll(
                                specification,
                                pageable);
        }

        /**
         * High-volume page window used only by GET /api/dispatched/search.
         *
         * Existing clients still default to includeTotal=true and therefore receive
         * the exact same total-count semantics as before. The optimized Dispatch UI
         * can pass a total it already obtained for the same filter signature. In that
         * case only the requested rows (+ one look-ahead row) are queried and the
         * expensive COUNT is skipped.
         */
        public DispatchRegisterWindow searchDispatchRegisterWindow(
                        Pageable pageable,
                        String search,
                        Collection<ItemDispatchStatus> statuses,
                        String plantFilter,
                        String dateMode,
                        String dateFrom,
                        String dateTo,
                        String timeFrom,
                        String timeTo,
                        boolean completeRegisterAccess,
                        Set<String> allowedPlants,
                        boolean includeTotal,
                        Long knownTotalElements) {

                if (pageable == null) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Dispatch page request is required");
                }

                Specification<DispatchedItem> specification = buildDispatchRegisterSpecification(
                                search,
                                statuses,
                                plantFilter,
                                dateMode,
                                dateFrom,
                                dateTo,
                                timeFrom,
                                timeTo,
                                completeRegisterAccess,
                                allowedPlants);

                boolean requestedTotalReuse = !includeTotal
                                && knownTotalElements != null
                                && knownTotalElements >= 0L;

                int pageSize = Math.max(1, pageable.getPageSize());

                List<DispatchedItem> fetched = fetchDispatchRegisterRows(
                                specification,
                                pageable,
                                pageSize + 1);

                boolean hasLookAhead = fetched.size() > pageSize;

                List<DispatchedItem> items = hasLookAhead
                                ? List.copyOf(fetched.subList(0, pageSize))
                                : List.copyOf(fetched);

                /*
                 * If a concurrent delete made a formerly-valid page empty, a reused
                 * total can no longer tell us the new last page. Fall back to one
                 * exact count so the frontend can clamp itself safely.
                 */
                boolean canReuseTotal = requestedTotalReuse
                                && !(pageable.getPageNumber() > 0 && items.isEmpty());

                long totalElements;

                if (canReuseTotal) {
                        long observedOffset = Math.max(0L, pageable.getOffset());

                        if (hasLookAhead) {
                                /*
                                 * Concurrent inserts can only make the supplied total
                                 * too small. Never report fewer rows than this page has
                                 * already proved exist.
                                 */
                                long observedMinimum = observedOffset
                                                + items.size()
                                                + 1L;

                                totalElements = Math.max(
                                                knownTotalElements.longValue(),
                                                observedMinimum);
                        } else {
                                /*
                                 * The pageSize+1 probe proved there is no next row, so
                                 * this page gives us an exact current upper bound without
                                 * running COUNT(*).
                                 */
                                totalElements = observedOffset + items.size();
                        }
                } else {
                        totalElements = countDispatchRegisterRows(specification);
                }

                int totalPages = totalElements <= 0L
                                ? 1
                                : (int) Math.min(
                                                Integer.MAX_VALUE,
                                                Math.max(
                                                                1L,
                                                                (totalElements + pageSize - 1L) / pageSize));

                boolean hasNext = canReuseTotal
                                ? hasLookAhead
                                : pageable.getPageNumber() + 1 < totalPages;

                return new DispatchRegisterWindow(
                                items,
                                totalElements,
                                totalPages,
                                pageable.getPageNumber(),
                                pageSize,
                                hasNext,
                                canReuseTotal);
        }

        private Specification<DispatchedItem> buildDispatchRegisterSpecification(
                        String search,
                        Collection<ItemDispatchStatus> statuses,
                        String plantFilter,
                        String dateMode,
                        String dateFrom,
                        String dateTo,
                        String timeFrom,
                        String timeTo,
                        boolean completeRegisterAccess,
                        Set<String> allowedPlants) {

                return (root, query, cb) -> {
                        List<Predicate> predicates = new ArrayList<>();

                        appendDispatchAccessPredicate(
                                        predicates,
                                        root,
                                        cb,
                                        completeRegisterAccess,
                                        allowedPlants);

                        appendDispatchStatusPredicate(
                                        predicates,
                                        root,
                                        statuses);

                        appendDispatchPlantPredicate(
                                        predicates,
                                        root,
                                        cb,
                                        plantFilter);

                        appendDispatchSearchPredicate(
                                        predicates,
                                        root,
                                        cb,
                                        search);

                        appendDispatchDatePredicate(
                                        predicates,
                                        root,
                                        cb,
                                        dateMode,
                                        dateFrom,
                                        dateTo,
                                        timeFrom,
                                        timeTo);

                        return predicates.isEmpty()
                                        ? cb.conjunction()
                                        : cb.and(predicates.toArray(Predicate[]::new));
                };
        }

        private List<DispatchedItem> fetchDispatchRegisterRows(
                        Specification<DispatchedItem> specification,
                        Pageable pageable,
                        int maxResults) {

                CriteriaBuilder cb = entityManager.getCriteriaBuilder();
                CriteriaQuery<DispatchedItem> query = cb.createQuery(DispatchedItem.class);
                Root<DispatchedItem> root = query.from(DispatchedItem.class);

                Predicate predicate = specification.toPredicate(
                                root,
                                query,
                                cb);

                query.select(root);

                if (predicate != null) {
                        query.where(predicate);
                }

                applyDispatchRegisterSort(
                                query,
                                root,
                                cb,
                                pageable.getSort());

                TypedQuery<DispatchedItem> typedQuery = entityManager.createQuery(query);

                long offset = Math.max(0L, pageable.getOffset());

                if (offset > Integer.MAX_VALUE) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Dispatch page offset is too large");
                }

                typedQuery.setFirstResult((int) offset);
                typedQuery.setMaxResults(Math.max(1, maxResults));

                return typedQuery.getResultList();
        }

        private long countDispatchRegisterRows(
                        Specification<DispatchedItem> specification) {

                CriteriaBuilder cb = entityManager.getCriteriaBuilder();
                CriteriaQuery<Long> query = cb.createQuery(Long.class);
                Root<DispatchedItem> root = query.from(DispatchedItem.class);

                Predicate predicate = specification.toPredicate(
                                root,
                                query,
                                cb);

                query.select(cb.count(root));

                if (predicate != null) {
                        query.where(predicate);
                }

                Long count = entityManager
                                .createQuery(query)
                                .getSingleResult();

                return count == null
                                ? 0L
                                : Math.max(0L, count.longValue());
        }

        private void applyDispatchRegisterSort(
                        CriteriaQuery<DispatchedItem> query,
                        Root<DispatchedItem> root,
                        CriteriaBuilder cb,
                        Sort sort) {

                if (sort == null || sort.isUnsorted()) {
                        return;
                }

                List<jakarta.persistence.criteria.Order> orders = new ArrayList<>();

                for (Sort.Order order : sort) {
                        String property = order.getProperty();

                        if (!hasDispatchAttribute(root, property)) {
                                continue;
                        }

                        Expression<?> expression = root.get(property);

                        orders.add(
                                        order.isAscending()
                                                        ? cb.asc(expression)
                                                        : cb.desc(expression));
                }

                if (!orders.isEmpty()) {
                        query.orderBy(orders);
                }
        }

        public record DispatchRegisterWindow(
                        List<DispatchedItem> items,
                        long totalElements,
                        int totalPages,
                        int pageNumber,
                        int pageSize,
                        boolean hasNext,
                        boolean countReused) {
        }

        private void appendDispatchAccessPredicate(
                        List<Predicate> predicates,
                        Root<DispatchedItem> root,
                        CriteriaBuilder cb,
                        boolean completeRegisterAccess,
                        Set<String> allowedPlants) {

                if (completeRegisterAccess) {
                        return;
                }

                Expression<String> plant = root.get("plantCode");

                Predicate legacyRow = cb.or(
                                cb.isNull(plant),
                                cb.equal(cb.trim(plant), ""));

                if (allowedPlants == null || allowedPlants.isEmpty()) {
                        predicates.add(legacyRow);
                        return;
                }

                predicates.add(
                                cb.or(
                                                plant.in(allowedPlants),
                                                legacyRow));
        }

        private void appendDispatchStatusPredicate(
                        List<Predicate> predicates,
                        Root<DispatchedItem> root,
                        Collection<ItemDispatchStatus> statuses) {

                if (statuses == null || statuses.isEmpty()) {
                        return;
                }

                predicates.add(
                                root.get("status").in(statuses));
        }

        private void appendDispatchPlantPredicate(
                        List<Predicate> predicates,
                        Root<DispatchedItem> root,
                        CriteriaBuilder cb,
                        String plantFilter) {

                String cleanPlant = plantFilter == null
                                ? "ALL"
                                : plantFilter.trim().toUpperCase(Locale.ROOT);

                if (cleanPlant.isBlank() || "ALL".equals(cleanPlant)) {
                        return;
                }

                Expression<String> plant = root.get("plantCode");

                if ("UNASSIGNED".equals(cleanPlant)) {
                        predicates.add(
                                        cb.or(
                                                        cb.isNull(plant),
                                                        cb.equal(cb.trim(plant), "")));
                        return;
                }

                predicates.add(
                                cb.equal(
                                                cb.upper(cb.trim(plant)),
                                                cleanPlant));
        }

        private void appendDispatchSearchPredicate(
                        List<Predicate> predicates,
                        Root<DispatchedItem> root,
                        CriteriaBuilder cb,
                        String search) {

                List<String> tokens = dispatchSearchTokens(search);

                if (tokens.isEmpty()) {
                        return;
                }

                String[] searchableFields = {
                                "name",
                                "sku",
                                "clientName",
                                "clientAddress",
                                "pdNo",
                                "drawingNo",
                                "description",
                                "remarks",
                                "plantCode",
                                "packedAreaCode",
                                "currentLocationCode",
                                "location",
                                "fgAreaCode",
                                "fgZoneCode",
                                "warehouseCode",
                                "gatePassNumber",
                                "chalaanNumber",
                                "driverName",
                                "vehicleNumber",
                                "status",
                                "itemType"
                };

                /*
                 * Build the searchable row document once per SQL row instead of
                 * generating normal + compact LIKE expressions independently for
                 * every field and every token. With 21 fields, the previous query
                 * could create 42 LIKE branches per token and repeatedly execute
                 * the same replace/lower functions. The separator is deliberately
                 * not removed by compact normalization, so a match still cannot
                 * accidentally span from one field into the next.
                 */
                List<Expression<?>> searchDocumentParts = new ArrayList<>();
                searchDocumentParts.add(cb.literal("§"));

                for (String field : searchableFields) {
                        if (!hasDispatchAttribute(root, field)) {
                                continue;
                        }

                        searchDocumentParts.add(
                                        dispatchSearchFieldExpression(
                                                        root,
                                                        cb,
                                                        field));
                }

                if (searchDocumentParts.size() <= 1) {
                        return;
                }

                Expression<String> searchDocument = cb.function(
                                "concat_ws",
                                String.class,
                                searchDocumentParts.toArray(new Expression<?>[0]));

                Expression<String> normalSearchDocument = dispatchNormalSearchExpression(
                                cb,
                                searchDocument);

                Expression<String> compactSearchDocument = dispatchCompactSearchExpression(
                                cb,
                                searchDocument);

                for (String token : tokens) {
                        String normalToken = normalizeDispatchServerSearch(token);
                        String compactToken = compactDispatchServerSearch(token);

                        List<Predicate> tokenMatches = new ArrayList<>(3);

                        if (!normalToken.isBlank()) {
                                tokenMatches.add(
                                                cb.like(
                                                                normalSearchDocument,
                                                                "%" + escapeDispatchLike(normalToken) + "%",
                                                                '\\'));
                        }

                        if (!compactToken.isBlank()) {
                                tokenMatches.add(
                                                cb.like(
                                                                compactSearchDocument,
                                                                "%" + escapeDispatchLike(compactToken) + "%",
                                                                '\\'));
                        }

                        /*
                         * Compatibility alias used by the existing smart search.
                         */
                        if ("hw".equals(compactToken)
                                        || "hardware".equals(compactToken)) {
                                tokenMatches.add(
                                                cb.equal(
                                                                root.get("itemType"),
                                                                PacketItemType.HARDWARE));
                        }

                        if (!tokenMatches.isEmpty()) {
                                predicates.add(
                                                cb.or(tokenMatches.toArray(Predicate[]::new)));
                        }
                }
        }

        private Expression<String> dispatchSearchFieldExpression(
                        Root<DispatchedItem> root,
                        CriteriaBuilder cb,
                        String field) {

                Expression<String> raw = root.get(field).as(String.class);

                return cb.lower(
                                cb.coalesce(raw, ""));
        }

        private Expression<String> dispatchNormalSearchExpression(
                        CriteriaBuilder cb,
                        Expression<String> source) {

                Expression<String> result = source;

                result = cb.function(
                                "replace",
                                String.class,
                                result,
                                cb.literal("_"),
                                cb.literal(" "));

                result = cb.function(
                                "replace",
                                String.class,
                                result,
                                cb.literal("|"),
                                cb.literal(" "));

                return result;
        }

        private Expression<String> dispatchCompactSearchExpression(
                        CriteriaBuilder cb,
                        Expression<String> source) {

                Expression<String> result = source;

                for (String character : List.of(
                                " ",
                                "-",
                                "/",
                                "_",
                                "|",
                                ".",
                                ":",
                                "\\",
                                "(",
                                ")")) {

                        result = cb.function(
                                        "replace",
                                        String.class,
                                        result,
                                        cb.literal(character),
                                        cb.literal(""));
                }

                return result;
        }

        private void appendDispatchDatePredicate(
                        List<Predicate> predicates,
                        Root<DispatchedItem> root,
                        CriteriaBuilder cb,
                        String dateMode,
                        String dateFrom,
                        String dateTo,
                        String timeFrom,
                        String timeTo) {

                boolean dateFilterActive = hasText(dateFrom)
                                || hasText(dateTo)
                                || hasText(timeFrom)
                                || hasText(timeTo);

                if (!dateFilterActive) {
                        return;
                }

                Expression<LocalDateTime> activityDate = dispatchDateExpression(
                                root,
                                cb,
                                dateMode);

                predicates.add(cb.isNotNull(activityDate));

                if (hasText(dateFrom)) {
                        LocalDate from = parseDispatchDate(dateFrom, "From date");

                        predicates.add(
                                        cb.greaterThanOrEqualTo(
                                                        activityDate,
                                                        from.atStartOfDay()));
                }

                if (hasText(dateTo)) {
                        LocalDate to = parseDispatchDate(dateTo, "To date");

                        predicates.add(
                                        cb.lessThanOrEqualTo(
                                                        activityDate,
                                                        to.atTime(LocalTime.MAX)));
                }

                if (hasText(timeFrom) || hasText(timeTo)) {
                        String cleanFrom = hasText(timeFrom)
                                        ? parseDispatchTime(timeFrom, "From time").toString().substring(0, 5)
                                        : null;

                        String cleanTo = hasText(timeTo)
                                        ? parseDispatchTime(timeTo, "To time").toString().substring(0, 5)
                                        : null;

                        Expression<String> hhmm = cb.function(
                                        "to_char",
                                        String.class,
                                        activityDate,
                                        cb.literal("HH24:MI"));

                        if (cleanFrom != null && cleanTo != null
                                        && cleanFrom.compareTo(cleanTo) > 0) {

                                predicates.add(
                                                cb.or(
                                                                cb.greaterThanOrEqualTo(hhmm, cleanFrom),
                                                                cb.lessThanOrEqualTo(hhmm, cleanTo)));
                        } else {
                                if (cleanFrom != null) {
                                        predicates.add(
                                                        cb.greaterThanOrEqualTo(hhmm, cleanFrom));
                                }

                                if (cleanTo != null) {
                                        predicates.add(
                                                        cb.lessThanOrEqualTo(hhmm, cleanTo));
                                }
                        }
                }
        }

        private Expression<LocalDateTime> dispatchDateExpression(
                        Root<DispatchedItem> root,
                        CriteriaBuilder cb,
                        String dateMode) {

                String mode = dateMode == null
                                ? "ACTIVITY"
                                : dateMode.trim().toUpperCase(Locale.ROOT);

                Expression<LocalDateTime> packedAt = dispatchDateAttribute(
                                root,
                                "packedAt");

                Expression<LocalDateTime> dispatchedAt = dispatchDateAttribute(
                                root,
                                "dispatchedAt");

                Expression<LocalDateTime> tripStartedAt = dispatchDateAttribute(
                                root,
                                "tripStartedAt");

                Expression<LocalDateTime> deliveredAt = dispatchDateAttribute(
                                root,
                                "deliveredAt");

                Expression<LocalDateTime> updatedAt = dispatchDateAttribute(
                                root,
                                "updatedAt");

                Expression<LocalDateTime> createdAt = dispatchDateAttribute(
                                root,
                                "createdAt");

                if ("PACKING".equals(mode)) {
                        return coalesceDispatchDates(
                                        cb,
                                        packedAt,
                                        createdAt);
                }

                if ("DISPATCH".equals(mode)) {
                        return coalesceDispatchDates(
                                        cb,
                                        dispatchedAt,
                                        tripStartedAt);
                }

                if ("UPDATED".equals(mode)) {
                        return coalesceDispatchDates(
                                        cb,
                                        updatedAt,
                                        createdAt);
                }

                /*
                 * ACTIVITY mirrors the existing frontend's status-sensitive choice.
                 */
                Expression<LocalDateTime> deliveredFirst = coalesceDispatchDates(
                                cb,
                                deliveredAt,
                                dispatchedAt,
                                tripStartedAt,
                                updatedAt,
                                packedAt,
                                createdAt);

                Expression<LocalDateTime> dispatchedFirst = coalesceDispatchDates(
                                cb,
                                dispatchedAt,
                                tripStartedAt,
                                deliveredAt,
                                updatedAt,
                                packedAt,
                                createdAt);

                Expression<LocalDateTime> packedFirst = coalesceDispatchDates(
                                cb,
                                packedAt,
                                updatedAt,
                                createdAt);

                CriteriaBuilder.Case<LocalDateTime> activityCase = cb.selectCase();

                activityCase.when(
                                cb.equal(
                                                root.get("status"),
                                                ItemDispatchStatus.DELIVERED),
                                deliveredFirst);

                activityCase.when(
                                root.get("status").in(
                                                ItemDispatchStatus.DISPATCHED,
                                                ItemDispatchStatus.OUT_FOR_DELIVERY,
                                                ItemDispatchStatus.RESTORED),
                                dispatchedFirst);

                return activityCase.otherwise(
                                packedFirst);
        }

        private Expression<LocalDateTime> dispatchDateAttribute(
                        Root<DispatchedItem> root,
                        String attribute) {

                if (!hasDispatchAttribute(root, attribute)) {
                        return null;
                }

                return root.get(attribute).as(
                                LocalDateTime.class);
        }

        @SafeVarargs
        private final Expression<LocalDateTime> coalesceDispatchDates(
                        CriteriaBuilder cb,
                        Expression<LocalDateTime>... expressions) {

                CriteriaBuilder.Coalesce<LocalDateTime> coalesce = cb.coalesce();

                for (Expression<LocalDateTime> expression : expressions) {
                        if (expression != null) {
                                coalesce.value(expression);
                        }
                }

                return coalesce;
        }

        private boolean hasDispatchAttribute(
                        Root<DispatchedItem> root,
                        String attribute) {

                try {
                        root.getModel().getAttribute(attribute);
                        return true;
                } catch (IllegalArgumentException ignored) {
                        return false;
                }
        }

        private List<String> dispatchSearchTokens(
                        String search) {

                if (!hasText(search)) {
                        return List.of();
                }

                String[] rawTokens = search
                                .trim()
                                .split("[\\s,]+");

                List<String> tokens = new ArrayList<>();

                for (String rawToken : rawTokens) {
                        String token = rawToken == null
                                        ? ""
                                        : rawToken.trim();

                        if (token.isBlank()) {
                                continue;
                        }

                        token = token
                                        .replaceAll("^[\"']|[\"']$", "");

                        int colon = token.indexOf(':');

                        if (colon >= 0 && colon < token.length() - 1) {
                                token = token.substring(colon + 1);
                        }

                        if (!token.isBlank()) {
                                tokens.add(token);
                        }
                }

                return tokens;
        }

        private String normalizeDispatchServerSearch(
                        String value) {

                if (value == null) {
                        return "";
                }

                return value
                                .toLowerCase(Locale.ROOT)
                                .trim()
                                .replace('_', ' ')
                                .replace('|', ' ')
                                .replaceAll("\\s+", " ");
        }

        private String compactDispatchServerSearch(
                        String value) {

                if (value == null) {
                        return "";
                }

                return value
                                .toLowerCase(Locale.ROOT)
                                .replaceAll("[^a-z0-9]", "");
        }

        private String escapeDispatchLike(
                        String value) {

                return value
                                .replace("\\", "\\\\")
                                .replace("%", "\\%")
                                .replace("_", "\\_");
        }

        private LocalDate parseDispatchDate(
                        String value,
                        String label) {

                try {
                        return LocalDate.parse(value.trim());
                } catch (DateTimeParseException exception) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        label + " is invalid");
                }
        }

        private LocalTime parseDispatchTime(
                        String value,
                        String label) {

                try {
                        return LocalTime.parse(value.trim());
                } catch (DateTimeParseException exception) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        label + " is invalid");
                }
        }

        private boolean hasText(
                        String value) {
                return value != null && !value.trim().isBlank();
        }

        /*
         * ============================================================
         * RESTORE
         * ============================================================
         */

        public void requestRestore(
                        String zohoItemId,
                        String username,
                        String role) {

                DispatchedItem item = dispatchedRepo
                                .findById(zohoItemId)
                                .orElseThrow(() -> new IllegalStateException(
                                                "Item not found"));

                if (item.getStatus() == ItemDispatchStatus.OUT_FOR_DELIVERY) {

                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "Cannot restore while trip is out for delivery. End the trip first.");
                }

                if (item.getStatus() != ItemDispatchStatus.DISPATCHED &&
                                item.getStatus() != ItemDispatchStatus.DELIVERED) {

                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "Restore allowed only after delivery");
                }

                if (ApprovalStatus.PENDING.equals(
                                item.getApprovalStatus())) {

                        throw new IllegalStateException(
                                        "Restore already requested");
                }

                item.setApprovalStatus(
                                ApprovalStatus.PENDING);

                item.setApprovalRequestedBy(
                                username);

                item.setApprovalRequestedAt(
                                LocalDateTime.now());

                dispatchedRepo.save(item);

                auditLogService.log(
                                zohoItemId,
                                "Restore requested",
                                username,
                                role);

                activityLogService.log(
                                zohoItemId,
                                "RESTORE REQUESTED",
                                username,
                                role,
                                item.getStatus().name(),
                                item.getStatus().name(),
                                null);
        }

        public void approveRestore(
                        String zohoItemId,
                        String admin) {

                DispatchedItem item = dispatchedRepo
                                .findById(zohoItemId)
                                .orElseThrow(() -> new IllegalStateException(
                                                "Item not found"));

                if (item.getApprovalStatus() != ApprovalStatus.PENDING) {

                        throw new IllegalStateException(
                                        "No pending restore request");
                }

                item.setApprovalStatus(
                                ApprovalStatus.APPROVED);

                item.setApprovedBy(admin);
                item.setApprovedAt(
                                LocalDateTime.now());

                /*
                 * Keep the original dispatch record as history.
                 */
                item.setStatus(
                                ItemDispatchStatus.RESTORED);

                item.setStock(0);

                PacketItem original = null;

                /*
                 * First try the original linked packet item.
                 */
                if (item.getPacketItemId() != null) {
                        original = packetItemRepo
                                        .findById(
                                                        item.getPacketItemId())
                                        .orElse(null);
                }

                /*
                 * Fallback to the linked packet.
                 */
                if (original == null &&
                                item.getPacketId() != null) {

                        Packet packet = packetRepository
                                        .findById(
                                                        item.getPacketId())
                                        .orElse(null);

                        if (packet != null) {
                                original = new PacketItem();

                                original.setPacket(packet);
                                original.setItemName(
                                                item.getName());
                                original.setSku(
                                                item.getSku());
                                original.setClientName(
                                                item.getClientName());
                                original.setClientAddress(
                                                item.getClientAddress());
                                original.setPdNo(
                                                item.getPdNo());
                                original.setDrawingNo(
                                                item.getDrawingNo());
                                original.setDescription(
                                                item.getDescription());
                                original.setRemarks(
                                                item.getRemarks());
                                original.setQuantity(1);
                                original.setLocation("FLOOR");
                                original.setFloor("FLOOR");
                        }
                }

                /*
                 * Final fallback for old records where neither the packet
                 * nor original packet item remains available.
                 */
                if (original == null ||
                                original.getPacket() == null) {

                        Packet packet = new Packet();

                        packet.setId(
                                        UUID.randomUUID());

                        packet.setStatus(
                                        PacketStatus.CREATED);

                        packet.setCreatedAt(
                                        LocalDateTime.now());

                        packet.setCreatedBy(
                                        "SYSTEM");

                        packet = packetRepository.save(
                                        packet);

                        original = new PacketItem();

                        original.setPacket(packet);
                        original.setQuantity(1);
                        original.setItemName(
                                        item.getName());
                        original.setSku(
                                        item.getSku());
                        original.setClientName(
                                        item.getClientName());
                        original.setClientAddress(
                                        item.getClientAddress());
                        original.setPdNo(
                                        item.getPdNo());
                        original.setDrawingNo(
                                        item.getDrawingNo());
                        original.setDescription(
                                        item.getDescription());
                        original.setRemarks(
                                        item.getRemarks());
                        original.setLocation("FLOOR");
                        original.setFloor("FLOOR");
                }

                PacketItem restored = new PacketItem();

                restored.setId(
                                UUID.randomUUID());

                restored.setPacket(
                                original.getPacket());

                restored.setItemName(
                                original.getItemName());

                restored.setSku(
                                original.getSku());

                restored.setClientName(
                                original.getClientName());

                restored.setClientAddress(
                                original.getClientAddress());

                restored.setPdNo(
                                original.getPdNo());

                restored.setDrawingNo(
                                original.getDrawingNo());

                restored.setDescription(
                                original.getDescription());

                restored.setRemarks(
                                original.getRemarks());

                restored.setDimensions(
                                original.getDimensions());

                restored.setWeight(
                                original.getWeight());

                restored.setQuantity(
                                original.getQuantity() != null
                                                ? original.getQuantity()
                                                : 1);

                restored.setStatus("CREATED");
                restored.setLocation("FLOOR");
                restored.setFloor("FLOOR");

                Long currentPrintIteration = original.getPrintIteration();

                long nextPrintIteration = (currentPrintIteration == null
                                ? 1L
                                : currentPrintIteration.longValue())
                                + 1L;

                restored.setPrintIteration(
                                nextPrintIteration);

                restored.setStickerNumber(null);

                /*
                 * Maintain the same business item reference while creating
                 * a new PacketItem record for the restored sticker.
                 */
                restored.setZohoItemId(
                                item.getZohoItemId());

                packetItemRepo.save(restored);

                item.setPacketItemId(
                                restored.getId());

                dispatchedRepo.save(item);

                auditLogService.log(
                                zohoItemId,
                                "Restore approved",
                                admin,
                                "ADMIN");

                activityLogService.log(
                                zohoItemId,
                                "RESTORE APPROVED",
                                admin,
                                "ADMIN",
                                "DISPATCHED",
                                "RESTORED_TO_INVENTORY",
                                null);
        }

        public void rejectRestore(
                        String zohoItemId,
                        String admin) {

                DispatchedItem item = dispatchedRepo
                                .findById(zohoItemId)
                                .orElseThrow(() -> new IllegalStateException(
                                                "Item not found"));

                item.setApprovalStatus(
                                ApprovalStatus.REJECTED);

                item.setApprovedBy(admin);

                item.setApprovedAt(
                                LocalDateTime.now());

                dispatchedRepo.save(item);

                auditLogService.log(
                                zohoItemId,
                                "Restore rejected",
                                admin,
                                "ADMIN");

                activityLogService.log(
                                zohoItemId,
                                "RESTORE REJECTED",
                                admin,
                                "ADMIN",
                                "PENDING",
                                "REJECTED",
                                null);
        }

        /*
         * ============================================================
         * ACCESS AND LOCATION HELPERS
         * ============================================================
         */

        private void assertDispatchItemPlantAccess(
                        DispatchedItem item,
                        Set<String> allowedPlants) {

                if (allowedPlants == null ||
                                allowedPlants.isEmpty()) {

                        return;
                }

                /*
                 * Legacy records without plant data remain available.
                 */
                if (item.getPlantCode() == null ||
                                item.getPlantCode().isBlank()) {

                        return;
                }

                if (!allowedPlants.contains(
                                item.getPlantCode())) {

                        throw new RuntimeException(
                                        "User does not have access to plant: "
                                                        + item.getPlantCode());
                }
        }

        private boolean isInFg(
                        DispatchedItem item) {

                return item.getCurrentLocationCode() != null &&
                                item.getFgAreaCode() != null &&
                                item.getCurrentLocationCode()
                                                .startsWith(
                                                                item.getFgAreaCode());
        }

        private boolean canProceedFromPacked(
                        DispatchedItem item) {

                /*
                 * Preserve legacy behaviour where old items do not have
                 * plant/location tracking.
                 */
                if (item.getPlantCode() == null ||
                                item.getPlantCode().isBlank()) {

                        return true;
                }

                if (item.getCurrentLocationCode() == null ||
                                item.getCurrentLocationCode()
                                                .isBlank()) {

                        return true;
                }

                if (item.getFgAreaCode() == null ||
                                item.getFgAreaCode().isBlank()) {

                        return true;
                }

                return isInFg(item);
        }

        /*
         * ============================================================
         * STATUS
         * ============================================================
         */

        public void updateDispatchStatus(
                        String zohoItemId,
                        ItemDispatchStatus newStatus,
                        String username) {

                updateDispatchStatus(
                                zohoItemId,
                                newStatus,
                                username,
                                null);
        }

        public void updateDispatchStatus(
                        String zohoItemId,
                        ItemDispatchStatus newStatus,
                        String username,
                        Set<String> allowedPlants) {

                DispatchedItem item = dispatchedRepo
                                .findById(zohoItemId)
                                .orElseThrow(() -> new IllegalStateException(
                                                "Item not found"));

                assertDispatchItemPlantAccess(
                                item,
                                allowedPlants);

                ItemDispatchStatus current = item.getStatus();

                if (newStatus == ItemDispatchStatus.DISPATCHED) {

                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "DISPATCHED can only be set via Chalaan generation");
                }

                if (current == newStatus) {
                        return;
                }

                String role = "DISPATCH";
                String action;

                if (current == ItemDispatchStatus.READY &&
                                newStatus == ItemDispatchStatus.READY_TO_STORE) {

                        if (!canProceedFromPacked(item)) {
                                throw new ResponseStatusException(
                                                HttpStatus.BAD_REQUEST,
                                                "Move item to FG before warehouse action");
                        }

                        item.setStatus(newStatus);

                        action = "PACKED → READY_TO_STORE";
                } else if (current == ItemDispatchStatus.READY &&
                                newStatus == ItemDispatchStatus.READY_TO_DISPATCH) {

                        if (!canProceedFromPacked(item)) {
                                throw new ResponseStatusException(
                                                HttpStatus.BAD_REQUEST,
                                                "Move item to FG before dispatch action");
                        }

                        item.setStatus(newStatus);

                        action = "PACKED → READY_TO_DISPATCH";
                } else if (current == ItemDispatchStatus.READY_TO_STORE &&
                                newStatus == ItemDispatchStatus.WAREHOUSE_REQUESTED) {

                        item.setStatus(newStatus);

                        action = "WAREHOUSE REQUESTED";
                } else if (current == ItemDispatchStatus.IN_WAREHOUSE &&
                                newStatus == ItemDispatchStatus.READY_TO_DISPATCH) {

                        item.setStatus(newStatus);

                        action = "WAREHOUSE → READY_TO_DISPATCH";
                } else {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Invalid transition: "
                                                        + current
                                                        + " → "
                                                        + newStatus);
                }

                dispatchedRepo.save(item);

                auditLogService.log(
                                zohoItemId,
                                action,
                                username,
                                role);

                activityLogService.log(
                                zohoItemId,
                                action,
                                username,
                                role,
                                current == null
                                                ? null
                                                : current.name(),
                                newStatus.name(),
                                item.getGatePassNumber());
        }

        public void bulkUpdateStatus(
                        List<String> ids,
                        ItemDispatchStatus status,
                        String username) {

                bulkUpdateStatus(
                                ids,
                                status,
                                username,
                                null);
        }

        public void bulkUpdateStatus(
                        List<String> ids,
                        ItemDispatchStatus status,
                        String username,
                        Set<String> allowedPlants) {

                if (ids == null ||
                                ids.isEmpty()) {

                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "No items selected");
                }

                List<DispatchedItem> items = dispatchedRepo.findAllById(ids);

                if (items.size() != new LinkedHashSet<>(ids).size()) {

                        throw new ResponseStatusException(
                                        HttpStatus.NOT_FOUND,
                                        "One or more selected dispatch items were not found");
                }

                for (DispatchedItem item : items) {
                        updateDispatchStatus(
                                        item.getZohoItemId(),
                                        status,
                                        username,
                                        allowedPlants);
                }
        }

        /*
         * ============================================================
         * VERIFIED XLSX DISPATCH IMPORT
         * ============================================================
         *
         * This is intentionally isolated from updateDispatchStatus().
         * The normal live workflow keeps all of its existing transition rules.
         * XLSX import is a controlled reconciliation path for historical/physical
         * dispatch data and is therefore allowed to move a verified Dispatch-page
         * row from ANY current status to DISPATCHED.
         *
         * Matching is authoritative on:
         * Item Name + PD No + DWG No
         *
         * Description and Client are used only as duplicate tie-breakers. Every
         * database row can be allocated only once per verification request, which
         * prevents repeated Excel lines from dispatching the same packet twice.
         */

        @Transactional
        public DispatchImportVerificationResponse verifyDispatchImport(
                        List<DispatchImportRow> importRows) {

                if (importRows == null || importRows.isEmpty()) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "No Excel rows were supplied for verification");
                }

                if (importRows.size() > 5000) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "A maximum of 5000 Excel rows can be verified at one time");
                }

                List<DispatchedItem> allDispatchItems = dispatchedRepo.findAll();

                Map<String, List<DispatchedItem>> candidatesByKey = new LinkedHashMap<>();

                for (DispatchedItem item : allDispatchItems) {
                        if (item == null || item.getZohoItemId() == null) {
                                continue;
                        }

                        String key = buildDispatchImportKey(
                                        item.getName(),
                                        item.getPdNo(),
                                        item.getDrawingNo());

                        if (key == null) {
                                continue;
                        }

                        candidatesByKey
                                        .computeIfAbsent(key, ignored -> new ArrayList<>())
                                        .add(item);
                }

                /* Stable allocation keeps verification repeatable. */
                for (List<DispatchedItem> candidates : candidatesByKey.values()) {
                        candidates.sort((left, right) -> safeDispatchImportId(left)
                                        .compareToIgnoreCase(safeDispatchImportId(right)));
                }

                Set<String> allocatedItemIds = new LinkedHashSet<>();
                List<DispatchImportVerificationRow> resultRows = new ArrayList<>();

                int matched = 0;
                int unmatched = 0;
                int invalid = 0;
                int duplicateAllocations = 0;

                for (int index = 0; index < importRows.size(); index++) {
                        DispatchImportRow row = importRows.get(index);
                        Integer rowNumber = row != null && row.rowNumber() != null
                                        ? row.rowNumber()
                                        : index + 2;

                        if (row == null) {
                                invalid++;
                                resultRows.add(invalidDispatchImportRow(
                                                rowNumber,
                                                null,
                                                "Excel row is empty"));
                                continue;
                        }

                        String key = buildDispatchImportKey(
                                        row.itemName(),
                                        row.pdNo(),
                                        row.drawingNo());

                        if (key == null) {
                                invalid++;
                                resultRows.add(invalidDispatchImportRow(
                                                rowNumber,
                                                row,
                                                "Item Name, PD No and DWG No are required"));
                                continue;
                        }

                        LocalDateTime dispatchDateTime = tryParseDispatchImportDateTime(
                                        row.dispatchDateTime());

                        if (dispatchDateTime == null) {
                                invalid++;
                                resultRows.add(invalidDispatchImportRow(
                                                rowNumber,
                                                row,
                                                "Dispatch Date is missing or invalid"));
                                continue;
                        }

                        List<DispatchedItem> allCandidates = candidatesByKey.getOrDefault(
                                        key,
                                        List.of());

                        List<DispatchedItem> availableCandidates = allCandidates
                                        .stream()
                                        .filter(candidate -> !allocatedItemIds.contains(
                                                        candidate.getZohoItemId()))
                                        .collect(Collectors.toCollection(ArrayList::new));

                        if (availableCandidates.isEmpty()) {
                                unmatched++;

                                String reason = allCandidates.isEmpty()
                                                ? "No Dispatch-page item matched Item Name + PD No + DWG No"
                                                : "Matching database items exist, but all were already allocated to earlier Excel rows";

                                resultRows.add(new DispatchImportVerificationRow(
                                                rowNumber,
                                                "UNMATCHED",
                                                reason,
                                                row.itemName(),
                                                row.pdNo(),
                                                row.drawingNo(),
                                                row.description(),
                                                row.clientName(),
                                                row.sourceStatus(),
                                                dispatchDateTime.toString(),
                                                cleanDriverName(row.driverName()),
                                                null,
                                                null,
                                                null,
                                                null,
                                                null,
                                                null,
                                                null,
                                                null,
                                                allCandidates.size(),
                                                0,
                                                false));
                                continue;
                        }

                        availableCandidates.sort((left, right) -> {
                                int rightScore = scoreDispatchImportCandidate(right, row);
                                int leftScore = scoreDispatchImportCandidate(left, row);

                                int scoreCompare = Integer.compare(rightScore, leftScore);

                                if (scoreCompare != 0) {
                                        return scoreCompare;
                                }

                                return safeDispatchImportId(left)
                                                .compareToIgnoreCase(safeDispatchImportId(right));
                        });

                        DispatchedItem selected = availableCandidates.get(0);
                        allocatedItemIds.add(selected.getZohoItemId());
                        matched++;

                        if (allCandidates.size() > 1) {
                                duplicateAllocations++;
                        }

                        String reason = allCandidates.size() > 1
                                        ? "Verified Item + PD + DWG; uniquely allocated from "
                                                        + allCandidates.size()
                                                        + " matching database rows (Description/Client used as tie-breakers)"
                                        : "Verified Item Name + PD No + DWG No";

                        resultRows.add(new DispatchImportVerificationRow(
                                        rowNumber,
                                        "MATCHED",
                                        reason,
                                        row.itemName(),
                                        row.pdNo(),
                                        row.drawingNo(),
                                        row.description(),
                                        row.clientName(),
                                        row.sourceStatus(),
                                        dispatchDateTime.toString(),
                                        cleanDriverName(row.driverName()),
                                        selected.getZohoItemId(),
                                        selected.getName(),
                                        selected.getSku(),
                                        selected.getStatus() == null
                                                        ? null
                                                        : selected.getStatus().name(),
                                        selected.getDriverName(),
                                        selected.getDispatchedAt() == null
                                                        ? null
                                                        : selected.getDispatchedAt().toString(),
                                        selected.getPlantCode(),
                                        firstNonBlank(
                                                        selected.getCurrentLocationCode(),
                                                        selected.getLocation()),
                                        allCandidates.size(),
                                        availableCandidates.size(),
                                        true));
                }

                return new DispatchImportVerificationResponse(
                                importRows.size(),
                                matched,
                                unmatched,
                                invalid,
                                duplicateAllocations,
                                resultRows);
        }

        @Transactional
        public DispatchImportApplyResponse applyVerifiedDispatchImport(
                        DispatchImportApplyRequest request,
                        String username) {

                if (request == null || request.rows() == null || request.rows().isEmpty()) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "No verified Excel rows were selected for dispatch");
                }

                if (request.rows().size() > 5000) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "A maximum of 5000 Excel rows can be applied at one time");
                }

                String actor = cleanNullable(username);
                actor = actor == null ? "SYSTEM" : actor;

                LinkedHashMap<String, DispatchImportApplyRow> requestedById = new LinkedHashMap<>();

                for (DispatchImportApplyRow row : request.rows()) {
                        if (row == null || cleanNullable(row.zohoItemId()) == null) {
                                throw new ResponseStatusException(
                                                HttpStatus.BAD_REQUEST,
                                                "A verified Dispatch item id is missing");
                        }

                        String itemId = row.zohoItemId().trim();

                        if (requestedById.putIfAbsent(itemId, row) != null) {
                                throw new ResponseStatusException(
                                                HttpStatus.BAD_REQUEST,
                                                "The same Dispatch item was selected more than once: " + itemId);
                        }
                }

                List<DispatchedItem> items = dispatchedRepo.findAllById(requestedById.keySet());

                if (items.size() != requestedById.size()) {
                        throw new ResponseStatusException(
                                        HttpStatus.NOT_FOUND,
                                        "One or more verified Dispatch items no longer exist");
                }

                Map<String, DispatchedItem> itemsById = new LinkedHashMap<>();

                for (DispatchedItem item : items) {
                        itemsById.put(item.getZohoItemId(), item);
                }

                /* Validate every selected row before changing anything. */
                Map<String, LocalDateTime> dispatchTimesById = new LinkedHashMap<>();

                for (Map.Entry<String, DispatchImportApplyRow> entry : requestedById.entrySet()) {
                        String itemId = entry.getKey();
                        DispatchImportApplyRow row = entry.getValue();
                        DispatchedItem item = itemsById.get(itemId);

                        String expectedKey = buildDispatchImportKey(
                                        row.itemName(),
                                        row.pdNo(),
                                        row.drawingNo());

                        String actualKey = buildDispatchImportKey(
                                        item.getName(),
                                        item.getPdNo(),
                                        item.getDrawingNo());

                        if (expectedKey == null || !Objects.equals(expectedKey, actualKey)) {
                                throw new ResponseStatusException(
                                                HttpStatus.CONFLICT,
                                                "Verified identity changed before apply for Excel row "
                                                                + safe(row.rowNumber())
                                                                + ". Please verify the file again.");
                        }

                        LocalDateTime dispatchDateTime = tryParseDispatchImportDateTime(
                                        row.dispatchDateTime());

                        if (dispatchDateTime == null) {
                                throw new ResponseStatusException(
                                                HttpStatus.BAD_REQUEST,
                                                "Invalid Dispatch Date for Excel row " + safe(row.rowNumber()));
                        }

                        dispatchTimesById.put(itemId, dispatchDateTime);
                }

                Map<String, Driver> driversByName = new LinkedHashMap<>();

                for (Driver driver : driverRepository.findAll()) {
                        if (driver == null || driver.getId() == null) {
                                continue;
                        }

                        String key = normalizeDispatchImportDriver(driver.getName());

                        if (!key.isBlank()) {
                                driversByName.putIfAbsent(key, driver);
                        }
                }

                Set<UUID> packetItemIds = items.stream()
                                .map(DispatchedItem::getPacketItemId)
                                .filter(Objects::nonNull)
                                .collect(Collectors.toCollection(LinkedHashSet::new));

                Map<UUID, PacketItem> packetItemsById = new LinkedHashMap<>();

                if (!packetItemIds.isEmpty()) {
                        packetItemRepo.findAllById(packetItemIds)
                                        .forEach(packetItem -> packetItemsById.put(
                                                        packetItem.getId(),
                                                        packetItem));
                }

                List<DispatchImportAppliedRow> appliedRows = new ArrayList<>();

                for (Map.Entry<String, DispatchImportApplyRow> entry : requestedById.entrySet()) {
                        String itemId = entry.getKey();
                        DispatchImportApplyRow importRow = entry.getValue();
                        DispatchedItem item = itemsById.get(itemId);

                        ItemDispatchStatus previousStatus = item.getStatus();
                        LocalDateTime dispatchDateTime = dispatchTimesById.get(itemId);

                        String requestedDriverName = cleanDriverName(importRow.driverName());
                        Driver matchedDriver = requestedDriverName == null
                                        ? null
                                        : driversByName.get(normalizeDispatchImportDriver(requestedDriverName));

                        item.setStatus(ItemDispatchStatus.DISPATCHED);
                        item.setStock(0);
                        item.setDispatchedAt(dispatchDateTime);
                        item.setTripStartedAt(dispatchDateTime);
                        item.setTripEndedAt(null);
                        item.setDeliveredAt(null);
                        item.setDispatchedBy(actor);

                        if (matchedDriver != null) {
                                item.setDriverId(matchedDriver.getId());
                                item.setDriverName(cleanDriverName(matchedDriver.getName()));
                        } else {
                                item.setDriverId(null);
                                item.setDriverName(requestedDriverName);
                        }

                        PacketItem packetItem = item.getPacketItemId() == null
                                        ? null
                                        : packetItemsById.get(item.getPacketItemId());

                        if (packetItem != null) {
                                /*
                                 * Keep the underlying packet/item lifecycle consistent with
                                 * the Dispatch register. No other packet data is edited.
                                 */
                                packetItem.setStatus("DISPATCHED");
                        }

                        auditLogService.log(
                                        itemId,
                                        "Dispatched via verified XLSX import | Excel row: "
                                                        + safe(importRow.rowNumber())
                                                        + " | Dispatch Date: "
                                                        + dispatchDateTime
                                                        + " | Driver: "
                                                        + safe(item.getDriverName()),
                                        actor,
                                        "DISPATCH");

                        activityLogService.log(
                                        itemId,
                                        "XLSX IMPORT → DISPATCHED",
                                        actor,
                                        "DISPATCH",
                                        previousStatus == null
                                                        ? null
                                                        : previousStatus.name(),
                                        ItemDispatchStatus.DISPATCHED.name(),
                                        item.getChalaanNumber());

                        appliedRows.add(new DispatchImportAppliedRow(
                                        importRow.rowNumber(),
                                        itemId,
                                        item.getName(),
                                        previousStatus == null
                                                        ? null
                                                        : previousStatus.name(),
                                        ItemDispatchStatus.DISPATCHED.name(),
                                        dispatchDateTime.toString(),
                                        item.getDriverName(),
                                        item.getChalaanNumber()));
                }

                dispatchedRepo.saveAll(items);

                if (!packetItemsById.isEmpty()) {
                        packetItemRepo.saveAll(packetItemsById.values());
                }

                return new DispatchImportApplyResponse(
                                request.rows().size(),
                                appliedRows.size(),
                                appliedRows);
        }

        private DispatchImportVerificationRow invalidDispatchImportRow(
                        Integer rowNumber,
                        DispatchImportRow row,
                        String reason) {

                return new DispatchImportVerificationRow(
                                rowNumber,
                                "INVALID",
                                reason,
                                row == null ? null : row.itemName(),
                                row == null ? null : row.pdNo(),
                                row == null ? null : row.drawingNo(),
                                row == null ? null : row.description(),
                                row == null ? null : row.clientName(),
                                row == null ? null : row.sourceStatus(),
                                row == null ? null : row.dispatchDateTime(),
                                row == null ? null : cleanDriverName(row.driverName()),
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                0,
                                0,
                                false);
        }

        private int scoreDispatchImportCandidate(
                        DispatchedItem candidate,
                        DispatchImportRow row) {

                int score = 0;

                String rowDescription = normalizeDispatchImportText(row.description());
                String candidateDescription = normalizeDispatchImportText(candidate.getDescription());

                if (!rowDescription.isBlank() && rowDescription.equals(candidateDescription)) {
                        score += 8;
                } else if (!rowDescription.isBlank()
                                && !candidateDescription.isBlank()
                                && (rowDescription.contains(candidateDescription)
                                                || candidateDescription.contains(rowDescription))) {
                        score += 3;
                }

                String rowClient = normalizeDispatchImportText(row.clientName());
                String candidateClient = normalizeDispatchImportText(candidate.getClientName());

                if (!rowClient.isBlank() && rowClient.equals(candidateClient)) {
                        score += 4;
                }

                return score;
        }

        private String buildDispatchImportKey(
                        String itemName,
                        String pdNo,
                        String drawingNo) {

                String item = normalizeDispatchImportName(itemName);
                String pd = normalizeDispatchImportIdentifier(pdNo);
                String drawing = normalizeDispatchImportIdentifier(drawingNo);

                if (item.isBlank() || pd.isBlank() || drawing.isBlank()) {
                        return null;
                }

                return item + "||" + pd + "||" + drawing;
        }

        private String normalizeDispatchImportName(
                        String value) {

                if (value == null) {
                        return "";
                }

                return value
                                .trim()
                                .toLowerCase(Locale.ROOT)
                                .replaceAll("[^\\p{L}\\p{N}]", "");
        }

        private String normalizeDispatchImportText(
                        String value) {

                if (value == null) {
                        return "";
                }

                return value
                                .trim()
                                .toLowerCase(Locale.ROOT)
                                .replace('–', '-')
                                .replace('—', '-')
                                .replaceAll("\\s+", " ")
                                .replaceAll("[^\\p{L}\\p{N}]+", " ")
                                .trim();
        }

        private String normalizeDispatchImportIdentifier(
                        String value) {

                if (value == null) {
                        return "";
                }

                String upper = value
                                .trim()
                                .toUpperCase(Locale.ROOT)
                                .replace('–', '-')
                                .replace('—', '-');

                String compact = upper.replaceAll("[^A-Z0-9]", "");

                if (compact.isBlank()) {
                        return "";
                }

                if (Set.of("NA", "NIL", "NOTAPPLICABLE").contains(compact)) {
                        return "NA";
                }

                java.util.regex.Matcher matcher = java.util.regex.Pattern
                                .compile("[A-Z]+|\\d+")
                                .matcher(upper);

                List<String> tokens = new ArrayList<>();

                while (matcher.find()) {
                        String token = matcher.group();

                        if (token.matches("\\d+")) {
                                token = token.replaceFirst("^0+(?!$)", "");
                        }

                        tokens.add(token);
                }

                return tokens.isEmpty()
                                ? compact
                                : String.join("|", tokens);
        }

        private String normalizeDispatchImportDriver(
                        String value) {

                String clean = cleanDriverName(value);

                return clean == null
                                ? ""
                                : clean.toLowerCase(Locale.ROOT);
        }

        private LocalDateTime tryParseDispatchImportDateTime(
                        String value) {

                String clean = cleanNullable(value);

                if (clean == null) {
                        return null;
                }

                try {
                        return LocalDateTime.parse(clean);
                } catch (DateTimeParseException ignored) {
                        /* try date-only below */
                }

                try {
                        return LocalDate.parse(clean).atStartOfDay();
                } catch (DateTimeParseException ignored) {
                        return null;
                }
        }

        private String safeDispatchImportId(
                        DispatchedItem item) {

                return item == null || item.getZohoItemId() == null
                                ? ""
                                : item.getZohoItemId().trim();
        }

        public record DispatchImportRow(
                        Integer rowNumber,
                        String itemName,
                        String pdNo,
                        String drawingNo,
                        String description,
                        String clientName,
                        String sourceStatus,
                        String dispatchDateTime,
                        String driverName) {
        }

        public record DispatchImportVerificationRow(
                        Integer rowNumber,
                        String matchStatus,
                        String matchReason,
                        String itemName,
                        String pdNo,
                        String drawingNo,
                        String description,
                        String clientName,
                        String sourceStatus,
                        String dispatchDateTime,
                        String driverName,
                        String zohoItemId,
                        String matchedItemName,
                        String sku,
                        String currentStatus,
                        String currentDriverName,
                        String currentDispatchDateTime,
                        String plantCode,
                        String currentLocation,
                        int candidateCount,
                        int availableCandidateCount,
                        boolean applyEligible) {
        }

        public record DispatchImportVerificationResponse(
                        int totalRows,
                        int matchedCount,
                        int unmatchedCount,
                        int invalidCount,
                        int duplicateAllocationCount,
                        List<DispatchImportVerificationRow> rows) {
        }

        public record DispatchImportApplyRow(
                        Integer rowNumber,
                        String zohoItemId,
                        String itemName,
                        String pdNo,
                        String drawingNo,
                        String dispatchDateTime,
                        String driverName) {
        }

        public record DispatchImportApplyRequest(
                        List<DispatchImportApplyRow> rows) {
        }

        public record DispatchImportAppliedRow(
                        Integer rowNumber,
                        String zohoItemId,
                        String itemName,
                        String previousStatus,
                        String currentStatus,
                        String dispatchDateTime,
                        String driverName,
                        String challanNumber) {
        }

        public record DispatchImportApplyResponse(
                        int requestedCount,
                        int updatedCount,
                        List<DispatchImportAppliedRow> rows) {
        }

        /*
         * ============================================================
         * WAREHOUSE
         * ============================================================
         */

        public String moveToWarehouse(
                        String zohoItemId,
                        String warehouseCode,
                        String fromLocation,
                        String username) {

                return moveToWarehouse(
                                zohoItemId,
                                warehouseCode,
                                fromLocation,
                                username,
                                null);
        }

        public String moveToWarehouse(
                        String zohoItemId,
                        String warehouseCode,
                        String fromLocation,
                        String username,
                        Set<String> allowedPlants) {

                DispatchedItem item = dispatchedRepo
                                .findById(zohoItemId)
                                .orElseThrow(() -> new IllegalStateException(
                                                "Item not found"));

                assertDispatchItemPlantAccess(
                                item,
                                allowedPlants);

                if (item.getStatus() != ItemDispatchStatus.READY_TO_STORE) {

                        throw new IllegalStateException(
                                        "Only READY_TO_STORE items can be moved to warehouse");
                }

                String cleanWarehouse = cleanLocationCode(
                                warehouseCode);

                if (cleanWarehouse == null ||
                                cleanWarehouse.isBlank()) {

                        throw new RuntimeException(
                                        "Warehouse code required");
                }

                assertAllowedWarehouseCode(
                                cleanWarehouse);

                String cleanFromLocation = firstNonBlank(
                                fromLocation,
                                item.getCurrentLocationCode(),
                                item.getLocation(),
                                item.getPackedAreaCode());

                cleanFromLocation = cleanLocationCode(
                                cleanFromLocation);

                if (cleanFromLocation == null ||
                                cleanFromLocation.isBlank()) {

                        throw new RuntimeException(
                                        "From location required");
                }

                assertAllowedFromLocation(
                                cleanFromLocation);

                if (!FIXED_WAREHOUSE_CODES.contains(
                                cleanWarehouse) &&
                                item.getPlantCode() != null &&
                                !item.getPlantCode().isBlank() &&
                                !plantLocationService
                                                .isWarehouseAllowed(
                                                                item.getPlantCode(),
                                                                cleanWarehouse)) {

                        throw new RuntimeException(
                                        "Warehouse "
                                                        + cleanWarehouse
                                                        + " is not allowed for plant "
                                                        + item.getPlantCode());
                }

                String gatePass = generateGatePassNumber(
                                cleanWarehouse);

                item.setStatus(
                                ItemDispatchStatus.WAREHOUSE_REQUESTED);

                item.setFromLocation(
                                cleanFromLocation);

                item.setWarehouseCode(
                                cleanWarehouse);

                item.setGatePassNumber(
                                gatePass);

                item.setStoredAt(null);

                item.setCreatedBy(
                                username != null &&
                                                !username.isBlank()
                                                                ? username
                                                                : "SYSTEM");

                dispatchedRepo.save(item);

                auditLogService.log(
                                zohoItemId,
                                "Warehouse move requested | GP: "
                                                + gatePass,
                                username,
                                "DISPATCH");

                activityLogService.log(
                                zohoItemId,
                                "WAREHOUSE REQUESTED",
                                username,
                                "DISPATCH",
                                "READY_TO_STORE",
                                "WAREHOUSE_REQUESTED",
                                gatePass);

                return gatePass;
        }

        public String bulkMoveToWarehouse(
                        List<String> itemIds,
                        String warehouseCode,
                        String fromLocation,
                        String username) {

                return bulkMoveToWarehouse(
                                itemIds,
                                warehouseCode,
                                fromLocation,
                                username,
                                null);
        }

        public String bulkMoveToWarehouse(
                        List<String> itemIds,
                        String warehouseCode,
                        String fromLocation,
                        String username,
                        Set<String> allowedPlants) {

                if (itemIds == null ||
                                itemIds.isEmpty()) {

                        throw new RuntimeException(
                                        "No items selected");
                }

                LinkedHashSet<String> uniqueIds = itemIds.stream()
                                .filter(Objects::nonNull)
                                .map(String::trim)
                                .filter(id -> !id.isBlank())
                                .collect(
                                                Collectors.toCollection(
                                                                LinkedHashSet::new));

                if (uniqueIds.isEmpty()) {
                        throw new RuntimeException(
                                        "No items selected");
                }

                String cleanWarehouse = cleanLocationCode(
                                warehouseCode);

                if (cleanWarehouse == null ||
                                cleanWarehouse.isBlank()) {

                        throw new RuntimeException(
                                        "Warehouse code required");
                }

                assertAllowedWarehouseCode(
                                cleanWarehouse);

                String cleanFromLocation = cleanLocationCode(
                                fromLocation);

                if (cleanFromLocation == null ||
                                cleanFromLocation.isBlank()) {

                        throw new RuntimeException(
                                        "From location required");
                }

                assertAllowedFromLocation(
                                cleanFromLocation);

                List<DispatchedItem> items = dispatchedRepo.findAllById(
                                uniqueIds);

                if (items.size() != uniqueIds.size()) {

                        throw new RuntimeException(
                                        "One or more selected items were not found");
                }

                for (DispatchedItem item : items) {
                        assertDispatchItemPlantAccess(
                                        item,
                                        allowedPlants);

                        if (item.getStatus() != ItemDispatchStatus.READY_TO_STORE) {

                                throw new RuntimeException(
                                                "Invalid item state: "
                                                                + item.getZohoItemId());
                        }

                        if (!FIXED_WAREHOUSE_CODES.contains(
                                        cleanWarehouse) &&
                                        item.getPlantCode() != null &&
                                        !item.getPlantCode().isBlank() &&
                                        !plantLocationService
                                                        .isWarehouseAllowed(
                                                                        item.getPlantCode(),
                                                                        cleanWarehouse)) {

                                throw new RuntimeException(
                                                "Warehouse "
                                                                + cleanWarehouse
                                                                + " is not allowed for plant "
                                                                + item.getPlantCode());
                        }
                }

                String gatePass = generateGatePassNumber(
                                cleanWarehouse);

                for (DispatchedItem item : items) {
                        item.setStatus(
                                        ItemDispatchStatus.WAREHOUSE_REQUESTED);

                        item.setWarehouseCode(
                                        cleanWarehouse);

                        item.setGatePassNumber(
                                        gatePass);

                        item.setFromLocation(
                                        cleanFromLocation);

                        item.setStoredAt(null);

                        item.setCreatedBy(
                                        username != null &&
                                                        !username.isBlank()
                                                                        ? username
                                                                        : "SYSTEM");
                }

                dispatchedRepo.saveAll(items);

                for (DispatchedItem item : items) {
                        auditLogService.log(
                                        item.getZohoItemId(),
                                        "Warehouse move requested (bulk) | GP: "
                                                        + gatePass,
                                        username,
                                        "DISPATCH");

                        activityLogService.log(
                                        item.getZohoItemId(),
                                        "WAREHOUSE REQUESTED (BULK)",
                                        username,
                                        "DISPATCH",
                                        "READY_TO_STORE",
                                        "WAREHOUSE_REQUESTED",
                                        gatePass);
                }

                return gatePass;
        }

        public void approveWarehouseMove(
                        String zohoItemId,
                        String enteredGatePass,
                        String username) {

                approveWarehouseMove(
                                zohoItemId,
                                enteredGatePass,
                                username,
                                null,
                                "WAREHOUSE");
        }

        public void approveWarehouseMove(
                        String zohoItemId,
                        String enteredGatePass,
                        String username,
                        Set<String> allowedPlants,
                        String role) {

                DispatchedItem item = dispatchedRepo
                                .findById(zohoItemId)
                                .orElseThrow(() -> new IllegalStateException(
                                                "Item not found"));

                assertDispatchItemPlantAccess(
                                item,
                                allowedPlants);

                if (item.getStatus() != ItemDispatchStatus.WAREHOUSE_REQUESTED) {

                        throw new IllegalStateException(
                                        "Item not pending warehouse approval");
                }

                if (enteredGatePass == null ||
                                enteredGatePass.isBlank()) {

                        throw new IllegalStateException(
                                        "Gate pass required");
                }

                String savedGatePass = normalizeGatePass(
                                item.getGatePassNumber());

                String userGatePass = normalizeGatePass(
                                enteredGatePass);

                if (savedGatePass.isBlank() ||
                                !savedGatePass.equals(
                                                userGatePass)) {

                        throw new IllegalStateException(
                                        "Invalid Gate Pass");
                }

                String warehouseLocation = firstNonBlank(
                                item.getWarehouseCode(),
                                item.getCurrentLocationCode(),
                                item.getLocation(),
                                "WH");

                warehouseLocation = cleanLocationCode(
                                warehouseLocation);

                item.setStatus(
                                ItemDispatchStatus.IN_WAREHOUSE);

                item.setStoredAt(
                                LocalDateTime.now(
                                                APP_ZONE));

                item.setWarehouseCode(
                                warehouseLocation);

                item.setCurrentLocationCode(
                                warehouseLocation);

                item.setLocation(
                                warehouseLocation);

                dispatchedRepo.save(item);

                syncPacketItemLocation(
                                item,
                                warehouseLocation,
                                null);

                String safeRole = role != null &&
                                !role.isBlank()
                                                ? role
                                                : "WAREHOUSE";

                auditLogService.log(
                                zohoItemId,
                                "Warehouse approved | GP: "
                                                + item.getGatePassNumber(),
                                username,
                                safeRole);

                activityLogService.log(
                                zohoItemId,
                                "WAREHOUSE APPROVED",
                                username,
                                safeRole,
                                "WAREHOUSE_REQUESTED",
                                "IN_WAREHOUSE",
                                item.getGatePassNumber());
        }

        public void rejectWarehouseMove(
                        String zohoItemId,
                        String username) {

                rejectWarehouseMove(
                                zohoItemId,
                                username,
                                null,
                                "WAREHOUSE");
        }

        public void rejectWarehouseMove(
                        String zohoItemId,
                        String username,
                        Set<String> allowedPlants,
                        String role) {

                DispatchedItem item = dispatchedRepo
                                .findById(zohoItemId)
                                .orElseThrow(() -> new IllegalStateException(
                                                "Item not found"));

                assertDispatchItemPlantAccess(
                                item,
                                allowedPlants);

                if (item.getStatus() != ItemDispatchStatus.WAREHOUSE_REQUESTED) {

                        throw new IllegalStateException(
                                        "Item not pending warehouse approval");
                }

                String returnLocation = firstNonBlank(
                                item.getFromLocation(),
                                item.getCurrentLocationCode(),
                                item.getLocation(),
                                item.getPackedAreaCode());

                item.setStatus(
                                ItemDispatchStatus.READY_TO_STORE);

                item.setWarehouseCode(null);
                item.setGatePassNumber(null);
                item.setStoredAt(null);
                item.setFromLocation(null);

                if (returnLocation != null &&
                                !returnLocation.isBlank()) {

                        item.setCurrentLocationCode(
                                        returnLocation);

                        item.setLocation(
                                        returnLocation);
                }

                dispatchedRepo.save(item);

                syncPacketItemLocation(
                                item,
                                returnLocation,
                                item.getFgZoneCode());

                String safeRole = role != null &&
                                !role.isBlank()
                                                ? role
                                                : "WAREHOUSE";

                auditLogService.log(
                                zohoItemId,
                                "Warehouse move rejected",
                                username,
                                safeRole);

                activityLogService.log(
                                zohoItemId,
                                "WAREHOUSE REJECTED",
                                username,
                                safeRole,
                                "WAREHOUSE_REQUESTED",
                                "READY_TO_STORE",
                                null);
        }

        /*
         * ============================================================
         * CHALAAN DISPATCH
         * ============================================================
         */

        public void markDispatchedFromChalaan(
                        String zohoItemId,
                        String username) {

                DispatchedItem item = dispatchedRepo
                                .findById(zohoItemId)
                                .orElseThrow(() -> new IllegalStateException(
                                                "Item not found"));

                ItemDispatchStatus previousStatus = item.getStatus();

                if (previousStatus != ItemDispatchStatus.READY_TO_DISPATCH &&
                                previousStatus != ItemDispatchStatus.READY) {

                        throw new IllegalStateException(
                                        "Item must be READY or READY_TO_DISPATCH before challan dispatch");
                }

                if (previousStatus == ItemDispatchStatus.READY &&
                                !canProceedFromPacked(item)) {

                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Move item to FG before dispatch action");
                }

                LocalDateTime nowIst = LocalDateTime.now(
                                APP_ZONE);

                item.setStatus(
                                ItemDispatchStatus.DISPATCHED);

                item.setDispatchedBy(
                                username != null &&
                                                !username.isBlank()
                                                                ? username
                                                                : "SYSTEM");

                /*
                 * Preserve a custom dispatch timestamp already assigned
                 * during challan generation.
                 */
                if (item.getDispatchedAt() == null) {
                        item.setDispatchedAt(
                                        nowIst);
                }

                if (item.getTripStartedAt() == null) {
                        item.setTripStartedAt(
                                        item.getDispatchedAt());
                }

                item.setStock(0);

                dispatchedRepo.save(item);

                auditLogService.log(
                                zohoItemId,
                                "Dispatched via chalaan",
                                username,
                                "DISPATCH");

                activityLogService.log(
                                zohoItemId,
                                "DISPATCHED",
                                username,
                                "DISPATCH",
                                previousStatus == null
                                                ? null
                                                : previousStatus.name(),
                                "DISPATCHED",
                                null);
        }

        /**
         * Completes challan attachment for a row that was already DISPATCHED by
         * the verified XLSX reconciliation path (or a compatible legacy import).
         *
         * No status transition is performed here; the item stays DISPATCHED and
         * its existing imported dispatch timestamp/driver can be retained by the
         * caller when no replacement values were supplied.
         */
        public void finalizeChallanForPreviouslyDispatchedItem(
                        String zohoItemId,
                        String username) {

                DispatchedItem item = dispatchedRepo
                                .findById(zohoItemId)
                                .orElseThrow(() -> new IllegalStateException(
                                                "Item not found"));

                if (item.getStatus() != ItemDispatchStatus.DISPATCHED) {
                        throw new IllegalStateException(
                                        "Only an already DISPATCHED item can attach a later challan");
                }

                if (cleanNullable(item.getChalaanNumber()) == null) {
                        throw new IllegalStateException(
                                        "Challan number was not assigned before finalization");
                }

                LocalDateTime nowIst = LocalDateTime.now(APP_ZONE);

                if (item.getDispatchedAt() == null) {
                        item.setDispatchedAt(nowIst);
                }

                if (item.getTripStartedAt() == null) {
                        item.setTripStartedAt(item.getDispatchedAt());
                }

                item.setStock(0);
                item.setDispatchedBy(
                                cleanNullable(username) == null
                                                ? "SYSTEM"
                                                : username.trim());

                dispatchedRepo.save(item);

                auditLogService.log(
                                zohoItemId,
                                "Challan attached to previously dispatched item | Challan: "
                                                + item.getChalaanNumber(),
                                username,
                                "DISPATCH");

                activityLogService.log(
                                zohoItemId,
                                "CHALLAN ATTACHED",
                                username,
                                "DISPATCH",
                                ItemDispatchStatus.DISPATCHED.name(),
                                ItemDispatchStatus.DISPATCHED.name(),
                                item.getChalaanNumber());
        }

        /*
         * ============================================================
         * CREATE DISPATCH RECORD
         * ============================================================
         */

        public void createFromPacketItem(
                        PacketItem item) {

                if (item == null) {
                        throw new IllegalStateException(
                                        "PacketItem is null");
                }

                if (item.getId() == null) {
                        throw new IllegalStateException(
                                        "PacketItem ID is null");
                }

                if (item.getPacket() == null) {
                        throw new IllegalStateException(
                                        "PacketItem has no packet");
                }

                String id = item.getId().toString();

                if (dispatchedRepo.existsById(id)) {
                        return;
                }

                DispatchedItem dispatched = new DispatchedItem();

                dispatched.setZohoItemId(id);

                dispatched.setItemType(
                                item.getItemType() != null
                                                ? item.getItemType()
                                                : PacketItemType.NORMAL);

                dispatched.setLinkedPacketItemId(
                                item.getLinkedPacketItemId());

                dispatched.setLinkedMasterItemId(
                                item.getLinkedMasterItemId());

                dispatched.setName(
                                item.getItemName());

                dispatched.setPacketItemId(
                                item.getId());

                dispatched.setPacketId(
                                item.getPacket().getId());

                dispatched.setSku(
                                item.getSku());

                dispatched.setLocation(
                                item.getCurrentLocationCode());

                dispatched.setFloor(
                                item.getFloor());

                dispatched.setPlantCode(
                                item.getPlantCode());

                dispatched.setPackedAreaCode(
                                item.getPackedAreaCode());

                dispatched.setCurrentLocationCode(
                                item.getCurrentLocationCode());

                dispatched.setFgAreaCode(
                                item.getFgAreaCode());

                dispatched.setFgZoneCode(
                                item.getFgZoneCode());

                dispatched.setStock(1);

                dispatched.setStatus(
                                ItemDispatchStatus.READY);

                dispatched.setStickerNumber(
                                item.getStickerNumber());

                dispatched.setPackedAt(
                                item.getPackedAt());

                dispatched.setWarehouseCode(null);
                dispatched.setGatePassNumber(null);

                dispatched.setPdNo(
                                item.getPdNo());

                dispatched.setWeight(
                                item.getWeight());

                dispatched.setDimensions(
                                item.getDimensions());

                dispatched.setClientName(
                                item.getClientName());

                dispatched.setClientAddress(
                                item.getClientAddress());

                dispatched.setDrawingNo(
                                item.getDrawingNo());

                dispatched.setDescription(
                                item.getDescription());

                dispatched.setRemarks(
                                item.getRemarks());

                dispatchedRepo.save(
                                dispatched);
        }

        /*
         * ============================================================
         * WAREHOUSE RETURN
         * ============================================================
         */

        public void requestReturnToDispatch(
                        String zohoItemId,
                        String username) {

                DispatchedItem item = dispatchedRepo
                                .findById(zohoItemId)
                                .orElseThrow(() -> new IllegalStateException(
                                                "Item not found"));

                if (item.getStatus() != ItemDispatchStatus.IN_WAREHOUSE) {

                        throw new RuntimeException(
                                        "Only warehouse items can be returned");
                }

                item.setStatus(
                                ItemDispatchStatus.WAREHOUSE_RETURN_REQUESTED);

                dispatchedRepo.save(item);

                auditLogService.log(
                                zohoItemId,
                                "Warehouse return requested",
                                username,
                                "DISPATCH");

                activityLogService.log(
                                zohoItemId,
                                "WAREHOUSE RETURN REQUESTED",
                                username,
                                "DISPATCH",
                                "IN_WAREHOUSE",
                                "WAREHOUSE_RETURN_REQUESTED",
                                null);
        }

        public void approveReturnToDispatch(
                        String zohoItemId,
                        String admin) {

                DispatchedItem item = dispatchedRepo
                                .findById(zohoItemId)
                                .orElseThrow(() -> new IllegalStateException(
                                                "Item not found"));

                if (item.getStatus() != ItemDispatchStatus.WAREHOUSE_RETURN_REQUESTED) {

                        throw new RuntimeException(
                                        "No return request pending");
                }

                item.setStatus(
                                ItemDispatchStatus.READY);

                dispatchedRepo.save(item);

                auditLogService.log(
                                zohoItemId,
                                "Warehouse return approved",
                                admin,
                                "ADMIN");

                activityLogService.log(
                                zohoItemId,
                                "RETURN APPROVED",
                                admin,
                                "ADMIN",
                                "WAREHOUSE_RETURN_REQUESTED",
                                "READY",
                                null);
        }

        public void rejectReturnToDispatch(
                        String zohoItemId,
                        String admin) {

                DispatchedItem item = dispatchedRepo
                                .findById(zohoItemId)
                                .orElseThrow(() -> new IllegalStateException(
                                                "Item not found"));

                item.setStatus(
                                ItemDispatchStatus.IN_WAREHOUSE);

                dispatchedRepo.save(item);

                auditLogService.log(
                                zohoItemId,
                                "Warehouse return rejected",
                                admin,
                                "ADMIN");

                activityLogService.log(
                                zohoItemId,
                                "RETURN REJECTED",
                                admin,
                                "ADMIN",
                                "WAREHOUSE_RETURN_REQUESTED",
                                "IN_WAREHOUSE",
                                null);
        }

        /*
         * ============================================================
         * FG MOVEMENT
         * ============================================================
         */

        public void movePackedItemToFg(
                        String zohoItemId,
                        String fgZoneCode,
                        String username,
                        Set<String> allowedPlants) {

                DispatchedItem item = dispatchedRepo
                                .findById(zohoItemId)
                                .orElseThrow(() -> new IllegalStateException(
                                                "Item not found"));

                assertDispatchItemPlantAccess(
                                item,
                                allowedPlants);

                if (item.getStatus() != ItemDispatchStatus.READY) {

                        throw new RuntimeException(
                                        "Only packed items can be moved to FG");
                }

                if (item.getPlantCode() == null ||
                                item.getPlantCode().isBlank()) {

                        throw new RuntimeException(
                                        "Plant not assigned to this item");
                }

                String cleanFgZone = cleanNullable(
                                fgZoneCode);

                String fgLocation = plantLocationService
                                .buildFgLocation(
                                                item.getPlantCode(),
                                                cleanFgZone);

                String oldLocation = item.getCurrentLocationCode();

                item.setCurrentLocationCode(
                                fgLocation);

                item.setLocation(
                                fgLocation);

                item.setFgZoneCode(
                                cleanFgZone);

                dispatchedRepo.save(item);

                if (item.getPacketItemId() != null) {
                        packetItemRepo
                                        .findById(
                                                        item.getPacketItemId())
                                        .ifPresent(packetItem -> {
                                                packetItem.setCurrentLocationCode(
                                                                fgLocation);

                                                packetItem.setLocation(
                                                                fgLocation);

                                                packetItem.setFgZoneCode(
                                                                cleanFgZone);

                                                packetItemRepo.save(
                                                                packetItem);
                                        });
                }

                auditLogService.log(
                                zohoItemId,
                                "Moved packed item to FG: "
                                                + fgLocation,
                                username,
                                "DISPATCH");

                activityLogService.log(
                                zohoItemId,
                                "MOVED TO FG",
                                username,
                                "DISPATCH",
                                oldLocation,
                                fgLocation,
                                null);
        }

        /*
         * ============================================================
         * GATE PASS
         * ============================================================
         */

        public String createGatePassNumber(
                        String warehouseCode) {

                return generateGatePassNumber(
                                warehouseCode);
        }

        private String generateGatePassNumber(
                        String warehouseCode) {

                String warehouse = warehouseShortCode(
                                warehouseCode);

                String date = java.time.LocalDate
                                .now(APP_ZONE)
                                .format(
                                                java.time.format.DateTimeFormatter
                                                                .ofPattern(
                                                                                "MMdd"));

                for (int i = 0; i < 30; i++) {
                        String suffix = UUID.randomUUID()
                                        .toString()
                                        .replace("-", "")
                                        .substring(0, 5)
                                        .toUpperCase();

                        String gatePass = "GP-"
                                        + warehouse
                                        + "-"
                                        + date
                                        + "-"
                                        + suffix;

                        if (dispatchedRepo
                                        .findByGatePassNumber(
                                                        gatePass)
                                        .isEmpty()) {

                                return gatePass;
                        }
                }

                throw new RuntimeException(
                                "Could not generate unique gate pass number");
        }

        /*
         * ============================================================
         * ADMIN PLANT AND LOCATION ASSIGNMENT
         * ============================================================
         */

        public DispatchedItem assignPlantLocationToDispatchedItem(
                        String zohoItemId,
                        String plantCode,
                        String currentLocationCode,
                        String fgZoneCode,
                        String warehouseCode,
                        String username) {

                DispatchedItem item = dispatchedRepo
                                .findById(zohoItemId)
                                .orElseThrow(() -> new RuntimeException(
                                                "Item not found"));

                if (plantCode == null ||
                                plantCode.isBlank()) {

                        throw new RuntimeException(
                                        "Plant code required");
                }

                String cleanPlantCode = plantCode.trim();

                PlantLocationService.PlantConfig plant = plantLocationService
                                .getPlantConfig(
                                                cleanPlantCode);

                String finalLocation = cleanNullable(
                                currentLocationCode);

                String resolvedFgZoneCode = cleanNullable(
                                fgZoneCode);

                if (finalLocation == null) {

                        if (item.getStatus() == ItemDispatchStatus.READY) {

                                finalLocation = plant.packedAreaCode();
                        } else if (item.getStatus() == ItemDispatchStatus.READY_TO_STORE ||
                                        item.getStatus() == ItemDispatchStatus.READY_TO_DISPATCH) {

                                finalLocation = plantLocationService
                                                .buildFgLocation(
                                                                cleanPlantCode,
                                                                resolvedFgZoneCode);
                        } else if (item.getStatus() == ItemDispatchStatus.WAREHOUSE_REQUESTED ||
                                        item.getStatus() == ItemDispatchStatus.IN_WAREHOUSE ||
                                        item.getStatus() == ItemDispatchStatus.WAREHOUSE_RETURN_REQUESTED) {

                                finalLocation = firstNonBlank(
                                                warehouseCode,
                                                item.getWarehouseCode());
                        }
                }

                if (finalLocation == null ||
                                finalLocation.isBlank()) {

                        finalLocation = plant.packedAreaCode();
                }

                final String resolvedLocation = finalLocation.trim();

                final String finalFgZoneCode = resolvedFgZoneCode;

                item.setPlantCode(
                                cleanPlantCode);

                item.setPackedAreaCode(
                                plant.packedAreaCode());

                item.setFgAreaCode(
                                plant.fgAreaCode());

                item.setFgZoneCode(
                                finalFgZoneCode);

                item.setCurrentLocationCode(
                                resolvedLocation);

                item.setLocation(
                                resolvedLocation);

                String cleanWarehouse = cleanNullable(
                                warehouseCode);

                if (cleanWarehouse != null) {
                        item.setWarehouseCode(
                                        cleanWarehouse);
                }

                dispatchedRepo.save(item);

                if (item.getPacketItemId() != null) {
                        packetItemRepo
                                        .findById(
                                                        item.getPacketItemId())
                                        .ifPresent(packetItem -> {
                                                packetItem.setPlantCode(
                                                                cleanPlantCode);

                                                packetItem.setPackedAreaCode(
                                                                plant.packedAreaCode());

                                                packetItem.setFgAreaCode(
                                                                plant.fgAreaCode());

                                                packetItem.setFgZoneCode(
                                                                finalFgZoneCode);

                                                packetItem.setCurrentLocationCode(
                                                                resolvedLocation);

                                                packetItem.setLocation(
                                                                resolvedLocation);

                                                if (cleanWarehouse != null) {
                                                        packetItem.setWarehouseCode(
                                                                        cleanWarehouse);
                                                }

                                                packetItemRepo.save(
                                                                packetItem);
                                        });
                }

                auditLogService.log(
                                zohoItemId,
                                "Plant/location assigned: "
                                                + cleanPlantCode
                                                + " / "
                                                + resolvedLocation,
                                username,
                                "ADMIN");

                activityLogService.log(
                                zohoItemId,
                                "PLANT LOCATION ASSIGNED",
                                username,
                                "ADMIN",
                                null,
                                resolvedLocation,
                                null);

                return item;
        }

        /*
         * ============================================================
         * ADMIN MULTI-ITEM EDIT
         * ============================================================
         */

        public AdminBulkDispatchEditResponse adminBulkEdit(
                        AdminBulkDispatchEditRequest request,
                        String adminUsername) {

                if (request == null) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Admin edit request is required");
                }

                Set<AdminDispatchEditField> fields = request.fields();

                if (fields == null || fields.isEmpty()) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Select at least one field to update");
                }

                LinkedHashSet<String> requestedIds = request.itemIds() == null
                                ? new LinkedHashSet<>()
                                : request.itemIds()
                                                .stream()
                                                .filter(Objects::nonNull)
                                                .map(String::trim)
                                                .filter(value -> !value.isBlank())
                                                .collect(
                                                                Collectors.toCollection(
                                                                                LinkedHashSet::new));

                if (requestedIds.isEmpty()) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "No valid dispatch items selected");
                }

                if (requestedIds.size() > 500) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "A maximum of 500 items can be edited at once");
                }

                if (fields.contains(
                                AdminDispatchEditField.ITEM_NAME)
                                && cleanNullable(
                                                request.itemName()) == null) {

                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Item name cannot be empty");
                }

                boolean updateDriver = fields.contains(
                                AdminDispatchEditField.DRIVER);

                boolean updateVehicle = fields.contains(
                                AdminDispatchEditField.VEHICLE);

                boolean updateDispatchDateTime = fields.contains(
                                AdminDispatchEditField.DISPATCH_DATE_TIME);

                boolean updatePacketNumber = fields.contains(
                                AdminDispatchEditField.PACKET_NUMBER);

                if (updatePacketNumber) {
                        if (requestedIds.size() != 1) {
                                throw new ResponseStatusException(
                                                HttpStatus.BAD_REQUEST,
                                                "Packet No. can be changed for one dispatch item at a time");
                        }

                        /*
                         * Validate before any entity is modified.
                         */
                        parseAdminPacketNumber(
                                        request.packetNumber());
                }

                if (updateDispatchDateTime
                                && request.dispatchDateTime() == null) {

                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Dispatch date and time is required");
                }

                List<DispatchedItem> selectedItems = dispatchedRepo
                                .findAllById(
                                                requestedIds);

                Set<String> foundIds = selectedItems.stream()
                                .map(
                                                DispatchedItem::getZohoItemId)
                                .filter(
                                                Objects::nonNull)
                                .collect(
                                                Collectors.toSet());

                List<String> missingIds = requestedIds.stream()
                                .filter(id -> !foundIds.contains(id))
                                .toList();

                if (!missingIds.isEmpty()) {
                        throw new ResponseStatusException(
                                        HttpStatus.NOT_FOUND,
                                        "Dispatch items not found: "
                                                        + String.join(
                                                                        ", ",
                                                                        missingIds.stream()
                                                                                        .limit(10)
                                                                                        .toList()));
                }

                /*
                 * The map prevents duplicate saves when multiple selected rows
                 * belong to the same challan. It also ensures that every sibling
                 * row changed by a challan-level field is returned to the frontend.
                 */
                Map<String, DispatchedItem> affectedItems = new LinkedHashMap<>();

                for (DispatchedItem item : selectedItems) {
                        affectedItems.put(
                                        item.getZohoItemId(),
                                        item);
                }

                /*
                 * Item/sticker fields apply only to rows explicitly selected
                 * by the Admin. Dispatch date/time, driver and vehicle are handled
                 * later as challan-level values.
                 */
                applyAdminSelectedItemFields(
                                selectedItems,
                                request,
                                fields);

                List<PacketItem> synchronizedPacketItems = synchronizeAdminPacketItemFields(
                                selectedItems,
                                request,
                                fields);

                /*
                 * StickerHistory stores the actual PDF bytes that were printed.
                 * Updating PacketItem alone therefore cannot update historical PDF
                 * downloads. Rebuild those byte snapshots inside this same Admin edit
                 * transaction whenever a sticker-facing field changes.
                 */
                if (containsStickerPdfContentField(fields)
                                && !synchronizedPacketItems.isEmpty()) {
                        stickerHistoryPdfRefreshService.refreshAllForPacketItems(
                                        synchronizedPacketItems);
                }

                Driver selectedDriver = resolveAdminDriver(
                                request,
                                updateDriver);

                Vehicle selectedVehicle = resolveAdminVehicle(
                                request,
                                updateVehicle);

                boolean updateChallanLevelFields = updateDriver
                                || updateVehicle
                                || updateDispatchDateTime;

                int updatedChallanCount = 0;

                if (updateChallanLevelFields) {
                        Set<String> chalaanNumbers = selectedItems.stream()
                                        .map(
                                                        DispatchedItem::getChalaanNumber)
                                        .filter(
                                                        Objects::nonNull)
                                        .map(
                                                        String::trim)
                                        .filter(value -> !value.isBlank())
                                        .collect(
                                                        Collectors.toCollection(
                                                                        LinkedHashSet::new));

                        if (!chalaanNumbers.isEmpty()) {
                                List<DispatchedItem> chalaanItems = dispatchedRepo
                                                .findAllByChalaanNumberIn(
                                                                chalaanNumbers);

                                /*
                                 * A selected challan must resolve back to at least one row.
                                 * This also protects against a misspelled repository property
                                 * or dirty challan values silently producing partial updates.
                                 */
                                Set<String> resolvedChalaanNumbers = chalaanItems.stream()
                                                .map(
                                                                DispatchedItem::getChalaanNumber)
                                                .filter(
                                                                Objects::nonNull)
                                                .map(
                                                                String::trim)
                                                .filter(value -> !value.isBlank())
                                                .collect(
                                                                Collectors.toCollection(
                                                                                LinkedHashSet::new));

                                Set<String> unresolvedChalaanNumbers = new LinkedHashSet<>(
                                                chalaanNumbers);

                                unresolvedChalaanNumbers.removeAll(
                                                resolvedChalaanNumbers);

                                if (!unresolvedChalaanNumbers.isEmpty()) {
                                        throw new ResponseStatusException(
                                                        HttpStatus.CONFLICT,
                                                        "Could not resolve every selected challan: "
                                                                        + String.join(
                                                                                        ", ",
                                                                                        unresolvedChalaanNumbers));
                                }

                                applyAdminChallanLevelFields(
                                                chalaanItems,
                                                request,
                                                fields,
                                                selectedDriver,
                                                selectedVehicle);

                                for (DispatchedItem item : chalaanItems) {
                                        affectedItems.put(
                                                        item.getZohoItemId(),
                                                        item);
                                }

                                updatedChallanCount = resolvedChalaanNumbers.size();
                        }

                        /*
                         * Legacy rows without a challan number have no sibling group.
                         * Only those explicitly selected legacy rows are updated.
                         */
                        List<DispatchedItem> legacyItems = selectedItems.stream()
                                        .filter(item -> item.getChalaanNumber() == null
                                                        || item.getChalaanNumber().isBlank())
                                        .toList();

                        applyAdminChallanLevelFields(
                                        legacyItems,
                                        request,
                                        fields,
                                        selectedDriver,
                                        selectedVehicle);

                        for (DispatchedItem item : legacyItems) {
                                affectedItems.put(
                                                item.getZohoItemId(),
                                                item);
                        }
                }

                List<DispatchedItem> savedItems = dispatchedRepo.saveAll(
                                affectedItems.values());

                String cleanAdmin = cleanNullable(
                                adminUsername);

                if (cleanAdmin == null) {
                        cleanAdmin = "SYSTEM";
                }

                Set<AdminDispatchEditField> selectedItemFields = fields.stream()
                                .filter(field -> !isAdminChallanLevelField(field))
                                .collect(
                                                Collectors.toCollection(
                                                                LinkedHashSet::new));

                Set<AdminDispatchEditField> challanLevelFields = fields.stream()
                                .filter(this::isAdminChallanLevelField)
                                .collect(
                                                Collectors.toCollection(
                                                                LinkedHashSet::new));

                for (DispatchedItem item : savedItems) {
                        String status = item.getStatus() == null
                                        ? ""
                                        : item.getStatus().name();

                        Set<AdminDispatchEditField> rowFields = new LinkedHashSet<>();

                        if (requestedIds.contains(
                                        item.getZohoItemId())) {
                                rowFields.addAll(
                                                selectedItemFields);
                        }

                        rowFields.addAll(
                                        challanLevelFields);

                        String editedFields = rowFields.stream()
                                        .map(
                                                        AdminDispatchEditField::name)
                                        .sorted()
                                        .collect(
                                                        Collectors.joining(
                                                                        ", "));

                        if (editedFields.isBlank()) {
                                continue;
                        }

                        auditLogService.log(
                                        item.getZohoItemId(),
                                        "ADMIN DETAILS EDITED: " + editedFields,
                                        cleanAdmin,
                                        "ADMIN");

                        activityLogService.log(
                                        item.getZohoItemId(),
                                        "ADMIN DETAILS EDITED",
                                        cleanAdmin,
                                        "ADMIN",
                                        status,
                                        status,
                                        item.getGatePassNumber());
                }

                LocalDateTime responseTime = LocalDateTime.now(
                                APP_ZONE);

                List<AdminUpdatedDispatchRow> updatedRows = savedItems.stream()
                                .map(item -> toAdminUpdatedDispatchRow(
                                                item,
                                                responseTime))
                                .toList();

                return new AdminBulkDispatchEditResponse(
                                requestedIds.size(),
                                savedItems.size(),
                                updatedChallanCount,
                                updatedRows);
        }

        private boolean isAdminChallanLevelField(
                        AdminDispatchEditField field) {

                return field == AdminDispatchEditField.DRIVER
                                || field == AdminDispatchEditField.VEHICLE
                                || field == AdminDispatchEditField.DISPATCH_DATE_TIME;
        }

        private void applyAdminSelectedItemFields(
                        Collection<DispatchedItem> items,
                        AdminBulkDispatchEditRequest request,
                        Set<AdminDispatchEditField> fields) {

                for (DispatchedItem item : items) {

                        if (fields.contains(
                                        AdminDispatchEditField.ITEM_NAME)) {

                                item.setName(
                                                cleanNullable(
                                                                request.itemName()));
                        }

                        if (fields.contains(
                                        AdminDispatchEditField.PD_NO)) {

                                item.setPdNo(
                                                cleanNullable(
                                                                request.pdNo()));
                        }

                        if (fields.contains(
                                        AdminDispatchEditField.DRAWING_NO)) {

                                item.setDrawingNo(
                                                cleanNullable(
                                                                request.drawingNo()));
                        }

                        if (fields.contains(
                                        AdminDispatchEditField.PACKET_NUMBER)) {

                                int packetNo = parseAdminPacketNumber(
                                                request.packetNumber());

                                /*
                                 * DispatchedItem has no separate packet-number column.
                                 * Keep packet identity synchronized through its SKU.
                                 * Linked PacketItems are synchronized canonically below.
                                 */
                                item.setSku(
                                                rebuildAdminDispatchSku(
                                                                item.getSku(),
                                                                item.getPdNo(),
                                                                item.getDrawingNo(),
                                                                packetNo,
                                                                item.getItemType()));
                        }

                        if (fields.contains(
                                        AdminDispatchEditField.CLIENT_NAME)) {

                                item.setClientName(
                                                cleanNullable(
                                                                request.clientName()));
                        }

                        if (fields.contains(
                                        AdminDispatchEditField.CLIENT_ADDRESS)) {

                                item.setClientAddress(
                                                cleanNullable(
                                                                request.clientAddress()));
                        }

                        if (fields.contains(
                                        AdminDispatchEditField.FLOOR)) {

                                item.setFloor(
                                                cleanNullable(
                                                                request.floor()));
                        }

                        if (fields.contains(
                                        AdminDispatchEditField.DESCRIPTION)) {

                                item.setDescription(
                                                cleanNullable(
                                                                request.description()));
                        }

                        if (fields.contains(
                                        AdminDispatchEditField.WEIGHT)) {

                                item.setWeight(
                                                cleanNullable(
                                                                request.weight()));
                        }

                        if (fields.contains(
                                        AdminDispatchEditField.DIMENSIONS)) {

                                item.setDimensions(
                                                cleanNullable(
                                                                request.dimensions()));
                        }

                        if (fields.contains(
                                        AdminDispatchEditField.REMARKS)) {

                                item.setRemarks(
                                                cleanNullable(
                                                                request.remarks()));
                        }

                        if (fields.contains(
                                        AdminDispatchEditField.STICKER_LOCATION)) {

                                /*
                                 * location is the sticker/display location.
                                 * currentLocationCode remains the actual operational
                                 * movement location.
                                 */
                                item.setLocation(
                                                cleanNullable(
                                                                request.stickerLocation()));
                        }
                }
        }

        private List<PacketItem> synchronizeAdminPacketItemFields(
                        Collection<DispatchedItem> selectedItems,
                        AdminBulkDispatchEditRequest request,
                        Set<AdminDispatchEditField> fields) {

                Set<UUID> packetItemIds = selectedItems.stream()
                                .map(
                                                DispatchedItem::getPacketItemId)
                                .filter(
                                                Objects::nonNull)
                                .collect(
                                                Collectors.toCollection(
                                                                LinkedHashSet::new));

                if (packetItemIds.isEmpty()) {
                        return List.of();
                }

                Map<UUID, PacketItem> packetItemMap = new LinkedHashMap<>();

                packetItemRepo
                                .findAllById(
                                                packetItemIds)
                                .forEach(packetItem -> packetItemMap.put(
                                                packetItem.getId(),
                                                packetItem));

                for (DispatchedItem dispatchedItem : selectedItems) {

                        UUID packetItemId = dispatchedItem
                                        .getPacketItemId();

                        if (packetItemId == null) {
                                continue;
                        }

                        PacketItem packetItem = packetItemMap.get(
                                        packetItemId);

                        /*
                         * Legacy dispatch rows can remain editable even where
                         * their original PacketItem no longer exists.
                         */
                        if (packetItem == null) {
                                continue;
                        }

                        if (fields.contains(
                                        AdminDispatchEditField.ITEM_NAME)) {

                                packetItem.setItemName(
                                                cleanNullable(
                                                                request.itemName()));
                        }

                        if (fields.contains(
                                        AdminDispatchEditField.PD_NO)) {

                                packetItem.setPdNo(
                                                cleanNullable(
                                                                request.pdNo()));
                        }

                        if (fields.contains(
                                        AdminDispatchEditField.DRAWING_NO)) {

                                packetItem.setDrawingNo(
                                                cleanNullable(
                                                                request.drawingNo()));
                        }

                        if (fields.contains(
                                        AdminDispatchEditField.PACKET_NUMBER)) {

                                int packetNo = parseAdminPacketNumber(
                                                request.packetNumber());

                                String newPacketNumber = "Pkt-" + packetNo;

                                if (packetItem.getMasterItem() != null
                                                && packetItem.getMasterItem().getId() != null
                                                && (packetItem.getPacketNumber() == null
                                                                || !newPacketNumber.equalsIgnoreCase(
                                                                                packetItem.getPacketNumber()))
                                                && packetItemRepo.existsByMasterItemIdAndPacketNumber(
                                                                packetItem.getMasterItem().getId(),
                                                                newPacketNumber)) {

                                        throw new ResponseStatusException(
                                                        HttpStatus.BAD_REQUEST,
                                                        "Packet number already exists in this master item: "
                                                                        + newPacketNumber);
                                }

                                packetItem.setPacketNumber(
                                                newPacketNumber);

                                packetItem.setSku(
                                                buildAdminPacketItemSku(
                                                                packetItem.getPdNo(),
                                                                packetItem.getDrawingNo(),
                                                                packetNo,
                                                                packetItem.getItemType(),
                                                                packetItem.getSku()));

                                /*
                                 * Keep the Dispatch register in exact sync with the linked
                                 * PacketItem after rebuilding packet number + SKU.
                                 */
                                dispatchedItem.setSku(
                                                packetItem.getSku());
                        }

                        if (fields.contains(
                                        AdminDispatchEditField.CLIENT_NAME)) {

                                packetItem.setClientName(
                                                cleanNullable(
                                                                request.clientName()));
                        }

                        if (fields.contains(
                                        AdminDispatchEditField.CLIENT_ADDRESS)) {

                                packetItem.setClientAddress(
                                                cleanNullable(
                                                                request.clientAddress()));
                        }

                        if (fields.contains(
                                        AdminDispatchEditField.FLOOR)) {

                                packetItem.setFloor(
                                                cleanNullable(
                                                                request.floor()));
                        }

                        if (fields.contains(
                                        AdminDispatchEditField.DESCRIPTION)) {

                                packetItem.setDescription(
                                                cleanNullable(
                                                                request.description()));
                        }

                        if (fields.contains(
                                        AdminDispatchEditField.WEIGHT)) {

                                packetItem.setWeight(
                                                cleanNullable(
                                                                request.weight()));
                        }

                        if (fields.contains(
                                        AdminDispatchEditField.DIMENSIONS)) {

                                packetItem.setDimensions(
                                                cleanNullable(
                                                                request.dimensions()));
                        }

                        if (fields.contains(
                                        AdminDispatchEditField.REMARKS)) {

                                packetItem.setRemarks(
                                                cleanNullable(
                                                                request.remarks()));
                        }

                        if (fields.contains(
                                        AdminDispatchEditField.STICKER_LOCATION)) {

                                packetItem.setLocation(
                                                cleanNullable(
                                                                request.stickerLocation()));
                        }
                }

                return packetItemRepo.saveAll(
                                packetItemMap.values());
        }

        private boolean containsStickerPdfContentField(
                        Set<AdminDispatchEditField> fields) {

                if (fields == null || fields.isEmpty()) {
                        return false;
                }

                return fields.stream()
                                .anyMatch(STICKER_PDF_CONTENT_FIELDS::contains);
        }

        private Driver resolveAdminDriver(
                        AdminBulkDispatchEditRequest request,
                        boolean updateDriver) {

                if (!updateDriver ||
                                request.driverId() == null) {

                        return null;
                }

                return driverRepository
                                .findById(
                                                request.driverId())
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.BAD_REQUEST,
                                                "Selected driver was not found"));
        }

        private Vehicle resolveAdminVehicle(
                        AdminBulkDispatchEditRequest request,
                        boolean updateVehicle) {

                if (!updateVehicle ||
                                request.vehicleId() == null) {

                        return null;
                }

                return vehicleRepository
                                .findById(
                                                request.vehicleId())
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.BAD_REQUEST,
                                                "Selected vehicle was not found"));
        }

        private void applyAdminChallanLevelFields(
                        Collection<DispatchedItem> items,
                        AdminBulkDispatchEditRequest request,
                        Set<AdminDispatchEditField> fields,
                        Driver selectedDriver,
                        Vehicle selectedVehicle) {

                if (items == null || items.isEmpty()) {
                        return;
                }

                String manualDriverName = cleanDriverName(
                                request.driverName());

                String manualVehicleNumber = cleanVehicleNumber(
                                request.vehicleNumber());

                boolean updateDispatchDateTime = fields.contains(
                                AdminDispatchEditField.DISPATCH_DATE_TIME);

                LocalDateTime newDispatchDateTime = updateDispatchDateTime
                                ? request.dispatchDateTime()
                                : null;

                if (updateDispatchDateTime
                                && newDispatchDateTime == null) {

                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Dispatch date and time is required");
                }

                /*
                 * Validate the complete affected group before changing any row.
                 * Because this service is transactional, any failure rolls back
                 * item-level and PacketItem changes made earlier in the request.
                 */
                if (updateDispatchDateTime) {
                        for (DispatchedItem item : items) {
                                if (!canEditDispatchDateTime(item)) {
                                        throw new ResponseStatusException(
                                                        HttpStatus.BAD_REQUEST,
                                                        "Dispatch date/time can only be edited for an item with dispatch history: "
                                                                        + item.getZohoItemId());
                                }

                                if (item.getTripEndedAt() != null
                                                && newDispatchDateTime.isAfter(
                                                                item.getTripEndedAt())) {

                                        throw new ResponseStatusException(
                                                        HttpStatus.BAD_REQUEST,
                                                        "Dispatch date/time cannot be after trip end time for challan: "
                                                                        + safe(
                                                                                        item.getChalaanNumber()));
                                }

                                if (item.getDeliveredAt() != null
                                                && newDispatchDateTime.isAfter(
                                                                item.getDeliveredAt())) {

                                        throw new ResponseStatusException(
                                                        HttpStatus.BAD_REQUEST,
                                                        "Dispatch date/time cannot be after delivery time for challan: "
                                                                        + safe(
                                                                                        item.getChalaanNumber()));
                                }
                        }
                }

                for (DispatchedItem item : items) {
                        if (fields.contains(
                                        AdminDispatchEditField.DRIVER)) {

                                if (selectedDriver != null) {
                                        item.setDriverId(
                                                        selectedDriver.getId());

                                        item.setDriverName(
                                                        cleanDriverName(
                                                                        selectedDriver.getName()));
                                } else {
                                        item.setDriverId(null);
                                        item.setDriverName(
                                                        manualDriverName);
                                }
                        }

                        if (fields.contains(
                                        AdminDispatchEditField.VEHICLE)) {

                                if (selectedVehicle != null) {
                                        item.setVehicleId(
                                                        selectedVehicle.getId());

                                        item.setVehicleNumber(
                                                        cleanVehicleNumber(
                                                                        selectedVehicle.getVehicleNumber()));
                                } else {
                                        item.setVehicleId(null);
                                        item.setVehicleNumber(
                                                        manualVehicleNumber);
                                }
                        }

                        if (updateDispatchDateTime) {
                                /*
                                 * Preserve the application invariant established during
                                 * challan generation. Every row in the same challan gets
                                 * the exact same values.
                                 */
                                item.setDispatchedAt(
                                                newDispatchDateTime);

                                item.setTripStartedAt(
                                                newDispatchDateTime);

                                /*
                                 * tripEndedAt and deliveredAt deliberately remain unchanged.
                                 */
                        }
                }
        }

        private boolean canEditDispatchDateTime(
                        DispatchedItem item) {

                if (item == null) {
                        return false;
                }

                if (item.getDispatchedAt() != null
                                || item.getTripStartedAt() != null) {
                        return true;
                }

                ItemDispatchStatus status = item.getStatus();

                return status == ItemDispatchStatus.DISPATCHED
                                || status == ItemDispatchStatus.OUT_FOR_DELIVERY
                                || status == ItemDispatchStatus.DELIVERED
                                || status == ItemDispatchStatus.RESTORED;
        }

        private AdminUpdatedDispatchRow toAdminUpdatedDispatchRow(
                        DispatchedItem item,
                        LocalDateTime updatedAt) {

                return new AdminUpdatedDispatchRow(
                                item.getZohoItemId(),
                                item.getName(),
                                item.getName(),
                                item.getPdNo(),
                                item.getDrawingNo(),
                                item.getClientName(),
                                item.getClientAddress(),
                                item.getFloor(),
                                item.getDescription(),
                                item.getWeight(),
                                item.getDimensions(),
                                item.getRemarks(),
                                item.getLocation(),
                                item.getCurrentLocationCode(),

                                item.getDriverId(),
                                item.getDriverName(),

                                item.getVehicleId(),
                                item.getVehicleNumber(),

                                item.getHelperLoaderCount(),

                                item.getChalaanNumber(),
                                item.getStatus() == null
                                                ? ""
                                                : item.getStatus().name(),

                                item.getDispatchedAt(),
                                item.getTripStartedAt(),
                                item.getTripEndedAt(),
                                item.getDeliveredAt(),

                                updatedAt);
        }

        /*
         * ============================================================
         * INTERNAL HELPERS
         * ============================================================
         */

        private int parseAdminPacketNumber(
                        String value) {

                String clean = cleanNullable(
                                value);

                if (clean == null) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Packet No. is required");
                }

                clean = clean
                                .replaceFirst(
                                                "(?i)^Pkt[-\\s]*",
                                                "")
                                .trim();

                if (!clean.matches("\\d+")) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Packet No. must be a positive whole number");
                }

                final int packetNo;

                try {
                        packetNo = Integer.parseInt(
                                        clean);
                } catch (NumberFormatException exception) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Packet No. is too large");
                }

                if (packetNo <= 0) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Packet No. must be greater than zero");
                }

                return packetNo;
        }

        private String rebuildAdminDispatchSku(
                        String existingSku,
                        String pdNo,
                        String drawingNo,
                        int packetNo,
                        PacketItemType itemType) {

                String existing = cleanNullable(
                                existingSku);

                /*
                 * Preserve existing imported/legacy SKU prefixes when a Pkt-N
                 * suffix already exists.
                 */
                if (existing != null
                                && existing.matches("(?i).*Pkt-\\d+.*")) {

                        return existing.replaceFirst(
                                        "(?i)Pkt-\\d+",
                                        "Pkt-" + packetNo);
                }

                /*
                 * Standalone Warehouse-import/legacy row:
                 * preserve its existing SKU/code exactly and append only packet identity.
                 * Linked PacketItems are rebuilt canonically by buildAdminPacketItemSku().
                 */
                if (existing != null) {
                        return existing
                                        + "/Pkt-"
                                        + packetNo;
                }

                boolean hardware = itemType == PacketItemType.HARDWARE;

                String cleanPdNo = cleanSkuPart(
                                pdNo);

                String cleanDrawingNo = cleanSkuPart(
                                drawingNo)
                                .replace(
                                                "/",
                                                "-");

                if (!"-".equals(cleanPdNo)
                                || !"-".equals(cleanDrawingNo)) {

                        return hardware
                                        ? cleanPdNo
                                                        + "/"
                                                        + cleanDrawingNo
                                                        + "/HW/Pkt-"
                                                        + packetNo
                                        : cleanPdNo
                                                        + "/"
                                                        + cleanDrawingNo
                                                        + "/Pkt-"
                                                        + packetNo;
                }

                return "Pkt-" + packetNo;
        }

        private String buildAdminPacketItemSku(
                        String pdNo,
                        String drawingNo,
                        int packetNo,
                        PacketItemType itemType,
                        String existingSku) {

                boolean hardware = itemType == PacketItemType.HARDWARE
                                || (existingSku != null
                                                && existingSku.toUpperCase()
                                                                .contains("/HW/"));

                String cleanPdNo = cleanSkuPart(
                                pdNo);

                String cleanDrawingNo = cleanSkuPart(
                                drawingNo)
                                .replace(
                                                "/",
                                                "-");

                return hardware
                                ? cleanPdNo
                                                + "/"
                                                + cleanDrawingNo
                                                + "/HW/Pkt-"
                                                + packetNo
                                : cleanPdNo
                                                + "/"
                                                + cleanDrawingNo
                                                + "/Pkt-"
                                                + packetNo;
        }

        private String cleanSkuPart(
                        String value) {

                String clean = cleanNullable(
                                value);

                return clean == null
                                ? "-"
                                : clean.replaceAll(
                                                "\\s+",
                                                " ");
        }

        private String safe(
                        Object value) {

                if (value == null) {
                        return "-";
                }

                String clean = value.toString()
                                .trim();

                return clean.isBlank()
                                ? "-"
                                : clean;
        }

        private String cleanNullable(
                        String value) {

                if (value == null) {
                        return null;
                }

                String clean = value.trim();

                return clean.isBlank()
                                ? null
                                : clean;
        }

        private String cleanDriverName(
                        String value) {

                if (value == null) {
                        return null;
                }

                String clean = value.trim()
                                .replaceAll(
                                                "\\s+",
                                                " ");

                return clean.isBlank()
                                ? null
                                : clean;
        }

        private String cleanVehicleNumber(
                        String value) {

                if (value == null) {
                        return null;
                }

                String clean = value.trim()
                                .toUpperCase()
                                .replaceAll(
                                                "\\s+",
                                                "");

                return clean.isBlank()
                                ? null
                                : clean;
        }

        private String cleanLocationCode(
                        String value) {

                if (value == null) {
                        return null;
                }

                String text = value.trim()
                                .toUpperCase()
                                .replaceAll(
                                                "\\s+",
                                                "");

                if (text.isBlank() ||
                                "NULL".equals(text) ||
                                "UNDEFINED".equals(text) ||
                                "-".equals(text)) {

                        return null;
                }

                return text;
        }

        private void assertAllowedWarehouseCode(
                        String warehouseCode) {

                if (!FIXED_WAREHOUSE_CODES.contains(
                                warehouseCode)) {

                        throw new RuntimeException(
                                        "Invalid warehouse code: "
                                                        + warehouseCode);
                }
        }

        private void assertAllowedFromLocation(
                        String fromLocation) {

                if (!FIXED_FROM_LOCATION_CODES.contains(
                                fromLocation)) {

                        throw new RuntimeException(
                                        "Invalid from location: "
                                                        + fromLocation);
                }
        }

        private String warehouseShortCode(
                        String warehouseCode) {

                String clean = cleanLocationCode(
                                warehouseCode);

                if (clean == null ||
                                clean.isBlank()) {

                        return "WH";
                }

                return switch (clean) {
                        case "BLS-WH-1" -> "BLS1";
                        case "RTP-WH-2" -> "RTP2";
                        case "AL-P1" -> "ALP1";
                        case "AL-P2" -> "ALP2";
                        case "AL-P3" -> "ALP3";
                        case "AL-P4" -> "ALP4";
                        default ->
                                clean.replaceAll(
                                                "[^A-Z0-9]",
                                                "");
                };
        }

        private String normalizeGatePass(
                        String value) {

                if (value == null) {
                        return "";
                }

                return value
                                .trim()
                                .toUpperCase()
                                .replace("–", "-")
                                .replace("—", "-")
                                .replaceAll(
                                                "\\s+",
                                                "")
                                .replaceAll(
                                                "[^A-Z0-9-]",
                                                "");
        }

        private String firstNonBlank(
                        String... values) {

                if (values == null) {
                        return "";
                }

                for (String value : values) {
                        if (value != null &&
                                        !value.trim().isBlank()) {

                                return value.trim();
                        }
                }

                return "";
        }

        private void syncPacketItemLocation(
                        DispatchedItem item,
                        String location,
                        String fgZoneCode) {

                if (item == null ||
                                item.getPacketItemId() == null) {

                        return;
                }

                packetItemRepo
                                .findById(
                                                item.getPacketItemId())
                                .ifPresent(packetItem -> {
                                        if (location != null &&
                                                        !location.isBlank()) {

                                                packetItem.setCurrentLocationCode(
                                                                location);

                                                packetItem.setLocation(
                                                                location);
                                        }

                                        packetItem.setWarehouseCode(
                                                        item.getWarehouseCode());

                                        packetItem.setFgZoneCode(
                                                        fgZoneCode);

                                        packetItemRepo.save(
                                                        packetItem);
                                });
        }
}