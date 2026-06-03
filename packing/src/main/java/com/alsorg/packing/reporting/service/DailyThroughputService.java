package com.alsorg.packing.reporting.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;

import com.alsorg.packing.domain.common.ItemDispatchStatus;
import com.alsorg.packing.repository.DispatchedItemRepository;
import com.alsorg.packing.repository.StickerHistoryRepository;
import com.alsorg.packing.reporting.dto.DailyUserThroughputResponse;

@Service
public class DailyThroughputService {

    private final StickerHistoryRepository stickerHistoryRepository;
    private final DispatchedItemRepository dispatchedItemRepository;

    public DailyThroughputService(
            StickerHistoryRepository stickerHistoryRepository,
            DispatchedItemRepository dispatchedItemRepository
    ) {
        this.stickerHistoryRepository = stickerHistoryRepository;
        this.dispatchedItemRepository = dispatchedItemRepository;
    }

    public List<DailyUserThroughputResponse> getUserWiseWork(
            String type,
            LocalDate date
    ) {
        LocalDate targetDate =
                date != null ? date : LocalDate.now();

        LocalDateTime from =
                targetDate.atStartOfDay();

        LocalDateTime to =
                targetDate.plusDays(1).atStartOfDay();

        if ("PACKED".equalsIgnoreCase(type)) {
            return stickerHistoryRepository.countPackedByUserBetween(
                    from,
                    to
            );
        }

        if ("DISPATCHED".equalsIgnoreCase(type)) {
            return dispatchedItemRepository.countDispatchedByUserBetween(
                    from,
                    to,
                    ItemDispatchStatus.DISPATCHED
            );
        }

        throw new RuntimeException(
                "Invalid throughput type. Use PACKED or DISPATCHED"
        );
    }
}