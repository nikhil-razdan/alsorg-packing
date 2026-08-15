package com.alsorg.packing.controller.dto.hardware;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import com.alsorg.packing.domain.common.PacketItemType;

public final class HardwarePacketDtos {

        private HardwarePacketDtos() {
        }

        // =====================================================
        // HARDWARE CONTENT ROW
        // =====================================================

        public record HardwareLineRequest(
                        String itemName,
                        BigDecimal quantity,
                        String uom) {
        }

        // =====================================================
        // ONE HARDWARE PACKET DRAFT
        // =====================================================

        public record HardwarePacketDraftRequest(
                        List<HardwareLineRequest> items) {
        }

        // =====================================================
        // CREATE NEW HARDWARE MASTER + PACKETS
        // =====================================================

        /*
         * packingDate:
         *
         * Optional business packing date selected by the user
         * while creating a new Hardware Packet master.
         *
         * Expected format:
         * yyyy-MM-dd
         *
         * Example:
         * 2026-08-12
         *
         * If null/blank, HardwarePacketService defaults it
         * to today's date in Asia/Kolkata.
         *
         * IMPORTANT:
         * This exists ONLY in the top-level Create request.
         * Existing Add Hardware Packets and Edit Hardware Packet
         * behaviour remains unchanged.
         */
        public record HardwarePacketCreateRequest(
                        String itemName,
                        String pdNo,
                        String drawingNo,
                        String clientName,
                        String clientAddress,
                        String floor,
                        String plantCode,
                        String packingDate,
                        List<HardwarePacketDraftRequest> packets) {
        }

        // =====================================================
        // ADD PACKETS TO EXISTING HARDWARE MASTER
        // =====================================================

        /*
         * Intentionally no packingDate here.
         *
         * This preserves your existing Add Hardware Packets
         * workflow exactly as it is.
         */
        public record HardwarePacketAddRequest(
                        List<HardwarePacketDraftRequest> packets) {
        }

        // =====================================================
        // EDIT EXISTING HARDWARE PACKET
        // =====================================================

        /*
         * Intentionally no packingDate here.
         *
         * Editing the hardware packet should not silently
         * change its original packing/business date.
         */
        public record HardwarePacketUpdateRequest(
                        String itemName,
                        String pdNo,
                        String drawingNo,
                        String clientName,
                        String clientAddress,
                        String floor,
                        List<HardwareLineRequest> items) {
        }

        // =====================================================
        // HARDWARE LINE RESPONSE
        // =====================================================

        public record HardwareLineResponse(
                        UUID id,
                        int lineNo,
                        String itemName,
                        BigDecimal quantity,
                        String uom) {
        }

        // =====================================================
        // HARDWARE PACKET RESPONSE
        // =====================================================

        public record HardwarePacketResponse(
                        UUID itemId,
                        UUID masterItemId,

                        PacketItemType itemType,

                        String itemName,
                        String packetNumber,
                        String sku,

                        String pdNo,
                        String drawingNo,

                        String clientName,
                        String clientAddress,
                        String floor,

                        String description,

                        String plantCode,
                        String location,
                        String packedAreaCode,
                        String currentLocationCode,

                        String status,
                        String stickerNumber,
                        Long printIteration,

                        String createdBy,
                        Long createdByUserId,

                        List<HardwareLineResponse> items) {
        }
}