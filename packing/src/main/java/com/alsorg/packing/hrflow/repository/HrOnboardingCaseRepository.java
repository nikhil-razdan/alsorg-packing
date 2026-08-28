package com.alsorg.packing.hrflow.repository;

import com.alsorg.packing.hrflow.domain.HrOnboardingCase;
import com.alsorg.packing.hrflow.domain.HrOnboardingStatus;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface HrOnboardingCaseRepository
        extends JpaRepository<HrOnboardingCase, UUID> {

    Optional<HrOnboardingCase> findByCandidateId(
            UUID candidateId
    );

    @Query("""
            select o
            from HrOnboardingCase o
            where (:status is null or o.status = :status)
            order by o.updatedAt desc, o.id desc
            """)
    Page<HrOnboardingCase> search(
            @Param("status") HrOnboardingStatus status,
            Pageable pageable
    );
}
