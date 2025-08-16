#!/usr/bin/env node

const StorageManager = require('../utils/storageManager');
const fs = require('fs');
const path = require('path');

const storage = new StorageManager();

function printUsage() {
  console.log(`
Visual Memory Storage Manager

Usage: node manageStorage.js <command> [options]

Commands:
  stats                    - Show storage statistics
  list                     - List all entities
  search <query>           - Search entities
  get <id>                 - Get specific entity
  delete <id>              - Delete entity
  clear                    - Clear all entities
  backup [path]            - Create backup
  restore <path>           - Restore from backup
  help                     - Show this help

Examples:
  node manageStorage.js stats
  node manageStorage.js search "login button"
  node manageStorage.js list
  node manageStorage.js backup ./backup.json
  node manageStorage.js restore ./backup.json
`);
}

function printStats() {
  const stats = storage.getStats();
  console.log('\n📊 Storage Statistics:');
  console.log('=====================');
  console.log(`Storage File: ${stats.storageFile}`);
  console.log(`File Size: ${(stats.fileSize / 1024).toFixed(2)} KB`);
  console.log(`Total Entities: ${stats.totalEntities}`);
  console.log(`Processed: ${stats.processedEntities}`);
  console.log(`Unprocessed: ${stats.unprocessedEntities}`);
  console.log(`Last Updated: ${stats.lastUpdated}`);
  console.log(`Folders: ${stats.folders.length > 0 ? stats.folders.join(', ') : 'None'}`);
  console.log(`Entity Types: ${stats.entityTypes.length > 0 ? stats.entityTypes.join(', ') : 'None'}`);
  console.log(`Total Tags: ${stats.totalTags}`);
}

function printEntity(entity, showDetails = false) {
  console.log(`\n🖼️  Entity: ${entity.id}`);
  console.log(`   Filename: ${entity.filename}`);
  console.log(`   Original: ${entity.originalName}`);
  console.log(`   Folder: ${entity.folder || 'None'}`);
  console.log(`   Uploaded: ${entity.uploadedAt}`);
  console.log(`   Processed: ${entity.processed ? '✅' : '❌'}`);
  console.log(`   Size: ${(entity.size / 1024).toFixed(2)} KB`);
  
  if (entity.tags && entity.tags.length > 0) {
    console.log(`   Tags: ${entity.tags.join(', ')}`);
  }
  
  if (showDetails && entity.analysis) {
    console.log(`   Text Content: ${entity.analysis.textContent?.substring(0, 100)}...`);
    console.log(`   Visual Description: ${entity.analysis.visualDescription?.substring(0, 100)}...`);
    if (entity.metadata) {
      console.log(`   Entities: ${entity.metadata.totalEntities}`);
      console.log(`   Colors: ${entity.metadata.dominantColors?.join(', ')}`);
    }
  }
}

function printSearchResults(results) {
  if (results.length === 0) {
    console.log('\n❌ No results found');
    return;
  }
  
  console.log(`\n🔍 Search Results (${results.length} found):`);
  console.log('=====================================');
  
  results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.originalName} (Confidence: ${(result.confidence * 100).toFixed(1)}%)`);
    console.log(`   Matches: ${result.matches.join(', ')}`);
    console.log(`   Tags: ${result.tags?.slice(0, 5).join(', ')}${result.tags?.length > 5 ? '...' : ''}`);
    if (result.analysis?.textContent) {
      console.log(`   Text: ${result.analysis.textContent.substring(0, 80)}...`);
    }
  });
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const options = args.slice(1);

  if (!command || command === 'help') {
    printUsage();
    return;
  }

  try {
    switch (command) {
      case 'stats':
        printStats();
        break;

      case 'list':
        const entities = storage.getAllEntities();
        if (entities.length === 0) {
          console.log('\n📭 No entities found');
        } else {
          console.log(`\n📋 All Entities (${entities.length}):`);
          console.log('========================');
          entities.forEach((entity, index) => {
            printEntity(entity, false);
          });
        }
        break;

      case 'search':
        if (!options[0]) {
          console.log('❌ Please provide a search query');
          return;
        }
        const query = options.join(' ');
        const results = storage.searchEntities(query);
        printSearchResults(results);
        break;

      case 'get':
        if (!options[0]) {
          console.log('❌ Please provide an entity ID');
          return;
        }
        const entity = storage.getEntity(options[0]);
        if (entity) {
          printEntity(entity, true);
        } else {
          console.log('❌ Entity not found');
        }
        break;

      case 'delete':
        if (!options[0]) {
          console.log('❌ Please provide an entity ID');
          return;
        }
        if (storage.deleteEntity(options[0])) {
          console.log('✅ Entity deleted successfully');
        } else {
          console.log('❌ Entity not found');
        }
        break;

      case 'clear':
        if (storage.clearStorage()) {
          console.log('✅ Storage cleared successfully');
        } else {
          console.log('❌ Failed to clear storage');
        }
        break;

      case 'backup':
        const backupPath = options[0];
        const backupFile = storage.backupStorage(backupPath);
        if (backupFile) {
          console.log(`✅ Backup created: ${backupFile}`);
        } else {
          console.log('❌ Failed to create backup');
        }
        break;

      case 'restore':
        if (!options[0]) {
          console.log('❌ Please provide a backup file path');
          return;
        }
        if (storage.restoreFromBackup(options[0])) {
          console.log('✅ Storage restored successfully');
        } else {
          console.log('❌ Failed to restore storage');
        }
        break;

      default:
        console.log(`❌ Unknown command: ${command}`);
        printUsage();
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

if (require.main === module) {
  main();
}
