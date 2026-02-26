/**
 * Built-in node registration hub.
 *
 * Each import triggers registerPlugin() calls as a side-effect.
 * To add a new built-in node: create a new file in ./nodes/ and import it here.
 */

// ── Context nodes ─────────────────────────────────────────────────────────────
import './nodes/contextNodes'
// ── Plot nodes ────────────────────────────────────────────────────────────────
import './nodes/plotNodes'
// ── Direction nodes ───────────────────────────────────────────────────────────
import './nodes/directionNodes'
// ── Processing nodes ──────────────────────────────────────────────────────────
import './nodes/processingNodes'
// ── Creative / special nodes ──────────────────────────────────────────────────
import './nodes/creativeNodes'
// ── Brainstorming node ────────────────────────────────────────────────────────
import './nodes/brainstormingNode'
// ── LOD viewer node ───────────────────────────────────────────────────────────
import './nodes/lodNode'
// ── Reader perspective node ───────────────────────────────────────────────────
import './nodes/readerNode'
// ── Detector nodes ────────────────────────────────────────────────────────────
import './nodes/detectorNodes'
// ── Special (analysis) nodes ─────────────────────────────────────────────────
import './nodes/specialNodes'
// ── Output nodes ──────────────────────────────────────────────────────────────
import './nodes/outputNodes'
// ── Structure nodes ───────────────────────────────────────────────────────────
import './nodes/structureNodes'
