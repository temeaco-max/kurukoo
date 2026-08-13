import express, { Router } from 'express';
import { getAllBlogArticles, getBlogArticleBySlug, getAllContent, getContentBySlug } from '../services/contentManager.js';

function toResource(item: { slug: string; title: string; body: string; type: string; author: string; createdAt?: string; updatedAt?: string }) {
  const plainBody = item.body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    slug: item.slug,
    title: item.title,
    category: item.type === 'legal' ? 'Policy' : item.type === 'page' ? 'Guide' : 'Help',
    excerpt: plainBody.slice(0, 220),
    body: item.body,
    author: item.author,
    updated_at: item.updatedAt || item.createdAt || null,
  };
}

function isPublicResource(type: string) {
  return type === 'help' || type === 'legal' || type === 'page';
}

/** Public content API. Content storage remains owned by contentManager. */
export function createContentRouter(): Router {
    const router = express.Router();

    router.get('/api/blog', async (_req, res) => {
        res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
        try {
            res.json(await getAllBlogArticles());
        } catch (error) {
            console.error('Error fetching blog list:', error);
            res.status(500).json({ error: 'Failed to fetch blog list' });
        }
    });

    router.get('/api/blog/:slug', async (req, res) => {
        res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
        try {
            const article = await getBlogArticleBySlug(req.params.slug);
            if (!article) return res.status(404).json({ error: `Article with slug "${req.params.slug}" not found` });
            res.json(article);
        } catch (error) {
            console.error(`Error fetching article ${req.params.slug}:`, error);
            res.status(500).json({ error: 'Failed to fetch article' });
        }
    });

    // Resource pages are CMS records of the existing help, legal, and page types.
    // This keeps public resource discovery on the same content store as the admin CMS.
    router.get('/api/resources', async (_req, res) => {
        res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
        try {
            const resources = (await getAllContent()).filter((item) => isPublicResource(item.type)).map(toResource);
            res.json({ resources });
        } catch (error) {
            console.error('Error fetching resources:', error);
            res.status(500).json({ error: 'Failed to fetch resources' });
        }
    });

    router.get('/api/resources/:slug', async (req, res) => {
        res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
        try {
            const item = await getContentBySlug(req.params.slug);
            if (!item || !isPublicResource(item.type)) return res.status(404).json({ error: 'Resource not found' });
            res.json(toResource(item));
        } catch (error) {
            console.error(`Error fetching resource ${req.params.slug}:`, error);
            res.status(500).json({ error: 'Failed to fetch resource' });
        }
    });

    return router;
}

export default createContentRouter();
