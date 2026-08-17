package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowMaterialReturnLine;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowMaterialReturnLineRepository
        extends JpaRepository<MatFlowMaterialReturnLine, UUID> {

    List<MatFlowMaterialReturnLine> findByMaterialReturn_IdOrderByCreatedAtAsc(
            UUID materialReturnId);

    Optional<MatFlowMaterialReturnLine> findByIdAndMaterialReturn_Id(
            UUID lineId,
            UUID materialReturnId);

    /**
     * Used while creating a return to include already-open return documents in
     * the returnable-quantity calculation and prevent duplicate over-return.
     */
    List<MatFlowMaterialReturnLine> findByRequisitionLine_IdOrderByCreatedAtAsc(
            UUID requisitionLineId);
}
