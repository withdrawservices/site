"use strict";

// ── API config ──────────────────────────────────────────────
const TMDB_KEY  = "d9f0568167a608d0700093444b0c2da7";
const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_W500  = "https://image.tmdb.org/t/p/w500";
const IMG_ORIG  = "https://image.tmdb.org/t/p/original";

const VIDKING_MOVIE = (id) =>
  `https://www.vidking.net/embed/movie/${id}?autoplay=true&ads=0`;

const VIDKING_TV = (id, s, e) =>
  `https://www.vidking.net/embed/tv/${id}/${s}/${e}?autoplay=true&ads=0`;

// ── Helpers ──────────────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

async function tmdb(path) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${TMDB_BASE}${path}${sep}api_key=${TMDB_KEY}`);
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${path}`);
  return res.json();
}

function posterUrl(p, size = IMG_W500) {
  return p ? `${size}${p}` : null;
}

function year(dateStr) {
  return dateStr ? dateStr.slice(0, 4) : "N/A";
}

function formatRuntime(min) {
  if (!min) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function esc(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const MyList = {
  key: "pt_mylist",
  get() {
    try { return JSON.parse(localStorage.getItem(this.key) || "[]"); }
    catch { return []; }
  },
  has(id, type) {
    return this.get().some(i => i.id === id && i.type === type);
  },
  add(item) {
    const list = this.get();
    if (!this.has(item.id, item.type)) list.unshift(item);
    localStorage.setItem(this.key, JSON.stringify(list));
  },
  remove(id, type) {
    const list = this.get().filter(i => !(i.id === id && i.type === type));
    localStorage.setItem(this.key, JSON.stringify(list));
  },
  toggle(item) {
    if (this.has(item.id, item.type)) { this.remove(item.id, item.type); return false; }
    this.add(item); return true;
  }
};

const Progress = {
  key: "pt_progress",
  get() {
    try { return JSON.parse(localStorage.getItem(this.key) || "{}"); }
    catch { return {}; }
  },
  save(id, type, data) {
    const all = this.get();
    all[`${type}_${id}`] = { ...data, savedAt: Date.now() };
    localStorage.setItem(this.key, JSON.stringify(all));
  },
  getAll() {
    return Object.values(this.get());
  }
};

// ── Vidking progress events ──────────────────────────────────
window.addEventListener("message", function(event) {
  try {
    if (typeof event.data !== "string") return;
    const msg = JSON.parse(event.data);
    if (msg.type === "PLAYER_EVENT" && msg.data) {
      const d = msg.data;
      const id = d.id;
      const type = d.mediaType || "movie";
      if (id && d.progress > 1 && d.progress < 98) {
        Progress.save(id, type, {
          id, type,
          progress: d.progress,
          timestamp: d.currentTime,
          season: d.season,
          episode: d.episode,
          title: document.title
        });
      }
    }
  } catch (_) { /* ignore */ }
});

// ============================================================
//  PAGE DETECTION
// ============================================================
const PAGE = (() => {
  const p = location.pathname;
  if (p.endsWith("movie.html")) return "movie";
  if (p.endsWith("tv.html"))    return "tv";
  if (p.endsWith("search.html")) return "search";
  return "home";
})();

// ============================================================
//  SHARED: NAVBAR
// ============================================================
function initNavbar() {
  const navbar = $("#navbar");
  if (!navbar) return;

  // Scroll opacity
  if (!navbar.classList.contains("navbar-solid")) {
    window.addEventListener("scroll", () => {
      navbar.classList.toggle("scrolled", window.scrollY > 50);
    }, { passive: true });
  }

  // Hamburger
  const hamburger = $("#hamburger");
  const navLinks  = $(".nav-links");
  if (hamburger && navLinks) {
    hamburger.addEventListener("click", () => {
      navLinks.classList.toggle("mobile-open");
    });
  }

  // Search toggle (navbar compact search)
  const searchToggle = $("#search-toggle");
  const navSearch    = $("#nav-search");
  const searchInput  = $("#search-input");

  if (searchToggle && navSearch && searchInput) {
    searchToggle.addEventListener("click", () => {
      navSearch.classList.toggle("open");
      if (navSearch.classList.contains("open")) searchInput.focus();
    });

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && searchInput.value.trim()) {
        location.href = `search.html?q=${encodeURIComponent(searchInput.value.trim())}`;
      }
      if (e.key === "Escape") {
        navSearch.classList.remove("open");
        searchInput.value = "";
      }
    });
  }
}

