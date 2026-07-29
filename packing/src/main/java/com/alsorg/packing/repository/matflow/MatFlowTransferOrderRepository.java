package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowTransferOrder;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowTransferOrderRepository
        extends JpaRepository<MatFlowTransferOrder, UUID> {

    List<MatFlowTransferOrder> findAllByOrderByUpdatedAtDesc();

    List<MatFlowTransferOrder> findByRequisition_IdOrderByRouteSequenceNoAscCreatedAtAsc(
            UUID requisitionId);

    Optional<MatFlowTransferOrder> findByPredecessorTransferId(
            UUID predecessorTransferId);

    boolean existsByPredecessorTransferId(
            UUID predecessorTransferId);

    boolean existsByReservation_Id(
            UUID reservationId);

    List<MatFlowTransferOrder> findByReservation_IdOrderByRouteSequenceNoAsc(
            UUID reservationId);

    Optional<MatFlowTransferOrder> findFirstByReservation_IdAndFromLocation_IdOrderByRouteSequenceNoAsc(
            UUID reservationId,
            UUID fromLocationId);
}