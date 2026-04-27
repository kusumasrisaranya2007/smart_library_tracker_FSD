/**
 * SMART LIBRARY TRACKER - GLITCH_OS SCRIPT
 * ARCHITECT: Kusuma Sri Saranya
 */

class SmartLibrary {
    constructor() {
        this.initData();
        this.cacheDOM();
        this.bindEvents();
        this.startClock();
        this.initCharts();
        this.renderAll();
        this.checkOverdue();
    }

    initData() {
        // Core Data Structures
        this.books = JSON.parse(localStorage.getItem('lib_books')) || [];
        this.borrowers = JSON.parse(localStorage.getItem('lib_borrowers')) || [];
        this.categories = JSON.parse(localStorage.getItem('lib_categories')) || ['Fiction', 'Science', 'History', 'Technology', 'Art'];
        this.transactions = JSON.parse(localStorage.getItem('lib_transactions')) || [];
        this.activity = JSON.parse(localStorage.getItem('lib_activity')) || [];
        this.settings = JSON.parse(localStorage.getItem('lib_settings')) || {
            fineRate: 5,
            theme: 'dark'
        };

        // If no categories, save defaults
        if (!localStorage.getItem('lib_categories')) {
            this.save('categories');
        }
    }

    cacheDOM() {
        // Navigation
        this.sections = document.querySelectorAll('.content-section');
        this.navLinks = document.querySelectorAll('.nav-links li');
        
        // Forms
        this.bookForm = document.getElementById('book-form');
        this.borrowerForm = document.getElementById('borrower-form');
        this.categoryForm = document.getElementById('category-form');
        this.borrowForm = document.getElementById('borrow-form');
        
        // Displays
        this.booksTable = document.getElementById('books-body');
        this.borrowersTable = document.getElementById('borrowers-body');
        this.finesTable = document.getElementById('fines-body');
        this.categoryList = document.getElementById('category-list');
        this.activityList = document.getElementById('recent-activity');
        
        // Stats
        this.stats = {
            totalBooks: document.getElementById('stat-total-books'),
            availableBooks: document.getElementById('stat-available-books'),
            borrowedBooks: document.getElementById('stat-borrowed-books'),
            overdueBooks: document.getElementById('stat-overdue-books'),
            borrowersCount: document.getElementById('stat-borrowers-count'),
            fineAmount: document.getElementById('stat-fine-amount'),
            
            // Progress bars
            availableProgress: document.getElementById('stat-available-progress'),
            borrowedProgress: document.getElementById('stat-borrowed-progress'),
            overdueProgress: document.getElementById('stat-overdue-progress'),
            borrowersProgress: document.getElementById('stat-borrowers-progress'),
            finesProgress: document.getElementById('stat-fines-progress')
        };
    }

