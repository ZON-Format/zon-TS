import { TABLE_MARKER, META_SEPARATOR, MAX_DOCUMENT_SIZE, MAX_LINE_LENGTH, MAX_ARRAY_LENGTH, MAX_OBJECT_KEYS, MAX_NESTING_DEPTH } from './constants';
import { ZonDecodeError } from './exceptions';
import { parseValue } from './utils';
import { extractVersion, stripVersion, type ZonDocumentMetadata } from './versioning';

export interface DecodeOptions {
  strict?: boolean;
  /** Extract version metadata from decoded data (default: false) */
  extractMetadata?: boolean;
}

export interface DecodeResult {
  data: any;
  metadata?: ZonDocumentMetadata;
}

interface TableInfo {
  cols: string[];
  omittedCols?: string[];
  rows: Record<string, any>[];
  prev_vals: Record<string, any>;
  row_index: number;
  expected_rows: number;
  dictionaries?: Map<string, string[]>;
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
   * @param options - Optional decode options
   * @returns Decoded data or DecodeResult if extractMetadata is true
   */
  decode(zonStr: string, options?: DecodeOptions): any | DecodeResult {
    if (!zonStr) {
      return {};
    }

    if (zonStr.length > MAX_DOCUMENT_SIZE) {
      throw new ZonDecodeError(
        `[E301] Document size exceeds maximum (${MAX_DOCUMENT_SIZE} bytes)`,
        { code: 'E301' }
      );
    }

    const lines = this._splitByDelimiter(zonStr.trim(), '\n');
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

    for (let i = 0; i < lines.length; i++) {
      this.currentLine = i + 1;
      const line = lines[i];
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
        
        for (let j = 0; j < trimmedLine.length; j++) {
          const char = trimmedLine[j];
          if (char === '"') inQuote = !inQuote;
          if (!inQuote) {
            if (char === '{' || char === '[') depth++;
            if (char === '}' || char === ']') depth--;
            
            if (depth === 1 && (char === '{' || char === '[')) {
               if (splitIdx === -1) {
                 splitIdx = j;
                 splitChar = char;
                 break;
               }
            }
            if (char === ':' && depth === 0) {
               splitIdx = j;
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
          

          if (!val && !trimmedLine.trim().endsWith('{') && !trimmedLine.trim().endsWith('[')) {
             const currentIndent = line.search(/\S/);
             if (i + 1 < lines.length) {
                const nextIndent = lines[i+1].search(/\S/);
                if (nextIndent > currentIndent) {

                   const blockLines: string[] = [];
                   while (i + 1 < lines.length) {
                      const nextLine = lines[i+1];
                      

                      if (!nextLine.trim()) {

                         blockLines.push('');
                         i++;
                         this.currentLine = i + 1;
                         continue;
                      }
                      
                      const nextLineIndent = nextLine.search(/\S/);
                      if (nextLineIndent <= currentIndent) break;
                      
                      blockLines.push(nextLine);
                      i++;
                      this.currentLine = i + 1;
                   }

                   const normalizedLines = blockLines.map((line, idx) => {
                     if (!line.trim()) return line;
                     const lineIndent = line.search(/\S/);
                     if (lineIndent === -1) return line;

                     return lineIndent >= nextIndent ? line.substring(nextIndent) : line;
                   });
                   val = normalizedLines.join('\n');
                }
             }
          }
          
          if (val.startsWith(TABLE_MARKER)) {
            const [_, tableInfo] = this._parseTableHeader(val);
            
            if (pendingDictionaries.size > 0) {
              tableInfo.dictionaries = new Map(pendingDictionaries);
              pendingDictionaries.clear();
            }

            currentTableName = key;
            currentTable = tableInfo;
            tables[currentTableName] = currentTable;
          } else {
            currentTable = null;
            metadata[key] = this._parseZonNode(val);
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

    if (options?.extractMetadata) {
      const meta = extractVersion(result);
      if (meta) {
        return {
          data: stripVersion(result),
          metadata: meta
        };
      } else {
        return {
          data: result,
          metadata: undefined
        };
      }
    }

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

      for (const rawCol of rawCols) {
        cols.push(rawCol);
      }

      return [tableName, {
        cols,
        omittedCols,
        rows: [],
        prev_vals: Object.fromEntries(cols.map(col => [col, null])),
        row_index: 0,
        expected_rows: count
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

      for (const rawCol of rawCols) {
        cols.push(rawCol);
      }

      return ['data', {
        cols,
        omittedCols,
        rows: [],
        prev_vals: Object.fromEntries(cols.map(col => [col, null])),
        row_index: 0,
        expected_rows: count
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

      for (const rawCol of rawCols) {
        cols.push(rawCol);
      }

      return ['data', {
        cols,
        omittedCols,
        rows: [],
        prev_vals: Object.fromEntries(cols.map(col => [col, null])),
        row_index: 0,
        expected_rows: count
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

    for (const rawCol of rawCols) {
      cols.push(rawCol);
    }

    return [tableName, {
      cols,
      rows: [],
      prev_vals: Object.fromEntries(cols.map(col => [col, null])),
      row_index: 0,
      expected_rows: count
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
        let val = this._parseZonNode(tok);

        if (table.dictionaries && table.dictionaries.has(col) && typeof val === 'number') {
          const dict = table.dictionaries.get(col)!;
          if (val >= 0 && val < dict.length) {
            val = dict[val];
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
      // Verify that the first brace matches the last brace
      let depth = 0;
      let matchIndex = -1;
      let inQuote = false;
      let quoteChar = '';
      
      for (let i = 0; i < trimmed.length; i++) {
        const char = trimmed[i];
        if (['"', "'"].includes(char)) {
           if (!inQuote) { inQuote = true; quoteChar = char; }
           else if (char === quoteChar) { inQuote = false; }
        } else if (!inQuote) {
           if (char === '{') depth++;
           else if (char === '}') {
              depth--;
              if (depth === 0) {
                 matchIndex = i;
                 break;
              }
           }
        }
      }
      
      // Only parse as single object if the matching brace is the last character
      if (matchIndex === trimmed.length - 1) {
        const content = trimmed.substring(1, trimmed.length - 1).trim();
        if (!content) {
          return {};
        }


      const obj: Record<string, any> = {};
      const pairs = this._splitObjectProperties(content);

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
  }

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const content = trimmed.substring(1, trimmed.length - 1).trim();
      if (!content) {
        return [];
      }

      const items = this._splitByDelimiter(content, ',', true);
      
      if (items.length > MAX_ARRAY_LENGTH) {
        throw new ZonDecodeError(
          `[E303] Array length exceeds maximum (${MAX_ARRAY_LENGTH} items)`,
          { code: 'E303' }
        );
      }
      
      return items.map(item => this._parseZonNode(item, depth + 1));
    }

    // Check for implicit structure (multiline or colon-prefixed or dash-prefixed)
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[') && (trimmed.includes('\n') || trimmed.startsWith(':') || trimmed.startsWith('- '))) {
       // Check for dash-separated list (YAML-like)
       // Use original text to preserve indentation
       const lines = text.split('\n');
       const validLines = lines.filter(l => l.trim().length > 0);
       
       if (validLines.length > 0 && validLines[0].trim().startsWith('- ')) {
          // It's a dash-separated list
          const reconstructed: any[] = [];
          let currentItemLines: string[] = [];
          
          // Determine base indentation from the first dash line
          let baseIndent = -1;
          for (const line of validLines) {
            if (line.trim().startsWith('- ')) {
              baseIndent = line.search(/\S/);
              break;
            }
          }

          if (baseIndent === -1) baseIndent = 0; // Should not happen given the check above
          
          for (const line of validLines) {
             const indent = line.search(/\S/);
             const cleanLine = line.trim();
             
             // Heuristic: If baseIndent is 0 (due to trim) and we have a complete previous line,
             // and this line is indented, assume the indentation belongs to the block level (siblings).
             if (baseIndent === 0 && currentItemLines.length === 1 && !currentItemLines[0].trim().endsWith(':')) {
                if (indent > 0) {
                   baseIndent = indent;
                }
             }

             // Check if this is a new item: must start with '- ' AND have same indentation as base
             if (cleanLine.startsWith('- ') && indent === baseIndent) {
                // Start of new item
                if (currentItemLines.length > 0) {
                   reconstructed.push(this._parseZonNode(currentItemLines.join('\n'), depth + 1));
                }
                // Remove '- ' prefix (2 chars) and strip base indent
                // The line is like "  - item". indent=2. baseIndent=2.
                // We want "item".
                // line.substring(baseIndent + 2) might work, but we should trimStart?
                // cleanLine.substring(2).trim() gives "item".
                currentItemLines = [cleanLine.substring(2).trim()]; 
             } else {
                // Continuation of current item
                // Strip baseIndent characters to normalize indentation
                let contentLine = line;
                if (indent >= baseIndent) {
                  contentLine = line.substring(baseIndent);
                } else {
                  // Indent is less than base? Should not happen for valid nested content.
                  // Treat as is (or trim?)
                  contentLine = line.trim();
                }
                currentItemLines.push(contentLine);
             }
          }
          
          if (currentItemLines.length > 0) {
             reconstructed.push(this._parseZonNode(currentItemLines.join('\n'), depth + 1));
          }
          
          return reconstructed;
       }

       // Check for implicit object (newline or comma separated)
       const objPairs = this._splitObjectProperties(trimmed);
       if (objPairs.length > 1 || (objPairs.length === 1 && objPairs[0].includes(':'))) {
          // It's an object
          const obj: Record<string, any> = {};
          
          for (const pair of objPairs) {
             // Parse key:value
             // Reuse logic from brace parsing?
             // Or simple split by first colon?
             // _splitObjectProperties returns "key: value" strings.
             // We need to split by first colon, respecting quotes.
             
             let keyStr: string;
             let valStr: string;
             let splitIdx = -1;
             let inQuote = false;
             let quoteChar = '';
             
             for (let i = 0; i < pair.length; i++) {
                const char = pair[i];
                if (['"', "'"].includes(char)) {
                   if (!inQuote) { inQuote = true; quoteChar = char; }
                   else if (char === quoteChar) { inQuote = false; }
                } else if (!inQuote && char === ':') {
                   splitIdx = i;
                   break;
                }
             }
             
             if (splitIdx !== -1) {
                keyStr = pair.substring(0, splitIdx).trim();
                valStr = pair.substring(splitIdx + 1).trim();
                
                // Handle implicit array item starting with dash in value?
                // No, _parseZonNode handles that recursively.
                
                const key = this._parseValue(keyStr);
                const val = this._parseZonNode(valStr, depth + 1);
                obj[key] = val;
             }
          }
          return obj;
       }

       // Try splitting by comma ONLY first (for arrays)
       const items = this._splitByDelimiter(trimmed, ',', false);
       
       if (items.length > 1 || (items.length === 1 && items[0].startsWith(':'))) {
          // Check if it looks like an object (all items are k:v)
          let isObject = true;
          const parsedItems: any[] = [];
          
          for (const item of items) {
             const cleanItem = item.trim();
             if (cleanItem.startsWith(':')) {
                // Array item marker
                isObject = false;
                parsedItems.push(this._parseZonNode(cleanItem.substring(1), depth + 1));
             } else {
                // Check if item is an Implicit Object (multiline with multiple KVs)
                // If an item contains newlines and looks like multiple KVs, then it's an object structure,
                // so the parent must be an Array (list of objects).
                if (cleanItem.includes('\n')) {
                   const subItems = this._splitByDelimiter(cleanItem, '\n', false); // Split by newline to check structure
                   // Filter empty lines
                   const validSubItems = subItems.filter(s => s.trim().length > 0);
                   
                   if (validSubItems.length > 1) {
                      // Check if sub-items look like KVs
                      let allKVs = true;
                      for (const sub of validSubItems) {
                         const colonIdx = this._findDelimiter(sub.trim(), ':');
                         if (colonIdx === -1 || colonIdx === 0) {
                            allKVs = false;
                            break;
                         }
                      }
                      
                      if (allKVs) {
                         // Item is an Implicit Object.
                         // So parent is an Array.
                         isObject = false;
                         parsedItems.push(this._parseZonNode(cleanItem, depth + 1));
                         continue;
                      }
                   }
                }

                // Check for k:v pattern
                const colonIdx = this._findDelimiter(cleanItem, ':');
                if (colonIdx === -1 || colonIdx === 0) {
                   isObject = false;
                   parsedItems.push(this._parseZonNode(cleanItem, depth + 1));
                } else {
                   // Potential KV
                   const key = cleanItem.substring(0, colonIdx).trim();
                   if (!/^[a-zA-Z_][\w\.]*$/.test(key)) {
                      isObject = false;
                      parsedItems.push(this._parseZonNode(cleanItem, depth + 1));
                   } else {
                      // It's a KV pair
                      parsedItems.push(cleanItem);
                   }
                }
             }
          }

          if (isObject) {
             // Parse as object
             const obj: Record<string, any> = {};
             for (const item of parsedItems) {
                const colonIdx = this._findDelimiter(item, ':');
                const keyStr = item.substring(0, colonIdx).trim();
                const valStr = item.substring(colonIdx + 1).trim();
                const key = this._parseValue(keyStr);
                const val = this._parseZonNode(valStr, depth + 1);
                obj[key] = val;
             }
             return obj;
          } else {
             // Return array
             return parsedItems;
          }
       } else {
          // Single item (no commas).
          // Check if it's an Implicit Object (newline separated KVs).
          const lines = this._splitByDelimiter(trimmed, '\n', false); // Split by newline
          const validLines = lines.filter(l => l.trim().length > 0);
          
          if (validLines.length > 1) {
             // Check if all lines are KVs
             let allKVs = true;
             for (const line of validLines) {
                const colonIdx = this._findDelimiter(line.trim(), ':');
                if (colonIdx === -1 || colonIdx === 0) {
                   allKVs = false;
                   break;
                }
             }
             
             if (allKVs) {
                // Parse as Implicit Object
                const obj: Record<string, any> = {};
                for (const line of validLines) {
                   const colonIdx = this._findDelimiter(line.trim(), ':');
                   const keyStr = line.substring(0, colonIdx).trim();
                   const valStr = line.substring(colonIdx + 1).trim();
                   const key = this._parseValue(keyStr);
                   const val = this._parseZonNode(valStr, depth + 1);
                   obj[key] = val;
                }
                return obj;
             }
          }
       }
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
        i++;
        continue;
      }

      if (['"', "'"].includes(char)) {
      // Only treat as quote if we are not already in a quote AND
      // (it's the first char OR the previous char was a delimiter/whitespace that implies start of value)
      // Actually for _findDelimiter, we assume we are scanning a value from the start.
      // So we only enter quote mode if i === 0 or we are strictly at the start of a value.
      // But _findDelimiter is generic. 
      // Let's stick to: Only enter quote mode if we haven't seen non-whitespace content yet?
      // But _findDelimiter doesn't track "seen content".
      // Let's assume for _findDelimiter, if we hit a quote and we are NOT in a quote,
      // it's a start quote ONLY IF it's at i=0. 
      // Wait, what if we are parsing `key="val"`? _findDelimiter might be called on `"val"`.
      // If we are parsing `key=val's`, _findDelimiter called on `val's`.
      
      if (!inQuote) {
        // Only start quoting if we are at the beginning of the string (ignoring whitespace)
        // Since we don't track whitespace easily here without lookbehind or extra state,
        // let's check if the string up to i is empty/whitespace.
        const prefix = text.substring(0, i);
        if (prefix.trim().length === 0) {
          inQuote = true;
          quoteChar = char;
        }
      } else if (char === quoteChar) {
        inQuote = false;
        quoteChar = null;
      }
    } else if (!inQuote && depth === 0 && char === delim) {
        return i;
      }

      if (!inQuote) {
        if (char === '{' || char === '[') depth++;
        if (char === '}' || char === ']') depth--;
      }
    }

    return -1;
  }

  /**
   * Splits text by delimiter while respecting quotes and nesting.
   * 
   * @param text - Text to split
   * @param delim - Delimiter character (default: ',')
   * @param splitByNewline - Whether to treat newline as delimiter (default: false)
   * @returns Array of split parts
   */
  private _splitByDelimiter(text: string, delim: string = ',', splitByNewline: boolean = false): string[] {
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
        // Only start quoting if the current token is empty or just whitespace
        if (current.every(c => c.trim() === '')) {
          inQuote = true;
          quoteChar = char;
          current.push(char);
        } else {
          // Treat as literal quote inside a word
          current.push(char);
        }
      } else if (char === quoteChar) {
        if (i + 1 < text.length && text[i+1] === quoteChar) {
          // Handle escaped quote ("" or '')
          current.push(char);
          current.push(text[i+1]);
          i++;
        } else {
          inQuote = false;
          quoteChar = null;
          current.push(char);
        }
      } else {
        current.push(char);
      }
    } else if (!inQuote) {
        if (['{', '['].includes(char)) {
          depth++;
          current.push(char);
        } else if (['}', ']'].includes(char)) {
          depth--;
          current.push(char);
        } else if ((char === delim || (splitByNewline && char === '\n')) && depth === 0) {
          // Treat newline as delimiter if enabled
        if (current.length > 0) {
          // Only trim for comma delimiters, preserve whitespace for newline delimiters
          const part = current.join('');
          parts.push(delim === '\n' ? part : part.trim());
          current.length = 0;
        }
        } else {
          current.push(char);
        }
      } else {
        current.push(char);
      }
    }

    if (current.length > 0) {
    const final = current.join('');
    const trimmedFinal = final.trim();
    if (trimmedFinal) {
      // Only trim for comma delimiters, preserve whitespace for newline delimiters
      parts.push(delim === '\n' ? final : trimmedFinal);
    }
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
    
    if (trimmedVal.startsWith('"')) {
      return parsed;
    }
    
    if (typeof parsed === 'string') {
      // Don't recurse back to _parseZonNode to avoid infinite loops.
      // _parseZonNode should handle structure before calling _parseValue.
      return parsed;
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

  /**
   * Checks if quotes are balanced in string.
   */
  private _areQuotesBalanced(s: string): boolean {
    let inQuote = false;
    let quoteChar = '';
    
    for (let i = 0; i < s.length; i++) {
      const char = s[i];
      if (char === '\\' && i + 1 < s.length) {
        i++; continue;
      }
      if (['"', "'"].includes(char)) {
        if (!inQuote) { inQuote = true; quoteChar = char; }
        else if (char === quoteChar) { inQuote = false; }
      }
    }
    return !inQuote;
  }

  /**
   * Splits object properties respecting indentation.
   * 
   * @param text - Object content
   * @returns Array of property strings
   */
  private _splitObjectProperties(text: string): string[] {
    // If no newlines, fall back to comma splitting
    if (!text.includes('\n')) {
      return this._splitByDelimiter(text, ',', true);
    }

    const lines = text.split('\n');
    const properties: string[] = [];
    let currentProperty: string[] = [];
    let baseIndent = -1;
    let braceDepth = 0;
    let bracketDepth = 0;
    let hasEnteredBrace = false;
    let hasEnteredBracket = false;

    for (const line of lines) {
      if (!line.trim()) continue; // Skip empty lines

      const indent = line.search(/\S/);
      if (indent === -1) continue; // Should be covered by trim check

      if (baseIndent === -1) baseIndent = indent;

      // Heuristic: If baseIndent is 0 (due to trim) and we have a complete previous line,
      // and this line is indented, assume the indentation belongs to the block level (siblings).
      if (baseIndent === 0 && currentProperty.length === 1 && braceDepth === 0 && bracketDepth === 0) {
         const prevLine = currentProperty[0].trim();
         // Check if previous line looks complete (not ending in separator/opener) and has balanced quotes
         if (!prevLine.endsWith(':') && !prevLine.endsWith('{') && !prevLine.endsWith('[') && !prevLine.endsWith(',') && this._areQuotesBalanced(prevLine)) {
            if (indent > 0) {
               baseIndent = indent;
            }
         }
      }

      // Split if:
      // 1. At base indent AND not inside braces/brackets
      // 2. OR baseIndent is 0 (trimmed), we are not inside braces/brackets, AND we have previously entered/exited a block (implies completion)
      const isSplit = (indent === baseIndent || (baseIndent === 0 && (hasEnteredBrace || hasEnteredBracket))) && braceDepth === 0 && bracketDepth === 0;

      if (isSplit) {
        // New property at base level
        if (currentProperty.length > 0) {
          // Join and remove trailing comma
          properties.push(currentProperty.join('\n').trim().replace(/,$/, ''));
        }
        currentProperty = [line];
        // Reset block flags for new property
        hasEnteredBrace = false;
        hasEnteredBracket = false;
      } else {
        // Continuation or nested
        currentProperty.push(line);
      }

      // Update depths
      let inQuote = false;
      let quoteChar = '';
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '\\' && i + 1 < line.length) {
          i++; continue;
        }
        if (['"', "'"].includes(char)) {
          if (!inQuote) { inQuote = true; quoteChar = char; }
          else if (char === quoteChar) { inQuote = false; }
        } else if (!inQuote) {
          if (char === '{') { braceDepth++; hasEnteredBrace = true; }
          else if (char === '}') braceDepth--;
          else if (char === '[') { bracketDepth++; hasEnteredBracket = true; }
          else if (char === ']') bracketDepth--;
        }
      }
    }

    if (currentProperty.length > 0) {
      properties.push(currentProperty.join('\n').trim().replace(/,$/, ''));
    }

    return properties;
  }
}
// End of class
/**
 * Decodes ZON format string to original data v1.1.0.
 * 
 * @param data - ZON format string
 * @param options - Decode options
 * @returns Decoded data or DecodeResult if extractMetadata is true
 */
export function decode(data: string, options?: DecodeOptions): any | DecodeResult {
  return new ZonDecoder(options).decode(data, options);
}
