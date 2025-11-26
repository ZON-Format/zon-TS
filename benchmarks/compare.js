/**
 * Format Comparison Examples
 * Shows how the same data looks in ZON vs TOON vs JSON
 */

const { encode: encodeZON } = require('../dist/index');
const { encode: encodeTOON } = require('@toon-format/toon');

// Sample data: Employee records
const employees = [
  { id: 1, name: 'John Doe', department: 'Engineering', salary: 95000, active: true },
  { id: 2, name: 'Jane Smith', department: 'Marketing', salary: 82000, active: true },
  { id: 3, name: 'Mike Johnson', department: 'Sales', salary: 78000, active: false }
];

console.log('╔════════════════════════════════════════════════════════════════════════════╗');
console.log('║                      FORMAT COMPARISON EXAMPLES                            ║');
console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

console.log('📊 Sample Data: Employee Records\n');

// JSON Formatted
console.log('─'.repeat(80));
console.log('JSON (Formatted - 2 spaces):');
console.log('─'.repeat(80));
const jsonFormatted = JSON.stringify(employees, null, 2);
console.log(jsonFormatted);
console.log(`\nSize: ${Buffer.byteLength(jsonFormatted)} bytes\n`);

// JSON Compact
console.log('─'.repeat(80));
console.log('JSON (Compact):');
console.log('─'.repeat(80));
const jsonCompact = JSON.stringify(employees);
console.log(jsonCompact);
console.log(`\nSize: ${Buffer.byteLength(jsonCompact)} bytes\n`);

// TOON
console.log('─'.repeat(80));
console.log('TOON:');
console.log('─'.repeat(80));
const toonEncoded = encodeTOON(employees);
console.log(toonEncoded);
console.log(`\nSize: ${Buffer.byteLength(toonEncoded)} bytes\n`);

// ZON
console.log('─'.repeat(80));
console.log('ZON:');
console.log('─'.repeat(80));
const zonEncoded = encodeZON(employees);
console.log(zonEncoded);
console.log(`\nSize: ${Buffer.byteLength(zonEncoded)} bytes\n`);

// Comparison
console.log('═'.repeat(80));
console.log('📈 COMPARISON:');
console.log('═'.repeat(80));
console.log(`JSON (formatted): ${Buffer.byteLength(jsonFormatted)} bytes`);
console.log(`JSON (compact):   ${Buffer.byteLength(jsonCompact)} bytes`);
console.log(`TOON:             ${Buffer.byteLength(toonEncoded)} bytes`);
console.log(`ZON:              ${Buffer.byteLength(zonEncoded)} bytes`);
console.log('');
console.log(`ZON saves ${((1 - Buffer.byteLength(zonEncoded) / Buffer.byteLength(jsonFormatted)) * 100).toFixed(1)}% vs JSON (formatted)`);
console.log(`ZON saves ${((1 - Buffer.byteLength(zonEncoded) / Buffer.byteLength(jsonCompact)) * 100).toFixed(1)}% vs JSON (compact)`);
console.log(`ZON saves ${((1 - Buffer.byteLength(zonEncoded) / Buffer.byteLength(toonEncoded)) * 100).toFixed(1)}% vs TOON`);
console.log('═'.repeat(80));

// Example 2: Mixed structure
console.log('\n\n📊 Sample Data: Mixed Structure (Context + Array)\n');

const hikeData = {
  context: { location: 'Boulder', season: 'spring_2025' },
  hikes: [
    { name: 'Blue Lake Trail', distanceKm: 7.5, companion: 'ana', wasSunny: true },
    { name: 'Ridge Overlook', distanceKm: 9.2, companion: 'luis', wasSunny: false }
  ]
};

console.log('─'.repeat(80));
console.log('JSON (Formatted):');
console.log('─'.repeat(80));
console.log(JSON.stringify(hikeData, null, 2));
console.log('');

console.log('─'.repeat(80));
console.log('TOON:');
console.log('─'.repeat(80));
console.log(encodeTOON(hikeData));
console.log('');

console.log('─'.repeat(80));
console.log('ZON:');
console.log('─'.repeat(80));
console.log(encodeZON(hikeData));
console.log('');

console.log('💡 Notice:');
console.log('  • ZON uses compact key:value notation for context');
console.log('  • ZON uses @tablename(count):headers for tabular arrays');
console.log('  • TOON uses explicit type declarations like [2]{field,...}');
console.log('  • Both are human-readable and much smaller than JSON');
console.log('═'.repeat(80));
