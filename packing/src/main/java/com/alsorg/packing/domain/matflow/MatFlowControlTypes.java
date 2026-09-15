package com.alsorg.packing.domain.matflow;

/**
 * MatFlow's compact control vocabulary. Keeping the state machine in one file
 * makes the Designer -> PPC -> Engineering contract explicit and keeps the
 * later Production execution route replaceable without changing historical
 * design/engineering records.
 */
public final class MatFlowControlTypes {
    private MatFlowControlTypes() {}

    public enum ProductionFileStage {
        DESIGN_DRAFT,
        DESIGN_CLARIFICATION,
        DESIGN_SUBMITTED,
        PPC_GATE_1,
        ENGINEERING_REVIEW,
        ENGINEERING_QUERY,
        ENGINEERING_WORK,
        REVISION_REVIEW,
        PPC_GATE_2,
        PRODUCTION_RELEASED,
        CANCELLED
    }

    public enum ReleaseHealth { GREEN, AMBER, RED }

    public enum EngineeringDecision { PENDING, APPROVED, QUERY_RAISED, RETURNED }

    public enum WorkItemType {
        DESIGN_CHECK,
        ENGINEERING_CHECK,
        ENGINEERING_QUERY,
        ENGINEERING_TASK,
        REVISION_REVIEW
    }

    public enum WorkItemStatus {
        PENDING,
        COMPLETE,
        NOT_APPLICABLE,
        OPEN,
        RESPONDED,
        CLOSED,
        TODO,
        ASSIGNED,
        IN_PROGRESS,
        BLOCKED,
        CANCELLED
    }

    public enum Criticality { CRITICAL, REQUIRED, OPTIONAL }

    public enum RevisionType { DESIGN_DRAWING, ENGINEERING_DRAWING, OTHER }

    public enum RevisionStatus { DRAFT, PENDING_IMPACT_REVIEW, ACTIVE, SUPERSEDED, REJECTED }

    public enum BomStatus { DRAFT, READY_FOR_RELEASE, RELEASED, SUPERSEDED }
}
