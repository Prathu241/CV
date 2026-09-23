import { promises as fsp } from 'node:fs';
import path from 'node:path';
import dataFromFile from '../data/site-content.json';

export interface SiteProfile {
    name: string;
    role: string;
    bio: string;
    about: string;
    email: string;
    image: string;
    focus: string;
    status: string;
    location: string;
    role_detail: string;
}

export interface SiteSkill {
    name: string;
    icon: string;
}

export interface SiteExperience {
    role: string;
    company: string;
    date: string;
    desc: string;
    details: string[];
}

export interface SiteProject {
    title: string;
    desc: string;
    tech: string[];
    github: string;
    link: string;
}

export interface SiteEducation {
    name: string;
    degree: string;
    year: string;
}

export interface SiteSocialLink {
    name: string;
    url: string;
    icon: string;
}

export interface SiteContent {
    profile: SiteProfile;
    skills: SiteSkill[];
    experience: SiteExperience[];
    projects: SiteProject[];
    education: SiteEducation[];
    socialLinks: SiteSocialLink[];
}

export function validateSiteContent(data: unknown): { valid: boolean; error?: string; data?: SiteContent } {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return { valid: false, error: 'Root content must be an object' };
    }

    const d = data as Record<string, any>;

    if (!d.profile || typeof d.profile !== 'object' || Array.isArray(d.profile)) {
        return { valid: false, error: 'Profile must be an object' };
    }
    if (typeof d.profile.name !== 'string' || !d.profile.name.trim()) {
        return { valid: false, error: 'Profile name is required' };
    }

    if (!Array.isArray(d.skills)) {
        return { valid: false, error: 'Skills must be an array' };
    }

    if (!Array.isArray(d.experience)) {
        return { valid: false, error: 'Experience must be an array' };
    }

    if (!Array.isArray(d.projects)) {
        return { valid: false, error: 'Projects must be an array' };
    }

    if (!Array.isArray(d.education)) {
        return { valid: false, error: 'Education must be an array' };
    }

    if (!Array.isArray(d.socialLinks)) {
        return { valid: false, error: 'Social links must be an array' };
    }

    return { valid: true, data: d as SiteContent };
}

import { getEnv } from './auth';

const CONTENT_FILE = path.join(process.cwd(), 'src', 'data', 'site-content.json');
const GITHUB_API_BASE = 'https://api.github.com';
export const DEFAULT_CONTENT_REPO_OWNER = 'Prathu241';
export const DEFAULT_CONTENT_REPO_NAME = 'CV';

export function getContentRepoOwner(): string {
    const configured = getEnv('CONTENT_REPO_OWNER');
    return configured && configured !== 'your-github-username-or-org'
        ? configured
        : DEFAULT_CONTENT_REPO_OWNER;
}

export function getContentRepoName(): string {
    const configured = getEnv('CONTENT_REPO_NAME');
    return configured && configured !== 'your-repo-name'
        ? configured
        : DEFAULT_CONTENT_REPO_NAME;
}

export function getContentRepoBranch(): string {
    const configured = getEnv('CONTENT_REPO_BRANCH');
    return configured && configured !== 'main-branch' ? configured : 'main';
}

export function getContentRepoPath(): string {
    const configured = getEnv('CONTENT_REPO_PATH');
    return configured && configured !== 'path/to/site-content.json'
        ? configured
        : 'src/data/site-content.json';
}

const GITHUB_USER_AGENT = 'Pratham-Portfolio-CMS/1.0 (+https://prathudev.in)';

export function getGithubToken(): string {
    let token = getEnv('GITHUB_TOKEN');
    if (!token || token === 'your-github-personal-access-token' || token === 'ghp_yourtokenhere') {
        return '';
    }
    // Clean quotes that users might paste into Vercel dashboard:
    if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
        token = token.slice(1, -1).trim();
    }
    // Clean accidental 'Bearer ' or 'token ' prefix:
    if (token.toLowerCase().startsWith('bearer ')) {
        token = token.slice(7).trim();
    } else if (token.toLowerCase().startsWith('token ')) {
        token = token.slice(6).trim();
    }
    return token;
}

export function hasGithubContentConfig(): boolean {
    return Boolean(getContentRepoOwner() && getContentRepoName() && getGithubToken());
}

function toJsonString(value: unknown): string {
    return JSON.stringify(value, null, 2);
}

async function readGithubContent() {
    const CONTENT_REPO_OWNER = getContentRepoOwner();
    const CONTENT_REPO_NAME = getContentRepoName();
    const CONTENT_REPO_BRANCH = getContentRepoBranch();
    const CONTENT_REPO_PATH = getContentRepoPath();
    const GITHUB_TOKEN = getGithubToken();

    const response = await fetch(
        `${GITHUB_API_BASE}/repos/${CONTENT_REPO_OWNER}/${CONTENT_REPO_NAME}/contents/${CONTENT_REPO_PATH}?ref=${encodeURIComponent(CONTENT_REPO_BRANCH)}`,
        {
            cache: 'no-store',
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
                Accept: 'application/vnd.github+json',
                'User-Agent': GITHUB_USER_AGENT,
                'X-GitHub-Api-Version': '2022-11-28',
                'Cache-Control': 'no-cache'
            }
        }
    );

    if (!response.ok) {
        throw new Error(`GitHub content read failed: ${response.status}`);
    }

    const payload = await response.json() as { content?: string; encoding?: string };

    if (!payload.content) {
        return null;
    }

    if (payload.encoding === 'base64') {
        const content = Buffer.from(payload.content.replace(/\n/g, ''), 'base64').toString('utf-8');
        return JSON.parse(content);
    }

    return JSON.parse(payload.content);
}

