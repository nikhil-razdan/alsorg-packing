package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowMaterialRequisition;

import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MatFlowMaterialRequisitionRepository
        extends JpaRepository<MatFlowMaterialRequisition, UUID> {

    List<MatFlowMaterialRequisition> findAllByOrderByUpdatedAtDesc();

    Page<MatFlowMaterialRequisition> findAllByOrderByUpdatedAtDesc(Pageable pageable);

    List<MatFlowMaterialRequisition> findByProjectDrawing_IdOrderByCreatedAtDesc(
            UUID projectDrawingId);

    Page<MatFlowMaterialRequisition> findByProjectDrawing_IdOrderByCreatedAtDesc(
            UUID projectDrawingId,
            Pageable pageable);

    @EntityGraph(attributePaths = {
            "projectDrawing",
            "bom",
            "destinationLocation",
            "originStore",
            "mainStore"
    })
    @Query("""
            select requisition
            from MatFlowMaterialRequisition requisition
            where requisition.id = :id
            """)
    Optional<MatFlowMaterialRequisition> findDetailById(@Param("id") UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select requisition
            from MatFlowMaterialRequisition requisition
            where requisition.id = :id
            """)
    Optional<MatFlowMaterialRequisition> lockById(@Param("id") UUID id);
}
