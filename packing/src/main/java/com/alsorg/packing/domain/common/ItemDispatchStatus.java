package com.alsorg.packing.domain.common;

public enum ItemDispatchStatus {

    AVAILABLE,          // normal inventory
    PACKED,             // sticker generated
    DISPATCHED,         // dispatch dept confirmed dispatch (future-safe)
    RESTORE_REQUESTED   // user requested restore
}
