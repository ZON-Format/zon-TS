import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { decode, encode } from '../index';

const CLI_PATH = path.resolve(__dirname, '../../dist/cli.js');
const TEMP_DIR = path.resolve(__dirname, 'temp_cli_test');

describe('CLI Convert Command', () => {
  beforeAll(() => {
    // Ensure dist exists
    try {
      execSync('npm run build');
    } catch (e) {
      // Ignore if already built or error (will fail tests anyway)
    }
    
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR);
    }
  });

  afterAll(() => {
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  });

  const runCli = (args: string) => {
    return execSync(`node ${CLI_PATH} ${args}`, { encoding: 'utf-8' });
  };

  it('converts JSON to ZON', () => {
    const data = { name: 'Test', value: 123 };
    const inputFile = path.join(TEMP_DIR, 'data.json');
    fs.writeFileSync(inputFile, JSON.stringify(data));

    const output = runCli(`convert ${inputFile}`);
    const decoded = decode(output);
    expect(decoded).toEqual(data);
  });

  it('converts CSV to ZON', () => {
    const csvContent = 'name,age,active\nAlice,30,true\nBob,25,false';
    const inputFile = path.join(TEMP_DIR, 'data.csv');
    fs.writeFileSync(inputFile, csvContent);

    const output = runCli(`convert ${inputFile}`);
    const decoded = decode(output);
    
    expect(decoded).toEqual([
      { name: 'Alice', age: 30, active: true },
      { name: 'Bob', age: 25, active: false }
    ]);
  });

  it('converts YAML to ZON', () => {
    const yamlContent = `
name: Test
items:
  - id: 1
    val: A
  - id: 2
    val: B
`;
    const inputFile = path.join(TEMP_DIR, 'data.yaml');
    fs.writeFileSync(inputFile, yamlContent);

    const output = runCli(`convert ${inputFile}`);
    const decoded = decode(output);
    
    expect(decoded).toEqual({
      name: 'Test',
      items: [
        { id: 1, val: 'A' },
        { id: 2, val: 'B' }
      ]
    });
  });

  it('supports explicit format flag', () => {
    const jsonContent = '{"a":1}';
    const inputFile = path.join(TEMP_DIR, 'data.txt'); // Wrong extension
    fs.writeFileSync(inputFile, jsonContent);

    const output = runCli(`convert ${inputFile} --format=json`);
    const decoded = decode(output);
    expect(decoded).toEqual({ a: 1 });
  });

  describe('CLI Validate Command', () => {
    it('validates a correct ZON file', () => {
      const zonContent = 'name:Test\nvalue:123';
      const inputFile = path.join(TEMP_DIR, 'valid.zonf');
      fs.writeFileSync(inputFile, zonContent);

      const output = runCli(`validate ${inputFile}`);
      expect(output).toContain('✅ Valid ZON file');
    });

    it('fails on invalid ZON file', () => {
      const invalidContent = 'users:@(2):id\n1'; // Missing row
      const inputFile = path.join(TEMP_DIR, 'invalid.zonf');
      fs.writeFileSync(inputFile, invalidContent);

      try {
        runCli(`validate ${inputFile}`);
        fail('Should have thrown error');
      } catch (e: any) {
        expect(e.message).toContain('Command failed');
        // stderr is not captured by default execSync unless we handle it, 
        // but exit code 1 causes throw.
      }
    });
  });

  describe('CLI Stats Command', () => {
    it('shows statistics for ZON file', () => {
      const zonContent = 'users:@(2):id,name\n1,Alice\n2,Bob';
      const inputFile = path.join(TEMP_DIR, 'stats.zonf');
      fs.writeFileSync(inputFile, zonContent);

      const output = runCli(`stats ${inputFile}`);
      expect(output).toContain('📊 ZON File Statistics');
      expect(output).toContain('Size:');
      expect(output).toContain('JSON Size:');
      expect(output).toContain('Savings:');
    });
  });

  describe('CLI Format Command', () => {
    it('formats/canonicalizes ZON file', () => {
      // Unformatted input (extra spaces, different order if we supported it, but ZON is strict)
      // Actually ZON is strict, but maybe we can test round-trip
      const data = { b: 2, a: 1 };
      const zonContent = encode(data); // "a:1\nb:2" (sorted keys)
      const inputFile = path.join(TEMP_DIR, 'format.zonf');
      fs.writeFileSync(inputFile, zonContent);

      const output = runCli(`format ${inputFile}`);
      expect(output.trim()).toBe(zonContent);
    });
  });
});
