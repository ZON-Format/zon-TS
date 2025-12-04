import { decode } from '../core/decoder';

export type ZonIssue = {
  path: (string | number)[];
  message: string;
  code: 'invalid_type' | 'missing_field' | 'invalid_enum' | 'custom';
};

export type ZonResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; issues: ZonIssue[] };

/**
 * Abstract base class for ZON schemas.
 * Defines the contract for parsing validation and prompt generation.
 */
export abstract class ZonSchema<T = any> {
  protected description?: string;
  protected exampleValue?: T;

  /**
   * Parses and validates the input data against the schema.
   * 
   * @param data - The data to validate
   * @param path - Current path in the data structure (for error reporting)
   * @returns Validation result (success or failure with issues)
   */
  abstract parse(data: any, path?: (string | number)[]): ZonResult<T>;

  /**
   * Generates a human-readable description of the schema for LLM prompts.
   * 
   * @param indent - Indentation level for nested structures
   * @returns Schema description string
   */
  abstract toPrompt(indent?: number): string;

  describe(description: string): this {
    this.description = description;
    return this;
  }

  example(value: T): this {
    this.exampleValue = value;
    return this;
  }

  optional(): ZonSchema<T | undefined> {
    return new ZonOptional(this);
  }

  nullable(): ZonSchema<T | null> {
    return new ZonNullable(this);
  }

  default(value: T): ZonSchema<T> {
    return new ZonDefault(this, value);
  }

  refine(validator: (val: T) => boolean, message: string): ZonSchema<T> {
    return new ZonRefinement(this, validator, message);
  }
}

class ZonNullable<T> extends ZonSchema<T | null> {
  constructor(private schema: ZonSchema<T>) {
    super();
  }

  parse(data: any, path: (string | number)[] = []): ZonResult<T | null> {
    if (data === null) {
      return { success: true, data: null };
    }
    return this.schema.parse(data, path);
  }

  toPrompt(indent: number = 0): string {
    return `${this.schema.toPrompt(indent)} (nullable)`;
  }
}

class ZonOptional<T> extends ZonSchema<T | undefined> {
  constructor(private schema: ZonSchema<T>) {
    super();
  }

  parse(data: any, path: (string | number)[] = []): ZonResult<T | undefined> {
    if (data === undefined || data === null) {
      return { success: true, data: undefined };
    }
    return this.schema.parse(data, path);
  }

  toPrompt(indent: number = 0): string {
    return `${this.schema.toPrompt(indent)} (optional)`;
  }
}

class ZonString extends ZonSchema<string> {
  private minLength?: number;
  private maxLength?: number;
  private emailValidation = false;
  private urlValidation = false;
  private regexPattern?: RegExp;
  private regexMessage?: string;
  private uuidValidation: 'v4' | 'any' | false = false;
  private datetimeValidation = false;
  private dateValidation = false;
  private timeValidation = false;

  min(length: number): this {
    this.minLength = length;
    return this;
  }

  max(length: number): this {
    this.maxLength = length;
    return this;
  }

  email(): this {
    this.emailValidation = true;
    return this;
  }

  url(): this {
    this.urlValidation = true;
    return this;
  }

  regex(pattern: RegExp, message?: string): this {
    this.regexPattern = pattern;
    this.regexMessage = message;
    return this;
  }

  uuid(version: 'v4' | 'any' = 'any'): this {
    this.uuidValidation = version;
    return this;
  }

  datetime(): this {
    this.datetimeValidation = true;
    return this;
  }

  date(): this {
    this.dateValidation = true;
    return this;
  }

  time(): this {
    this.timeValidation = true;
    return this;
  }

