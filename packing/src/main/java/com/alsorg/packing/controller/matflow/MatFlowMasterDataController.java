package com.alsorg.packing.controller.matflow;

import static com.alsorg.packing.controller.dto.matflow.MatFlowMasterDtos.*;
import com.alsorg.packing.service.matflow.MatFlowMasterDataService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/matflow/materials")
@PreAuthorize("isAuthenticated()")
public class MatFlowMasterDataController {
    private final MatFlowMasterDataService service;
    public MatFlowMasterDataController(MatFlowMasterDataService service){this.service=service;}
    @GetMapping public List<MaterialResponse> list(@RequestParam(required=false)String search,@RequestParam(required=false)Boolean active){return service.materials(search,active);}
    @PostMapping public MaterialResponse create(@Valid @RequestBody MaterialRequest request){return service.createMaterial(request);}
    @PutMapping("/{id}") public MaterialResponse update(@PathVariable UUID id,@Valid @RequestBody MaterialRequest request){return service.updateMaterial(id,request);}
}
