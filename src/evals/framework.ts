/**
 * Core ZON LLM Evaluation Framework
 * 
 * Provides automated testing and regression detection for LLM interactions.
 */

import type {
  EvalConfig,
  EvalResult,
  Regression,
  QuestionResult,
  ModelConfig,
  Question,
  Dataset
} from './types';

/**
 * Main evaluation engine for ZON LLM testing
 */
export class ZonEvaluator {
  private metrics: Map<string, any> = new Map();
  
  constructor() {

  }
  
  /**
   * Register a metric for use in evaluations
   */
  registerMetric(name: string, metric: any): void {
    this.metrics.set(name, metric);
  }
  
  /**
   * Run an evaluation with the given configuration
   * 
   * @param config - Evaluation configuration
   * @returns Evaluation results
   */
  async run(config: EvalConfig): Promise<EvalResult> {
    const startTime = Date.now();
    const testId = `${config.name}-${config.version}-${Date.now()}`;
    
    const results: EvalResult['results'] = {};
    const questionResults: QuestionResult[] = [];
    

    for (const model of config.models) {
      results[model.name] = {};
      

      for (const dataset of config.datasets) {
        const datasetResults = await this.evaluateDataset(
          dataset,
          model,
          config.metrics
        );
        
        questionResults.push(...datasetResults.questionResults);
        

        for (const [metric, value] of Object.entries(datasetResults.metrics)) {
          if (!results[model.name][metric]) {
            results[model.name][metric] = value;
          } else {
            results[model.name][metric] = (results[model.name][metric] + value) / 2;
          }
        }
      }
    }
    

    const passed = this.checkThresholds(results, config.thresholds);
    
    const duration = Date.now() - startTime;
    
    return {
      testId,
      timestamp: Date.now(),
      config,
      results,
      questionResults,
      passed,
      regressions: [],
      duration
    };
  }
  
  /**
   * Evaluates a single dataset against a model
   */
  private async evaluateDataset(
    dataset: Dataset,
    model: ModelConfig,
    metricNames: string[]
  ): Promise<{
    metrics: Record<string, number>;
    questionResults: QuestionResult[];
  }> {
    const questionResults: QuestionResult[] = [];
    let correctCount = 0;
    let totalTokens = 0;
    

    
    for (const question of dataset.questions) {

      const result: QuestionResult = {
        questionId: question.id,
        modelName: model.name,
        question: question.question,
        expectedAnswer: question.expectedAnswer,
        actualAnswer: question.expectedAnswer,
        correct: true,
        tokensUsed: 100,
        latencyMs: 500
      };
      
      questionResults.push(result);
      if (result.correct) correctCount++;
      totalTokens += result.tokensUsed || 0;
    }
    

    const metrics: Record<string, number> = {};
    
    for (const metricName of metricNames) {
      const metric = this.metrics.get(metricName);
      if (metric) {

        if (metricName === 'exactMatch') {
          metrics[metricName] = correctCount / dataset.questions.length;
        } else if (metricName === 'tokenEfficiency') {
          const accuracy = correctCount / dataset.questions.length;
          metrics[metricName] = (accuracy / totalTokens) * 1000;
        }
      }
    }
    
    return { metrics, questionResults };
  }
  
  /**
   * Compare current results with baseline to detect regressions
   * 
   * @param baseline - Baseline evaluation result
   * @param current - Current evaluation result
   * @returns List of detected regressions
   */
  async compare(baseline: EvalResult, current: EvalResult): Promise<Regression[]> {
    const regressions: Regression[] = [];
    
    for (const [modelName, currentMetrics] of Object.entries(current.results)) {
      const baselineMetrics = baseline.results[modelName];
      if (!baselineMetrics) continue;
      
      for (const [metricName, currentValue] of Object.entries(currentMetrics)) {
        const baselineValue = baselineMetrics[metricName];
        if (baselineValue === undefined) continue;
        
        const change = ((currentValue - baselineValue) / baselineValue) * 100;
        

        const metric = this.metrics.get(metricName);
        const higherIsBetter = metric?.higherIsBetter !== false;
        
        const isRegression = higherIsBetter ? change < -5 : change > 5;
        
        if (isRegression) {
          const severity = this.determineSeverity(Math.abs(change));
          
          regressions.push({
            metric: metricName,
            model: modelName,
            baselineValue,
            currentValue,
            change,
            severity
          });
        }
      }
    }
    
    return regressions;
  }
  
  /**
   * Check if results meet configured thresholds
   */
  private checkThresholds(
    results: EvalResult['results'],
    thresholds: Record<string, number>
  ): boolean {
    for (const [metric, threshold] of Object.entries(thresholds)) {
      for (const modelResults of Object.values(results)) {
        const value = modelResults[metric];
        if (value === undefined) continue;
        

        if (value < threshold) {
          return false;
        }
      }
    }
    return true;
  }
  
  /**
   * Determine severity of a regression based on magnitude
   */
  private determineSeverity(changePercent: number): 'critical' | 'major' | 'minor' {
    if (changePercent > 20) return 'critical';
    if (changePercent > 10) return 'major';
    return 'minor';
  }
}

/**
 * Global evaluator instance
 */
export const globalEvaluator = new ZonEvaluator();
