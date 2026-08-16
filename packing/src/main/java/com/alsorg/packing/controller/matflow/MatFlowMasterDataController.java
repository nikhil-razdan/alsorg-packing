package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.MaterialRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowDtos.MaterialResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowMetadataDtos.MetadataResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.LocationRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowPlanningDtos.LocationResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.VendorRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.VendorResponse;
import com.alsorg.packing.service.matflow.MatFlowMasterDataService;

import jakarta.validation.Valid;

import java.util.List;
import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * MatFlow master/reference controller.
 *
 * Tally is the physical stock authority. Therefore this controller
 * intentionally
 * exposes no Store stock balance, opening balance or stock-adjustment
 * endpoints.
 * MatFlow material master is identity/specification/UOM only; usage is reported
 * through /material-register.
 */
@RestController
@RequestMapping("/api/matflow")
@PreAuthorize("isAuthenticated()")
public class MatFlowMasterDataController {

    private final MatFlowMasterDataService service;

    public MatFlowMasterDataController(MatFlowMasterDataService service) {
        this.service = service;
    }

    /* -------------------- Materials -------------------- */

    @GetMapping("/materials")
    public List<MaterialResponse> materials(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean active) {
        return service.listMaterials(search, active);
    }

    @PostMapping("/materials")
    public MaterialResponse createMaterial(@Valid @RequestBody MaterialRequest request) {
        return service.createMaterial(request);
    }

    @PutMapping("/materials/{id}")
    public MaterialResponse updateMaterial(
            @PathVariable UUID id,
            @Valid @RequestBody MaterialRequest request) {
        return service.updateMaterial(id, request);
    }

    /*
     * Project/Product writes are owned only by MatFlowProjectController at
     * /api/matflow/projects.
     */

    /* -------------------- Locations -------------------- */

    @GetMapping("/locations")
    public List<LocationResponse> locations(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean active) {
        return service.listLocations(search, active);
    }

    @PostMapping("/locations")
    public LocationResponse createLocation(@Valid @RequestBody LocationRequest request) {
        return service.createLocation(request);
    }

    @PutMapping("/locations/{id}")
    public LocationResponse updateLocation(
            @PathVariable UUID id,
            @Valid @RequestBody LocationRequest request) {
        return service.updateLocation(id, request);
    }

    /*
     * No /stock and no /stock/adjustments endpoints by design.
     * Store checks actual stock in Tally.
     */

    /* -------------------- Vendors -------------------- */

    @GetMapping("/vendors")
    public List<VendorResponse> vendors(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean active) {
        return service.listVendors(search, active);
    }

    @PostMapping("/vendors")
    public VendorResponse createVendor(@Valid @RequestBody VendorRequest request) {
        return service.createVendor(request);
    }

    @PutMapping("/vendors/{id}")
    public VendorResponse updateVendor(
            @PathVariable UUID id,
            @Valid @RequestBody VendorRequest request) {
        return service.updateVendor(id, request);
    }

    /* -------------------- Frontend metadata -------------------- */

    @GetMapping("/meta")
    public MetadataResponse metadata() {
        return service.metadata();
    }
}
