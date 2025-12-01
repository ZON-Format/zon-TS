import {
  TABLE_MARKER,
  META_SEPARATOR,
  GAS_TOKEN,
  LIQUID_TOKEN,
  DEFAULT_ANCHOR_INTERVAL
} from './constants';
import { SparseMode } from './types';
import { TypeInferrer } from './type-inference';

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

/**
 * Encodes data structures into ZON format v1.0.5.
 */
export class ZonEncoder {
  private anchor_interval: number;
  private safe_str_re: RegExp;

  private enableDictionaryCompression: boolean;
  private enableTypeCoercion: boolean;
  private typeInferrer: TypeInferrer;

  constructor(
    anchorInterval: number = DEFAULT_ANCHOR_INTERVAL, 
    enableDictCompression: boolean = true,
    enableTypeCoercion: boolean = false
  ) {
    this.anchor_interval = anchorInterval;
    this.safe_str_re = /^[a-zA-Z0-9_\-\.]+$/;
    this.enableDictionaryCompression = enableDictCompression;
    this.enableTypeCoercion = enableTypeCoercion;
    this.typeInferrer = new TypeInferrer();
  }

  /**
   * Encodes data to ZON format.
   * 
   * @param data - Data to encode
   * @returns ZON formatted string
   */
  encode(data: any): string {
    const [streamData, metadata, streamKey] = this._extractPrimaryStream(data);

    if (!streamData && (!metadata || Object.keys(metadata).length === 0)) {
      if (typeof data === 'object' && data !== null) {
        if (!Array.isArray(data) && Object.keys(data).length === 0) {
            return "";
        }
        return this._formatZonNode(data);
      }
      return JSON.stringify(data);
    }

    const output: string[] = [];

    if (Array.isArray(data) && data.length > 0 && data.every(item => typeof item === 'object' && !Array.isArray(item))) {
      const irregularityScore = this._calculateIrregularity(data);
      
      if (irregularityScore > 0.6) {
        return this._formatZonNode(data);
      }
    }

    let finalStreamKey = streamKey;
    if (streamData && streamKey === null) {
      finalStreamKey = "data";
    }

    if (metadata && Object.keys(metadata).length > 0) {
      output.push(...this._writeMetadata(metadata));
    }

    if (streamData && finalStreamKey) {
      if (output.length > 0) {
        output.push("");
      }
      output.push(...this._writeTable(streamData, finalStreamKey));
    }

    return output.join("\n");
  }

