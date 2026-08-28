package com.alsorg.packing.repository.matflow;

import com.alsorg.packing.domain.matflow.MatFlowVendor;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MatFlowVendorRepository
        extends JpaRepository<MatFlowVendor, UUID> {

    boolean existsByVendorCodeIgnoreCase(String vendorCode);

    boolean existsByVendorCodeIgnoreCaseAndIdNot(String vendorCode, UUID id);
}
