import {
  TABLE_MARKER,
  META_SEPARATOR,
  GAS_TOKEN,
  LIQUID_TOKEN,
  DEFAULT_ANCHOR_INTERVAL
} from './constants';
import { quoteString } from './utils';

import { TypeInferrer } from '../schema/type-inference';
import { embedVersion, stripVersion } from './versioning';

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

export interface EncodeOptions {
  /** Anchor interval for streaming (default: 100) */
  anchorInterval?: number;
  /** Enable dictionary compression (default: true) */
  enableDictCompression?: boolean;
  /** Enable type coercion (default: false) */
  enableTypeCoercion?: boolean;
  /** Embed version metadata in output (default: false) */
  embedMetadata?: boolean;
  /** Version string to embed (default: "1.1.0") */
  version?: string;
  /** Schema ID to embed */
  schemaId?: string;
  /** Disable table formatting (default: false) */
  disableTables?: boolean;
}

/**
 * Encodes data structures into ZON format v1.1.0.
 */
export class ZonEncoder {
  private anchor_interval: number;
  private safe_str_re: RegExp;

  private enableDictionaryCompression: boolean;
  private enableTypeCoercion: boolean;
  private disableTables: boolean;
  private typeInferrer: TypeInferrer;

  constructor(
    anchorInterval: number = DEFAULT_ANCHOR_INTERVAL, 
    enableDictCompression: boolean = true,
    enableTypeCoercion: boolean = false,
    disableTables: boolean = false
  ) {
    this.anchor_interval = anchorInterval;
    this.safe_str_re = /^[a-zA-Z0-9_\-\.]+$/;
    this.enableDictionaryCompression = enableDictCompression;
    this.enableTypeCoercion = enableTypeCoercion;
    this.disableTables = disableTables;
    this.typeInferrer = new TypeInferrer();
  }

  /**
   * Encodes data to ZON format.
   * When disableTables is true, bypasses table generation and formats data directly.
   * 
   * @param data - Data to encode
   * @param options - Optional encoding options
   * @returns ZON formatted string
   */
  encode(data: any, options?: EncodeOptions): string {
    let processedData = data;
    
    if (options?.embedMetadata) {
      processedData = embedVersion(
        data,
        options.version || '1.1.0',
        options.schemaId
      );
    }
    
    if (this.disableTables) {
       if (typeof data === 'object' && data !== null) {
         if (!Array.isArray(data) && Object.keys(data).length === 0) {
             return "";
         }
         return this._formatZonNode(processedData);
       }
       return JSON.stringify(processedData);
    }

    const [streams, metadata] = this._extractStreams(processedData);

    // If no streams and no metadata, format as node
    if (streams.size === 0 && (!metadata || Object.keys(metadata).length === 0)) {
      if (typeof data === 'object' && data !== null) {
        if (!Array.isArray(data) && Object.keys(data).length === 0) {
            return "";
        }
        return this._formatZonNode(data);
      }
      return JSON.stringify(data);
    }

    // Check for high irregularity in root-level array
    if (Array.isArray(data) && data.length > 0 && data.every(item => typeof item === 'object' && !Array.isArray(item))) {
      const irregularityScore = this._calculateIrregularity(data);
      
      if (irregularityScore > 0.6) {
        return this._formatZonNode(data);
      }
    }

    const output: string[] = [];

    // Write metadata first
    if (metadata && Object.keys(metadata).length > 0) {
      output.push(...this._writeMetadata(metadata));
    }

    // Write all streams as tables
    const streamEntries = Array.from(streams.entries()).sort((a, b) => {
      // Sort by key name for consistency
      return a[0].localeCompare(b[0]);
    });

    for (const [key, streamData] of streamEntries) {
      if (output.length > 0) {
        output.push("");
      }
      
      const finalKey = key || "data";
      output.push(...this._writeTable(streamData, finalKey));
    }

    return output.join("\n");
  }

