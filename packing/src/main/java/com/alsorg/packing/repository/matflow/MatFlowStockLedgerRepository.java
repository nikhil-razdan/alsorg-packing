package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowStockLedger;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

/**
 * Stock-ledger repository.
 *
 * Dynamic report filters are implemented with JPA Specifications in
 * MatFlowInsightService. This avoids PostgreSQL/Hibernate nullable-parameter
 * typing failures and the earlier lower(bytea) / unknown parameter errors.
 */
public interface MatFlowStockLedgerRepository
        extends JpaRepository<MatFlowStockLedger, UUID>,
        JpaSpecificationExecutor<MatFlowStockLedger> {

    List<MatFlowStockLedger> findByMaterial_IdAndLocation_IdOrderByActionAtDesc(
            UUID materialId,
            UUID locationId);
}
