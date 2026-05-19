package com.alsorg.packing.repository;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.alsorg.packing.domain.item.MasterItem;

public interface MasterItemRepository extends JpaRepository<MasterItem, UUID> {
}