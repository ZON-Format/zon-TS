/**
 * ZON Decoder v2.0.0 - Compact Hybrid Format
 *
 * Supports both v1.x and v2.0.0 formats:
 * - v2.0: Compact headers (@count:), sequential ID reconstruction, sparse tables
 * - v1.x: Legacy format (@tablename(count):) for backward compatibility
 */

import { TABLE_MARKER, META_SEPARATOR, MAX_DOCUMENT_SIZE, MAX_LINE_LENGTH, MAX_ARRAY_LENGTH, MAX_OBJECT_KEYS, MAX_NESTING_DEPTH } from './constants';
import { ZonDecodeError } from './exceptions';

export interface DecodeOptions {
  strict?: boolean;  // Default: true
}

interface TableInfo {
  cols: string[];
  omittedCols?: string[];  // v2.0: Sequential columns to reconstruct
  rows: Record<string, any>[];
  prev_vals: Record<string, any>;
  row_index: number;
  expected_rows: number;
}

export class ZonDecoder {
  private strict: boolean;
  private currentLine: number;

  constructor(options: DecodeOptions = {}) {
    this.strict = options.strict ?? true;
    this.currentLine = 0;
  }

  /**
   * Decode ZON v1.0.2 ClearText format to original data structure.
   */
  decode(zonStr: string): any {
    if (!zonStr) {
      return {};
    }

    // Security: Check document size
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

    // Special case: Root-level ZON list (irregular schema)
    // If entire input is a single line starting with [, it's a ZON list
    if (lines.length === 1 && lines[0].trim().startsWith('[')) {
      return this._parseZonNode(lines[0]);
    }

    // Main decode loop
    const metadata: Record<string, any> = {};
    const tables: Record<string, TableInfo> = {};
    let currentTable: TableInfo | null = null;
    let currentTableName: string | null = null;

    for (const line of lines) {
      const trimmedLine = line.trimEnd();

      // Security: Check line length
      if (trimmedLine.length > MAX_LINE_LENGTH) {
        throw new ZonDecodeError(
          `[E302] Line length exceeds maximum (${MAX_LINE_LENGTH} chars)`,
          { code: 'E302', line: this.currentLine }
        );
      }

      // Skip blank lines  
      if (!trimmedLine) {
        continue;
      }

      // Table header (Anonymous or Legacy): @...
      if (trimmedLine.startsWith(TABLE_MARKER)) {
        const [tableName, tableInfo] = this._parseTableHeader(trimmedLine);
        currentTableName = tableName;
        currentTable = tableInfo;
        tables[currentTableName] = currentTable;
      }
      // Table row (if we're in a table and haven't read all rows)
      else if (currentTable !== null && currentTable.row_index < currentTable.expected_rows) {
        const row = this._parseTableRow(trimmedLine, currentTable);
        currentTable.rows.push(row);

        // If we've read all rows, exit table mode
        if (currentTable.row_index >= currentTable.expected_rows) {
          currentTable = null;
        }
      }
      // Metadata line OR Named Table (v2.1): key: @...
      else if (trimmedLine.includes(META_SEPARATOR)) {
        const sepIndex = trimmedLine.indexOf(META_SEPARATOR);
        const key = trimmedLine.substring(0, sepIndex).trim();
        const val = trimmedLine.substring(sepIndex + 1).trim();
        
        // Check if it's a named table start: users: @(5)...
        if (val.startsWith(TABLE_MARKER)) {
          // Parse header from value part
          // We pass the value part (e.g. "@(5):col1,col2") to _parseTableHeader
          // But _parseTableHeader expects the full line or needs adjustment.
          // Let's adjust _parseTableHeader to handle anonymous format "@(count)..." 
          // and we assign the key as the table name.
          const [_, tableInfo] = this._parseTableHeader(val);
          currentTableName = key;
          currentTable = tableInfo;
          tables[currentTableName] = currentTable;
        } else {
          currentTable = null;  // Exit table mode (safety)
          metadata[key] = this._parseValue(val);
        }
      }
    }

    // Recombine tables into metadata
    for (const [tableName, table] of Object.entries(tables)) {
      // Strict mode: validate row count
      if (this.strict && table.rows.length !== table.expected_rows) {
        throw new ZonDecodeError(
          `[E001] Row count mismatch in table '${tableName}': expected ${table.expected_rows}, got ${table.rows.length}`,
          { code: 'E001', context: `Table: ${tableName}` }
        );
      }
      
      metadata[tableName] = this._reconstructTable(table);
    }

    // Unflatten dotted keys
    const result = this._unflatten(metadata);

    // Unwrap pure lists: if only key is 'data', return the list directly
    if (Object.keys(result).length === 1 && 'data' in result && Array.isArray(result.data)) {
      return result.data;
    }

    return result;
  }

