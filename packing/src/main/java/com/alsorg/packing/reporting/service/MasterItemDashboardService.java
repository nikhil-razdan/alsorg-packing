package com.alsorg.packing.reporting.service;

import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.alsorg.packing.reporting.dto.MasterItemDetailResponse;
import com.alsorg.packing.reporting.dto.MasterItemPageResponse;
import com.alsorg.packing.reporting.repository.MasterItemDashboardRepository;

@Service
public class MasterItemDashboardService {

    private final MasterItemDashboardRepository repository;

    public MasterItemDashboardService(
            MasterItemDashboardRepository repository
    ) {
        this.repository = repository;
    }

    public MasterItemPageResponse getMasterItems(
            String search,
            String packingStatus,
            String plantCode,
            String clientName,
            LocalDateTime from,
            LocalDateTime to,
            int page,
            int size
    ) {
        return repository.findMasterItems(
                clean(search),
                clean(packingStatus),
                clean(plantCode),
                clean(clientName),
                from,
                to,
                Math.max(page, 0),
                Math.min(Math.max(size, 10), 100)
        );
    }

    public MasterItemDetailResponse getMasterItemDetail(
            UUID masterItemId
    ) {
        var master =
                repository.findMasterItem(masterItemId)
                        .orElseThrow(() ->
                                new ResponseStatusException(
                                        HttpStatus.NOT_FOUND,
                                        "Master item not found"
                                )
                        );

        return new MasterItemDetailResponse(
                master,
                repository.fetchPackets(masterItemId),
                repository.fetchPacketItems(masterItemId),
                repository.fetchChallans(masterItemId)
        );
    }

    private String clean(
            String value
    ) {
        if (value == null) {
            return null;
        }

        String text =
                value.trim();

        return text.isBlank()
                ? null
                : text;
    }
}