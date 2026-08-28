package com.alsorg.packing.service;

import com.alsorg.packing.controller.dto.challan.CustomChallanItemRequest;
import com.alsorg.packing.controller.dto.challan.CustomChallanRequest;
import com.alsorg.packing.controller.dto.challan.CustomChallanSummaryResponse;
import com.alsorg.packing.controller.dto.logistics.DispatchTripPdfResult;
import com.alsorg.packing.domain.dispatch.CustomChallan;
import com.alsorg.packing.domain.dispatch.CustomChallanItem;
import com.alsorg.packing.repository.CustomChallanRepository;
import com.alsorg.packing.service.pdf.ChalaanPdfService;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.config.TimeZoneConfig;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;

@Service
@Transactional
public class CustomChallanService {

    private static final java.time.ZoneId APP_ZONE = TimeZoneConfig.APP_ZONE;
    private static final int MAX_CUSTOM_CHALLAN_ITEMS = 500;

    private final CustomChallanRepository repository;
    private final ChalaanPdfService pdfService;

    @PersistenceContext
    private EntityManager entityManager;

    public CustomChallanService(
            CustomChallanRepository repository,
            ChalaanPdfService pdfService) {
        this.repository = repository;
        this.pdfService = pdfService;
    }

    public DispatchTripPdfResult generateAndSave(
            CustomChallanRequest request,
            String username) {
        validateRequest(request);

        String actor = safeActor(username);

        LocalDateTime generatedAt = request.dispatchTime() != null
                ? request.dispatchTime()
                : LocalDateTime.now(APP_ZONE);

        String challanNo = generateCustomChallanNumber(
                request.challanType(),
                generatedAt);

        CustomChallan challan = new CustomChallan();

        challan.setChallanNumber(challanNo);
        challan.setGeneratedBy(actor);
        challan.setGeneratedAt(generatedAt);

        applyHeaderFields(
                challan,
                request);

        addSubmittedItems(
                challan,
                request.items());

        repository.save(challan);

        return buildPdfResult(challan);
    }

    /*
     * ============================================================
     * ADMIN CUSTOM-CHALLAN EDIT
     * ============================================================
     */

    @Transactional(readOnly = true)
    public CustomChallanRequest getForAdminEdit(
            String challanNumber) {

        return toRequest(
                findRequired(challanNumber));
    }

    /**
     * Updates an existing custom challan without changing its challan number or
     * original generatedBy value. The PDF is not stored separately; every later
     * preview/download is rebuilt from the corrected database values.
     */
    public DispatchTripPdfResult updateAsAdmin(
            String challanNumber,
            CustomChallanRequest request,
            String adminUsername) {

        validateRequest(request);

        CustomChallan challan = findRequiredForUpdate(
                challanNumber);

        applyHeaderFields(
                challan,
                request);

        if (request.dispatchTime() != null) {
            challan.setGeneratedAt(
                    request.dispatchTime());
        }

        /*
         * Keep challanNumber and generatedBy immutable.
         *
         * We explicitly remove old child rows through EntityManager before adding
         * the submitted lines. That makes item deletion/editing work even when the
         * entity mapping does not use orphanRemoval=true.
         */
        replaceSubmittedItems(
                challan,
                request.items());

        repository.save(challan);
        entityManager.flush();

        return buildPdfResult(challan);
    }

    private void applyHeaderFields(
            CustomChallan challan,
            CustomChallanRequest request) {

        challan.setChallanType(
                clean(request.challanType()));

        challan.setFromLocation(
                clean(request.fromLocation()));

        challan.setToLocation(
                clean(request.toLocation()));

        challan.setPdNo(
                clean(request.pdNo()));

        challan.setDriverName(
                cleanNullable(request.driverName()));

        challan.setVehicleNumber(
                cleanNullable(request.vehicleNumber()));

        challan.setHandedOverTo(
                isType(request.challanType(), "SITE_RETURN")
                        ? cleanNullable(request.handedOverTo())
                        : null);

        challan.setClientName(
                clean(request.clientName()));

        challan.setClientAddress(
                clean(request.clientAddress()));

        challan.setPurpose(
                clean(request.purpose()));

        challan.setMovementMode(
                isBlank(request.movementMode())
                        ? "DIRECT_DISPATCH"
                        : clean(request.movementMode()));
    }

    private void addSubmittedItems(
            CustomChallan challan,
            List<CustomChallanItemRequest> itemRequests) {

        if (itemRequests == null) {
            return;
        }

        for (CustomChallanItemRequest itemRequest : itemRequests) {
            if (itemRequest == null || isBlank(itemRequest.description())) {
                continue;
            }

            CustomChallanItem item = new CustomChallanItem();

            item.setChallan(challan);
            item.setDescription(clean(itemRequest.description()));
            item.setDrawingNo(clean(itemRequest.drawingNo()));

            item.setQuantity(
                    itemRequest.quantity() == null || itemRequest.quantity() <= 0
                            ? 1D
                            : itemRequest.quantity());

            item.setUom(
                    normalizeUom(itemRequest.uom()));

            item.setReturnable(
                    Boolean.TRUE.equals(itemRequest.returnable()));

            item.setRemarks(
                    clean(itemRequest.remarks()));

            challan.getItems().add(item);
        }
    }