  parse(data: any, path: (string | number)[] = []): ZonResult<string> {
    if (typeof data !== 'string') {
      return {
        success: false,
        error: `Expected string at ${path.join('.') || 'root'}, got ${typeof data}`,
        issues: [{ path, message: `Expected string, got ${typeof data}`, code: 'invalid_type' }],
      };
    }


    if (this.minLength !== undefined && data.length < this.minLength) {
      return {
        success: false,
        error: `String too short at ${path.join('.') || 'root'}: minimum ${this.minLength} characters`,
        issues: [{ path, message: `String too short: minimum ${this.minLength} characters`, code: 'custom' }],
      };
    }

    if (this.maxLength !== undefined && data.length > this.maxLength) {
      return {
        success: false,
        error: `String too long at ${path.join('.') || 'root'}: maximum ${this.maxLength} characters`,
        issues: [{ path, message: `String too long: maximum ${this.maxLength} characters`, code: 'custom' }],
      };
    }


    if (this.emailValidation && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data)) {
      return {
        success: false,
        error: `Invalid email at ${path.join('.') || 'root'}`,
        issues: [{ path, message: 'Invalid email format', code: 'custom' }],
      };
    }


    if (this.urlValidation) {
      try {
        new URL(data);
      } catch {
        return {
          success: false,
          error: `Invalid URL at ${path.join('.') || 'root'}`,
          issues: [{ path, message: 'Invalid URL format', code: 'custom' }],
        };
      }
    }

    if (this.regexPattern && !this.regexPattern.test(data)) {
      return {
        success: false,
        error: this.regexMessage || `Pattern mismatch at ${path.join('.') || 'root'}`,
        issues: [{ path, message: this.regexMessage || 'Does not match required pattern', code: 'custom' }],
      };
    }

    if (this.uuidValidation) {
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const uuidAnyRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const pattern = this.uuidValidation === 'v4' ? uuidV4Regex : uuidAnyRegex;
      const versionStr = this.uuidValidation === 'v4' ? ' v4' : '';
      
      if (!pattern.test(data)) {
        return {
          success: false,
          error: `Invalid UUID${versionStr} at ${path.join('.') || 'root'}`,
          issues: [{ path, message: `Invalid UUID${versionStr} format`, code: 'custom' }],
        };
      }
    }

    if (this.datetimeValidation && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(data)) {
      return {
        success: false,
        error: `Invalid datetime at ${path.join('.') || 'root'}`,
        issues: [{ path, message: 'Invalid ISO 8601 datetime format', code: 'custom' }],
      };
    }

    if (this.dateValidation && !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return {
        success: false,
        error: `Invalid date at ${path.join('.') || 'root'}`,
        issues: [{ path, message: 'Invalid date format (expected YYYY-MM-DD)', code: 'custom' }],
      };
    }

    if (this.timeValidation && !/^\d{2}:\d{2}:\d{2}$/.test(data)) {
      return {
        success: false,
        error: `Invalid time at ${path.join('.') || 'root'}`,
        issues: [{ path, message: 'Invalid time format (expected HH:MM:SS)', code: 'custom' }],
      };
    }

    return { success: true, data };
  }

  toPrompt(indent: number = 0): string {
    const constraints: string[] = [];
    if (this.minLength !== undefined) constraints.push(`min: ${this.minLength}`);
    if (this.maxLength !== undefined) constraints.push(`max: ${this.maxLength}`);
    if (this.emailValidation) constraints.push('email');
    if (this.urlValidation) constraints.push('url');
    if (this.regexPattern) constraints.push('pattern');
    if (this.uuidValidation) constraints.push(`uuid${this.uuidValidation === 'v4' ? '-v4' : ''}`);
    if (this.datetimeValidation) constraints.push('datetime');
    if (this.dateValidation) constraints.push('date');
    if (this.timeValidation) constraints.push('time');
    
    const constraintStr = constraints.length > 0 ? ` (${constraints.join(', ')})` : '';
    const desc = this.description ? ` - ${this.description}` : '';
    return `string${constraintStr}${desc}`;
  }
}

