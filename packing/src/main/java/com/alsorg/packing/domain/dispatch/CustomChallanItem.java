package com.alsorg.packing.domain.dispatch;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "custom_challan_items")
public class CustomChallanItem {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "challan_number")
    private CustomChallan challan;

    @Column(name = "description", length = 1000)
    private String description;

    @Column(name = "drawing_no", length = 120)
    private String drawingNo;

    @Column(name = "quantity")
    private Double quantity;

    @Column(name = "uom", length = 30)
    private String uom;

    @Column(name = "returnable")
    private Boolean returnable;

    @Column(name = "remarks", length = 1000)
    private String remarks;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public CustomChallan getChallan() {
        return challan;
    }

    public void setChallan(CustomChallan challan) {
        this.challan = challan;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getDrawingNo() {
        return drawingNo;
    }

    public void setDrawingNo(String drawingNo) {
        this.drawingNo = drawingNo;
    }

    public Double getQuantity() {
        return quantity;
    }

    public String getUom() {
        return uom;
    }

    public void setUom(String uom) {
        this.uom = uom;
    }

    public void setQuantity(Double quantity) {
        this.quantity = quantity;
    }

    public Boolean getReturnable() {
        return returnable;
    }

    public void setReturnable(Boolean returnable) {
        this.returnable = returnable;
    }

    public String getRemarks() {
        return remarks;
    }

    public void setRemarks(String remarks) {
        this.remarks = remarks;
    }
}