/**
 * Benchmark: ZON vs TOON vs JSON
 * Compares token efficiency using GPT-5 o200k_base tokenizer
 */

const { encode: encodeZON } = require('../dist/index');
const { encode: encodeTOON } = require('@toon-format/toon');
const { encode: encodeTokens } = require('gpt-tokenizer');
const datasets = require('./datasets');

// Helper to count tokens using o200k_base tokenizer
function countTokens(text) {
  return encodeTokens(text).length;
}

// Helper to format numbers with commas
function formatNumber(num) {
  return num.toLocaleString();
}

// Helper to calculate percentage difference
function percentDiff(baseline, comparison) {
  const diff = ((comparison - baseline) / baseline) * 100;
  return diff > 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;
}

// Helper to create visual bar
function createBar(percentage, width = 20) {
  const filled = Math.round((percentage / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

// Run benchmark for a single dataset
function benchmarkDataset(name, data, description) {
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`📊 ${name}`);
  if (description) {
    console.log(`   ${description}`);
  }
  console.log('─'.repeat(80));

  // Encode in different formats
  const jsonFormatted = JSON.stringify(data, null, 2);
  const jsonCompact = JSON.stringify(data);
  const zonEncoded = encodeZON(data);
  const toonEncoded = encodeTOON(data);

  // Count tokens
  const jsonFormattedTokens = countTokens(jsonFormatted);
  const jsonCompactTokens = countTokens(jsonCompact);
  const zonTokens = countTokens(zonEncoded);
  const toonTokens = countTokens(toonEncoded);

  // Calculate byte sizes
  const jsonFormattedBytes = Buffer.byteLength(jsonFormatted, 'utf8');
  const jsonCompactBytes = Buffer.byteLength(jsonCompact, 'utf8');
  const zonBytes = Buffer.byteLength(zonEncoded, 'utf8');
  const toonBytes = Buffer.byteLength(toonEncoded, 'utf8');

  // Find the winner (minimum tokens)
  const tokenCounts = { ZON: zonTokens, TOON: toonTokens, JSON: jsonFormattedTokens, 'JSON (compact)': jsonCompactTokens };
  const winner = Object.keys(tokenCounts).reduce((a, b) => tokenCounts[a] < tokenCounts[b] ? a : b);
  const maxTokens = Math.max(...Object.values(tokenCounts));

  // Display results
  console.log('\n🎯 TOKEN COUNTS (using o200k_base tokenizer):');
  console.log('');
  
  // ZON
  const zonBar = createBar((zonTokens / maxTokens) * 100);
  const zonVsJsonFormatted = percentDiff(jsonFormattedTokens, zonTokens);
  const zonVsJsonCompact = percentDiff(jsonCompactTokens, zonTokens);
  const zonVsToon = percentDiff(toonTokens, zonTokens);
  console.log(`  ZON          ${zonBar} ${formatNumber(zonTokens)} tokens ${winner === 'ZON' ? '👑' : ''}`);
  console.log(`               ├─ vs JSON formatted:  ${zonVsJsonFormatted}`);
  console.log(`               ├─ vs JSON compact:    ${zonVsJsonCompact}`);
  console.log(`               └─ vs TOON:            ${zonVsToon}`);
  console.log('');

  // TOON
  const toonBar = createBar((toonTokens / maxTokens) * 100);
  const toonVsJsonFormatted = percentDiff(jsonFormattedTokens, toonTokens);
  const toonVsJsonCompact = percentDiff(jsonCompactTokens, toonTokens);
  const toonVsZon = percentDiff(zonTokens, toonTokens);
  console.log(`  TOON         ${toonBar} ${formatNumber(toonTokens)} tokens ${winner === 'TOON' ? '👑' : ''}`);
  console.log(`               ├─ vs JSON formatted:  ${toonVsJsonFormatted}`);
  console.log(`               ├─ vs JSON compact:    ${toonVsJsonCompact}`);
  console.log(`               └─ vs ZON:             ${toonVsZon}`);
  console.log('');

  // JSON (formatted)
  const jsonFormattedBar = createBar((jsonFormattedTokens / maxTokens) * 100);
  console.log(`  JSON         ${jsonFormattedBar} ${formatNumber(jsonFormattedTokens)} tokens ${winner === 'JSON' ? '👑' : ''}`);
  console.log(`  (formatted)`);
  console.log('');

  // JSON (compact)
  const jsonCompactBar = createBar((jsonCompactTokens / maxTokens) * 100);
  console.log(`  JSON         ${jsonCompactBar} ${formatNumber(jsonCompactTokens)} tokens ${winner === 'JSON (compact)' ? '👑' : ''}`);
  console.log(`  (compact)`);
  console.log('');

  console.log('📦 BYTE SIZES:');
  console.log(`  ZON:              ${formatNumber(zonBytes)} bytes`);
  console.log(`  TOON:             ${formatNumber(toonBytes)} bytes`);
  console.log(`  JSON (formatted): ${formatNumber(jsonFormattedBytes)} bytes`);
  console.log(`  JSON (compact):   ${formatNumber(jsonCompactBytes)} bytes`);

  return {
    name,
    tokens: { ZON: zonTokens, TOON: toonTokens, JSON: jsonFormattedTokens, JSONCompact: jsonCompactTokens },
    bytes: { ZON: zonBytes, TOON: toonBytes, JSON: jsonFormattedBytes, JSONCompact: jsonCompactBytes },
    winner
  };
}

// Main benchmark runner
console.log('╔════════════════════════════════════════════════════════════════════════════╗');
console.log('║                    ZON vs TOON vs JSON BENCHMARK                           ║');
console.log('║                   Token Efficiency Comparison                              ║');
console.log('║                   Using GPT-5 o200k_base tokenizer                         ║');
console.log('╚════════════════════════════════════════════════════════════════════════════╝');

const results = [];

// Run all benchmarks
results.push(benchmarkDataset(
  'E-commerce Orders',
  datasets.ecommerceOrders,
  'Nested structures with customer info and order items'
));

results.push(benchmarkDataset(
  'Employee Records',
  datasets.employees,
  'Uniform tabular data - perfect for compression'
));

results.push(benchmarkDataset(
  'Time-Series Analytics',
  datasets.timeSeries,
  'Uniform numerical data with metrics over time'
));

results.push(benchmarkDataset(
  'Hike Data (Mixed)',
  datasets.hikeData,
  'Mixed structure with context, arrays, and tabular data'
));

results.push(benchmarkDataset(
  'GitHub Repositories',
  datasets.githubRepos,
  'Tabular data with mixed string and numerical values'
));

results.push(benchmarkDataset(
  'Deep Configuration',
  datasets.deepConfig,
  'Deeply nested object - challenging for tabular formats'
));

results.push(benchmarkDataset(
  'Event Logs (Semi-uniform)',
  datasets.eventLogs,
  'Semi-uniform data with some missing/variable fields'
));

// Summary
console.log(`\n${'═'.repeat(80)}`);
console.log('📈 OVERALL SUMMARY');
console.log('═'.repeat(80));

const totalZON = results.reduce((sum, r) => sum + r.tokens.ZON, 0);
const totalTOON = results.reduce((sum, r) => sum + r.tokens.TOON, 0);
const totalJSON = results.reduce((sum, r) => sum + r.tokens.JSON, 0);
const totalJSONCompact = results.reduce((sum, r) => sum + r.tokens.JSONCompact, 0);

const zonWins = results.filter(r => r.winner === 'ZON').length;
const toonWins = results.filter(r => r.winner === 'TOON').length;
const jsonWins = results.filter(r => r.winner === 'JSON' || r.winner === 'JSON (compact)').length;

console.log('\n🏆 WINS BY FORMAT:');
console.log(`  ZON:  ${zonWins}/${results.length} datasets`);
console.log(`  TOON: ${toonWins}/${results.length} datasets`);
console.log(`  JSON: ${jsonWins}/${results.length} datasets`);

console.log('\n📊 TOTAL TOKENS ACROSS ALL DATASETS:');
const maxTotal = Math.max(totalZON, totalTOON, totalJSON, totalJSONCompact);

const zonTotalBar = createBar((totalZON / maxTotal) * 100, 30);
console.log(`  ZON:              ${zonTotalBar} ${formatNumber(totalZON)} tokens`);
console.log(`                    vs JSON formatted:  ${percentDiff(totalJSON, totalZON)}`);
console.log(`                    vs JSON compact:    ${percentDiff(totalJSONCompact, totalZON)}`);
console.log(`                    vs TOON:            ${percentDiff(totalTOON, totalZON)}`);
console.log('');

const toonTotalBar = createBar((totalTOON / maxTotal) * 100, 30);
console.log(`  TOON:             ${toonTotalBar} ${formatNumber(totalTOON)} tokens`);
console.log(`                    vs JSON formatted:  ${percentDiff(totalJSON, totalTOON)}`);
console.log(`                    vs JSON compact:    ${percentDiff(totalJSONCompact, totalTOON)}`);
console.log(`                    vs ZON:             ${percentDiff(totalZON, totalTOON)}`);
console.log('');

const jsonTotalBar = createBar((totalJSON / maxTotal) * 100, 30);
console.log(`  JSON (formatted): ${jsonTotalBar} ${formatNumber(totalJSON)} tokens`);
console.log('');

const jsonCompactTotalBar = createBar((totalJSONCompact / maxTotal) * 100, 30);
console.log(`  JSON (compact):   ${jsonCompactTotalBar} ${formatNumber(totalJSONCompact)} tokens`);

console.log('\n' + '═'.repeat(80));
console.log('✨ Benchmark complete!');
console.log('═'.repeat(80) + '\n');
