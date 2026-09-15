package com.alsorg.packing.controller.matflow;

import static com.alsorg.packing.controller.dto.matflow.MatFlowBomDtos.*;
import com.alsorg.packing.service.matflow.MatFlowBomService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/matflow/boms")
@PreAuthorize("isAuthenticated()")
public class MatFlowBomController {
    private final MatFlowBomService service;
    public MatFlowBomController(MatFlowBomService service){this.service=service;}
    @GetMapping public List<BomResponse> list(@RequestParam(required=false)String search,@RequestParam(required=false)String status,@RequestParam(required=false)UUID productionFileId){return service.list(search,status,productionFileId);}
    @GetMapping("/{id}") public BomResponse get(@PathVariable UUID id){return service.get(id);}
    @PostMapping public BomResponse create(@Valid @RequestBody BomCreateRequest request){return service.create(request);}
    @PutMapping("/{id}") public BomResponse update(@PathVariable UUID id,@Valid @RequestBody BomUpdateRequest request){return service.update(id,request);}
    @PostMapping("/{id}/lines") public BomResponse addLine(@PathVariable UUID id,@Valid @RequestBody BomLineRequest request){return service.addLine(id,request);}
    @PutMapping("/{id}/lines/{lineId}") public BomResponse updateLine(@PathVariable UUID id,@PathVariable UUID lineId,@Valid @RequestBody BomLineRequest request){return service.updateLine(id,lineId,request);}
    @DeleteMapping("/{id}/lines/{lineId}") public BomResponse deleteLine(@PathVariable UUID id,@PathVariable UUID lineId,@RequestParam Long rowVersion){return service.deleteLine(id,lineId,rowVersion);}
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void deleteDraft(@PathVariable UUID id,@RequestParam Long rowVersion){service.deleteDraft(id,rowVersion);}
    @PostMapping("/{id}/submit") public BomResponse submit(@PathVariable UUID id,@Valid @RequestBody BomActionRequest request){return service.submit(id,request);}
    @PostMapping("/{id}/revisions") public BomResponse revision(@PathVariable UUID id,@Valid @RequestBody BomActionRequest request){return service.createRevision(id,request);}
}