  /**
   * Parse table header line (supports v1.x and v2.0.0 formats).
   * v2.0: @count[omitted]: cols or @count: cols
   * v1.x: @tablename(count): cols
   */
  private _parseTableHeader(line: string): [string, TableInfo] {
    // Try v2.0 format with name: @name(count)[col][col]:columns
    const v2NamedPattern = /^@(\w+)\((\d+)\)(\[\w+\])*:(.+)$/;
    const v2NamedMatch = line.match(v2NamedPattern);

    if (v2NamedMatch) {
      const tableName = v2NamedMatch[1];
      const count = parseInt(v2NamedMatch[2], 10);
      const omittedStr = v2NamedMatch[3] || '';
      const colsStr = v2NamedMatch[4];

      // Parse omitted columns
      const omittedCols: string[] = [];
      if (omittedStr) {
        const matches = omittedStr.matchAll(/\[(\w+)\]/g);
        for (const m of matches) {
          omittedCols.push(m[1]);
        }
      }

      const cols = colsStr.split(',').map(c => c.trim());

      return [tableName, {
        cols,
        omittedCols,
        rows: [],
        prev_vals: Object.fromEntries(cols.map(col => [col, null])),
        row_index: 0,
        expected_rows: count
      }];
    }

    // Try v2.1 format (anonymous/value): @(count)[col]:columns
    const v2ValuePattern = /^@\((\d+)\)(\[\w+\])*:(.+)$/;
    const v2ValueMatch = line.match(v2ValuePattern);

    if (v2ValueMatch) {
      const count = parseInt(v2ValueMatch[1], 10);
      const omittedStr = v2ValueMatch[2] || '';
      const colsStr = v2ValueMatch[3];

      // Parse omitted columns
      const omittedCols: string[] = [];
      if (omittedStr) {
        const matches = omittedStr.matchAll(/\[(\w+)\]/g);
        for (const m of matches) {
          omittedCols.push(m[1]);
        }
      }

      const cols = colsStr.split(',').map(c => c.trim());

      return ['data', {
        cols,
        omittedCols,
        rows: [],
        prev_vals: Object.fromEntries(cols.map(col => [col, null])),
        row_index: 0,
        expected_rows: count
      }];
    }

    // Try v2.0 format (anonymous): @count[col][col]:columns
    const v2Pattern = /^@(\d+)(\[\w+\])*:(.+)$/;
    const v2Match = line.match(v2Pattern);
    
    if (v2Match) {
      const count = parseInt(v2Match[1], 10);
      const omittedStr = v2Match[2] || '';
      const colsStr = v2Match[3];

      // Parse omitted columns
      const omittedCols: string[] = [];
      if (omittedStr) {
        const matches = omittedStr.matchAll(/\[(\w+)\]/g);
        for (const m of matches) {
          omittedCols.push(m[1]);
        }
      }

      // Parse visible columns
      const cols = colsStr.split(',').map(c => c.trim());

      return ['data', {
        cols,
        omittedCols,
        rows: [],
        prev_vals: Object.fromEntries(cols.map(col => [col, null])),
        row_index: 0,
        expected_rows: count
      }];
    }

    // Fallback to v1.x format: @tablename(count):cols
    const v1Pattern = /^@(\w+)\((\d+)\):(.+)$/;
    const v1Match = line.match(v1Pattern);
    
    if (!v1Match) {
      throw new ZonDecodeError(`Invalid table header: ${line}`);
    }

    const tableName = v1Match[1];
    const count = parseInt(v1Match[2], 10);
    const colsStr = v1Match[3];
    const cols = colsStr.split(',').map(c => c.trim());

    return [tableName, {
      cols,
      rows: [],
      prev_vals: Object.fromEntries(cols.map(col => [col, null])),
      row_index: 0,
      expected_rows: count
    }];
  }

