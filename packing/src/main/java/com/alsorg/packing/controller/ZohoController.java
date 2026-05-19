package com.alsorg.packing.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.alsorg.packing.service.ZohoItemCacheService;

@RestController
@RequestMapping("/api/zoho")
public class ZohoController {

    private final ZohoItemCacheService cacheService;

    public ZohoController(ZohoItemCacheService cacheService) {
        this.cacheService = cacheService;
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh() {
        cacheService.refreshCache();
        return ResponseEntity.ok(Map.of("message", "Cache refreshed"));
    }
}