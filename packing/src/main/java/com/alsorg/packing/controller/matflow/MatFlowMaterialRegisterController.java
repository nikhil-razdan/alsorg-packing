package com.alsorg.packing.controller.matflow;

import com.alsorg.packing.controller.dto.matflow.MatFlowMaterialRegisterDtos.MaterialRegisterResponse;
import com.alsorg.packing.service.matflow.MatFlowMaterialRegisterService;

import java.time.LocalDateTime;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Period-filtered MatFlow usage register; not a physical stock register. */
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
            @RequestParam(required = false) String search,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {
        validateText(plantCode, 32, "Plant code");
        validateText(search, 300, "Search");
        if (from != null && to != null && to.isBefore(from)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "To date cannot be before From date");
        }
        return service.register(plantCode, search, from, to);
    }
    private void validateText(String value, int maxLength, String fieldName) {
        if (value != null && value.length() > maxLength) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    fieldName + " cannot exceed " + maxLength + " characters");
        }
    }

}
