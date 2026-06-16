// ==========================================================================
// Application State
// ==========================================================================
let allReleases = [];
let filteredReleases = [];
let currentFilter = 'all';
let searchQuery = '';
let currentSort = 'newest';
let selectedRelease = null;

// DOM Elements
const releaseListEl = document.getElementById('release-list');
const searchInputEl = document.getElementById('search-input');
const sortSelectEl = document.getElementById('sort-select');
const filterBadgesEl = document.getElementById('filter-badges');
const refreshBtnEl = document.getElementById('refresh-btn');
const exportCsvBtnEl = document.getElementById('export-csv-btn');
const themeToggleBtnEl = document.getElementById('theme-toggle');
const resultsCountEl = document.getElementById('results-count');

// Metrics DOM Elements
const totalCountEl = document.getElementById('metric-total-count');
const featuresCountEl = document.getElementById('metric-features-count');
const changesCountEl = document.getElementById('metric-changes-count');
const issuesCountEl = document.getElementById('metric-issues-count');

// Tweet Modal DOM Elements
const tweetModalEl = document.getElementById('tweet-modal');
const tweetTextareaEl = document.getElementById('tweet-textarea');
const charCountEl = document.getElementById('char-count');
const copyTweetBtnEl = document.getElementById('copy-tweet-btn');
const sendTweetBtnEl = document.getElementById('send-tweet-btn');
const closeModalBtnEl = document.getElementById('close-modal-btn');

// Toast Notification DOM Element
const toastEl = document.getElementById('toast');

// ==========================================================================
// Event Listeners & Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  
  // Search and Sort inputs
  searchInputEl.addEventListener('input', handleSearch);
  sortSelectEl.addEventListener('change', handleSortChange);
  
  // Filter badges
  filterBadgesEl.addEventListener('click', handleFilterClick);
  
  // Refresh button
  refreshBtnEl.addEventListener('click', () => fetchReleases(true));
  
  // Export CSV button
  exportCsvBtnEl.addEventListener('click', exportToCSV);
  
  // Modal closing
  closeModalBtnEl.addEventListener('click', closeTweetModal);
  tweetModalEl.addEventListener('click', (e) => {
    if (e.target === tweetModalEl) closeTweetModal();
  });
  
  // Tweet modal actions
  tweetTextareaEl.addEventListener('input', updateCharCount);
  copyTweetBtnEl.addEventListener('click', copyTweetToClipboard);
  sendTweetBtnEl.addEventListener('click', openTwitterIntent);

  // Theme Toggle Logic
  const sunIcon = themeToggleBtnEl.querySelector('.sun-icon');
  const moonIcon = themeToggleBtnEl.querySelector('.moon-icon');

  // Check saved theme
  const savedTheme = localStorage.getItem('theme') || 'dark';
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    sunIcon.style.display = 'none';
    moonIcon.style.display = 'inline-block';
  }

  themeToggleBtnEl.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    
    if (isLight) {
      sunIcon.style.display = 'none';
      moonIcon.style.display = 'inline-block';
      showToast('Modo claro activado');
    } else {
      sunIcon.style.display = 'inline-block';
      moonIcon.style.display = 'none';
      showToast('Modo oscuro activado');
    }
  });
});

// ==========================================================================
// API Interaction
// ==========================================================================
async function initApp() {
  await fetchReleases(false);
}

