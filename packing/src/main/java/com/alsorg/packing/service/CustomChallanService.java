package com.alsorg.packing.service;

import com.alsorg.packing.controller.dto.challan.CustomChallanItemRequest;
import com.alsorg.packing.controller.dto.challan.CustomChallanRequest;
import com.alsorg.packing.controller.dto.challan.CustomChallanSummaryResponse;
import com.alsorg.packing.controller.dto.logistics.DispatchTripPdfResult;
import com.alsorg.packing.domain.dispatch.CustomChallan;
import com.alsorg.packing.domain.dispatch.CustomChallanItem;
import com.alsorg.packing.repository.CustomChallanRepository;
import com.alsorg.packing.service.pdf.ChalaanPdfService;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class CustomChallanService {

    private static final ZoneId INDIA_ZONE = ZoneId.of("Asia/Kolkata");

    private final CustomChallanRepository repository;
    private final ChalaanPdfService pdfService;

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
                : LocalDateTime.now(INDIA_ZONE);

        String challanNo = generateCustomChallanNumber(
                request.challanType(),
                generatedAt);

        CustomChallan challan = new CustomChallan();

        challan.setChallanNumber(challanNo);
        challan.setChallanType(clean(request.challanType()));
        challan.setFromLocation(clean(request.fromLocation()));
        challan.setToLocation(clean(request.toLocation()));
        challan.setPdNo(clean(request.pdNo()));
        challan.setDriverName(clean(request.driverName()));
        challan.setVehicleNumber(clean(request.vehicleNumber()));
        challan.setClientName(clean(request.clientName()));
        challan.setClientAddress(clean(request.clientAddress()));
        challan.setPurpose(clean(request.purpose()));
        challan.setMovementMode(
                isBlank(request.movementMode())
                        ? "DIRECT_DISPATCH"
                        : clean(request.movementMode()));
        challan.setGeneratedBy(actor);
        challan.setGeneratedAt(generatedAt);

        for (CustomChallanItemRequest itemRequest : request.items()) {
            if (itemRequest == null || isBlank(itemRequest.description())) {
                continue;
            }

            CustomChallanItem item = new CustomChallanItem();

            item.setChallan(challan);
            item.setDescription(clean(itemRequest.description()));
            item.setDrawingNo(clean(itemRequest.drawingNo()));
            item.setQuantity(
                    itemRequest.quantity() == null || itemRequest.quantity() <= 0
                            ? 1
                            : itemRequest.quantity());
            item.setReturnable(Boolean.TRUE.equals(itemRequest.returnable()));
            item.setRemarks(clean(itemRequest.remarks()));

            challan.getItems().add(item);
        }

        repository.save(challan);

        CustomChallanRequest pdfRequest = toRequest(challan);

        byte[] pdf = pdfService.generateCustomChalaan(
                pdfRequest,
                challanNo,
                actor);

        return new DispatchTripPdfResult(
                null,
                challanNo,
                pdf);
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
        CustomChallan challan = repository
                .findById(challanNumber)
                .orElseThrow(() -> new RuntimeException(
                        "Custom challan not found: " + challanNumber));

        CustomChallanRequest request = toRequest(challan);

        byte[] pdf = pdfService.generateCustomChalaan(
                request,
                challan.getChallanNumber(),
                challan.getGeneratedBy());

        return new DispatchTripPdfResult(
                null,
                challan.getChallanNumber(),
                pdf);
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
                challan.getGeneratedBy(),
                challan.getGeneratedAt(),
                challan.getItems() == null
                        ? 0
                        : challan.getItems().size());
    }

    private void validateRequest(
            CustomChallanRequest request) {
        if (request == null) {
            throw new RuntimeException("Custom challan request missing");
        }

        if (isBlank(request.fromLocation())) {
            throw new RuntimeException("From location is required");
        }

        if (isBlank(request.toLocation())) {
            throw new RuntimeException("To location / site is required");
        }

        if (isBlank(request.driverName())) {
            throw new RuntimeException("Driver name is required");
        }

        if (isBlank(request.vehicleNumber())) {
            throw new RuntimeException("Vehicle number is required");
        }

        if (request.items() == null || request.items().isEmpty()) {
            throw new RuntimeException("At least one item is required");
        }

        boolean hasValidItem = request.items()
                .stream()
                .anyMatch(item -> item != null &&
                        !isBlank(item.description()));

        if (!hasValidItem) {
            throw new RuntimeException("At least one item description is required");
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
        } else {
            prefix = "CUS-CH";
        }

        String date = (generatedAt != null
                ? generatedAt.toLocalDate()
                : java.time.LocalDate.now(INDIA_ZONE)).format(
                        java.time.format.DateTimeFormatter.BASIC_ISO_DATE);

        String suffix = UUID.randomUUID()
                .toString()
                .substring(0, 6)
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

        return "Other Movement";
    }

    @Transactional(readOnly = true)
    public List<CustomChallanSummaryResponse> listForUser(
            String username,
            boolean admin) {
        String currentUsername = cleanLower(username);

        return repository
                .findAllByOrderByGeneratedAtDesc()
                .stream()
                .filter(challan -> {
                    if (admin) {
                        return true;
                    }

                    return cleanLower(challan.getGeneratedBy())
                            .equals(currentUsername);
                })
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
                .orElseThrow(() -> new RuntimeException(
                        "Custom challan not found: " + challanNumber));

        if (!admin) {
            String currentUsername = cleanLower(username);

            if (!cleanLower(challan.getGeneratedBy()).equals(currentUsername)) {
                throw new RuntimeException(
                        "You do not have access to this custom challan");
            }
        }

        CustomChallanRequest request = toRequest(challan);

        byte[] pdf = pdfService.generateCustomChalaan(
                request,
                challan.getChallanNumber(),
                challan.getGeneratedBy());

        return new DispatchTripPdfResult(
                null,
                challan.getChallanNumber(),
                pdf);
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

        return value.trim().toLowerCase();
    }
}