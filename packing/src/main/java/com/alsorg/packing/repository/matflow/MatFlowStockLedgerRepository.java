package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowStockLedger;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface MatFlowStockLedgerRepository
        extends JpaRepository<MatFlowStockLedger, UUID>,
        JpaSpecificationExecutor<MatFlowStockLedger> {

    List<MatFlowStockLedger> findByMaterial_IdAndLocation_IdOrderByActionAtDesc(
            UUID materialId,
            UUID locationId);

    Page<MatFlowStockLedger> findByMaterial_IdAndLocation_IdOrderByActionAtDesc(
            UUID materialId,
            UUID locationId,
            Pageable pageable);
}