async function fetchReleases(refresh = false) {
  // Show loading state
  showLoadingState();
  if (refresh) {
    refreshBtnEl.classList.add('loading');
    refreshBtnEl.disabled = true;
  }
  
  try {
    const url = `/api/releases${refresh ? '?refresh=true' : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.success) {
      allReleases = data.releases;
      
      // Calculate dashboard metrics
      updateMetrics();
      
      // Filter, Sort and Render
      applyFiltersAndRender();
      
      if (refresh) {
        showToast('¡Notas de lanzamiento actualizadas!');
      }
    } else {
      showErrorState(data.error || 'Ocurrió un error al cargar las notas.');
    }
  } catch (err) {
    console.error('Error fetching release notes:', err);
    showErrorState('No se pudieron obtener las notas. Verifica tu conexión o el servidor Flask.');
  } finally {
    // Hide loading state
    refreshBtnEl.classList.remove('loading');
    refreshBtnEl.disabled = false;
  }
}

// ==========================================================================
// Dashboard Logic (Search, Filter, Sort)
// ==========================================================================
function updateMetrics() {
  totalCountEl.textContent = allReleases.length;
  
  const features = allReleases.filter(r => r.type.toLowerCase() === 'feature').length;
  const changes = allReleases.filter(r => r.type.toLowerCase() === 'change').length;
  const issues = allReleases.filter(r => ['issue', 'deprecation'].includes(r.type.toLowerCase())).length;
  
  featuresCountEl.textContent = features;
  changesCountEl.textContent = changes;
  issuesCountEl.textContent = issues;
}

function handleSearch(e) {
  searchQuery = e.target.value.toLowerCase().trim();
  applyFiltersAndRender();
}

function handleSortChange(e) {
  currentSort = e.target.value;
  applyFiltersAndRender();
}

function handleFilterClick(e) {
  const badge = e.target.closest('.filter-badge');
  if (!badge) return;
  
  // Update active state of badges
  document.querySelectorAll('.filter-badge').forEach(b => b.classList.remove('active'));
  badge.classList.add('active');
  
  currentFilter = badge.getAttribute('data-type');
  applyFiltersAndRender();
}

function applyFiltersAndRender() {
  // 1. Filter by Type
  filteredReleases = allReleases.filter(release => {
    if (currentFilter === 'all') return true;
    return release.type.toLowerCase() === currentFilter.toLowerCase();
  });
  
  // 2. Filter by Search Query
  if (searchQuery) {
    filteredReleases = filteredReleases.filter(release => {
      return (
        release.date.toLowerCase().includes(searchQuery) ||
        release.type.toLowerCase().includes(searchQuery) ||
        release.plain_text.toLowerCase().includes(searchQuery)
      );
    });
  }
  
  // 3. Sort
  filteredReleases.sort((a, b) => {
    // Convert Atom ISO 8601 date string to compare
    const dateA = new Date(a.updated || a.date);
    const dateB = new Date(b.updated || b.date);
    
    if (currentSort === 'newest') {
      return dateB - dateA;
    } else {
      return dateA - dateB;
    }
  });
  
  // Update UI results count
  resultsCountEl.textContent = `${filteredReleases.length} actualización${filteredReleases.length !== 1 ? 'es' : ''}`;
  
  // Render
  renderFeed();
}

// ==========================================================================
// UI Rendering
// ==========================================================================
function renderFeed() {
  releaseListEl.innerHTML = '';
  
  if (filteredReleases.length === 0) {
    releaseListEl.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24">
          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
        <h3>No se encontraron resultados</h3>
        <p>Prueba a buscar otro término o cambia tus filtros de tipo.</p>
      </div>
    `;
    return;
  }
  
  filteredReleases.forEach(release => {
    const card = document.createElement('div');
    card.className = 'release-card';
    card.setAttribute('data-type', release.type);
    card.setAttribute('id', `card-${release.id}`);
    
    // Determine type class for badge styling
    let typeClass = 'default';
    const typeLower = release.type.toLowerCase();
    if (typeLower === 'feature') typeClass = 'feature';
    else if (typeLower === 'change') typeClass = 'change';
    else if (typeLower === 'issue') typeClass = 'issue';
    else if (typeLower === 'deprecation') typeClass = 'deprecation';
    
    card.innerHTML = `
      <div class="card-top">
        <div class="meta-group">
          <span class="release-date">${release.date}</span>
          <span class="type-badge ${typeClass}">${release.type}</span>
        </div>
        <div class="card-actions">
          <button class="btn btn-secondary btn-sm" style="font-size: 0.8rem; padding: 6px 12px; display: inline-flex; align-items: center; gap: 4px;" onclick="event.stopPropagation(); copyCardText('${release.id}')">
            <svg style="width: 14px; height: 14px; fill: currentColor;" viewBox="0 0 24 24">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
            Copiar
          </button>
          <button class="btn btn-tweet btn-sm" onclick="event.stopPropagation(); openTweetSetup('${release.id}')">
            <svg style="width: 14px; height: 14px; fill: currentColor;" viewBox="0 0 24 24">
              <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
            </svg>
            Tuitear
          </button>
        </div>
      </div>
      <div class="card-content">
        ${release.description}
      </div>
      <div class="card-footer">
        <a href="${release.link}" target="_blank" class="feed-source-link">
          Ver en Google Cloud Release Notes
          <svg viewBox="0 0 24 24">
            <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41 9.83-9.83V10h2V3h-7z"/>
          </svg>
        </a>
      </div>
    `;
    
    // Add click listener to select a card visually
    card.addEventListener('click', () => {
      document.querySelectorAll('.release-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
    });
    
    releaseListEl.appendChild(card);
  });
}

function showLoadingState() {
  releaseListEl.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = 'release-card skeleton-card';
    releaseListEl.appendChild(skeleton);
  }
}