async function writeGithubContent(newData: unknown): Promise<boolean> {
    const CONTENT_REPO_OWNER = getContentRepoOwner();
    const CONTENT_REPO_NAME = getContentRepoName();
    const CONTENT_REPO_BRANCH = getContentRepoBranch();
    const CONTENT_REPO_PATH = getContentRepoPath();
    const GITHUB_TOKEN = getGithubToken();

    const fileResponse = await fetch(
        `${GITHUB_API_BASE}/repos/${CONTENT_REPO_OWNER}/${CONTENT_REPO_NAME}/contents/${CONTENT_REPO_PATH}?ref=${encodeURIComponent(CONTENT_REPO_BRANCH)}`,
        {
            cache: 'no-store',
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
                Accept: 'application/vnd.github+json',
                'User-Agent': GITHUB_USER_AGENT,
                'X-GitHub-Api-Version': '2022-11-28',
                'Cache-Control': 'no-cache'
            }
        }
    );

    let sha: string | undefined;
    if (fileResponse.ok) {
        const fileJson = await fileResponse.json() as { sha?: string };
        sha = fileJson.sha;
    } else if (fileResponse.status === 401) {
        throw new Error('GitHub authentication failed (401 Bad credentials). The GITHUB_TOKEN configured in Vercel is invalid or expired. Please check your GitHub Personal Access Token in Vercel Project Settings.');
    } else if (fileResponse.status === 403) {
        const errText = await fileResponse.text();
        throw new Error(`GitHub access forbidden (403): ${errText}. Ensure your token has "Contents: Read and write" permission for ${CONTENT_REPO_OWNER}/${CONTENT_REPO_NAME}.`);
    } else if (fileResponse.status !== 404) {
        const errorText = await fileResponse.text();
        console.error('GitHub content file metadata fetch failed:', fileResponse.status, errorText);
        throw new Error(`GitHub metadata fetch failed (${fileResponse.status}): ${errorText}`);
    }

    const response = await fetch(
        `${GITHUB_API_BASE}/repos/${CONTENT_REPO_OWNER}/${CONTENT_REPO_NAME}/contents/${CONTENT_REPO_PATH}`,
        {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
                Accept: 'application/vnd.github+json',
                'User-Agent': GITHUB_USER_AGENT,
                'Content-Type': 'application/json',
                'X-GitHub-Api-Version': '2022-11-28'
            },
            body: JSON.stringify({
                message: 'Update portfolio content from admin portal',
                content: Buffer.from(toJsonString(newData), 'utf-8').toString('base64'),
                sha,
                branch: CONTENT_REPO_BRANCH
            })
        }
    );

    if (!response.ok) {
        const text = await response.text();
        console.error('GitHub content write failed:', response.status, text);
        if (response.status === 401) {
            throw new Error('GitHub authentication failed (401 Bad credentials). The GITHUB_TOKEN in your Vercel project environment variables is invalid, expired, or revoked. Please create a new Personal Access Token with repo/contents permissions and update it in Vercel Settings -> Environment Variables.');
        }
        if (response.status === 403) {
            throw new Error(`GitHub permission denied (403). Ensure your GITHUB_TOKEN has "Contents: Read and write" repository permissions for ${CONTENT_REPO_OWNER}/${CONTENT_REPO_NAME}.`);
        }
        if (response.status === 404) {
            throw new Error(`GitHub repository or branch not found (404). Check owner "${CONTENT_REPO_OWNER}", repo "${CONTENT_REPO_NAME}", and branch "${CONTENT_REPO_BRANCH}".`);
        }
        if (response.status === 409) {
            throw new Error('GitHub conflict (409): The content file was updated concurrently. Please refresh the page and try your changes again.');
        }
        throw new Error(text || `GitHub content write failed with status ${response.status}`);
    }

    return true;
}

async function readLocalContent() {
    try {
        const fileContent = await fsp.readFile(CONTENT_FILE, 'utf-8');
        return JSON.parse(fileContent);
    } catch (error: any) {
        if (error?.code !== 'ENOENT') {
            console.error('Local file read failed, falling back to bundled data:', error);
        }
    }

    return dataFromFile;
}

export function canWriteRuntimeContent(): boolean {
    return !import.meta.env.PROD || hasGithubContentConfig();
}

export const CAN_WRITE_RUNTIME_CONTENT = canWriteRuntimeContent();

export async function getContent() {
    if (hasGithubContentConfig()) {
        try {
            const githubContent = await readGithubContent();
            if (githubContent) {
                return githubContent;
            }
        } catch (error) {
            console.error('GitHub content read failed, falling back to bundled data', error);
        }

        return dataFromFile;
    }

    return readLocalContent();
}

export async function updateContent(newData: unknown) {
    const validation = validateSiteContent(newData);
    if (!validation.valid || !validation.data) {
        throw new Error(`Validation failed: ${validation.error}`);
    }

    const validatedData = validation.data;

    if (hasGithubContentConfig()) {
        try {
            return await writeGithubContent(validatedData);
        } catch (error) {
            console.error('GitHub content update error:', error);
            throw error;
        }
    }

    try {
        const dir = path.dirname(CONTENT_FILE);
        await fsp.mkdir(dir, { recursive: true });
        await fsp.writeFile(CONTENT_FILE, toJsonString(validatedData), 'utf-8');
        return true;
    } catch (error) {
        console.error('Error writing content file:', error);
        return false;
    }
}
