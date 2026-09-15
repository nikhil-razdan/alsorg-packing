package com.alsorg.packing.controller.matflow;

import static com.alsorg.packing.controller.dto.matflow.MatFlowProjectDtos.*;

import com.alsorg.packing.service.matflow.MatFlowProjectService;
import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/matflow/projects")
@PreAuthorize("isAuthenticated()")
public class MatFlowProjectController {
    private final MatFlowProjectService service;
    public MatFlowProjectController(MatFlowProjectService service){this.service=service;}

    @GetMapping public List<ProjectResponse> list(@RequestParam(required=false)String search,@RequestParam(required=false)Boolean active,@RequestParam(required=false)String plantCode){return service.list(search,active,plantCode);}
    @GetMapping("/{projectId}") public ProjectResponse get(@PathVariable UUID projectId){return service.get(projectId);}
    @PostMapping public ProjectResponse create(@Valid @RequestBody ProjectRequest request){return service.create(request);}
    @PutMapping("/{projectId}") public ProjectResponse update(@PathVariable UUID projectId,@Valid @RequestBody ProjectRequest request){return service.update(projectId,request);}
    @DeleteMapping("/{projectId}") public ProjectResponse deactivate(@PathVariable UUID projectId,@RequestParam Long rowVersion){return service.deactivateProject(projectId,rowVersion);}
    @PostMapping("/{projectId}/products") public ProjectResponse addProduct(@PathVariable UUID projectId,@Valid @RequestBody ProductRequest request){return service.addProduct(projectId,request);}
    @PostMapping("/{projectId}/products/bulk") public ProjectResponse addProducts(@PathVariable UUID projectId,@Valid @RequestBody ProductBulkCreateRequest request){return service.addProducts(projectId,request);}
    @PutMapping("/{projectId}/products/{productId}") public ProjectResponse updateProduct(@PathVariable UUID projectId,@PathVariable UUID productId,@Valid @RequestBody ProductRequest request){return service.updateProduct(projectId,productId,request);}
    @DeleteMapping("/{projectId}/products/{productId}") public ProjectResponse deactivateProduct(@PathVariable UUID projectId,@PathVariable UUID productId,@RequestParam Long rowVersion){return service.deactivateProduct(projectId,productId,rowVersion);}

    @PostMapping(value="/{projectId}/products/{productId}/image",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public ProductResponse uploadImage(@PathVariable UUID projectId,@PathVariable UUID productId,@RequestParam("file")MultipartFile file){return service.uploadProductImage(projectId,productId,file);}
    @GetMapping("/{projectId}/products/{productId}/image")
    public ResponseEntity<Resource> image(@PathVariable UUID projectId,@PathVariable UUID productId){
        Resource resource=service.loadProductImage(projectId,productId); MediaType type; try{type=MediaType.parseMediaType(service.productImageContentType(projectId,productId));}catch(Exception ex){type=MediaType.APPLICATION_OCTET_STREAM;}
        String name=service.productImageFileName(projectId,productId); if(name==null||name.isBlank())name="product-image";
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(type).header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.inline().filename(name,StandardCharsets.UTF_8).build().toString()).body(resource);
    }
    @DeleteMapping("/{projectId}/products/{productId}/image") public ProductResponse deleteImage(@PathVariable UUID projectId,@PathVariable UUID productId){return service.deleteProductImage(projectId,productId);}
}
