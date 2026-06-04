package com.alsorg.packing.reporting.dto;

import java.time.LocalDateTime;

public class CombinedReportRow {

    private String zohoItemId;
    private String itemName;
    private String clientName;

    private String packetNumber;
    private String packetName;

    private String eventType; // PACKED / DISPATCHED
    private LocalDateTime eventTime;
    private String performedBy;


    public CombinedReportRow(
            String zohoItemId,
            String itemName,
            String clientName,
            String eventType,
            LocalDateTime eventTime,
            String performedBy
    ) {
        this(
                zohoItemId,
                itemName,
                clientName,
                null,
                null,
                eventType,
                eventTime,
                performedBy
        );
    }


    public CombinedReportRow(
            String zohoItemId,
            String itemName,
            String clientName,
            String packetNumber,
            String packetName,
            String eventType,
            LocalDateTime eventTime,
            String performedBy
    ) {
        this.zohoItemId = zohoItemId;
        this.itemName = itemName;
        this.clientName = clientName;
        this.packetNumber = packetNumber;
        this.packetName = packetName;
        this.eventType = eventType;
        this.eventTime = eventTime;
        this.performedBy = performedBy;
    }

    public String getZohoItemId() {
        return zohoItemId;
    }

    public String getItemName() {
        return itemName;
    }

    public String getClientName() {
        return clientName;
    }

    public String getPacketNumber() {
        return packetNumber;
    }

    public String getPacketName() {
        return packetName;
    }

    public String getEventType() {
        return eventType;
    }

    public LocalDateTime getEventTime() {
        return eventTime;
    }

    public String getPerformedBy() {
        return performedBy;
    }
}