// ============================================================
//  SHARED: CARD BUILDER
// ============================================================
function buildMovieCard(item, type = "movie") {
  const id       = item.id;
  const title    = item.title || item.name || "Untitled";
  const poster   = posterUrl(item.poster_path);
  const date     = item.release_date || item.first_air_date || "";
  const rating   = item.vote_average ? item.vote_average.toFixed(1) : "";
  const href     = type === "tv" ? `tv.html?id=${id}` : `movie.html?id=${id}`;
  const inList   = MyList.has(id, type);

  const img = poster
    ? `<img src="${esc(poster)}" alt="${esc(title)}" loading="lazy" />`
    : `<div class="no-poster" style="aspect-ratio:2/3;background:var(--surface);display:flex;align-items:center;justify-content:center;">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:32px;height:32px;opacity:.3"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
       </div>`;

  const card = document.createElement("div");
  card.className = "movie-card";
  card.dataset.id   = id;
  card.dataset.type = type;
  card.innerHTML = `
    ${img}
    <div class="movie-card-overlay">
      <div class="movie-card-title">${esc(title)}</div>
      <div class="movie-card-meta">${year(date)}${rating ? ` · ⭐ ${rating}` : ""}</div>
    </div>
    <div class="movie-card-actions">
      <button class="card-action-btn list-btn${inList ? " in-list" : ""}" title="${inList ? "Remove from My List" : "Add to My List"}">
        ${inList
          ? `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 6L9 17l-5-5"/></svg>`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`
        }
      </button>
    </div>
  `;

  // Click → detail page
  card.addEventListener("click", (e) => {
    if (e.target.closest(".card-action-btn")) return;
    location.href = href;
  });

  // My List toggle
  const listBtn = card.querySelector(".list-btn");
  listBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const added = MyList.toggle({ id, type, title, poster: item.poster_path });
    listBtn.classList.toggle("in-list", added);
    listBtn.innerHTML = added
      ? `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 6L9 17l-5-5"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
  });

  return card;
}

function buildSkeletonCards(n = 8) {
  return Array.from({ length: n }, () => {
    const d = document.createElement("div");
    d.className = "skeleton-card skeleton";
    return d;
  });
}

// ============================================================
//  SHARED: ROW BUILDER
// ============================================================
function buildRow(title, items, type = "movie") {
  if (!items || items.length === 0) return null;

  const wrapper = document.createElement("div");
  wrapper.className = "row-wrapper";

  wrapper.innerHTML = `
    <div class="row-header">
      <h2 class="row-title">${esc(title)}</h2>
    </div>
    <div class="row-track-container">
      <button class="row-arrow arrow-left" aria-label="Scroll left">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div class="row-track"></div>
      <button class="row-arrow arrow-right" aria-label="Scroll right">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>
  `;

  const track = wrapper.querySelector(".row-track");
  items.forEach(item => track.appendChild(buildMovieCard(item, type)));

  // Arrows
  const leftBtn  = wrapper.querySelector(".arrow-left");
  const rightBtn = wrapper.querySelector(".arrow-right");
  const scrollAmt = 600;

  leftBtn.addEventListener("click",  () => track.scrollBy({ left: -scrollAmt, behavior: "smooth" }));
  rightBtn.addEventListener("click", () => track.scrollBy({ left:  scrollAmt, behavior: "smooth" }));

  return wrapper;
}

