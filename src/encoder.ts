/**
 * ZON Encoder v2.0.0 - Compact Hybrid Format
 *
 * Breaking changes from v1.x:
 * - Compact header syntax (@count: instead of @data(count):)
 * - Sequential ID omission ([col] notation)
 * - Sparse table encoding for semi-uniform data
 * - Adaptive format selection based on data complexity
 */

import {
  TABLE_MARKER,
  META_SEPARATOR,
  GAS_TOKEN,
  LIQUID_TOKEN,
  DEFAULT_ANCHOR_INTERVAL
} from './constants';

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
interface JsonObject { [key: string]: JsonValue }
interface JsonArray extends Array<JsonValue> {}

interface TableInfo {
  cols: string[];
  rows: Record<string, any>[];
  prev_vals: Record<string, any>;
  row_index: number;
  expected_rows: number;
}

interface ColumnAnalysis {
  is_sequential: boolean;
  step: number;
  has_repetition: boolean;
}

export class ZonEncoder {
  private anchor_interval: number;
  private safe_str_re: RegExp;

  constructor(anchorInterval: number = DEFAULT_ANCHOR_INTERVAL) {
    this.anchor_interval = anchorInterval;
    this.safe_str_re = /^[a-zA-Z0-9_\-\.]+$/;
  }

  /**
   * Encode data to ZON v1.0.2 ClearText format.
   */
  encode(data: any): string {
    // 1. Root Promotion: Separate metadata from stream
    const [streamData, metadata, streamKey] = this._extractPrimaryStream(data);

    // Fallback for simple/empty data
    if (!streamData && (!metadata || Object.keys(metadata).length === 0)) {
      return JSON.stringify(data);
    }

    const output: string[] = [];

    // Special case: Detect schema uniformity for lists of dicts
    if (Array.isArray(data) && data.length > 0 && data.every(item => typeof item === 'object' && !Array.isArray(item))) {
      // Calculate irregularity score
      const irregularityScore = this._calculateIrregularity(data);
      
      // If highly irregular (>60% keys differ), use list format
      if (irregularityScore > 0.6) {
        return this._formatZonNode(data);
      }
      
      // Otherwise use table format (even if semi-uniform)
      // The sparse table encoding will handle optional fields efficiently
    }

    // 1. Root Promotion: Extract primary stream into table
    // If stream_key is None (pure list input), use default key
    let finalStreamKey = streamKey;
    if (streamData && streamKey === null) {
      finalStreamKey = "data";
    }

    // 3. Write Metadata (YAML-like)
    if (metadata && Object.keys(metadata).length > 0) {
      output.push(...this._writeMetadata(metadata));
    }

    // 4. Write Table (if multi-item stream exists)
    if (streamData && finalStreamKey) {
      if (output.length > 0) {  // Add blank line separator
        output.push("");
      }
      output.push(...this._writeTable(streamData, finalStreamKey));
    }

    return output.join("\n");
  }

  /**
   * Root Promotion Algorithm: Find the main table in the JSON.
   */
  private _extractPrimaryStream(data: any): [any[] | null, Record<string, any>, string | null] {
    if (Array.isArray(data)) {
      // Only promote to table if it contains objects
      if (data.length > 0 && typeof data[0] === 'object' && data[0] !== null && !Array.isArray(data[0])) {
        return [data, {}, null];
      }
      return [null, {}, null];  // Treat as simple value
    }

    if (typeof data === 'object' && data !== null) {
      // Find largest list of objects
      const candidates: [string, any[], number][] = [];
      
      for (const [k, v] of Object.entries(data)) {
        if (Array.isArray(v) && v.length > 0) {
          // Check if list contains objects (tabular candidate)
          if (typeof v[0] === 'object' && !Array.isArray(v[0])) {
            // Score = Rows * Cols
            const score = v.length * Object.keys(v[0]).length;
            candidates.push([k, v, score]);
          }
        }
      }

      if (candidates.length > 0) {
        candidates.sort((a, b) => b[2] - a[2]);
        const [key, stream] = candidates[0];
        const meta: Record<string, any> = {};
        
        for (const [k, v] of Object.entries(data)) {
          if (k !== key) {
            meta[k] = v;
          }
        }
        
        return [stream, meta, key];
      }
    }

    return [null, typeof data === 'object' ? data : {}, null];
  }

