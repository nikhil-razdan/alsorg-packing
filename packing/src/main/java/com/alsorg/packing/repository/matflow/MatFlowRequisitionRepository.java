package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowRequisition;
import com.alsorg.packing.domain.matflow.MatFlowRequisitionStatus;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MatFlowRequisitionRepository
        extends JpaRepository<MatFlowRequisition, UUID>,
        JpaSpecificationExecutor<MatFlowRequisition> {

    boolean existsByRequisitionNoIgnoreCase(
            String requisitionNo);

    List<MatFlowRequisition> findByReleaseIdOrderByCreatedAtDesc(
            UUID releaseId);

    List<MatFlowRequisition> findByReleaseIdAndStatusNotInOrderByCreatedAtDesc(
            UUID releaseId,
            List<MatFlowRequisitionStatus> excludedStatuses);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select requisition
            from MatFlowRequisition requisition
            where requisition.id = :id
            """)
    Optional<MatFlowRequisition> findByIdForUpdate(
            @Param("id") UUID id);

    List<MatFlowRequisition> findByStatusInOrderByRequiredByDateAscSubmittedAtAsc(
            List<MatFlowRequisitionStatus> statuses);

    List<MatFlowRequisition> findByPlantCodeIgnoreCaseAndStatusInOrderByRequiredByDateAscSubmittedAtAsc(
            String plantCode,
            List<MatFlowRequisitionStatus> statuses);
}