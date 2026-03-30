(() => {
  const BASE_PATH = location.pathname.replace(/index\.html$/, "").replace(/\/$/, "");

  // --- Theme ---
  function initTheme() {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = saved || (prefersDark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  }

  // --- Frontmatter parser ---
  function parseFrontmatter(md) {
    const match = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { attrs: {}, content: md };
    const attrs = {};
    match[1].split("\n").forEach((line) => {
      const idx = line.indexOf(":");
      if (idx > 0) {
        attrs[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      }
    });
    return { attrs, content: match[2] };
  }

  // --- Sidebar ---
  function renderSidebar(activePath) {
    const navList = document.getElementById("nav-list");
    navList.innerHTML = "";
    NAV.forEach((section) => {
      const group = document.createElement("div");
      group.className = "nav-group";
      const title = document.createElement("h5");
      title.textContent = section.title;
      group.appendChild(title);

      section.links.forEach((link) => {
        const a = document.createElement("a");
        a.textContent = link.title;
        a.href = "#" + link.href;
        if (link.href === activePath) a.className = "active";
        group.appendChild(a);
      });

      navList.appendChild(group);
    });
  }

  // --- Table of Contents ---
  function renderTOC() {
    const article = document.getElementById("article");
    const tocList = document.getElementById("toc-list");
    tocList.innerHTML = "";
    const headings = article.querySelectorAll("h2, h3");
    if (headings.length === 0) {
      document.getElementById("toc").style.display = "none";
      return;
    }
    document.getElementById("toc").style.display = "";
    headings.forEach((h) => {
      const id = h.id;
      if (!id) return;
      const li = document.createElement("li");
      li.className = h.tagName === "H3" ? "toc-h3" : "toc-h2";
      const a = document.createElement("a");
      a.href = "#" + id;
      a.textContent = h.textContent;
      li.appendChild(a);
      tocList.appendChild(li);
    });
  }

  // --- Prev/Next navigation ---
  function renderPageNav(currentPath) {
    const pageNav = document.getElementById("page-nav");
    pageNav.innerHTML = "";
    const allLinks = NAV.flatMap((s) => s.links);
    const idx = allLinks.findIndex((l) => l.href === currentPath);
    if (idx > 0) {
      const prev = document.createElement("a");
      prev.className = "page-nav-link prev";
      prev.href = "#" + allLinks[idx - 1].href;
      prev.innerHTML = `<span class="label">&larr; Previous</span><span class="title">${allLinks[idx - 1].title}</span>`;
      pageNav.appendChild(prev);
    }
    if (idx < allLinks.length - 1) {
      const next = document.createElement("a");
      next.className = "page-nav-link next";
      next.href = "#" + allLinks[idx + 1].href;
      next.innerHTML = `<span class="label">Next &rarr;</span><span class="title">${allLinks[idx + 1].title}</span>`;
      pageNav.appendChild(next);
    }
  }

  // --- Slugify headings ---
  function slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }

  // --- Render page ---
  async function renderPage(path) {
    const page = PAGES[path];
    if (!page) {
      document.getElementById("article").innerHTML = `<h1>Not Found</h1><p>Page not found.</p>`;
      document.title = "Not Found - Quickstart";
      return;
    }

    renderSidebar(path);
    renderPageNav(path);

    try {
      const res = await fetch(BASE_PATH + "/" + page.file);
      if (!res.ok) throw new Error("Failed to load " + page.file);
      const md = await res.text();
      const { attrs, content } = parseFrontmatter(md);

      const renderer = new marked.Renderer();
      renderer.heading = function (text, level) {
        const slug = slugify(typeof text === "object" ? text.text : text);
        const t = typeof text === "object" ? text.text : text;
        return `<h${level} id="${slug}">${t}</h${level}>`;
      };

      marked.setOptions({
        renderer,
        highlight: function (code, lang) {
          if (lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
          }
          return hljs.highlightAuto(code).value;
        },
        breaks: false,
        gfm: true,
      });

      const html = marked.parse(content);
      const title = attrs.title || page.title;
      document.title = title + " - Quickstart";
      document.getElementById("article").innerHTML = `<h1>${title}</h1>` + html;

      renderTOC();
    } catch (err) {
      document.getElementById("article").innerHTML = `<h1>Error</h1><p>${err.message}</p>`;
    }
  }

  // --- Router ---
  function getHashPath() {
    let hash = location.hash.slice(1) || "/";
    // Strip leading BASE_PATH prefix (e.g. "/repo/docs/inference" -> "/inference")
    if (BASE_PATH && hash.startsWith(BASE_PATH + "/")) {
      hash = hash.slice(BASE_PATH.length);
    }
    // Ensure the route starts with a single leading slash
    if (!hash.startsWith("/")) {
      hash = "/" + hash.replace(/^\/+/, "");
    }
    // Drop any in-page anchor segment (e.g. "/route#section" -> "/route")
    const route = hash.split("#", 1)[0];
    return route || "/";
  }

  function onRouteChange() {
    const path = getHashPath();
    renderPage(path);
  }

  // --- Mobile sidebar ---
  function initSidebarToggle() {
    const toggle = document.getElementById("sidebar-toggle");
    const sidebar = document.getElementById("sidebar");
    toggle.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });
    document.getElementById("content").addEventListener("click", () => {
      sidebar.classList.remove("open");
    });
  }

  // --- Init ---
  initTheme();
  document.getElementById("theme-toggle").addEventListener("click", toggleTheme);
  document.getElementById("home-link").addEventListener("click", (e) => {
    e.preventDefault();
    location.hash = "/";
  });
  initSidebarToggle();
  window.addEventListener("hashchange", onRouteChange);
  onRouteChange();
})();
