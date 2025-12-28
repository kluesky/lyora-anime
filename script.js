class LyoraAnimeTracker {
    constructor() {
        this.animeData = [];
        this.filteredData = [];
        this.displayData = [];
        this.currentFilter = 'all';
        this.currentSort = 'popularity';
        this.currentPage = 1;
        this.itemsPerPage = 12;
        this.isLoading = false;
        this.hasMoreData = true;
        this.retryCount = 0;
        this.maxRetries = 2;
        
        this.init();
    }
    
    async init() {
        this.showLoading();
        await this.initializeApp();
        this.bindEvents();
        
        // Coba load data dengan retry
        await this.loadAnimeDataWithRetry();
        
        this.setupAutoRefresh();
        this.hideLoading();
    }
    
    async loadAnimeDataWithRetry() {
        for (let i = 0; i < this.maxRetries; i++) {
            try {
                await this.loadAnimeData();
                this.retryCount = 0;
                return;
            } catch (error) {
                this.retryCount++;
                console.log(`Retry ${this.retryCount}/${this.maxRetries}`);
                
                if (this.retryCount >= this.maxRetries) {
                    console.log('All retries failed, using sample data');
                    this.useSampleData();
                    break;
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
    
    showLoading() {
        document.getElementById('loadingScreen').style.display = 'flex';
        document.getElementById('mainContainer').style.display = 'none';
    }
    
    hideLoading() {
        setTimeout(() => {
            document.getElementById('loadingScreen').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('loadingScreen').style.display = 'none';
                document.getElementById('mainContainer').style.display = 'block';
                setTimeout(() => {
                    document.getElementById('mainContainer').style.opacity = '1';
                }, 50);
            }, 500);
        }, 1000);
    }
    
    async initializeApp() {
        this.updateCurrentSeason();
        this.updateLastUpdateTime();
    }
    
    updateCurrentSeason() {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        
        let season;
        if (month >= 1 && month <= 3) season = 'Musim Dingin';
        else if (month >= 4 && month <= 6) season = 'Musim Semi';
        else if (month >= 7 && month <= 9) season = 'Musim Panas';
        else season = 'Musim Gugur';
        
        document.getElementById('current-season').textContent = `${season} ${year}`;
    }
    
    updateLastUpdateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });
        const dateString = now.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        
        document.getElementById('last-update').textContent = `${dateString}, ${timeString}`;
    }
    
    bindEvents() {
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.currentPage = 1;
                this.filterAndSortAnime();
            });
        });
        
        // Sort buttons
        document.querySelectorAll('.sort-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentSort = e.target.dataset.sort;
                this.filterAndSortAnime();
            });
        });
        
        // Search input
        const searchInput = document.getElementById('searchInput');
        const clearSearch = document.getElementById('clearSearch');
        
        searchInput.addEventListener('input', (e) => {
            if (e.target.value.length > 0) {
                clearSearch.style.display = 'block';
            } else {
                clearSearch.style.display = 'none';
            }
            this.currentPage = 1;
            this.filterAndSortAnime();
        });
        
        // Clear search
        clearSearch.addEventListener('click', () => {
            searchInput.value = '';
            clearSearch.style.display = 'none';
            this.currentPage = 1;
            this.filterAndSortAnime();
        });
        
        // Refresh button
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.loadAnimeData();
        });
        
        // Load more button
        document.getElementById('load-more').addEventListener('click', () => {
            this.loadMoreAnime();
        });
        
        // Modal close
        document.getElementById('modal-close').addEventListener('click', () => {
            this.closeModal();
        });
        
        // Close modal on overlay click
        document.getElementById('anime-modal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                this.closeModal();
            }
        });
        
        // Scroll to top button
        document.getElementById('scroll-top').addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
    
    async loadAnimeData() {
        try {
            this.showLoadingState();
            
            // CORS Proxy untuk menghindari error
            const corsProxy = 'https://api.allorigins.win/raw?url=';
            
            // URL API Jikan
            const currentUrl = encodeURIComponent('https://api.jikan.moe/v4/seasons/now?limit=20');
            const upcomingUrl = encodeURIComponent('https://api.jikan.moe/v4/seasons/upcoming?limit=20');
            
            const [currentResponse, upcomingResponse] = await Promise.all([
                fetch(corsProxy + currentUrl).catch(() => fetch('https://api.jikan.moe/v4/seasons/now?limit=20')),
                fetch(corsProxy + upcomingUrl).catch(() => fetch('https://api.jikan.moe/v4/seasons/upcoming?limit=20'))
            ]);
            
            if (!currentResponse.ok || !upcomingResponse.ok) {
                throw new Error('API request failed');
            }
            
            const currentData = await currentResponse.json();
            const upcomingData = await upcomingResponse.json();
            
            if (!currentData.data || !upcomingData.data) {
                throw new Error('Invalid API response');
            }
            
            // Process current season anime
            const currentAnime = currentData.data.map(anime => ({
                ...anime,
                status: 'airing',
                type: 'ongoing'
            }));
            
            // Process upcoming anime
            const upcomingAnime = upcomingData.data.map(anime => ({
                ...anime,
                status: 'upcoming',
                type: 'upcoming'
            }));
            
            // Combine all anime
            this.animeData = [...currentAnime, ...upcomingAnime];
            
            // Remove duplicates
            const seen = new Set();
            this.animeData = this.animeData.filter(anime => {
                const duplicate = seen.has(anime.mal_id);
                seen.add(anime.mal_id);
                return !duplicate;
            });
            
            this.filterAndSortAnime();
            this.updateStats();
            this.updateSeasonStats();
            this.updateLastUpdateTime();
            
            this.showToast(`${this.animeData.length} anime berhasil dimuat!`, 'success');
            
        } catch (error) {
            console.error('Error loading anime data:', error);
            throw error; // Untuk ditangkap oleh retry logic
        }
    }
    
    useSampleData() {
        // Sample data saat API bermasalah
        const sampleData = [
            {
                mal_id: 1,
                title: "One Piece",
                title_english: "One Piece",
                images: {
                    jpg: {
                        image_url: "https://cdn.myanimelist.net/images/anime/6/73245.jpg",
                        large_image_url: "https://cdn.myanimelist.net/images/anime/6/73245.jpg"
                    }
                },
                status: "airing",
                score: 8.71,
                episodes: 1100,
                members: 3260327,
                season: "Fall",
                year: 1999,
                aired: { string: "Fall 1999" }
            },
            {
                mal_id: 2,
                title: "Sousou no Frieren",
                title_english: "Frieren: Beyond Journey's End",
                images: {
                    jpg: {
                        image_url: "https://cdn.myanimelist.net/images/anime/1015/138006.jpg",
                        large_image_url: "https://cdn.myanimelist.net/images/anime/1015/138006.jpg"
                    }
                },
                status: "airing",
                score: 9.37,
                episodes: 28,
                members: 1254893,
                season: "Fall",
                year: 2023,
                aired: { string: "Fall 2023" }
            },
            {
                mal_id: 3,
                title: "Solo Leveling",
                title_english: "Solo Leveling",
                images: {
                    jpg: {
                        image_url: "https://cdn.myanimelist.net/images/anime/1078/141264.jpg",
                        large_image_url: "https://cdn.myanimelist.net/images/anime/1078/141264.jpg"
                    }
                },
                status: "airing",
                score: 8.45,
                episodes: 12,
                members: 987654,
                season: "Winter",
                year: 2024,
                aired: { string: "Winter 2024" }
            },
            {
                mal_id: 4,
                title: "Jujutsu Kaisen 2nd Season",
                title_english: "Jujutsu Kaisen Season 2",
                images: {
                    jpg: {
                        image_url: "https://cdn.myanimelist.net/images/anime/1792/138022.jpg",
                        large_image_url: "https://cdn.myanimelist.net/images/anime/1792/138022.jpg"
                    }
                },
                status: "upcoming",
                score: null,
                episodes: null,
                members: 876543,
                season: "Summer",
                year: 2024,
                aired: { string: "Summer 2024" }
            },
            {
                mal_id: 5,
                title: "Tensei shitara Slime Datta Ken 3rd Season",
                title_english: "That Time I Got Reincarnated as a Slime Season 3",
                images: {
                    jpg: {
                        image_url: "https://cdn.myanimelist.net/images/anime/1908/138709.jpg",
                        large_image_url: "https://cdn.myanimelist.net/images/anime/1908/138709.jpg"
                    }
                },
                status: "upcoming",
                score: null,
                episodes: 12,
                members: 654321,
                season: "Spring",
                year: 2024,
                aired: { string: "Spring 2024" }
            },
            {
                mal_id: 6,
                title: "Kono Subarashii Sekai ni Shukufuku wo! 3",
                title_english: "KONOSUBA -God's blessing on this wonderful world! 3",
                images: {
                    jpg: {
                        image_url: "https://cdn.myanimelist.net/images/anime/1081/140461.jpg",
                        large_image_url: "https://cdn.myanimelist.net/images/anime/1081/140461.jpg"
                    }
                },
                status: "upcoming",
                score: null,
                episodes: null,
                members: 543210,
                season: "Spring",
                year: 2024,
                aired: { string: "Spring 2024" }
            },
            {
                mal_id: 7,
                title: "Kaiju No. 8",
                title_english: "Kaiju No. 8",
                images: {
                    jpg: {
                        image_url: "https://cdn.myanimelist.net/images/anime/1891/138712.jpg",
                        large_image_url: "https://cdn.myanimelist.net/images/anime/1891/138712.jpg"
                    }
                },
                status: "upcoming",
                score: null,
                episodes: null,
                members: 432109,
                season: "Spring",
                year: 2024,
                aired: { string: "Spring 2024" }
            }
        ];
        
        this.animeData = sampleData;
        this.filterAndSortAnime();
        this.updateStats();
        this.updateSeasonStats();
        this.updateLastUpdateTime();
        
        this.showToast(`Menggunakan data contoh (${sampleData.length} anime)`, 'warning');
    }
    
    filterAndSortAnime() {
        let filtered = [...this.animeData];
        
        // Filter by status
        if (this.currentFilter === 'airing') {
            filtered = filtered.filter(a => a.status === 'airing');
        } else if (this.currentFilter === 'upcoming') {
            filtered = filtered.filter(a => a.status === 'upcoming');
        } else if (this.currentFilter === 'today') {
            filtered = filtered.slice(0, 8);
        }
        
        // Filter by search
        const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
        if (searchTerm) {
            filtered = filtered.filter(anime => {
                const title = (anime.title || '').toLowerCase();
                const titleEnglish = (anime.title_english || '').toLowerCase();
                
                return title.includes(searchTerm) || titleEnglish.includes(searchTerm);
            });
        }
        
        // Sort data
        filtered.sort((a, b) => {
            switch (this.currentSort) {
                case 'score':
                    return (b.score || 0) - (a.score || 0);
                case 'title':
                    return (a.title || '').localeCompare(b.title || '');
                case 'newest':
                    const yearA = a.year || 0;
                    const yearB = b.year || 0;
                    return yearB - yearA;
                case 'popularity':
                default:
                    return (b.members || 0) - (a.members || 0);
            }
        });
        
        this.filteredData = filtered;
        this.currentPage = 1;
        this.displayData = filtered.slice(0, this.itemsPerPage);
        this.hasMoreData = this.displayData.length < filtered.length;
        this.renderAnimeCards();
        this.updateDisplayCount();
    }
    
    renderAnimeCards() {
        const container = document.getElementById('anime-container');
        
        if (this.displayData.length === 0) {
            container.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search"></i>
                    <h3>Tidak ada anime ditemukan</h3>
                    <p>Coba gunakan kata kunci lain atau ubah filter</p>
                </div>
            `;
            document.getElementById('load-more').style.display = 'none';
            return;
        }
        
        container.innerHTML = this.displayData.map(anime => {
            let statusText = 'Unknown';
            let statusClass = 'status-finished';
            
            if (anime.status === 'airing') {
                statusText = 'Sedang Tayang';
                statusClass = 'status-airing';
            } else if (anime.status === 'upcoming') {
                statusText = 'Akan Datang';
                statusClass = 'status-upcoming';
            }
            
            let seasonInfo = '';
            if (anime.season && anime.year) {
                seasonInfo = `${anime.season} ${anime.year}`;
            } else if (anime.aired?.string) {
                seasonInfo = anime.aired.string;
            }
            
            return `
                <div class="anime-card" data-id="${anime.mal_id}">
                    <div class="anime-poster-container">
                        <img src="${anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || 'https://via.placeholder.com/300x400?text=Lyora+Anime'}" 
                             alt="${anime.title}" 
                             class="anime-poster">
                        <span class="anime-status-badge ${statusClass}">${statusText}</span>
                    </div>
                    <div class="anime-content">
                        <h3 class="anime-title">${anime.title || 'No Title'}</h3>
                        
                        ${anime.title_english ? `
                            <p class="anime-english">${anime.title_english}</p>
                        ` : ''}
                        
                        ${seasonInfo ? `
                            <p class="anime-season">
                                <i class="fas fa-calendar-alt"></i> ${seasonInfo}
                            </p>
                        ` : ''}
                        
                        <div class="anime-meta">
                            ${anime.score ? `
                                <span class="anime-score">
                                    <i class="fas fa-star"></i> ${anime.score.toFixed(1)}
                                </span>
                            ` : '<span class="anime-score"><i class="fas fa-star"></i> N/A</span>'}
                            
                            ${anime.episodes ? `
                                <span class="anime-episodes">
                                    <i class="fas fa-play-circle"></i> ${anime.episodes} eps
                                </span>
                            ` : '<span class="anime-episodes"><i class="fas fa-play-circle"></i> ? eps</span>'}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Add click event to each card
        document.querySelectorAll('.anime-card').forEach(card => {
            card.addEventListener('click', () => {
                const animeId = parseInt(card.dataset.id);
                const anime = this.animeData.find(a => a.mal_id === animeId);
                if (anime) {
                    this.showAnimeDetails(anime);
                }
            });
        });
        
        // Show/hide load more button
        const loadMoreBtn = document.getElementById('load-more');
        if (this.hasMoreData) {
            loadMoreBtn.style.display = 'inline-flex';
        } else {
            loadMoreBtn.style.display = 'none';
        }
    }
    
    async loadMoreAnime() {
        if (this.isLoading || !this.hasMoreData) return;
        
        this.isLoading = true;
        document.getElementById('load-more').style.display = 'none';
        document.getElementById('loading-more').style.display = 'block';
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        this.currentPage++;
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const newData = this.filteredData.slice(startIndex, endIndex);
        
        this.displayData = [...this.displayData, ...newData];
        this.hasMoreData = endIndex < this.filteredData.length;
        
        this.renderAnimeCards();
        this.updateDisplayCount();
        
        this.isLoading = false;
        document.getElementById('loading-more').style.display = 'none';
    }
    
    updateDisplayCount() {
        document.getElementById('showing-count').textContent = this.displayData.length;
        document.getElementById('total-count').textContent = this.filteredData.length;
    }
    
    updateStats() {
        const totalAnime = this.animeData.length;
        const airingAnime = this.animeData.filter(a => a.status === 'airing').length;
        const upcomingAnime = this.animeData.filter(a => a.status === 'upcoming').length;
        
        document.getElementById('total-anime').textContent = totalAnime.toLocaleString();
        document.getElementById('airing-anime').textContent = airingAnime.toLocaleString();
        document.getElementById('upcoming-anime').textContent = upcomingAnime.toLocaleString();
    }
    
    updateSeasonStats() {
        const currentSeasonAnime = this.animeData.filter(a => a.status === 'airing').length;
        document.getElementById('season-stats').textContent = 
            `${currentSeasonAnime} anime sedang tayang`;
    }
    
    async showAnimeDetails(anime) {
        const modalBody = document.getElementById('modal-body');
        
        modalBody.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i>
                <p style="margin-top: 20px; color: var(--text-secondary);">Memuat detail anime...</p>
            </div>
        `;
        
        document.getElementById('modal-title').textContent = anime.title || 'Detail Anime';
        document.getElementById('anime-modal').style.display = 'flex';
        
        try {
            // Show basic info first
            let airedInfo = 'Tidak tersedia';
            if (anime.aired?.string) {
                airedInfo = anime.aired.string;
            } else if (anime.season && anime.year) {
                airedInfo = `${anime.season} ${anime.year}`;
            }
            
            modalBody.innerHTML = `
                <div class="anime-detail">
                    <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 30px; margin-bottom: 30px;">
                        <div>
                            <img src="${anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || 'https://via.placeholder.com/300x400?text=Lyora+Anime'}" 
                                 alt="${anime.title}"
                                 style="width: 100%; border-radius: 12px; box-shadow: var(--shadow);">
                        </div>
                        
                        <div>
                            <h3 style="color: var(--text); font-size: 1.8rem; margin-bottom: 10px; font-weight: 700;">
                                ${anime.title}
                            </h3>
                            
                            ${anime.title_english ? `
                                <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 1.1rem;">
                                    ${anime.title_english}
                                </p>
                            ` : ''}
                            
                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 25px;">
                                <div>
                                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 5px;">Rating</p>
                                    <p style="color: var(--warning); font-size: 1.3rem; font-weight: 700;">
                                        <i class="fas fa-star"></i> ${anime.score?.toFixed(1) || 'N/A'}/10
                                    </p>
                                </div>
                                
                                <div>
                                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 5px;">Episode</p>
                                    <p style="color: var(--text); font-size: 1.3rem; font-weight: 700;">
                                        <i class="fas fa-play-circle"></i> ${anime.episodes || '?'}
                                    </p>
                                </div>
                                
                                <div>
                                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 5px;">Status</p>
                                    <span class="anime-status-badge ${anime.status === 'airing' ? 'status-airing' : 'status-upcoming'}" 
                                          style="display: inline-block;">
                                        ${anime.status === 'airing' ? 'Sedang Tayang' : 'Akan Datang'}
                                    </span>
                                </div>
                                
                                <div>
                                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 5px;">Tayang</p>
                                    <p style="color: var(--text); font-weight: 500;">${airedInfo}</p>
                                </div>
                            </div>
                            
                            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--glass-border);">
                                <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 10px;">Informasi</p>
                                <p style="color: var(--text);">
                                    ${anime.status === 'airing' ? 
                                        'Anime ini sedang tayang musim ini.' : 
                                        'Anime ini akan segera tayang.'}
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px;">
                        <button onclick="window.lyoraTracker.closeModal()" 
                                style="padding: 12px 40px; background: var(--primary); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 1rem;">
                            <i class="fas fa-times"></i> Tutup
                        </button>
                    </div>
                </div>
            `;
            
        } catch (error) {
            console.error('Error loading anime details:', error);
            modalBody.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: var(--danger);"></i>
                    <p style="margin-top: 20px; color: var(--text-secondary);">Gagal memuat detail lengkap.</p>
                    <button onclick="window.lyoraTracker.closeModal()" 
                            style="margin-top: 20px; padding: 10px 25px; background: var(--primary); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600;">
                        Tutup
                    </button>
                </div>
            `;
        }
    }
    
    closeModal() {
        document.getElementById('anime-modal').style.display = 'none';
    }
    
    showLoadingState() {
        const container = document.getElementById('anime-container');
        container.innerHTML = `
            <div class="no-results">
                <i class="fas fa-spinner fa-spin" style="font-size: 3rem; color: var(--primary);"></i>
                <p style="margin-top: 20px; color: var(--text-secondary);">Memuat data anime...</p>
            </div>
        `;
        
        document.getElementById('load-more').style.display = 'none';
    }
    
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toast-message');
        
        toastMessage.textContent = message;
        
        toast.className = 'toast';
        if (type === 'error') {
            toast.classList.add('error');
        } else if (type === 'warning') {
            toast.classList.add('warning');
        }
        
        toast.style.display = 'flex';
        
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }
    
    setupAutoRefresh() {
        setInterval(() => {
            if (this.retryCount === 0) { // Only auto-refresh if not in error state
                this.loadAnimeData();
            }
        }, 5 * 60 * 1000);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.lyoraTracker = new LyoraAnimeTracker();
});