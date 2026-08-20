package com.alsorg.packing.hrflow.repository;

import com.alsorg.packing.hrflow.domain.HrCandidateAccessToken;
import com.alsorg.packing.hrflow.domain.HrTokenPurpose;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HrCandidateAccessTokenRepository extends JpaRepository<HrCandidateAccessToken, UUID> {
    Optional<HrCandidateAccessToken> findByTokenHashAndPurpose(String tokenHash, HrTokenPurpose purpose);
    List<HrCandidateAccessToken> findAllByCandidateIdAndPurpose(UUID candidateId, HrTokenPurpose purpose);
}