function showErrorState(message) {
  releaseListEl.innerHTML = `
    <div class="empty-state" style="border-color: var(--color-issue-border);">
      <svg style="fill: var(--color-issue);" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>
      <h3 style="color: var(--color-issue);">Error de Carga</h3>
      <p>${message}</p>
      <button class="btn btn-secondary" style="margin-top: 15px;" onclick="fetchReleases(true)">Reintentar</button>
    </div>
  `;
}

// ==========================================================================
// Tweet Functionality & Modal Logic
// ==========================================================================
function openTweetSetup(id) {
  const release = allReleases.find(r => r.id === id);
  if (!release) return;
  
  selectedRelease = release;
  
  // Format standard draft
  const draft = generateTweetDraft(release);
  
  tweetTextareaEl.value = draft;
  updateCharCount();
  
  // Show modal
  tweetModalEl.classList.add('active');
}

function closeTweetModal() {
  tweetModalEl.classList.remove('active');
  selectedRelease = null;
}

function generateTweetDraft(release) {
  const date = release.date;
  const type = release.type;
  const rawText = release.plain_text;
  
  // Design elements of the tweet
  const intro = `📢 BigQuery: ${type} (${date})\n\n`;
  const hashtags = `\n\n#BigQuery #GCP #DataEngineering`;
  
  // Shorten the link (we can use the exact link provided in the Atom feed)
  // Usually the link is like: https://docs.cloud.google.com/bigquery/docs/release-notes#June_15_2026
  const linkText = release.link ? `\n🔗 ${release.link}` : '';
  
  // Twitter allows 280 characters. Let's compute characters available for description
  const reservedChars = intro.length + hashtags.length + linkText.length;
  const availableChars = 280 - reservedChars;
  
  let desc = rawText;
  if (desc.length > availableChars) {
    // Truncate description with space for ellipsis
    desc = desc.substring(0, availableChars - 4) + '...';
  }
  
  return `${intro}${desc}${linkText}${hashtags}`;
}

function updateCharCount() {
  const length = tweetTextareaEl.value.length;
  charCountEl.textContent = `${length}/280`;
  
  charCountEl.className = 'character-count';
  if (length > 250 && length <= 280) {
    charCountEl.classList.add('warning');
  } else if (length > 280) {
    charCountEl.classList.add('danger');
  }
  
  // Disable or enable tweet trigger
  sendTweetBtnEl.disabled = length > 280 || length === 0;
}

async function copyTweetToClipboard() {
  const tweetText = tweetTextareaEl.value;
  try {
    await navigator.clipboard.writeText(tweetText);
    showToast('¡Texto copiado al portapapeles!');
  } catch (err) {
    console.error('Failed to copy text: ', err);
    showToast('Error al copiar el texto.');
  }
}

function openTwitterIntent() {
  const tweetText = tweetTextareaEl.value;
  if (tweetText.length > 280) return;
  
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
  window.open(twitterUrl, '_blank');
  closeTweetModal();
}

// ==========================================================================
// Toast Notifications
// ==========================================================================
function showToast(message) {
  // Clear any existing timeout
  if (window.toastTimeout) {
    clearTimeout(window.toastTimeout);
  }
  
  toastEl.querySelector('.toast-text').textContent = message;
  toastEl.classList.add('show');
  
  window.toastTimeout = setTimeout(() => {
    toastEl.classList.remove('show');
  }, 3000);
}

// ==========================================================================
// Copy Individual Card Text & Export CSV Utilities
// ==========================================================================
async function copyCardText(id) {
  const release = allReleases.find(r => r.id === id);
  if (!release) return;
  try {
    await navigator.clipboard.writeText(release.plain_text);
    showToast('¡Texto de la nota copiado!');
  } catch (err) {
    console.error('Failed to copy card text: ', err);
    showToast('Error al copiar el texto.');
  }
}

function exportToCSV() {
  if (filteredReleases.length === 0) {
    showToast('No hay datos para exportar.');
    return;
  }
  
  // CSV Headers
  const headers = ['ID', 'Fecha', 'Timestamp', 'Tipo', 'Enlace', 'Texto Plano'];
  
  // Helper to escape CSV values
  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '';
    let formatted = val.toString().replace(/"/g, '""'); // Escape double quotes
    if (formatted.includes(',') || formatted.includes('\n') || formatted.includes('"')) {
      formatted = `"${formatted}"`;
    }
    return formatted;
  };
  
  // Map items to rows
  const rows = filteredReleases.map(r => [
    r.id,
    r.date,
    r.updated,
    r.type,
    r.link,
    r.plain_text
  ]);
  
  // Build CSV content
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');
  
  // Add UTF-8 BOM to support Spanish accents in Excel
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  // Trigger download
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `bigquery_releases_${new Date().toISOString().slice(0,10)}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast('¡CSV exportado con éxito!');
}
