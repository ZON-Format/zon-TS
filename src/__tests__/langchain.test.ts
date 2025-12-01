import { ZonOutputParser } from '../langchain';

describe('ZonOutputParser', () => {
  const parser = new ZonOutputParser();

  it('parses valid ZON output', async () => {
    const output = 'user{name:Alice,age:30}';
    const result = await parser.parse(output);
    expect(result).toEqual({ user: { name: 'Alice', age: 30 } });
  });

  it('parses ZON inside markdown code blocks', async () => {
    const output = '```zon\nuser{name:Bob}\n```';
    const result = await parser.parse(output);
    expect(result).toEqual({ user: { name: 'Bob' } });
  });

  it('provides format instructions', () => {
    const instructions = parser.getFormatInstructions();
    expect(instructions).toContain('Your response must be formatted as ZON');
    expect(instructions).toContain('key:value');
  });

  it('throws error on invalid ZON', async () => {
    const output = 'items:@(2)'; // Missing columns and data
    await expect(parser.parse(output)).rejects.toThrow('Failed to parse ZON output');
  });
});
