/**
 * ZON Encoder v1.0.2 - ClearText Format
 *
 * This encoder produces clean, document-style output with YAML-like metadata
 * and CSV-like tables using @table syntax.
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

    // Special case: Irregular schema detection for lists of dicts
    if (Array.isArray(data) && data.length > 0 && data.every(item => typeof item === 'object' && !Array.isArray(item))) {
      // Check if all records have the same keys
      const allKeys = data.map(item => new Set(Object.keys(item)));
      const firstKeysStr = JSON.stringify([...allKeys[0]].sort());
      const hasIrregularSchema = allKeys.some(keys => JSON.stringify([...keys].sort()) !== firstKeysStr);
      
      if (hasIrregularSchema) {
        // Irregular schema - encode as list of objects to preserve exact structure
        return this._formatZonNode(data);
      }
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
      return [data, {}, null];  // stream_key is null for pure lists
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
   * Write table in @table format with compression.
   */
  private _writeTable(stream: any[], key: string): string[] {
    if (!stream || stream.length === 0) {
      return [];
    }

    const lines: string[] = [];

    // Flatten all rows
    const flatStream = stream.map(row => this._flatten(row));

    // Get column names
    const allKeysSet = new Set<string>();
    flatStream.forEach(d => Object.keys(d).forEach(k => allKeysSet.add(k)));
    const cols = Array.from(allKeysSet).sort();

    // Write table header
    const colNames = cols.join(",");  // No space after comma for compactness
    lines.push(`${TABLE_MARKER}${key}(${stream.length})${META_SEPARATOR}${colNames}`);

    // Write rows
    for (const row of flatStream) {
      const tokens: string[] = [];

      for (const col of cols) {
        const val = row[col];
        tokens.push(this._formatValue(val));
      }

      lines.push(tokens.join(","));
    }

    return lines;
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
  private _formatZonNode(val: any): string {
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
        const vStr = this._formatZonNode(val[k]);
        items.push(`${kStr}:${vStr}`);
      }
      return "{" + items.join(",") + "}";
    } else if (Array.isArray(val)) {
      if (val.length === 0) {
        return "[]";
      }
      return "[" + val.map(item => this._formatZonNode(item)).join(",") + "]";
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
      // Preserve exact numeric representation
      if (!Number.isInteger(val)) {
        let s = String(val);
        // Ensure decimal point for whole number floats
        if (!/[\.e]/i.test(s)) {
          s += '.0';
        }
        return s;
      } else {
        return String(val);
      }
    }

    if (Array.isArray(val) || (typeof val === 'object' && val !== null)) {
      // Use ZON-style formatting for complex types
      const zonStr = this._formatZonNode(val);
      if (this._needsQuotes(zonStr)) {
        return this._csvQuote(zonStr);
      }
      return zonStr;
    }

    // String formatting
    const s = String(val);

    // Check if it looks like a number/bool/null (needs type protection)
    // OR has control characters that need escaping
    let needsTypeProtection = false;
    const sLower = s.toLowerCase();
    if (['t', 'f', 'true', 'false', 'null', 'none', 'nil'].includes(sLower)) {
      needsTypeProtection = true;
    } else if ([GAS_TOKEN, LIQUID_TOKEN].includes(s)) {
      needsTypeProtection = true;
    } else if (/^-?\d+$/.test(s)) {
      needsTypeProtection = true;
    } else if (s.trim() !== s) { // Leading/trailing whitespace
      needsTypeProtection = true;
    } else if (/[\n\r\t]/.test(s)) { // Control characters need JSON escaping
      needsTypeProtection = true;
    } else {
      try {
        parseFloat(s);
        if (!isNaN(parseFloat(s))) {
          needsTypeProtection = true;
        }
      } catch (e) {
        // ignore
      }
    }

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
    currentDepth: number = 0
  ): Record<string, any> {
    if (typeof d !== 'object' || d === null || Array.isArray(d)) {
      return parent ? { [parent]: d } : {};
    }

    const items: [string, any][] = [];
    for (const [k, v] of Object.entries(d)) {
      const newKey = parent ? `${parent}${sep}${k}` : k;

      // DEPTH LIMIT: Stop flattening beyond max_depth
      if (typeof v === 'object' && v !== null && !Array.isArray(v) && currentDepth < maxDepth) {
        // Recursively flatten this level
        const flattened = this._flatten(v, newKey, sep, maxDepth, currentDepth + 1);
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
