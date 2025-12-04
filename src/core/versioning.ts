/**
 * ZON Document Versioning Utilities
 * 
 * Provides version embedding, extraction, comparison, and validation
 * for ZON documents to support schema evolution and backward compatibility.
 */

export interface ZonDocumentMetadata {
  /** Semantic version of the document format (e.g., "1.3.0") */
  version: string;
  
  /** Optional schema identifier (e.g., "user-profile-v2") */
  schemaId?: string;
  
  /** Encoding format used ("zon" | "zon-binary") */
  encoding?: string;
  
  /** Unix timestamp when document was created */
  timestamp?: number;
  
  /** Custom metadata fields */
  custom?: Record<string, any>;
}

/**
 * Embeds version metadata into a data object.
 * Adds a special __zon_meta field to the root object.
 * 
 * @param data - Data object to add metadata to
 * @param version - Semantic version string (e.g., "1.0.0")
 * @param schemaId - Optional schema identifier
 * @returns Data object with embedded metadata
 * 
 * @example
 * ```typescript
 * const data = { users: [{ id: 1, name: "Alice" }] };
 * const versioned = embedVersion(data, "2.0.0", "user-schema");
 * // Result: { __zon_meta: { version: "2.0.0", schemaId: "user-schema", ... }, users: [...] }
 * ```
 */
export function embedVersion(
  data: any,
  version: string,
  schemaId?: string,
  encoding: string = 'zon'
): any {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Can only embed version in root objects');
  }
  
  const metadata: ZonDocumentMetadata = {
    version,
    encoding,
    timestamp: Date.now()
  };
  
  if (schemaId) {
    metadata.schemaId = schemaId;
  }
  
  return {
    __zon_meta: metadata,
    ...data
  };
}

/**
 * Extracts version metadata from a decoded ZON document.
 * 
 * @param data - Decoded data object
 * @returns Metadata if present, null otherwise
 * 
 * @example
 * ```typescript
 * const decoded = decode(zonString);
 * const meta = extractVersion(decoded);
 * if (meta) {
 *   console.log(`Version: ${meta.version}`);
 * }
 * ```
 */
export function extractVersion(data: any): ZonDocumentMetadata | null {
  if (typeof data !== 'object' || data === null || !('__zon_meta' in data)) {
    return null;
  }
  
  const meta = data.__zon_meta;
  
  if (!meta || typeof meta !== 'object' || !meta.version) {
    return null;
  }
  
  return meta as ZonDocumentMetadata;
}

/**
 * Removes version metadata from a data object.
 * 
 * @param data - Data object with metadata
 * @returns Data object without __zon_meta field
 */
export function stripVersion(data: any): any {
  if (typeof data !== 'object' || data === null || !('__zon_meta' in data)) {
    return data;
  }
  
  const { __zon_meta, ...rest } = data;
  return rest;
}

/**
 * Compares two semantic version strings.
 * 
 * @param v1 - First version (e.g., "1.2.3")
 * @param v2 - Second version (e.g., "2.0.0")
 * @returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 * 
 * @example
 * ```typescript
 * compareVersions("1.0.0", "2.0.0")  // -1
 * compareVersions("2.0.0", "1.0.0")  // 1
 * compareVersions("1.0.0", "1.0.0")  // 0
 * ```
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    
    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }
  
  return 0;
}

/**
 * Checks if a version is compatible with a required version.
 * Considers backward compatibility: patch and minor version bumps are compatible.
 * 
 * @param current - Current version
 * @param required - Required version
 * @returns True if current version is compatible with required
 * 
 * @example
 * ```typescript
 * isCompatible("1.2.3", "1.0.0")  // true (same major)
 * isCompatible("2.0.0", "1.0.0")  // false (different major)
 * isCompatible("1.0.0", "1.2.0")  // false (current is older)
 * ```
 */
export function isCompatible(current: string, required: string): boolean {
  const cmp = compareVersions(current, required);
  
  // Current must be >= required
  if (cmp < 0) return false;
  
  // Extract major versions
  const currentMajor = parseInt(current.split('.')[0]);
  const requiredMajor = parseInt(required.split('.')[0]);
  
  // Major version must match
  return currentMajor === requiredMajor;
}

/**
 * Validates a semantic version string.
 * 
 * @param version - Version string to validate
 * @returns True if valid semantic version format
 */
export function isValidVersion(version: string): boolean {
  const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/;
  return semverRegex.test(version);
}

/**
 * Parses a version string into components.
 * 
 * @param version - Version string (e.g., "1.2.3-alpha+build")
 * @returns Object with major, minor, patch, prerelease, build
 */
export function parseVersion(version: string): {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
} {
  if (!isValidVersion(version)) {
    throw new Error(`Invalid version format: ${version}`);
  }
  
  const [base, prerelease, build] = version.split(/[-+]/);
  const [major, minor, patch] = base.split('.').map(Number);
  
  return {
    major,
    minor,
    patch,
    ...(prerelease && { prerelease }),
    ...(build && { build })
  };
}
