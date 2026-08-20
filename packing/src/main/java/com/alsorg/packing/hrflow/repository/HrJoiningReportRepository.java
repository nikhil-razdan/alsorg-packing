package com.alsorg.packing.hrflow.repository;

import com.alsorg.packing.hrflow.domain.HrJoiningReport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface HrJoiningReportRepository extends JpaRepository<HrJoiningReport, UUID> {

    Optional<HrJoiningReport> findByOnboardingCaseId(UUID onboardingCaseId);

    Optional<HrJoiningReport> findByEmployeeId(UUID employeeId);

    Optional<HrJoiningReport> findByCandidateId(UUID candidateId);
}
