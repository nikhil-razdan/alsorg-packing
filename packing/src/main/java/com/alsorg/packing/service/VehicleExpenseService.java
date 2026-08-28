package com.alsorg.packing.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.config.TimeZoneConfig;
import com.alsorg.packing.controller.dto.logistics.VehicleExpenseRequest;
import com.alsorg.packing.domain.logistics.Vehicle;
import com.alsorg.packing.domain.logistics.VehicleExpense;
import com.alsorg.packing.domain.logistics.VehicleExpenseField;
import com.alsorg.packing.repository.VehicleExpenseRepository;
import com.alsorg.packing.repository.VehicleRepository;

@Service
public class VehicleExpenseService {

    private static final int MAX_FIELDS = 100;
    private static final int MAX_FIELD_NAME_LENGTH = 120;
    private static final int MAX_FIELD_VALUE_LENGTH = 500;
    private static final int MAX_NOTES_LENGTH = 2000;

    private final VehicleExpenseRepository expenseRepository;
    private final VehicleRepository vehicleRepository;

    public VehicleExpenseService(
            VehicleExpenseRepository expenseRepository,
            VehicleRepository vehicleRepository) {
        this.expenseRepository = expenseRepository;
        this.vehicleRepository = vehicleRepository;
    }

    @Transactional(readOnly = true)
    public List<VehicleExpense> getByVehicle(
            UUID vehicleId) {
        requireVehicleId(vehicleId);

        /*
         * Compatibility list endpoint retained. A paged repository/controller
         * contract should replace this list when the VehicleExpense persistence
         * batch is supplied.
         */
        return expenseRepository
                .findByVehicle_IdOrderByExpenseMonthDescCreatedAtDesc(
                        vehicleId);
    }

    @Transactional
    public VehicleExpense create(
            UUID vehicleId,
            VehicleExpenseRequest request) {
        requireVehicleId(vehicleId);

        if (request == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vehicle expense request is required");
        }

        Vehicle vehicle = vehicleRepository.findById(vehicleId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Vehicle not found"));

        VehicleExpense expense = new VehicleExpense();
        expense.setVehicle(vehicle);
        expense.setExpenseMonth(
                normalizeMonth(request.getExpenseMonth()));
        expense.setNotes(
                cleanLimited(
                        request.getNotes(),
                        MAX_NOTES_LENGTH,
                        "Notes"));
        expense.setFields(
                normalizeFields(request.getFields()));
        expense.setTotalAmount(
                calculateTotal(expense.getFields()));

        return expenseRepository.save(expense);
    }

    private LocalDate normalizeMonth(
            LocalDate value) {
        LocalDate resolved = value == null
                ? LocalDate.now(TimeZoneConfig.APP_ZONE)
                : value;

        return resolved.withDayOfMonth(1);
    }

    private List<VehicleExpenseField> normalizeFields(
            List<VehicleExpenseField> fields) {
        if (fields == null || fields.isEmpty()) {
            return List.of();
        }

        if (fields.size() > MAX_FIELDS) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "A maximum of " + MAX_FIELDS
                            + " expense fields can be submitted at once");
        }

        List<VehicleExpenseField> result = new ArrayList<>();

        for (VehicleExpenseField field : fields) {
            if (field == null) {
                continue;
            }

            String fieldName = cleanLimited(
                    field.getFieldName(),
                    MAX_FIELD_NAME_LENGTH,
                    "Expense field name");

            if (fieldName == null) {
                continue;
            }

            VehicleExpenseField normalized = new VehicleExpenseField();
            normalized.setFieldName(fieldName);
            normalized.setFieldType(
                    normalizeType(field.getFieldType()));
            normalized.setFieldValue(
                    cleanLimited(
                            field.getFieldValue(),
                            MAX_FIELD_VALUE_LENGTH,
                            "Expense field value"));

            result.add(normalized);
        }

        return List.copyOf(result);
    }

    private String normalizeType(
            String value) {
        if (value == null || value.trim().isBlank()) {
            return "TEXT";
        }

        String type = value.trim().toUpperCase();

        return "NUMBER".equals(type)
                ? "NUMBER"
                : "TEXT";
    }

    private BigDecimal calculateTotal(
            List<VehicleExpenseField> fields) {
        BigDecimal total = BigDecimal.ZERO;

        if (fields == null) {
            return total;
        }

        for (VehicleExpenseField field : fields) {
            if (field == null
                    || !"NUMBER".equalsIgnoreCase(
                            field.getFieldType())) {
                continue;
            }

            String value = field.getFieldValue();

            if (value == null || value.isBlank()) {
                continue;
            }

            try {
                total = total.add(
                        new BigDecimal(value.trim()));
            } catch (NumberFormatException ignored) {
                /*
                 * Preserve the existing workflow: free-form invalid NUMBER fields
                 * remain visible to the user but do not corrupt the stored total.
                 */
            }
        }

        return total;
    }

    private void requireVehicleId(
            UUID vehicleId) {
        if (vehicleId == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vehicle id is required");
        }
    }

    private String cleanLimited(
            String value,
            int maxLength,
            String label) {
        if (value == null) {
            return null;
        }

        String cleaned = value.trim();

        if (cleaned.isBlank()) {
            return null;
        }

        if (cleaned.length() > maxLength) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    label + " cannot exceed "
                            + maxLength + " characters");
        }

        return cleaned;
    }
}
