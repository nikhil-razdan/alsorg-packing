package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowMaterial;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowMaterialRepository
        extends JpaRepository<MatFlowMaterial, UUID> {

    boolean existsByMaterialCodeIgnoreCase(String materialCode);

    boolean existsByMaterialCodeIgnoreCaseAndIdNot(String materialCode, UUID id);
}