// ============================================================
//  HOME PAGE
// ============================================================
async function initHomePage() {
  // Splash screen
  initSplash();

  // Wait for main content to be ready then fade in
  const main = $("#main-content");

  // Navbar
  initNavbar();

  // Fetch hero + categories in parallel
  const categoriesEl = $("#categories");

  // Show skeleton rows while loading
  const skeletonRows = [
    "Trending Now", "Top Rated", "Popular on withdraw", "Now Playing",
    "Action", "Comedy", "Horror", "Sci-Fi"
  ];
  skeletonRows.forEach(t => {
    const w = document.createElement("div");
    w.className = "row-wrapper";
    w.innerHTML = `
      <div class="row-header"><h2 class="row-title">${esc(t)}</h2></div>
      <div class="row-track-container">
        <div class="row-track" id="skel-${t.replace(/\s+/g,"-")}"></div>
      </div>
    `;
    const track = w.querySelector(".row-track");
    buildSkeletonCards(8).forEach(c => track.appendChild(c));
    categoriesEl.appendChild(w);
  });

  const categories = [
    { title: "Trending Now",         path: "/trending/movie/week",                  type: "movie" },
    { title: "Top Rated",            path: "/movie/top_rated",                      type: "movie" },
    { title: "Popular on withdraw", path: "/movie/popular",                        type: "movie" },
    { title: "Now Playing",          path: "/movie/now_playing",                    type: "movie" },
    { title: "Action",               path: "/discover/movie?with_genres=28",        type: "movie" },
    { title: "Comedy",               path: "/discover/movie?with_genres=35",        type: "movie" },
    { title: "Horror",               path: "/discover/movie?with_genres=27",        type: "movie" },
    { title: "Sci-Fi",               path: "/discover/movie?with_genres=878",       type: "movie" },
    { title: "Romance",              path: "/discover/movie?with_genres=10749",     type: "movie" },
    { title: "Documentary",          path: "/discover/movie?with_genres=99",        type: "movie" },
    { title: "Animation",            path: "/discover/movie?with_genres=16",        type: "movie" },
    { title: "Trending TV Shows",    path: "/trending/tv/week",                     type: "tv"    },
    { title: "Top Rated TV",         path: "/tv/top_rated",                         type: "tv"    },
  ];

  // Hero: use trending
  let heroLoaded = false;

  // Fetch all rows
  const results = await Promise.allSettled(
    categories.map(c => tmdb(c.path))
  );

  // Replace skeleton rows and add real rows
  categoriesEl.innerHTML = "";

  // Continue Watching (if any)
  const progress = Progress.getAll();
  if (progress.length > 0) {
    // Fetch details for progress items
    const cwItems = await Promise.allSettled(
      progress.slice(0, 10).map(p =>
        tmdb(p.type === "tv" ? `/tv/${p.id}` : `/movie/${p.id}`)
          .then(d => ({ ...d, _mediaType: p.type, _progress: p.progress }))
      )
    );
    const cwData = cwItems
      .filter(r => r.status === "fulfilled")
      .map(r => r.value);
    if (cwData.length > 0) {
      const cwRow = buildRow("Continue Watching", cwData, "mixed");
      if (cwRow) {
        // Fix types per item
        cwData.forEach((item, i) => {
          const cards = cwRow.querySelectorAll(".movie-card");
          if (cards[i]) cards[i].dataset.type = item._mediaType;
        });
        categoriesEl.appendChild(cwRow);
      }
    }
  }

  // My List row
  const myListItems = MyList.get();
  if (myListItems.length > 0) {
    const mlData = await Promise.allSettled(
      myListItems.slice(0, 20).map(i =>
        tmdb(i.type === "tv" ? `/tv/${i.id}` : `/movie/${i.id}`)
          .then(d => ({ ...d, _mediaType: i.type }))
      )
    );
    const mlItems = mlData.filter(r => r.status === "fulfilled").map(r => r.value);
    if (mlItems.length > 0) {
      const mlRow = document.createElement("div");
      mlRow.className = "row-wrapper";
      mlRow.id = "my-list";
      mlRow.innerHTML = `
        <div class="row-header"><h2 class="row-title">My List</h2></div>
        <div class="row-track-container">
          <button class="row-arrow arrow-left" aria-label="Scroll left">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div class="row-track"></div>
          <button class="row-arrow arrow-right" aria-label="Scroll right">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      `;
      const track = mlRow.querySelector(".row-track");
      mlItems.forEach(item => {
        track.appendChild(buildMovieCard(item, item._mediaType || "movie"));
      });
      const la = mlRow.querySelector(".arrow-left");
      const ra = mlRow.querySelector(".arrow-right");
      la.addEventListener("click", () => track.scrollBy({ left: -600, behavior: "smooth" }));
      ra.addEventListener("click", () => track.scrollBy({ left:  600, behavior: "smooth" }));
      categoriesEl.appendChild(mlRow);
    }
  }

  // Render category rows
  results.forEach((result, i) => {
    if (result.status !== "fulfilled") return;
    const data  = result.value;
    const items = data.results || [];
    const cat   = categories[i];

    // Set hero from first trending row
    if (!heroLoaded && i === 0 && items.length > 0) {
      heroLoaded = true;
      const heroItem = items[Math.floor(Math.random() * Math.min(5, items.length))];
      loadHero(heroItem);
    }

    const row = buildRow(cat.title, items, cat.type);
    if (row) categoriesEl.appendChild(row);
  });

  // Show main
  if (main) main.style.opacity = "1";
}

