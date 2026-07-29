package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowVendorReturn;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowVendorReturnRepository
        extends JpaRepository<
                MatFlowVendorReturn,
                UUID
                > {

    List<MatFlowVendorReturn>
    findAllByOrderByCreatedAtDesc();
}