  /**
   * Write metadata in YAML-like format.
   */
  private _writeMetadata(metadata: Record<string, any>): string[] {
    const lines: string[] = [];
    const flattened = this._flatten(metadata);

    const sortedKeys = Object.keys(flattened).sort();
    for (const key of sortedKeys) {
      const value = flattened[key];
      const valStr = this._formatValue(value);
      lines.push(`${key}${META_SEPARATOR}${valStr}`);
    }

    return lines;
  }

  /**
   * Write table in v2.0.0 compact format with adaptive encoding.
   */
  private _writeTable(stream: any[], key: string): string[] {
    if (!stream || stream.length === 0) {
      return [];
    }

    const lines: string[] = [];
    const flatStream = stream.map(row => this._flatten(row));

    // Get all column names
    const allKeysSet = new Set<string>();
    flatStream.forEach(d => Object.keys(d).forEach(k => allKeysSet.add(k)));
    let cols = Array.from(allKeysSet).sort();

    // Analyze column sparsity
    const columnStats = this._analyzeColumnSparsity(flatStream, cols);
    const coreColumns = columnStats.filter(c => c.presence >= 0.7).map(c => c.name);
    const optionalColumns = columnStats.filter(c => c.presence < 0.7).map(c => c.name);

    // Decide encoding strategy
    const useSparseEncoding = optionalColumns.length > 0 && optionalColumns.length <= 5;

    if (useSparseEncoding) {
      return this._writeSparseTable(flatStream, coreColumns, optionalColumns, stream.length, key);
    } else {
      return this._writeStandardTable(flatStream, cols, stream.length, key);
    }
  }

  /**
   * Write standard compact table (v2.0.0 format).
   */
  /**
   * Write standard compact table (v2.0.0 format).
   */
  private _writeStandardTable(flatStream: Record<string, any>[], cols: string[], rowCount: number, key: string): string[] {
    const lines: string[] = [];

    // Detect sequential columns to omit
    const omittedCols = this._analyzeSequentialColumns(flatStream, cols);

    // Build compact header: key:@(count)[omitted]: columns or @count[omitted]: columns
    let header = '';
    if (key && key !== 'data') {
      header = `${key}${META_SEPARATOR}${TABLE_MARKER}(${rowCount})`;
    } else {
      header = `${TABLE_MARKER}${rowCount}`;
    }

    if (omittedCols.length > 0) {
      header += omittedCols.map(c => `[${c}]`).join('');
    }

    // Filter out omitted columns
    const visibleCols = cols.filter(c => !omittedCols.includes(c));
    header += `${META_SEPARATOR}${visibleCols.join(',')}`;
    lines.push(header);

    // Write rows (without omitted columns)
    for (const row of flatStream) {
      const tokens: string[] = [];
      for (const col of visibleCols) {
        const val = row[col];
        // Use "null" for undefined/null to preserve type
        if (val === undefined || val === null) {
          tokens.push('null');
        } else {
          tokens.push(this._formatValue(val));
        }
      }
      lines.push(tokens.join(','));
    }

    return lines;
  }

