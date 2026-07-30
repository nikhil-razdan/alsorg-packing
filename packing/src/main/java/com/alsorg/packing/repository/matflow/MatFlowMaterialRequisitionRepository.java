package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowMaterialRequisition;

import java.util.List;
import java.util.UUID;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowMaterialRequisitionRepository
                extends JpaRepository<MatFlowMaterialRequisition, UUID> {

        List<MatFlowMaterialRequisition> findAllByOrderByUpdatedAtDesc();

        List<MatFlowMaterialRequisition> findByProjectDrawing_IdOrderByCreatedAtDesc(
                        UUID projectDrawingId);

        @EntityGraph(attributePaths = {
                        "projectDrawing",
                        "bom",
                        "destinationLocation"
        })
        @Query("""
                        select requisition
                        from MatFlowMaterialRequisition requisition
                        where requisition.id = :id
                        """)
        Optional<MatFlowMaterialRequisition> findDetailById(
                        @Param("id") UUID id);
}