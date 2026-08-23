import { getCanonicalStore } from './canonicalStore.js';
import { queryGroq } from './groqService.js';
export async function createSuccessStory(jobId:number){const story=await queryGroq('Generate a short, anonymised success story for a completed job.');const db=await getCanonicalStore();await db.run('INSERT INTO success_stories(story_text,category) VALUES(?,?)',[story,'general']);}
