package com.alsorg.packing.service;

import com.alsorg.packing.domain.venflow.VenFlowEntry;
import com.alsorg.packing.domain.venflow.VenFlowPoStatus;
import com.alsorg.packing.domain.venflow.VenFlowProductionStatus;
import com.alsorg.packing.domain.venflow.VenFlowStage;
import com.alsorg.packing.domain.venflow.VenFlowStoreStatus;

import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.Set;

public final class VenFlowSpecifications {

    private VenFlowSpecifications() {
    }

    public static Specification<VenFlowEntry> visiblePlants(
            Set<String> plants,
            boolean allPlants) {

        return (root, query, cb) -> {
            if (allPlants) {
                return cb.conjunction();
            }

            if (plants == null || plants.isEmpty()) {
                return cb.disjunction();
            }

            return cb.upper(
                    root.<String>get("plantCode"))
                    .in(plants);
        };
    }

    public static Specification<VenFlowEntry> purchaseRequired() {
        return (root, query, cb) -> cb.greaterThan(
                root.<BigDecimal>get("toBeOrderedQty"),
                BigDecimal.ZERO);
    }

    public static Specification<VenFlowEntry> poStatusesIn(
            Collection<VenFlowPoStatus> statuses) {

        return (root, query, cb) -> {
            if (statuses == null || statuses.isEmpty()) {
                return cb.conjunction();
            }

            return root.get("poStatus").in(statuses);
        };
    }

    public static Specification<VenFlowEntry> plantCode(
            String plantCode) {

        return (root, query, cb) -> {
            if (plantCode == null || plantCode.isBlank()) {
                return cb.conjunction();
            }

            return cb.equal(
                    cb.upper(root.<String>get("plantCode")),
                    plantCode.trim().toUpperCase());
        };
    }

    public static Specification<VenFlowEntry> search(
            String search) {

        return (root, query, cb) -> {
            if (search == null || search.isBlank()) {
                return cb.conjunction();
            }

            String like = "%" + search.trim().toLowerCase() + "%";

            return cb.or(
                    cb.like(
                            cb.lower(root.<String>get("pdNo")),
                            like),

                    cb.like(
                            cb.lower(root.<String>get("drawingNo")),
                            like),

                    cb.like(
                            cb.lower(root.<String>get("clientName")),
                            like),

                    cb.like(
                            cb.lower(root.<String>get("productDescription")),
                            like),

                    cb.like(
                            cb.lower(root.<String>get("materialName")),
                            like),

                    cb.like(
                            cb.lower(root.<String>get("veneerType")),
                            like),

                    cb.like(
                            cb.lower(root.<String>get("purchaseRequestNo")),
                            like),

                    cb.like(
                            cb.lower(root.<String>get("poNo")),
                            like),

                    cb.like(
                            cb.lower(root.<String>get("vendorName")),
                            like));
        };
    }

    public static Specification<VenFlowEntry> stage(
            String value) {

        VenFlowStage parsed = parseEnum(value, VenFlowStage.class, "stage");

        return (root, query, cb) -> parsed == null
                ? cb.conjunction()
                : cb.equal(root.get("stage"), parsed);
    }

    public static Specification<VenFlowEntry> stagesIn(
            Collection<VenFlowStage> stages) {

        return (root, query, cb) -> {
            if (stages == null || stages.isEmpty()) {
                return cb.conjunction();
            }

            return root.get("stage").in(stages);
        };
    }

    public static Specification<VenFlowEntry> storeStatus(
            String value) {

        VenFlowStoreStatus parsed = parseEnum(
                value,
                VenFlowStoreStatus.class,
                "storeStatus");

        return (root, query, cb) -> parsed == null
                ? cb.conjunction()
                : cb.equal(root.get("storeStatus"), parsed);
    }

    public static Specification<VenFlowEntry> poStatus(
            String value) {

        VenFlowPoStatus parsed = parseEnum(
                value,
                VenFlowPoStatus.class,
                "poStatus");

        return (root, query, cb) -> parsed == null
                ? cb.conjunction()
                : cb.equal(root.get("poStatus"), parsed);
    }

    public static Specification<VenFlowEntry> productionStatus(
            String value) {

        VenFlowProductionStatus parsed = parseEnum(
                value,
                VenFlowProductionStatus.class,
                "productionStatus");

        return (root, query, cb) -> parsed == null
                ? cb.conjunction()
                : cb.equal(
                        root.get("productionStatus"),
                        parsed);
    }

    private static <E extends Enum<E>> E parseEnum(
            String value,
            Class<E> enumType,
            String fieldName) {

        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            return Enum.valueOf(
                    enumType,
                    value.trim().toUpperCase());

        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid "
                            + fieldName
                            + " value: "
                            + value);
        }
    }
}