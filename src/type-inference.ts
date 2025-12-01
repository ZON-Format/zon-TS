import { ZonType } from './types';

export class TypeInferrer {
  /**
   * Infers the ZON type of a value.
   * 
   * @param value - Value to infer type for
   * @returns Inferred ZonType
   */
  infer(value: any): ZonType {
    // String that looks like number
    if (typeof value === 'string') {
      const trimmed = value.trim();
      
      // Boolean
      if (/^(true|false|yes|no|1|0)$/i.test(trimmed)) {
        return { type: 'boolean', coercible: true, original: 'string' };
      }

      // Number
      if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) {
        return { type: 'number', coercible: true, original: 'string' };
      }
      
      // Date (ISO 8601)
      if (this._isISODate(trimmed)) {
        return { type: 'date', coercible: true, original: 'string' };
      }
      
      // JSON (Object or Array)
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
          (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          JSON.parse(trimmed);
          return { type: 'json', coercible: true, original: 'string' };
        } catch (e) {
          // Not valid JSON
        }
      }
    }
    
    return { type: typeof value, coercible: false };
  }
  
  /**
   * Coerces a value to the target type.
   * 
   * @param value - Value to coerce
   * @param targetType - Target type definition
   * @returns Coerced value or original value
   */
  coerce(value: any, targetType: ZonType): any {
    if (!targetType.coercible) return value;
    
    switch (targetType.type) {
      case 'number':
        return Number(value);
      case 'boolean':
        return /^(true|yes|1)$/i.test(String(value));
      case 'date':
        return new Date(value);
      case 'json':
        try {
          return JSON.parse(value);
        } catch (e) {
          return value;
        }
      default:
        return value;
    }
  }

  /**
   * Infers the dominant type for a column of values.
   * 
   * @param values - Array of values
   * @returns Dominant ZonType
   */
  /**
   * Infers the dominant type for a column of values.
   * 
   * @param values - Array of values
   * @returns Dominant ZonType
   */
  inferColumnType(values: any[]): ZonType {
    const nonNullValues = values.filter(v => v !== null && v !== undefined);
    const total = nonNullValues.length;
    
    if (total === 0) return { type: 'undefined', coercible: false };

    // Check Boolean (Prioritize boolean for 1/0 flags)
    const booleanCount = nonNullValues.filter(v => this._isBoolean(v)).length;
    if (booleanCount / total >= 0.8) {
      return { type: 'boolean', coercible: true, confidence: booleanCount / total };
    }

    // Check Number
    const numberCount = nonNullValues.filter(v => this._isNumber(v)).length;
    if (numberCount / total >= 0.8) {
      return { type: 'number', coercible: true, confidence: numberCount / total };
    }

    // Check Date
    const dateCount = nonNullValues.filter(v => this._isDate(v)).length;
    if (dateCount / total >= 0.8) {
      return { type: 'date', coercible: true, confidence: dateCount / total };
    }

    // Check JSON
    const jsonCount = nonNullValues.filter(v => this._isJSON(v)).length;
    if (jsonCount / total >= 0.8) {
      return { type: 'json', coercible: true, confidence: jsonCount / total };
    }
    
    return { type: 'mixed', coercible: false };
  }

  private _isNumber(v: any): boolean {
    if (typeof v === 'number') return true;
    if (typeof v === 'string') return /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v.trim());
    return false;
  }

  private _isBoolean(v: any): boolean {
    if (typeof v === 'boolean') return true;
    if (typeof v === 'string') return /^(true|false|yes|no|1|0)$/i.test(v.trim());
    return false;
  }

  private _isDate(v: any): boolean {
    if (v instanceof Date) return true;
    if (typeof v === 'string') return this._isISODate(v.trim());
    return false;
  }

  private _isJSON(v: any): boolean {
    if (typeof v === 'object') return true; // Already object/array
    if (typeof v === 'string') {
      const trimmed = v.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
          (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          JSON.parse(trimmed);
          return true;
        } catch (e) {
          return false;
        }
      }
    }
    return false;
  }

  private _isISODate(s: string): boolean {
    // Simple ISO 8601 check: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
    return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[-+]\d{2}:?\d{2})?)?$/.test(s);
  }
}
