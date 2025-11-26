/**
 * ZON Protocol Constants v1.0.2 (ClearText)
 */

export const VERSION = "1.0.2";

// Format markers
export const TABLE_MARKER = "@";          // @hikes(3): col1, col2
export const META_SEPARATOR = ":";        // key:value (no space for compactness)

// Stream Tokens
export const GAS_TOKEN = "_";             // Auto-increment token
export const LIQUID_TOKEN = "^";          // Repeat previous value

// Thresholds
export const DEFAULT_ANCHOR_INTERVAL = 50;
export const SINGLETON_THRESHOLD = 1;     // Flatten lists with 1 item to metadata
export const INLINE_THRESHOLD_ROWS = 0;

// Legacy compatibility (kept for potential fallback)
export const DICT_REF_PREFIX = "%";
export const ANCHOR_PREFIX = "$";
export const REPEAT_SUFFIX = "x";
