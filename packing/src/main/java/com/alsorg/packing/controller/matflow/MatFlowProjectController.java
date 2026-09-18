package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowProjectDtos.ProductBulkCreateRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProjectDtos.ProductRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProjectDtos.ProductResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowProjectDtos.ProjectRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProjectDtos.ProjectResponse;
import com.alsorg.packing.service.matflow.MatFlowProjectService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Canonical PD / Project -> Products API. */
@RestController
@RequestMapping("/api/matflow/projects")
@PreAuthorize("isAuthenticated()")
public class MatFlowProjectController {
    private final MatFlowProjectService service;

    public MatFlowProjectController(MatFlowProjectService service) {
        this.service = service;
    }

    @GetMapping
    public List<ProjectResponse> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) String plantCode) {
        return service.list(search, active, plantCode);
    }

    @GetMapping("/{projectId}")
    public ProjectResponse get(@PathVariable UUID projectId) {
        return service.get(projectId);
    }

    @PostMapping
    public ProjectResponse create(@Valid @RequestBody ProjectRequest request) {
        return service.create(request);
    }

    @PutMapping("/{projectId}")
    public ProjectResponse update(@PathVariable UUID projectId, @Valid @RequestBody ProjectRequest request) {
        return service.update(projectId, request);
    }

    @DeleteMapping("/{projectId}")
    public ProjectResponse deactivate(@PathVariable UUID projectId, @RequestParam Long rowVersion) {
        return service.deactivateProject(projectId, rowVersion);
    }

    @PostMapping("/{projectId}/products")
    public ProjectResponse addProduct(@PathVariable UUID projectId, @Valid @RequestBody ProductRequest request) {
        return service.addProduct(projectId, request);
    }

    @PostMapping("/{projectId}/products/bulk")
    public ProjectResponse addProducts(@PathVariable UUID projectId, @Valid @RequestBody ProductBulkCreateRequest request) {
        return service.addProducts(projectId, request);
    }

    @PutMapping("/{projectId}/products/{productId}")
    public ProjectResponse updateProduct(
            @PathVariable UUID projectId,
            @PathVariable UUID productId,
            @Valid @RequestBody ProductRequest request) {
        return service.updateProduct(projectId, productId, request);
    }

    @DeleteMapping("/{projectId}/products/{productId}")
    public ProjectResponse deactivateProduct(
            @PathVariable UUID projectId,
            @PathVariable UUID productId,
            @RequestParam Long rowVersion) {
        return service.deactivateProduct(projectId, productId, rowVersion);
    }

    @PostMapping(value = "/{projectId}/products/{productId}/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ProductResponse uploadProductImage(
            @PathVariable UUID projectId,
            @PathVariable UUID productId,
            @RequestPart("file") MultipartFile file) {
        return service.uploadProductImage(projectId, productId, file);
    }

    @GetMapping("/{projectId}/products/{productId}/image")
    public ResponseEntity<Resource> productImage(@PathVariable UUID projectId, @PathVariable UUID productId) {
        Resource resource = service.loadProductImage(projectId, productId);
        String contentType = service.productImageContentType(projectId, productId);
        String fileName = service.productImageFileName(projectId, productId).replace("\"", "");
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + fileName + "\"")
                .body(resource);
    }

    @DeleteMapping("/{projectId}/products/{productId}/image")
    public ProductResponse deleteProductImage(@PathVariable UUID projectId, @PathVariable UUID productId) {
        return service.deleteProductImage(projectId, productId);
    }
}
