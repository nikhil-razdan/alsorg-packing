package com.alsorg.packing.reporting.dto;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalTime;

@Entity
@Table(name = "report_schedule")
public class ReportSchedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String email;

    private String reportType;

    private LocalTime sendTime;

    private Boolean enabled = true;

    @Column(name = "last_sent")
    private LocalDate lastSent;

    // ===== GETTERS / SETTERS =====

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getReportType() {
        return reportType;
    }

    public void setReportType(String reportType) {
        this.reportType = reportType;
    }

    public LocalTime getSendTime() {
        return sendTime;
    }

    public void setSendTime(LocalTime sendTime) {
        this.sendTime = sendTime;
    }

    public Boolean getEnabled() {
        return enabled;
    }

    public void setEnabled(Boolean enabled) {
        this.enabled = enabled;
    }

    public LocalDate getLastSent() {
        return lastSent;
    }

    public void setLastSent(LocalDate lastSent) {
        this.lastSent = lastSent;
    }
}