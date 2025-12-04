/**
 * Enhanced Validator & Linter
 * 
 * Validate ZON data and provide best practice recommendations
 */

import { decode } from '../core/decoder';
import { encode } from '../core/encoder';
import type { ZonSchema } from '../schema/schema';
import { analyze } from './helpers';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
}

export interface ValidationError {
  path: string;
  message: string;
  severity: 'error';
}

export interface ValidationWarning {
  path: string;
  message: string;
  severity: 'warning';
  rule: string;
}

export interface LintOptions {
  /** Maximum allowed nesting depth */
  maxDepth?: number;
  
  /** Maximum allowed field count */
  maxFields?: number;
  
  /** Warn on irregular schemas */
  checkIrregularity?: boolean;
  
  /** Check for performance issues */
  checkPerformance?: boolean;
  
  /** Validate against schema if provided */
  schema?: ZonSchema;
}

/**
 * Enhanced validator with linting
 */
export class ZonValidator {
  /**
   * Validate ZON string and provide detailed feedback
   */
  validate(zon: string, options: LintOptions = {}): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];
    

    let data: any;
    try {
      data = decode(zon);
    } catch (error: any) {
      return {
        valid: false,
        errors: [{ path: 'root', message: error.message, severity: 'error' }],
        warnings: [],
        suggestions: ['Check ZON syntax for errors']
      };
    }
    

    const stats = analyze(data);
    

    if (options.maxDepth && stats.depth > options.maxDepth) {
      warnings.push({
        path: 'root',
        message: `Nesting depth (${stats.depth}) exceeds recommended maximum (${options.maxDepth})`,
        severity: 'warning',
        rule: 'max-depth'
      });
      suggestions.push('Consider flattening deeply nested structures');
    }
    

    if (options.maxFields && stats.fieldCount > options.maxFields) {
      warnings.push({
        path: 'root',
        message: `Field count (${stats.fieldCount}) exceeds recommended maximum (${options.maxFields})`,
        severity: 'warning',
        rule: 'max-fields'
      });
      suggestions.push('Consider breaking large objects into smaller ones');
    }
    

    if (options.checkPerformance) {
      if (stats.arrayCount > 100) {
        warnings.push({
          path: 'root',
          message: `Large number of arrays (${stats.arrayCount}) may impact performance`,
          severity: 'warning',
          rule: 'performance-arrays'
        });
        suggestions.push('Consider using binary format for better performance');
      }
      
      if (stats.objectCount > 500) {
        warnings.push({
          path: 'root',
          message: `Large number of objects (${stats.objectCount}) may impact performance`,
          severity: 'warning',
          rule: 'performance-objects'
        });
      }
    }
    

    if (options.schema) {
      try {
        const result = options.schema.parse(data);
        if (!result.success) {
          result.issues.forEach(issue => {
            errors.push({
              path: issue.path.join('.'),
              message: issue.message,
              severity: 'error'
            });
          });
        }
      } catch (error: any) {
        errors.push({
          path: 'root',
          message: `Schema validation failed: ${error.message}`,
          severity: 'error'
        });
      }
    }
    

    try {
      const roundtrip = encode(decode(zon));
      if (roundtrip !== zon.trim()) {
        suggestions.push('ZON format may not be optimal - consider reformatting');
      }
    } catch {

    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }
  
  /**
   * Quick validation without detailed linting
   */
  isValid(zon: string): boolean {
    try {
      decode(zon);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Get best practice recommendations
   */
  lint(zon: string, options: LintOptions = {}): ValidationWarning[] {
    const result = this.validate(zon, {
      maxDepth: 10,
      maxFields: 100,
      checkPerformance: true,
      ...options
    });
    
    return result.warnings;
  }
}

/**
 * Global validator instance
 */
export const validator = new ZonValidator();

/**
 * Quick validation function
 */
export function validateZon(zon: string, schema?: ZonSchema): ValidationResult {
  return validator.validate(zon, { schema });
}

/**
 * Lint ZON for best practices
 */
export function lintZon(zon: string, options?: LintOptions): ValidationWarning[] {
  return validator.lint(zon, options);
}
