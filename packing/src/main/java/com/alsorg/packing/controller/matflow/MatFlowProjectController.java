package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowProjectDtos.ProductBulkCreateRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProjectDtos.ProductRequest;
import com.alsorg.packing.controller.dto.matflow.MatFlowProjectDtos.ProjectPortfolioResponse;
import com.alsorg.packing.controller.dto.matflow.MatFlowProjectDtos.ProjectRequest;
import com.alsorg.packing.service.matflow.MatFlowProjectService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
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

/** Canonical approval-free Project -> Products aggregate API. */
@RestController
@RequestMapping("/api/matflow/projects")
@PreAuthorize("isAuthenticated()")
public class MatFlowProjectController {

    private final MatFlowProjectService service;

    public MatFlowProjectController(MatFlowProjectService service) {
        this.service = service;
    }

    @GetMapping
    public List<ProjectPortfolioResponse> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) String plantCode) {
        return service.list(search, active, plantCode);
    }

    @GetMapping("/{projectId}")
    public ProjectPortfolioResponse get(@PathVariable UUID projectId) {
        return service.get(projectId);
    }

    @PostMapping
    public ProjectPortfolioResponse create(@Valid @RequestBody ProjectRequest request) {
        return service.create(request);
    }

    @PutMapping("/{projectId}")
    public ProjectPortfolioResponse update(
            @PathVariable UUID projectId,
            @Valid @RequestBody ProjectRequest request) {
        return service.update(projectId, request);
    }

    @DeleteMapping("/{projectId}")
    public void deleteProject(
            @PathVariable UUID projectId,
            @RequestParam Long rowVersion) {
        service.deleteProject(projectId, rowVersion);
    }

    @PostMapping("/{projectId}/products")
    public ProjectPortfolioResponse addProduct(
            @PathVariable UUID projectId,
            @Valid @RequestBody ProductRequest request) {
        return service.addProduct(projectId, request);
    }

    @PostMapping("/{projectId}/products/bulk")
    public ProjectPortfolioResponse addProducts(
            @PathVariable UUID projectId,
            @Valid @RequestBody ProductBulkCreateRequest request) {
        return service.addProducts(projectId, request.products());
    }

    @PutMapping("/{projectId}/products/{productId}")
    public ProjectPortfolioResponse updateProduct(
            @PathVariable UUID projectId,
            @PathVariable UUID productId,
            @Valid @RequestBody ProductRequest request) {
        return service.updateProduct(projectId, productId, request);
    }

    @GetMapping("/{projectId}/product-attachments")
    public List<Map<String, Object>> productAttachments(
            @PathVariable UUID projectId) {
        return service.productAttachments(projectId);
    }

    @GetMapping("/{projectId}/products/{productId}/attachments")
    public Map<String, Object> productAttachmentStatus(
            @PathVariable UUID projectId,
            @PathVariable UUID productId) {
        return service.productAttachmentStatus(projectId, productId);
    }

    @PostMapping(
            value = "/{projectId}/products/{productId}/image",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> uploadProductImage(
            @PathVariable UUID projectId,
            @PathVariable UUID productId,
            @RequestPart("file") MultipartFile file) {
        return service.saveProductImage(projectId, productId, file);
    }

    @GetMapping("/{projectId}/products/{productId}/image")
    public ResponseEntity<Resource> productImage(
            @PathVariable UUID projectId,
            @PathVariable UUID productId) {

        Resource resource = service.loadProductImage(projectId, productId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(
                        service.productImageContentType(projectId, productId)))
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\""
                                + service.productImageFileName(projectId, productId)
                                        .replace("\"", "")
                                + "\"")
                .body(resource);
    }

    @DeleteMapping("/{projectId}/products/{productId}/image")
    public Map<String, Object> deleteProductImage(
            @PathVariable UUID projectId,
            @PathVariable UUID productId) {
        return service.deleteProductImage(projectId, productId);
    }

    @PostMapping(
            value = "/{projectId}/products/{productId}/drawing",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> uploadProductDrawing(
            @PathVariable UUID projectId,
            @PathVariable UUID productId,
            @RequestPart("file") MultipartFile file) {
        return service.saveProductDrawing(projectId, productId, file);
    }

    @GetMapping("/{projectId}/products/{productId}/drawing")
    public ResponseEntity<Resource> productDrawing(
            @PathVariable UUID projectId,
            @PathVariable UUID productId) {

        Resource resource = service.loadProductDrawing(projectId, productId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(
                        service.productDrawingContentType(projectId, productId)))
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\""
                                + service.productDrawingFileName(projectId, productId)
                                        .replace("\"", "")
                                + "\"")
                .body(resource);
    }

    @DeleteMapping("/{projectId}/products/{productId}/drawing")
    public Map<String, Object> deleteProductDrawing(
            @PathVariable UUID projectId,
            @PathVariable UUID productId) {
        return service.deleteProductDrawing(projectId, productId);
    }

    @DeleteMapping("/{projectId}/products/{productId}")
    public ProjectPortfolioResponse deleteProduct(
            @PathVariable UUID projectId,
            @PathVariable UUID productId,
            @RequestParam Long rowVersion) {
        return service.deleteProduct(projectId, productId, rowVersion);
    }
}
