package com.alsorg.packing.controller.matflow;

import static com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.LocationRequest;
import static com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.LocationResponse;
import static com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StockAdjustmentRequest;
import static com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StockBalanceResponse;

import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.LocationRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.LocationResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StockAdjustmentRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.StockBalanceResponse;
import com.alsorg.packing.service.matflow.MatFlowInventoryService;

import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/matflow")
@PreAuthorize("isAuthenticated()")
public class MatFlowInventoryController {

        private final MatFlowInventoryService service;

        public MatFlowInventoryController(
                        MatFlowInventoryService service) {
                this.service = service;
        }

        @GetMapping("/locations")
        public List<LocationResponse> locations(
                        @RequestParam(required = false) String search,

                        @RequestParam(required = false) Boolean active) {
                return service.listLocations(
                                search,
                                active);
        }

        @PostMapping("/locations")
        @PreAuthorize("""
                        hasAnyAuthority(
                            'ADMIN',
                            'MATFLOW_MANAGER',
                            'MATFLOW_STORE'
                        )
                        """)
        public LocationResponse createLocation(
                        @Valid @RequestBody LocationRequest request) {

                return service.createLocation(
                                request);
        }

        @PutMapping("/locations/{id}")
        @PreAuthorize("""
                        hasAnyAuthority(
                            'ADMIN',
                            'MATFLOW_MANAGER',
                            'MATFLOW_STORE'
                        )
                        """)
        public LocationResponse updateLocation(
                        @PathVariable UUID id,

                        @Valid @RequestBody LocationRequest request) {

                return service.updateLocation(
                                id,
                                request);
        }

        @GetMapping("/stock")
        public List<StockBalanceResponse> stock(
                        @RequestParam(required = false) UUID materialId,

                        @RequestParam(required = false) UUID locationId,

                        @RequestParam(required = false) String plantCode) {
                return service.listStock(
                                materialId,
                                locationId,
                                plantCode);
        }

        @PostMapping("/stock/adjustments")
        @PreAuthorize("""
                        hasAnyAuthority(
                            'ADMIN',
                            'MATFLOW_MANAGER',
                            'MATFLOW_STORE'
                        )
                        """)
        public StockBalanceResponse adjustStock(
                        @Valid @RequestBody StockAdjustmentRequest request) {

                return service.adjustStock(
                                request);
        }
}