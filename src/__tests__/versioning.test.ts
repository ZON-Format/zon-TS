/**
 * Tests for ZON Document Versioning
 */

import { describe, it, expect } from '@jest/globals';
import {
  embedVersion,
  extractVersion,
  stripVersion,
  compareVersions,
  isCompatible,
  isValidVersion,
  parseVersion
} from '../core/versioning';
import { encode } from '../core/encoder';
import { decode } from '../core/decoder';

describe('ZON Versioning', () => {
  describe('embedVersion', () => {
    it('should embed version metadata in object', () => {
      const data = { users: [{ id: 1, name: 'Alice' }] };
      const versioned = embedVersion(data, '2.0.0', 'user-schema');

      expect(versioned.__zon_meta).toBeDefined();
      expect(versioned.__zon_meta.version).toBe('2.0.0');
      expect(versioned.__zon_meta.schemaId).toBe('user-schema');
      expect(versioned.__zon_meta.encoding).toBe('zonf');
      expect(versioned.__zon_meta.timestamp).toBeDefined();
      expect(versioned.users).toEqual(data.users);
    });

    it('should throw error for non-object data', () => {
      expect(() => embedVersion([], '1.0.0')).toThrow('Can only embed version in root objects');
      expect(() => embedVersion(null, '1.0.0')).toThrow('Can only embed version in root objects');
      expect(() => embedVersion('string', '1.0.0')).toThrow('Can only embed version in root objects');
    });

    it('should work without schema ID', () => {
      const data = { test: 'value' };
      const versioned = embedVersion(data, '1.0.0');

      expect(versioned.__zon_meta.version).toBe('1.0.0');
      expect(versioned.__zon_meta.schemaId).toBeUndefined();
    });
  });

  describe('extractVersion', () => {
    it('should extract version metadata', () => {
      const data = {
        __zon_meta: {
          version: '1.5.0',
          schemaId: 'test-schema',
          encoding: 'zonf',
          timestamp: 1234567890
        },
        users: []
      };

      const meta = extractVersion(data);
      expect(meta).not.toBeNull();
      expect(meta!.version).toBe('1.5.0');
      expect(meta!.schemaId).toBe('test-schema');
      expect(meta!.timestamp).toBe(1234567890);
    });

    it('should return null for data without metadata', () => {
      expect(extractVersion({ test: 'value' })).toBeNull();
      expect(extractVersion([])).toBeNull();
      expect(extractVersion(null)).toBeNull();
    });

    it('should return null for invalid metadata', () => {
      expect(extractVersion({ __zon_meta: {} })).toBeNull();
      expect(extractVersion({ __zon_meta: 'invalid' })).toBeNull();
      expect(extractVersion({ __zon_meta: { other: 'field' } })).toBeNull();
    });
  });

  describe('stripVersion', () => {
    it('should remove version metadata', () => {
      const data = {
        __zon_meta: { version: '1.0.0', encoding: 'zonf', timestamp: 123 },
        users: [{ id: 1 }]
      };

      const stripped = stripVersion(data);
      expect(stripped.__zon_meta).toBeUndefined();
      expect(stripped.users).toEqual([{ id: 1 }]);
    });

    it('should return data unchanged if no metadata', () => {
      const data = { test: 'value' };
      expect(stripVersion(data)).toEqual(data);
    });
  });

  describe('compareVersions', () => {
    it('should compare major versions', () => {
      expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
      expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    });

    it('should compare minor versions', () => {
      expect(compareVersions('1.2.0', '1.1.0')).toBe(1);
      expect(compareVersions('1.1.0', '1.2.0')).toBe(-1);
    });

    it('should compare patch versions', () => {
      expect(compareVersions('1.0.2', '1.0.1')).toBe(1);
      expect(compareVersions('1.0.1', '1.0.2')).toBe(-1);
    });

    it('should handle different version lengths', () => {
      expect(compareVersions('1.0', '1.0.0')).toBe(0);
      expect(compareVersions('1.1', '1.0.5')).toBe(1);
    });
  });

  describe('isCompatible', () => {
    it('should allow patch upgrades', () => {
      expect(isCompatible('1.0.1', '1.0.0')).toBe(true);
      expect(isCompatible('1.0.5', '1.0.0')).toBe(true);
    });

    it('should allow minor upgrades', () => {
      expect(isCompatible('1.2.0', '1.0.0')).toBe(true);
      expect(isCompatible('1.5.3', '1.2.1')).toBe(true);
    });

    it('should reject major  upgrades', () => {
      expect(isCompatible('2.0.0', '1.0.0')).toBe(false);
      expect(isCompatible('3.0.0', '2.5.0')).toBe(false);
    });

    it('should reject downgrades', () => {
      expect(isCompatible('1.0.0', '1.2.0')).toBe(false);
      expect(isCompatible('1.2.0', '1.3.0')).toBe(false);
    });

    it('should allow same version', () => {
      expect(isCompatible('1.0.0', '1.0.0')).toBe(true);
    });
  });

  describe('isValidVersion', () => {
    it('should validate correct versions', () => {
      expect(isValidVersion('1.0.0')).toBe(true);
      expect(isValidVersion('0.0.1')).toBe(true);
      expect(isValidVersion('10.20.30')).toBe(true);
      expect(isValidVersion('1.0.0-alpha')).toBe(true);
      expect(isValidVersion('1.0.0+build123')).toBe(true);
      expect(isValidVersion('1.0.0-beta.1+exp.sha.5114f85')).toBe(true);
    });

    it('should reject invalid versions', () => {
      expect(isValidVersion('1.0')).toBe(false);
      expect(isValidVersion('1')).toBe(false);
      expect(isValidVersion('v1.0.0')).toBe(false);
      expect(isValidVersion('1.0.0.0')).toBe(false);
      expect(isValidVersion('abc')).toBe(false);
    });
  });

  describe('parseVersion', () => {
    it('should parse version components', () => {
      const parsed = parseVersion('1.2.3');
      expect(parsed.major).toBe(1);
      expect(parsed.minor).toBe(2);
      expect(parsed.patch).toBe(3);
      expect(parsed.prerelease).toBeUndefined();
      expect(parsed.build).toBeUndefined();
    });

    it('should parse prerelease and build', () => {
      const parsed = parseVersion('1.0.0-alpha+build');
      expect(parsed.prerelease).toBe('alpha');
      expect(parsed.build).toBe('build');
    });

    it('should throw on invalid version', () => {
      expect(() => parseVersion('invalid')).toThrow('Invalid version format');
    });
  });

  describe('Round-trip with metadata', () => {
    it('should preserve data through encode/decode with metadata', () => {
      const original = { users: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] };
      
      // Encode with metadata
      const encoded = encode(original, { 
        embedMetadata: true, 
        version: '2.0.0',
        schemaId: 'user-schema'
      });

      // Decode and extract metadata
      const result = decode(encoded, { extractMetadata: true });

      expect(result.data).toEqual(original);
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.version).toBe('2.0.0');
      expect(result.metadata!.schemaId).toBe('user-schema');
    });

    it('should work without metadata extraction option', () => {
      const original = { test: 'value' };
      
      const encoded = encode(original, { embedMetadata: true, version: '1.0.0' });
      const decoded = decode(encoded);  // No extractMetadata option

      // Should include __zon_meta in the data
      expect(decoded.__zon_meta).toBeDefined();
      expect(decoded.__zon_meta.version).toBe('1.0.0');
      expect(decoded.test).toBe('value');
    });

    it('should handle array root with metadata', () => {
      const original = [{ id: 1 }, { id: 2 }];
      
      // Can't embed metadata in arrays directly, so this should work normally
      const encoded = encode(original);
      const decoded = decode(encoded);

      expect(decoded).toEqual(original);
    });
  });

  describe('Integration with complex data', () => {
    it('should handle nested objects with metadata', () => {
      const data = {
        config: {
          database: { host: 'localhost', port: 5432 },
          cache: { enabled: true }
        },
        users: [{ id: 1, name: 'Test' }]
      };

      const versioned = embedVersion(data, '1.0.0');
      const encoded = encode(versioned);
      const result = decode(encoded, { extractMetadata: true });

      expect(result.data).toEqual(data);
      expect(result.metadata!.version).toBe('1.0.0');
    });
  });
});