class ZonNumber extends ZonSchema<number> {
  private minValue?: number;
  private maxValue?: number;
  private isPositive = false;
  private isNegative = false;
  private isInteger = false;

  min(value: number): this {
    this.minValue = value;
    return this;
  }

  max(value: number): this {
    this.maxValue = value;
    return this;
  }

  positive(): this {
    this.isPositive = true;
    return this;
  }

  negative(): this {
    this.isNegative = true;
    return this;
  }

  int(): this {
    this.isInteger = true;
    return this;
  }

  parse(data: any, path: (string | number)[] = []): ZonResult<number> {
    if (typeof data !== 'number' || isNaN(data)) {
      return {
        success: false,
        error: `Expected number at ${path.join('.') || 'root'}, got ${typeof data}`,
        issues: [{ path, message: `Expected number, got ${typeof data}`, code: 'invalid_type' }],
      };
    }


    if (this.isInteger && !Number.isInteger(data)) {
      return {
        success: false,
        error: `Expected integer at ${path.join('.') || 'root'}, got ${data}`,
        issues: [{ path, message: `Expected integer, got ${data}`, code: 'custom' }],
      };
    }


    if (this.isPositive && data <= 0) {
      return {
        success: false,
        error: `Expected positive number at ${path.join('.') || 'root'}, got ${data}`,
        issues: [{ path, message: `Expected positive number, got ${data}`, code: 'custom' }],
      };
    }

    if (this.isNegative && data >= 0) {
      return {
        success: false,
        error: `Expected negative number at ${path.join('.') || 'root'}, got ${data}`,
        issues: [{ path, message: `Expected negative number, got ${data}`, code: 'custom' }],
      };
    }


    if (this.minValue !== undefined && data < this.minValue) {
      return {
        success: false,
        error: `Number too small at ${path.join('.') || 'root'}: minimum ${this.minValue}`,
        issues: [{ path, message: `Number too small: minimum ${this.minValue}`, code: 'custom' }],
      };
    }

    if (this.maxValue !== undefined && data > this.maxValue) {
      return {
        success: false,
        error: `Number too large at ${path.join('.') || 'root'}: maximum ${this.maxValue}`,
        issues: [{ path, message: `Number too large: maximum ${this.maxValue}`, code: 'custom' }],
      };
    }

    return { success: true, data };
  }

  toPrompt(indent: number = 0): string {
    const constraints: string[] = [];
    if (this.isInteger) constraints.push('integer');
    if (this.isPositive) constraints.push('positive');
    if (this.isNegative) constraints.push('negative');
    if (this.minValue !== undefined) constraints.push(`min: ${this.minValue}`);
    if (this.maxValue !== undefined) constraints.push(`max: ${this.maxValue}`);
    
    const constraintStr = constraints.length > 0 ? ` (${constraints.join(', ')})` : '';
    const desc = this.description ? ` - ${this.description}` : '';
    return `number${constraintStr}${desc}`;
  }
}


class ZonBoolean extends ZonSchema<boolean> {
  parse(data: any, path: (string | number)[] = []): ZonResult<boolean> {
    if (typeof data !== 'boolean') {
      return {
        success: false,
        error: `Expected boolean at ${path.join('.') || 'root'}, got ${typeof data}`,
        issues: [{ path, message: `Expected boolean, got ${typeof data}`, code: 'invalid_type' }],
      };
    }
    return { success: true, data };
  }

  toPrompt(indent: number = 0): string {
    const desc = this.description ? ` - ${this.description}` : '';
    return `boolean${desc}`;
  }
}

class ZonEnum<T extends string> extends ZonSchema<T> {
  constructor(private values: T[]) {
    super();
  }

  parse(data: any, path: (string | number)[] = []): ZonResult<T> {
    if (!this.values.includes(data)) {
      return {
        success: false,
        error: `Expected one of [${this.values.join(', ')}] at ${path.join('.') || 'root'}, got '${data}'`,
        issues: [{ path, message: `Invalid enum value. Expected: ${this.values.join(', ')}`, code: 'invalid_enum' }],
      };
    }
    return { success: true, data };
  }