  /**
   * Write sparse table for semi-uniform data (v2.0.0).
   */
  private _writeSparseTable(
    flatStream: Record<string, any>[],
    coreColumns: string[],
    optionalColumns: string[],
    rowCount: number,
    key: string
  ): string[] {
    const lines: string[] = [];

    // Detect sequential columns in core columns
    const omittedCols = this._analyzeSequentialColumns(flatStream, coreColumns);

    // Build header: key:@(count)[omitted]: core_columns
    let header = '';
    if (key && key !== 'data') {
      header = `${key}${META_SEPARATOR}${TABLE_MARKER}(${rowCount})`;
    } else {
      header = `${TABLE_MARKER}${rowCount}`;
    }

    if (omittedCols.length > 0) {
      header += omittedCols.map(c => `[${c}]`).join('');
    }

    const visibleCoreColumns = coreColumns.filter(c => !omittedCols.includes(c));
    header += `${META_SEPARATOR}${visibleCoreColumns.join(',')}`;
    lines.push(header);

    // Write rows: core columns + optional fields as key:value
    for (const row of flatStream) {
      const tokens: string[] = [];

      // Core columns (fixed positions)
      for (const col of visibleCoreColumns) {
        tokens.push(this._formatValue(row[col]));
      }

      // Optional columns (append as key:value if present)
      for (const col of optionalColumns) {
        if (col in row && row[col] !== undefined) {
          const val = this._formatValue(row[col]);
          tokens.push(`${col}:${val}`);
        }
      }

      lines.push(tokens.join(','));
    }

    return lines;
  }

  /**
   * Analyze column sparsity to determine core vs optional.
   */
  private _analyzeColumnSparsity(data: Record<string, any>[], cols: string[]): Array<{name: string, presence: number}> {
    return cols.map(col => {
      const presenceCount = data.filter(row => col in row && row[col] !== undefined && row[col] !== null).length;
      return {
        name: col,
        presence: presenceCount / data.length
      };
    });
  }

  /**
   * Detect sequential columns (1, 2, 3, ..., N) for omission.
   */
  /**
   * Detect sequential columns (1, 2, 3, ..., N) for omission.
   * 
   * NOTE: Disabled in v1.0.3 to improve LLM retrieval accuracy.
   * Implicit columns like [id] were being missed by LLMs.
   * Now all columns are explicit.
   */
  private _analyzeSequentialColumns(data: Record<string, any>[], cols: string[]): string[] {
    return []; // Disable omission for now
    /*
    const omittable: string[] = [];
    
    for (const col of cols) {
      const values = data.map(d => d[col]);

      // Must be all integers
      if (!values.every(v => typeof v === 'number' && Number.isInteger(v))) {
        continue;
      }

      // Check if perfectly sequential from 1..N
      const isSequential = values.every((v, i) => v === i + 1);

      if (isSequential && values.length > 2) {
        omittable.push(col);
      }
    }

    return omittable;
    */
  }

  /**
   * Analyze columns for compression opportunities.
   */
  private _analyzeColumns(data: Record<string, any>[], cols: string[]): Record<string, ColumnAnalysis> {
    const analysis: Record<string, ColumnAnalysis> = {};

    for (const col of cols) {
      const vals = data.map(d => d[col]);

      const result: ColumnAnalysis = {
        is_sequential: false,
        step: 1,
        has_repetition: false
      };

      // Check for sequential numbers
      const nums = vals.filter(v => typeof v === 'number' && typeof v !== 'boolean');
      if (nums.length === vals.length && vals.length > 1) {
        try {
          const diffs = nums.slice(1).map((n, i) => (n as number) - (nums[i] as number));
          const uniqueDiffs = new Set(diffs);
          if (uniqueDiffs.size === 1) {
            result.is_sequential = true;
            result.step = Array.from(uniqueDiffs)[0];
          }
        } catch (e) {
          // ignore
        }
      }

      // Check for repetition
      if (vals.length > 1) {
        try {
          const unique = new Set(vals.map(v => JSON.stringify(v)));
          if (unique.size < vals.length) {
            result.has_repetition = true;
          }
        } catch (e) {
          // ignore
        }
      }

      analysis[col] = result;
    }

    return analysis;
  }

