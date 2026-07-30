package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowLocation;

import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowLocationRepository
                extends JpaRepository<MatFlowLocation, UUID> {

        boolean existsByLocationCodeIgnoreCase(
                        String locationCode);

        boolean existsByLocationCodeIgnoreCaseAndIdNot(
                        String locationCode,
                        UUID id);

        List<MatFlowLocation> findByPlantCodeInAndActiveTrueOrderByLocationCodeAsc(
                        Set<String> plantCodes);

        List<MatFlowLocation> findByPlantCodeInOrderByLocationCodeAsc(
                        Collection<String> plantCodes);
}