import { TABLE_MARKER, META_SEPARATOR, MAX_DOCUMENT_SIZE, MAX_LINE_LENGTH, MAX_ARRAY_LENGTH, MAX_OBJECT_KEYS, MAX_NESTING_DEPTH } from './constants';
import { ZonDecodeError } from './exceptions';
import { parseValue } from './utils';

export interface DecodeOptions {
  strict?: boolean;
}

interface TableInfo {
  cols: string[];
  omittedCols?: string[];
  rows: Record<string, any>[];
  prev_vals: Record<string, any>;
  row_index: number;
  expected_rows: number;
  dictionaries?: Map<string, string[]>;
  deltaCols?: Set<string>;
}

export class ZonDecoder {
  private strict: boolean;
  private currentLine: number;

  constructor(options: DecodeOptions = {}) {
    this.strict = options.strict ?? true;
    this.currentLine = 0;
  }

  /**
   * Decodes ZON format string to original data structure.
   * 
   * @param zonStr - ZON formatted string
   * @returns Decoded data
   */
  decode(zonStr: string): any {
    if (!zonStr) {
      return {};
    }

    if (zonStr.length > MAX_DOCUMENT_SIZE) {
      throw new ZonDecodeError(
        `[E301] Document size exceeds maximum (${MAX_DOCUMENT_SIZE} bytes)`,
        { code: 'E301' }
      );
    }

    const lines = zonStr.trim().split('\n');
    if (lines.length === 0) {
      return {};
    }

    if (lines.length === 1) {
      const line = lines[0].trim();
      if (line.startsWith('[')) {
        return this._parseZonNode(line);
      }
      const hasBlock = /^[a-zA-Z0-9_]+\s*[\{\[]/.test(line);
      
      if (!line.includes(META_SEPARATOR) && !line.startsWith(TABLE_MARKER) && !hasBlock) {
        return this._parseValue(line);
      }
    }

    const metadata: Record<string, any> = {};
    const tables: Record<string, TableInfo> = {};
    let currentTable: TableInfo | null = null;
    let currentTableName: string | null = null;
    let pendingDictionaries = new Map<string, string[]>();

    for (const line of lines) {
      const trimmedLine = line.trimEnd();

      if (trimmedLine.length > MAX_LINE_LENGTH) {
        throw new ZonDecodeError(
          `[E302] Line length exceeds maximum (${MAX_LINE_LENGTH} chars)`,
          { code: 'E302', line: this.currentLine }
        );
      }
  
      if (!trimmedLine) {
        continue;
      }

      const dictMatch = trimmedLine.match(/^([\w\.]+)\[(\d+)\]:(.+)$/);
      if (dictMatch && !trimmedLine.startsWith(TABLE_MARKER)) {
        const [, col, , vals] = dictMatch;
        pendingDictionaries.set(col, vals.split(','));
        continue;
      }

      if (trimmedLine.startsWith(TABLE_MARKER)) {
        const [tableName, tableInfo] = this._parseTableHeader(trimmedLine);
        
        if (pendingDictionaries.size > 0) {
          tableInfo.dictionaries = new Map(pendingDictionaries);
          pendingDictionaries.clear();
        }

        currentTableName = tableName;
        currentTable = tableInfo;
        tables[currentTableName] = currentTable;
      }
      else if (currentTable !== null && currentTable.row_index < currentTable.expected_rows) {
        const row = this._parseTableRow(trimmedLine, currentTable);
        currentTable.rows.push(row);

        if (currentTable.row_index >= currentTable.expected_rows) {
          currentTable = null;
        }
      }
      else {
        let splitIdx = -1;
        let splitChar = '';
        let depth = 0;
        let inQuote = false;
        
        for (let i = 0; i < trimmedLine.length; i++) {
          const char = trimmedLine[i];
          if (char === '"') inQuote = !inQuote;
          if (!inQuote) {
            if (char === '{' || char === '[') depth++;
            if (char === '}' || char === ']') depth--;
            
            if (depth === 1 && (char === '{' || char === '[')) {
               if (splitIdx === -1) {
                 splitIdx = i;
                 splitChar = char;
                 break;
               }
            }
            if (char === ':' && depth === 0) {
               splitIdx = i;
               splitChar = ':';
               break;
            }
          }
        }
        
        if (splitIdx !== -1) {
          let key: string;
          let val: string;
          
          if (splitChar === ':') {
             key = trimmedLine.substring(0, splitIdx).trim();
             val = trimmedLine.substring(splitIdx + 1).trim();
          } else {
             key = trimmedLine.substring(0, splitIdx).trim();
             val = trimmedLine.substring(splitIdx).trim();
          }
          
          if (val.startsWith(TABLE_MARKER)) {
            const [_, tableInfo] = this._parseTableHeader(val);
            currentTableName = key;
            currentTable = tableInfo;
            tables[currentTableName] = currentTable;
          } else {
            currentTable = null;
            metadata[key] = this._parseValue(val);
          }
        }
      }
    }

    for (const [tableName, table] of Object.entries(tables)) {
      if (this.strict && table.rows.length !== table.expected_rows) {
        throw new ZonDecodeError(
          `[E001] Row count mismatch in table '${tableName}': expected ${table.expected_rows}, got ${table.rows.length}`,
          { code: 'E001', context: `Table: ${tableName}` }
        );
      }
      
      metadata[tableName] = this._reconstructTable(table);
    }

    const result = this._unflatten(metadata);

    if (Object.keys(result).length === 1 && 'data' in result && Array.isArray(result.data)) {
      return result.data;
    }

    return result;
  }

  /**
   * Parses table header line.
   * 
   * @param line - Header line to parse
   * @returns Tuple of [tableName, tableInfo]
   */
  private _parseTableHeader(line: string): [string, TableInfo] {
    const v2NamedPattern = /^@(\w+)\((\d+)\)(\[\w+\])*:(.+)$/;
    const v2NamedMatch = line.match(v2NamedPattern);

    if (v2NamedMatch) {
      const tableName = v2NamedMatch[1];
      const count = parseInt(v2NamedMatch[2], 10);
      const omittedStr = v2NamedMatch[3] || '';
      const colsStr = v2NamedMatch[4];

      const omittedCols: string[] = [];
      if (omittedStr) {
        const matches = omittedStr.matchAll(/\[(\w+)\]/g);
        for (const m of matches) {
          omittedCols.push(m[1]);
        }
      }

      const rawCols = colsStr.split(',').map(c => c.trim());
      const cols: string[] = [];
      const deltaCols = new Set<string>();

      for (const rawCol of rawCols) {
        if (rawCol.endsWith(':delta')) {
          const colName = rawCol.substring(0, rawCol.length - 6);
          cols.push(colName);
          deltaCols.add(colName);
        } else {
          cols.push(rawCol);
        }
      }

      return [tableName, {
        cols,
        omittedCols,
        rows: [],
        prev_vals: Object.fromEntries(cols.map(col => [col, null])),
        row_index: 0,
        expected_rows: count,
        deltaCols
      }];
    }

    const v2ValuePattern = /^@\((\d+)\)(\[\w+\])*:(.+)$/;
    const v2ValueMatch = line.match(v2ValuePattern);

    if (v2ValueMatch) {
      const count = parseInt(v2ValueMatch[1], 10);
      const omittedStr = v2ValueMatch[2] || '';
      const colsStr = v2ValueMatch[3];

      const omittedCols: string[] = [];
      if (omittedStr) {
        const matches = omittedStr.matchAll(/\[(\w+)\]/g);
        for (const m of matches) {
          omittedCols.push(m[1]);
        }
      }

      const rawCols = colsStr.split(',').map(c => c.trim());
      const cols: string[] = [];
      const deltaCols = new Set<string>();

      for (const rawCol of rawCols) {
        if (rawCol.endsWith(':delta')) {
          const colName = rawCol.substring(0, rawCol.length - 6);
          cols.push(colName);
          deltaCols.add(colName);
        } else {
          cols.push(rawCol);
        }
      }

      return ['data', {
        cols,
        omittedCols,
        rows: [],
        prev_vals: Object.fromEntries(cols.map(col => [col, null])),
        row_index: 0,
        expected_rows: count,
        deltaCols
      }];
    }

    const v2Pattern = /^@(\d+)(\[\w+\])*:(.+)$/;
    const v2Match = line.match(v2Pattern);
    
    if (v2Match) {
      const count = parseInt(v2Match[1], 10);
      const omittedStr = v2Match[2] || '';
      const colsStr = v2Match[3];

      const omittedCols: string[] = [];
      if (omittedStr) {
        const matches = omittedStr.matchAll(/\[(\w+)\]/g);
        for (const m of matches) {
          omittedCols.push(m[1]);
        }
      }

      const rawCols = colsStr.split(',').map(c => c.trim());
      const cols: string[] = [];
      const deltaCols = new Set<string>();

      for (const rawCol of rawCols) {
        if (rawCol.endsWith(':delta')) {
          const colName = rawCol.substring(0, rawCol.length - 6);
          cols.push(colName);
          deltaCols.add(colName);
        } else {
          cols.push(rawCol);
        }
      }

      return ['data', {
        cols,
        omittedCols,
        rows: [],
        prev_vals: Object.fromEntries(cols.map(col => [col, null])),
        row_index: 0,
        expected_rows: count,
        deltaCols
      }];
    }

    const v1Pattern = /^@(\w+)\((\d+)\):(.+)$/;
    const v1Match = line.match(v1Pattern);
    
    if (!v1Match) {
      throw new ZonDecodeError(`Invalid table header: ${line}`);
    }

    const tableName = v1Match[1];
    const count = parseInt(v1Match[2], 10);
    const colsStr = v1Match[3];
    const rawCols = colsStr.split(',').map(c => c.trim());
    const cols: string[] = [];
    const deltaCols = new Set<string>();

    for (const rawCol of rawCols) {
      if (rawCol.endsWith(':delta')) {
        const colName = rawCol.substring(0, rawCol.length - 6);
        cols.push(colName);
        deltaCols.add(colName);
      } else {
        cols.push(rawCol);
      }
    }

    return [tableName, {
      cols,
      rows: [],
      prev_vals: Object.fromEntries(cols.map(col => [col, null])),
      row_index: 0,
      expected_rows: count,
      deltaCols
    }];
  }

  /**
   * Parses a table row with sparse encoding support.
   * 
   * @param line - Row line to parse
   * @param table - Table information
   * @returns Parsed row object
   */
  private _parseTableRow(line: string, table: TableInfo): Record<string, any> {
    const tokens = this._splitByDelimiter(line, ',');

    const coreFieldCount = tokens.length;
    let sparseFieldCount = 0;
    
    for (let i = table.cols.length; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok.includes(':') && !this._isURL(tok) && !this._isTimestamp(tok)) {
        sparseFieldCount++;
      }
    }
    
    const actualCoreFields = Math.min(coreFieldCount, table.cols.length);
    
    if (this.strict && coreFieldCount < table.cols.length && sparseFieldCount === 0) {
      throw new ZonDecodeError(
        `[E002] Field count mismatch on row ${table.row_index + 1}: expected ${table.cols.length} fields, got ${coreFieldCount}`,
        { 
          code: 'E002',
          line: this.currentLine,
          context: line.substring(0, 50) + (line.length > 50 ? '...' : '')
        }
      );
    }

    while (tokens.length < table.cols.length) {
      tokens.push('');
    }

    const row: Record<string, any> = {};
    let tokenIdx = 0;

    for (const col of table.cols) {
      if (tokenIdx < tokens.length) {
        const tok = tokens[tokenIdx];
        let val = this._parseValue(tok);

        if (table.dictionaries && table.dictionaries.has(col) && typeof val === 'number') {
          const dict = table.dictionaries.get(col)!;
          if (val >= 0 && val < dict.length) {
            val = dict[val];
          }
        }

        if (table.deltaCols && table.deltaCols.has(col)) {
          if (table.row_index === 0) {
            table.prev_vals[col] = val;
          } else {
            if (typeof val === 'number' && typeof table.prev_vals[col] === 'number') {
              val = table.prev_vals[col] + val;
              table.prev_vals[col] = val;
            } else {
              table.prev_vals[col] = val;
            }
          }
        }

        row[col] = val;
        tokenIdx++;
      }
    }

    while (tokenIdx < tokens.length) {
      const tok = tokens[tokenIdx];
      if (tok.includes(':') && !this._isURL(tok) && !this._isTimestamp(tok)) {
        const colonIdx = tok.indexOf(':');
        const key = tok.substring(0, colonIdx).trim();
        const val = tok.substring(colonIdx + 1).trim();
        
        if (/^[a-zA-Z_][\w\.]*$/.test(key)) {
          row[key] = this._parseValue(val);
        }
      }
      tokenIdx++;
    }

    if (table.omittedCols) {
      for (const col of table.omittedCols) {
        row[col] = table.row_index + 1;
      }
    }

    table.row_index++;
    return row;
  }

  /**
   * Checks if string is a URL.
   * 
   * @param s - String to check
   * @returns True if URL format
   */
  private _isURL(s: string): boolean {
    return /^https?:\/\//.test(s) || /^[\/]/.test(s);
  }

  /**
   * Checks if string is a timestamp.
   * 
   * @param s - String to check
   * @returns True if timestamp format
   */
  private _isTimestamp(s: string): boolean {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s) || /^\d{2}:\d{2}:\d{2}/.test(s);
  }