  /**
   * Calculate irregularity score for array of objects.
   * Returns 0.0 (perfectly uniform) to 1.0 (completely different schemas).
   */
  private _calculateIrregularity(data: Record<string, any>[]): number {
    if (data.length === 0) {
      return 0;
    }

    // Get all unique keys across all objects
    const allKeys = new Set<string>();
    const keySets: Set<string>[] = [];
    
    for (const item of data) {
      const keys = new Set(Object.keys(item));
      keySets.push(keys);
      keys.forEach(k => allKeys.add(k));
    }

    const totalKeys = allKeys.size;
    if (totalKeys === 0) {
      return 0;
    }

    // Calculate key overlap score
    // For each pair of objects, measure how many keys they share
    let totalOverlap = 0;
    let comparisons = 0;

    for (let i = 0; i < keySets.length; i++) {
      for (let j = i + 1; j < keySets.length; j++) {
        const keys1 = keySets[i];
        const keys2 = keySets[j];
        
        // Count shared keys
        let shared = 0;
        keys1.forEach(k => {
          if (keys2.has(k)) shared++;
        });
        
        // Jaccard similarity: shared / (size1 + size2 - shared)
        const union = keys1.size + keys2.size - shared;
        const similarity = union > 0 ? shared / union : 1;
        
        totalOverlap += similarity;
        comparisons++;
      }
    }

    if (comparisons === 0) {
      return 0;  // Single object
    }

    const avgSimilarity = totalOverlap / comparisons;
    const irregularity = 1 - avgSimilarity;  // 0 = all same, 1 = all different

    return irregularity;
  }

