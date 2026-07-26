package com.alsorg.packing.service;

import com.alsorg.packing.controller.dto.VenFlowAttachmentDtos.AttachmentResponse;
import com.alsorg.packing.controller.dto.VenFlowAttachmentDtos.DeactivateAttachmentRequest;
import com.alsorg.packing.domain.venflow.VenFlowAttachment;
import com.alsorg.packing.domain.venflow.VenFlowAttachmentStorageProvider;
import com.alsorg.packing.domain.venflow.VenFlowAttachmentType;
import com.alsorg.packing.domain.venflow.VenFlowEntry;
import com.alsorg.packing.repository.VenFlowAttachmentRepository;
import com.alsorg.packing.repository.VenFlowEntryRepository;

import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class VenFlowAttachmentService {

    private static final Set<String>
            IMAGE_EXTENSIONS = Set.of(
                    "png",
                    "jpg",
                    "jpeg",
                    "webp");

    private static final Set<String>
            DOCUMENT_EXTENSIONS = Set.of(
                    "pdf",
                    "png",
                    "jpg",
                    "jpeg",
                    "webp",
                    "doc",
                    "docx",
                    "xls",
                    "xlsx");

    private final VenFlowAttachmentRepository attachmentRepo;
    private final VenFlowEntryRepository entryRepo;
    private final VenFlowAccessService access;
    private final VenFlowAttachmentStorageService storageService;

    public VenFlowAttachmentService(
            VenFlowAttachmentRepository attachmentRepo,
            VenFlowEntryRepository entryRepo,
            VenFlowAccessService access,
            VenFlowAttachmentStorageService storageService) {

        this.attachmentRepo = attachmentRepo;
        this.entryRepo = entryRepo;
        this.access = access;
        this.storageService = storageService;
    }

    public AttachmentResponse upload(
            UUID entryId,
            VenFlowAttachmentType type,
            MultipartFile file) {

        VenFlowEntry entry =
                requireVisibleEntry(entryId);

        assertCanWriteAttachmentType(
                type);

        validateFile(
                type,
                file);

        VenFlowAttachmentStorageService.StoredFile stored =
                storageService.store(
                        entry.id,
                        type,
                        file);

        VenFlowAttachment attachment =
                new VenFlowAttachment();

        attachment.entryId = entry.id;
        attachment.type = type;

        attachment.originalFileName =
                cleanFileName(
                        file.getOriginalFilename());

        attachment.storedFileName =
                stored.storedFileName();

        attachment.storageKey =
                stored.storageKey();

        attachment.storageProvider =
                VenFlowAttachmentStorageProvider.LOCAL_FILESYSTEM;

        attachment.contentType =
                clean(file.getContentType());

        attachment.fileSize =
                stored.fileSize();

        attachment.checksumSha256 =
                stored.checksumSha256();

        attachment.active = true;

        attachment.uploadedBy =
                actor();

        attachment.uploadedAt =
                LocalDateTime.now();

        try {
            VenFlowAttachment saved =
                    attachmentRepo.save(
                            attachment);

            return toResponse(saved);

        } catch (RuntimeException ex) {
            /*
             * Prevent orphan physical files when database persistence
             * fails after the file was stored.
             */
            storageService.delete(
                    stored.storageKey());

            throw ex;
        }
    }

    @Transactional(readOnly = true)
    public List<AttachmentResponse> list(
            UUID entryId,
            VenFlowAttachmentType type) {

        requireVisibleEntry(entryId);

        List<VenFlowAttachment> attachments;

        if (type == null) {
            attachments = attachmentRepo
                    .findByEntryIdAndActiveTrueOrderByUploadedAtDesc(
                            entryId);
        } else {
            attachments = attachmentRepo
                    .findByEntryIdAndTypeAndActiveTrueOrderByUploadedAtDesc(
                            entryId,
                            type);
        }

        return attachments.stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * Used by VenFlow business services to validate an attachment
     * before accepting a PO, QC inspection or process completion.
     */
    @Transactional(readOnly = true)
    public VenFlowAttachment requireActiveAttachment(
            UUID entryId,
            UUID attachmentId,
            VenFlowAttachmentType expectedType) {

        requireVisibleEntry(entryId);

        if (attachmentId == null) {
            throw badRequest(
                    "Attachment ID is required.");
        }

        if (expectedType == null) {
            throw badRequest(
                    "Expected Attachment Type is required.");
        }

        VenFlowAttachment attachment =
                attachmentRepo
                        .findByIdAndEntryIdAndActiveTrue(
                                attachmentId,
                                entryId)
                        .orElseThrow(() -> notFound(
                                "Active attachment was not found."));

        if (attachment.type != expectedType) {
            throw badRequest(
                    "Attachment "
                            + attachmentId
                            + " must be of type "
                            + expectedType
                            + ", but it is "
                            + attachment.type
                            + ".");
        }

        return attachment;
    }

    @Transactional(readOnly = true)
    public boolean existsActiveAttachment(
            UUID entryId,
            VenFlowAttachmentType type) {

        requireVisibleEntry(entryId);

        if (type == null) {
            return false;
        }

        return attachmentRepo
                .existsByEntryIdAndTypeAndActiveTrue(
                        entryId,
                        type);
    }

    @Transactional(readOnly = true)
    public AttachmentDownload download(
            UUID entryId,
            UUID attachmentId) {

        VenFlowAttachment attachment =
                requireActiveAttachmentWithoutType(
                        entryId,
                        attachmentId);

        Resource resource =
                storageService.load(
                        attachment.storageKey);

        return new AttachmentDownload(
                attachment,
                resource);
    }

    public AttachmentResponse deactivate(
            UUID entryId,
            UUID attachmentId,
            DeactivateAttachmentRequest req) {

        requireVisibleEntry(entryId);

        if (req == null) {
            throw badRequest(
                    "Deactivation request body is required.");
        }

        if (req.rowVersion() == null) {
            throw badRequest(
                    "Attachment rowVersion is required.");
        }

        if (req.reason() == null
                || req.reason().isBlank()) {

            throw badRequest(
                    "Attachment deactivation reason is required.");
        }

        VenFlowAttachment attachment =
                attachmentRepo
                        .findByIdAndEntryIdForUpdate(
                                entryId,
                                attachmentId)
                        .orElseThrow(() -> notFound(
                                "Attachment was not found."));

        assertCanWriteAttachmentType(
                attachment.type);

        if (!Objects.equals(
                attachment.rowVersion,
                req.rowVersion())) {

            throw conflict(
                    "This attachment was changed by another user. "
                            + "Reload before deactivating it.");
        }

        if (!attachment.active) {
            return toResponse(
                    attachment);
        }

        attachment.active = false;
        attachment.deactivatedBy =
                actor();

        attachment.deactivatedAt =
                LocalDateTime.now();

        attachment.deactivationReason =
                clean(req.reason());

        return toResponse(
                attachmentRepo.save(
                        attachment));
    }

    private VenFlowAttachment
    requireActiveAttachmentWithoutType(
            UUID entryId,
            UUID attachmentId) {

        requireVisibleEntry(entryId);

        if (attachmentId == null) {
            throw badRequest(
                    "Attachment ID is required.");
        }

        return attachmentRepo
                .findByIdAndEntryIdAndActiveTrue(
                        attachmentId,
                        entryId)
                .orElseThrow(() -> notFound(
                        "Active attachment was not found."));
    }

    private VenFlowEntry requireVisibleEntry(
            UUID entryId) {

        access.requireVenFlowAccess();

        if (entryId == null) {
            throw badRequest(
                    "VenFlow Entry ID is required.");
        }

        VenFlowEntry entry = entryRepo
                .findById(entryId)
                .orElseThrow(() -> notFound(
                        "VenFlow entry was not found."));

        access.assertPlantAccess(
                entry.plantCode);

        return entry;
    }

    private void assertCanWriteAttachmentType(
            VenFlowAttachmentType type) {

        if (type == null) {
            throw badRequest(
                    "Attachment Type is required.");
        }

        switch (type) {
            case BOM_IMAGE,
                 SAMPLE_IMAGE ->
                    access.requireEngineering();

            case PO_DOCUMENT ->
                    access.requirePurchase();

            case QC_EVIDENCE ->
                    access.requireQc();

            case PROCESS_OUTPUT ->
                    access.requireProcessing();
        }
    }

    private void validateFile(
            VenFlowAttachmentType type,
            MultipartFile file) {

        if (file == null || file.isEmpty()) {
            throw badRequest(
                    "Attachment file is required.");
        }

        String fileName =
                cleanFileName(
                        file.getOriginalFilename());

        String extension =
                extension(fileName);

        Set<String> allowedExtensions =
                switch (type) {
                    case BOM_IMAGE,
                         PO_DOCUMENT ->
                            DOCUMENT_EXTENSIONS;

                    case SAMPLE_IMAGE,
                         QC_EVIDENCE,
                         PROCESS_OUTPUT ->
                            IMAGE_EXTENSIONS;
                };

        if (!allowedExtensions.contains(
                extension)) {

            throw badRequest(
                    "Unsupported file type for "
                            + type
                            + ". Allowed extensions: "
                            + allowedExtensions
                            + ".");
        }
    }

    private String cleanFileName(
            String value) {

        String fileName =
                value == null
                        ? "attachment"
                        : value.trim();

        fileName = fileName
                .replace("\\", "_")
                .replace("/", "_");

        if (fileName.contains("..")) {
            throw badRequest(
                    "Invalid attachment file name.");
        }

        return fileName;
    }

    private String extension(
            String fileName) {

        int dot =
                fileName.lastIndexOf('.');

        if (dot < 0
                || dot
                == fileName.length() - 1) {

            return "";
        }

        return fileName
                .substring(dot + 1)
                .toLowerCase(Locale.ROOT);
    }

    private AttachmentResponse toResponse(
            VenFlowAttachment attachment) {

        return new AttachmentResponse(
                attachment.id,
                attachment.entryId,
                attachment.type,
                attachment.originalFileName,
                attachment.contentType,
                attachment.fileSize,
                attachment.checksumSha256,
                attachment.storageProvider,
                attachment.active,
                attachment.uploadedBy,
                attachment.uploadedAt,
                attachment.deactivatedBy,
                attachment.deactivatedAt,
                attachment.deactivationReason,
                attachment.rowVersion);
    }

    private String actor() {
        return access.currentUser()
                .getUsername();
    }

    private String clean(
            String value) {

        return value == null
                ? null
                : value.trim();
    }

    private ResponseStatusException badRequest(
            String message) {

        return new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                message);
    }

    private ResponseStatusException notFound(
            String message) {

        return new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                message);
    }

    private ResponseStatusException conflict(
            String message) {

        return new ResponseStatusException(
                HttpStatus.CONFLICT,
                message);
    }

    public record AttachmentDownload(
            VenFlowAttachment attachment,
            Resource resource) {
    }
}