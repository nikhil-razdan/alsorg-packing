package com.alsorg.packing.hrflow.controller;

import com.alsorg.packing.hrflow.dto.HrAccessDtos;
import com.alsorg.packing.hrflow.service.HrAccessGrantService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/hrflow/access-grants")
public class HrAccessController {

    private final HrAccessGrantService service

    public HrAccessController(HrAccessGrantService service) {
        this.service = service;
    }

    @GetMapping
    public List<HrAccessDtos.AccessGrantResponse> list() {
        return service.list();
    }

    @PostMapping
    public HrAccessDtos.AccessGrantResponse grant(@Valid @RequestBody HrAccessDtos.GrantAccessRequest request) {
        return service.grant(request);
    }

    @DeleteMapping("/{id}")
    public HrAccessDtos.AccessGrantResponse revoke(@PathVariable UUID id) {
        return service.revoke(id);
    }
}
