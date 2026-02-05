import fs from 'node:fs';
import path from 'node:path';
import dataFromFile from '../data/site-content.json';

const CONTENT_FILE = path.join(process.cwd(), 'src', 'data', 'site-content.json');

export function getContent() {
    // IN PRODUCTION (Vercel): Always use the bundled data to avoid file system crashes
    if (import.meta.env.PROD) {
        return dataFromFile;
    }

    // IN DEVELOPMENT: Try reading from disk so edits appear instantly
    try {
        if (fs.existsSync(CONTENT_FILE)) {
            const fileContent = fs.readFileSync(CONTENT_FILE, 'utf-8');
            return JSON.parse(fileContent);
        }
    } catch (e) {
        console.error("Local file read failed, falling back to import", e);
    }
    
    return dataFromFile;
}

export function updateContent(newData: any) {
    try {
        // Ensure directory exists
        const dir = path.dirname(CONTENT_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(CONTENT_FILE, JSON.stringify(newData, null, 2), 'utf-8');
        return true;
    } catch (e) {
        console.error("Error writing content file:", e);
        return false;
    }
}
