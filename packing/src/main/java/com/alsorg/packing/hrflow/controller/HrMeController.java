package com.alsorg.packing.hrflow.controller;

import com.alsorg.packing.hrflow.dto.HrAccessDtos;
import com.alsorg.packing.hrflow.security.HrAccessService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/hrflow/me")
public class HrMeController {

    private final HrAccessService accessService;

    public HrMeController(HrAccessService accessService) {
        this.accessService = accessService;
    }

    @GetMapping
    public HrAccessDtos.MyAccessResponse me() {
        return new HrAccessDtos.MyAccessResponse(
                accessService.actor(),
                accessService.isGlobalAdmin(),
                accessService.allowed(),
                accessService.currentRoles()
        );
    }
}
