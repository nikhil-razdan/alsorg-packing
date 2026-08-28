package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcInspectionStatus;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.QcSourceType;
import com.alsorg.packing.domain.matflow.MatFlowQcInspection;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowQcInspectionRepository
        extends JpaRepository<MatFlowQcInspection, UUID> {

    List<MatFlowQcInspection> findAllByOrderByCreatedAtDesc();

    Page<MatFlowQcInspection> findAllByOrderByCreatedAtDesc(Pageable pageable);

    List<MatFlowQcInspection> findByStatusOrderByCreatedAtAsc(QcInspectionStatus status);

    Page<MatFlowQcInspection> findByStatusOrderByCreatedAtAsc(
            QcInspectionStatus status,
            Pageable pageable);

    Optional<MatFlowQcInspection> findBySourceTypeAndSourceLineId(
            QcSourceType sourceType,
            UUID sourceLineId);

    boolean existsBySourceTypeAndSourceLineId(
            QcSourceType sourceType,
            UUID sourceLineId);
}
