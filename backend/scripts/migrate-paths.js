const fs = require('fs');
const path = require('path');

const STORAGE_FILE = path.join(__dirname, "../data/visual_entities.json");

function migratePaths() {
  try {
    console.log('Starting path migration...');
    
    // Read the current data
    const data = fs.readFileSync(STORAGE_FILE, 'utf8');
    const visualData = JSON.parse(data);
    
    let updated = false;
    
    // Update each entity's path
    visualData.entities.forEach(entity => {
      if (entity.path && path.isAbsolute(entity.path)) {
        const relativePath = path.relative(process.cwd(), entity.path);
        console.log(`Converting: ${entity.path} -> ${relativePath}`);
        entity.path = relativePath;
        updated = true;
      }
    });
    
    if (updated) {
      // Save the updated data
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(visualData, null, 2));
      console.log('Migration completed successfully!');
    } else {
      console.log('No paths needed migration.');
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

migratePaths();
