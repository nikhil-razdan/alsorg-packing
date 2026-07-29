package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowMaterialReturn;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowMaterialReturnRepository
        extends JpaRepository<MatFlowMaterialReturn, UUID> {

    List<MatFlowMaterialReturn> findAllByOrderByUpdatedAtDesc();
}