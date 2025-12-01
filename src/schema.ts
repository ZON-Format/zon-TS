import { decode } from './decoder';

export type ZonIssue = {
  path: (string | number)[];
  message: string;
  code: 'invalid_type' | 'missing_field' | 'invalid_enum' | 'custom';
};

export type ZonResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; issues: ZonIssue[] };

export abstract class ZonSchema<T = any> {
  protected description?: string;
  protected exampleValue?: T;

  abstract parse(data: any, path?: (string | number)[]): ZonResult<T>;
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

  parse(data: any, path: (string | number)[] = []): ZonResult<string> {
    if (typeof data !== 'string') {
      return {
        success: false,
        error: `Expected string at ${path.join('.') || 'root'}, got ${typeof data}`,
        issues: [{ path, message: `Expected string, got ${typeof data}`, code: 'invalid_type' }],
      };
    }

    // Length validation
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

    // Email validation
    if (this.emailValidation && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data)) {
      return {
        success: false,
        error: `Invalid email at ${path.join('.') || 'root'}`,
        issues: [{ path, message: 'Invalid email format', code: 'custom' }],
      };
    }

    // URL validation
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

    return { success: true, data };
  }

  toPrompt(indent: number = 0): string {
    const constraints: string[] = [];
    if (this.minLength !== undefined) constraints.push(`min: ${this.minLength}`);
    if (this.maxLength !== undefined) constraints.push(`max: ${this.maxLength}`);
    if (this.emailValidation) constraints.push('email');
    if (this.urlValidation) constraints.push('url');
    
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

    // Integer validation
    if (this.isInteger && !Number.isInteger(data)) {
      return {
        success: false,
        error: `Expected integer at ${path.join('.') || 'root'}, got ${data}`,
        issues: [{ path, message: `Expected integer, got ${data}`, code: 'custom' }],
      };
    }

    // Positive/negative validation
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

    // Min/max validation
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

    // Length validation
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
        return itemResult; // Return first error found
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
        // If optional and missing (undefined), it's fine if the schema handles it (ZonOptional)
        // But ZonOptional.parse handles undefined checks internally.
        // If we are here, it means it failed validation.
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

export const zon = {
  string: () => new ZonString(),
  number: () => new ZonNumber(),
  boolean: () => new ZonBoolean(),
  enum: <T extends string>(values: T[]) => new ZonEnum(values),
  array: <T>(schema: ZonSchema<T>) => new ZonArray(schema),
  object: <T extends Record<string, any>>(shape: { [K in keyof T]: ZonSchema<T[K]> }) => new ZonObject(shape),
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
