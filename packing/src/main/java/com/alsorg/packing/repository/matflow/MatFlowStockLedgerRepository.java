package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.MovementType;
import com.alsorg.packing.domain.matflow.MatFlowStockLedger;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MatFlowStockLedgerRepository
        extends JpaRepository<MatFlowStockLedger, UUID> {

    List<MatFlowStockLedger> findByMaterial_IdAndLocation_IdOrderByActionAtDesc(
            UUID materialId,
            UUID locationId);

    @Query("""
            select ledger
            from MatFlowStockLedger ledger
            where ledger.location.plantCode in :plantCodes

              and (
                    :materialId is null
                    or ledger.material.id = :materialId
              )

              and (
                    :locationId is null
                    or ledger.location.id = :locationId
              )

              and (
                    :movementType is null
                    or ledger.movementType = :movementType
              )

              and (
                    :fromDate is null
                    or ledger.actionAt >= :fromDate
              )

              and (
                    :toDate is null
                    or ledger.actionAt <= :toDate
              )

              and (
                    :searchText is null

                    or lower(
                        coalesce(
                            ledger.referenceNumber,
                            ''
                        )
                    ) like lower(
                        concat(
                            '%',
                            :searchText,
                            '%'
                        )
                    )

                    or lower(
                        coalesce(
                            ledger.projectCode,
                            ''
                        )
                    ) like lower(
                        concat(
                            '%',
                            :searchText,
                            '%'
                        )
                    )

                    or lower(
                        coalesce(
                            ledger.drawingNo,
                            ''
                        )
                    ) like lower(
                        concat(
                            '%',
                            :searchText,
                            '%'
                        )
                    )

                    or lower(
                        coalesce(
                            ledger.batchNo,
                            ''
                        )
                    ) like lower(
                        concat(
                            '%',
                            :searchText,
                            '%'
                        )
                    )

                    or lower(
                        coalesce(
                            ledger.actor,
                            ''
                        )
                    ) like lower(
                        concat(
                            '%',
                            :searchText,
                            '%'
                        )
                    )
              )
            """)
    Page<MatFlowStockLedger> search(
            @Param("plantCodes") Set<String> plantCodes,

            @Param("materialId") UUID materialId,

            @Param("locationId") UUID locationId,

            @Param("movementType") MovementType movementType,

            @Param("fromDate") LocalDateTime fromDate,

            @Param("toDate") LocalDateTime toDate,

            @Param("searchText") String searchText,

            Pageable pageable);
}