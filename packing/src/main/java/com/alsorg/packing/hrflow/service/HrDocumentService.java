package com.alsorg.packing.hrflow.service;

import com.alsorg.packing.hrflow.config.HrFlowProperties;
import com.alsorg.packing.hrflow.domain.HrAccessRole;
import com.alsorg.packing.hrflow.domain.HrAuditAction;
import com.alsorg.packing.hrflow.domain.HrCandidate;
import com.alsorg.packing.hrflow.domain.HrCandidateDocument;
import com.alsorg.packing.hrflow.domain.HrCandidateStage;
import com.alsorg.packing.hrflow.domain.HrDocumentType;
import com.alsorg.packing.hrflow.dto.HrDocumentDtos;
import com.alsorg.packing.hrflow.exception.HrFlowException;
import com.alsorg.packing.hrflow.repository.HrCandidateDocumentRepository;
import com.alsorg.packing.hrflow.security.HrAccessService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.EnumSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class HrDocumentService {

    private static final EnumSet<HrCandidateStage> PUBLIC_DOCUMENT_STAGES = EnumSet.of(
            HrCandidateStage.NEW,
            HrCandidateStage.APPLICATION_SENT,
            HrCandidateStage.APPLICATION_IN_PROGRESS,
            HrCandidateStage.APPLICATION_SUBMITTED,
            HrCandidateStage.HR_REVIEW,
            HrCandidateStage.INTERVIEW,
            HrCandidateStage.SELECTED,
            HrCandidateStage.OFFERED,
            HrCandidateStage.PRE_JOINING,
            HrCandidateStage.JOINED
    );

    /**
     * These document types are written only by HRFLOW itself. Candidates and HR users
     * must not be able to spoof them through the ordinary multipart upload endpoint.
     */
    private static final EnumSet<HrDocumentType> MANAGED_WORKFLOW_TYPES = EnumSet.of(
            HrDocumentType.ONBOARDING_POLICY_SNAPSHOT,
            HrDocumentType.ONBOARDING_POLICY_ACKNOWLEDGEMENT,
            HrDocumentType.ORIENTATION_STATE,
            HrDocumentType.ORIENTATION_RECORD,
            HrDocumentType.INDUCTION_FEEDBACK,
            HrDocumentType.NDA_SNAPSHOT,
            HrDocumentType.NDA_ACCEPTANCE,
            HrDocumentType.NDA_VERIFICATION,
            HrDocumentType.EMPLOYMENT_DECLARATION_SNAPSHOT,
            HrDocumentType.EMPLOYMENT_DECLARATION_ACCEPTANCE,
            HrDocumentType.JOINING_REPORT_SNAPSHOT,
            HrDocumentType.ONBOARDING_COMPLETION_RECORD
    );

    private final HrCandidateDocumentRepository repository;
    private final HrAccessService accessService;
    private final HrAuditService auditService;
    private final HrFlowProperties properties;
    private final HrCryptoService cryptoService;
    private final EntityManager entityManager;
    private final ObjectMapper objectMapper;

    public HrDocumentService(
            HrCandidateDocumentRepository repository,
            HrAccessService accessService,
            HrAuditService auditService,
            HrFlowProperties properties,
            HrCryptoService cryptoService,
            EntityManager entityManager,
            ObjectMapper objectMapper
    ) {
        this.repository = repository;
        this.accessService = accessService;
        this.auditService = auditService;
        this.properties = properties;
        this.cryptoService = cryptoService;
        this.entityManager = entityManager;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<HrDocumentDtos.DocumentResponse> listInternal(UUID candidateId, boolean includeArchived) {
        accessService.requireAny(
                HrAccessRole.HR_ADMIN,
                HrAccessRole.HR_HEAD,
                HrAccessRole.HR_EXECUTIVE,
                HrAccessRole.RECRUITER,
                HrAccessRole.HOD
        );
        requireCandidate(candidateId);

        List<HrCandidateDocument> rows = includeArchived
                ? repository.findAllByCandidateIdOrderByUploadedAtDesc(candidateId)
                : repository.findAllByCandidateIdAndActiveTrueOrderByUploadedAtDesc(candidateId);

        return rows.stream().map(this::toResponse).toList();
    }

    @Transactional
    public HrDocumentDtos.DocumentResponse uploadInternal(
            UUID candidateId,
            HrDocumentType documentType,
            String remarks,
            MultipartFile file
    ) {
        accessService.requireAny(
                HrAccessRole.HR_ADMIN,
                HrAccessRole.HR_HEAD,
                HrAccessRole.HR_EXECUTIVE,
                HrAccessRole.RECRUITER
        );
        requireCandidate(candidateId);
        rejectManagedUploadType(documentType);
        return storeUploaded(candidateId, documentType, remarks, file, accessService.actor());
    }

    @Transactional
    public HrDocumentDtos.DocumentResponse uploadPublic(
            HrCandidate candidate,
            HrDocumentType documentType,
            String remarks,
            MultipartFile file
    ) {
        if (candidate == null || candidate.getId() == null) {
            throw HrFlowException.notFound("Candidate was not found.");
        }
        if (!PUBLIC_DOCUMENT_STAGES.contains(candidate.getStage())) {
            throw HrFlowException.conflict("Documents can no longer be changed for this candidate.");
        }
        rejectManagedUploadType(documentType);
        return storeUploaded(candidate.getId(), documentType, remarks, file, "CANDIDATE");
    }

    @Transactional(readOnly = true)
    public List<HrDocumentDtos.DocumentResponse> listPublic(HrCandidate candidate) {
        requirePublicDocumentAccess(candidate);

        return repository.findAllByCandidateIdAndActiveTrueOrderByUploadedAtDesc(candidate.getId())
                .stream()
                .filter(d -> !isManagedWorkflowType(d.getDocumentType()))
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public DownloadedDocument downloadInternal(UUID candidateId, UUID documentId) {
        accessService.requireAny(
                HrAccessRole.HR_ADMIN,
                HrAccessRole.HR_HEAD,
                HrAccessRole.HR_EXECUTIVE,
                HrAccessRole.RECRUITER,
                HrAccessRole.HOD
        );
        requireCandidate(candidateId);
        HrCandidateDocument document = requireDocument(candidateId, documentId);
        return decrypted(document);
    }

    @Transactional(readOnly = true)
    public DownloadedDocument downloadPublic(HrCandidate candidate, UUID documentId) {
        requirePublicDocumentAccess(candidate);
        HrCandidateDocument document = requireDocument(candidate.getId(), documentId);
        if (!document.isActive() || isManagedWorkflowType(document.getDocumentType())) {
            throw HrFlowException.notFound("Document was not found.");
        }
        return decrypted(document);
    }

    @Transactional
    public HrDocumentDtos.DocumentResponse archiveInternal(UUID candidateId, UUID documentId) {
        accessService.requireAny(
                HrAccessRole.HR_ADMIN,
                HrAccessRole.HR_HEAD,
                HrAccessRole.HR_EXECUTIVE
        );
        requireCandidate(candidateId);
        HrCandidateDocument document = requireDocument(candidateId, documentId);

        if (isManagedWorkflowType(document.getDocumentType())) {
            throw HrFlowException.badRequest(
                    "Managed HRFLOW workflow records cannot be archived manually. Use the related workflow action instead."
            );
        }

        if (!document.isActive()) {
            return toResponse(document);
        }

        String actor = accessService.actor();
        archive(document, actor);

        auditService.log(
                HrAuditAction.CANDIDATE_DOCUMENT_ARCHIVED,
                "CANDIDATE",
                candidateId.toString(),
                actor,
                "Candidate document archived: " + document.getDocumentType() + " / " + document.getOriginalFileName(),
                null
        );

        return toResponse(document);
    }

    /**
     * Trusted HRFLOW-internal lookup used when a generated official form needs an
     * existing uploaded source asset, for example the candidate photograph. No
     * external controller calls this method directly.
     */
    @Transactional(readOnly = true)
    public Optional<DownloadedDocument> latestActiveSystem(UUID candidateId, HrDocumentType documentType) {
        requireCandidate(candidateId);
        if (documentType == null) return Optional.empty();
        return repository
                .findFirstByCandidateIdAndDocumentTypeAndActiveTrueOrderByUploadedAtDesc(candidateId, documentType)
                .map(this::decrypted);
    }

    @Transactional(readOnly = true)
    public HrDocumentDtos.DocumentCompletenessResponse completeness(UUID candidateId) {
        accessService.requireAny(
                HrAccessRole.HR_ADMIN,
                HrAccessRole.HR_HEAD,
                HrAccessRole.HR_EXECUTIVE,
                HrAccessRole.RECRUITER,
                HrAccessRole.HOD
        );
        return completenessSystem(candidateId);
    }

    /**
     * Same calculation without an access check. Used only from another trusted HRFLOW
     * service while serving the secure onboarding token portal.
     */
    @Transactional(readOnly = true)
    public HrDocumentDtos.DocumentCompletenessResponse completenessSystem(UUID candidateId) {
        requireCandidate(candidateId);
        long candidateUploadedCount = repository.findAllByCandidateIdAndActiveTrueOrderByUploadedAtDesc(candidateId)
                .stream()
                .filter(d -> !isManagedWorkflowType(d.getDocumentType()))
                .count();

        return new HrDocumentDtos.DocumentCompletenessResponse(
                candidateId,
                repository.existsByCandidateIdAndDocumentTypeAndActiveTrue(candidateId, HrDocumentType.PHOTO),
                repository.existsByCandidateIdAndDocumentTypeAndActiveTrue(candidateId, HrDocumentType.RESUME),
                repository.existsByCandidateIdAndDocumentTypeAndActiveTrue(candidateId, HrDocumentType.AADHAAR),
                repository.existsByCandidateIdAndDocumentTypeAndActiveTrue(candidateId, HrDocumentType.PAN),
                candidateUploadedCount
        );
    }

    @Transactional(readOnly = true)
    public boolean hasActive(UUID candidateId, HrDocumentType documentType) {
        if (candidateId == null || documentType == null) return false;
        return repository.existsByCandidateIdAndDocumentTypeAndActiveTrue(candidateId, documentType);
    }

    @Transactional(readOnly = true)
    public <T> Optional<GeneratedJson<T>> latestGeneratedJson(
            UUID candidateId,
            HrDocumentType documentType,
            Class<T> payloadType
    ) {
        requireManagedType(documentType);
        if (candidateId == null) return Optional.empty();

        return repository
                .findFirstByCandidateIdAndDocumentTypeAndActiveTrueOrderByUploadedAtDesc(candidateId, documentType)
                .map(document -> new GeneratedJson<>(
                        toResponse(document),
                        readJsonPayload(document, payloadType)
                ));
    }

    @Transactional(readOnly = true)
    public <T> List<GeneratedJson<T>> activeGeneratedJson(
            UUID candidateId,
            HrDocumentType documentType,
            Class<T> payloadType
    ) {
        requireManagedType(documentType);
        if (candidateId == null) return List.of();

        return repository
                .findAllByCandidateIdAndDocumentTypeAndActiveTrueOrderByUploadedAtDesc(candidateId, documentType)
                .stream()
                .map(document -> new GeneratedJson<>(
                        toResponse(document),
                        readJsonPayload(document, payloadType)
                ))
                .toList();
    }

    /**
     * Stores encrypted JSON in the already-existing hr_candidate_document table.
     * replaceActive=true is used for mutable/current state snapshots (policy template,
     * orientation progress, NDA template, declaration template). Immutable acceptance
     * records use replaceActive=false and remain preserved as audit evidence.
     */
    @Transactional
    public HrDocumentDtos.DocumentResponse storeGeneratedJson(
            UUID candidateId,
            HrDocumentType documentType,
            Object payload,
            boolean replaceActive,
            String actor,
            String remarks
    ) {
        requireCandidate(candidateId);
        requireManagedType(documentType);
        if (payload == null) {
            throw HrFlowException.badRequest("Generated HRFLOW document payload is required.");
        }

        String effectiveActor = actor == null || actor.isBlank() ? "SYSTEM" : actor.trim();

        if (replaceActive) {
            repository
                    .findAllByCandidateIdAndDocumentTypeAndActiveTrueOrderByUploadedAtDesc(candidateId, documentType)
                    .forEach(row -> archive(row, effectiveActor));
        }

        byte[] bytes;
        try {
            bytes = objectMapper.writeValueAsBytes(payload);
        } catch (Exception ex) {
            throw new IllegalStateException("HRFLOW could not serialize generated document " + documentType + ".", ex);
        }

        HrCandidateDocument document = new HrCandidateDocument();
        document.setCandidateId(candidateId);
        document.setDocumentType(documentType);
        document.setOriginalFileName(generatedFileName(documentType));
        document.setContentType("application/json");
        document.setFileSize(bytes.length);
        document.setSha256(sha256(bytes));
        document.setContent(cryptoService.encryptBytes(bytes));
        document.setRemarks(clean(remarks));
        document.setActive(true);
        document.setUploadedBy(effectiveActor);

        return toResponse(repository.save(document));
    }

    @Transactional
    public void archiveActiveGeneratedType(UUID candidateId, HrDocumentType documentType, String actor) {
        requireManagedType(documentType);
        String effectiveActor = actor == null || actor.isBlank() ? "SYSTEM" : actor.trim();
        repository
                .findAllByCandidateIdAndDocumentTypeAndActiveTrueOrderByUploadedAtDesc(candidateId, documentType)
                .forEach(row -> archive(row, effectiveActor));
    }

    public String sha256Text(String value) {
        String v = value == null ? "" : value;
        return sha256(v.getBytes(StandardCharsets.UTF_8));
    }

    public boolean isManagedWorkflowType(HrDocumentType type) {
        return type != null && MANAGED_WORKFLOW_TYPES.contains(type);
    }

    private HrDocumentDtos.DocumentResponse storeUploaded(
            UUID candidateId,
            HrDocumentType documentType,
            String remarks,
            MultipartFile file,
            String actor
    ) {
        if (documentType == null) {
            throw HrFlowException.badRequest("Document type is required.");
        }
        if (file == null || file.isEmpty()) {
            throw HrFlowException.badRequest("A document file is required.");
        }

        long maxBytes = Math.max(1L, properties.getMaxDocumentBytes());
        if (file.getSize() > maxBytes) {
            throw HrFlowException.badRequest(
                    "Document is too large. Maximum allowed size is " + maxBytes + " bytes."
            );
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException ex) {
            throw HrFlowException.badRequest("The document could not be read.");
        }

        String originalName = cleanFileName(file.getOriginalFilename());
        String contentType = clean(file.getContentType());
        if (contentType == null) contentType = "application/octet-stream";

        HrCandidateDocument document = new HrCandidateDocument();
        document.setCandidateId(candidateId);
        document.setDocumentType(documentType);
        document.setOriginalFileName(originalName);
        document.setContentType(contentType);
        document.setFileSize(bytes.length);
        document.setSha256(sha256(bytes));
        document.setContent(cryptoService.encryptBytes(bytes));
        document.setRemarks(clean(remarks));
        document.setActive(true);
        document.setUploadedBy(actor == null || actor.isBlank() ? "SYSTEM" : actor);

        document = repository.save(document);

        auditService.log(
                HrAuditAction.CANDIDATE_DOCUMENT_UPLOADED,
                "CANDIDATE",
                candidateId.toString(),
                document.getUploadedBy(),
                "Candidate document uploaded: " + documentType + " / " + originalName,
                null
        );

        return toResponse(document);
    }

    private void rejectManagedUploadType(HrDocumentType documentType) {
        if (documentType == null) {
            throw HrFlowException.badRequest("Document type is required.");
        }
        if (isManagedWorkflowType(documentType)) {
            throw HrFlowException.badRequest(
                    documentType + " is managed by HRFLOW and cannot be uploaded manually."
            );
        }
    }

    private void requireManagedType(HrDocumentType documentType) {
        if (!isManagedWorkflowType(documentType)) {
            throw HrFlowException.badRequest("Document type is not an HRFLOW managed workflow type: " + documentType);
        }
    }

    private void requirePublicDocumentAccess(HrCandidate candidate) {
        if (candidate == null || candidate.getId() == null) {
            throw HrFlowException.notFound("Candidate was not found.");
        }
        if (!PUBLIC_DOCUMENT_STAGES.contains(candidate.getStage())) {
            throw HrFlowException.conflict("Candidate document access is no longer available.");
        }
    }

    private HrCandidate requireCandidate(UUID candidateId) {
        if (candidateId == null) {
            throw HrFlowException.badRequest("Candidate id is required.");
        }
        HrCandidate candidate = entityManager.find(HrCandidate.class, candidateId);
        if (candidate == null) {
            throw HrFlowException.notFound("Candidate not found: " + candidateId);
        }
        return candidate;
    }

    private HrCandidateDocument requireDocument(UUID candidateId, UUID documentId) {
        if (documentId == null) {
            throw HrFlowException.badRequest("Document id is required.");
        }
        HrCandidateDocument document = entityManager.find(HrCandidateDocument.class, documentId);
        if (document == null || !candidateId.equals(document.getCandidateId())) {
            throw HrFlowException.notFound("Candidate document not found.");
        }
        return document;
    }

    private <T> T readJsonPayload(HrCandidateDocument document, Class<T> payloadType) {
        try {
            byte[] plain = cryptoService.decryptBytes(document.getContent());
            return objectMapper.readValue(plain, payloadType);
        } catch (Exception ex) {
            throw new IllegalStateException(
                    "HRFLOW could not read stored generated document " + document.getDocumentType() + ".",
                    ex
            );
        }
    }

    private DownloadedDocument decrypted(HrCandidateDocument document) {
        return new DownloadedDocument(
                document.getOriginalFileName(),
                document.getContentType(),
                cryptoService.decryptBytes(document.getContent())
        );
    }

    private void archive(HrCandidateDocument document, String actor) {
        if (document == null || !document.isActive()) return;
        document.setActive(false);
        document.setArchivedBy(actor == null || actor.isBlank() ? "SYSTEM" : actor);
        document.setArchivedAt(LocalDateTime.now());
    }

    private HrDocumentDtos.DocumentResponse toResponse(HrCandidateDocument d) {
        return new HrDocumentDtos.DocumentResponse(
                d.getId(),
                d.getCandidateId(),
                d.getDocumentType(),
                d.getOriginalFileName(),
                d.getContentType(),
                d.getFileSize(),
                d.getSha256(),
                d.getRemarks(),
                d.isActive(),
                d.getUploadedBy(),
                d.getUploadedAt(),
                d.getArchivedBy(),
                d.getArchivedAt()
        );
    }

    private String generatedFileName(HrDocumentType type) {
        String stamp = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss_SSS").format(LocalDateTime.now());
        return type.name().toLowerCase() + "_" + stamp + ".json";
    }

    private String cleanFileName(String value) {
        String v = clean(value);
        if (v == null) return "document.bin";
        v = v.replace("\\", "/");
        int slash = v.lastIndexOf('/');
        if (slash >= 0) v = v.substring(slash + 1);
        v = v.replaceAll("[\\r\\n\\t]", "_");
        return v.length() > 500 ? v.substring(v.length() - 500) : v;
    }

    private String clean(String value) {
        if (value == null) return null;
        String v = value.trim();
        return v.isEmpty() ? null : v;
    }

    private String sha256(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(bytes));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable.", ex);
        }
    }

    public record DownloadedDocument(
            String fileName,
            String contentType,
            byte[] bytes
    ) {}

    public record GeneratedJson<T>(
            HrDocumentDtos.DocumentResponse document,
            T payload
    ) {}
}
