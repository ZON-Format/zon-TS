#!/usr/bin/env node
import { encode, decode, encodeBinary, decodeBinary } from './index';
import { prettyPrint, diffPrint } from './tools/printer';
import { validateZon } from './tools/validator';
import { analyze, compareFormats } from './tools/helpers';
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

/**
 * Prints usage instructions to stderr.
 */
function printUsage() {
  console.error('Usage: zon <command> <file> [options]');
  console.error('Commands:');
  console.error('  encode   Convert JSON file to ZON');
  console.error('  decode   Convert ZON file to JSON');
  console.error('  convert  Convert between formats (JSON/ZON/Binary)');
  console.error('  validate Check ZON file validity');
  console.error('  stats    Show ZON file statistics');
  console.error('  format   Canonicalize/pretty-print ZON file');
  console.error('  analyze  Analyze data structure complexity');
  console.error('  diff     Compare two ZON files');
  console.error('Options:');
  console.error('  --format <json|csv|yaml|binary>  Specify format');
  console.error('  --to <zon|json|binary>           Target format for convert');
  console.error('  --colors                          Use syntax highlighting');
  console.error('  --strict                          Strict validation mode');
}

/**
 * Parses CSV content into an array of objects.
 * 
 * @param content - CSV string content
 * @returns Array of parsed objects
 */
function parseCSV(content: string): any[] {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const result = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
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
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
        }
        
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
    const useColors = args.includes('--colors');
    const decoded = decode(content);
    const formatted = encode(decoded);
    console.log(useColors ? prettyPrint(formatted) : formatted);
  } else if (command === 'analyze') {
    const decoded = decode(content);
    const stats = analyze(decoded);
    const sizes = compareFormats(decoded);
    
    console.log('📊 Data Analysis');
    console.log('=================');
    console.log(`Depth:          ${stats.depth}`);
    console.log(`Field Count:    ${stats.fieldCount}`);
    console.log(`Array Count:    ${stats.arrayCount}`);
    console.log(`Object Count:   ${stats.objectCount}`);
    console.log(`Primitive Count: ${stats.primitiveCount}`);
    console.log(`Total Nodes:    ${stats.totalNodes}`);
    console.log(`Types Found:    ${Array.from(stats.types).join(', ')}`);
    console.log('');
    console.log('Format Sizes:');
    console.log(`  ZON:    ${sizes.zon} bytes`);
    console.log(`  Binary: ${sizes.binary} bytes (-${sizes.savings.binaryVsZon.toFixed(1)}%)`);
    console.log(`  JSON:   ${sizes.json} bytes (+${((sizes.json/sizes.zon - 1) * 100).toFixed(1)}%)`);
  } else if (command === 'diff') {
    const file2 = args[2];
    if (!file2) {
      console.error('Error: diff requires two files');
      console.error('Usage: zon diff <file1> <file2>');
      process.exit(1);
    }
    const content2 = fs.readFileSync(path.resolve(process.cwd(), file2), 'utf-8');
    const useColors = args.includes('--colors');
    console.log(diffPrint(content, content2, { colors: useColors }));
  } else if (command === 'validate') {
    const strict = args.includes('--strict');
    
    if (strict) {
      const result = validateZon(content);
      
      if (result.valid) {
        console.log('✅ Valid ZON file.');
      } else {
        console.error('❌ Invalid ZON file.');
        result.errors.forEach(err => {
          console.error(`  Error at ${err.path}: ${err.message}`);
        });
      }
      
      if (result.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        result.warnings.forEach(warn => {
          console.log(`  [${warn.rule}] ${warn.path}: ${warn.message}`);
        });
      }
      
      if (result.suggestions.length > 0) {
        console.log('\n💡 Suggestions:');
        result.suggestions.forEach(sug => console.log(`  - ${sug}`));
      }
      
      process.exit(result.valid ? 0 : 1);

    } else {
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
    }
  } else if (command === 'convert') {
    const ext = path.extname(inputFile).toLowerCase();
    const formatArg = args.find(a => a.startsWith('--format='));
    const toArg = args.find(a => a.startsWith('--to='));
    const format = formatArg ? formatArg.split('=')[1] : ext.replace('.', '');
    const targetFormat = toArg ? toArg.split('=')[1] : 'zon';

    let data;
    if (format === 'binary' || format === 'zonb') {
      const buffer = fs.readFileSync(absolutePath);
      data = decodeBinary(new Uint8Array(buffer));
    } else if (format === 'json') {
      data = JSON.parse(content);
    } else if (format === 'yaml' || format === 'yml') {
      data = yaml.load(content);
    } else if (format === 'csv') {
      data = parseCSV(content);
    } else if (format === 'zon' || format === 'zonf') {
      data = decode(content);
    } else {
      console.error(`Unsupported format: ${format}`);
      process.exit(1);
    }
    
    if (targetFormat === 'zon') {
      console.log(encode(data));
    } else if (targetFormat === 'binary') {
      const binary = encodeBinary(data);
      process.stdout.write(Buffer.from(binary));
    } else if (targetFormat === 'json') {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.error(`Unsupported target format: ${targetFormat}`);
      process.exit(1);
    }
  } else {
    console.error('Unknown command:', command);
    printUsage();
    process.exit(1);
  }
} catch (error) {
  console.error('Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}