  toPrompt(indent: number = 0): string {
    const desc = this.description ? ` - ${this.description}` : '';
    return `enum(${this.values.join(', ')})${desc}`;
  }
}

class ZonArray<T> extends ZonSchema<T[]> {
  private minLength?: number;
  private maxLength?: number;

  constructor(private elementSchema: ZonSchema<T>) {
    super();
  }

  min(length: number): this {
    this.minLength = length;
    return this;
  }

  max(length: number): this {
    this.maxLength = length;
    return this;
  }

  parse(data: any, path: (string | number)[] = []): ZonResult<T[]> {
    if (!Array.isArray(data)) {
      return {
        success: false,
        error: `Expected array at ${path.join('.') || 'root'}, got ${typeof data}`,
        issues: [{ path, message: `Expected array, got ${typeof data}`, code: 'invalid_type' }],
      };
    }


    if (this.minLength !== undefined && data.length < this.minLength) {
      return {
        success: false,
        error: `Array too short at ${path.join('.') || 'root'}: minimum ${this.minLength} items`,
        issues: [{ path, message: `Array too short: minimum ${this.minLength} items`, code: 'custom' }],
      };
    }

    if (this.maxLength !== undefined && data.length > this.maxLength) {
      return {
        success: false,
        error: `Array too long at ${path.join('.') || 'root'}: maximum ${this.maxLength} items`,
        issues: [{ path, message: `Array too long: maximum ${this.maxLength} items`, code: 'custom' }],
      };
    }

    const result: T[] = [];
    for (let i = 0; i < data.length; i++) {
      const itemResult = this.elementSchema.parse(data[i], [...path, i]);
      if (!itemResult.success) {
        return itemResult;
      }
      result.push(itemResult.data);
    }

    return { success: true, data: result };
  }

  toPrompt(indent: number = 0): string {
    const constraints: string[] = [];
    if (this.minLength !== undefined) constraints.push(`min: ${this.minLength}`);
    if (this.maxLength !== undefined) constraints.push(`max: ${this.maxLength}`);
    
    const constraintStr = constraints.length > 0 ? ` (${constraints.join(', ')})` : '';
    const desc = this.description ? ` - ${this.description}` : '';
    return `array of [${this.elementSchema.toPrompt(indent)}]${constraintStr}${desc}`;
  }
}

class ZonObject<T extends Record<string, any>> extends ZonSchema<T> {
  constructor(private shape: { [K in keyof T]: ZonSchema<T[K]> }) {
    super();
  }

  parse(data: any, path: (string | number)[] = []): ZonResult<T> {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return {
        success: false,
        error: `Expected object at ${path.join('.') || 'root'}, got ${data === null ? 'null' : typeof data}`,
        issues: [{ path, message: `Expected object, got ${data === null ? 'null' : typeof data}`, code: 'invalid_type' }],
      };
    }

    const result: any = {};
    for (const key in this.shape) {
      const fieldSchema = this.shape[key];
      const fieldResult = fieldSchema.parse(data[key], [...path, key]);

      if (!fieldResult.success) {
        return fieldResult;
      }
      result[key] = fieldResult.data;
    }

    return { success: true, data: result };
  }

  toPrompt(indent: number = 0): string {
    const spaces = ' '.repeat(indent);
    const lines = [`object:`];
    if (this.description) {
        lines[0] += ` (${this.description})`;
    }
    
    for (const key in this.shape) {
      const fieldSchema = this.shape[key];
      const fieldPrompt = fieldSchema.toPrompt(indent + 2);
      lines.push(`${spaces}  - ${key}: ${fieldPrompt}`);
    }
    return lines.join('\n');
  }
}

class ZonLiteral<T extends string | number | boolean> extends ZonSchema<T> {
  constructor(private value: T) {
    super();
  }