  /**
   * Parse a table row with v2.0 sparse encoding support.
   */
  private _parseTableRow(line: string, table: TableInfo): Record<string, any> {
    const tokens = this._parseCSVLine(line);

    // Strict mode: validate field count (before padding)
    const coreFieldCount = tokens.length;
    let sparseFieldCount = 0;
    
    // Count sparse fields (key:value after core fields)
    for (let i = table.cols.length; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok.includes(':') && !this._isURL(tok) && !this._isTimestamp(tok)) {
        sparseFieldCount++;
      }
    }
    
    const actualCoreFields = Math.min(coreFieldCount, table.cols.length);
    
    // In strict mode, core fields must match column count (unless we have sparse fields)
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

    // Pad if needed
    while (tokens.length < table.cols.length) {
      tokens.push('');
    }

    const row: Record<string, any> = {};
    let tokenIdx = 0;

    // Parse core columns
    for (const col of table.cols) {
      if (tokenIdx < tokens.length) {
        const tok = tokens[tokenIdx];
        row[col] = this._parseValue(tok);
        tokenIdx++;
      }
    }

    // Parse optional fields (v2.0 sparse encoding: key:value)
    while (tokenIdx < tokens.length) {
      const tok = tokens[tokenIdx];
      if (tok.includes(':') && !this._isURL(tok) && !this._isTimestamp(tok)) {
        // Try to parse as key:value
        const colonIdx = tok.indexOf(':');
        const key = tok.substring(0, colonIdx).trim();
        const val = tok.substring(colonIdx + 1).trim();
        
        // Validate key is a simple identifier
        if (/^[a-zA-Z_]\w*$/.test(key)) {
          row[key] = this._parseValue(val);
        } else {
          // Not a key:value pair, might be a value with colon
          // This shouldn't happen in well-formed data
        }
      }
      tokenIdx++;
    }

    // Reconstruct omitted sequential columns (v2.0)
    if (table.omittedCols) {
      for (const col of table.omittedCols) {
        row[col] = table.row_index + 1;
      }
    }

