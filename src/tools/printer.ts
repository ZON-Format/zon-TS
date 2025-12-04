/**
 * ZON Pretty Printer
 * 
 * Format and colorize ZON output for better readability
 */

export interface PrinterOptions {
  /** Use colors for syntax highlighting */
  colors?: boolean;
  
  /** Indentation string (default: 2 spaces) */
  indent?: string;
  
  /** Show line numbers */
  lineNumbers?: boolean;
  
  /** Maximum line length before wrapping */
  maxLineLength?: number;
}

/**
 * ANSI color codes for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Foreground colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

/**
 * Pretty print ZON with syntax highlighting
 */
export function prettyPrint(zon: string, options: PrinterOptions = {}): string {
  const {
    colors: useColors = true,
    indent = '  ',
    lineNumbers = false,
    maxLineLength = 80
  } = options;
  
  if (!useColors) {
    return zon;
  }
  

  let highlighted = zon

    .replace(/"([^"]*)"/g, useColors ? `${colors.green}"$1"${colors.reset}` : '"$1"')

    .replace(/\b(\d+(\.\d+)?)\b/g, useColors ? `${colors.cyan}$1${colors.reset}` : '$1')

    .replace(/\b(true|false)\b/g, useColors ? `${colors.yellow}$1${colors.reset}` : '$1')

    .replace(/\bnull\b/g, useColors ? `${colors.dim}null${colors.reset}` : 'null')

    .replace(/^(\s*)(\w+):/gm, useColors ? `$1${colors.blue}$2${colors.reset}:` : '$1$2:')

    .replace(/(\/\/.*$)/gm, useColors ? `${colors.gray}$1${colors.reset}` : '$1');
  
  if (lineNumbers) {
    const lines = highlighted.split('\n');
    const numWidth = String(lines.length).length;
    highlighted = lines
      .map((line, i) => {
        const num = String(i + 1).padStart(numWidth, ' ');
        return useColors 
          ? `${colors.gray}${num}${colors.reset} ${line}`
          : `${num} ${line}`;
      })
      .join('\n');
  }
  
  return highlighted;
}

/**
 * Format a diff between two ZON strings
 */
export function diffPrint(oldZon: string, newZon: string, options: PrinterOptions = {}): string {
  const { colors: useColors = true } = options;
  
  const oldLines = oldZon.split('\n');
  const newLines = newZon.split('\n');
  
  const maxLines = Math.max(oldLines.length, newLines.length);
  const diff: string[] = [];
  
  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i] || '';
    const newLine = newLines[i] || '';
    
    if (oldLine === newLine) {
      diff.push(`  ${oldLine}`);
    } else if (!oldLine) {
      const line = useColors ? `${colors.green}+ ${newLine}${colors.reset}` : `+ ${newLine}`;
      diff.push(line);
    } else if (!newLine) {
      const line = useColors ? `${colors.red}- ${oldLine}${colors.reset}` : `- ${oldLine}`;
      diff.push(line);
    } else {
      const oldStyled = useColors ? `${colors.red}- ${oldLine}${colors.reset}` : `- ${oldLine}`;
      const newStyled = useColors ? `${colors.green}+ ${newLine}${colors.reset}` : `+ ${newLine}`;
      diff.push(oldStyled);
      diff.push(newStyled);
    }
  }
  
  return diff.join('\n');
}

/**
 * Compact print - minimize whitespace
 */
export function compactPrint(zon: string): string {
  return zon
    .replace(/\n\s*/g, ' ')  // Remove newlines and indentation
    .replace(/\s+/g, ' ')     // Collapse multiple spaces
    .replace(/,\s+/g, ',')    // Remove space after commas
    .replace(/:\s+/g, ':')    // Remove space after colons
    .trim();
}

/**
 * Expand print - add whitespace for readability
 */
