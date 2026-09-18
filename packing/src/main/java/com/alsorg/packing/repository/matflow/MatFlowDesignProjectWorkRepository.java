package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowDesignProjectWork;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowDesignProjectWorkRepository extends JpaRepository<MatFlowDesignProjectWork, UUID> {
    Optional<MatFlowDesignProjectWork> findByProject_Id(UUID projectId);
    List<MatFlowDesignProjectWork> findAllByOrderByUpdatedAtDesc();
}
