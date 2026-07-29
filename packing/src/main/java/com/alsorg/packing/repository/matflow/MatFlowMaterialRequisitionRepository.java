package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowMaterialRequisition;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowMaterialRequisitionRepository
                extends JpaRepository<MatFlowMaterialRequisition, UUID> {

        List<MatFlowMaterialRequisition> findAllByOrderByUpdatedAtDesc();

        List<MatFlowMaterialRequisition> findByProjectDrawing_IdOrderByCreatedAtDesc(
                        UUID projectDrawingId);
}