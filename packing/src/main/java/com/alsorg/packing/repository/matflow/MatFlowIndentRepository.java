package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowIndent;
import com.alsorg.packing.domain.matflow.MatFlowIndentStatus;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MatFlowIndentRepository
        extends JpaRepository<MatFlowIndent, UUID>,
        JpaSpecificationExecutor<MatFlowIndent> {

    List<MatFlowIndent> findByRequisitionIdOrderByCreatedAtDesc(
            UUID requisitionId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select indent
            from MatFlowIndent indent
            where indent.id = :indentId
            """)
    Optional<MatFlowIndent> findByIdForUpdate(
            @Param("indentId") UUID indentId);

    List<MatFlowIndent> findByStatusInOrderByRequiredByDateAscSubmittedAtAsc(
            List<MatFlowIndentStatus> statuses);

    List<MatFlowIndent> findByPlantCodeIgnoreCaseAndStatusInOrderByRequiredByDateAscSubmittedAtAsc(
            String plantCode,
            List<MatFlowIndentStatus> statuses);
}