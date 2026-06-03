package com.alsorg.packing.reporting.dto;

public class DailyThroughputUserDTO {

    private String username;

    private long count;

    public DailyThroughputUserDTO() {}

    public DailyThroughputUserDTO(String username, Long count) {
        this.username =
                username != null && !username.isBlank()
                        ? username
                        : "UNKNOWN";

        this.count = count != null ? count : 0;
    }

    public DailyThroughputUserDTO(String username, long count) {
        this.username =
                username != null && !username.isBlank()
                        ? username
                        : "UNKNOWN";

        this.count = count;
    }

    public String getUsername() {
        return username;
    }

    public long getCount() {
        return count;
    }
}