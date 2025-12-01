#!/usr/bin/env node
import { encode, decode } from './index';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

const args = process.argv.slice(2);
const command = args[0];
const inputFile = args[1];

if (!command || !inputFile) {
  printUsage();
  process.exit(1);
}

function printUsage() {
  console.error('Usage: zon <command> <file> [options]');
  console.error('Commands:');
  console.error('  encode   Convert JSON file to ZON');
  console.error('  decode   Convert ZON file to JSON');
  console.error('  convert  Convert JSON/CSV/YAML file to ZON');
  console.error('  validate Check ZON file validity');
  console.error('  stats    Show ZON file statistics');
  console.error('  format   Canonicalize/pretty-print ZON file');
  console.error('Options:');
  console.error('  --format <json|csv|yaml>  Explicitly specify input format');
}

function parseCSV(content: string): any[] {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const result = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Basic CSV regex to handle quoted commas
    const values: string[] = [];
    let inQuote = false;
    let currentValue = '';
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === ',' && !inQuote) {
        values.push(currentValue);
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue);

    const obj: Record<string, any> = {};
    headers.forEach((header, index) => {
      let val = values[index]?.trim();
      if (val) {
         // Remove quotes if present
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
        }
        
        // Type inference
        if (val === 'true') obj[header] = true;
        else if (val === 'false') obj[header] = false;
        else if (val === 'null') obj[header] = null;
        else if (!isNaN(Number(val)) && val !== '') obj[header] = Number(val);
        else obj[header] = val;
      } else {
        obj[header] = null;
      }
    });
    result.push(obj);
  }
  return result;
}

try {
  const absolutePath = path.resolve(process.cwd(), inputFile);
  const content = fs.readFileSync(absolutePath, 'utf-8');

  if (command === 'encode') {
    const json = JSON.parse(content);
    console.log(encode(json));
  } else if (command === 'decode') {
    const decoded = decode(content);
    console.log(JSON.stringify(decoded, null, 2));
  } else if (command === 'validate') {
    try {
      decode(content);
      console.log('✅ Valid ZON file.');
    } catch (e: any) {
      console.error('❌ Invalid ZON file.');
      console.error(`Error: ${e.message}`);
      if (e.line) console.error(`Line: ${e.line}`);
      if (e.column) console.error(`Column: ${e.column}`);
      process.exit(1);
    }
  } else if (command === 'stats') {
    const start = process.hrtime();
    const decoded = decode(content);
    const end = process.hrtime(start);
    const parseTime = (end[0] * 1000 + end[1] / 1e6).toFixed(2);

    const jsonString = JSON.stringify(decoded);
    const zonSize = content.length;
    const jsonSize = jsonString.length;
    const savings = ((jsonSize - zonSize) / jsonSize * 100).toFixed(1);

    console.log('📊 ZON File Statistics');
    console.log('---------------------');
    console.log(`File:        ${path.basename(inputFile)}`);
    console.log(`Size:        ${zonSize.toLocaleString()} bytes`);
    console.log(`JSON Size:   ${jsonSize.toLocaleString()} bytes`);
    console.log(`Savings:     ${savings}% vs Compact JSON`);
    console.log(`Parse Time:  ${parseTime}ms`);
    console.log('---------------------');
    console.log(`Structure:   ${Array.isArray(decoded) ? `Array (${decoded.length} items)` : 'Object'}`);
  } else if (command === 'convert') {
    const ext = path.extname(inputFile).toLowerCase();
    const formatArg = args.find(a => a.startsWith('--format='));
    const format = formatArg ? formatArg.split('=')[1] : ext.replace('.', '');

    let data;
    if (format === 'json') {
      data = JSON.parse(content);
    } else if (format === 'yaml' || format === 'yml') {
      data = yaml.load(content);
    } else if (format === 'csv') {
      data = parseCSV(content);
    } else {
      console.error(`Unsupported format: ${format}`);
      process.exit(1);
    }
    
    console.log(encode(data));
  } else if (command === 'format') {
    const decoded = decode(content);
    console.log(encode(decoded));
  } else {
    console.error('Unknown command:', command);
    printUsage();
    process.exit(1);
  }
} catch (error) {
  console.error('Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}
