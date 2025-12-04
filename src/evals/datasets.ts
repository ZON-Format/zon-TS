/**
 * Dataset Management for ZON Evaluations
 */

import type { Dataset } from './types';

/**
 * Registry for managing evaluation datasets
 */
export class DatasetRegistry {
  private datasets: Map<string, Dataset> = new Map();
  
  /**
   * Register a dataset
   */
  register(dataset: Dataset): void {
    const key = `${dataset.id}@${dataset.version}`;
    this.datasets.set(key, dataset);
  }
  
  /**
   * Get a dataset by ID and optional version
   */
  get(id: string, version?: string): Dataset | null {
    if (version) {
      return this.datasets.get(`${id}@${version}`) || null;
    }
    

    const matching = Array.from(this.datasets.values())
      .filter(d => d.id === id)
      .sort((a, b) => this.compareVersions(b.version, a.version));
    
    return matching[0] || null;
  }
  
  /**
   * Get all datasets with a specific tag
   */
  getByTag(tag: string): Dataset[] {
    return Array.from(this.datasets.values())
      .filter(d => d.tags.includes(tag));
  }
  
  /**
   * Get all golden (baseline) datasets
   */
  getGolden(): Dataset[] {
    return this.getByTag('golden');
  }
  
  /**
   * List all registered datasets
   */
  list(): Dataset[] {
    return Array.from(this.datasets.values());
  }
  
  /**
   * Remove a dataset
   */
  remove(id: string, version: string): boolean {
    return this.datasets.delete(`${id}@${version}`);
  }
  
  /**
   * Clear all datasets
   */
  clear(): void {
    this.datasets.clear();
  }
  
  /**
   * Compare semantic versions
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    
    return 0;
  }
}

/**
 * Global dataset registry
 */
export const globalRegistry = new DatasetRegistry();

/**
 * Helper to create a dataset
 */
export function createDataset(
  id: string,
  version: string,
  name: string,
  data: any,
  questions: any[],
  options?: {
    schema?: any;
    tags?: string[];
  }
): Dataset {
  return {
    id,
    version,
    name,
    data,
    questions,
    schema: options?.schema,
    tags: options?.tags || []
  };
}
