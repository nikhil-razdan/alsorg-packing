package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPurchaseOrderSequence;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface MatFlowPurchaseOrderSequenceRepository
        extends JpaRepository<MatFlowPurchaseOrderSequence, Long> {

    @Modifying(flushAutomatically = true)
    @Query(
            value = """
                    insert into mat_flow_purchase_order_sequences (
                        plant_code,
                        sequence_year,
                        current_value,
                        row_version
                    )
                    values (
                        :plantCode,
                        :year,
                        0,
                        0
                    )
                    on conflict (
                        plant_code,
                        sequence_year
                    )
                    do nothing
                    """,
            nativeQuery = true
    )
    int ensureSequenceExists(
            @Param("plantCode")
            String plantCode,

            @Param("year")
            Integer year
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select sequence
            from MatFlowPurchaseOrderSequence sequence
            where sequence.plantCode = :plantCode
              and sequence.year = :year
            """)
    Optional<MatFlowPurchaseOrderSequence> findForUpdate(
            @Param("plantCode")
            String plantCode,

            @Param("year")
            Integer year
    );
}