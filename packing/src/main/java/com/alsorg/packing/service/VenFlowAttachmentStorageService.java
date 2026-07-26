package com.alsorg.packing.service;

import com.alsorg.packing.domain.venflow.VenFlowAttachmentType;

import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

public interface VenFlowAttachmentStorageService {

    StoredFile store(
            UUID entryId,
            VenFlowAttachmentType type,
            MultipartFile file);

    Resource load(
            String storageKey);

    void delete(
            String storageKey);

    record StoredFile(
            String storageKey,
            String storedFileName,
            long fileSize,
            String checksumSha256) {
    }
}