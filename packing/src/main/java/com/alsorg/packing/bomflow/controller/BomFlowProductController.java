package com.alsorg.packing.bomflow.controller;

import com.alsorg.packing.bomflow.dto.BomFlowProductDtos.ProductRequest;
import com.alsorg.packing.bomflow.dto.BomFlowProductDtos.ProductResponse;
import com.alsorg.packing.bomflow.dto.BomFlowRevisionDtos.CreateRevisionRequest;
import com.alsorg.packing.bomflow.dto.BomFlowRevisionDtos.RevisionSummaryResponse;

import com.alsorg.packing.bomflow.service.BomFlowProductService;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/bomflow/products")
public class BomFlowProductController {

    private final BomFlowProductService service;

    public BomFlowProductController(
            BomFlowProductService service) {

        this.service = service;
    }

    @GetMapping
    public List<ProductResponse> list(
            @RequestParam(required = false)
            String search) {

        return service.list(search);
    }

    @GetMapping("/{productId}")
    public ProductResponse get(
            @PathVariable UUID productId) {

        return service.get(productId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductResponse create(
            @RequestBody ProductRequest request) {

        return service.create(request);
    }

    @PutMapping("/{productId}")
    public ProductResponse update(
            @PathVariable UUID productId,
            @RequestBody ProductRequest request) {

        return service.update(
                productId,
                request);
    }

    @GetMapping("/{productId}/revisions")
    public List<RevisionSummaryResponse> revisions(
            @PathVariable UUID productId) {

        return service.revisions(productId);
    }

    @PostMapping("/{productId}/revisions")
    @ResponseStatus(HttpStatus.CREATED)
    public RevisionSummaryResponse createRevision(
            @PathVariable UUID productId,
            @RequestBody(required = false)
            CreateRevisionRequest request) {

        return service.createRevision(
                productId,
                request);
    }
}
