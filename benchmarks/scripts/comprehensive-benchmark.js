require('dotenv').config();
const { encode: encodeZon } = require('../../dist/index');
const { encode: encodeTOON } = require('@toon-format/toon');
const { encode: encodeTokens } = require('gpt-tokenizer');
const comprehensiveDatasets = require('../datasets/comprehensive-datasets');

const { encode: encodeGPT } = require('gpt-tokenizer');
const anthropic = require('@anthropic-ai/tokenizer');
const {LlamaTokenizer} = require('llama-tokenizer-js');

/**
 * Counts Claude tokens for text.
 * 
 * @param {string} text - Text to count
 * @returns {number} Token count
 */
function countClaudeTokens(text) {
  return anthropic.countTokens(text);
}

/**
 * Counts Llama tokens for text.
 * 
 * @param {string} text - Text to count
 * @returns {number} Token count
 */
function countLlamaTokens(text) {
  const llamaTokenizer = new LlamaTokenizer();
  return llamaTokenizer.encode(text).length;
}

const datasetNames = Object.keys(comprehensiveDatasets);

console.log('╔════════════════════════════════════════════════════════════════════════════╗');
console.log('║           COMPREHENSIVE ZON BENCHMARK - 18 Dataset Scenarios              ║');
console.log('║              Testing Token Efficiency Across All Data Shapes              ║');
console.log('╚════════════════════════════════════════════════════════════════════════════╝\\n');

const results = {
  byDataset: {},
  summary: {}
};

for (const datasetName of datasetNames) {
  console.log(`\\n${'='.repeat(80)}`);
  console.log(`📊 ${datasetName}`);
  console.log(`${'─'.repeat(80)}`);
  
  const data = comprehensiveDatasets[datasetName];
  
  let zonEncoded, toonEncoded, jsonCompact;
  try {
    zonEncoded = encodeZon(data);
    toonEncoded = encodeTOON(data);
    jsonCompact = JSON.stringify(data);
  } catch (e) {
    console.error(`  ❌ Encoding failed: ${e.message}`);
    continue;
  }
  
  const zonTokensGPT = encodeGPT(zonEncoded).length;
  const toonTokensGPT = encodeGPT(toonEncoded).length;
  const jsonTokensGPT = encodeGPT(jsonCompact).length;
  
  const zonTokensClaude = countClaudeTokens(zonEncoded);
  const toonTokensClaude = countClaudeTokens(toonEncoded);
  const jsonTokensClaude = countClaudeTokens(jsonCompact);
  
  const zonTokensLlama = countLlamaTokens(zonEncoded);
  const toonTokensLlama = countLlamaTokens(toonEncoded);
  const jsonTokensLlama = countLlamaTokens(jsonCompact);
  
  const savingsVsTOON_GPT = ((toonTokensGPT - zonTokensGPT) / toonTokensGPT * 100).toFixed(1);
  const savingsVsJSON_GPT = ((jsonTokensGPT - zonTokensGPT) / jsonTokensGPT * 100).toFixed(1);
  
  const savingsVsTOON_Claude = ((toonTokensClaude - zonTokensClaude) / toonTokensClaude * 100).toFixed(1);
  const savingsVsJSON_Claude = ((jsonTokensClaude - zonTokensClaude) / jsonTokensClaude * 100).toFixed(1);
  
  const savingsVsTOON_Llama = ((toonTokensLlama - zonTokensLlama) / toonTokensLlama * 100).toFixed(1);
  const savingsVsJSON_Llama = ((jsonTokensLlama - zonTokensLlama) / jsonTokensLlama * 100).toFixed(1);
  
  results.byDataset[datasetName] = {
    gpt4o: {
      zonf: zonTokensGPT,
      toon: toonTokensGPT,
      json: jsonTokensGPT,
      savingsVsTOON: parseFloat(savingsVsTOON_GPT),
      savingsVsJSON: parseFloat(savingsVsJSON_GPT)
    },
    claude: {
      zonf: zonTokensClaude,
      toon: toonTokensClaude,
      json: jsonTokensClaude,
      savingsVsTOON: parseFloat(savingsVsTOON_Claude),
      savingsVsJSON: parseFloat(savingsVsJSON_Claude)
    },
    llama: {
      zonf: zonTokensLlama,
      toon: toonTokensLlama,
      json: jsonTokensLlama,
      savingsVsTOON: parseFloat(savingsVsTOON_Llama),
      savingsVsJSON: parseFloat(savingsVsJSON_Llama)
    }
  };
  
  console.log(`\\n🔹 GPT-4o (o200k):`);
  console.log(`  ZON:  ${zonTokensGPT.toString().padStart(5)} tokens ${zonTokensGPT < toonTokensGPT ? '👑' : ''}`);
  console.log(`  TOON: ${toonTokensGPT.toString().padStart(5)} tokens (ZON ${savingsVsTOON_GPT > 0 ? '-' : '+'}${Math.abs(savingsVsTOON_GPT)}%)`);
  console.log(`  JSON: ${jsonTokensGPT.toString().padStart(5)} tokens (ZON ${savingsVsJSON_GPT > 0 ? '-' : '+'}${Math.abs(savingsVsJSON_GPT)}%)`);
  
  console.log(`\\n🔹 Claude 3.5 (Anthropic):`);
  console.log(`  ZON:  ${zonTokensClaude.toString().padStart(5)} tokens ${zonTokensClaude < toonTokensClaude ? '👑' : ''}`);
  console.log(`  TOON: ${toonTokensClaude.toString().padStart(5)} tokens (ZON ${savingsVsTOON_Claude > 0 ? '-' : '+'}${Math.abs(savingsVsTOON_Claude)}%)`);
  console.log(`  JSON: ${jsonTokensClaude.toString().padStart(5)} tokens (ZON ${savingsVsJSON_Claude > 0 ? '-' : '+'}${Math.abs(savingsVsJSON_Claude)}%)`);
  
  console.log(`\\n🔹 Llama 3 (Meta):`);
  console.log(`  ZON:  ${zonTokensLlama.toString().padStart(5)} tokens ${zonTokensLlama < toonTokensLlama ? '👑' : ''}`);
  console.log(`  TOON: ${toonTokensLlama.toString().padStart(5)} tokens (ZON ${savingsVsTOON_Llama > 0 ? '-' : '+'}${Math.abs(savingsVsTOON_Llama)}%)`);
  console.log(`  JSON: ${jsonTokensLlama.toString().padStart(5)} tokens (ZON ${savingsVsJSON_Llama > 0 ? '-' : '+'}${Math.abs(savingsVsJSON_Llama)}%)`);
}