  /**
   * Reconstructs table from parsed rows.
   * 
   * @param table - Table information
   * @returns Array of reconstructed objects
   */
  private _reconstructTable(table: TableInfo): any[] {
    return table.rows.map(row => this._unflatten(row));
  }

  /**
   * Recursively parses ZON nested structures.
   * 
   * @param text - Text to parse
   * @param depth - Current nesting depth
   * @returns Parsed value
   */
  private _parseZonNode(text: string, depth: number = 0): any {
    if (depth > 100) {
      throw new ZonDecodeError('Maximum nesting depth exceeded (100)');
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const content = trimmed.substring(1, trimmed.length - 1).trim();
      if (!content) {
        return {};
      }

      const obj: Record<string, any> = {};
      const pairs = this._splitByDelimiter(content, ',');

      if (pairs.length > MAX_OBJECT_KEYS) {
        throw new ZonDecodeError(
          `[E304] Object key count exceeds maximum (${MAX_OBJECT_KEYS} keys)`,
          { code: 'E304' }
        );
      }

      for (const pair of pairs) {
        let keyStr: string;
        let valStr: string;
        
        let splitIdx = -1;
        let splitChar = '';
        let inQuote = false;
        let quoteChar = '';
        let depth = 0;
        
        for (let i = 0; i < pair.length; i++) {
          const char = pair[i];
          
          if (char === '\\' && i + 1 < pair.length) {
            i++; continue;
          }
          
          if (['"', "'"].includes(char)) {
            if (!inQuote) { inQuote = true; quoteChar = char; }
            else if (char === quoteChar) { inQuote = false; }
          } else if (!inQuote) {
            if (char === ':') {
              if (depth === 0) {
                splitIdx = i;
                splitChar = ':';
                break;
              }
            } else if (char === '{' || char === '[') {
              if (depth === 0 && splitIdx === -1) {
                splitIdx = i;
                splitChar = char;
                break; 
              }
              depth++;
            } else if (char === '}' || char === ']') {
              depth--;
            }
          }
        }
        
        if (splitIdx !== -1) {
          if (splitChar === ':') {
            keyStr = pair.substring(0, splitIdx).trim();
            valStr = pair.substring(splitIdx + 1).trim();
          } else {
            keyStr = pair.substring(0, splitIdx).trim();
            valStr = pair.substring(splitIdx).trim();
          }
        } else {
          continue;
        }

        const key = this._parseValue(keyStr);
        const val = this._parseZonNode(valStr, depth + 1);
        obj[key] = val;
      }

      return obj;
    }

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const content = trimmed.substring(1, trimmed.length - 1).trim();
      if (!content) {
        return [];
      }

      const items = this._splitByDelimiter(content, ',');
      
      if (items.length > MAX_ARRAY_LENGTH) {
        throw new ZonDecodeError(
          `[E303] Array length exceeds maximum (${MAX_ARRAY_LENGTH} items)`,
          { code: 'E303' }
        );
      }
      
      return items.map(item => this._parseZonNode(item, depth + 1));
    }