// ── Hero ─────────────────────────────────────────────────────
async function loadHero(item) {
  if (!item) return;

  const id    = item.id;
  const type  = item.media_type === "tv" ? "tv" : "movie";
  const title = item.title || item.name || "";
  const desc  = item.overview || "";
  const backdrop = item.backdrop_path ? `${IMG_ORIG}${item.backdrop_path}` : "";

  const heroBackdrop = $("#hero-backdrop");
  const heroTitle    = $("#hero-title");
  const heroDesc     = $("#hero-desc");
  const heroMeta     = $("#hero-meta");
  const heroPlayBtn  = $("#hero-play-btn");
  const heroInfoBtn  = $("#hero-info-btn");

  if (heroBackdrop && backdrop) {
    heroBackdrop.style.backgroundImage = `url(${backdrop})`;
  }
  if (heroTitle) heroTitle.textContent = title;
  if (heroDesc)  heroDesc.textContent  = desc;

  // Fetch details for rating / genres
  try {
    const detail = await tmdb(`/${type}/${id}`);
    const rating = detail.vote_average ? detail.vote_average.toFixed(1) : "";
    const genres = (detail.genres || []).slice(0, 3).map(g => g.name).join(", ");
    const runtime = detail.runtime ? formatRuntime(detail.runtime) : (detail.episode_run_time ? formatRuntime(detail.episode_run_time[0]) : "");
    const releaseYear = year(detail.release_date || detail.first_air_date);

    if (heroMeta) {
      heroMeta.innerHTML = `
        ${rating ? `<span class="rating"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>${rating}</span>` : ""}
        <span>${releaseYear}</span>
        ${runtime ? `<span>${runtime}</span>` : ""}
        ${genres ? `<span>${esc(genres)}</span>` : ""}
      `;
    }
  } catch (_) { /* non-critical */ }

  const href = type === "tv" ? `tv.html?id=${id}` : `movie.html?id=${id}`;
  if (heroPlayBtn) {
    heroPlayBtn.addEventListener("click", () => { location.href = href; });
  }
  if (heroInfoBtn) {
    heroInfoBtn.addEventListener("click", () => { location.href = href; });
  }
}

// ── Splash ───────────────────────────────────────────────────
function initSplash() {
  const splash = $("#splash-screen");
  if (!splash) return;

  // Always show splash on home page load
  const shown = sessionStorage.getItem("pt_splash");
  if (shown) {
    splash.style.display = "none";
    const main = $("#main-content");
    if (main) main.style.opacity = "1";
    return;
  }

  // Hide after 3 seconds
  setTimeout(() => {
    splash.classList.add("fade-out");
    setTimeout(() => {
      splash.style.display = "none";
      sessionStorage.setItem("pt_splash", "1");
    }, 800);
  }, 3000);
}