console.log('\\n\\n╔════════════════════════════════════════════════════════════════════════════╗');
console.log('║                          SUMMARY STATISTICS                                ║');
console.log('╚════════════════════════════════════════════════════════════════════════════╝\\n');

const categories = {
  'Small-Simple': datasetNames.filter(n => n.startsWith('smallSimple')),
  'Medium-Complex': datasetNames.filter(n => n.startsWith('mediumComplex')),
  'Large-Complex': datasetNames.filter(n => n.startsWith('largeComplex'))
};

for (const [categoryName, datasets] of Object.entries(categories)) {
  console.log(`\\n📈 ${categoryName}:`);
  
  const avgGPT = {
    zonWins: datasets.filter(d => results.byDataset[d].gpt4o.zonf < results.byDataset[d].gpt4o.toon).length,
    avgSavingsVsTOON: datasets.reduce((sum, d) => sum + results.byDataset[d].gpt4o.savingsVsTOON, 0) / datasets.length,
    avgSavingsVsJSON: datasets.reduce((sum, d) => sum + results.byDataset[d].gpt4o.savingsVsJSON, 0) / datasets.length
  };
  
  const avgClaude = {
    zonWins: datasets.filter(d => results.byDataset[d].claude.zonf < results.byDataset[d].claude.toon).length,
    avgSavingsVsTOON: datasets.reduce((sum, d) => sum + results.byDataset[d].claude.savingsVsTOON, 0) / datasets.length,
    avgSavingsVsJSON: datasets.reduce((sum, d) => sum + results.byDataset[d].claude.savingsVsJSON, 0) / datasets.length
  };
  
  const avgLlama = {
    zonWins: datasets.filter(d => results.byDataset[d].llama.zonf < results.byDataset[d].llama.toon).length,
    avgSavingsVsTOON: datasets.reduce((sum, d) => sum + results.byDataset[d].llama.savingsVsTOON, 0) / datasets.length,
    avgSavingsVsJSON: datasets.reduce((sum, d) => sum + results.byDataset[d].llama.savingsVsJSON, 0) / datasets.length
  };
  
  console.log(`  GPT-4o:   ZON wins ${avgGPT.zonWins}/${datasets.length} | Avg savings: ${avgGPT.avgSavingsVsTOON.toFixed(1)}% vs TOON, ${avgGPT.avgSavingsVsJSON.toFixed(1)}% vs JSON`);
  console.log(`  Claude:   ZON wins ${avgClaude.zonWins}/${datasets.length} | Avg savings: ${avgClaude.avgSavingsVsTOON.toFixed(1)}% vs TOON, ${avgClaude.avgSavingsVsJSON.toFixed(1)}% vs JSON`);
  console.log(`  Llama 3:  ZON wins ${avgLlama.zonWins}/${datasets.length} | Avg savings: ${avgLlama.avgSavingsVsTOON.toFixed(1)}% vs TOON, ${avgLlama.avgSavingsVsJSON.toFixed(1)}% vs JSON`);
}

