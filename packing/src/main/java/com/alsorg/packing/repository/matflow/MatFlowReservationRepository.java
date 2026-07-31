package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ReservationStatus;
import com.alsorg.packing.domain.matflow.MatFlowReservation;

import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import org.springframework.data.repository.query.Param;

public interface MatFlowReservationRepository
                extends JpaRepository<MatFlowReservation, UUID> {

        List<MatFlowReservation> findByRequisitionLine_Requisition_IdOrderByCreatedAtAsc(
                        UUID requisitionId);

        List<MatFlowReservation> findByRequisitionLine_Requisition_IdAndStatus(
                        UUID requisitionId,
                        ReservationStatus status);

        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @Query("""
                        select reservation
                        from MatFlowReservation reservation
                        where reservation.id = :id
                        """)
        Optional<MatFlowReservation> lockById(
                        @Param("id") UUID id);
}