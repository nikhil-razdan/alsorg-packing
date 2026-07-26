package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowRequisitionSequence;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface MatFlowRequisitionSequenceRepository
        extends JpaRepository<MatFlowRequisitionSequence, Integer> {

    /*
     * Safely creates the yearly sequence row.
     *
     * Two concurrent requests can execute this method without
     * causing a duplicate-key failure.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = false)
    @Query(value = """
            insert into mat_flow_requisition_sequence (
                sequence_year,
                current_value,
                row_version
            )
            values (
                :year,
                0,
                0
            )
            on conflict (sequence_year)
            do nothing
            """, nativeQuery = true)
    int ensureYearExists(
            @Param("year") Integer year);

    /*
     * Locks the sequence row until the surrounding transaction
     * finishes.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select s
            from MatFlowRequisitionSequence s
            where s.year = :year
            """)
    Optional<MatFlowRequisitionSequence> findByYearForUpdate(
            @Param("year") Integer year);
}