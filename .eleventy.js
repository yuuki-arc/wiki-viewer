const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "config.json");
let VAULT;
try {
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  VAULT = cfg.vault;
  if (!VAULT) throw new Error("config.json is missing the 'vault' key");
} catch (err) {
  console.error("[wiki-viewer] " + err.message);
  console.error(
    "[wiki-viewer] Copy config.example.json to config.json and set the 'vault' path."
  );
  process.exit(1);
}

const TEMPLATE_PATH = path.join(__dirname, "_includes", "base.html");

module.exports = function (eleventyConfig) {
  const readTemplate = () => fs.readFileSync(TEMPLATE_PATH, "utf8");

  eleventyConfig.addWatchTarget(path.join(__dirname, "_includes"));

  const EXCLUDED_DIRS = new Set([
    ".raw",
    "_templates",
    ".obsidian",
    "Excalidraw",
    ".git",
    ".claude",
    "node_modules",
  ]);
  const EXCLUDED_FILES = new Set([
    "CLAUDE.md",
    "README.md",
    "karpathy-llm-wiki.md",
    "2026-04-22.md",
  ]);

  eleventyConfig.addPreprocessor("skip-excluded", "md", (data) => {
    const rel = path.relative(VAULT, data.page.inputPath);
    const firstSegment = rel.split(path.sep)[0];
    if (EXCLUDED_DIRS.has(firstSegment)) return false;
    if (EXCLUDED_FILES.has(rel)) return false;
    return undefined;
  });

  eleventyConfig.addTransform("wrap-layout", function (content) {
    if (!this.page.outputPath || !this.page.outputPath.endsWith(".html")) {
      return content;
    }
    const title = (this.page.data && this.page.data.title) || this.page.fileSlug;
    return readTemplate()
      .replace(/\{\{\s*title\s*\}\}/g, escapeHtml(title))
      .replace(/\{\{\s*content\s*\}\}/g, content);
  });

  eleventyConfig.addPassthroughCopy({
    [path.join(VAULT, "_attachments")]: "_attachments",
  });
  eleventyConfig.addPassthroughCopy({
    [path.join(__dirname, "assets")]: "assets",
  });

  eleventyConfig.on("eleventy.after", async ({ results, dir }) => {
    const urls = results
      .map((r) => r.url)
      .filter((url) => typeof url === "string" && url.endsWith("/"))
      .sort();
    const tree = buildTree(urls);
    const sidebarHtml = renderSidebar(tree);

    const body = `<h1>wiki-viewer</h1>\n${renderTree(tree)}`;
    const rootHtml = readTemplate()
      .replace(/\{\{\s*title\s*\}\}/g, "Index")
      .replace(/\{\{\s*content\s*\}\}/g, body)
      .replace(/\{\{\s*sidebar\s*\}\}/g, sidebarHtml);
    await fs.promises.writeFile(path.join(dir.output, "index.html"), rootHtml);

    await Promise.all(
      results.map(async (r) => {
        if (!r.outputPath || !r.outputPath.endsWith(".html")) return;
        const content = await fs.promises.readFile(r.outputPath, "utf8");
        const replaced = content.replace(/\{\{\s*sidebar\s*\}\}/g, sidebarHtml);
        if (replaced !== content) {
          await fs.promises.writeFile(r.outputPath, replaced);
        }
      })
    );
  });

  eleventyConfig.setServerOptions({
    port: 8080,
    showAllHosts: false,
  });

  return {
    dir: {
      input: VAULT,
      output: path.join(__dirname, "_site"),
    },
    markdownTemplateEngine: false,
    htmlTemplateEngine: false,
    dataTemplateEngine: false,
  };
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildTree(urls) {
  const root = { name: "", url: null, children: new Map() };
  for (const url of urls) {
    const segs = url.split("/").filter(Boolean);
    let node = root;
    for (const seg of segs) {
      if (!node.children.has(seg)) {
        node.children.set(seg, { name: seg, url: null, children: new Map() });
      }
      node = node.children.get(seg);
    }
    node.url = url;
  }
  return root;
}

function renderTree(node) {
  if (node.children.size === 0) return "";
  const entries = Array.from(node.children.values()).sort((a, b) => {
    const aHasKids = a.children.size > 0;
    const bHasKids = b.children.size > 0;
    if (aHasKids !== bHasKids) return aHasKids ? -1 : 1;
    return a.name.localeCompare(b.name, "ja");
  });
  const lines = ["<ul class=\"tree\">"];
  for (const child of entries) {
    const label = escapeHtml(decodeSafely(child.name));
    const link = child.url
      ? `<a href="${encodeURI(child.url)}">${label}</a>`
      : `<span class="tree-dir">${label}/</span>`;
    lines.push(`<li>${link}${renderTree(child)}</li>`);
  }
  lines.push("</ul>");
  return lines.join("\n");
}

function decodeSafely(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function sortChildren(map) {
  return Array.from(map.values()).sort((a, b) => {
    const aHasKids = a.children.size > 0;
    const bHasKids = b.children.size > 0;
    if (aHasKids !== bHasKids) return aHasKids ? -1 : 1;
    return a.name.localeCompare(b.name, "ja");
  });
}

function renderSidebar(root) {
  const lines = ['<ul class="side-tree">'];
  for (const child of sortChildren(root.children)) {
    lines.push(renderSidebarNode(child, 0));
  }
  lines.push("</ul>");
  return lines.join("\n");
}

function renderSidebarNode(node, depth) {
  const label = escapeHtml(decodeSafely(node.name));
  const hasKids = node.children.size > 0;
  if (!hasKids) {
    const href = node.url ? encodeURI(node.url) : "#";
    return `<li><a href="${href}">${label}</a></li>`;
  }
  const childHtml = sortChildren(node.children)
    .map((c) => renderSidebarNode(c, depth + 1))
    .join("");
  const openAttr = depth === 0 ? " open" : "";
  const selfLink = node.url
    ? `<a class="dir-self" href="${encodeURI(node.url)}" title="open ${label}">·</a>`
    : "";
  return `<li><details${openAttr}><summary>${label}${selfLink}</summary><ul>${childHtml}</ul></details></li>`;
}
