/**
 * Storage for Evaluation Results
 */

import fs from 'fs';
import path from 'path';
import type { EvalResult, EvalStorage } from './types';

/**
 * File-based storage for evaluation results
 */
export class FileEvalStorage implements EvalStorage {
  private storageDir: string;
  
  constructor(storageDir: string = './eval-results') {
    this.storageDir = storageDir;
    this.ensureDir();
  }
  
  /**
   * Ensure storage directory exists
   */
  private ensureDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }
  
  /**
   * Save evaluation result
   */
  async save(result: EvalResult): Promise<void> {
    const filename = `${result.testId}.json`;
    const filepath = path.join(this.storageDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(result, null, 2), 'utf-8');
    

    const latestFilename = `${result.config.name}-latest.json`;
    const latestFilepath = path.join(this.storageDir, latestFilename);
    fs.writeFileSync(latestFilepath, JSON.stringify(result, null, 2), 'utf-8');
  }
  
  /**
   * Load evaluation result by test ID
   */
  async load(testId: string): Promise<EvalResult | null> {
    const filename = `${testId}.json`;
    const filepath = path.join(this.storageDir, filename);
    
    if (!fs.existsSync(filepath)) {
      return null;
    }
    
    const content = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(content) as EvalResult;
  }
  
  /**
   * Get latest result for a config
   */
  async getLatest(configName: string): Promise<EvalResult | null> {
    const filename = `${configName}-latest.json`;
    const filepath = path.join(this.storageDir, filename);
    
    if (!fs.existsSync(filepath)) {
      return null;
    }
    
    const content = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(content) as EvalResult;
  }
  
  /**
   * List all results
   */
  async list(filter?: {configName?: string; limit?: number}): Promise<EvalResult[]> {
    const files = fs.readdirSync(this.storageDir)
      .filter(f => f.endsWith('.json') && !f.endsWith('-latest.json'));
    
    let results: EvalResult[] = [];
    
    for (const file of files) {
      const filepath = path.join(this.storageDir, file);
      const content = fs.readFileSync(filepath, 'utf-8');
      const result = JSON.parse(content) as EvalResult;
      
      if (filter?.configName && result.config.name !== filter.configName) {
        continue;
      }
      
      results.push(result);
    }
    

    results.sort((a, b) => b.timestamp - a.timestamp);
    

    if (filter?.limit) {
      results = results.slice(0, filter.limit);
    }
    
    return results;
  }
}

/**
 * In-memory storage for evaluation results (useful for testing)
 */
export class MemoryEvalStorage implements EvalStorage {
  private results: Map<string, EvalResult> = new Map();
  private latest: Map<string, EvalResult> = new Map();
  
  async save(result: EvalResult): Promise<void> {
    this.results.set(result.testId, result);
    this.latest.set(result.config.name, result);
  }
  
  async load(testId: string): Promise<EvalResult | null> {
    return this.results.get(testId) || null;
  }
  
  async getLatest(configName: string): Promise<EvalResult | null> {
    return this.latest.get(configName) || null;
  }
  
  async list(filter?: {configName?: string; limit?: number}): Promise<EvalResult[]> {
    let results = Array.from(this.results.values());
    
    if (filter?.configName) {
      results = results.filter(r => r.config.name === filter.configName);
    }
    
    results.sort((a, b) => b.timestamp - a.timestamp);
    
    if (filter?.limit) {
      results = results.slice(0, filter.limit);
    }
    
    return results;
  }
  
  clear(): void {
    this.results.clear();
    this.latest.clear();
  }
}

/**
 * Default storage instance
 */
export const defaultStorage = new FileEvalStorage();
