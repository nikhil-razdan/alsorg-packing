package com.alsorg.packing.controller;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.ZohoItemCacheService;

@RestController
@RequestMapping("/api/zoho")
public class ZohoController {

    private final ZohoItemCacheService cacheService;
    private final CurrentUserService currentUserService;

    public ZohoController(
            ZohoItemCacheService cacheService,
            CurrentUserService currentUserService) {
        this.cacheService = cacheService;
        this.currentUserService = currentUserService;
    }

    @PostMapping("/refresh")
    public ResponseEntity<Map<String, String>> refresh() {
        User user = currentUserService.requireCurrentUser();

        if (!currentUserService.hasAnyRole(user, "ADMIN", "PACKING")) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only ADMIN or PACKING can refresh the Zoho cache");
        }

        cacheService.refreshCache();
        return ResponseEntity.ok(Map.of("message", "Cache refresh requested"));
    }
}