console.log(`\\n\\n📊 OVERALL PERFORMANCE:`);

const allDatasets = datasetNames;
const overallGPT = {
  zonWins: allDatasets.filter(d => results.byDataset[d].gpt4o.zonf < results.byDataset[d].gpt4o.toon).length,
  avgSavingsVsTOON: allDatasets.reduce((sum, d) => sum + results.byDataset[d].gpt4o.savingsVsTOON, 0) / allDatasets.length,
  avgSavingsVsJSON: allDatasets.reduce((sum, d) => sum + results.byDataset[d].gpt4o.savingsVsJSON, 0) / allDatasets.length
};

const overallClaude = {
  zonWins: allDatasets.filter(d => results.byDataset[d].claude.zonf < results.byDataset[d].claude.toon).length,
  avgSavingsVsTOON: allDatasets.reduce((sum, d) => sum + results.byDataset[d].claude.savingsVsTOON, 0) / allDatasets.length,
  avgSavingsVsJSON: allDatasets.reduce((sum, d) => sum + results.byDataset[d].claude.savingsVsJSON, 0) / allDatasets.length
};

const overallLlama = {
  zonWins: allDatasets.filter(d => results.byDataset[d].llama.zonf < results.byDataset[d].llama.toon).length,
  avgSavingsVsTOON: allDatasets.reduce((sum, d) => sum + results.byDataset[d].llama.savingsVsTOON, 0) / allDatasets.length,
  avgSavingsVsJSON: allDatasets.reduce((sum, d) => sum + results.byDataset[d].llama.savingsVsJSON, 0) / allDatasets.length
};

console.log(`  GPT-4o:   ZON wins ${overallGPT.zonWins}/${allDatasets.length} datasets (${(overallGPT.zonWins / allDatasets.length * 100).toFixed(0)}%)`);
console.log(`            Average savings: ${overallGPT.avgSavingsVsTOON.toFixed(1)}% vs TOON, ${overallGPT.avgSavingsVsJSON.toFixed(1)}% vs JSON`);

console.log(`\\n  Claude:   ZON wins ${overallClaude.zonWins}/${allDatasets.length} datasets (${(overallClaude.zonWins / allDatasets.length * 100).toFixed(0)}%)`);
console.log(`            Average savings: ${overallClaude.avgSavingsVsTOON.toFixed(1)}% vs TOON, ${overallClaude.avgSavingsVsJSON.toFixed(1)}% vs JSON`);

console.log(`\\n  Llama 3:  ZON wins ${overallLlama.zonWins}/${allDatasets.length} datasets (${(overallLlama.zonWins / allDatasets.length * 100).toFixed(0)}%)`);
console.log(`            Average savings: ${overallLlama.avgSavingsVsTOON.toFixed(1)}% vs TOON, ${overallLlama.avgSavingsVsJSON.toFixed(1)}% vs JSON`);

console.log('\\n' + '='.repeat(80));
console.log('✨ Comprehensive benchmark complete!\\n');

const fs = require('fs');
const resultsPath = require('path').join(__dirname, 'comprehensive-results.json');
fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
console.log(`💾 Detailed results saved to: ${resultsPath}\\n`);
