package com.alsorg.packing.controller.dto;

import java.util.List;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class CreateItemRequest {

    @Size(max = 500, message = "Item name cannot exceed 500 characters.")
    public String itemName;

    @Size(max = 255, message = "PD number cannot exceed 255 characters.")
    public String pdNo;

    @Size(max = 255, message = "Drawing number cannot exceed 255 characters.")
    public String drawingNo;

    @Size(max = 500, message = "Client name cannot exceed 500 characters.")
    public String clientName;

    @Size(max = 2000, message = "Client address cannot exceed 2000 characters.")
    public String clientAddress;

    @Size(max = 100, message = "Floor cannot exceed 100 characters.")
    public String floor;

    /*
     * Optional business packing date selected from Inventory.
     *
     * Expected frontend format:
     * yyyy-MM-dd
     *
     * Examples:
     * 2026-08-15
     * 2026-08-10
     *
     * When null/blank, PacketService keeps backward compatibility
     * and defaults the packing date to today's date in Asia/Kolkata.
     */
    @Pattern(
            regexp = "^\\s*$|^\\d{4}-\\d{2}-\\d{2}$",
            message = "Packing date must use yyyy-MM-dd format.")
    private String packingDate;

    /*
     * This DTO is also reused by custom-packet routes where numberOfPackets is
     * intentionally left at zero. Therefore only the upper bound belongs here;
     * normal-packet services continue to enforce > 0 for their own workflow.
     */
    @Max(value = 500, message = "A maximum of 500 packets can be created at once.")
    public int numberOfPackets;

    @Size(max = 500, message = "A maximum of 500 descriptions is allowed.")
    private List<@Size(max = 5000, message = "A packet description cannot exceed 5000 characters.") String> descriptions;

    @Size(max = 500, message = "Dimensions cannot exceed 500 characters.")
    public String dimensions;

    @Size(max = 200, message = "Weight cannot exceed 200 characters.")
    public String weight;

    @Size(max = 2000, message = "Remarks cannot exceed 2000 characters.")
    public String remarks;

    @Size(max = 500, message = "A maximum of 500 packet weights is allowed.")
    private List<@Size(max = 200, message = "A packet weight cannot exceed 200 characters.") String> weights;

    @Size(max = 500, message = "A maximum of 500 packet dimensions is allowed.")
    private List<@Size(max = 500, message = "A packet dimension cannot exceed 500 characters.") String> dimensionsList;

    @Size(max = 500, message = "A maximum of 500 packet remarks is allowed.")
    private List<@Size(max = 2000, message = "A packet remark cannot exceed 2000 characters.") String> remarksList;

    @Min(value = 1, message = "Custom packet number must be at least 1.")
    @Max(value = 1000000, message = "Custom packet number is too large.")
    private Integer customPacketNumber;

    @Size(max = 100, message = "Plant code cannot exceed 100 characters.")
    public String plantCode;

    // =====================================================
    // PLANT
    // =====================================================

    public String getPlantCode() {
        return plantCode;
    }

    public void setPlantCode(
            String plantCode) {
        this.plantCode = plantCode;
    }

    // =====================================================
    // PACKING DATE
    // =====================================================

    public String getPackingDate() {
        return packingDate;
    }

    public void setPackingDate(
            String packingDate) {
        this.packingDate = packingDate;
    }

    // =====================================================
    // BASIC ITEM DETAILS
    // =====================================================

    public String getItemName() {
        return itemName;
    }

    public void setItemName(
            String itemName) {
        this.itemName = itemName;
    }

    public String getPdNo() {
        return pdNo;
    }

    public void setPdNo(
            String pdNo) {
        this.pdNo = pdNo;
    }

    public String getDrawingNo() {
        return drawingNo;
    }

    public void setDrawingNo(
            String drawingNo) {
        this.drawingNo = drawingNo;
    }

    public String getClientName() {
        return clientName;
    }

    public void setClientName(
            String clientName) {
        this.clientName = clientName;
    }

    public String getClientAddress() {
        return clientAddress;
    }

    public void setClientAddress(
            String clientAddress) {
        this.clientAddress = clientAddress;
    }

    public String getFloor() {
        return floor;
    }

    public void setFloor(
            String floor) {
        this.floor = floor;
    }

    // =====================================================
    // PACKET COUNT
    // =====================================================

    public int getNumberOfPackets() {
        return numberOfPackets;
    }

    public void setNumberOfPackets(
            int numberOfPackets) {
        this.numberOfPackets = numberOfPackets;
    }

    // =====================================================
    // LEGACY / SINGLE VALUES
    // =====================================================

    public String getDimensions() {
        return dimensions;
    }

    public void setDimensions(
            String dimensions) {
        this.dimensions = dimensions;
    }

    public String getWeight() {
        return weight;
    }

    public void setWeight(
            String weight) {
        this.weight = weight;
    }

    public String getRemarks() {
        return remarks;
    }

    public void setRemarks(
            String remarks) {
        this.remarks = remarks;
    }

    // =====================================================
    // PACKET-WISE DETAILS
    // =====================================================

    public List<String> getDescriptions() {
        return descriptions;
    }

    public void setDescriptions(
            List<String> descriptions) {
        this.descriptions = descriptions;
    }

    public List<String> getWeights() {
        return weights;
    }

    public void setWeights(
            List<String> weights) {
        this.weights = weights;
    }

    public List<String> getDimensionsList() {
        return dimensionsList;
    }

    public void setDimensionsList(
            List<String> dimensionsList) {
        this.dimensionsList = dimensionsList;
    }

    public List<String> getRemarksList() {
        return remarksList;
    }

    public void setRemarksList(
            List<String> remarksList) {
        this.remarksList = remarksList;
    }

    // =====================================================
    // CUSTOM PACKET
    // =====================================================

    public Integer getCustomPacketNumber() {
        return customPacketNumber;
    }

    public void setCustomPacketNumber(
            Integer customPacketNumber) {
        this.customPacketNumber = customPacketNumber;
    }
}