    private void replaceSubmittedItems(
            CustomChallan challan,
            List<CustomChallanItemRequest> itemRequests) {

        List<CustomChallanItem> existingItems = challan.getItems() == null
                ? List.of()
                : new ArrayList<>(challan.getItems());

        if (challan.getItems() != null) {
            challan.getItems().clear();
        }

        for (CustomChallanItem existingItem : existingItems) {
            if (existingItem == null) {
                continue;
            }

            CustomChallanItem managedItem = entityManager.contains(existingItem)
                    ? existingItem
                    : entityManager.merge(existingItem);

            entityManager.remove(managedItem);
        }

        entityManager.flush();

        addSubmittedItems(
                challan,
                itemRequests);

        /*
         * The parent already exists and is managed during an Admin update.
         * Persist the newly-created child rows explicitly so this works whether the
         * entity relationship is configured with PERSIST, MERGE or ALL cascade.
         */
        for (CustomChallanItem submittedItem : challan.getItems()) {
            if (submittedItem != null && !entityManager.contains(submittedItem)) {
                entityManager.persist(submittedItem);
            }
        }
    }

    private DispatchTripPdfResult buildPdfResult(
            CustomChallan challan) {

        CustomChallanRequest pdfRequest = toRequest(challan);

        byte[] pdf = pdfService.generateCustomChalaan(
                pdfRequest,
                challan.getChallanNumber(),
                challan.getGeneratedBy());

        return new DispatchTripPdfResult(
                null,
                challan.getChallanNumber(),
                pdf);
    }

    private CustomChallan findRequiredForUpdate(
            String challanNumber) {

        String cleanNumber = cleanNullable(
                challanNumber);

        if (cleanNumber == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Custom challan number is required");
        }

        CustomChallan challan = entityManager.find(
                CustomChallan.class,
                cleanNumber,
                LockModeType.PESSIMISTIC_WRITE);

        if (challan == null) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Custom challan not found: " + cleanNumber);
        }

