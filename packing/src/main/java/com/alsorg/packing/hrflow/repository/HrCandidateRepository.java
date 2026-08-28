package com.alsorg.packing.hrflow.repository;

import com.alsorg.packing.hrflow.domain.HrCandidate;
import com.alsorg.packing.hrflow.domain.HrCandidateStage;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface HrCandidateRepository
        extends JpaRepository<HrCandidate, UUID> {

    Optional<HrCandidate> findByCandidateNumberIgnoreCase(
            String candidateNumber
    );

    @Query("""
            select c
            from HrCandidate c
            where (:stage is null or c.stage = :stage)
              and (
                    :q is null
                    or :q = ''
                    or lower(c.candidateNumber) like lower(concat('%', :q, '%'))
                    or lower(coalesce(c.fullName, '')) like lower(concat('%', :q, '%'))
                    or lower(coalesce(c.mobileNo, '')) like lower(concat('%', :q, '%'))
                    or lower(coalesce(c.postAppliedFor, '')) like lower(concat('%', :q, '%'))
                  )
            order by c.updatedAt desc, c.id desc
            """)
    Page<HrCandidate> search(
            @Param("q") String q,
            @Param("stage") HrCandidateStage stage,
            Pageable pageable
    );
}