  /**
   * Extracts all uniform arrays that should become tables.
   * 
   * @param data - Input data
   * @returns Tuple of [streams Map, metadata]
   */
  private _extractStreams(data: any): [Map<string, any[]>, Record<string, any>] {
    if (Array.isArray(data)) {
      if (data.length > 0 && typeof data[0] === 'object' && data[0] !== null && !Array.isArray(data[0])) {
        // Root-level array of objects - treat as single unnamed stream
        const streams = new Map<string, any[]>();
        streams.set('', data);
        return [streams, {}];
      }
      
      return [new Map(), {}];
    }

    if (typeof data === 'object' && data !== null) {
      const streams = new Map<string, any[]>();
      const metadata: Record<string, any> = {};
      
      for (const [k, v] of Object.entries(data)) {
        // Check if this is an array of objects (potential table)
        if (Array.isArray(v) && v.length > 0) {
          if (typeof v[0] === 'object' && v[0] !== null && !Array.isArray(v[0])) {
            // This is a uniform array - should become a table
            streams.set(k, v);
          } else {
            // Array of primitives - goes to metadata
            metadata[k] = v;
          }
        } else {
          // Non-array field - goes to metadata
          metadata[k] = v;
        }
      }

      return [streams, metadata];
    }

    return [new Map(), typeof data === 'object' ? data : {}];
  }

