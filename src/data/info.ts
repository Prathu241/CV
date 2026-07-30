import { getContent } from '../lib/content';

const data = await getContent();

export const profile = data.profile;
export const skills = data.skills;
export const experience = data.experience;
export const projects = data.projects;
export const education = data.education;
export const socialLinks = data.socialLinks;
