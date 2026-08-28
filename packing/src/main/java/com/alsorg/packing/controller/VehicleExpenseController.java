package com.alsorg.packing.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.controller.dto.logistics.VehicleExpenseRequest;
import com.alsorg.packing.domain.logistics.VehicleExpense;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.VehicleExpenseService;

@RestController
@RequestMapping("/api/logistics/vehicles/{vehicleId}/expenses")
public class VehicleExpenseController {

    private final VehicleExpenseService service;
    private final CurrentUserService currentUserService;

    public VehicleExpenseController(
            VehicleExpenseService service,
            CurrentUserService currentUserService) {
        this.service = service;
        this.currentUserService = currentUserService;
    }

    @GetMapping
    public List<VehicleExpense> getByVehicle(
            @PathVariable UUID vehicleId) {
        User user = currentUserService.requireCurrentUser();
        requireExpenseAccess(user);
        return service.getByVehicle(vehicleId);
    }

    @PostMapping
    public VehicleExpense create(
            @PathVariable UUID vehicleId,
            @RequestBody(required = false) VehicleExpenseRequest request) {
        User user = currentUserService.requireCurrentUser();
        requireExpenseAccess(user);
        return service.create(vehicleId, request);
    }

    private void requireExpenseAccess(User user) {
        if (!currentUserService.hasAnyRole(user, "ADMIN", "LOGISTICS")) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only ADMIN or LOGISTICS can access vehicle expenses");
        }
    }
}
