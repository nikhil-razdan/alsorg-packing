package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.LocationRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.LocationResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StockAdjustmentRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StockBalanceResponse;
import com.alsorg.packing.domain.matflow.MatFlowLocation;
import com.alsorg.packing.domain.matflow.MatFlowMaterial;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MovementType;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.OwnershipType;
import com.alsorg.packing.domain.matflow.MatFlowStockBalance;
import com.alsorg.packing.domain.matflow.MatFlowStockLedger;
import com.alsorg.packing.repository.matflow.MatFlowLocationRepository;
import com.alsorg.packing.repository.matflow.MatFlowMaterialRepository;
import com.alsorg.packing.repository.matflow.MatFlowStockBalanceRepository;
import com.alsorg.packing.repository.matflow.MatFlowStockLedgerRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MatFlowInventoryService {

        private final MatFlowLocationRepository locationRepository;
        private final MatFlowMaterialRepository materialRepository;
        private final MatFlowStockBalanceRepository balanceRepository;
        private final MatFlowStockLedgerRepository ledgerRepository;
        private final MatFlowAccessService accessService;

        public MatFlowInventoryService(
                        MatFlowLocationRepository locationRepository,
                        MatFlowMaterialRepository materialRepository,
                        MatFlowStockBalanceRepository balanceRepository,
                        MatFlowStockLedgerRepository ledgerRepository,
                        MatFlowAccessService accessService) {
                this.locationRepository = locationRepository;

                this.materialRepository = materialRepository;

                this.balanceRepository = balanceRepository;

                this.ledgerRepository = ledgerRepository;

                this.accessService = accessService;
        }

        @Transactional(readOnly = true)
        public List<LocationResponse> listLocations(
                        String search,
                        Boolean active) {

                accessService.requireRead();

                String query = normalizeSearch(search);

                return locationRepository
                                .findByPlantCodeInOrderByLocationCodeAsc(
                                                accessService.allowedPlants())
                                .stream()
                                .filter(location -> active == null ||
                                                location.isActive() == active)
                                .filter(location -> query.isBlank()
                                                ||
                                                contains(
                                                                location.getLocationCode(),
                                                                query)
                                                ||
                                                contains(
                                                                location.getLocationName(),
                                                                query)
                                                ||
                                                contains(
                                                                location.getPlantCode(),
                                                                query)
                                                ||
                                                contains(
                                                                location.getLocationType() == null
                                                                                ? null
                                                                                : location.getLocationType()
                                                                                                .name(),
                                                                query)
                                                ||
                                                contains(
                                                                location.getOwnershipType() == null
                                                                                ? null
                                                                                : location.getOwnershipType()
                                                                                                .name(),
                                                                query))
                                .map(this::toLocationResponse)
                                .toList();
        }

        @Transactional
        public LocationResponse createLocation(
                        LocationRequest request) {
                accessService.requireLocationWrite();

                validateLocation(request);

                String code = upper(request.locationCode());

                String plantCode = upper(request.plantCode());

                accessService.requirePlantAccess(
                                plantCode);

                if (locationRepository
                                .existsByLocationCodeIgnoreCase(
                                                code)) {
                        throw conflict(
                                        "Location code already exists: " +
                                                        code);
                }

                MatFlowLocation location = new MatFlowLocation();

                applyLocation(
                                location,
                                request,
                                true);

                String actor = accessService.actor();

                location.setCreatedBy(actor);
                location.setUpdatedBy(actor);

                return toLocationResponse(
                                locationRepository.save(location));
        }

        @Transactional
        public LocationResponse updateLocation(
                        UUID id,
                        LocationRequest request) {
                accessService.requireLocationWrite();

                validateLocation(request);

                MatFlowLocation location = requireLocation(id);

                assertVersion(
                                request.rowVersion(),
                                location.getRowVersion(),
                                "Location");

                String plantCode = upper(request.plantCode());

                accessService.requirePlantAccess(
                                plantCode);

                String code = upper(request.locationCode());

                if (locationRepository
                                .existsByLocationCodeIgnoreCaseAndIdNot(
                                                code,
                                                id)) {
                        throw conflict(
                                        "Location code already exists: " +
                                                        code);
                }

                applyLocation(
                                location,
                                request,
                                false);

                location.setUpdatedBy(
                                accessService.actor());

                return toLocationResponse(
                                locationRepository.save(location));
        }

        @Transactional(readOnly = true)
        public List<StockBalanceResponse> listStock(
                        UUID materialId,
                        UUID locationId,
                        String plantCode) {
                accessService.requireRead();

                String normalizedPlant = plantCode == null
                                ? null
                                : upper(plantCode);

                if (normalizedPlant != null) {
                        accessService.requirePlantAccess(
                                        normalizedPlant);
                }

                return balanceRepository
                                .findVisibleBalances(
                                                accessService.allowedPlants())
                                .stream()
                                .filter(balance -> materialId == null ||
                                                balance.material
                                                                .getId()
                                                                .equals(materialId))
                                .filter(balance -> locationId == null ||
                                                balance.location
                                                                .getId()
                                                                .equals(locationId))
                                .filter(balance -> normalizedPlant == null ||
                                                balance.location.getPlantCode()
                                                                .equalsIgnoreCase(
                                                                                normalizedPlant))
                                .map(this::toStockResponse)
                                .toList();
        }

        @Transactional
        public StockBalanceResponse adjustStock(
                        StockAdjustmentRequest request) {
                accessService.requireStockWrite();

                if (request == null) {
                        throw badRequest(
                                        "Stock adjustment request is required");
                }

                if (request.materialId() == null) {
                        throw badRequest(
                                        "Material is required");
                }

                if (request.locationId() == null) {
                        throw badRequest(
                                        "Location is required");
                }

                BigDecimal adjustment = scale(request.adjustmentQty());

                if (adjustment.compareTo(
                                BigDecimal.ZERO) == 0) {
                        throw badRequest(
                                        "Adjustment quantity cannot be zero");
                }

                MatFlowMaterial material = materialRepository
                                .findById(
                                                request.materialId())
                                .orElseThrow(() -> notFound(
                                                "Material not found"));

                MatFlowLocation location = requireLocation(
                                request.locationId());

                if (!location.isSupportsStock()) {
                        throw badRequest(
                                        "Selected location does not support stock");
                }

                MatFlowStockBalance balance = balanceRepository
                                .lockBalance(
                                                material.getId(),
                                                location.getId())
                                .orElse(null);

                boolean newBalance = balance == null;

                String actor = accessService.actor();

                if (newBalance) {
                        if (adjustment.compareTo(
                                        BigDecimal.ZERO) < 0) {
                                throw badRequest(
                                                "Opening stock cannot be negative");
                        }

                        balance = new MatFlowStockBalance();

                        balance.material = material;
                        balance.location = location;
                        balance.onHandQty = BigDecimal.ZERO;
                        balance.reservedQty = BigDecimal.ZERO;
                        balance.blockedQty = BigDecimal.ZERO;
                        balance.inTransitQty = BigDecimal.ZERO;
                        balance.setCreatedBy(actor);
                } else {
                        assertVersion(
                                        request.rowVersion(),
                                        balance.getRowVersion(),
                                        "Stock balance");
                }

                BigDecimal nextOnHand = balance.onHandQty
                                .add(adjustment)
                                .setScale(
                                                3,
                                                RoundingMode.HALF_UP);

                BigDecimal committed = balance.reservedQty
                                .add(balance.blockedQty);

                if (nextOnHand.compareTo(
                                committed) < 0) {
                        throw conflict(
                                        "Stock cannot be reduced below reserved and blocked quantity");
                }

                balance.onHandQty = nextOnHand;

                balance.setUpdatedBy(actor);

                balance = balanceRepository.save(balance);

                MovementType movementType;

                if (newBalance) {
                        movementType = MovementType.OPENING_BALANCE;
                } else if (adjustment.compareTo(
                                BigDecimal.ZERO) > 0) {
                        movementType = MovementType.ADJUSTMENT_IN;
                } else {
                        movementType = MovementType.ADJUSTMENT_OUT;
                }

                saveLedger(
                                balance,
                                movementType,
                                adjustment,
                                BigDecimal.ZERO,
                                "MANUAL_STOCK_ADJUSTMENT",
                                balance.getId(),
                                null,
                                request.batchNo(),
                                request.remarks(),
                                actor);

                return toStockResponse(balance);
        }

        public MatFlowLocation requireLocation(
                        UUID id) {
                MatFlowLocation location = locationRepository
                                .findById(id)
                                .orElseThrow(() -> notFound(
                                                "Location not found"));

                accessService.requirePlantAccess(
                                location.getPlantCode());

                return location;
        }

        private void applyLocation(
                        MatFlowLocation location,
                        LocationRequest request,
                        boolean creating) {

                location.setLocationCode(
                                upper(
                                                request.locationCode()));

                location.setLocationName(
                                clean(
                                                request.locationName()));

                location.setPlantCode(
                                upper(
                                                request.plantCode()));

                location.setLocationType(
                                request.locationType());

                if (request.ownershipType() != null) {
                        location.setOwnershipType(
                                        request.ownershipType());

                } else if (creating) {
                        location.setOwnershipType(
                                        OwnershipType.INTERNAL);
                }

                if (request.supportsStock() != null) {
                        location.setSupportsStock(
                                        request.supportsStock());

                } else if (creating) {
                        location.setSupportsStock(
                                        true);
                }

                location.setAddress(
                                clean(
                                                request.address()));

                location.setContactPerson(
                                clean(
                                                request.contactPerson()));

                location.setContactPhone(
                                clean(
                                                request.contactPhone()));

                if (request.active() != null) {
                        location.setActive(
                                        request.active());

                } else if (creating) {
                        location.setActive(
                                        true);
                }
        }

        private void validateLocation(
                        LocationRequest request) {
                if (request == null) {
                        throw badRequest(
                                        "Location request is required");
                }

                required(
                                request.locationCode(),
                                "Location code");

                required(
                                request.locationName(),
                                "Location name");

                required(
                                request.plantCode(),
                                "Plant code");

                if (request.locationType() == null) {
                        throw badRequest(
                                        "Location type is required");
                }
        }

        private void saveLedger(
                        MatFlowStockBalance balance,
                        MovementType movementType,
                        BigDecimal quantityChange,
                        BigDecimal reservedChange,
                        String referenceType,
                        UUID referenceId,
                        String referenceNumber,
                        String batchNo,
                        String remarks,
                        String actor) {
                MatFlowStockLedger ledger = new MatFlowStockLedger();

                ledger.material = balance.material;

                ledger.location = balance.location;

                ledger.movementType = movementType;

                ledger.quantityChange = scale(quantityChange);

                ledger.reservedChange = scale(reservedChange);

                ledger.blockedChange = BigDecimal.ZERO;

                ledger.inTransitChange = BigDecimal.ZERO;

                ledger.onHandAfter = balance.onHandQty;

                ledger.reservedAfter = balance.reservedQty;

                ledger.blockedAfter = balance.blockedQty;

                ledger.inTransitAfter = balance.inTransitQty;

                ledger.referenceType = referenceType;

                ledger.referenceId = referenceId;

                ledger.referenceNumber = referenceNumber;

                ledger.batchNo = clean(batchNo);

                ledger.remarks = clean(remarks);

                ledger.actor = actor;

                ledgerRepository.save(ledger);
        }

        private LocationResponse toLocationResponse(
                        MatFlowLocation location) {

                return new LocationResponse(
                                location.getId(),
                                location.getLocationCode(),
                                location.getLocationName(),
                                location.getPlantCode(),
                                location.getLocationType(),
                                location.getOwnershipType(),
                                location.isSupportsStock(),
                                location.getAddress(),
                                location.getContactPerson(),
                                location.getContactPhone(),
                                location.isActive(),
                                location.getRowVersion());
        }

        private StockBalanceResponse toStockResponse(
                        MatFlowStockBalance balance) {

                return new StockBalanceResponse(
                                balance.getId(),

                                balance.material
                                                .getId(),

                                balance.material
                                                .getMaterialCode(),

                                balance.material
                                                .getMaterialName(),

                                balance.material
                                                .getUom(),

                                balance.location
                                                .getId(),

                                balance.location
                                                .getLocationCode(),

                                balance.location
                                                .getLocationName(),

                                balance.location
                                                .getPlantCode(),

                                balance.location
                                                .getLocationType(),

                                zero(balance.onHandQty),
                                zero(balance.reservedQty),
                                zero(balance.blockedQty),
                                zero(balance.inTransitQty),

                                balance.availableQty(),

                                balance.getRowVersion());
        }

        private BigDecimal zero(
                        BigDecimal value) {

                return value == null
                                ? BigDecimal.ZERO.setScale(
                                                3,
                                                RoundingMode.HALF_UP)
                                : value.setScale(
                                                3,
                                                RoundingMode.HALF_UP);
        }

        private void assertVersion(
                        Long requested,
                        Long current,
                        String entity) {
                if (requested == null) {
                        throw badRequest(
                                        entity +
                                                        " rowVersion is required");
                }

                if (!requested.equals(current)) {
                        throw conflict(
                                        entity +
                                                        " was modified by another user. Refresh and retry.");
                }
        }

        private BigDecimal scale(
                        BigDecimal value) {
                return value == null
                                ? BigDecimal.ZERO
                                : value.setScale(
                                                3,
                                                RoundingMode.HALF_UP);
        }

        private void required(
                        String value,
                        String field) {
                if (value == null ||
                                value.trim().isBlank()) {
                        throw badRequest(
                                        field + " is required");
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

        private String upper(
                        String value) {

                String result = clean(value);

                return result == null
                                ? null
                                : result.toUpperCase(
                                                Locale.ROOT);
        }

        private String normalizeSearch(
                        String value) {
                return value == null
                                ? ""
                                : value.trim()
                                                .toLowerCase(
                                                                Locale.ROOT);
        }

        private boolean contains(
                        String value,
                        String query) {
                return value != null &&
                                value.toLowerCase(
                                                Locale.ROOT).contains(query);
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