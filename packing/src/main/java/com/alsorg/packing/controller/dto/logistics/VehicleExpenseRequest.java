package com.alsorg.packing.controller.dto.logistics;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import com.alsorg.packing.domain.logistics.VehicleExpenseField;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

public class VehicleExpenseRequest {

    private LocalDate expenseMonth;

    @Size(max = 4000, message = "Expense notes cannot exceed 4000 characters.")
    private String notes;

    @Size(max = 100, message = "A maximum of 100 expense fields is allowed.")
    private List<@Valid VehicleExpenseField> fields = new ArrayList<>();

    public LocalDate getExpenseMonth() {
        return expenseMonth;
    }

    public void setExpenseMonth(LocalDate expenseMonth) {
        this.expenseMonth = expenseMonth;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public List<VehicleExpenseField> getFields() {
        return fields;
    }

    public void setFields(List<VehicleExpenseField> fields) {
        this.fields = fields != null
                ? fields
                : new ArrayList<>();
    }
}
