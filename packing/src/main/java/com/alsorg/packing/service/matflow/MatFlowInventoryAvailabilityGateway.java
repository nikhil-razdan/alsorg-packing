package com.alsorg.packing.service.matflow;

import java.math.BigDecimal;
import java.util.UUID;

public interface MatFlowInventoryAvailabilityGateway {

    BigDecimal getAvailableQuantity(
            UUID inventoryItemId,
            String plantCode
    );
}