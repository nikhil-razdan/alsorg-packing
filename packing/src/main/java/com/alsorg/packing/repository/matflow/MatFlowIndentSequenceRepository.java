package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowIndentSequence;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface MatFlowIndentSequenceRepository
        extends JpaRepository<MatFlowIndentSequence, Integer> {

    @Modifying(flushAutomatically = true)
    @Query(
            value = """
                    insert into mat_flow_indent_sequence (
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
                    """,
            nativeQuery = true
    )
    int ensureYearExists(
            @Param("year") Integer year
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select s
            from MatFlowIndentSequence s
            where s.year = :year
            """)
    Optional<MatFlowIndentSequence> findByYearForUpdate(
            @Param("year") Integer year
    );
}