package com.alsorg.packing.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.alsorg.packing.domain.logistics.Vehicle;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.VehicleService;

@RestController
@RequestMapping("/api/logistics/vehicles")
public class VehicleController {

    private final VehicleService service;
    private final CurrentUserService currentUserService;

    public VehicleController(
            VehicleService service,
            CurrentUserService currentUserService) {

        this.service = service;
        this.currentUserService =
                currentUserService;
    }

    @PostMapping
    public ResponseEntity<?> create(
            @RequestBody Vehicle vehicle,
            @RequestHeader(
                    value = "Authorization",
                    required = false)
            String auth,
            @RequestHeader(
                    value = "X-Client-Type",
                    required = false)
            String clientType) {

        User user = currentUserService
                .getCurrentUserFromAuth(auth);

        if (!currentUserService.isAdmin(user)
                && !currentUserService.isDispatch(user)
                && !currentUserService.isLogistics(user)) {

            return ResponseEntity
                    .status(403)
                    .body(
                            "Only ADMIN, DISPATCH or LOGISTICS can create vehicles");
        }

        boolean mobileClient =
                "mobile".equalsIgnoreCase(
                        String.valueOf(clientType)
                                .trim());

        /*
         * Mobile quick-create can omit vehicleType.
         * Normal web creation still requires it.
         */
        return ResponseEntity.ok(
                service.create(
                        vehicle,
                        mobileClient));
    }

    @GetMapping
    public List<Vehicle> getAll() {
        return service.getAll();
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(
            @PathVariable UUID id,
            @RequestBody Vehicle vehicle,
            @RequestHeader(
                    value = "Authorization",
                    required = false)
            String auth) {

        User user = currentUserService
                .getCurrentUserFromAuth(auth);

        if (!currentUserService.isAdmin(user)
                && !currentUserService.isLogistics(user)) {

            return ResponseEntity
                    .status(403)
                    .body(
                            "Only ADMIN or LOGISTICS can update vehicles");
        }

        return ResponseEntity.ok(
                service.update(
                        id,
                        vehicle));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(
            @PathVariable UUID id,
            @RequestHeader(
                    value = "Authorization",
                    required = false)
            String auth) {

        User user = currentUserService
                .getCurrentUserFromAuth(auth);

        if (!currentUserService.isAdmin(user)
                && !currentUserService.isLogistics(user)) {

            return ResponseEntity
                    .status(403)
                    .body(
                            "Only ADMIN or LOGISTICS can delete vehicles");
        }

        service.delete(id);

        return ResponseEntity
                .noContent()
                .build();
    }
}