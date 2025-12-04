/**
 * Format Conversion Utilities
 * 
 * Convert between ZON, JSON, and Binary formats
 */

import { encode } from '../core/encoder';
import { decode } from '../core/decoder';
import { encodeBinary, decodeBinary } from '../binary';

export interface ConversionOptions {
  /** Pretty print output (for text formats) */
  pretty?: boolean;
  
  /** Include metadata in conversion */
  includeMetadata?: boolean;
  
  /** Target format version */
  targetVersion?: string;
}

/**
 * Convert JSON to ZON text format
 */
export function jsonToZon(json: string | object, options?: ConversionOptions): string {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  return encode(data);
}

/**
 * Convert ZON text to JSON
 */
export function zonToJson(zon: string, options?: ConversionOptions): string {
  const data = decode(zon);
  return options?.pretty 
    ? JSON.stringify(data, null, 2)
    : JSON.stringify(data);
}

/**
 * Convert ZON text to Binary ZON
 */
export function zonToBinary(zon: string): Uint8Array {
  const data = decode(zon);
  return encodeBinary(data);
}

/**
 * Convert Binary ZON to ZON text
 */
export function binaryToZon(binary: Uint8Array): string {
  const data = decodeBinary(binary);
  return encode(data);
}

/**
 * Convert JSON to Binary ZON
 */
export function jsonToBinary(json: string | object): Uint8Array {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  return encodeBinary(data);
}

/**
 * Convert Binary ZON to JSON
 */
export function binaryToJson(binary: Uint8Array, options?: ConversionOptions): string {
  const data = decodeBinary(binary);
  return options?.pretty
    ? JSON.stringify(data, null, 2)
    : JSON.stringify(data);
}

/**
 * Batch converter for multiple files
 */
export class BatchConverter {
  private conversions: Array<{from: string; to: string; data: any}> = [];
  
  /**
   * Queue a conversion
   */
  add(data: any, from: 'json' | 'zon' | 'binary', to: 'json' | 'zon' | 'binary'): void {
    this.conversions.push({ from, to, data });
  }
  
  /**
   * Execute all queued conversions
   */
  convert(): any[] {
    return this.conversions.map(({ from, to, data }) => {
      return this.convertSingle(data, from, to);
    });
  }
  
  /**
   * Convert a single item
   */
  private convertSingle(data: any, from: string, to: string): any {

    let normalized: any;
    
    if (from === 'json') {
      normalized = typeof data === 'string' ? JSON.parse(data) : data;
    } else if (from === 'zon') {
      normalized = decode(data);
    } else if (from === 'binary') {
      normalized = decodeBinary(data);
    }
    

    if (to === 'json') {
      return JSON.stringify(normalized, null, 2);
    } else if (to === 'zon') {
      return encode(normalized);
    } else if (to === 'binary') {
      return encodeBinary(normalized);
    }
    
    return normalized;
  }
  
  /**
   * Clear all queued conversions
   */
  clear(): void {
    this.conversions = [];
  }
}

/**
 * Auto-detect format and convert
 */
export function autoConvert(
  input: string | Uint8Array,
  targetFormat: 'json' | 'zon' | 'binary',
  options?: ConversionOptions
): string | Uint8Array {

  let sourceFormat: 'json' | 'zon' | 'binary';
  
  if (input instanceof Uint8Array) {
    sourceFormat = 'binary';
  } else if (input.trim().startsWith('{') || input.trim().startsWith('[')) {
    sourceFormat = 'json';
  } else {
    sourceFormat = 'zon';
  }
  

  const converter = new BatchConverter();
  converter.add(input, sourceFormat, targetFormat);
  return converter.convert()[0];
}
