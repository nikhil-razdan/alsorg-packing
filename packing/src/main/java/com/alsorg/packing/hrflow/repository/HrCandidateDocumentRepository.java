package com.alsorg.packing.hrflow.repository;

import com.alsorg.packing.hrflow.domain.HrCandidateDocument;
import com.alsorg.packing.hrflow.domain.HrDocumentType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HrCandidateDocumentRepository extends JpaRepository<HrCandidateDocument, UUID> {

    List<HrCandidateDocument> findAllByCandidateIdOrderByUploadedAtDesc(UUID candidateId);

    List<HrCandidateDocument> findAllByCandidateIdAndActiveTrueOrderByUploadedAtDesc(UUID candidateId);

    List<HrCandidateDocument> findAllByCandidateIdAndDocumentTypeAndActiveTrueOrderByUploadedAtDesc(
            UUID candidateId,
            HrDocumentType documentType
    );

    Optional<HrCandidateDocument> findFirstByCandidateIdAndDocumentTypeAndActiveTrueOrderByUploadedAtDesc(
            UUID candidateId,
            HrDocumentType documentType
    );

    long countByCandidateIdAndActiveTrue(UUID candidateId);

    boolean existsByCandidateIdAndDocumentTypeAndActiveTrue(UUID candidateId, HrDocumentType documentType);
}
