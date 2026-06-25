package com.alsorg.packing.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.alsorg.packing.controller.dto.logistics.VehicleExpenseRequest;
import com.alsorg.packing.domain.logistics.Vehicle;
import com.alsorg.packing.domain.logistics.VehicleExpense;
import com.alsorg.packing.domain.logistics.VehicleExpenseField;
import com.alsorg.packing.repository.VehicleExpenseRepository;
import com.alsorg.packing.repository.VehicleRepository;

@Service
public class VehicleExpenseService {

    private final VehicleExpenseRepository expenseRepository;

    private final VehicleRepository vehicleRepository;

    public VehicleExpenseService(
            VehicleExpenseRepository expenseRepository,
            VehicleRepository vehicleRepository
    ) {
        this.expenseRepository = expenseRepository;
        this.vehicleRepository = vehicleRepository;
    }

    public List<VehicleExpense> getByVehicle(
            UUID vehicleId
    ) {
        return expenseRepository
                .findByVehicle_IdOrderByExpenseMonthDescCreatedAtDesc(
                        vehicleId
                );
    }

    @Transactional
    public VehicleExpense create(
            UUID vehicleId,
            VehicleExpenseRequest request
    ) {
        Vehicle vehicle =
                vehicleRepository.findById(vehicleId)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Vehicle not found"
                                ));

        VehicleExpense expense =
                new VehicleExpense();

        expense.setVehicle(vehicle);

        expense.setExpenseMonth(
                normalizeMonth(
                        request.getExpenseMonth()
                )
        );

        expense.setNotes(
                clean(request.getNotes())
        );

        expense.setFields(
                normalizeFields(
                        request.getFields()
                )
        );

        expense.setTotalAmount(
                calculateTotal(
                        expense.getFields()
                )
        );

        return expenseRepository.save(expense);
    }

    private LocalDate normalizeMonth(
            LocalDate value
    ) {
        if (value == null) {
            return LocalDate.now()
                    .withDayOfMonth(1);
        }

        return value.withDayOfMonth(1);
    }

    private List<VehicleExpenseField> normalizeFields(
            List<VehicleExpenseField> fields
    ) {
        if (fields == null) {
            return List.of();
        }

        return fields.stream()
                .filter(field ->
                        field.getFieldName() != null &&
                                !field.getFieldName().trim().isBlank()
                )
                .map(field -> {
                    VehicleExpenseField clean =
                            new VehicleExpenseField();

                    clean.setFieldName(
                            clean(field.getFieldName())
                    );

                    clean.setFieldType(
                            normalizeType(
                                    field.getFieldType()
                            )
                    );

                    clean.setFieldValue(
                            clean(field.getFieldValue())
                    );

                    return clean;
                })
                .toList();
    }

    private String normalizeType(
            String value
    ) {
        if (
                value == null ||
                        value.trim().isBlank()
        ) {
            return "TEXT";
        }

        String type =
                value.trim().toUpperCase();

        return "NUMBER".equals(type)
                ? "NUMBER"
                : "TEXT";
    }

    private BigDecimal calculateTotal(
            List<VehicleExpenseField> fields
    ) {
        BigDecimal total =
                BigDecimal.ZERO;

        if (fields == null) {
            return total;
        }

        for (VehicleExpenseField field : fields) {
            if (!"NUMBER".equalsIgnoreCase(
                    field.getFieldType()
            )) {
                continue;
            }

            try {
                String value =
                        field.getFieldValue();

                if (value == null) {
                    continue;
                }

                total = total.add(
                        new BigDecimal(
                                value.trim()
                        )
                );
            } catch (Exception ignored) {
                // Ignore invalid number fields
            }
        }

        return total;
    }

    private String clean(
            String value
    ) {
        if (value == null) {
            return null;
        }

        String cleaned =
                value.trim();

        return cleaned.isBlank()
                ? null
                : cleaned;
    }
}