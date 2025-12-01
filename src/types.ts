export enum SparseMode {
  NONE = 'none',           // Standard table
  BASIC = 'basic',         // Current ZON sparse (field:value)
  HIERARCHICAL = 'hierarchical',  // Nested sparse
  DELTA = 'delta',         // Only encode changes
  HYBRID = 'hybrid'        // Mix of modes per column
}

export interface ZonType {
  type: string;
  coercible: boolean;
  original?: string;
  confidence?: number;
}