// ============================================================
//  MOVIE DETAIL PAGE
// ============================================================
async function initMoviePage() {
  initNavbar();

  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  if (!id) { location.href = "index.html"; return; }

  try {
    const movie = await tmdb(`/movie/${id}?append_to_response=credits,similar`);

    // Title
    document.title = `withdraw.cc — ${movie.title}`

    // Backdrop
    const backdrop = movie.backdrop_path ? `${IMG_ORIG}${movie.backdrop_path}` : "";
    const backdropEl = $("#detail-backdrop");
    if (backdropEl && backdrop) {
      backdropEl.style.backgroundImage = `url(${backdrop})`;
    }

    // Header
    const headerEl = $("#detail-header");
    if (headerEl) {
      const genres = (movie.genres || []).map(g =>
        `<span class="genre-pill">${esc(g.name)}</span>`
      ).join("");

      const rating = movie.vote_average ? movie.vote_average.toFixed(1) : "N/A";
      const inList = MyList.has(movie.id, "movie");

      headerEl.innerHTML = `
        <h1 class="detail-title">${esc(movie.title || "")}</h1>
        <div class="detail-meta">
          <span class="rating-badge">
            <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            ${esc(rating)}
          </span>
          <span>${year(movie.release_date)}</span>
          ${movie.runtime ? `<span>${formatRuntime(movie.runtime)}</span>` : ""}
          ${genres}
        </div>
        <p class="detail-overview">${esc(movie.overview || "")}</p>
        <button class="detail-list-btn ${inList ? "in-list" : ""}" id="detail-list-btn">
          ${inList
            ? `<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M20 6L9 17l-5-5"/></svg> In My List`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add to My List`
          }
        </button>
      `;

      // My List toggle
      const listBtn = headerEl.querySelector("#detail-list-btn");
      listBtn.addEventListener("click", () => {
        const added = MyList.toggle({
          id: movie.id, type: "movie",
          title: movie.title,
          poster: movie.poster_path
        });
        listBtn.className = `detail-list-btn ${added ? "in-list" : ""}`;
        listBtn.innerHTML = added
          ? `<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M20 6L9 17l-5-5"/></svg> In My List`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add to My List`;
      });
    }

    // Player
    const playerContainer = $("#player-container");
    if (playerContainer) {
      playerContainer.innerHTML = `<iframe src="${VIDKING_MOVIE(id)}" allowfullscreen allow="autoplay; fullscreen"></iframe>`;
    }

    // Detail info grid
    const detailInfo = $("#detail-info");
    if (detailInfo && movie) {
      detailInfo.innerHTML = `
        <div class="detail-info-grid">
          ${movie.status   ? `<div class="info-item"><label>Status</label><span>${esc(movie.status)}</span></div>` : ""}
          ${movie.budget   ? `<div class="info-item"><label>Budget</label><span>$${(movie.budget / 1e6).toFixed(1)}M</span></div>` : ""}
          ${movie.revenue  ? `<div class="info-item"><label>Revenue</label><span>$${(movie.revenue / 1e6).toFixed(1)}M</span></div>` : ""}
          ${movie.original_language ? `<div class="info-item"><label>Language</label><span>${esc(movie.original_language.toUpperCase())}</span></div>` : ""}
          ${(movie.production_companies || []).length ? `<div class="info-item"><label>Studio</label><span>${esc(movie.production_companies[0].name)}</span></div>` : ""}
        </div>
      `;
    }

    // Cast
    const cast = (movie.credits && movie.credits.cast || []).slice(0, 20);
    if (cast.length > 0) {
      const castSection = $("#cast-section");
      const castRow     = $("#cast-row");
      if (castSection && castRow) {
        castSection.style.display = "";
        cast.forEach(actor => {
          const img = actor.profile_path
            ? `<img class="cast-img" src="${IMG_W500}${actor.profile_path}" alt="${esc(actor.name)}" loading="lazy" />`
            : `<div class="cast-img" style="background:var(--bg4);border-radius:var(--radius-sm);"></div>`;
          const card = document.createElement("div");
          card.className = "cast-card";
          card.innerHTML = `
            ${img}
            <div class="cast-name">${esc(actor.name)}</div>
            <div class="cast-char">${esc(actor.character || "")}</div>
          `;
          castRow.appendChild(card);
        });
      }
    }

    // Similar movies
    const similar = (movie.similar && movie.similar.results || []).slice(0, 20);
    if (similar.length > 0) {
      const simSection = $("#similar-section");
      const simRow     = $("#similar-row");
      if (simSection && simRow) {
        simSection.style.display = "";
        similar.forEach(item => simRow.appendChild(buildMovieCard(item, "movie")));
      }
    }

  } catch (err) {
    console.error("Movie detail error:", err);
    const h = $("#detail-header");
    if (h) h.innerHTML = `<p style="color:var(--text-muted)">Failed to load movie details. Please try again.</p>`;
  }
}

