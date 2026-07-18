// AUTO-GENERATED — do not edit by hand.
// Run `bun run scripts/build-admin-embedded.ts` to regenerate.
// Source: admin/dist/ at 2026-07-18.
//
// Bun resolves the file: imports to a path that works at runtime even
// inside a compiled binary (`bun build --compile`). The manifest maps
// the request path the express handler sees to (resolved-path, mime).

// @ts-ignore — type: 'file' is Bun ESM, not in lib.d.ts
import A_0_assets_Graph_BJp5_4It_js from '../admin/dist/assets/Graph-BJp5-4It.js' with { type: 'file' };
// @ts-ignore — type: 'file' is Bun ESM, not in lib.d.ts
import A_1_assets_index_BXQRpb2e_js from '../admin/dist/assets/index-BXQRpb2e.js' with { type: 'file' };
// @ts-ignore — type: 'file' is Bun ESM, not in lib.d.ts
import A_2_assets_index_CgPfrNOq_css from '../admin/dist/assets/index-CgPfrNOq.css' with { type: 'file' };
// @ts-ignore — type: 'file' is Bun ESM, not in lib.d.ts
import A_3_favicon_svg from '../admin/dist/favicon.svg' with { type: 'file' };
// @ts-ignore — type: 'file' is Bun ESM, not in lib.d.ts
import A_4_index_html from '../admin/dist/index.html' with { type: 'file' };

export interface AdminAsset {
  path: string;
  mime: string;
}

export const ADMIN_ASSETS: Record<string, AdminAsset> = {
  "/admin/assets/Graph-BJp5-4It.js": { path: A_0_assets_Graph_BJp5_4It_js as unknown as string, mime: "application/javascript; charset=utf-8" },
  "/admin/assets/index-BXQRpb2e.js": { path: A_1_assets_index_BXQRpb2e_js as unknown as string, mime: "application/javascript; charset=utf-8" },
  "/admin/assets/index-CgPfrNOq.css": { path: A_2_assets_index_CgPfrNOq_css as unknown as string, mime: "text/css; charset=utf-8" },
  "/admin/favicon.svg": { path: A_3_favicon_svg as unknown as string, mime: "image/svg+xml" },
  "/admin/index.html": { path: A_4_index_html as unknown as string, mime: "text/html; charset=utf-8" },
};

/** Index entry point for SPA fallback. */
export const ADMIN_INDEX_HTML: AdminAsset = ADMIN_ASSETS['/admin/index.html'];

export const ADMIN_ASSET_COUNT = 5;
