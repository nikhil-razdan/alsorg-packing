package com.alsorg.packing.repository;

import java.util.Optional;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.alsorg.packing.domain.sticker.StickerSequence;

@Repository
public interface StickerSequenceRepository
        extends JpaRepository<StickerSequence, Integer> {

    /*
     * Safely creates the fixed sequence row if it is missing.
     *
     * ON CONFLICT prevents two simultaneous requests from
     * creating duplicate rows.
     */
    @Modifying
    @Query(value = """
            insert into sticker_sequence (
                id,
                current_value,
                sequence_year
            )
            values (
                :id,
                0,
                :sequenceYear
            )
            on conflict (id) do nothing
            """, nativeQuery = true)
    int ensureSequenceRowExists(
            @Param("id") Integer id,
            @Param("sequenceYear") Integer sequenceYear);

    /*
     * Locks the sequence row until the complete transaction ends.
     *
     * This prevents duplicate numbers when multiple users
     * generate stickers simultaneously.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
                select sequence
                from StickerSequence sequence
                where sequence.id = :id
            """)
    Optional<StickerSequence> findByIdForUpdate(
            @Param("id") Integer id);
}