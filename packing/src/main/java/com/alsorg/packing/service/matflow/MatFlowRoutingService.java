package com.alsorg.packing.service.matflow;

import static com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RouteStepRequest;
import static com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.RouteStepResponse;

import com.alsorg.packing.domain.matflow.MatFlowBom;
import com.alsorg.packing.domain.matflow.MatFlowBomLine;
import com.alsorg.packing.domain.matflow.MatFlowBomRouteStep;
import com.alsorg.packing.domain.matflow.MatFlowBomStatus;
import com.alsorg.packing.domain.matflow.MatFlowLocation;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.LocationType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.RouteStepType;
import com.alsorg.packing.repository.matflow.MatFlowBomLineRepository;
import com.alsorg.packing.repository.matflow.MatFlowBomRepository;
import com.alsorg.packing.repository.matflow.MatFlowBomRouteStepRepository;
import com.alsorg.packing.repository.matflow.MatFlowLocationRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MatFlowRoutingService {

    private final MatFlowBomRepository bomRepository;
    private final MatFlowBomLineRepository lineRepository;
    private final MatFlowBomRouteStepRepository routeRepository;
    private final MatFlowLocationRepository locationRepository;
    private final MatFlowAccessService accessService;

    public MatFlowRoutingService(
            MatFlowBomRepository bomRepository,
            MatFlowBomLineRepository lineRepository,
            MatFlowBomRouteStepRepository routeRepository,
            MatFlowLocationRepository locationRepository,
            MatFlowAccessService accessService) {
        this.bomRepository = bomRepository;
        this.lineRepository = lineRepository;
        this.routeRepository = routeRepository;
        this.locationRepository = locationRepository;
        this.accessService = accessService;
    }

    @Transactional(readOnly = true)
    public List<RouteStepResponse> listBomRoutes(
            UUID bomId) {
        accessService.requireRead();

        MatFlowBom bom = requireBom(bomId);

        return routeRepository
                .findByBomLine_Bom_IdOrderByBomLine_LineNoAscSequenceNoAsc(
                        bom.getId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public RouteStepResponse addStep(
            UUID bomId,
            UUID lineId,
            RouteStepRequest request) {
        accessService.requireEngineeringWrite();

        MatFlowBom bom = requireEditableBom(bomId);

        MatFlowBomLine line = requireLine(
                bom,
                lineId);

        validateRequest(request);

        if (routeRepository
                .existsByBomLine_IdAndSequenceNo(
                        lineId,
                        request.sequenceNo())) {
            throw conflict(
                    "Route sequence already exists for this BOM line");
        }

        MatFlowLocation location = requireLocation(
                request.locationId());

        validateLocationType(
                request.stepType(),
                location);

        String actor = accessService.actor();

        MatFlowBomRouteStep step = new MatFlowBomRouteStep();

        step.bomLine = line;
        apply(step, request, location);
        step.setCreatedBy(actor);
        step.setUpdatedBy(actor);

        return toResponse(
                routeRepository.save(step));
    }

    @Transactional
    public RouteStepResponse updateStep(
            UUID bomId,
            UUID lineId,
            UUID stepId,
            RouteStepRequest request) {
        accessService.requireEngineeringWrite();

        MatFlowBom bom = requireEditableBom(bomId);

        requireLine(
                bom,
                lineId);

        validateRequest(request);

        MatFlowBomRouteStep step = routeRepository
                .findById(stepId)
                .orElseThrow(() -> notFound(
                        "Route step not found"));

        if (!step.bomLine
                .getId()
                .equals(lineId)) {
            throw badRequest(
                    "Route step does not belong to the selected BOM line");
        }

        assertVersion(
                request.rowVersion(),
                step.getRowVersion());

        if (routeRepository
                .existsByBomLine_IdAndSequenceNoAndIdNot(
                        lineId,
                        request.sequenceNo(),
                        stepId)) {
            throw conflict(
                    "Route sequence already exists for this BOM line");
        }

        MatFlowLocation location = requireLocation(
                request.locationId());

        validateLocationType(
                request.stepType(),
                location);

        apply(step, request, location);

        step.setUpdatedBy(
                accessService.actor());

        return toResponse(
                routeRepository.save(step));
    }

    @Transactional
    public void deleteStep(
            UUID bomId,
            UUID lineId,
            UUID stepId,
            Long rowVersion) {
        accessService.requireEngineeringWrite();

        MatFlowBom bom = requireEditableBom(bomId);

        requireLine(
                bom,
                lineId);

        MatFlowBomRouteStep step = routeRepository
                .findById(stepId)
                .orElseThrow(() -> notFound(
                        "Route step not found"));

        if (!step.bomLine
                .getId()
                .equals(lineId)) {
            throw badRequest(
                    "Route step does not belong to the selected BOM line");
        }

        assertVersion(
                rowVersion,
                step.getRowVersion());

        routeRepository.delete(step);
    }

    /**
     * Called before BOM submission.
     */
    @Transactional(readOnly = true)
    public void validateBomForSubmission(
            MatFlowBom bom) {
        List<MatFlowBomLine> lines = lineRepository
                .findByBom_IdOrderByLineNoAsc(
                        bom.getId());

        for (MatFlowBomLine line : lines) {
            List<MatFlowBomRouteStep> steps = routeRepository
                    .findByBomLine_IdOrderBySequenceNoAsc(
                            line.getId());

            validateRoute(steps);
        }
    }

    public List<MatFlowBomRouteStep> routeForLine(
            UUID bomLineId) {
        return routeRepository
                .findByBomLine_IdOrderBySequenceNoAsc(
                        bomLineId);
    }

    private void validateRoute(
            List<MatFlowBomRouteStep> steps) {
        if (steps.isEmpty()) {
            return;
        }

        int productionCount = 0;

        for (int index = 0; index < steps.size(); index++) {

            MatFlowBomRouteStep step = steps.get(index);

            accessService.requirePlantAccess(
                    step.location.plantCode);

            if (!step.location.active) {
                throw badRequest(
                        "Inactive location exists in BOM route: " +
                                step.location.locationCode);
            }

            if (step.stepType == RouteStepType.PRODUCTION) {
                productionCount++;

                if (index != steps.size() - 1) {
                    throw badRequest(
                            "Production must be the final route step");
                }
            }
        }

        if (productionCount != 1) {
            throw badRequest(
                    "A configured route must contain exactly one final production step");
        }
    }

    private void validateLocationType(
            RouteStepType stepType,
            MatFlowLocation location) {
        if (stepType == RouteStepType.PROCESSING &&
                location.locationType != LocationType.PROCESSING &&
                location.locationType != LocationType.EXTERNAL_PROCESSOR) {
            throw badRequest(
                    "Processing step requires an internal or external processing location");
        }

        if (stepType == RouteStepType.QC &&
                location.locationType != LocationType.QC) {
            throw badRequest(
                    "QC step requires a QC location");
        }

        if (stepType == RouteStepType.PRODUCTION &&
                location.locationType != LocationType.PRODUCTION) {
            throw badRequest(
                    "Production step requires a production location");
        }
    }

    private void apply(
            MatFlowBomRouteStep step,
            RouteStepRequest request,
            MatFlowLocation location) {
        step.sequenceNo = request.sequenceNo();

        step.stepType = request.stepType();

        step.location = location;

        step.processCode = cleanUpper(
                request.processCode());

        step.expectedYieldPercent = request.expectedYieldPercent() == null
                ? new BigDecimal("100.000")
                : request.expectedYieldPercent()
                        .setScale(
                                3,
                                RoundingMode.HALF_UP);

        step.remarks = clean(request.remarks());
    }

    private void validateRequest(
            RouteStepRequest request) {
        if (request == null) {
            throw badRequest(
                    "Route step request is required");
        }

        if (request.sequenceNo() == null ||
                request.sequenceNo() <= 0) {
            throw badRequest(
                    "Route sequence must be greater than zero");
        }

        if (request.stepType() == null) {
            throw badRequest(
                    "Route step type is required");
        }

        if (request.locationId() == null) {
            throw badRequest(
                    "Route location is required");
        }

        BigDecimal yield = request.expectedYieldPercent() == null
                ? new BigDecimal("100")
                : request.expectedYieldPercent();

        if (yield.compareTo(
                BigDecimal.ZERO) <= 0 ||
                yield.compareTo(
                        new BigDecimal("100")) > 0) {
            throw badRequest(
                    "Expected yield percentage must be greater than 0 and not more than 100");
        }

        if (request.stepType() == RouteStepType.PROCESSING &&
                (request.processCode() == null ||
                        request.processCode()
                                .trim()
                                .isBlank())) {
            throw badRequest(
                    "Process code is required for a processing step");
        }
    }

    private MatFlowBom requireBom(
            UUID bomId) {
        MatFlowBom bom = bomRepository
                .findById(bomId)
                .orElseThrow(() -> notFound(
                        "BOM not found"));

        accessService.requirePlantAccess(
                bom.getProjectDrawing()
                        .getPlantCode());

        return bom;
    }

    private MatFlowBom requireEditableBom(
            UUID bomId) {
        MatFlowBom bom = requireBom(bomId);

        if (!bom.isLatestRevision()) {
            throw conflict(
                    "Only the latest BOM revision can be changed");
        }

        if (bom.getStatus() != MatFlowBomStatus.DRAFT &&
                bom.getStatus() != MatFlowBomStatus.RETURNED) {
            throw conflict(
                    "BOM route can only be changed in Draft or Returned status");
        }

        return bom;
    }

    private MatFlowBomLine requireLine(
            MatFlowBom bom,
            UUID lineId) {
        return lineRepository
                .findByIdAndBom_Id(
                        lineId,
                        bom.getId())
                .orElseThrow(() -> notFound(
                        "BOM line not found"));
    }

    private MatFlowLocation requireLocation(
            UUID id) {
        MatFlowLocation location = locationRepository
                .findById(id)
                .orElseThrow(() -> notFound(
                        "Location not found"));

        accessService.requirePlantAccess(
                location.plantCode);

        if (!location.active) {
            throw badRequest(
                    "Inactive location cannot be used in a route");
        }

        return location;
    }

    private RouteStepResponse toResponse(
            MatFlowBomRouteStep step) {
        MatFlowLocation location = step.location;

        MatFlowBomLine line = step.bomLine;

        return new RouteStepResponse(
                step.getId(),
                line.getBom().getId(),
                line.getId(),
                line.getLineNo(),
                step.sequenceNo,
                step.stepType,
                location.getId(),
                location.locationCode,
                location.locationName,
                location.plantCode,
                location.locationType,
                location.ownershipType,
                step.processCode,
                step.expectedYieldPercent,
                step.remarks,
                step.getRowVersion());
    }

    private void assertVersion(
            Long requested,
            Long current) {
        if (requested == null) {
            throw badRequest(
                    "Route step rowVersion is required");
        }

        if (!requested.equals(current)) {
            throw conflict(
                    "Route step was modified by another user");
        }
    }

    private String clean(String value) {
        if (value == null) {
            return null;
        }

        String result = value.trim();

        return result.isBlank()
                ? null
                : result;
    }

    private String cleanUpper(String value) {
        String result = clean(value);

        return result == null
                ? null
                : result.toUpperCase();
    }

    private ResponseStatusException badRequest(
            String message) {
        return new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                message);
    }

    private ResponseStatusException conflict(
            String message) {
        return new ResponseStatusException(
                HttpStatus.CONFLICT,
                message);
    }

    private ResponseStatusException notFound(
            String message) {
        return new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                message);
    }
}