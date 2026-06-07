import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

// Oracle for the S-rework removals: the Snippets ("Custom Scripts") page and
// the legacy Categories page are gone. We assert against the plugin manifest
// source (index.ts) so the check is independent of `vbwd-view-component` /
// CSS imports that the runtime module pulls in.
const indexSource = readFileSync(resolve(process.cwd(), 'plugins/cms-admin/index.ts'), 'utf-8');

describe('cms-admin plugin manifest (index.ts)', () => {
  it('has no Snippets / Custom Scripts route or nav entry', () => {
    expect(indexSource).not.toContain('cms/snippets');
    expect(indexSource).not.toContain('cms-snippets');
    expect(indexSource).not.toContain('SnippetManager');
    expect(indexSource).not.toContain('Custom Scripts');
    expect(indexSource).not.toContain('cms.snippets.manage');
  });

  it('has no legacy Categories route or nav entry', () => {
    expect(indexSource).not.toContain('cms/categories');
    expect(indexSource).not.toContain('cms-categories');
    expect(indexSource).not.toContain('CmsCategoryList');
    // The nav label "Categories" must be gone (Taxonomy replaces it).
    expect(indexSource).not.toMatch(/label:\s*'Categories'/);
  });

  it('keeps the Pages nav entry and points it at the unified PostEditor', () => {
    expect(indexSource).toContain("name: 'cms-admin-pages'");
    // Pages edit uses the unified PostEditor route, not the legacy page editor.
    expect(indexSource).toContain("name: 'cms-post-edit'");
  });

  it('keeps the Taxonomy nav entry', () => {
    expect(indexSource).toContain('cms/taxonomy');
  });

  it('has no legacy CMS Import / Export page route or nav entry (unified control only)', () => {
    expect(indexSource).not.toContain('cms/import-export');
    expect(indexSource).not.toContain('cms-import-export');
    expect(indexSource).not.toContain('CmsImportExport');
    expect(indexSource).not.toContain('Import / Export');
  });

  it('routes /admin/cms/posts at the Posts list (type=post) and /admin/cms/pages at the Pages list (type=page)', () => {
    expect(indexSource).toContain("name: 'cms-posts'");
    expect(indexSource).toContain('PostList.vue');
    expect(indexSource).toContain("name: 'cms-admin-pages'");
    expect(indexSource).toContain('CmsPageList.vue');
  });
});

describe('cms-admin shared content list (single source for posts + pages)', () => {
  const postListSource = readFileSync(
    resolve(process.cwd(), 'plugins/cms-admin/src/views/PostList.vue'),
    'utf-8',
  );
  const pageListSource = readFileSync(
    resolve(process.cwd(), 'plugins/cms-admin/src/views/CmsPageList.vue'),
    'utf-8',
  );

  it('PostList delegates to the shared CmsContentList with type="post"', () => {
    expect(postListSource).toContain('CmsContentList');
    expect(postListSource).toMatch(/type=["']post["']/);
  });

  it('CmsPageList delegates to the shared CmsContentList with type="page"', () => {
    expect(pageListSource).toContain('CmsContentList');
    expect(pageListSource).toMatch(/type=["']page["']/);
  });
});
