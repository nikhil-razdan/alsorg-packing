package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.ReservationStatus;
import com.alsorg.packing.domain.matflow.MatFlowReservation;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowReservationRepository
        extends JpaRepository<MatFlowReservation, UUID> {

    List<MatFlowReservation> findByRequisitionLine_Requisition_IdOrderByCreatedAtAsc(
            UUID requisitionId);

    List<MatFlowReservation> findByRequisitionLine_Requisition_IdAndStatus(
            UUID requisitionId,
            ReservationStatus status);
            
}