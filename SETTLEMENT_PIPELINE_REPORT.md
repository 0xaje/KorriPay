# Settlement Pipeline Visualization Report

This document describes the design and implementation of the professional 9-stage settlement lifecycle visualization introduced across the KorriPay platform.

---

## Overview

The existing simplistic 7-stage horizontal stepper inside the Settlement Proof modal has been replaced with a full **9-stage vertical timeline** that communicates every step a settlement passes through — from the initial gateway request to cryptographic proof generation and final ledger archival.

No settlement logic, API routes, or database schemas were modified.

---

## The 9 Canonical Protocol Stages

| # | Stage Label | Icon | GIWA Stage? | Est. Duration |
|---|---|---|---|---|
| 1 | Settlement Requested | `send` | No | ~0.2s |
| 2 | Compliance Screening | `policy` | No | ~0.8s |
| 3 | FX Validation | `currency_exchange` | No | ~0.6s |
| 4 | Settlement Created | `receipt_long` | No | ~0.4s |
| 5 | Submitted to GIWA | `lan` | **Yes** | ~0.5s |
| 6 | Sequencer Accepted | `verified` | **Yes** | ~0.6s |
| 7 | Block Finalized | `lock` | **Yes** | ~1.2s |
| 8 | Settlement Proof Generated | `fact_check` | **Yes** | ~0.8s |
| 9 | Completed | `task_alt` | No | ~0.2s |

Stages 5–8 carry a `GIWA` badge to visually distinguish the on-chain protocol layers from the off-chain gateway layers.

---

## Visual Design

### Stage States
Each stage in the vertical timeline renders in one of three states:

| State | Dot Color | Opacity | Label Style | Right Annotation |
|---|---|---|---|---|
| ✅ Completed | Green (`#22c55e`) | 100% | Bold white | Actual timestamp |
| 🔄 Active | Primary blue, pulsing | 100% | Bold primary | "Active" badge |
| ⏳ Pending | Muted gray | 40% | Dim gray | Estimated duration |

### Progress Bar
A horizontal gradient progress bar beneath each timeline (from blue → green) shows percentage completion across the 9 stages.

### Connector Lines
Vertical connector lines between each stage turn green once that stage is completed, and remain faded gray while pending.

---

## Integration Points

### 1. Dashboard — Settlement Proof Modal (`dashboard.html`)
**Location:** `#modal-proof` → `#settlement-pipeline-timeline`

The old 7-node horizontal stepper has been fully replaced. The container is populated by `renderPipelineTimeline(stageHistory, currentStage, container)` in `app.js` when the modal is opened.

- Each stage shows its actual timestamp from `pipelineHistory` when available
- Replay mode steps through all 9 stages, updating the vertical timeline progressively
- The "Replay Lifecycle" terminal log now uses 9-stage actor descriptions

### 2. Public Proof Page (`pay.html`)
**Location:** `#success-container` → `#pay-pipeline-timeline`

A self-contained `renderPayPipeline(container, baseTimestamp)` function renders all 9 stages as completed once a payment succeeds. Timestamps are computed from the settlement `createdAt` using the same millisecond offsets as the main pipeline engine.

### 3. Showcase Simulator (`showcase.html`)
**Location:** Slide 11 → `#sim-pipeline-display`

The Live Settlement Simulator now features a 3-column layout:
- **Left column:** Settlement parameters input form
- **Center column:** Terminal console log
- **Right column:** Protocol Lifecycle pipeline panel

During `runSimulation()`, stages animate sequentially with staggered delays. Each stage activates on the pipeline panel in sync with the terminal log line. The compliance block path halts the pipeline at Stage 2 with an error state.

---

## Legacy Stage Name Mapping

For backward compatibility with existing backend `pipelineStage` values:

| Backend `pipelineStage` | Maps to canonical stage |
|---|---|
| `Settlement Requested` | Stage 1 |
| `Compliance Screening` | Stage 2 |
| `Compliance Screening Blocked` | Stage 2 |
| `Route Selection` | Stage 3 (FX Validation) |
| `Execution` | Stage 4 (Settlement Created) |
| `Confirmation` | Stage 7 (Block Finalized) |
| `Proof Generation` | Stage 8 (Settlement Proof Generated) |
| `Archive` | Stage 9 (Completed) |

---

## Files Modified

| File | Change |
|---|---|
| [app.js](file:///home/oyeolorun/KorriPay/frontend/app.js) | Added `STAGE_METADATA`, `STAGE_LEGACY_MAP`, `renderPipelineTimeline()`. Replaced `updatePipelineStepper` with thin wrapper. Updated fallback history and replay to 9 stages. |
| [dashboard.html](file:///home/oyeolorun/KorriPay/frontend/dashboard.html) | Replaced horizontal 7-step stepper with `#settlement-pipeline-timeline` container. |
| [pay.html](file:///home/oyeolorun/KorriPay/frontend/pay.html) | Added pipeline section to success container. Added standalone `renderPayPipeline()` function. |
| [showcase.html](file:///home/oyeolorun/KorriPay/frontend/showcase.html) | Expanded simulator to 3 columns. Added `SIM_STAGES`, `renderSimPipeline()`, rewrote `runSimulation()`. |