        return challan;
    }

    private CustomChallan findRequired(
            String challanNumber) {

        String cleanNumber = cleanNullable(
                challanNumber);

        if (cleanNumber == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Custom challan number is required");
        }

        return repository
                .findById(cleanNumber)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Custom challan not found: " + cleanNumber));
    }

    @Transactional(readOnly = true)
    public List<CustomChallanSummaryResponse> listAll() {
        return repository
                .findAllByOrderByGeneratedAtDesc()
                .stream()
                .map(this::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public DispatchTripPdfResult download(
            String challanNumber) {
        return buildPdfResult(
                findRequired(challanNumber));
    }

    private CustomChallanRequest toRequest(
            CustomChallan challan) {
        List<CustomChallanItemRequest> itemRequests = new ArrayList<>();

        for (CustomChallanItem item : challan.getItems()) {
            itemRequests.add(
                    new CustomChallanItemRequest(
                            item.getDescription(),
                            item.getDrawingNo(),
                            item.getQuantity(),
                            item.getUom(),
                            item.getReturnable(),
                            item.getRemarks()));
        }

        return new CustomChallanRequest(
                challan.getChallanType(),
                challan.getFromLocation(),
                challan.getToLocation(),
                challan.getPdNo(),
                challan.getClientName(),
                challan.getClientAddress(),
                challan.getPurpose(),
                challan.getMovementMode(),
                challan.getDriverName(),
                challan.getVehicleNumber(),
                challan.getHandedOverTo(),
                challan.getGeneratedAt(),
                itemRequests);
    }

    private CustomChallanSummaryResponse toSummary(
            CustomChallan challan) {
        return new CustomChallanSummaryResponse(
                challan.getChallanNumber(),
                challan.getChallanType(),
                challanTypeLabel(challan.getChallanType()),
                challan.getFromLocation(),
                challan.getToLocation(),
                challan.getPdNo(),
                challan.getClientName(),
                challan.getPurpose(),
                challan.getMovementMode(),
                challan.getDriverName(),
                challan.getVehicleNumber(),
                challan.getHandedOverTo(),
                challan.getGeneratedBy(),
                challan.getGeneratedAt(),
                challan.getItems() == null
                        ? 0
                        : challan.getItems().size());
    }

    private void validateRequest(
            CustomChallanRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Custom challan request missing");
        }

        if (isBlank(request.fromLocation())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "From location is required");
        }

        if (isBlank(request.toLocation())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "To location / site is required");
        }

        if (isType(request.challanType(), "SITE_RETURN")
                && isBlank(request.handedOverTo())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Handed over to is required for Site Return challan");
        }

        if (request.items() == null || request.items().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one item is required");
        }

        if (request.items().size() > MAX_CUSTOM_CHALLAN_ITEMS) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "A maximum of " + MAX_CUSTOM_CHALLAN_ITEMS
                            + " items can be added to one custom challan");
        }

        boolean hasValidItem = request.items()
                .stream()
                .anyMatch(item -> item != null &&
                        !isBlank(item.description()));

        if (!hasValidItem) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one item description is required");
        }
    }

    private String generateCustomChallanNumber(
            String challanType,
            LocalDateTime generatedAt) {
        String cleanType = challanType == null
                ? ""
                : challanType.trim().toUpperCase();

        String prefix;

        if ("CUSTOMER_CARE".equals(cleanType)) {
            prefix = "CC-CH";
        } else if ("HARDWARE_SITE_REQUIREMENT".equals(cleanType)) {
            prefix = "HW-CH";
        } else if ("ASSEMBLY_SITE_REQUIREMENT".equals(cleanType)) {
            prefix = "ASM-CH";
        } else if ("JOB_WORK".equals(cleanType)) {
            prefix = "JW-CH";
        } else if ("SITE_RETURN".equals(cleanType)) {
            prefix = "SR-CH";
        } else {
            prefix = "CUS-CH";
        }

        String date = (generatedAt != null
                ? generatedAt.toLocalDate()
                : java.time.LocalDate.now(APP_ZONE)).format(
                        java.time.format.DateTimeFormatter.BASIC_ISO_DATE);

        String suffix = UUID.randomUUID()
                .toString()
                .substring(0, 12)
                .toUpperCase();

        return prefix + "-" + date + "-" + suffix;
    }

    private String challanTypeLabel(
            String value) {
        String clean = value == null
                ? ""
                : value.trim().toUpperCase();

        if ("CUSTOMER_CARE".equals(clean)) {
            return "Customer Care";
        }

        if ("HARDWARE_SITE_REQUIREMENT".equals(clean)) {
            return "Hardware / Site Requirement";
        }

        if ("ASSEMBLY_SITE_REQUIREMENT".equals(clean)) {
            return "Assembly / Site Requirement";
        }

        if ("JOB_WORK".equals(clean)) {
            return "Job Work";
        }

        if ("SITE_RETURN".equals(clean)) {
            return "Site Return";
        }

        return "Other Movement";
    }

    @Transactional(readOnly = true)
    public List<CustomChallanSummaryResponse> listForUser(
            String username,
            boolean admin) {
        String currentUsername = cleanLower(username);

        if (!admin && currentUsername.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Authenticated username is required");
        }

        if (admin) {
            return repository
                    .findAllByOrderByGeneratedAtDesc()
                    .stream()
                    .map(this::toSummary)
                    .toList();
        }

        return entityManager.createQuery(
                        """
                        select challan
                        from CustomChallan challan
                        where lower(trim(coalesce(challan.generatedBy, ''))) = :username
                        order by challan.generatedAt desc
                        """,
                        CustomChallan.class)
                .setParameter("username", currentUsername)
                .getResultList()
                .stream()
                .map(this::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public DispatchTripPdfResult downloadForUser(
            String challanNumber,
            String username,
            boolean admin) {
        CustomChallan challan = repository
                .findById(challanNumber)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Custom challan not found: " + challanNumber));

        if (!admin) {
            String currentUsername = cleanLower(username);

            if (currentUsername.isBlank()) {
                throw new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "Authenticated username is required");
            }

            if (!cleanLower(challan.getGeneratedBy()).equals(currentUsername)) {
                throw new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "You do not have access to this custom challan");
            }
        }

        return buildPdfResult(challan);
    }

    private String cleanNullable(
            String value) {
        if (value == null) {
            return null;
        }

        String cleaned = value.trim();

        return cleaned.isBlank()
                ? null
                : cleaned;
    }

    private String clean(
            String value) {
        return value == null
                ? ""
                : value.trim();
    }

    private boolean isBlank(
            String value) {
        return value == null || value.trim().isBlank();
    }

    private String safeActor(
            String username) {
        return username != null && !username.trim().isBlank()
                ? username.trim()
                : "SYSTEM";
    }

    private String cleanLower(String value) {
        if (value == null) {
            return "";
        }

        return value.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeUom(
            String value) {
        String clean = value == null
                ? ""
                : value.trim().toUpperCase();

        return switch (clean) {
            case "KG" -> "KG";
            case "LTR" -> "LTR";
            case "GRAM", "GM", "GMS" -> "GRAM";
            case "MM" -> "MM";
            case "SET", "SETS" -> "SET";
            case "ML" -> "ML";
            case "SQFT" -> "SQFT";
            case "FT" -> "FT";
            case "PIECES" -> "PIECES";
            case "PCS" -> "PIECES";
            case "PC" -> "PIECES";
            case "MTR" -> "MTR";
            case "SQMTR" -> "SQMTR";
            default -> "PIECES";
        };
    }

    private boolean isType(
            String value,
            String expected) {
        if (value == null || expected == null) {
            return false;
        }

        return value.trim()
                .equalsIgnoreCase(expected.trim());
    }
}