  /**
   * Quote a string for CSV (RFC 4180).
   * Escapes quotes by doubling them (" -> "") and wraps in double quotes.
   */
  private _csvQuote(s: string): string {
    const escaped = s.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  /**
   * Format nested structure using YAML-like ZON syntax:
   * - Dict: {key:val,key:val}
   * - List: [val,val]
   */
  private _formatZonNode(val: any, visited: WeakSet<object> = new WeakSet()): string {
    if (typeof val === 'object' && val !== null) {
      if (visited.has(val)) {
        throw new Error('Circular reference detected');
      }
      visited.add(val);
    }

    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      const keys = Object.keys(val);
      if (keys.length === 0) {
        return "{}";
      }
      const items: string[] = [];
      for (const k of keys) {
        // Format key (unquoted if simple)
        let kStr = String(k);
        // Keys are usually simple, but quote if needed
        if (/[,:\{\}\[\]"]/.test(kStr)) {
          kStr = JSON.stringify(kStr);
        }

        // Format value recursively
        const vStr = this._formatZonNode(val[k], visited);
        items.push(`${kStr}:${vStr}`);
      }
      return "{" + items.join(",") + "}";
    } else if (Array.isArray(val)) {
      if (val.length === 0) {
        return "[]";
      }
      return "[" + val.map(item => this._formatZonNode(item, visited)).join(",") + "]";
    }

    // Primitives
    if (val === null) {
      return "null";
    }
    if (val === true) {
      return "T";
    }
    if (val === false) {
      return "F";
    }
    if (typeof val === 'number') {
      // Preserve exact numeric representation
      if (!Number.isInteger(val)) {
        let s = String(val);
        // Ensure floats always have decimal point
        if (!/[\.e]/i.test(s)) {
          s += '.0';
        }
        return s;
      } else {
        return String(val);
      }
    }

    // String handling - only quote if necessary
    const s = String(val);

    // CRITICAL FIX: Always JSON-stringify strings with newlines to prevent line breaks in ZON
    if (s.includes('\n') || s.includes('\r')) {
      return JSON.stringify(s);
    }

    // Quote empty strings or whitespace-only strings to prevent them being parsed as null
    if (!s.trim()) {
      return JSON.stringify(s);
    }

    // Quote strings that look like reserved words or numbers to prevent type confusion
    if (['T', 'F', 'null', 'true', 'false'].includes(s)) {
      return JSON.stringify(s);
    }

    // Quote if it looks like a number (to preserve string type)
    if (/^-?\d+(\.\d+)?$/.test(s)) {
      return JSON.stringify(s);
    }

    // Quote if contains structural delimiters
    if (/[,:\{\}\[\]"]/.test(s)) {
      return JSON.stringify(s);
    }

    return s;
  }

  /**
   * Format a value with minimal quoting.
   * v1.0.3 Optimization: Smart date detection and relaxed string quoting
   */
  private _formatValue(val: any): string {
    if (val === null) {
      return "null";
    }
    if (val === true) {
      return "T";
    }
    if (val === false) {
      return "F";
    }
    if (typeof val === 'boolean') {
      return val ? "T" : "F";
    }
    if (typeof val === 'number') {
      // Handle special values
      if (!Number.isFinite(val)) {
        return "null";  // NaN, Infinity, -Infinity → null
      }
      
      // Canonical number formatting - avoid scientific notation
      if (Number.isInteger(val)) {
        return String(val);
      }
      
      // For floats, format without trailing zeros
      let s = String(val);
      
      // Check if it's in scientific notation
      if (s.includes('e') || s.includes('E')) {
        // Convert to fixed-point notation
        const parts = s.split(/[eE]/);
        const mantissa = parseFloat(parts[0]);
        const exponent = parseInt(parts[1], 10);
        
        if (exponent >= 0) {
          // Positive exponent - multiply
          s = (mantissa * Math.pow(10, exponent)).toString();
        } else {
          // Negative exponent - use toFixed
          s = mantissa.toFixed(Math.abs(exponent));
        }
      }
      
      // Ensure decimal point for floats
      if (!s.includes('.')) {
        s += '.0';
      }
      
      return s;
    }

    if (Array.isArray(val) || (typeof val === 'object' && val !== null)) {
    // Use ZON-style formatting for complex types
    // ZON structures are self-delimiting ({}, []) and should NOT be quoted
    // unless they are meant to be strings (which is handled by string path)
    return this._formatZonNode(val);
  }

    // String formatting with v1.0.3 optimizations
    const s = String(val);

    // CRITICAL FIX: Always JSON-stringify strings with newlines to prevent line breaks in ZON
    if (s.includes('\n') || s.includes('\r')) {
      console.log(`[DEBUG] Detected newline in: ${JSON.stringify(s)}`);
      return this._csvQuote(JSON.stringify(s));
    }

    // OPTIMIZATION 1: ISO Date Detection
    // Dates like "2025-01-01" or "2025-01-01T10:00:00Z" are unambiguous
    // No need to quote - LLMs recognize ISO 8601 format universally
    if (this._isISODate(s)) {
      return s;
    }

    // OPTIMIZATION 2: Smarter Number Detection
    // Only quote actual numbers, not complex patterns like IPs or alphanumeric IDs
    const needsTypeProtection = this._needsTypeProtection(s);

    if (needsTypeProtection) {
      // Wrap in quotes (JSON style) then CSV quote
      return this._csvQuote(JSON.stringify(s));
    }

    // Check if it needs CSV quoting (delimiters)
    if (this._needsQuotes(s)) {
      return this._csvQuote(s);
    }

    return s;
  }

  /**
   * Check if string is an ISO 8601 date/datetime.
   * Examples: "2025-01-01", "2025-01-01T10:00:00Z", "2025-01-01T10:00:00+05:30"
   */
  private _isISODate(s: string): boolean {
    // ISO 8601 full datetime with timezone
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(s)) {
      return true;
    }
    // ISO 8601 date only
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return true;
    }
    // Simple time
    if (/^\d{2}:\d{2}:\d{2}$/.test(s)) {
      return true;
    }
    return false;
  }

