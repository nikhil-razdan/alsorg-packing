package com.alsorg.packing.domain.dispatch;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "custom_challans")
public class CustomChallan {

    @Id
    @Column(name = "challan_number", length = 80)
    private String challanNumber;

    @Column(name = "challan_type", length = 80)
    private String challanType;

    @Column(name = "from_location", length = 255)
    private String fromLocation;

    @Column(name = "to_location", length = 255)
    private String toLocation;

    @Column(name = "pd_no", length = 120)
    private String pdNo;

    @Column(name = "project_name", length = 255)
    private String projectName;

    @Column(name = "client_name", length = 255)
    private String clientName;

    @Column(name = "client_address", length = 1000)
    private String clientAddress;

    @Column(name = "purpose", length = 1200)
    private String purpose;

    @Column(name = "movement_mode", length = 80)
    private String movementMode;

    @Column(name = "generated_by", length = 120)
    private String generatedBy;

    @Column(name = "generated_at")
    private LocalDateTime generatedAt;

    @OneToMany(
            mappedBy = "challan",
            cascade = CascadeType.ALL,
            orphanRemoval = true
    )
    private List<CustomChallanItem> items = new ArrayList<>();

    public String getChallanNumber() {
        return challanNumber;
    }

    public void setChallanNumber(String challanNumber) {
        this.challanNumber = challanNumber;
    }

    public String getChallanType() {
        return challanType;
    }

    public void setChallanType(String challanType) {
        this.challanType = challanType;
    }

    public String getFromLocation() {
        return fromLocation;
    }

    public void setFromLocation(String fromLocation) {
        this.fromLocation = fromLocation;
    }

    public String getToLocation() {
        return toLocation;
    }

    public void setToLocation(String toLocation) {
        this.toLocation = toLocation;
    }

    public String getPdNo() {
        return pdNo;
    }

    public void setPdNo(String pdNo) {
        this.pdNo = pdNo;
    }

    public String getProjectName() {
        return projectName;
    }

    public void setProjectName(String projectName) {
        this.projectName = projectName;
    }

    public String getClientName() {
        return clientName;
    }

    public void setClientName(String clientName) {
        this.clientName = clientName;
    }

    public String getClientAddress() {
        return clientAddress;
    }

    public void setClientAddress(String clientAddress) {
        this.clientAddress = clientAddress;
    }

    public String getPurpose() {
        return purpose;
    }

    public void setPurpose(String purpose) {
        this.purpose = purpose;
    }

    public String getMovementMode() {
        return movementMode;
    }

    public void setMovementMode(String movementMode) {
        this.movementMode = movementMode;
    }

    public String getGeneratedBy() {
        return generatedBy;
    }

    public void setGeneratedBy(String generatedBy) {
        this.generatedBy = generatedBy;
    }

    public LocalDateTime getGeneratedAt() {
        return generatedAt;
    }

    public void setGeneratedAt(LocalDateTime generatedAt) {
        this.generatedAt = generatedAt;
    }

    public List<CustomChallanItem> getItems() {
        return items;
    }

    public void setItems(List<CustomChallanItem> items) {
        this.items = items;
    }
}