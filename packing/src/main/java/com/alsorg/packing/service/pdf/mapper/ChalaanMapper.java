package com.alsorg.packing.service.pdf.mapper;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Component;

import com.alsorg.packing.integration.zoho.dto.ZohoItemDTO;
import com.alsorg.packing.service.pdf.ChalaanItem;
import com.alsorg.packing.service.pdf.ChalaanPdfData;
import com.alsorg.packing.service.pdf.dto.StickerPdfData;

@Component
public class ChalaanMapper {

	public ChalaanPdfData mapFromZoho(List<ZohoItemDTO> itemsDto) {

	    ChalaanPdfData chalaan = new ChalaanPdfData();

	    if (itemsDto == null || itemsDto.isEmpty()) {
	        return chalaan;
	    }

	    ZohoItemDTO first = itemsDto.get(0);

	    /* ================= HEADER ================= */

	    chalaan.setPdNo(first.getPdNo());
	    chalaan.setCustomerName(first.getClientName());
	    chalaan.setAddress(first.getClientAddress());

	    chalaan.setDesignerName("-");
	    chalaan.setVoucherNo(first.getZohoItemId()); // 🔥 REAL SOURCE
	    chalaan.setOt("-");

	    /* ================= ITEMS ================= */

	    List<ChalaanItem> items = new ArrayList<>();

	    for (ZohoItemDTO z : itemsDto) {

	        ChalaanItem item = new ChalaanItem();

	        item.setItemName(safe(z.getName()));
	        item.setDrawingNo(safe(z.getDrawingNo()));
	        item.setDescription(safe(z.getDescription()));
	        item.setQty(String.valueOf(z.getQuantity()));
	        item.setRemarks(safe(z.getRemarks()));

	        items.add(item);
	    }

	    chalaan.setItems(items);

	    return chalaan;
	}

    private String safe(Object v) {
        return v == null ? "" : v.toString();
    }
}