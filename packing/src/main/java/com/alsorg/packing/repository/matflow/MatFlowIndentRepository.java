package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowIndent;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowIndentRepository
        extends JpaRepository<MatFlowIndent, UUID> {

    List<MatFlowIndent> findByRequisition_IdOrderByCreatedAtAsc(
            UUID requisitionId);

    List<MatFlowIndent> findByRequisition_Id(
            UUID requisitionId);

    List<MatFlowIndent> findByProjectDrawing_IdOrderByCreatedAtDesc(
            UUID projectDrawingId);
}