package com.alsorg.packing.controller;

import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.domain.logistics.Vehicle;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.VehicleService;

@RestController
@RequestMapping("/api/logistics/vehicles")
public class VehicleController {

    private static final int MAX_PAGE_SIZE = 100;

    private final VehicleService service;
    private final CurrentUserService currentUserService;

    public VehicleController(
            VehicleService service,
            CurrentUserService currentUserService) {
        this.service = service;
        this.currentUserService = currentUserService;
    }

    @PostMapping
    public ResponseEntity<Vehicle> create(
            @RequestBody(required = false) Vehicle vehicle,
            @RequestHeader(value = "X-Client-Type", required = false) String clientType,
            HttpServletRequest request) {

        User user = currentUserService.requireCurrentUser();
        requireAnyRole(user, "ADMIN", "DISPATCH", "LOGISTICS");

        boolean mobileQuickCreate = isNativeMobileRequest(clientType, request);
        return ResponseEntity.ok(service.create(vehicle, mobileQuickCreate));
    }

    /**
     * Compatibility full-list endpoint used by existing dropdowns.
     */
    @GetMapping
    public ResponseEntity<?> getAll() {
        User user = currentUserService.requireCurrentUser();
        requireAnyRole(user, "ADMIN", "DISPATCH", "LOGISTICS", "DRIVER");
        return ResponseEntity.ok(service.getAll());
    }

    @GetMapping("/search")
    public Page<Vehicle> search(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        User user = currentUserService.requireCurrentUser();
        requireAnyRole(user, "ADMIN", "DISPATCH", "LOGISTICS", "DRIVER");

        return service.getPage(
                PageRequest.of(
                        Math.max(0, page),
                        Math.max(1, Math.min(size, MAX_PAGE_SIZE)),
                        Sort.by(Sort.Direction.ASC, "vehicleNumber")));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Vehicle> update(
            @PathVariable UUID id,
            @RequestBody(required = false) Vehicle vehicle) {
        User user = currentUserService.requireCurrentUser();
        requireAnyRole(user, "ADMIN", "LOGISTICS");
        return ResponseEntity.ok(service.update(id, vehicle));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable UUID id) {
        User user = currentUserService.requireCurrentUser();
        requireAnyRole(user, "ADMIN", "LOGISTICS");
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    private boolean isNativeMobileRequest(
            String clientType,
            HttpServletRequest request) {

        if (clientType == null || !"mobile".equalsIgnoreCase(clientType.trim())) {
            return false;
        }

        if (request == null) {
            return false;
        }

        String origin = request.getHeader("Origin");
        String referer = request.getHeader("Referer");

        /*
         * X-Client-Type is a compatibility hint, not an authentication boundary.
         * Browsers carrying Origin/Referer do not get the relaxed mobile-only
         * vehicle-type validation path.
         */
        return (origin == null || origin.isBlank())
                && (referer == null || referer.isBlank());
    }

    private void requireAnyRole(User user, String... roles) {
        if (!currentUserService.hasAnyRole(user, roles)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "You do not have permission to manage vehicles");
        }
    }
}
