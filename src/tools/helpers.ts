/**
 * Helper Utilities for ZON
 * 
 * Useful functions for working with ZON data
 */

import { encode } from '../core/encoder';
import { decode } from '../core/decoder';
import { encodeBinary } from '../binary';
import type { ZonSchema } from '../schema/schema';

/**
 * Calculate the encoded size of data in different formats
 */
export function size(data: any, format: 'zonf' | 'binary' | 'json' = 'zonf'): number {
  switch (format) {
    case 'zonf':
      return encode(data).length;
    case 'binary':
      return encodeBinary(data).length;
    case 'json':
      return JSON.stringify(data).length;
  }
}

/**
 * Compare sizes across all formats
 */
export function compareFormats(data: any): {
  zonf: number;
  binary: number;
  json: number;
  savings: {
    zonfVsJson: number;
    binaryVsJson: number;
    binaryVsZonf: number;
  };
} {
  const zonfSize = size(data, 'zonf');
  const binarySize = size(data, 'binary');
  const jsonSize = size(data, 'json');
  
  return {
    zonf: zonfSize,
    binary: binarySize,
    json: jsonSize,
    savings: {
      zonfVsJson: ((1 - zonfSize / jsonSize) * 100),
      binaryVsJson: ((1 - binarySize / jsonSize) * 100),
      binaryVsZonf: ((1 - binarySize / zonfSize) * 100)
    }
  };
}

/**
 * Infer a basic schema structure from sample data
 * Note: Returns a simple object representation, not a full ZonSchema
 */
export function inferSchema(data: any): any {
  if (data === null || data === undefined) {
    return { type: 'null' };
  }
  
  if (typeof data === 'boolean') {
    return { type: 'boolean' };
  }
  
  if (typeof data === 'number') {
    return { type: 'number' };
  }
  
  if (typeof data === 'string') {
    return { type: 'string' };
  }
  
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return { type: 'array', items: { type: 'any' } };
    }
    // Infer from first element
    return { type: 'array', items: inferSchema(data[0]) };
  }
  
  if (typeof data === 'object') {
    const shape: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      shape[key] = inferSchema(value);
    }
    return { type: 'object', properties: shape };
  }
  
  return { type: 'string' }; // Fallback
}

/**
 * Deep comparison of two values
 */
export function compare(a: any, b: any): {
  equal: boolean;
  differences?: Array<{path: string; valueA: any; valueB: any}>;
} {
  const differences: Array<{path: string; valueA: any; valueB: any}> = [];
  
  function compareRecursive(val1: any, val2: any, path: string = ''): void {
    if (val1 === val2) return;
    
    if (typeof val1 !== typeof val2) {
      differences.push({ path, valueA: val1, valueB: val2 });
      return;
    }
    
    if (Array.isArray(val1) && Array.isArray(val2)) {
      if (val1.length !== val2.length) {
        differences.push({ path, valueA: val1, valueB: val2 });
        return;
      }
      for (let i = 0; i < val1.length; i++) {
        compareRecursive(val1[i], val2[i], `${path}[${i}]`);
      }
      return;
    }
    
    if (typeof val1 === 'object' && typeof val2 === 'object' && val1 !== null && val2 !== null) {
      const keys1 = Object.keys(val1);
      const keys2 = Object.keys(val2);
      const allKeys = new Set([...keys1, ...keys2]);
      
      for (const key of allKeys) {
        const newPath = path ? `${path}.${key}` : key;
        if (!(key in val1)) {
          differences.push({ path: newPath, valueA: undefined, valueB: val2[key] });
        } else if (!(key in val2)) {
          differences.push({ path: newPath, valueA: val1[key], valueB: undefined });
        } else {
          compareRecursive(val1[key], val2[key], newPath);
        }
      }
      return;
    }
    
    differences.push({ path, valueA: val1, valueB: val2 });
  }
  
  compareRecursive(a, b);
  
  return {
    equal: differences.length === 0,
    differences: differences.length > 0 ? differences : undefined
  };
}

/**
 * Analyze data structure complexity
 */
export function analyze(data: any): {
  depth: number;
  fieldCount: number;
  arrayCount: number;
  objectCount: number;
  primitiveCount: number;
  totalNodes: number;
  types: Set<string>;
} {
  const stats = {
    maxDepth: 0,
    fieldCount: 0,
    arrayCount: 0,
    objectCount: 0,
    primitiveCount: 0,
    totalNodes: 0,
    types: new Set<string>()
  };
  
  function traverse(value: any, depth: number): void {
    stats.maxDepth = Math.max(stats.maxDepth, depth);
    stats.totalNodes++;
    stats.types.add(typeof value);
    
    if (Array.isArray(value)) {
      stats.arrayCount++;
      value.forEach(item => traverse(item, depth + 1));
    } else if (typeof value === 'object' && value !== null) {
      stats.objectCount++;
      const keys = Object.keys(value);
      stats.fieldCount += keys.length;
      keys.forEach(key => traverse(value[key], depth + 1));
    } else {
      stats.primitiveCount++;
    }
  }
  
  traverse(data, 0);
  
  return {
    depth: stats.maxDepth,
    fieldCount: stats.fieldCount,
    arrayCount: stats.arrayCount,
    objectCount: stats.objectCount,
    primitiveCount: stats.primitiveCount,
    totalNodes: stats.totalNodes,
    types: stats.types
  };
}

/**
 * Check if data is safe for ZON encoding
 */
export function isSafe(data: any): {
  safe: boolean;
  issues?: string[];
} {
  const issues: string[] = [];
  
  function check(value: any, path: string = ''): void {
    if (value === undefined) {
      issues.push(`Undefined value at ${path || 'root'}`);
    }
    
    if (typeof value === 'function') {
      issues.push(`Function at ${path || 'root'} (not serializable)`);
    }
    
    if (typeof value === 'symbol') {
      issues.push(`Symbol at ${path || 'root'} (not serializable)`);
    }
    
    if (Array.isArray(value)) {
      value.forEach((item, i) => check(item, `${path}[${i}]`));
    } else if (typeof value === 'object' && value !== null) {
      Object.entries(value).forEach(([key, val]) => {
        const newPath = path ? `${path}.${key}` : key;
        check(val, newPath);
      });
    }
  }
  
  check(data);
  
  return {
    safe: issues.length === 0,
    issues: issues.length > 0 ? issues : undefined
  };
}