// ============================================================
//  TV DETAIL PAGE
// ============================================================
async function initTvPage() {
  initNavbar();

  const params  = new URLSearchParams(location.search);
  const id      = params.get("id");
  const initSeason  = parseInt(params.get("season") || "1", 10);
  const initEpisode = parseInt(params.get("episode") || "1", 10);

  if (!id) { location.href = "index.html"; return; }

  let currentSeason  = initSeason;
  let currentEpisode = initEpisode;

  try {
    const show = await tmdb(`/tv/${id}?append_to_response=credits,similar`);

    document.title = `PrimeTime — ${show.name || "TV Show"}`;

    // Backdrop
    const backdrop = show.backdrop_path ? `${IMG_ORIG}${show.backdrop_path}` : "";
    const backdropEl = $("#detail-backdrop");
    if (backdropEl && backdrop) {
      backdropEl.style.backgroundImage = `url(${backdrop})`;
    }

    // Header
    const headerEl = $("#detail-header");
    if (headerEl) {
      const genres = (show.genres || []).map(g =>
        `<span class="genre-pill">${esc(g.name)}</span>`
      ).join("");
      const rating = show.vote_average ? show.vote_average.toFixed(1) : "N/A";
      const inList = MyList.has(show.id, "tv");

      headerEl.innerHTML = `
        <h1 class="detail-title">${esc(show.name || "")}</h1>
        <div class="detail-meta">
          <span class="rating-badge">
            <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            ${esc(rating)}
          </span>
          <span>${year(show.first_air_date)}</span>
          ${show.number_of_seasons ? `<span>${show.number_of_seasons} Season${show.number_of_seasons !== 1 ? "s" : ""}</span>` : ""}
          ${genres}
        </div>
        <p class="detail-overview">${esc(show.overview || "")}</p>
        <button class="detail-list-btn ${inList ? "in-list" : ""}" id="detail-list-btn">
          ${inList
            ? `<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M20 6L9 17l-5-5"/></svg> In My List`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add to My List`
          }
        </button>
      `;

      const listBtn = headerEl.querySelector("#detail-list-btn");
      listBtn.addEventListener("click", () => {
        const added = MyList.toggle({
          id: show.id, type: "tv",
          title: show.name,
          poster: show.poster_path
        });
        listBtn.className = `detail-list-btn ${added ? "in-list" : ""}`;
        listBtn.innerHTML = added
          ? `<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M20 6L9 17l-5-5"/></svg> In My List`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add to My List`;
      });
    }

    // Player
    function loadPlayer(season, episode) {
      const pc = $("#player-container");
      if (pc) {
        pc.innerHTML = `<iframe src="${VIDKING_TV(id, season, episode)}" allowfullscreen allow="autoplay; fullscreen"></iframe>`;
      }
      // Update URL
      const url = new URL(location.href);
      url.searchParams.set("season", season);
      url.searchParams.set("episode", episode);
      history.replaceState(null, "", url.toString());
    }

    loadPlayer(currentSeason, currentEpisode);

    // Season/episode selector
    const seasons = (show.seasons || []).filter(s => s.season_number > 0);
    if (seasons.length > 0) {
      const episodeSelector = $("#episode-selector");
      const seasonSelect    = $("#season-select");
      const episodesGrid    = $("#episodes-grid");

      if (episodeSelector && seasonSelect && episodesGrid) {
        episodeSelector.style.display = "";

        seasons.forEach(s => {
          const opt = document.createElement("option");
          opt.value = s.season_number;
          opt.textContent = `Season ${s.season_number}`;
          if (s.season_number === currentSeason) opt.selected = true;
          seasonSelect.appendChild(opt);
        });

        async function loadEpisodes(seasonNum) {
          episodesGrid.innerHTML = `<div class="spinner" style="margin:20px auto;"></div>`;
          try {
            const seasonData = await tmdb(`/tv/${id}/season/${seasonNum}`);
            const episodes   = seasonData.episodes || [];
            episodesGrid.innerHTML = "";
            episodes.forEach(ep => {
              const thumb = ep.still_path ? `${IMG_W500}${ep.still_path}` : "";
              const card  = document.createElement("div");
              card.className = `episode-card${ep.episode_number === currentEpisode && seasonNum === currentSeason ? " active" : ""}`;
              card.innerHTML = `
                ${thumb
                  ? `<img class="episode-thumb" src="${esc(thumb)}" alt="Episode ${ep.episode_number}" loading="lazy" />`
                  : `<div class="episode-thumb" style="background:var(--surface);flex:0 0 120px;"></div>`
                }
                <div class="episode-info">
                  <div class="episode-num">Episode ${ep.episode_number}</div>
                  <div class="episode-title">${esc(ep.name || "")}</div>
                  <div class="episode-desc">${esc(ep.overview || "No description available.")}</div>
                </div>
              `;
              card.addEventListener("click", () => {
                currentSeason  = seasonNum;
                currentEpisode = ep.episode_number;
                $$(".episode-card").forEach(c => c.classList.remove("active"));
                card.classList.add("active");
                loadPlayer(currentSeason, currentEpisode);
                // Scroll to player
                const pc = $("#player-container");
                if (pc) pc.scrollIntoView({ behavior: "smooth", block: "start" });
              });
              episodesGrid.appendChild(card);
            });
          } catch (_) {
            episodesGrid.innerHTML = `<p style="color:var(--text-muted);padding:12px;">Failed to load episodes.</p>`;
          }
        }

        loadEpisodes(currentSeason);

        seasonSelect.addEventListener("change", () => {
          currentSeason  = parseInt(seasonSelect.value, 10);
          currentEpisode = 1;
          loadEpisodes(currentSeason);
          loadPlayer(currentSeason, currentEpisode);
        });
      }
    }

    // Detail info
    const detailInfo = $("#detail-info");
    if (detailInfo) {
      detailInfo.innerHTML = `
        <div class="detail-info-grid">
          ${show.status   ? `<div class="info-item"><label>Status</label><span>${esc(show.status)}</span></div>` : ""}
          ${show.type     ? `<div class="info-item"><label>Type</label><span>${esc(show.type)}</span></div>` : ""}
          ${show.number_of_episodes ? `<div class="info-item"><label>Episodes</label><span>${show.number_of_episodes}</span></div>` : ""}
          ${show.original_language  ? `<div class="info-item"><label>Language</label><span>${esc(show.original_language.toUpperCase())}</span></div>` : ""}
          ${show.networks && show.networks[0] ? `<div class="info-item"><label>Network</label><span>${esc(show.networks[0].name)}</span></div>` : ""}
        </div>
      `;
    }

    // Cast
    const cast = (show.credits && show.credits.cast || []).slice(0, 20);
    if (cast.length > 0) {
      const castSection = $("#cast-section");
      const castRow     = $("#cast-row");
      if (castSection && castRow) {
        castSection.style.display = "";
        cast.forEach(actor => {
          const img = actor.profile_path
            ? `<img class="cast-img" src="${IMG_W500}${actor.profile_path}" alt="${esc(actor.name)}" loading="lazy" />`
            : `<div class="cast-img" style="background:var(--bg4);border-radius:var(--radius-sm);"></div>`;
          const card = document.createElement("div");
          card.className = "cast-card";
          card.innerHTML = `
            ${img}
            <div class="cast-name">${esc(actor.name)}</div>
            <div class="cast-char">${esc(actor.character || "")}</div>
          `;
          castRow.appendChild(card);
        });
      }
    }

    // Similar
    const similar = (show.similar && show.similar.results || []).slice(0, 20);
    if (similar.length > 0) {
      const simSection = $("#similar-section");
      const simRow     = $("#similar-row");
      if (simSection && simRow) {
        simSection.style.display = "";
        similar.forEach(item => simRow.appendChild(buildMovieCard(item, "tv")));
      }
    }

  } catch (err) {
    console.error("TV detail error:", err);
    const h = $("#detail-header");
    if (h) h.innerHTML = `<p style="color:var(--text-muted)">Failed to load show details. Please try again.</p>`;
  }
}

