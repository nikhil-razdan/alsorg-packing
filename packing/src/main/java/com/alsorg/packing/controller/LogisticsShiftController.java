package com.alsorg.packing.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.controller.dto.logistics.CreateShiftRequest;
import com.alsorg.packing.controller.dto.logistics.UpdateShiftStatusRequest;
import com.alsorg.packing.domain.logistics.LogisticsShift;
import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.service.LogisticsShiftService;

@RestController
@RequestMapping("/api/logistics/shifts")
public class LogisticsShiftController {

    private static final int MAX_PAGE_SIZE = 100;

    private final LogisticsShiftService service;
    private final CurrentUserService currentUserService;

    public LogisticsShiftController(
            LogisticsShiftService service,
            CurrentUserService currentUserService) {
        this.service = service;
        this.currentUserService = currentUserService;
    }

    @PostMapping
    public LogisticsShift createShift(
            @RequestBody CreateShiftRequest request) {
        User user = currentUserService.requireCurrentUser();
        requireManageAccess(user);
        return service.createShift(request);
    }

    /**
     * Legacy compatibility endpoint. New large-register callers should use
     * `/search` so the database query remains bounded.
     */
    @GetMapping
    public List<LogisticsShift> getAll() {
        User user = currentUserService.requireCurrentUser();
        requireViewAccess(user);
        return service.getAllShifts();
    }

    @GetMapping("/search")
    public Page<LogisticsShift> search(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        User user = currentUserService.requireCurrentUser();
        requireViewAccess(user);

        return service.getShifts(
                PageRequest.of(
                        Math.max(0, page),
                        Math.max(1, Math.min(size, MAX_PAGE_SIZE)),
                        Sort.by(Sort.Direction.DESC, "shiftStart")));
    }

    @PutMapping("/{id}")
    public LogisticsShift updateShift(
            @PathVariable UUID id,
            @RequestBody CreateShiftRequest request) {
        User user = currentUserService.requireCurrentUser();
        requireManageAccess(user);
        return service.updateShift(id, request);
    }

    @PatchMapping("/{id}/status")
    public LogisticsShift updateShiftStatus(
            @PathVariable UUID id,
            @RequestBody UpdateShiftStatusRequest request) {
        User user = currentUserService.requireCurrentUser();
        requireManageAccess(user);
        return service.updateShiftStatus(id, request);
    }

    @DeleteMapping("/{id}")
    public void deleteShift(
            @PathVariable UUID id) {
        User user = currentUserService.requireCurrentUser();
        requireManageAccess(user);
        service.deleteShift(id);
    }

    private void requireViewAccess(User user) {
        if (!currentUserService.hasAnyRole(user, "ADMIN", "DISPATCH", "LOGISTICS")) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "You do not have permission to view logistics shifts");
        }
    }

    private void requireManageAccess(User user) {
        if (!currentUserService.hasAnyRole(user, "ADMIN", "LOGISTICS")) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only ADMIN or LOGISTICS can change logistics shifts");
        }
    }
}
