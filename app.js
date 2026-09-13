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
    const lines = match[1].split("\n");
    let currentKey = null;
    lines.forEach((line) => {
      if (line.startsWith("  ") && currentKey) {
        const idx = line.trim().indexOf(":");
        if (idx > 0) {
          const val = line.trim().slice(idx + 1).trim();
          if (val) attrs[currentKey][line.trim().slice(0, idx).trim()] = val;
        }
      } else {
        currentKey = null;
        const idx = line.indexOf(":");
        if (idx > 0) {
          const key = line.slice(0, idx).trim();
          const val = line.slice(idx + 1).trim();
          if (val) {
            attrs[key] = val;
          } else {
            attrs[key] = {};
            currentKey = key;
          }
        }
      }
    });
    return { attrs, content: match[2] };
  }

  // --- Sidebar ---
  let NAV = [];

  async function loadNavigation() {
    const pages = await Promise.all(
      Object.entries(PAGES).map(async ([href, page]) => {
        const res = await fetch(BASE_PATH + "/" + page.file);
        if (!res.ok) return null;
        const { attrs } = parseFrontmatter(await res.text());
        if (attrs.published !== "true" || !attrs.nav_section) return null;
        return {
          href,
          title: attrs.title || page.title,
          section: attrs.nav_section,
          order: Number(attrs.nav_order) || 0,
        };
      }),
    );

    const sections = new Map();
    pages
      .filter(Boolean)
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
      .forEach((page) => {
        if (!sections.has(page.section)) sections.set(page.section, []);
        sections.get(page.section).push({ title: page.title, href: page.href });
      });

    NAV = [...sections].map(([title, links]) => ({ title, links }));
  }

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
      a.textContent = h.textContent;
      a.addEventListener("click", (event) => {
        event.preventDefault();
        const target = document.getElementById(id);
        if (target) {
          target.scrollIntoView({ behavior: "smooth" });
        }
      });
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

    try {
      await loadNavigation();
      renderSidebar(path);
      renderPageNav(path);

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

      // Custom image renderer with lazy loading, captions, and error handling
      renderer.image = function (href, title, text) {
        // Handle both old and new marked.js API
        const src = typeof href === "object" ? href.href : href;
        const altText = typeof href === "object" ? href.text : text;
        const titleAttr = typeof href === "object" ? href.title : title;

        // Resolve image path relative to markdown file
        let resolvedSrc = src;
        if (src && !src.startsWith("http://") && !src.startsWith("https://") && !src.startsWith("/")) {
          const currentPage = PAGES[path];
          if (currentPage && currentPage.file) {
            const pageDir = currentPage.file.substring(0, currentPage.file.lastIndexOf("/") + 1);
            resolvedSrc = BASE_PATH + "/" + pageDir + src;
          }
        }

        // Build image HTML with enhanced attributes
        const imgHtml = `<img 
          src="${resolvedSrc}" 
          alt="${altText || ""}"
          title="${titleAttr || ""}"
          loading="lazy"
          decoding="async"
          class="prose-image zoomable"
          data-original="${resolvedSrc}"
          onerror="this.onerror=null; this.classList.add('error');"
        />`;

        // Wrap in figure with caption if alt text exists
        if (altText) {
          return `<figure class="image-figure">${imgHtml}<figcaption class="image-caption">${altText}</figcaption></figure>`;
        }
        return imgHtml;
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

      let metadataInner = "";
      if (attrs.author && typeof attrs.author === "object" && attrs.author.name) {
        const name = attrs.author.name;
        const url = attrs.author.url || "";
        const image = attrs.author.image || "";
        const imageTag = image ? `<div class="author-avatar"><img src="${image}" alt="${name}" /></div>` : "";
        const nameTag = url ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${name}</a>` : name;
        metadataInner += `<div class="author-info"><span class="author-label">Author</span><span class="author-name">${nameTag}</span>${imageTag}</div>`;
      }
      const metadataHtml = Object.keys(attrs).length > 0 ? `<div class="metadata">${metadataInner}</div>` : "";

      document.getElementById("article").innerHTML = `<h1>${title}</h1>${metadataHtml}${html}`;

      renderTOC();
    } catch (err) {
      document.getElementById("article").innerHTML = `<h1>Error</h1><p>${err.message}</p>`;
    }
  }

  // --- Image Modal ---
  function initImageModal() {
    // Add modal HTML to document body
    const modalHtml = `
      <div id="image-modal" class="image-modal" role="dialog" aria-modal="true" aria-label="Image viewer" tabindex="-1">
        <div class="modal-overlay" aria-hidden="true"></div>
        <div class="modal-content">
          <button class="modal-close" aria-label="Close image viewer">&times;</button>
          <img id="modal-image" class="modal-img" src="" alt="" />
          <div id="modal-caption" class="modal-caption"></div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    // Get modal elements
    const modal = document.getElementById("image-modal");
    const modalOverlay = modal.querySelector(".modal-overlay");
    const closeBtn = modal.querySelector(".modal-close");
    const modalImg = document.getElementById("modal-image");
    const modalCaption = document.getElementById("modal-caption");

    // Close modal function
    function closeModal() {
      modal.classList.remove("active");
      document.body.style.overflow = "";
    }

    // Open modal function
    function openModal(imgElement) {
      const src = imgElement.getAttribute("data-original") || imgElement.src;
      const alt = imgElement.alt || "";
      const caption = imgElement.closest("figure")?.querySelector("figcaption")?.textContent || alt;

      modalImg.src = src;
      modalImg.alt = alt;
      modalCaption.textContent = caption;

      modal.classList.add("active");
      document.body.style.overflow = "hidden";
      modal.focus();
    }

    // Event listeners for closing modal
    modalOverlay.addEventListener("click", closeModal);
    closeBtn.addEventListener("click", closeModal);

    // Keyboard navigation
    document.addEventListener("keydown", (e) => {
      if (!modal.classList.contains("active")) return;

      if (e.key === "Escape") {
        closeModal();
      }
    });

    // Click handler for images
    document.addEventListener("click", (e) => {
      const img = e.target.closest(".zoomable");
      if (img) {
        e.preventDefault();
        openModal(img);
      }
    });

    // Keyboard activation for images
    document.addEventListener("keydown", (e) => {
      const img = e.target.closest?.(".zoomable");
      if (img && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        openModal(img);
      }
    });
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
  initImageModal();
  window.addEventListener("hashchange", onRouteChange);
  onRouteChange();
})();