  /**
   * Writes metadata section in YAML-like format.
   * 
   * @param metadata - Metadata object
   * @returns Array of formatted lines
   */
  private _writeMetadata(metadata: Record<string, any>): string[] {
    const lines: string[] = [];
    const sortedKeys = Object.keys(metadata).sort();
    
    for (const key of sortedKeys) {
      const val = metadata[key];
      
      if (typeof val === 'object' && val !== null) {
        const valStr = this._formatZonNode(val);
        if (valStr.startsWith('{') || valStr.startsWith('[')) {
          lines.push(`${key}${valStr}`);
        } else {
          lines.push(`${key}${META_SEPARATOR}${valStr}`);
        }
      } else {
        const valStr = this._formatValue(val);
        lines.push(`${key}${META_SEPARATOR}${valStr}`);
      }
    }

    return lines;
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
    const flatStream = stream.map(row => this._flatten(row, '', '.', 5));

    const allKeysSet = new Set<string>();
    flatStream.forEach(d => Object.keys(d).forEach(k => allKeysSet.add(k)));
    let cols = Array.from(allKeysSet).sort();

    if (this.enableTypeCoercion) {
      for (const col of cols) {
        const values = flatStream.map(row => row[col]);
        const inferred = this.typeInferrer.inferColumnType(values);
        
        if (inferred.coercible) {
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

    const useSparseEncoding = optionalColumns.length > 0;

    if (useSparseEncoding) {
      return this._writeSparseTable(flatStream, coreColumns, optionalColumns, stream.length, key);
    } else {
      return this._writeStandardTable(flatStream, cols, stream.length, key);
    }


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

    let header = '';
    if (key && key !== 'data') {
      header = `${key}${META_SEPARATOR}${TABLE_MARKER}(${rowCount})`;
    } else {
      header = `${TABLE_MARKER}${rowCount}`;
    }

    header += `${META_SEPARATOR}${cols.join(',')}`;
    lines.push(header);

    for (const row of flatStream) {
      const tokens: string[] = [];
      for (const col of cols) {
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

    let header = '';
    if (key && key !== 'data') {
      header = `${key}${META_SEPARATOR}${TABLE_MARKER}(${rowCount})`;
    } else {
      header = `${TABLE_MARKER}${rowCount}`;
    }

    header += `${META_SEPARATOR}${coreColumns.join(',')}`;
    lines.push(header);

    for (const row of flatStream) {
      const tokens: string[] = [];

      for (const col of coreColumns) {
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
   * Detects dictionary compression opportunities for string columns.
   * 
   * @param data - Array of data rows
   * @param cols - Column names
   * @returns Map of column names to unique value dictionaries
   */
  private _detectDictionaries(data: Record<string, any>[], cols: string[]): Map<string, string[]> {
    const dictionaries = new Map<string, string[]>();

    for (const col of cols) {
      const values = data.map(row => row[col]).filter(v => typeof v === 'string');
      if (values.length < data.length * 0.8) continue;

      const uniqueValues = Array.from(new Set(values));
      const repetitionRate = 1 - (uniqueValues.length / values.length);
      const avgLength = uniqueValues.reduce((sum, v) => sum + v.length, 0) / uniqueValues.length;

      const currentTokens = values.length * avgLength;
      const refCost = uniqueValues.length < 10 ? 1 : (uniqueValues.length < 100 ? 2 : 3);
      
      const valuesLength = uniqueValues.reduce((sum, v) => sum + v.length, 0);
      const definitionOverhead = col.length + 4 + valuesLength + (uniqueValues.length - 1);
      
      const dictTokens = valuesLength + (values.length * refCost) + definitionOverhead;
      const savings = (currentTokens - dictTokens) / currentTokens;

      const threshold = values.length < 20 ? 0.1 : 0.2;

      // Heuristic: Avoid dictionary for single unique value unless it's long (readability)
      if (uniqueValues.length === 1 && uniqueValues[0].length < 20) {
        continue;
      }

      if (savings > threshold && uniqueValues.length < values.length / 2 && uniqueValues.length <= 50) {
        dictionaries.set(col, uniqueValues.sort());
      }
    }

    return dictionaries;
  }

  /**
   * Writes table with dictionary compression for string columns.
   * 
   * @param flatStream - Flattened data rows
   * @param cols - All column names
   * @param dictionaries - Map of column names to dictionaries
   * @param rowCount - Number of rows
   * @param key - Table key name
   * @returns Array of formatted lines
   */
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
    
    return this._formatValue(val);
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

    if (typeof val === 'boolean') {
      if (this.enableTypeCoercion) {
        return val ? "true" : "false";
      }
      return val ? "T" : "F";
    }
    if (typeof val === 'number') {
      if (!Number.isFinite(val)) {
        return "null";
      }
      
      // Removed scientific notation expansion as it was incorrect and unnecessary
      // ZON supports scientific notation natively
      if (Number.isInteger(val)) {
        return String(val);
      }
      
      let s = String(val);
      if (!s.includes('.') && !s.includes('e') && !s.includes('E')) {
        s += '.0';
      }
      
      return s;
    }

    if (val instanceof Date) {
      return val.toISOString();
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
      return quoteString(s);
    }

    if (this._needsQuotes(s)) {
      return quoteString(s);
    }

    return s;
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

    if (/[,\n\r\t"\[\]{};]/.test(s)) {
    return true;
  }

  // Single quotes are allowed in the middle of words, but not at the start
  // (because that would look like a quoted string to the decoder)
  if (s.startsWith("'")) {
    return true;
  }
  

    if (s.includes('//') || s.includes('/*')) {
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
 * Encodes data to ZON format v1.1.0.
 * 
 * @param data - Data to encode
 * @param options - Optional encoding options
 * @returns ZON formatted string
 */
export function encode(data: any, options?: EncodeOptions): string {
  const encoder = new ZonEncoder(
    options?.anchorInterval,
    options?.enableDictCompression,
    options?.enableTypeCoercion,
    options?.disableTables
  );
  return encoder.encode(data, options);
}

import { LLMOptimizer } from '../tools/llm-optimizer';

export interface LLMContext {
  model?: 'gpt-4' | 'claude' | 'gemini' | 'llama';
  task: 'retrieval' | 'generation' | 'analysis';
  contextWindow?: number;
}

/**
 * Encodes data optimized for LLM consumption.
 * Optimizes field order and compression based on LLM task type.
 * 
 * @param data - Data to encode
 * @param context - LLM context including model and task type
 * @returns Optimized ZON string
 */
export function encodeLLM(data: any, context: LLMContext): string {
  let processedData = data;

  if (context.task === 'generation' || context.task === 'analysis') {
    const optimizer = new LLMOptimizer();
    if (Array.isArray(data)) {
      processedData = optimizer.optimizeFieldOrder(data);
    } else if (typeof data === 'object' && data !== null) {
      const newData: any = { ...data };
      for (const key of Object.keys(newData)) {
        if (Array.isArray(newData[key])) {
          newData[key] = optimizer.optimizeFieldOrder(newData[key]);
        }
      }
      processedData = newData;
    }
  }

  const enableDict = true;
  let enableTypeCoercion = true;

  if (context.task === 'retrieval') {
    enableTypeCoercion = true;
  }

  const encoder = new ZonEncoder(DEFAULT_ANCHOR_INTERVAL, enableDict, enableTypeCoercion);
  return encoder.encode(processedData);
}
