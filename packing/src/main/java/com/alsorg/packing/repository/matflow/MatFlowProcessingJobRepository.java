package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowProcessingJob;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowProcessingJobRepository
        extends JpaRepository<MatFlowProcessingJob, UUID> {

    List<MatFlowProcessingJob> findAllByOrderByUpdatedAtDesc();

    Optional<MatFlowProcessingJob> findByReservation_IdAndRouteStep_Id(
            UUID reservationId,
            UUID routeStepId);

    List<MatFlowProcessingJob> findByReservation_Id(
            UUID reservationId);

    List<MatFlowProcessingJob> findByRequisition_IdOrderByCreatedAtAsc(
            UUID requisitionId);
}