import fs from 'node:fs';
import path from 'node:path';
import dataFromFile from '../data/site-content.json';

const CONTENT_FILE = path.join(process.cwd(), 'src', 'data', 'site-content.json');
const GITHUB_API_BASE = 'https://api.github.com';
const runtimeEnv = process.env;
const DEFAULT_CONTENT_REPO_OWNER = 'Prathu241';
const DEFAULT_CONTENT_REPO_NAME = 'CV';

function getContentRepoOwner(): string {
    const configured = runtimeEnv.CONTENT_REPO_OWNER || '';
    return configured && configured !== 'your-github-username-or-org'
        ? configured
        : DEFAULT_CONTENT_REPO_OWNER;
}

function getContentRepoName(): string {
    const configured = runtimeEnv.CONTENT_REPO_NAME || '';
    return configured && configured !== 'your-repo-name'
        ? configured
        : DEFAULT_CONTENT_REPO_NAME;
}

function getContentRepoBranch(): string {
    const configured = runtimeEnv.CONTENT_REPO_BRANCH || '';
    return configured && configured !== 'main-branch' ? configured : 'main';
}

function getContentRepoPath(): string {
    const configured = runtimeEnv.CONTENT_REPO_PATH || '';
    return configured && configured !== 'path/to/site-content.json'
        ? configured
        : 'src/data/site-content.json';
}

function getGithubToken(): string {
    return runtimeEnv.GITHUB_TOKEN || '';
}

function hasGithubContentConfig(): boolean {
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
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
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
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
            }
        }
    );

    let sha: string | undefined;
    if (fileResponse.ok) {
        const fileJson = await fileResponse.json() as { sha?: string };
        sha = fileJson.sha;
    }

    const response = await fetch(
        `${GITHUB_API_BASE}/repos/${CONTENT_REPO_OWNER}/${CONTENT_REPO_NAME}/contents/${CONTENT_REPO_PATH}`,
        {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
                Accept: 'application/vnd.github+json',
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
        throw new Error(text || `GitHub content write failed with status ${response.status}`);
    }

    return true;
}

async function readLocalContent() {
    try {
        if (fs.existsSync(CONTENT_FILE)) {
            const fileContent = fs.readFileSync(CONTENT_FILE, 'utf-8');
            return JSON.parse(fileContent);
        }
    } catch (error) {
        console.error('Local file read failed, falling back to bundled data', error);
    }

    return dataFromFile;
}

export const CAN_WRITE_RUNTIME_CONTENT = !import.meta.env.PROD || hasGithubContentConfig();

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

export async function updateContent(newData: any) {
    if (hasGithubContentConfig()) {
        try {
            return await writeGithubContent(newData);
        } catch (error) {
            console.error('GitHub content update error:', error);
            throw error;
        }
    }

    try {
        const dir = path.dirname(CONTENT_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(CONTENT_FILE, toJsonString(newData), 'utf-8');
        return true;
    } catch (error) {
        console.error('Error writing content file:', error);
        return false;
    }
}
