package com.alsorg.packing.hrflow.repository;

import com.alsorg.packing.hrflow.domain.HrAccessGrant;
import com.alsorg.packing.hrflow.domain.HrAccessRole;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HrAccessGrantRepository
        extends JpaRepository<HrAccessGrant, UUID> {

    List<HrAccessGrant> findAllByPrincipalNameIgnoreCaseAndActiveTrue(
            String principalName
    );

    Optional<HrAccessGrant> findByPrincipalNameIgnoreCaseAndRole(
            String principalName,
            HrAccessRole role
    );

    List<HrAccessGrant> findAllByOrderByPrincipalNameAscRoleAsc();

    boolean existsByPrincipalNameIgnoreCaseAndRoleAndActiveTrue(
            String principalName,
            HrAccessRole role
    );
}
