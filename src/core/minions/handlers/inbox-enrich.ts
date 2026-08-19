import type { BrainEngine } from '../../engine.ts';
import { importFromContent } from '../../import-file.ts';
import { patchInboxFrontmatter } from '../../inbox.ts';
import { serializeMarkdown } from '../../markdown.ts';
import { runAutoLink } from '../../ops/pages.ts';
import type { MinionJobContext } from '../types.ts';

export interface InboxEnrichResult {
  slug: string;
  status: 'merged';
  job_id: number;
  links: { created: number; removed: number; errors: number };
}

/**
 * Deterministic inbox enrichment: normalize workflow frontmatter, reconcile
 * already-explicit wikilinks/frontmatter references, and mark the page merged.
 * It never calls an LLM and never guesses entities from prose.
 */
export function makeInboxEnrichHandler(engine: BrainEngine) {
  return async function inboxEnrichHandler(job: MinionJobContext): Promise<InboxEnrichResult> {
    const slug = typeof job.data.slug === 'string' ? job.data.slug : '';
    const sourceId = typeof job.data.source_id === 'string' ? job.data.source_id : 'default';
    if (!slug.startsWith('inbox/')) {
      throw new Error('inbox_enrich: job.data.slug must start with inbox/');
    }

    const page = await engine.getPage(slug, { sourceId });
    if (!page) throw new Error(`inbox_enrich: page not found: ${slug}`);

    await patchInboxFrontmatter(engine, page, {
      raw_content:
        typeof page.frontmatter?.raw_content === 'string'
          ? page.frontmatter.raw_content
          : page.compiled_truth,
      inbox_status: 'merging',
      inbox_job_id: job.id,
      inbox_error: null,
    });
    await job.updateProgress({ phase: 'inbox_enrich.normalize', completed: 1, total: 2 });

    try {
      if (job.signal.aborted) throw new Error('inbox_enrich: aborted');
      // NOT redundant with the patch above despite returning a fresh Page
      // itself: this is a deliberate re-read right before the merge write,
      // so a concurrent hard-delete (discard_inbox_items) landing in the gap
      // is caught here instead of being resurrected by importFromContent's
      // upsert. discard_inbox_items also skips hard-deleting a page whose
      // inbox_status is 'merging' as the primary mitigation; this is the
      // backstop for the remaining narrow window.
      const current = await engine.getPage(slug, { sourceId });
      if (!current) throw new Error(`inbox_enrich: page disappeared: ${slug}`);
      const tags = await engine.getTags(slug, { sourceId });
      const finalFrontmatter = {
        ...(current.frontmatter ?? {}),
        inbox_status: 'merged',
        inbox_job_id: job.id,
        inbox_error: null,
        inbox_enriched_at: new Date().toISOString(),
      };
      const content = serializeMarkdown(
        finalFrontmatter,
        current.compiled_truth,
        current.timeline ?? '',
        { type: current.type, title: current.title, tags },
      );
      const imported = await importFromContent(engine, slug, content, {
        noEmbed: true,
        sourceId,
        source_kind: current.source_kind,
        source_uri: current.source_uri,
        ingested_via: current.ingested_via,
      });
      if (!imported.parsedPage) {
        throw new Error(imported.error ?? `inbox_enrich: import ${imported.status}`);
      }
      const links = await runAutoLink(engine, slug, imported.parsedPage, { sourceId });
      await job.updateProgress({ phase: 'inbox_enrich.merge', completed: 2, total: 2 });
      return {
        slug,
        status: 'merged',
        job_id: job.id,
        links: { created: links.created, removed: links.removed, errors: links.errors },
      };
    } catch (error) {
      const latest = await engine.getPage(slug, { sourceId });
      if (latest) {
        // Land on the terminal `failed` state, NOT a workflow stage. A failed
        // enrichment is not "waiting for typed-link" — re-triggering resets it.
        await patchInboxFrontmatter(engine, latest, {
          inbox_status: 'failed',
          inbox_job_id: job.id,
          inbox_error: error instanceof Error ? error.message : String(error),
        });
      }
      throw error;
    }
  };
}
