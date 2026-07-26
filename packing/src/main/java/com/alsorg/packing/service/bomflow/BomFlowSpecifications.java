package com.alsorg.packing.service.bomflow;

import com.alsorg.packing.domain.bomflow.BomFlowBom;
import com.alsorg.packing.domain.bomflow.BomFlowStatus;

import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Set;

public final class BomFlowSpecifications {

    private BomFlowSpecifications() {
    }

    public static Specification<BomFlowBom> visiblePlants(
            Set<String> plants,
            boolean allPlants) {

        return (root, query, cb) -> {
            if (allPlants) {
                return cb.conjunction();
            }

            if (plants == null
                    || plants.isEmpty()) {

                return cb.disjunction();
            }

            return cb.upper(
                    root.<String>get(
                            "plantCode"))
                    .in(plants);
        };
    }

    public static Specification<BomFlowBom> plantCode(
            String plantCode) {

        return (root, query, cb) -> {
            if (plantCode == null
                    || plantCode.isBlank()) {

                return cb.conjunction();
            }

            return cb.equal(
                    cb.upper(
                            root.<String>get(
                                    "plantCode")),
                    plantCode.trim()
                            .toUpperCase());
        };
    }

    public static Specification<BomFlowBom> search(
            String search) {

        return (root, query, cb) -> {
            if (search == null
                    || search.isBlank()) {

                return cb.conjunction();
            }

            String like = "%"
                    + search.trim()
                            .toLowerCase()
                    + "%";

            return cb.or(
                    cb.like(
                            cb.lower(
                                    root.<String>get(
                                            "bomNo")),
                            like),

                    cb.like(
                            cb.lower(
                                    root.<String>get(
                                            "pdNo")),
                            like),

                    cb.like(
                            cb.lower(
                                    root.<String>get(
                                            "drawingNo")),
                            like),

                    cb.like(
                            cb.lower(
                                    root.<String>get(
                                            "projectCode")),
                            like),

                    cb.like(
                            cb.lower(
                                    root.<String>get(
                                            "clientName")),
                            like),

                    cb.like(
                            cb.lower(
                                    root.<String>get(
                                            "productName")),
                            like),

                    cb.like(
                            cb.lower(
                                    root.<String>get(
                                            "productCode")),
                            like));
        };
    }

    public static Specification<BomFlowBom> status(
            String status) {

        BomFlowStatus parsed = parseStatus(status);

        return (root, query, cb) -> parsed == null
                ? cb.conjunction()
                : cb.equal(
                        root.get("status"),
                        parsed);
    }

    private static BomFlowStatus parseStatus(
            String value) {

        if (value == null
                || value.isBlank()) {

            return null;
        }

        try {
            return BomFlowStatus.valueOf(
                    value.trim()
                            .toUpperCase());

        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid BOMFlow status: "
                            + value);
        }
    }
}