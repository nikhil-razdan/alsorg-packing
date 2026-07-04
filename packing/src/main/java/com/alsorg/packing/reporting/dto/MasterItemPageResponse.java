package com.alsorg.packing.reporting.dto;

import java.util.List;

public record MasterItemPageResponse(
        List<MasterItemListRow> rows,
        long total,
        int page,
        int size
) {
}