package com.alsorg.packing.controller.dto.logistics;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class UpdateShiftStatusRequest {

    @NotBlank(message = "Shift status is required.")
    @Size(max = 40, message = "Shift status cannot exceed 40 characters.")
    private String status;

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