    table.row_index++;
    return row;
  }

  /**
   * Check if string is a URL.
   */
  private _isURL(s: string): boolean {
    return /^https?:\/\//.test(s) || /^[\/]/.test(s);
  }

  /**
   * Check if string is a timestamp with colons.
   */
  private _isTimestamp(s: string): boolean {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s) || /^\d{2}:\d{2}:\d{2}/.test(s);
  }

  /**
   * Simple CSV line parser
   */
  private _parseCSVLine(line: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuote = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];

      if (char === '"') {
        if (inQuote) {
          // Check for escaped quote
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i += 2;
            continue;
          } else {
            inQuote = false;
            i++;
            continue;
          }
        } else {
          inQuote = true;
          i++;
          continue;
        }
      }

      if (!inQuote && char === ',') {
        tokens.push(current);
        current = '';
        i++;
        continue;
      }

      current += char;
      i++;
    }

    tokens.push(current);
    return tokens;
  }

  /**
   * Reconstruct table from parsed rows.
   */
  private _reconstructTable(table: TableInfo): any[] {
    return table.rows.map(row => this._unflatten(row));
  }

  /**
   * Recursive parser for YAML-like ZON nested format.
   * - Dict: {key:val,key:val}
   * - List: [val,val]
   */
  private _parseZonNode(text: string, depth: number = 0): any {
    if (depth > 100) {
      throw new ZonDecodeError('Maximum nesting depth exceeded (100)');
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return null;
    }

    // Dict: {k:v,k:v}
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const content = trimmed.substring(1, trimmed.length - 1).trim();
      if (!content) {
        return {};
      }

      const obj: Record<string, any> = {};
      // Split by comma, respecting nesting
      const pairs = this._splitByDelimiter(content, ',');

      // Security: Check object key count
      if (pairs.length > MAX_OBJECT_KEYS) {
        throw new ZonDecodeError(
          `[E304] Object key count exceeds maximum (${MAX_OBJECT_KEYS} keys)`,
          { code: 'E304' }
        );
      }

      for (const pair of pairs) {
        if (!pair.includes(':')) {
          continue;
        }

        // Find first unquoted colon
        const colonPos = this._findDelimiter(pair, ':');
        if (colonPos === -1) {
          continue;
        }

        const keyStr = pair.substring(0, colonPos).trim();
        const valStr = pair.substring(colonPos + 1).trim();

        const key = this._parsePrimitive(keyStr);
        const val = this._parseZonNode(valStr, depth + 1);
        obj[key] = val;
      }

      return obj;
    }

    // List: [v,v]
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const content = trimmed.substring(1, trimmed.length - 1).trim();
      if (!content) {
        return [];
      }

      const items = this._splitByDelimiter(content, ',');
      
      // Security: Check array length
      if (items.length > MAX_ARRAY_LENGTH) {
        throw new ZonDecodeError(
          `[E303] Array length exceeds maximum (${MAX_ARRAY_LENGTH} items)`,
          { code: 'E303' }
        );
      }
      
      return items.map(item => this._parseZonNode(item, depth + 1));
    }

    // Leaf node (primitive)
    return this._parsePrimitive(trimmed);
  }

  /**
   * Find first occurrence of delimiter outside quotes.
   */
  private _findDelimiter(text: string, delim: string): number {
    let inQuote = false;
    let quoteChar: string | null = null;
    let depth = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // Handle escaped characters
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
   * Split text by delimiter, respecting quotes and nesting.
   */
  private _splitByDelimiter(text: string, delim: string): string[] {
    const parts: string[] = [];
    const current: string[] = [];
    let inQuote = false;
    let quoteChar: string | null = null;
    let depth = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    // Handle escaped characters
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
   * Parse a primitive value (T/F/null/number/string) without checking for ZON structure.
   */
  private _parsePrimitive(val: string): any {
    const trimmed = val.trim();

    // Case-insensitive boolean and null handling
    const valLower = trimmed.toLowerCase();

    // Booleans
    if (['t', 'true'].includes(valLower)) {
      return true;
    }
    if (['f', 'false'].includes(valLower)) {
      return false;
    }

    // Null
    if (['null', 'none', 'nil'].includes(valLower)) {
      return null;
    }

    // Quoted string (JSON style)
    if (trimmed.startsWith('"')) {
      try {
        return JSON.parse(trimmed);
      } catch (e) {
        // ignore
      }
    }

    // Try number
    if (trimmed !== '') {
      const num = Number(trimmed);
      if (!isNaN(num)) {
        return num;
      }
    }

    // String
    return trimmed;
  }

  /**
   * Parse a cell value. Handles primitives and delegates complex types.
   */
  private _parseValue(val: string): any {
    const trimmed = val.trim();

    // Quoted string (JSON style) - must check BEFORE primitives
    if (trimmed.startsWith('"')) {
      try {
        const decoded = JSON.parse(trimmed);
        // If decoded value is a string that looks like a ZON structure, parse it recursively
        if (typeof decoded === 'string') {
          const stripped = decoded.trim();
          if (stripped.startsWith('{') || stripped.startsWith('[')) {
            return this._parseZonNode(stripped);
          }
        }
        return decoded;
      } catch (e) {
        // Fallback: CSV unquoting for metadata values
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
          const unquoted = trimmed.substring(1, trimmed.length - 1).replace(/""/g, '"');

          // Try to parse unquoted value as JSON
          try {
            const decodedUnquoted = JSON.parse(unquoted);
            // If it's a string, check if it's a ZON node (recursive)
            if (typeof decodedUnquoted === 'string') {
              const stripped = decodedUnquoted.trim();
              if (stripped.startsWith('{') || stripped.startsWith('[')) {
                return this._parseZonNode(stripped, 0);
              }
            }
            return decodedUnquoted;
          } catch (e2) {
            // ignore
          }

          // Check for ZON structure in unquoted string
          const stripped = unquoted.trim();
          if (stripped.startsWith('{') || stripped.startsWith('[')) {
            return this._parseZonNode(stripped);
          }

          return unquoted;
        }
      }
    }

    // Booleans (case-insensitive)
    const valLower = trimmed.toLowerCase();
    if (['t', 'true'].includes(valLower)) {
      return true;
    }
    if (['f', 'false'].includes(valLower)) {
      return false;
    }

    // Null (case-insensitive)
    if (['null', 'none', 'nil'].includes(valLower)) {
      return null;
    }

    // Check for ZON-style nested structures (braced)
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return this._parseZonNode(trimmed, 0);
    }

    // Try number
    if (trimmed !== '') {
      const num = Number(trimmed);
      if (!isNaN(num)) {
        return num;
      }
    }

    // Double-encoded JSON string fallback
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      try {
        return JSON.parse(trimmed);
      } catch (e) {
        // ignore
      }
    }

    return trimmed;
  }

  /**
   * Unflatten dictionary with dotted keys.
   */
  private _unflatten(d: Record<string, any>): any {
    const result: any = {};

    for (const [key, value] of Object.entries(d)) {
      // Check if key has dot notation
      if (!key.includes('.')) {
        // Simple key, just assign
        result[key] = value;
        continue;
      }

      const parts = key.split('.');
      
      // SECURITY: Prevent prototype pollution
      if (parts.some(p => p === '__proto__' || p === 'constructor' || p === 'prototype')) {
        continue;
      }

      let target: any = result;

      // Navigate/create nested structure
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        const nextPart = parts[i + 1];

        // Check if next part is a number (array index)
        if (/^\d+$/.test(nextPart)) {
          const idx = parseInt(nextPart, 10);

          // Create array if needed
          if (!(part in target)) {
            target[part] = [];
          }

          // Extend array to accommodate index
          while (target[part].length <= idx) {
            target[part].push({});
          }

          // Move into the indexed element
          target = target[part][idx];
          // Skip the numeric index in the path
          parts.splice(i + 1, 1);
          break;
        } else {
          // Regular nested object
          if (!(part in target)) {
            target[part] = {};
          }

          // Only navigate deeper if it's a dict
          if (typeof target[part] === 'object' && !Array.isArray(target[part])) {
            target = target[part];
          } else {
            // Already has a value, can't navigate deeper
            break;
          }
        }
      }

      // Set the final value
      const finalKey = parts[parts.length - 1];
      if (!/^\d+$/.test(finalKey)) {  // Don't use numeric index as key
        target[finalKey] = value;
      }
    }

    return result;
  }
}

/**
 * Convenience function to decode ZON v1.0.2 format to original data.
 * @param data - ZON format string
 * @param options - Decode options (strict mode, etc.)
 */
export function decode(data: string, options?: DecodeOptions): any {
  return new ZonDecoder(options).decode(data);
}
