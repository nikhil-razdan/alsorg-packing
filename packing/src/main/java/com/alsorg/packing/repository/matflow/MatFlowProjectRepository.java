package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowProject;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowProjectRepository extends JpaRepository<MatFlowProject, UUID> {
    List<MatFlowProject> findAllByOrderByUpdatedAtDesc();

    boolean existsByPlantCodeIgnoreCaseAndProjectCodeIgnoreCase(
            String plantCode,
            String projectCode);

    boolean existsByPlantCodeIgnoreCaseAndProjectCodeIgnoreCaseAndIdNot(
            String plantCode,
            String projectCode,
            UUID id);

    Optional<MatFlowProject> findByPlantCodeIgnoreCaseAndProjectCodeIgnoreCase(
            String plantCode,
            String projectCode);
}
