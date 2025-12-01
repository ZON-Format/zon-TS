import { ZonEncoder } from './encoder';
import { ZonDecoder } from './decoder';

/**
 * Streaming Encoder for ZON format.
 * Uses Async Generators to process data chunk by chunk, suitable for large datasets.
 */
export class ZonStreamEncoder {
  private encoder: ZonEncoder;
  private hasWrittenHeader: boolean = false;
  private columns: string[] | null = null;

  constructor() {
    this.encoder = new ZonEncoder();
  }

  /**
   * Encodes a stream of objects into ZON format.
   * Assumes the stream consists of uniform objects (table format).
   * 
   * @param source - Iterable or AsyncIterable of objects
   */
  async *encode(source: Iterable<any> | AsyncIterable<any>): AsyncGenerator<string> {
    for await (const item of source) {
      if (!this.hasWrittenHeader) {
        // First item: determine columns and write header
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          this.columns = Object.keys(item).sort();
          // Write header: @:col1,col2 (no count since it's a stream)
          const header = `@:${this.columns.join(',')}`;
          yield header;
          this.hasWrittenHeader = true;
        } else {
          // Not an object, fallback to simple stringify per line?
          // Or just error? ZON streaming is primarily for tables.
          // For now, let's assume table.
          throw new Error("ZonStreamEncoder currently only supports streams of objects (tables).");
        }
      }

      // Write row
      if (this.columns) {
        const row = this.columns.map(col => {
          const val = item[col];
          // Use internal formatting logic from ZonEncoder (we might need to expose a helper or duplicate logic)
          // Ideally, we refactor ZonEncoder to expose `formatValue`.
          // For now, let's use a simplified version or access private method if possible (not possible in TS strict).
          // We'll instantiate a temporary encoder or duplicate the simple value formatting.
          return this._formatValue(val);
        });
        yield "\n" + row.join(',');
      }
    }
  }

  // Duplicated from ZonEncoder for now to avoid breaking encapsulation
  // In a real refactor, we'd make this a static utility.
  private _formatValue(val: any): string {
    if (val === true) return 'T';
    if (val === false) return 'F';
    if (val === null || val === undefined) return 'null';
    if (typeof val === 'number') {
        if (Number.isNaN(val) || !Number.isFinite(val)) return 'null';
        return val.toString();
    }
    const s = String(val);
    if (/^[a-zA-Z0-9_\-\.]+$/.test(s)) return s;
    return this._csvQuote(s);
  }

  private _csvQuote(s: string): string {
    if (s.includes('"')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return `"${s}"`;
  }
}

/**
 * Streaming Decoder for ZON format.
 * Processes string chunks and yields parsed objects.
 */
export class ZonStreamDecoder {
  private decoder: ZonDecoder;
  private buffer: string = '';
  private columns: string[] | null = null;
  private isTable: boolean = false;

  constructor() {
    this.decoder = new ZonDecoder();
  }

  async *decode(source: Iterable<string> | AsyncIterable<string>): AsyncGenerator<any> {
    for await (const chunk of source) {
      this.buffer += chunk;
      
      let newlineIdx: number;
      while ((newlineIdx = this.buffer.indexOf('\n')) !== -1) {
        const line = this.buffer.slice(0, newlineIdx).trim();
        this.buffer = this.buffer.slice(newlineIdx + 1);

        if (!line) continue;

        if (!this.columns) {
          // Parse Header
          if (line.startsWith('@')) {
            this.isTable = true;
            // Parse @(N):cols or @:cols
            const parts = line.split(':');
            const colPart = parts[parts.length - 1];
            this.columns = colPart.split(',');
          } else {
             // Not a table stream? 
             // For now, assume table stream.
          }
        } else {
          // Parse Row
          const values = this._parseRow(line);
          const obj: Record<string, any> = {};
          this.columns.forEach((col, i) => {
            if (i < values.length) {
              obj[col] = values[i];
            }
          });
          yield obj;
        }
      }
    }
    
    // Process remaining buffer if it contains a line
    if (this.buffer.trim()) {
       // Same logic as above
       const line = this.buffer.trim();
       if (this.columns) {
          const values = this._parseRow(line);
          const obj: Record<string, any> = {};
          this.columns.forEach((col, i) => {
            if (i < values.length) {
              obj[col] = values[i];
            }
          });
          yield obj;
       }
    }
  }

  // Simplified row parser (CSV-aware)
  private _parseRow(line: string): any[] {
    const values: any[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(this._parseValue(current));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(this._parseValue(current));
    return values;
  }

  private _parseValue(val: string): any {
    val = val.trim();
    if (val === 'T') return true;
    if (val === 'F') return false;
    if (val === 'null') return null;
    if (!isNaN(Number(val)) && val !== '') return Number(val);
    return val;
  }
}