export function expandPrint(zon: string, indentSize: number = 2): string {
  const indentStr = ' '.repeat(indentSize);
  let result = '';
  let indent = 0;
  let inString = false;
  let inTable = false;
  let tableBraceBalance = 0;
  let tableBracketBalance = 0;
  let justPoppedFlatObject = false;
  const contextStack: ('array' | 'object' | 'object-flat')[] = [];
  
  for (let i = 0; i < zon.length; i++) {
    const char = zon[i];
    const prev = zon[i - 1];
    
    // Track if we're inside a string
    if (char === '"' && prev !== '\\') {
      inString = !inString;
    }
    
    if (inString) {
      result += char;
      continue;
    }

    // Check for table start
    if (char === '@' && !inString) {
      inTable = true;
      tableBraceBalance = 0;
      tableBracketBalance = 0;
    }

    // Check for potential inline block (only if not in table)
    if (!inTable && (char === '{' || char === '[') && indent < 20) {
      // Only allow inline objects if we are inside an array (tabular data)
      // Always allow inline arrays (lists)
      const isArray = char === '[';
      const parentContext = contextStack.length > 0 ? contextStack[contextStack.length - 1] : null;
      
      if (isArray || parentContext === 'array') {
        const closingChar = char === '{' ? '}' : ']';
        let j = i + 1;
        let depth = 1;
        let length = 0;
        let hasNested = false;
        
        while (j < zon.length && length < 60) {
          if (zon[j] === '{' || zon[j] === '[') {
            hasNested = true;
            depth++;
          } else if (zon[j] === '}' || zon[j] === ']') {
            depth--;
          }
          
          if (depth === 0) break;
          length++;
          j++;
        }
        
        // If block is short and flat, keep it inline
      if (depth === 0 && length < 60 && !hasNested) {
        // Ensure colon before inline array if following a key
        if (isArray && result.trim().length > 0 && !result.trimEnd().endsWith(':') && !result.trimEnd().endsWith(',') && !result.trimEnd().endsWith('\n')) {
           result += ':';
        }
        
        const block = zon.substring(i, j + 1);
        result += block;
        i = j; // Skip processed block
        continue;
      }
    }
    }
    
    switch (char) {
      case '{':
        // Check if empty object
        let nextCharObj = '';
        for(let k=i+1; k<zon.length; k++) {
           if (!/\s/.test(zon[k])) { nextCharObj = zon[k]; break; }
        }
        
        if (nextCharObj === '}') {
           // Empty object: print {} inline
           if (result.trim().length > 0 && !result.trimEnd().endsWith(':') && !result.trimEnd().endsWith(',') && !result.trimEnd().endsWith('\n') && !result.trimEnd().endsWith('[')) {
              result += ':';
           }
           result += '{}';
           // Skip to closing brace
           while(i < zon.length && zon[i] !== '}') i++;
           break;
        }

        if (inTable) {
          tableBraceBalance++;
          result += '{';
          break;
        }

        // Check if we are inside an array
        const parentContext = contextStack.length > 0 ? contextStack[contextStack.length - 1] : null;
                if (parentContext === 'array') {
           // Flattened object in array
           contextStack.push('object-flat');
           // Do not indent, do not print brace
           // We are already after a dash "- ", so we don't need a newline.
        } else {
           // Standard object
           contextStack.push('object');
           
           // Only increment indent if NOT root object
           if (result.trim().length > 0) {
              // If previous char was not colon, add one.
              if (!result.trimEnd().endsWith(':') && !result.trimEnd().endsWith(',') && !result.trimEnd().endsWith('[') && !result.trimEnd().endsWith('{')) {
                 result += ':';
              }
              
              // Add brace
              result += ' {';
              indent++;
              result += '\n' + indentStr.repeat(indent);
           } else {
              // Root object
              result += '{';
              indent++;
              result += '\n' + indentStr.repeat(indent);
           }
        }
        break;
      
      case '[':
        // Check if empty array
        let nextCharArr = '';
        for(let k=i+1; k<zon.length; k++) {
           if (!/\s/.test(zon[k])) { nextCharArr = zon[k]; break; }
        }
        
        if (nextCharArr === ']') {
           // Empty array: print [] inline
           if (result.trim().length > 0 && !result.trimEnd().endsWith(':') && !result.trimEnd().endsWith(',') && !result.trimEnd().endsWith('\n') && !result.trimEnd().endsWith('[')) {
              result += ':';
           }
           result += '[]';
           // Skip to closing bracket
           while(i < zon.length && zon[i] !== ']') i++;
           break;
        }

        if (inTable) {
          tableBracketBalance++;
          result += '[';
          break;
        }

        contextStack.push('array');
        // Ensure colon before array if following a key
        if (result.trim().length > 0 && !result.trimEnd().endsWith(':') && !result.trimEnd().endsWith(',') && !result.trimEnd().endsWith('\n') && !result.trimEnd().endsWith('[')) {
           result += ':';
        }
        indent++;
        // Start first item with dash
        result += '\n' + indentStr.repeat(indent) + '- ';
        break;
      
      case '}':
        if (inTable) {
          if (tableBraceBalance > 0) {
            tableBraceBalance--;
            result += '}';
            break;
          } else {
            inTable = false;
          }
        }
        const currentContext = contextStack.pop();
        // if (inTable) inTable = false; // Do not exit table mode on closing brace
        
        if (currentContext === 'object') {
           indent--;
           result += '\n' + indentStr.repeat(indent) + '}';
        }
        // If object-flat, do nothing (no dedent, no brace)
        break;

      case ']':
        if (inTable) {
          if (tableBracketBalance > 0) {
            tableBracketBalance--;
            result += ']';
            break;
          } else {
            inTable = false;
          }
        }
        // If we are closing the array, we might need to pop a pending object-flat first
        if (contextStack.length > 0 && contextStack[contextStack.length - 1] === 'object-flat') {
           contextStack.pop();
        }
        contextStack.pop();
        // if (inTable) inTable = false; // Do not exit table mode on closing bracket
        indent--;
        // No character, just dedent (effectively ends the block)
        break;

      case ',':
        if (inTable) {
          result += char;
        } else {
          // Check context to decide separator
          const topContext = contextStack.length > 0 ? contextStack[contextStack.length - 1] : null;
          
          if (topContext === 'array') {
             // Between array items: Use newline and dash
             result += '\n' + indentStr.repeat(indent) + '- ';
          } else {
             // Between object fields (object or object-flat): Use single newline (no comma)
             result += '\n' + indentStr.repeat(indent);
          }
        }
        break;
      
      case '\n':
        if (inTable) {
          result += '\n' + indentStr.repeat(indent);
        } else {
          result += char;
        }
        break;

      case ':':
        if (inTable) {
          result += char;
        } else {
          result += ':'; // No space after colon
        }
        break;
      
      default:
        // Preserve all characters including spaces
        result += char;
        break;
    }
  }
  
  return result;
}
