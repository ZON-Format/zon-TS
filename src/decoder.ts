/**
 * ZON Decoder v1.0.2 - ClearText Format
 *
 * This decoder parses clean, document-style ZON with YAML-like metadata
 * and CSV-like tables using @table syntax.
 */

import { TABLE_MARKER, META_SEPARATOR } from './constants';
import { ZonDecodeError } from './exceptions';

interface TableInfo {
  cols: string[];
  rows: Record<string, any>[];
  prev_vals: Record<string, any>;
  row_index: number;
  expected_rows: number;
}

export class ZonDecoder {
  /**
   * Decode ZON v1.0.2 ClearText format to original data structure.
   */
  decode(zonStr: string): any {
    if (!zonStr) {
      return {};
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

      // Skip blank lines
      if (!trimmedLine) {
        continue;
      }

      // Table header: @hikes(2): id, name, sunny
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
      // Metadata line: key: value
      else if (trimmedLine.includes(META_SEPARATOR)) {
        currentTable = null;  // Exit table mode (safety)
        const sepIndex = trimmedLine.indexOf(META_SEPARATOR);
        const key = trimmedLine.substring(0, sepIndex).trim();
        const val = trimmedLine.substring(sepIndex + 1).trim();
        metadata[key] = this._parseValue(val);
      }
    }

    // Recombine tables into metadata
    for (const [tableName, table] of Object.entries(tables)) {
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
   * Parse table header line.
   * Format: @tablename(count): col1, col2, col3
   */
  private _parseTableHeader(line: string): [string, TableInfo] {
    const pattern = new RegExp(`^${TABLE_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\w+)\\((\\d+)\\)${META_SEPARATOR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(.+)$`);
    const match = line.match(pattern);
    
    if (!match) {
      throw new ZonDecodeError(`Invalid table header: ${line}`);
    }

    const tableName = match[1];
    const count = parseInt(match[2], 10);
    const colsStr = match[3];

    // Parse column names
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
   * Parse a table row with compression token support.
   */
  private _parseTableRow(line: string, table: TableInfo): Record<string, any> {
    // Parse CSV tokens
    const tokens = this._parseCSVLine(line);

    // Pad if needed
    while (tokens.length < table.cols.length) {
      tokens.push('');
    }

    const row: Record<string, any> = {};
    const prevVals = table.prev_vals;

    for (let i = 0; i < table.cols.length; i++) {
      const col = table.cols[i];
      const tok = tokens[i];

      // Explicit value
      const val = this._parseValue(tok);
      row[col] = val;
      prevVals[col] = val;
    }

    table.row_index++;
    return row;
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
  private _parseZonNode(text: string): any {
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
        const val = this._parseZonNode(valStr);
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
      return items.map(item => this._parseZonNode(item));
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

    for (const char of text) {
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
    try {
      if (trimmed.includes('.')) {
        const num = parseFloat(trimmed);
        if (!isNaN(num)) {
          return num;
        }
      } else {
        const num = parseInt(trimmed, 10);
        if (!isNaN(num)) {
          return num;
        }
      }
    } catch (e) {
      // ignore
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
                return this._parseZonNode(stripped);
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
      return this._parseZonNode(trimmed);
    }

    // Try number
    try {
      if (trimmed.includes('.')) {
        const num = parseFloat(trimmed);
        if (!isNaN(num)) {
          return num;
        }
      } else {
        const num = parseInt(trimmed, 10);
        if (!isNaN(num)) {
          return num;
        }
      }
    } catch (e) {
      // ignore
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
 */
export function decode(data: string): any {
  return new ZonDecoder().decode(data);
}
