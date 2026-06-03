package com.alsorg.packing.reporting.dto;

public class DailyUserThroughputResponse {

    private String username;
    private Long count;

    public DailyUserThroughputResponse(String username, Long count) {
        this.username =
                username != null && !username.isBlank()
                        ? username
                        : "SYSTEM";

        this.count = count != null ? count : 0L;
    }

    public String getUsername() {
        return username;
    }

    public Long getCount() {
        return count;
    }
}