// ============================================================
//  SEARCH PAGE
// ============================================================
function initSearchPage() {
  initNavbar();

  const mainInput   = $("#main-search-input");
  const clearBtn    = $("#search-clear");
  const statusEl    = $("#search-status");
  const resultsEl   = $("#search-results");
  const filterBtns  = $$(".filter-btn");

  const params      = new URLSearchParams(location.search);
  const initialQ    = params.get("q") || "";
  const initialType = params.get("type") || "all";

  let currentFilter = initialType !== "all" ? initialType : "all";
  let searchTimer   = null;
  let lastQuery     = "";

  // Set initial filter
  filterBtns.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.filter === currentFilter);
  });

  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      currentFilter = btn.dataset.filter;
      filterBtns.forEach(b => b.classList.toggle("active", b === btn));
      if (lastQuery) doSearch(lastQuery);
      else if (currentFilter !== "all") doSearch("");
    });
  });

  if (mainInput) {
    mainInput.value = initialQ;
    mainInput.addEventListener("input", () => {
      const q = mainInput.value.trim();
      clearBtn.style.display = q ? "flex" : "none";
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => doSearch(q), 500);
    });
    // Auto-search on load
    if (initialQ) {
      clearBtn.style.display = "flex";
      doSearch(initialQ);
    } else if (currentFilter !== "all") {
      doSearch("");
    } else {
      showDefaultState();
    }
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      mainInput.value = "";
      clearBtn.style.display = "none";
      mainInput.focus();
      showDefaultState();
    });
  }

  function showDefaultState() {
    statusEl.textContent = "";
    resultsEl.innerHTML = `
      <div class="no-results">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <h3>Search PrimeTime</h3>
        <p>Find movies and TV shows</p>
      </div>
    `;
  }

  async function doSearch(query) {
    lastQuery = query;

    if (!query && currentFilter === "all") {
      showDefaultState();
      return;
    }

    statusEl.textContent = "Searching…";
    resultsEl.innerHTML = "";

    // Show skeleton
    const grid = resultsEl;
    for (let i = 0; i < 12; i++) {
      const s = document.createElement("div");
      s.className = "skeleton-card skeleton";
      s.style.aspectRatio = "2/3";
      grid.appendChild(s);
    }

    try {
      let items = [];

      if (query) {
        let searchPath = "/search/multi";
        if (currentFilter === "movie") searchPath = "/search/movie";
        else if (currentFilter === "tv")    searchPath = "/search/tv";

        const data = await tmdb(`${searchPath}?query=${encodeURIComponent(query)}&page=1`);
        items = data.results || [];
      } else {
        // Browse by type
        const path = currentFilter === "movie" ? "/movie/popular" : "/tv/popular";
        const data = await tmdb(`${path}`);
        items = data.results || [];
      }

      // Filter
      if (currentFilter !== "all" && query) {
        items = items.filter(i => (i.media_type || currentFilter) === currentFilter);
      }

      resultsEl.innerHTML = "";

      if (items.length === 0) {
        statusEl.textContent = "";
        resultsEl.innerHTML = `
          <div class="no-results" style="grid-column:1/-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <h3>No results found</h3>
            <p>Try a different search term or browse our categories on the home page.</p>
          </div>
        `;
        return;
      }

      statusEl.textContent = query
        ? `${items.length} result${items.length !== 1 ? "s" : ""} for "${query}"`
        : `Showing popular ${currentFilter === "tv" ? "TV shows" : "movies"}`;

      items.forEach(item => {
        const type     = item.media_type || currentFilter;
        const id       = item.id;
        const title    = item.title || item.name || "Untitled";
        const poster   = posterUrl(item.poster_path);
        const date     = item.release_date || item.first_air_date || "";
        const rating   = item.vote_average ? item.vote_average.toFixed(1) : "";
        const href     = type === "tv" ? `tv.html?id=${id}` : `movie.html?id=${id}`;

        const card = document.createElement("div");
        card.className = "search-card fade-in";
        card.innerHTML = `
          ${poster
            ? `<img src="${esc(poster)}" alt="${esc(title)}" loading="lazy" />`
            : `<div class="no-poster">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                 No Image
               </div>`
          }
          <div class="search-card-info">
            <div class="search-card-title">${esc(title)}</div>
            <div class="search-card-meta">
              <span class="type-badge ${type === "tv" ? "tv" : "movie"}">${type === "tv" ? "TV" : "Movie"}</span>
              ${year(date)}
              ${rating ? `· ⭐ ${rating}` : ""}
            </div>
          </div>
        `;
        card.addEventListener("click", () => { location.href = href; });
        resultsEl.appendChild(card);
      });

    } catch (err) {
      console.error("Search error:", err);
      resultsEl.innerHTML = `<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:40px">Search failed. Please try again.</p>`;
      statusEl.textContent = "";
    }
  }
}

setInterval(() => {
  document.querySelectorAll("iframe").forEach(f => {
    try {
      const doc = f.contentDocument || f.contentWindow.document;
      doc.querySelectorAll('[class*="ad"], [id*="ad"]').forEach(e => e.remove());
    } catch {}
  });
}, 2000);


// ============================================================
//  BOOT
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  switch (PAGE) {
    case "home":   initHomePage();   break;
    case "movie":  initMoviePage();  break;
    case "tv":     initTvPage();     break;
    case "search": initSearchPage(); break;
  }
});
