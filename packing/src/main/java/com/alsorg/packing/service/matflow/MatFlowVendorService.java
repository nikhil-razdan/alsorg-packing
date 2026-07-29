package com.alsorg.packing.service.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.VendorRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProcurementDtos.VendorResponse;
import com.alsorg.packing.domain.matflow.MatFlowVendor;
import com.alsorg.packing.repository.matflow.MatFlowVendorRepository;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MatFlowVendorService {

    private final MatFlowVendorRepository vendorRepository;
    private final MatFlowAccessService accessService;

    public MatFlowVendorService(
            MatFlowVendorRepository vendorRepository,
            MatFlowAccessService accessService) {
        this.vendorRepository = vendorRepository;

        this.accessService = accessService;
    }

    @Transactional(readOnly = true)
    public List<VendorResponse> list(
            String search,
            Boolean active) {
        accessService.requireIndentRead();

        String query = search == null
                ? ""
                : search.trim()
                        .toLowerCase(Locale.ROOT);

        return vendorRepository
                .findAll(
                        Sort.by(
                                Sort.Direction.ASC,
                                "vendorName"))
                .stream()
                .filter(vendor -> active == null ||
                        vendor.active == active)
                .filter(vendor -> query.isBlank() ||
                        contains(
                                vendor.vendorCode,
                                query)
                        ||
                        contains(
                                vendor.vendorName,
                                query)
                        ||
                        contains(
                                vendor.gstin,
                                query))
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public VendorResponse create(
            VendorRequest request) {
        accessService.requireVendorWrite();

        validate(request);

        String code = upper(request.vendorCode());

        if (vendorRepository
                .existsByVendorCodeIgnoreCase(
                        code)) {
            throw conflict(
                    "Vendor code already exists: " +
                            code);
        }

        String actor = accessService.actor();

        MatFlowVendor vendor = new MatFlowVendor();

        apply(vendor, request);

        vendor.setCreatedBy(actor);
        vendor.setUpdatedBy(actor);

        return toResponse(
                vendorRepository.save(vendor));
    }

    @Transactional
    public VendorResponse update(
            UUID id,
            VendorRequest request) {
        accessService.requireVendorWrite();

        validate(request);

        MatFlowVendor vendor = vendorRepository
                .findById(id)
                .orElseThrow(() -> notFound(
                        "Vendor not found"));

        assertVersion(
                request.rowVersion(),
                vendor.getRowVersion());

        String code = upper(request.vendorCode());

        if (vendorRepository
                .existsByVendorCodeIgnoreCaseAndIdNot(
                        code,
                        id)) {
            throw conflict(
                    "Vendor code already exists: " +
                            code);
        }

        apply(vendor, request);

        vendor.setUpdatedBy(
                accessService.actor());

        return toResponse(
                vendorRepository.save(vendor));
    }

    private void apply(
            MatFlowVendor vendor,
            VendorRequest request) {
        vendor.vendorCode = upper(request.vendorCode());

        vendor.vendorName = clean(request.vendorName());

        vendor.gstin = upper(request.gstin());

        vendor.contactPerson = clean(request.contactPerson());

        vendor.phone = clean(request.phone());

        vendor.email = clean(request.email());

        vendor.address = clean(request.address());

        if (request.active() != null) {
            vendor.active = request.active();
        }
    }

    private void validate(
            VendorRequest request) {
        if (request == null) {
            throw badRequest(
                    "Vendor request is required");
        }

        required(
                request.vendorCode(),
                "Vendor code");

        required(
                request.vendorName(),
                "Vendor name");
    }

    private VendorResponse toResponse(
            MatFlowVendor vendor) {
        return new VendorResponse(
                vendor.getId(),
                vendor.vendorCode,
                vendor.vendorName,
                vendor.gstin,
                vendor.contactPerson,
                vendor.phone,
                vendor.email,
                vendor.address,
                vendor.active,
                vendor.getRowVersion());
    }

    private boolean contains(
            String value,
            String query) {
        return value != null &&
                value.toLowerCase(
                        Locale.ROOT).contains(query);
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

    private void assertVersion(
            Long requested,
            Long current) {
        if (requested == null) {
            throw badRequest(
                    "Vendor rowVersion is required");
        }

        if (!requested.equals(current)) {
            throw conflict(
                    "Vendor was modified by another user");
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

    private String upper(String value) {
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