  /**
   * Extracts the primary data stream from input.
   * 
   * @param data - Input data
   * @returns Tuple of [stream, metadata, key]
   */
  private _extractPrimaryStream(data: any): [any[] | null, Record<string, any>, string | null] {
    if (Array.isArray(data)) {
      if (data.length > 0 && typeof data[0] === 'object' && data[0] !== null && !Array.isArray(data[0])) {
        return [data, {}, null];
      }
      
      if (data.length > 0 && data.every(item => typeof item !== 'object' || item === null)) {
        return [null, {}, null];
      }

      return [null, {}, null];
    }

    if (typeof data === 'object' && data !== null) {
      const candidates: [string, any[], number][] = [];
      
      for (const [k, v] of Object.entries(data)) {
        if (Array.isArray(v) && v.length > 0) {
          if (typeof v[0] === 'object' && !Array.isArray(v[0])) {
            const score = v.length * Object.keys(v[0]).length;
            candidates.push([k, v, score]);
          }
        }
      }

      if (candidates.length > 0) {
        candidates.sort((a, b) => {
          const scoreDiff = b[2] - a[2];
          if (scoreDiff !== 0) return scoreDiff;
          return a[0].localeCompare(b[0]);
        });
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
   * Writes metadata section in YAML-like format.
   * 
   * @param metadata - Metadata object
   * @returns Array of formatted lines
   */
  private _writeMetadata(metadata: Record<string, any>): string[] {
    const lines: string[] = [];
    // Do not flatten. Iterate top-level keys.
    const sortedKeys = Object.keys(metadata).sort();
    
    for (const key of sortedKeys) {
      const val = metadata[key];
      
      if (typeof val === 'object' && val !== null) {
        // Use recursive formatter for objects/arrays
        const valStr = this._formatZonNode(val);
        if (valStr.startsWith('{') || valStr.startsWith('[')) {
          lines.push(`${key}${valStr}`);
        } else {
          // Should not happen for objects, but safety fallback
          lines.push(`${key}${META_SEPARATOR}${valStr}`);
        }
      } else {
        // Primitive
        const valStr = this._formatValue(val);
        lines.push(`${key}${META_SEPARATOR}${valStr}`);
      }
    }

    return lines;
  }



  private _analyzeOptimalSparseMode(values: any[]): SparseMode {
    if (values.length < 5) return SparseMode.NONE;

    // Check for delta encoding (sequential numbers)
    let isDelta = true;
    let isNumeric = true;
    
    for (let i = 0; i < values.length; i++) {
      const val = values[i];
      if (typeof val !== 'number') {
        isNumeric = false;
        break;
      }
    }

    if (isNumeric) {
      // Check if delta is efficient (small diffs)
      // Simple heuristic: if diffs are mostly small integers
      // For now, just enable for all numeric columns to test mechanism
      return SparseMode.DELTA;
    }

    return SparseMode.NONE;
  }

  private _encodeDeltaColumn(values: number[]): string {
    if (values.length === 0) return '';
    
    const deltas: string[] = [String(values[0])];
    for (let i = 1; i < values.length; i++) {
      const delta = values[i] - values[i - 1];
      // Use + for positive diffs to distinguish from absolute values if we mixed them
      // But for pure delta column, we can just use the number. 
      // However, ZON spec says delta values should be explicit.
      // Let's use signed integers: +1, -5, 0.
      // 0 is just 0.
      deltas.push(delta >= 0 ? `+${delta}` : String(delta));
    }
    
    return deltas.join('');
  }

  /**
   * Writes table data with adaptive encoding strategy.
   * 
   * @param stream - Array of data objects
   * @param key - Table key name
   * @returns Array of formatted lines
   */
  private _writeTable(stream: any[], key: string): string[] {
    if (!stream || stream.length === 0) {
      return [];
    }

    const lines: string[] = [];
    // Enable deep flattening for Hierarchical Sparse Encoding
    const flatStream = stream.map(row => this._flatten(row, '', '.', 5));

    const allKeysSet = new Set<string>();
    flatStream.forEach(d => Object.keys(d).forEach(k => allKeysSet.add(k)));
    let cols = Array.from(allKeysSet).sort();

    // Type Coercion
    if (this.enableTypeCoercion) {
      for (const col of cols) {
        const values = flatStream.map(row => row[col]);
        const inferred = this.typeInferrer.inferColumnType(values);
        
        if (inferred.coercible) {
          // Coerce all values in this column
          for (const row of flatStream) {
            if (col in row && row[col] !== undefined && row[col] !== null) {
              row[col] = this.typeInferrer.coerce(row[col], inferred);
            }
          }
        }
      }
    }

    const dictionaries = this.enableDictionaryCompression ? this._detectDictionaries(flatStream, cols) : new Map();

    if (dictionaries.size > 0) {
      return this._writeDictionaryTable(flatStream, cols, dictionaries, stream.length, key);
    }

    const columnStats = this._analyzeColumnSparsity(flatStream, cols);
    const coreColumns = columnStats.filter(c => c.presence >= 0.7).map(c => c.name);
    const optionalColumns = columnStats.filter(c => c.presence < 0.7).map(c => c.name);

    // Check for Delta Encoding
    const deltaColumns: string[] = [];
    const regularCoreColumns: string[] = [];
    
    for (const col of coreColumns) {
      const values = flatStream.map(row => row[col]);
      const mode = this._analyzeOptimalSparseMode(values);
      if (mode === SparseMode.DELTA) {
        deltaColumns.push(col);
      } else {
        regularCoreColumns.push(col);
      }
    }

    if (deltaColumns.length > 0) {
      return this._writeDeltaTable(flatStream, regularCoreColumns, deltaColumns, optionalColumns, stream.length, key);
    }

    // Relaxed threshold for sparse encoding to support hierarchical data
    // If we have many sparse columns (e.g. from nested fields), sparse encoding is usually better
    const useSparseEncoding = optionalColumns.length > 0;

    if (useSparseEncoding) {
      return this._writeSparseTable(flatStream, coreColumns, optionalColumns, stream.length, key);
    } else {
      return this._writeStandardTable(flatStream, cols, stream.length, key);
    }
  }

  private _writeDeltaTable(
    flatStream: Record<string, any>[],
    regularCols: string[],
    deltaCols: string[],
    optionalCols: string[],
    rowCount: number,
    key: string
  ): string[] {
    const lines: string[] = [];
    
    let header = '';
    if (key && key !== 'data') {
      header = `${key}${META_SEPARATOR}${TABLE_MARKER}(${rowCount})`;
    } else {
      header = `${TABLE_MARKER}${rowCount}`;
    }

    // Delta columns syntax: col:delta
    const deltaDefs = deltaCols.map(c => `${c}:delta`);
    const allCols = [...deltaDefs, ...regularCols];
    
    header += `${META_SEPARATOR}${allCols.join(',')}`;
    lines.push(header);

    // Pre-calculate deltas
    const deltaValuesMap = new Map<string, string>();
    for (const col of deltaCols) {
      const values = flatStream.map(row => row[col]);
      deltaValuesMap.set(col, this._encodeDeltaColumn(values));
    }

    // Write delta values first (as a single block per column? No, ZON is row-based usually)
    // Wait, ZON row-based delta would be: 1000,+1,+1...
    // But if we mix with other columns, it gets messy.
    // Let's stick to row-based:
    // row 1: 1000, Alice
    // row 2: +1, Bob
    // row 3: +1, Charlie
    
    for (let i = 0; i < rowCount; i++) {
      const row = flatStream[i];
      const tokens: string[] = [];

      for (const col of deltaCols) {
        const val = row[col];
        if (i === 0) {
          tokens.push(String(val));
        } else {
          const prev = flatStream[i-1][col];
          const diff = val - prev;
          tokens.push(diff >= 0 ? `+${diff}` : String(diff));
        }
      }

      for (const col of regularCols) {
        const val = row[col];
        if (val === undefined || val === null) {
          tokens.push('null');
        } else {
          tokens.push(this._formatValue(val));
        }
      }

      // Optional columns (sparse)
      for (const col of optionalCols) {
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
   * Writes standard table format.
   * 
   * @param flatStream - Flattened data rows
   * @param cols - Column names
   * @param rowCount - Number of rows
   * @param key - Table key
   * @returns Array of formatted lines
   */
  private _writeStandardTable(flatStream: Record<string, any>[], cols: string[], rowCount: number, key: string): string[] {
    const lines: string[] = [];

    const omittedCols = this._analyzeSequentialColumns(flatStream, cols);

    let header = '';
    if (key && key !== 'data') {
      header = `${key}${META_SEPARATOR}${TABLE_MARKER}(${rowCount})`;
    } else {
      header = `${TABLE_MARKER}${rowCount}`;
    }

    if (omittedCols.length > 0) {
      header += omittedCols.map(c => `[${c}]`).join('');
    }

    const visibleCols = cols.filter(c => !omittedCols.includes(c));
    header += `${META_SEPARATOR}${visibleCols.join(',')}`;
    lines.push(header);

    for (const row of flatStream) {
      const tokens: string[] = [];
      for (const col of visibleCols) {
        const val = row[col];
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
   * Writes sparse table format for semi-uniform data.
   * 
   * @param flatStream - Flattened data rows
   * @param coreColumns - Core column names
   * @param optionalColumns - Optional column names
   * @param rowCount - Number of rows
   * @param key - Table key
   * @returns Array of formatted lines
   */
  private _writeSparseTable(
    flatStream: Record<string, any>[],
    coreColumns: string[],
    optionalColumns: string[],
    rowCount: number,
    key: string
  ): string[] {
    const lines: string[] = [];

    const omittedCols = this._analyzeSequentialColumns(flatStream, coreColumns);

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

    for (const row of flatStream) {
      const tokens: string[] = [];

      for (const col of visibleCoreColumns) {
        tokens.push(this._formatValue(row[col]));
      }

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
   * Analyzes column presence across rows.
   * 
   * @param data - Array of data rows
   * @param cols - Column names
   * @returns Array of column statistics
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
   * Detects sequential columns for potential omission.
   * Disabled in v1.0.5 for improved LLM accuracy.
   * 
   * @param data - Array of data rows
   * @param cols - Column names
   * @returns Array of omittable column names
   */
  private _analyzeSequentialColumns(data: Record<string, any>[], cols: string[]): string[] {
    return [];
  }

  private _detectDictionaries(data: Record<string, any>[], cols: string[]): Map<string, string[]> {
    const dictionaries = new Map<string, string[]>();

    for (const col of cols) {
      const values = data.map(row => row[col]).filter(v => typeof v === 'string');
      if (values.length < data.length * 0.8) continue;

      const uniqueValues = Array.from(new Set(values));
      const repetitionRate = 1 - (uniqueValues.length / values.length);
      const avgLength = uniqueValues.reduce((sum, v) => sum + v.length, 0) / uniqueValues.length;

      const currentTokens = values.length * avgLength;
      // More accurate reference cost: 1 char for <10, 2 for <100
      const refCost = uniqueValues.length < 10 ? 1 : (uniqueValues.length < 100 ? 2 : 3);
      
      // Overhead: col[N]:val,val...
      // col name + [ + N + ]: + values + commas
      const valuesLength = uniqueValues.reduce((sum, v) => sum + v.length, 0);
      const definitionOverhead = col.length + 4 + valuesLength + (uniqueValues.length - 1);
      
      const dictTokens = valuesLength + (values.length * refCost) + definitionOverhead;
      const savings = (currentTokens - dictTokens) / currentTokens;

      // Lower threshold slightly for small datasets if repetition is high
      const threshold = values.length < 20 ? 0.1 : 0.2;

      if (savings > threshold && uniqueValues.length < values.length / 2 && uniqueValues.length <= 50) {
        dictionaries.set(col, uniqueValues.sort());
      }
    }

    return dictionaries;
  }

  private _writeDictionaryTable(
    flatStream: Record<string, any>[],
    cols: string[],
    dictionaries: Map<string, string[]>,
    rowCount: number,
    key: string
  ): string[] {
    const lines: string[] = [];

    for (const [col, values] of dictionaries) {
      lines.push(`${col}[${values.length}]:${values.join(',')}`);
    }

    const dictCols = Array.from(dictionaries.keys());
    const regularCols = cols.filter(c => !dictionaries.has(c));
    const allCols = [...dictCols, ...regularCols];

    let header = '';
    if (key && key !== 'data') {
      header = `${key}${META_SEPARATOR}${TABLE_MARKER}(${rowCount})`;
    } else {
      header = `${TABLE_MARKER}${rowCount}`;
    }
    header += `${META_SEPARATOR}${allCols.join(',')}`;
    lines.push(header);

    for (const row of flatStream) {
      const tokens: string[] = [];

      for (const col of dictCols) {
        const value = row[col];
        const dict = dictionaries.get(col)!;
        const index = dict.indexOf(value);
        tokens.push(String(index));
      }

      for (const col of regularCols) {
        const val = row[col];
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
   * Analyzes columns for compression opportunities.
   * 
   * @param data - Array of data rows
   * @param cols - Column names
   * @returns Column analysis results
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
        }
      }

      if (vals.length > 1) {
        try {
          const unique = new Set(vals.map(v => JSON.stringify(v)));
          if (unique.size < vals.length) {
            result.has_repetition = true;
          }
        } catch (e) {
        }
      }

      analysis[col] = result;
    }

    return analysis;
  }

  /**
   * Calculates schema irregularity score for array of objects.
   * 
   * @param data - Array of objects
   * @returns Irregularity score from 0.0 (uniform) to 1.0 (irregular)
   */
  private _calculateIrregularity(data: Record<string, any>[]): number {
    if (data.length === 0) {
      return 0;
    }

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

    let totalOverlap = 0;
    let comparisons = 0;

    for (let i = 0; i < keySets.length; i++) {
      for (let j = i + 1; j < keySets.length; j++) {
        const keys1 = keySets[i];
        const keys2 = keySets[j];
        
        let shared = 0;
        keys1.forEach(k => {
          if (keys2.has(k)) shared++;
        });
        
        const union = keys1.size + keys2.size - shared;
        const similarity = union > 0 ? shared / union : 1;
        
        totalOverlap += similarity;
        comparisons++;
      }
    }

    if (comparisons === 0) {
      return 0;
    }

    const avgSimilarity = totalOverlap / comparisons;
    const irregularity = 1 - avgSimilarity;

    return irregularity;
  }

  /**
   * Quotes string for CSV format (RFC 4180).
   * 
   * @param s - String to quote
   * @returns Quoted string
   */
  private _csvQuote(s: string): string {
    const escaped = s.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  /**
   * Formats nested structures using ZON syntax.
   * 
   * @param val - Value to format
   * @param visited - Set of visited objects for circular reference detection
   * @returns Formatted string
   */
  private _formatZonNode(val: any, visited: WeakSet<object> = new WeakSet()): string {
    if (typeof val === 'object' && val !== null) {
      if (visited.has(val)) {
        throw new Error('Circular reference detected');
      }
      visited.add(val);
    }

    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      const keys = Object.keys(val).sort();
      if (keys.length === 0) {
        return "{}";
      }
      const items: string[] = [];
      for (const k of keys) {
        let kStr = String(k);
        if (/[,:\{\}\[\]"]/.test(kStr)) {
          kStr = JSON.stringify(kStr);
        }

        const vStr = this._formatZonNode(val[k], visited);
        
        if (vStr.startsWith('{') || vStr.startsWith('[')) {
          items.push(`${kStr}${vStr}`);
        } else {
          items.push(`${kStr}:${vStr}`);
        }
      }
      return "{" + items.join(",") + "}";
    } else if (Array.isArray(val)) {
      if (val.length === 0) {
        return "[]";
      }
      return "[" + val.map(item => this._formatZonNode(item, visited)).join(",") + "]";
    }

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
      if (!Number.isInteger(val)) {
        let s = String(val);
        if (!/[\.e]/i.test(s)) {
          s += '.0';
        }
        return s;
      } else {
        return String(val);
      }
    }

  const s = String(val);

  if (s.includes('\n') || s.includes('\r')) {
    return JSON.stringify(s);
  }

  if (this._isISODate(s)) {
    return s;
  }

  if (this._needsTypeProtection(s)) {
    return JSON.stringify(s);
  }

  if (!s.trim()) {
    return JSON.stringify(s);
  }

  if (/[,\{\}\[\]"]/.test(s)) {
    return JSON.stringify(s);
  }

  return s;
}

  /**
   * Formats a value with minimal quoting.
   * 
   * @param val - Value to format
   * @returns Formatted string
   */
  private _formatValue(val: any): string {
    if (val === null || val === undefined) {
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
      if (!Number.isFinite(val)) {
        return "null";
      }
      
      if (Number.isInteger(val)) {
        return String(val);
      }
      
      let s = String(val);
      
      if (s.includes('e') || s.includes('E')) {
        const parts = s.split(/[eE]/);
        const mantissa = parseFloat(parts[0]);
        const exponent = parseInt(parts[1], 10);
        
        if (exponent >= 0) {
          s = (mantissa * Math.pow(10, exponent)).toString();
        } else {
          s = mantissa.toFixed(Math.abs(exponent));
        }
      }
      
      if (!s.includes('.')) {
        s += '.0';
      }
      
      return s;
    }

    if (Array.isArray(val) || (typeof val === 'object' && val !== null)) {
    return this._formatZonNode(val);
  }

    const s = String(val);



    if (this._isISODate(s)) {
      return s;
    }



    const needsTypeProtection = this._needsTypeProtection(s);

    if (needsTypeProtection) {
      return this._zonQuote(s);
    }

    if (this._needsQuotes(s)) {
      return this._zonQuote(s);
    }

    return s;
  }

  /**
   * Quotes a string using ZON rules (CSV-style quotes + JSON-style control chars).
   */
  private _zonQuote(s: string): string {
    // Use JSON.stringify to handle control characters (\n, \t, etc.) and backslashes
    const json = JSON.stringify(s);
    // Strip outer quotes
    const inner = json.slice(1, -1);
    // Convert JSON escaped quotes (\") to CSV escaped quotes ("")
    // Note: JSON.stringify escapes " as \", so we look for \"
    const zon = inner.replace(/\\"/g, '""');
    return `"${zon}"`;
  }

  /**
   * Checks if string is an ISO 8601 date/datetime.
   * 
   * @param s - String to check
   * @returns True if ISO date format
   */
  private _isISODate(s: string): boolean {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(s)) {
      return true;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return true;
    }
    if (/^\d{2}:\d{2}:\d{2}$/.test(s)) {
      return true;
    }
    return false;
  }

  /**
   * Determines if string needs type protection quoting.
   * 
   * @param s - String to check
   * @returns True if quoting needed
   */
  private _needsTypeProtection(s: string): boolean {
    const sLower = s.toLowerCase();
    
    if (['t', 'f', 'true', 'false', 'null', 'none', 'nil'].includes(sLower)) {
      return true;
    }
    
    if ([GAS_TOKEN, LIQUID_TOKEN].includes(s)) {
      return true;
    }
    
    if (s.trim() !== s) {
      return true;
    }
    
    if (/[\x00-\x1f]/.test(s)) {
      return true;
    }

    if (/^-?\d+$/.test(s)) {
      return true;
    }

    if (/^-?\d+\.\d+$/.test(s)) {
      return true;
    }

    if (/^-?\d+(\.\d+)?e[+-]?\d+$/i.test(s)) {
      return true;
    }
    
    if (/^\d/.test(s) || /\d$/.test(s)) {
      const num = parseFloat(s);
      if (!isNaN(num) && String(num) === s) {
        return true;
      }
    }

    return false;
  }

  /**
   * Determines if string needs CSV quoting.
   * 
   * @param s - String to check
   * @returns True if quoting needed
   */
  private _needsQuotes(s: string): boolean {
    if (!s) {
      return true;
    }

    if (['T', 'F', 'null', GAS_TOKEN, LIQUID_TOKEN].includes(s)) {
      return true;
    }

    if (/^-?\d+$/.test(s)) {
      return true;
    }
    try {
      parseFloat(s);
      if (!isNaN(parseFloat(s))) {
        return true;
      }
    } catch (e) {
    }

    if (s.trim() !== s) {
      return true;
    }

    if (/[,\n\r\t"\[\]|;]/.test(s)) {
      return true;
    }

    return false;
  }

  /**
   * Flattens nested dictionary with depth limit.
   * 
   * @param d - Dictionary to flatten
   * @param parent - Parent key prefix
   * @param sep - Key separator
   * @param maxDepth - Maximum flattening depth
   * @param currentDepth - Current depth level
   * @param visited - Set of visited objects
   * @returns Flattened dictionary
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

      if (typeof v === 'object' && v !== null && !Array.isArray(v) && currentDepth < maxDepth) {
        const flattened = this._flatten(v, newKey, sep, maxDepth, currentDepth + 1, visited);
        items.push(...Object.entries(flattened));
      } else {
        items.push([newKey, v]);
      }
    }

    return Object.fromEntries(items);
  }
}

/**
 * Encodes data to ZON format v1.0.5.
 * 
 * @param data - Data to encode
 * @param anchorInterval - Anchor interval for encoding
 * @returns ZON formatted string
 */
export function encode(data: any, anchorInterval: number = DEFAULT_ANCHOR_INTERVAL, options: { typeCoercion?: boolean } = {}): string {
  return new ZonEncoder(anchorInterval, true, options.typeCoercion).encode(data);
}

import { LLMOptimizer } from './llm-optimizer';

export interface LLMContext {
  model?: 'gpt-4' | 'claude' | 'gemini' | 'llama';
  task: 'retrieval' | 'generation' | 'analysis';
  contextWindow?: number;
}

/**
 * Encodes data optimized for LLM consumption.
 * 
 * @param data - Data to encode
 * @param context - LLM context and task
 * @returns Optimized ZON string
 */
export function encodeLLM(data: any, context: LLMContext): string {
  let processedData = data;

  // Optimize field order for generation/analysis tasks
  if (context.task === 'generation' || context.task === 'analysis') {
    const optimizer = new LLMOptimizer();
    if (Array.isArray(data)) {
      processedData = optimizer.optimizeFieldOrder(data);
    } else if (typeof data === 'object' && data !== null) {
      // Try to optimize values if they are arrays
      const newData: any = { ...data };
      for (const key of Object.keys(newData)) {
        if (Array.isArray(newData[key])) {
          newData[key] = optimizer.optimizeFieldOrder(newData[key]);
        }
      }
      processedData = newData;
    }
  }

  // Configure encoder based on task
  let enableDict = true;
  let enableTypeCoercion = true; // Usually good for LLMs to have clean types

  if (context.task === 'retrieval') {
    // For retrieval, we might want less compression to keep terms explicit?
    // Actually, ZON's dictionary compression is still readable enough and saves tokens.
    // But maybe disable it if we want exact string matching on raw text?
    // Let's keep it enabled as ZON's strength is density.
    // But maybe type coercion is critical here.
    enableTypeCoercion = true;
  }

  const encoder = new ZonEncoder(DEFAULT_ANCHOR_INTERVAL, enableDict, enableTypeCoercion);
  return encoder.encode(processedData);
}
