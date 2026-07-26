package com.alsorg.packing.service.matflow;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.UUID;

@Service
public class UnconfiguredMatFlowInventoryAvailabilityGateway
        implements MatFlowInventoryAvailabilityGateway {

    @Override
    public BigDecimal getAvailableQuantity(
            UUID inventoryItemId,
            String plantCode) {

        throw new ResponseStatusException(
                HttpStatus.NOT_IMPLEMENTED,
                "SYSTEM_INVENTORY stock verification is not "
                        + "connected yet. Use OFFLINE_MANUAL until "
                        + "the existing inventory repository is "
                        + "connected to MatFlow."
        );
    }
}