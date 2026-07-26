package com.alsorg.packing.repository.bomflow;

import com.alsorg.packing.domain.bomflow.BomFlowSequence;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface BomFlowSequenceRepository
        extends JpaRepository<BomFlowSequence, Long> {

    /**
     * Ensures that the plant/year sequence row exists.
     *
     * PostgreSQL ON CONFLICT makes initial sequence creation safe
     * when two requests arrive at the same time.
     */
    @Modifying
    @Query(
            value = """
                    insert into bom_flow_sequences (
                        plant_code,
                        sequence_year,
                        current_value,
                        row_version
                    )
                    values (
                        :plantCode,
                        :sequenceYear,
                        0,
                        0
                    )
                    on conflict (
                        plant_code,
                        sequence_year
                    )
                    do nothing
                    """,
            nativeQuery = true)
    int ensureSequenceExists(
            @Param("plantCode")
            String plantCode,

            @Param("sequenceYear")
            Integer sequenceYear);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select s
            from BomFlowSequence s
            where s.plantCode = :plantCode
              and s.sequenceYear = :sequenceYear
            """)
    Optional<BomFlowSequence> findForUpdate(
            @Param("plantCode")
            String plantCode,

            @Param("sequenceYear")
            Integer sequenceYear);
}