package com.alsorg.packing.controller.dto.logistics;

public class UpdateShiftStatusRequest {

    private String status;

    public String getStatus() {
        return status;
    }

    public void setStatus(
            String status
    ) {
        this.status = status;
    }
}