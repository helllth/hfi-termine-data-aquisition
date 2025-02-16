import fs from 'fs-extra';
import path from 'path';
import { writeFileWithMD5 } from './tools.js';

const sourceDir = 'in/html';
const targetDir = 'out/html';

// Ensure target directory exists
fs.ensureDirSync(targetDir);

// Get all files from source directory
const files = fs.readdirSync(sourceDir);

console.log('Copying files from in/html to out/html...');

files.forEach(file => {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);
    
    // Check if it's a file (not a directory)
    if (fs.statSync(sourcePath).isFile()) {
        // Read file as binary for both HTML and PDF
        const content = fs.readFileSync(sourcePath);
        
        // Write file with MD5
        writeFileWithMD5(targetPath, content);
        console.log(`Copied ${file} with MD5 hash`);
    }
});

console.log('Done copying files.');
