package com.alsorg.packing.controller.dto.logistics;

import java.time.LocalDateTime;

public class EndTripRequest {

    private LocalDateTime tripEnd;

    private String remarks;

    public LocalDateTime getTripEnd() {
        return tripEnd;
    }

    public void setTripEnd(LocalDateTime tripEnd) {
        this.tripEnd = tripEnd;
    }

    public String getRemarks() {
        return remarks;
    }

    public void setRemarks(String remarks) {
        this.remarks = remarks;
    }
}