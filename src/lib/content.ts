import fs from 'node:fs';
import path from 'node:path';

const CONTENT_FILE = path.join(process.cwd(), 'src', 'data', 'site-content.json');

// Default initial data if file doesn't exist (fallback)
import { skills as defaultSkills, experience as defaultExp, projects as defaultProj, education as defaultEdu, socialLinks as defaultSocial } from '../data/info';

const defaultData = {
    profile: {
        name: "Pratham Sarawad",
        role: "Full_Stack_Dev & Open_Source_Leader",
        bio: "A Full-Stack Developer & Open Source Leader crafting intuitive scalable solutions.",
        about: "I am a passionate Computer Science and tech enthusiast...",
        email: "prathamspr@gmail.com",
        image: "/profile-new.jpg"
    },
    skills: defaultSkills,
    experience: defaultExp,
    projects: defaultProj,
    education: defaultEdu,
    socialLinks: defaultSocial
};

export function getContent() {
    try {
        if (fs.existsSync(CONTENT_FILE)) {
            const fileContent = fs.readFileSync(CONTENT_FILE, 'utf-8');
            return JSON.parse(fileContent);
        }
    } catch (e) {
        console.error("Error reading content file:", e);
    }
    return defaultData;
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
