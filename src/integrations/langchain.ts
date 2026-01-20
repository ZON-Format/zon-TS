import { BaseOutputParser } from "@langchain/core/output_parsers";
import { decode } from "../index";

/**
 * Parser for ZON (Zero Overhead Notation) output.
 */
export class ZonOutputParser<T = any> extends BaseOutputParser<T> {
  lc_namespace = ["zon", "output_parsers"];

  /**
   * Returns instructions on how to format the output as ZON.
   * @returns Format instructions string
   */
  getFormatInstructions(): string {
    return `Your response must be formatted as ZON (Zero Overhead Notation).
ZON is a compact format for structured data.
Rules:
1. Use 'key:value' for properties.
2. Use 'key{...}' for nested objects.
3. Use 'key[...]' for arrays.
4. Use '@(N):col1,col2' for tables.
5. Use 'T'/'F' for booleans, 'null' for null.

Example:
user{name:Alice,role:admin}
items:@(2):id,name
1,Item A
2,Item B
`;
  }

  /**
   * Parses the output text into a typed object.
   * @param text - The output text to parse
   * @returns Parsed object
   */
  async parse(text: string): Promise<T> {
    try {
      const cleaned = text.replace(/```(zon|zonf)?/g, "").trim();
      return decode(cleaned) as T;
    } catch (e: any) {
      throw new Error(`Failed to parse ZON output: ${e.message}`);
    }
  }
}
