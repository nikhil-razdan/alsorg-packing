package com.alsorg.packing.service;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.alsorg.packing.integration.zoho.dto.ZohoItemDTO;
import com.alsorg.packing.domain.item.PacketItem;
import com.alsorg.packing.repository.PacketItemRepository;

@Service
public class ZohoItemMappingService {

    private final PacketItemRepository packetItemRepository;

    public ZohoItemMappingService(PacketItemRepository packetItemRepository) {
        this.packetItemRepository = packetItemRepository;
    }

    public void mapZohoItems(List<ZohoItemDTO> zohoItems) {

        for (ZohoItemDTO zoho : zohoItems) {

            Optional<PacketItem> optional =
                    packetItemRepository.findBySku(zoho.getSku());

            if (optional.isPresent()) {
                PacketItem item = optional.get();
                item.setZohoItemId(zoho.getZohoItemId());
                item.setDescription(zoho.getDescription());
                item.setLocation(zoho.getLocation());
                packetItemRepository.save(item);
            }
        }
    }
}
