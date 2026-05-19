package com.alsorg.packing.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.alsorg.packing.domain.sticker.StickerSequence;
import jakarta.persistence.LockModeType;

@Repository
public interface StickerSequenceRepository extends JpaRepository<StickerSequence, Integer> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from StickerSequence s where s.id = :id")
    Optional<StickerSequence> findByIdForUpdate(@Param("id") int id);
}
