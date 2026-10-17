document.addEventListener('DOMContentLoaded', () => {
    function setupAutocomplete(inputId, dropdownId) {
        const searchInput = document.getElementById(inputId);
        const searchBar = document.getElementById(dropdownId);
        let debounceTimer;
        if (!searchInput || !searchBar) return;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            const query = searchInput.value.trim();
            if (query.length < 2) {
                searchBar.innerHTML = '';
                searchBar.style.display = 'none';
                return;
            }
            debounceTimer = setTimeout(() => {
                fetchSuggestions(query, searchBar);
            }, 300);
        });
        searchBar.addEventListener('click', (e) => {
            const item = e.target.closest('.suggestion-item');
            if (item) {
                const animeId = item.dataset.id;
                searchBar.innerHTML = '';
                searchBar.style.display = 'none';
                window.location.href = `/anime/${animeId}`; 
            }
        });
    }
    async function fetchSuggestions(query, searchBarContainer) {
        try {
            const response = await fetch(`https://rranime.online/api/anime-suggestions?q=${encodeURIComponent(query)}`);
            const animeList = await response.json();
            if (!Array.isArray(animeList) || animeList.length === 0) {
                searchBarContainer.style.display = 'none';
                return;
            }
            searchBarContainer.innerHTML = animeList.map(anime => `
                <div class="suggestion-item" data-id="${anime.mal_id}" data-title="${anime.title}">
                    <img src="${anime.image_url}" alt="${anime.title}" class="suggestion-thumb">
                    <div class="suggestion-info">
                        <span class="suggestion-title">${anime.title}</span>
                        <small class="suggestion-meta">${anime.type} • ⭐ ${anime.score || 'N/A'}</small>
                    </div>
                </div>
            `).join('');
            searchBarContainer.style.display = 'block';
        } catch (error) {
            console.error('Error fetching anime suggestions:', error);
        }
    }
    setupAutocomplete('anime-search-input-pc', 'search-suggestions-pc');
    setupAutocomplete('anime-search-input-mobile', 'search-suggestions-mobile');
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.drawer-search-wrapper1') && !e.target.closest('.drawer-search-wrapper2')) {
            const pcDropdown = document.getElementById('search-suggestions-pc');
            const mobileDropdown = document.getElementById('search-suggestions-mobile');
            if (pcDropdown) pcDropdown.style.display = 'none';
            if (mobileDropdown) mobileDropdown.style.display = 'none';
        }
    });
});