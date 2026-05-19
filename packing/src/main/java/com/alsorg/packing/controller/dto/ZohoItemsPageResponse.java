package com.alsorg.packing.controller.dto;

import java.util.List;
import com.alsorg.packing.integration.zoho.dto.ZohoItemDTO;

public class ZohoItemsPageResponse {

    private List<ZohoItemDTO> items;
    private int total;

    public ZohoItemsPageResponse(List<ZohoItemDTO> items, int total) {
        this.items = items;
        this.total = total;
    }

    public List<ZohoItemDTO> getItems() {
        return items;
    }

    public int getTotal() {
        return total;
    }
}
