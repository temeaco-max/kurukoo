import express, { Router } from 'express';
import { getAllBlogArticles, getBlogArticleBySlug, getAllResourceMetadata, getResourceBySlug } from '../services/contentManager.js';

/** Public content API and educational Resources surfaces. Storage remains owned by contentManager. */
export function createContentRouter(): Router {
    const router = express.Router();

    router.get('/resources', async (_req, res, next) => {
        try {
            return res.render('resources/index');
        } catch (error) {
            return next(error);
        }
    });

    router.get('/resources/:slug', async (req, res, next) => {
        try {
            const resource = await getResourceBySlug(String(req.params.slug || ''));
            if (!resource) return res.status(404).render('resources/article', { slug: req.params.slug });
            return res.render('resources/article', { slug: resource.slug });
        } catch (error) {
            return next(error);
        }
    });

    router.get('/api/resources', async (req, res) => {
        res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
        try {
            const page = Number.parseInt(String(req.query.page || '1'), 10);
            const resources = await getAllResourceMetadata(Number.isFinite(page) ? page : 1, 20);
            return res.json({ resources });
        } catch (error) {
            console.error('Error fetching resources:', error);
            return res.status(500).json({ error: 'Failed to fetch resources' });
        }
    });

    router.get('/api/resources/:slug', async (req, res) => {
        res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
        try {
            const resource = await getResourceBySlug(String(req.params.slug || ''));
            if (!resource) return res.status(404).json({ error: 'Resource not found' });
            return res.json({
                slug: resource.slug,
                title: resource.title,
                category: resource.category || 'Guide',
                body: resource.body ? getResourceBodyHtml(resource.body) : '',
                excerpt: resource.excerpt || '',
                updated_at: resource.updatedAt || null,
            });
        } catch (error) {
            console.error(`Error fetching resource ${req.params.slug}:`, error);
            return res.status(500).json({ error: 'Failed to fetch resource' });
        }
    });

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

    return router;
}

function getResourceBodyHtml(markdown: string): string {
    return markdown
        .split('\n\n')
        .map((block) => {
            const trimmed = block.trim();
            if (!trimmed) return '';
            if (trimmed.startsWith('# ')) return `<h1>${escapeHtml(trimmed.slice(2))}</h1>`;
            if (trimmed.startsWith('## ')) return `<h2>${escapeHtml(trimmed.slice(3))}</h2>`;
            if (trimmed.startsWith('### ')) return `<h3>${escapeHtml(trimmed.slice(4))}</h3>`;
            if (trimmed.startsWith('- ')) return `<ul>${trimmed.split('\n').map((line) => `<li>${escapeHtml(line.replace(/^-\s+/, ''))}</li>`).join('')}</ul>`;
            return `<p>${escapeHtml(trimmed).replace(/\n/g, '<br>')}</p>`;
        })
        .join('');
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character));
}

export default createContentRouter();