/**
 * ZON Data Migration Manager
 * 
 * Manages schema migrations for evolving ZON data structures.
 * Supports versioned migration functions with automatic path finding.
 */

export type MigrationFunction = (data: any, fromVersion: string, toVersion: string) => any;

export interface Migration {
  from: string;
  to: string;
  migrate: MigrationFunction;
  description?: string;
}

/**
 * Manager for ZON schema migrations.
 * Allows registering migration functions and automatically finding migration paths.
 */
export class ZonMigrationManager {
  private migrations: Map<string, Migration> = new Map();
  
  /**
   * Registers a migration from one version to another.
   * 
   * @param from - Source version
   * @param to - Target version
   * @param migrate - Migration function
   * @param description - Optional description of the migration
   * 
   * @example
   * ```typescript
   * manager.registerMigration("1.0.0", "2.0.0", (data) => {

   *   if (data.users) {
   *     data.users = data.users.map(u => ({ ...u, email: `${u.name}@example.com` }));
   *   }
   *   return data;
   * }, "Added email field to users");
   * ```
   */
  registerMigration(
    from: string,
    to: string,
    migrate: MigrationFunction,
    description?: string
  ): void {
    const key = `${from}->${to}`;
    this.migrations.set(key, { from, to, migrate, description });
  }
  
  /**
   * Migrates data from one version to another.
   * Automatically finds the migration path if direct migration not available.
   * 
   * @param data - Data to migrate
   * @param fromVersion - Current version
   * @param toVersion - Target version
   * @returns Migrated data
   * 
   * @throws Error if no migration path exists
   */
  migrate(data: any, fromVersion: string, toVersion: string): any {
    if (fromVersion === toVersion) {
      return data;
    }
    

    const directKey = `${fromVersion}->${toVersion}`;
    if (this.migrations.has(directKey)) {
      const migration = this.migrations.get(directKey)!;
      console.log(`Migrating ${fromVersion} → ${toVersion}: ${migration.description || 'no description'}`);
      return migration.migrate(data, fromVersion, toVersion);
    }
    

    const path = this.findMigrationPath(fromVersion, toVersion);
    
    if (!path || path.length === 0) {
      throw new Error(`No migration path found from ${fromVersion} to ${toVersion}`);
    }
    

    let current = data;
    for (const migration of path) {
      console.log(`Migrating ${migration.from} → ${migration.to}: ${migration.description || 'no description'}`);
      current = migration.migrate(current, migration.from, migration.to);
    }
    
    return current;
  }
  
  /**
   * Finds a migration path between two versions using BFS.
   * 
   * @param from - Source version
   * @param to - Target version
   * @returns Array of migrations to apply, or null if no path exists
   */
  private findMigrationPath(from: string, to: string): Migration[] | null {
    const visited = new Set<string>();
    const queue: { version: string; path: Migration[] }[] = [{ version: from, path: [] }];
    
    while (queue.length > 0) {
      const { version, path } = queue.shift()!;
      
      if (version === to) {
        return path;
      }
      
      if (visited.has(version)) {
        continue;
      }
      
      visited.add(version);
      

      for (const [key, migration] of this.migrations) {
        if (migration.from === version) {
          queue.push({
            version: migration.to,
            path: [...path, migration]
          });
        }
      }
    }
    
    return null;
  }
  
  /**
   * Checks if migration is possible between two versions.
   * 
   * @param from - Source version
   * @param to - Target version
   * @returns True if migration path exists
   */
  canMigrate(from: string, to: string): boolean {
    if (from === to) return true;
    
    const directKey = `${from}->${to}`;
    if (this.migrations.has(directKey)) return true;
    
    return this.findMigrationPath(from, to) !== null;
  }
  
  /**
   * Gets all registered migrations.
   * 
   * @returns Array of all migrations
   */
  getMigrations(): Migration[] {
    return Array.from(this.migrations.values());
  }
  
  /**
   * Gets migrations available from a specific version.
   * 
   * @param version - Source version
   * @returns Array of migrations starting from this version
   */
  getMigrationsFrom(version: string): Migration[] {
    return Array.from(this.migrations.values()).filter(m => m.from === version);
  }
  
  /**
   * Clears all registered migrations.
   */
  clear(): void {
    this.migrations.clear();
  }
}

/**
 * Global migration manager instance.
 * Can be used to register and manage migrations across the application.
 */
export const globalMigrationManager = new ZonMigrationManager();

/**
 * Helper function to create a migration that adds a default value for a new field.
 * 
 * @param path - Path to the field (e.g., "users.email")
 * @param defaultValue - Default value for the field
 * @returns Migration function
 */
export function createAddFieldMigration(
  path: string,
  defaultValue: any
): MigrationFunction {
  return (data: any) => {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    
    let current = data;
    for (const key of keys) {
      if (!(key in current)) {
        return data;
      }
      current = current[key];
    }
    

    if (Array.isArray(current)) {
      return {
        ...data,
        [keys.join('.')]: current.map(item => ({
          ...item,
          [lastKey]: defaultValue
        }))
      };
    }
    

    if (typeof current === 'object' && current !== null) {
      current[lastKey] = defaultValue;
    }
    
    return data;
  };
}

/**
 * Helper function to create a migration that removes a field.
 * 
 * @param path - Path to the field to remove
 * @returns Migration function
 */
export function createRemoveFieldMigration(path: string): MigrationFunction {
  return (data: any) => {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    
    let current = data;
    for (const key of keys) {
      if (!(key in current)) {
        return data;
      }
      current = current[key];
    }
    
    if (Array.isArray(current)) {
      current.forEach(item => {
        if (typeof item === 'object' && item !== null) {
          delete item[lastKey];
        }
      });
    } else if (typeof current === 'object' && current !== null) {
      delete current[lastKey];
    }
    
    return data;
  };
}

/**
 * Helper function to create a migration that renames a field.
 * 
 * @param oldPath - Current field path
 * @param newPath - New field path
 * @returns Migration function
 */
export function createRenameFieldMigration(oldPath: string, newPath: string): MigrationFunction {
  return (data: any) => {
    const oldKeys = oldPath.split('.');
    const newKeys = newPath.split('.');
    const oldLastKey = oldKeys.pop()!;
    const newLastKey = newKeys.pop()!;
    
    let current = data;
    for (const key of oldKeys) {
      if (!(key in current)) {
        return data;
      }
      current = current[key];
    }
    
    if (Array.isArray(current)) {
      current.forEach(item => {
        if (typeof item === 'object' && item !== null && oldLastKey in item) {
          item[newLastKey] = item[oldLastKey];
          delete item[oldLastKey];
        }
      });
    } else if (typeof current === 'object' && current !== null && oldLastKey in current) {
      current[newLastKey] = current[oldLastKey];
      delete current[oldLastKey];
    }
    
    return data;
  };
}