    bindEvents() {
        // Navigation Click
        this.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.showSection(link.dataset.section);
            });
        });

        // Splash screen start
        document.getElementById('start-btn').addEventListener('click', () => {
            document.getElementById('splash-screen').classList.add('fade-out');
            document.getElementById('main-app').classList.remove('hidden');
            this.logActivity('SYSTEM INITIALIZED');
        });

        // Form Submissions
        this.bookForm.addEventListener('submit', (e) => { e.preventDefault(); this.handleBookSubmit(); });
        this.borrowerForm.addEventListener('submit', (e) => { e.preventDefault(); this.handleBorrowerSubmit(); });
        this.categoryForm.addEventListener('submit', (e) => { e.preventDefault(); this.handleCategorySubmit(); });
        this.borrowForm.addEventListener('submit', (e) => { e.preventDefault(); this.handleBorrowSubmit(); });

        // Search Events
        document.getElementById('book-search').addEventListener('input', (e) => this.filterBooks(e.target.value));
        document.getElementById('borrower-search').addEventListener('input', (e) => this.filterBorrowers(e.target.value));
        document.getElementById('global-search').addEventListener('input', (e) => this.handleGlobalSearch(e.target.value));
        
        // Category Filter
        document.getElementById('book-category-filter').addEventListener('change', (e) => this.filterBooksByCategory(e.target.value));

        // Return Search
        document.getElementById('return-search').addEventListener('input', (e) => this.handleReturnSearch(e.target.value));

        // Modals - Close logic
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
        });

        // Theme Toggle
        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());

        // Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'k') {
                e.preventDefault();
                document.getElementById('global-search').focus();
            }
        });

        // Export CSV
        document.getElementById('export-csv-btn').addEventListener('click', () => this.exportToCSV());
        
        // Clear Data
        document.getElementById('clear-data-btn').addEventListener('click', () => this.wipeMemory());

        // Settings
        document.getElementById('setting-fine-rate').addEventListener('change', (e) => {
            this.settings.fineRate = parseFloat(e.target.value);
            this.save('settings');
            this.toast('Fine rate updated', 'success');
        });
    }

    // --- Core Logic ---

    save(key) {
        localStorage.setItem(`lib_${key}`, JSON.stringify(this[key]));
    }

    showSection(sectionId) {
        this.sections.forEach(s => s.classList.remove('active'));
        this.navLinks.forEach(l => l.classList.remove('active'));
        
        const targetSection = document.getElementById(sectionId);
        const targetLink = document.querySelector(`[data-section="${sectionId}"]`);
        
        if (targetSection) targetSection.classList.add('active');
        if (targetLink) targetLink.classList.add('active');

        if (sectionId === 'reports') this.updateCharts();
        if (sectionId === 'dashboard') this.updateStats();
    }

    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
        // Reset form if it's a "New" operation
        if (modalId === 'book-modal') {
            const select = document.getElementById('book-category');
            select.innerHTML = this.categories.map(c => `<option value="${c}">${c}</option>`).join('');
        }
    }

    closeModals() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
        this.bookForm.reset();
        this.borrowerForm.reset();
        document.getElementById('edit-book-id').value = '';
        document.getElementById('edit-borrower-id').value = '';
    }

    // --- Book Management ---

    handleBookSubmit() {
        const id = document.getElementById('edit-book-id').value;
        const bookData = {
            id: id || Date.now().toString(),
            title: document.getElementById('book-title').value,
            author: document.getElementById('book-author').value,
            category: document.getElementById('book-category').value,
            isbn: document.getElementById('book-isbn').value,
            qty: parseInt(document.getElementById('book-qty').value),
            availableQty: parseInt(document.getElementById('book-qty').value),
            cover: document.getElementById('book-cover').value || 'https://via.placeholder.com/150x225?text=No+Cover'
        };

        if (id) {
            const index = this.books.findIndex(b => b.id === id);
            // Adjust availableQty based on difference in total qty
            const diff = bookData.qty - this.books[index].qty;
            bookData.availableQty = this.books[index].availableQty + diff;
            this.books[index] = bookData;
            this.toast('Book protocols updated', 'success');
        } else {
            this.books.push(bookData);
            this.toast('New unit registered', 'success');
        }

        this.save('books');
        this.renderBooks();
        this.updateStats();
        this.updateCategoryFilter();
        this.logActivity(`Book ${bookData.title} added/updated`);
        this.closeModals();
    }

    deleteBook(id) {
        if (confirm('ERASE UNIT FROM DATABASE?')) {
            this.books = this.books.filter(b => b.id !== id);
            this.save('books');
            this.renderBooks();
            this.updateStats();
            this.toast('Unit purged', 'error');
        }
    }

    editBook(id) {
        const book = this.books.find(b => b.id === id);
        if (!book) return;

        this.openModal('book-modal');
        document.getElementById('book-modal-title').innerText = 'UPDATE UNIT';
        document.getElementById('edit-book-id').value = book.id;
        document.getElementById('book-title').value = book.title;
        document.getElementById('book-author').value = book.author;
        document.getElementById('book-isbn').value = book.isbn;
        document.getElementById('book-qty').value = book.qty;
        document.getElementById('book-cover').value = book.cover;
        document.getElementById('book-category').value = book.category;
    }

    // --- Borrower Management ---

    handleBorrowerSubmit() {
        const id = document.getElementById('edit-borrower-id').value;
        const borrowerData = {
            id: id || Date.now().toString(),
            name: document.getElementById('borrower-name').value,
            email: document.getElementById('borrower-email').value,
            phone: document.getElementById('borrower-phone').value,
            mid: document.getElementById('borrower-mid').value,
            history: id ? this.borrowers.find(b => b.id === id).history : []
        };

        if (id) {
            const index = this.borrowers.findIndex(b => b.id === id);
            this.borrowers[index] = borrowerData;
            this.toast('Entity data updated', 'success');
        } else {
            this.borrowers.push(borrowerData);
            this.toast('New entity registered', 'success');
        }

        this.save('borrowers');
        this.renderBorrowers();
        this.updateStats();
        this.logActivity(`Member ${borrowerData.name} registered/updated`);
        this.closeModals();
    }

    deleteBorrower(id) {
        if (confirm('ERASE ENTITY FROM DATABASE?')) {
            this.borrowers = this.borrowers.filter(b => b.id !== id);
            this.save('borrowers');
            this.renderBorrowers();
            this.updateStats();
            this.toast('Entity purged', 'error');
        }
    }

    editBorrower(id) {
        const borrower = this.borrowers.find(b => b.id === id);
        if (!borrower) return;

        this.openModal('borrower-modal');
        document.getElementById('borrower-modal-title').innerText = 'UPDATE ENTITY';
        document.getElementById('edit-borrower-id').value = borrower.id;
        document.getElementById('borrower-name').value = borrower.name;
        document.getElementById('borrower-email').value = borrower.email;
        document.getElementById('borrower-phone').value = borrower.phone;
        document.getElementById('borrower-mid').value = borrower.mid;
    }

    // --- Category Management ---

    handleCategorySubmit() {
        const name = document.getElementById('category-name').value;
        if (this.categories.includes(name)) {
            this.toast('Taxonomy exists', 'error');
            return;
        }
        this.categories.push(name);
        this.save('categories');
        this.renderCategories();
        this.updateCategoryFilter();
        this.toast('Taxonomy expanded', 'success');
        this.closeModals();
    }

    deleteCategory(name) {
        this.categories = this.categories.filter(c => c !== name);
        this.save('categories');
        this.renderCategories();
        this.updateCategoryFilter();
    }

    // --- Transaction Management (Borrow/Return) ---

    handleBorrowSubmit() {
        const memberId = document.getElementById('borrow-member-select').value;
        const bookId = document.getElementById('borrow-book-select').value;
        const dueDate = document.getElementById('borrow-due-date').value;

        const book = this.books.find(b => b.id === bookId);
        if (book.availableQty <= 0) {
            this.toast('Insufficient inventory', 'error');
            return;
        }

        const transaction = {
            id: Date.now().toString(),
            memberId,
            bookId,
            borrowDate: new Date().toISOString(),
            dueDate: new Date(dueDate).toISOString(),
            status: 'borrowed',
            returnDate: null,
            fine: 0
        };

        this.transactions.push(transaction);
        book.availableQty--;
        
        // Add to borrower history
        const borrower = this.borrowers.find(b => b.id === memberId);
        borrower.history.push({
            bookTitle: book.title,
            date: transaction.borrowDate,
            type: 'borrow'
        });

        this.save('transactions');
        this.save('books');
        this.save('borrowers');
        
        this.renderAll();
        this.toast('Transaction executed', 'success');
        this.logActivity(`Book "${book.title}" issued to ${borrower.name}`);
        this.borrowForm.reset();
    }

    handleReturn(transactionId) {
        const trans = this.transactions.find(t => t.id === transactionId);
        const book = this.books.find(b => b.id === trans.bookId);
        const borrower = this.borrowers.find(b => b.id === trans.memberId);

        trans.status = 'returned';
        trans.returnDate = new Date().toISOString();
        book.availableQty++;

        borrower.history.push({
            bookTitle: book.title,
            date: trans.returnDate,
            type: 'return'
        });

        this.save('transactions');
        this.save('books');
        this.save('borrowers');
        
        this.renderAll();
        this.toast('Unit returned to inventory', 'success');
        this.logActivity(`Book "${book.title}" returned by ${borrower.name}`);
    }

    checkOverdue() {
        const today = new Date();
        this.transactions.forEach(t => {
            if (t.status === 'borrowed') {
                const dueDate = new Date(t.dueDate);
                if (today > dueDate) {
                    const diffTime = Math.abs(today - dueDate);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    t.fine = diffDays * this.settings.fineRate;
                }
            }
        });
        this.save('transactions');
        this.renderAll();
    }

    // --- Rendering Functions ---

    renderAll() {
        this.renderBooks();
        this.renderBorrowers();
        this.renderCategories();
        this.renderTransactions();
        this.renderActivity();
        this.updateStats();
        this.updateCategoryFilter();
        this.updateFormSelectors();
    }

    renderBooks(data = this.books) {
        this.booksTable.innerHTML = data.map(book => `
            <tr>
                <td><img src="${book.cover}" class="book-cover-img" alt="Cover"></td>
                <td><strong>${book.title}</strong><br><small>${book.isbn}</small></td>
                <td>${book.author}</td>
                <td><span class="badge available">${book.category}</span></td>
                <td>${book.availableQty} / ${book.qty}</td>
                <td><span class="badge ${book.availableQty > 0 ? 'available' : 'borrowed'}">${book.availableQty > 0 ? 'Available' : 'Out of Stock'}</span></td>
                <td>
                    <div class="action-btns">
                        <button class="edit-btn" onclick="app.editBook('${book.id}')"><i class="fas fa-edit"></i></button>
                        <button class="delete-btn" onclick="app.deleteBook('${book.id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    renderBorrowers(data = this.borrowers) {
        this.borrowersTable.innerHTML = data.map(b => `
            <tr>
                <td><small>${b.mid}</small></td>
                <td>${b.name}</td>
                <td>${b.email}</td>
                <td>${b.phone}</td>
                <td>${b.history.length > 0 ? `<button onclick="app.showHistory('${b.id}')">View (${b.history.length})</button>` : 'None'}</td>
                <td>
                    <div class="action-btns">
                        <button class="edit-btn" onclick="app.editBorrower('${b.id}')"><i class="fas fa-user-edit"></i></button>
                        <button class="delete-btn" onclick="app.deleteBorrower('${b.id}')"><i class="fas fa-user-slash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    renderTransactions() {
        // Render fines Table separately
        const overdue = this.transactions.filter(t => t.fine > 0);
        this.finesTable.innerHTML = overdue.map(t => {
            const member = this.borrowers.find(b => b.id === t.memberId);
            const book = this.books.find(b => b.id === t.bookId);
            return `
                <tr>
                    <td>${member ? member.name : 'Unknown'}</td>
                    <td>${book ? book.title : 'Unknown'}</td>
                    <td>${Math.ceil((new Date() - new Date(t.dueDate)) / (1000 * 60 * 60 * 24))}</td>
                    <td>$${t.fine.toFixed(2)}</td>
                    <td><span class="badge overdue">${t.status === 'borrowed' ? 'Unpaid' : 'Settled'}</span></td>
                    <td>
                        ${t.status === 'borrowed' ? `<button class="return-btn" onclick="app.handleReturn('${t.id}')">Return&Pay</button>` : 'DONE'}
                    </td>
                </tr>
            `;
        }).join('');
    }

    renderCategories() {
        this.categoryList.innerHTML = this.categories.map(c => `
            <div class="category-card glass">
                <span>${c}</span>
                <button class="delete-btn" onclick="app.deleteCategory('${c}')"><i class="fas fa-times"></i></button>
            </div>
        `).join('');
    }

    renderActivity() {
        const recent = this.activity.slice(-8).reverse();
        this.activityList.innerHTML = recent.map(a => `
            <li>
                <span style="color: var(--cyan)">[${a.time}]</span> ${a.msg}
            </li>
        `).join('');
    }

    updateStats() {
        const total = this.books.reduce((acc, b) => acc + b.qty, 0) || 1;
        const available = this.books.reduce((acc, b) => acc + b.availableQty, 0);
        const borrowed = this.transactions.filter(t => t.status === 'borrowed').length;
        const overdue = this.transactions.filter(t => t.fine > 0 && t.status === 'borrowed').length;
        const borrowers = this.borrowers.length;
        const totalFines = this.transactions.reduce((acc, t) => acc + t.fine, 0);

        this.stats.totalBooks.innerText = total;
        this.stats.availableBooks.innerText = available;
        this.stats.borrowedBooks.innerText = borrowed;
        this.stats.overdueBooks.innerText = overdue;
        this.stats.borrowersCount.innerText = borrowers;
        this.stats.fineAmount.innerText = totalFines.toFixed(2);

        // Update Progress Bars
        if (this.stats.availableProgress) this.stats.availableProgress.style.width = `${(available / total) * 100}%`;
        if (this.stats.borrowedProgress) this.stats.borrowedProgress.style.width = `${(borrowed / total) * 100}%`;
        if (this.stats.overdueProgress) this.stats.overdueProgress.style.width = `${Math.min((overdue / total) * 100, 100)}%`;
        if (this.stats.borrowersProgress) this.stats.borrowersProgress.style.width = `${Math.min((borrowers / 50) * 100, 100)}%`; 
        if (this.stats.finesProgress) this.stats.finesProgress.style.width = `${Math.min((totalFines / 1000) * 100, 100)}%`;
        
        // Highlight overdue card
        const card = document.getElementById('overdue-card');
        if (card) {
            if (overdue > 0) card.classList.add('overdue');
            else card.classList.remove('overdue');
        }
    }

    updateCategoryFilter() {
        const filter = document.getElementById('book-category-filter');
        const options = this.categories.map(c => `<option value="${c}">${c}</option>`).join('');
        filter.innerHTML = `<option value="all">All Categories</option>` + options;
    }

    updateFormSelectors() {
        const memberSelect = document.getElementById('borrow-member-select');
        const bookSelect = document.getElementById('borrow-book-select');
        
        memberSelect.innerHTML = `<option value="">Select Member</option>` + 
            this.borrowers.map(b => `<option value="${b.id}">${b.name} (${b.mid})</option>`).join('');
            
        bookSelect.innerHTML = `<option value="">Select Book</option>` + 
            this.books.filter(b => b.availableQty > 0).map(b => `<option value="${b.id}">${b.title} (${b.availableQty} env)</option>`).join('');
    }

    // --- Helpers ---

    logActivity(msg) {
        const log = {
            time: new Date().toLocaleTimeString(),
            msg: msg
        };
        this.activity.push(log);
        if (this.activity.length > 50) this.activity.shift();
        this.save('activity');
        this.renderActivity();
    }

    toast(msg, type) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerText = msg;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    startClock() {
        const clock = document.getElementById('digital-clock');
        const dateEl = document.getElementById('current-date');
        const update = () => {
            const now = new Date();
            clock.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toUpperCase();
            if (dateEl) {
                const options = { weekday: 'long', month: 'short', day: 'numeric' };
                dateEl.innerText = now.toLocaleDateString('en-US', options).toUpperCase();
            }
        };
        update();
        setInterval(update, 1000);
    }

    toggleTheme() {
        document.body.classList.toggle('dark-mode');
        document.body.classList.toggle('light-mode');
        const isDark = document.body.classList.contains('dark-mode');
        this.settings.theme = isDark ? 'dark' : 'light';
        this.save('settings');
        const icon = document.querySelector('#theme-toggle i');
        icon.className = isDark ? 'fas fa-moon' : 'fas fa-sun';
    }

    filterBooks(query) {
        const q = query.toLowerCase();
        const filtered = this.books.filter(b => 
            b.title.toLowerCase().includes(q) || 
            b.author.toLowerCase().includes(q) || 
            b.isbn.includes(q)
        );
        this.renderBooks(filtered);
    }

    filterBooksByCategory(cat) {
        if (cat === 'all') {
            this.renderBooks();
        } else {
            const filtered = this.books.filter(b => b.category === cat);
            this.renderBooks(filtered);
        }
    }

    filterBorrowers(query) {
        const q = query.toLowerCase();
        const filtered = this.borrowers.filter(b => 
            b.name.toLowerCase().includes(q) || 
            b.email.toLowerCase().includes(q) || 
            b.mid.includes(q)
        );
        this.renderBorrowers(filtered);
    }

    handleReturnSearch(query) {
        const q = query.toLowerCase();
        const resultsDiv = document.getElementById('return-results');
        if (q.length < 2) {
            resultsDiv.innerHTML = '';
            return;
        }

        const activeTrans = this.transactions.filter(t => t.status === 'borrowed');
        const matches = activeTrans.filter(t => {
            const book = this.books.find(b => b.id === t.bookId);
            const member = this.borrowers.find(m => m.id === t.memberId);
            return book?.isbn.toLowerCase().includes(q) || member?.mid.toLowerCase().includes(q);
        });

        resultsDiv.innerHTML = matches.map(t => {
            const book = this.books.find(b => b.id === t.bookId);
            const member = this.borrowers.find(m => m.id === t.memberId);
            return `
                <div class="trans-card glass" style="margin-top: 10px; border-color: var(--green)">
                    <p><strong>${book.title}</strong></p>
                    <p>Borrower: ${member.name}</p>
                    <button class="return-btn" onclick="app.handleReturn('${t.id}')">Return Now</button>
                </div>
            `;
        }).join('');
    }

    handleGlobalSearch(query) {
        // Just highlights or jumps to section
        console.log("Global search pulse:", query);
    }

    // --- Charts ---

    initCharts() {
        const ctx = document.getElementById('activityChart').getContext('2d');
        this.activityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Circulation Pulse',
                    data: [12, 19, 3, 5, 2, 3],
                    borderColor: '#ff00ff',
                    backgroundColor: 'rgba(255, 0, 255, 0.1)',
                    borderWidth: 2,
                    tension: 0.4
                }, {
                    label: 'New Entrants',
                    data: [5, 10, 8, 15, 7, 12],
                    borderColor: '#00f3ff',
                    backgroundColor: 'rgba(0, 243, 255, 0.1)',
                    borderWidth: 2,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { labels: { color: '#e0e0e0' } } },
                scales: {
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#999' } },
                    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#999' } }
                }
            }
        });

        // Other charts...
    }

    updateCharts() {
        // Logic to update charts with real data
        const bookCtx = document.getElementById('topBooksChart')?.getContext('2d');
        if (bookCtx) {
            if (this.topBooksChart) this.topBooksChart.destroy();
            
            const bookUsage = {};
            this.transactions.forEach(t => {
                const book = this.books.find(b => b.id === t.bookId);
                if (book) bookUsage[book.title] = (bookUsage[book.title] || 0) + 1;
            });
            
            const labels = Object.keys(bookUsage).slice(0, 5);
            const data = Object.values(bookUsage).slice(0, 5);

            this.topBooksChart = new Chart(bookCtx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Lending Frequency',
                        data: data,
                        backgroundColor: '#ff00ff'
                    }]
                },
                options: { plugins: { legend: { display: false } } }
            });
        }
    }

    exportToCSV() {
        let csvContent = "data:text/csv;charset=utf-8,Title,Author,ISBN,Category,Status\n";
        this.books.forEach(b => {
            const status = b.availableQty > 0 ? "Available" : "Borrowed";
            csvContent += `${b.title},${b.author},${b.isbn},${b.category},${status}\n`;
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "library_manifest.csv");
        document.body.appendChild(link);
        link.click();
        this.toast('Manifest exported', 'success');
    }

    wipeMemory() {
        if (confirm('CRITICAL: WIPE ALL DATA? THIS CANNOT BE UNDONE.')) {
            localStorage.clear();
            location.reload();
        }
    }

    showHistory(borrowerId) {
        const borrower = this.borrowers.find(b => b.id === borrowerId);
        let msg = `History for ${borrower.name}:\n\n`;
        borrower.history.forEach(h => {
            msg += `[${new Date(h.date).toLocaleDateString()}] ${h.type.toUpperCase()}: ${h.bookTitle}\n`;
        });
        alert(msg);
    }
}

// OS INITIALIZATION
const app = new SmartLibrary();
window.app = app; // Global access for inline onclick
