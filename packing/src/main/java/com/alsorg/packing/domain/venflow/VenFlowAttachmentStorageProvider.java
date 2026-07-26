package com.alsorg.packing.domain.venflow;

/**
 * Identifies where the physical attachment is stored.
 *
 * LOCAL_FILESYSTEM is the current implementation.
 * CLOUD_OBJECT_STORAGE is reserved for a future S3,
 * Cloudflare R2, Azure Blob or similar implementation.
 */
public enum VenFlowAttachmentStorageProvider {

    LOCAL_FILESYSTEM,

    CLOUD_OBJECT_STORAGE
}