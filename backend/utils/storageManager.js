const fs = require('fs');
const path = require('path');

const STORAGE_FILE = path.join(__dirname, "../data/visual_entities.json");

class StorageManager {
  constructor() {
    this.ensureStorageFile();
  }

  ensureStorageFile() {
    const dataDir = path.dirname(STORAGE_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    if (!fs.existsSync(STORAGE_FILE)) {
      this.saveData({ entities: [], lastUpdated: new Date().toISOString() });
    }
  }

  loadData() {
    try {
      const data = fs.readFileSync(STORAGE_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading data:', error);
      return { entities: [], lastUpdated: new Date().toISOString() };
    }
  }

  saveData(data) {
    try {
      data.lastUpdated = new Date().toISOString();
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving data:', error);
      return false;
    }
  }

  addEntity(entity) {
    const data = this.loadData();
    data.entities.push(entity);
    return this.saveData(data);
  }

  updateEntity(id, updates) {
    const data = this.loadData();
    const index = data.entities.findIndex(entity => entity.id === id);
    if (index !== -1) {
      data.entities[index] = { ...data.entities[index], ...updates };
      return this.saveData(data);
    }
    return false;
  }

  deleteEntity(id) {
    const data = this.loadData();
    data.entities = data.entities.filter(entity => entity.id !== id);
    return this.saveData(data);
  }

  getEntity(id) {
    const data = this.loadData();
    return data.entities.find(entity => entity.id === id);
  }

  getAllEntities() {
    const data = this.loadData();
    return data.entities;
  }

  searchEntities(query) {
    const data = this.loadData();
    const queryLower = query.toLowerCase();
    const results = [];

    data.entities.forEach(entity => {
      if (!entity.processed || !entity.analysis) return;

      let confidence = 0;
      const matches = [];

      // Search in text content
      if (entity.analysis.textContent && entity.analysis.textContent.toLowerCase().includes(queryLower)) {
        confidence += 0.4;
        matches.push('text');
      }

      // Search in visual description
      if (entity.analysis.visualDescription && entity.analysis.visualDescription.toLowerCase().includes(queryLower)) {
        confidence += 0.3;
        matches.push('visual');
      }

      // Search in tags
      if (entity.tags) {
        entity.tags.forEach(tag => {
          if (tag.toLowerCase().includes(queryLower)) {
            confidence += 0.2;
            matches.push('tag');
          }
        });
      }

      if (confidence > 0) {
        results.push({
          ...entity,
          confidence: Math.min(confidence, 1.0),
          matches
        });
      }
    });

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  getStats() {
    const data = this.loadData();
    const stats = fs.statSync(STORAGE_FILE);
    
    return {
      storageFile: STORAGE_FILE,
      fileSize: stats.size,
      totalEntities: data.entities.length,
      lastUpdated: data.lastUpdated,
      processedEntities: data.entities.filter(e => e.processed).length,
      unprocessedEntities: data.entities.filter(e => !e.processed).length,
      folders: [...new Set(data.entities.map(e => e.folder).filter(Boolean))],
      entityTypes: [...new Set(data.entities.flatMap(e => e.metadata?.entityTypes || []))],
      totalTags: [...new Set(data.entities.flatMap(e => e.tags || []))].length
    };
  }

  clearStorage() {
    return this.saveData({ entities: [], lastUpdated: new Date().toISOString() });
  }

  backupStorage(backupPath) {
    try {
      const data = this.loadData();
      const backupFile = backupPath || `${STORAGE_FILE}.backup.${Date.now()}.json`;
      fs.writeFileSync(backupFile, JSON.stringify(data, null, 2));
      return backupFile;
    } catch (error) {
      console.error('Error creating backup:', error);
      return null;
    }
  }

  restoreFromBackup(backupPath) {
    try {
      const backupData = fs.readFileSync(backupPath, 'utf8');
      const data = JSON.parse(backupData);
      return this.saveData(data);
    } catch (error) {
      console.error('Error restoring from backup:', error);
      return false;
    }
  }
}

module.exports = StorageManager;
