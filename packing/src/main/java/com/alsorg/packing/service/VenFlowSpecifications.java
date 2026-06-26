package com.alsorg.packing.service;

import com.alsorg.packing.domain.venflow.*;

import java.util.Collection;
import java.util.Set;

import org.springframework.data.jpa.domain.Specification;

public class VenFlowSpecifications {

    private VenFlowSpecifications() {
    }

    public static Specification<VenFlowEntry> visiblePlants(
            Set<String> plants,
            boolean allPlants
    ) {
        return (root, query, cb) -> {
            if (allPlants) {
                return cb.conjunction();
            }

            if (plants == null || plants.isEmpty()) {
                return cb.disjunction();
            }

            return cb.upper(root.get("plantCode")).in(plants);
        };
    }

    public static Specification<VenFlowEntry> plantCode(String plantCode) {
        return (root, query, cb) -> {
            if (plantCode == null || plantCode.isBlank()) {
                return cb.conjunction();
            }

            return cb.equal(
                    cb.upper(root.get("plantCode")),
                    plantCode.trim().toUpperCase()
            );
        };
    }

    public static Specification<VenFlowEntry> search(String search) {
        return (root, query, cb) -> {
            if (search == null || search.isBlank()) {
                return cb.conjunction();
            }

            String like = "%" + search.trim().toLowerCase() + "%";

            return cb.or(
                    cb.like(cb.lower(root.get("pdNo")), like),
                    cb.like(cb.lower(root.get("clientName")), like),
                    cb.like(cb.lower(root.get("productDescription")), like),
                    cb.like(cb.lower(root.get("veneerType")), like),
                    cb.like(cb.lower(root.get("poNo")), like),
                    cb.like(cb.lower(root.get("vendorName")), like)
            );
        };
    }

    public static Specification<VenFlowEntry> stage(String stage) {
        return (root, query, cb) -> {
            if (stage == null || stage.isBlank()) {
                return cb.conjunction();
            }

            try {
                VenFlowStage value =
                        VenFlowStage.valueOf(stage.trim().toUpperCase());

                return cb.equal(root.get("stage"), value);
            } catch (Exception e) {
                return cb.disjunction();
            }
        };
    }

    public static Specification<VenFlowEntry> stagesIn(
            Collection<VenFlowStage> stages
    ) {
        return (root, query, cb) -> {
            if (stages == null || stages.isEmpty()) {
                return cb.conjunction();
            }

            return root.get("stage").in(stages);
        };
    }

    public static Specification<VenFlowEntry> storeStatus(String storeStatus) {
        return (root, query, cb) -> {
            if (storeStatus == null || storeStatus.isBlank()) {
                return cb.conjunction();
            }

            try {
                VenFlowStoreStatus value =
                        VenFlowStoreStatus.valueOf(storeStatus.trim().toUpperCase());

                return cb.equal(root.get("storeStatus"), value);
            } catch (Exception e) {
                return cb.disjunction();
            }
        };
    }

    public static Specification<VenFlowEntry> poStatus(String poStatus) {
        return (root, query, cb) -> {
            if (poStatus == null || poStatus.isBlank()) {
                return cb.conjunction();
            }

            try {
                VenFlowPoStatus value =
                        VenFlowPoStatus.valueOf(poStatus.trim().toUpperCase());

                return cb.equal(root.get("poStatus"), value);
            } catch (Exception e) {
                return cb.disjunction();
            }
        };
    }

    public static Specification<VenFlowEntry> productionStatus(
            String productionStatus
    ) {
        return (root, query, cb) -> {
            if (productionStatus == null || productionStatus.isBlank()) {
                return cb.conjunction();
            }

            try {
                VenFlowProductionStatus value =
                        VenFlowProductionStatus.valueOf(
                                productionStatus.trim().toUpperCase()
                        );

                return cb.equal(root.get("productionStatus"), value);
            } catch (Exception e) {
                return cb.disjunction();
            }
        };
    }
}