    return this._parseValue(trimmed);
  }

  /**
   * Finds first occurrence of delimiter outside quotes.
   * 
   * @param text - Text to search
   * @param delim - Delimiter to find
   * @returns Index of delimiter or -1
   */
  private _findDelimiter(text: string, delim: string): number {
    let inQuote = false;
    let quoteChar: string | null = null;
    let depth = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '\\' && i + 1 < text.length) {
      i++; // Skip next char
      continue;
    }

    if (['"', "'"].includes(char)) {
      if (!inQuote) {
        inQuote = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuote = false;
        quoteChar = null;
      }
    } else if (!inQuote) {
      if (['{', '['].includes(char)) {
        depth++;
      } else if (['}', ']'].includes(char)) {
        depth--;
      } else if (char === delim && depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

  /**
   * Splits text by delimiter while respecting quotes and nesting.
   * 
   * @param text - Text to split
   * @param delim - Delimiter character
   * @returns Array of split parts
   */
  private _splitByDelimiter(text: string, delim: string): string[] {
    const parts: string[] = [];
    const current: string[] = [];
    let inQuote = false;
    let quoteChar: string | null = null;
    let depth = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (char === '\\' && i + 1 < text.length) {
      current.push(char);
      current.push(text[++i]);
      continue;
    }

    if (['"', "'"].includes(char)) {
      if (!inQuote) {
        inQuote = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuote = false;
        quoteChar = null;
      }
      current.push(char);
    } else if (!inQuote) {
      if (['{', '['].includes(char)) {
        depth++;
        current.push(char);
      } else if (['}', ']'].includes(char)) {
        depth--;
        current.push(char);
      } else if (char === delim && depth === 0) {
        parts.push(current.join(''));
        current.length = 0;
      } else {
        current.push(char);
      }
    } else {
      current.push(char);
    }
  }

  if (current.length > 0) {
    parts.push(current.join(''));
  }

  return parts;
}

  /**
   * Parses a primitive value.
   * 
   * @param val - Value string to parse
   * @returns Parsed primitive value
   */
  /**
   * Parses a value, handling primitives and nested ZON structures.
   * 
   * @param val - Value string to parse
   * @returns Parsed value
   */
  private _parseValue(val: string): any {
    const trimmedVal = val.trim();
    const parsed = parseValue(val);
    
    // If the value was explicitly quoted, it is a string.
    // Do not attempt to parse it as a ZON node, even if it looks like one.
    if (trimmedVal.startsWith('"')) {
      return parsed;
    }
    
    if (typeof parsed === 'string') {
      const trimmed = parsed.trim();
      
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return this._parseZonNode(trimmed);
      }
    }
    
    return parsed;
  }



  /**
   * Unflattens dictionary with dotted keys.
   * 
   * @param d - Flattened dictionary
   * @returns Unflattened object
   */
  private _unflatten(d: Record<string, any>): any {
    const result: any = {};

    for (const [key, value] of Object.entries(d)) {
      if (!key.includes('.')) {
        result[key] = value;
        continue;
      }

      const parts = key.split('.');
      
      if (parts.some(p => p === '__proto__' || p === 'constructor' || p === 'prototype')) {
        continue;
      }

      let target: any = result;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        const nextPart = parts[i + 1];

        if (/^\d+$/.test(nextPart)) {
          const idx = parseInt(nextPart, 10);

          if (!(part in target)) {
            target[part] = [];
          }

          while (target[part].length <= idx) {
            target[part].push({});
          }

          target = target[part][idx];
          parts.splice(i + 1, 1);
          break;
        } else {
          if (!(part in target)) {
            target[part] = {};
          }

          if (typeof target[part] === 'object' && !Array.isArray(target[part])) {
            target = target[part];
          } else {
            break;
          }
        }
      }

      const finalKey = parts[parts.length - 1];
      if (!/^\d+$/.test(finalKey)) {
        target[finalKey] = value;
      }
    }

    return result;
  }
}

/**
 * Decodes ZON format string to original data v1.1.0.
 * 
 * @param data - ZON format string
 * @param options - Decode options
 * @returns Decoded data
 */
export function decode(data: string, options?: DecodeOptions): any {
  return new ZonDecoder(options).decode(data);
}
