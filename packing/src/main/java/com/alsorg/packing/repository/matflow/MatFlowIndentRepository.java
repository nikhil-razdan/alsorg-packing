package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowIndent;

import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MatFlowIndentRepository
        extends JpaRepository<MatFlowIndent, UUID> {

    List<MatFlowIndent> findByRequisition_IdOrderByCreatedAtAsc(UUID requisitionId);

    List<MatFlowIndent> findByRequisition_Id(UUID requisitionId);

    List<MatFlowIndent> findByProjectDrawing_IdOrderByCreatedAtDesc(UUID projectDrawingId);

    Page<MatFlowIndent> findByProjectDrawing_IdOrderByCreatedAtDesc(
            UUID projectDrawingId,
            Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select indent
            from MatFlowIndent indent
            where indent.id = :id
            """)
    Optional<MatFlowIndent> lockById(@Param("id") UUID id);
}
