package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowMaterialRegisterDtos.MaterialRegisterResponse;
import com.alsorg.packing.service.matflow.MatFlowMaterialRegisterService;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/matflow")
@PreAuthorize("isAuthenticated()")
public class MatFlowMaterialRegisterController {
    private final MatFlowMaterialRegisterService service;

    public MatFlowMaterialRegisterController(MatFlowMaterialRegisterService service) {
        this.service = service;
    }

    @GetMapping("/material-register")
    public MaterialRegisterResponse register(
            @RequestParam(required = false) String plantCode,
            @RequestParam(required = false) String search) {
        return service.register(plantCode, search);
    }
}