  parse(data: any, path: (string | number)[] = []): ZonResult<T> {
    if (data !== this.value) {
      return {
        success: false,
        error: `Expected literal '${this.value}' at ${path.join('.') || 'root'}, got '${data}'`,
        issues: [{ path, message: `Must be exactly '${this.value}'`, code: 'invalid_type' }],
      };
    }
    return { success: true, data: this.value };
  }

  toPrompt(indent: number = 0): string {
    const desc = this.description ? ` - ${this.description}` : '';
    return `literal(${JSON.stringify(this.value)})${desc}`;
  }
}

class ZonUnion<T extends any[]> extends ZonSchema<T[number]> {
  constructor(private schemas: ZonSchema<any>[]) {
    super();
  }

  parse(data: any, path: (string | number)[] = []): ZonResult<any> {
    const errors: string[] = [];
    
    for (const schema of this.schemas) {
      const result = schema.parse(data, path);
      if (result.success) {
        return result;
      }
      errors.push(result.error);
    }
    
    return {
      success: false,
      error: `No union member matched at ${path.join('.') || 'root'}`,
      issues: [{ path, message: 'Value does not match any union member', code: 'invalid_type' }],
    };
  }

  toPrompt(indent: number = 0): string {
    const desc = this.description ? ` - ${this.description}` : '';
    return `oneOf(${this.schemas.map(s => s.toPrompt()).join(' | ')})${desc}`;
  }
}

class ZonDefault<T> extends ZonSchema<T> {
  constructor(private schema: ZonSchema<T>, private defaultValue: T) {
    super();
  }

  parse(data: any, path: (string | number)[] = []): ZonResult<T> {
    if (data === undefined || data === null) {
      return { success: true, data: this.defaultValue };
    }
    return this.schema.parse(data, path);
  }

  toPrompt(indent: number = 0): string {
    return `${this.schema.toPrompt(indent)} (default: ${JSON.stringify(this.defaultValue)})`;
  }
}

class ZonRefinement<T> extends ZonSchema<T> {
  constructor(
    private schema: ZonSchema<T>,
    private validator: (val: T) => boolean,
    private message: string
  ) {
    super();
  }

  parse(data: any, path: (string | number)[] = []): ZonResult<T> {
    const result = this.schema.parse(data, path);
    if (!result.success) return result;
    
    if (!this.validator(result.data)) {
      return {
        success: false,
        error: `${this.message} at ${path.join('.') || 'root'}`,
        issues: [{ path, message: this.message, code: 'custom' }],
      };
    }
    
    return result;
  }

  toPrompt(indent: number = 0): string {
    return `${this.schema.toPrompt(indent)} (custom validation)`;
  }
}

export const zon = {
  string: () => new ZonString(),
  number: () => new ZonNumber(),
  boolean: () => new ZonBoolean(),
  enum: <T extends string>(values: T[]) => new ZonEnum(values),
  array: <T>(schema: ZonSchema<T>) => new ZonArray(schema),
  object: <T extends Record<string, any>>(shape: { [K in keyof T]: ZonSchema<T[K]> }) => new ZonObject(shape),
  literal: <T extends string | number | boolean>(value: T) => new ZonLiteral(value),
  union: <T extends ZonSchema<any>[]>(...schemas: T) => new ZonUnion(schemas),
};

/**
 * Validates a ZON string or decoded object against a schema.
 * @param input ZON string or decoded object
 * @param schema ZON Schema
 */
export function validate<T>(input: string | any, schema: ZonSchema<T>): ZonResult<T> {
  let data = input;
  if (typeof input === 'string') {
    try {
      data = decode(input);
    } catch (e: any) {
      return {
        success: false,
        error: `ZON Parse Error: ${e.message}`,
        issues: [{ path: [], message: e.message, code: 'custom' }],
      };
    }
  }
  return schema.parse(data);
}