  /**
   * Determine if string needs type protection (quoting to preserve as string).
   * v1.0.3: More precise - only protect actual numbers, not complex patterns.
   */
  private _needsTypeProtection(s: string): boolean {
    const sLower = s.toLowerCase();
    
    // Reserved words
    if (['t', 'f', 'true', 'false', 'null', 'none', 'nil'].includes(sLower)) {
      return true;
    }
    
    // Gas/Liquid tokens
    if ([GAS_TOKEN, LIQUID_TOKEN].includes(s)) {
      return true;
    }
    
    // Leading/trailing whitespace must be preserved
    if (s.trim() !== s) {
      return true;
    }
    
    // Control characters need JSON escaping
    if (/[\n\r\t]/.test(s)) {
      return true;
    }

    // Pure integer: "123" or "-456"
    if (/^-?\d+$/.test(s)) {
      return true;
    }

    // Pure decimal: "3.14" or "-2.5"
    if (/^-?\d+\.\d+$/.test(s)) {
      return true;
    }

    // Scientific notation: "1e5", "2.5e-3"
    if (/^-?\d+(\.\d+)?e[+-]?\d+$/i.test(s)) {
      return true;
    }

    // OPTIMIZATION 2: Complex patterns DON'T need quoting
    // Examples that should NOT be quoted:
    // - "192.168.1.1" (IP address - dots distinguish from number)
    // - "u123" (alphanumeric ID - letter prefix)
    // - "v1.0.3" (version string)
    // - "2025-01-01" (date - handled by _isISODate above)
    
    // If it starts/ends with digit but has non-numeric chars, check carefully
    if (/^\d/.test(s) || /\d$/.test(s)) {
      // Try parsing - if it parses cleanly and matches, it's a number
      const num = parseFloat(s);
      if (!isNaN(num) && String(num) === s) {
        return true;  // It's actually a pure number like "3.14159"
      }
      // Otherwise it's a complex pattern like "192.168.1.1" - NO PROTECTION
    }

    return false;
  }

  /**
   * Determine if a string needs quotes.
   */
  private _needsQuotes(s: string): boolean {
    if (!s) {
      return true;
    }

    // Reserved tokens need quoting
    if (['T', 'F', 'null', GAS_TOKEN, LIQUID_TOKEN].includes(s)) {
      return true;
    }

    // Quote if it looks like a number (to preserve string type)
    if (/^-?\d+$/.test(s)) {
      return true;
    }
    try {
      parseFloat(s);
      if (!isNaN(parseFloat(s))) {
        return true;
      }
    } catch (e) {
      // ignore
    }

    // Quote if leading/trailing whitespace (preserved)
    if (s.trim() !== s) {
      return true;
    }

    // Only quote if contains delimiter or control chars
    if (/[,\n\r\t"\[\]|;:]/.test(s)) {
      return true;
    }

    return false;
  }

  /**
   * Flatten nested dictionary with depth limit.
   */
  private _flatten(
    d: any,
    parent: string = '',
    sep: string = '.',
    maxDepth: number = 0,
    currentDepth: number = 0,
    visited: WeakSet<object> = new WeakSet()
  ): Record<string, any> {
    if (typeof d === 'object' && d !== null) {
      if (visited.has(d)) {
        throw new Error('Circular reference detected');
      }
      visited.add(d);
    }

    if (typeof d !== 'object' || d === null || Array.isArray(d)) {
      return parent ? { [parent]: d } : {};
    }

    const items: [string, any][] = [];
    for (const [k, v] of Object.entries(d)) {
      const newKey = parent ? `${parent}${sep}${k}` : k;

      // DEPTH LIMIT: Stop flattening beyond max_depth
      if (typeof v === 'object' && v !== null && !Array.isArray(v) && currentDepth < maxDepth) {
        // Recursively flatten this level
        const flattened = this._flatten(v, newKey, sep, maxDepth, currentDepth + 1, visited);
        items.push(...Object.entries(flattened));
      } else {
        // Keep as-is: primitives or objects beyond depth limit
        items.push([newKey, v]);
      }
    }

    return Object.fromEntries(items);
  }
}

/**
 * Convenience function to encode data to ZON v1.0.2 format.
 */
export function encode(data: any, anchorInterval: number = DEFAULT_ANCHOR_INTERVAL): string {
  return new ZonEncoder(anchorInterval).encode(data);
}
