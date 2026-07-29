package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowQcDisposition;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowQcDispositionRepository
        extends JpaRepository<MatFlowQcDisposition, UUID> {

    List<MatFlowQcDisposition> findAllByOrderByCreatedAtDesc();

    List<MatFlowQcDisposition> findByQcInspection_IdOrderByCreatedAtAsc(
            UUID inspectionId);
}