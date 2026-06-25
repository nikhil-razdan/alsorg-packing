package com.alsorg.packing.domain.logistics;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.hibernate.annotations.CreationTimestamp;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;

@Entity
@Table(name = "vehicle_expenses")
public class VehicleExpense {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vehicle_id", nullable = false)
    @JsonIgnore
    private Vehicle vehicle;

    @Column(name = "expense_month", nullable = false)
    private LocalDate expenseMonth;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "total_amount")
    private BigDecimal totalAmount;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "vehicle_expense_fields",
            joinColumns = @JoinColumn(name = "expense_id")
    )
    @OrderColumn(name = "sort_order")
    private List<VehicleExpenseField> fields =
            new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    public UUID getId() {
        return id;
    }

    public Vehicle getVehicle() {
        return vehicle;
    }

    public void setVehicle(
            Vehicle vehicle
    ) {
        this.vehicle = vehicle;
    }

    public UUID getVehicleId() {
        return vehicle != null
                ? vehicle.getId()
                : null;
    }

    public LocalDate getExpenseMonth() {
        return expenseMonth;
    }

    public void setExpenseMonth(
            LocalDate expenseMonth
    ) {
        this.expenseMonth = expenseMonth;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(
            String notes
    ) {
        this.notes = notes;
    }

    public BigDecimal getTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(
            BigDecimal totalAmount
    ) {
        this.totalAmount = totalAmount;
    }

    public List<VehicleExpenseField> getFields() {
        return fields;
    }

    public void setFields(
            List<VehicleExpenseField> fields
    ) {
        this.fields =
                fields != null
                        ? fields
                        : new ArrayList<>();
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}