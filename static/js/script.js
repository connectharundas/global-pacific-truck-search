document.addEventListener("DOMContentLoaded", function () {

    const searchBox = document.getElementById("searchBox");
    const searchClearBtn = document.getElementById("searchClearBtn");
    const resultList = document.getElementById("resultList");
    const totalRecords = document.getElementById("totalRecords");
    const resultCount = document.getElementById("resultCount");
    const scrollTopBtn = document.getElementById("scrollTopBtn");
    const downloadBtn = document.getElementById("downloadBtn");
    const loadedDateInput = document.getElementById("loadedDateInput");
    const loadedDownloadBtn = document.getElementById("loadedDownloadBtn");
    const filterDropdown = document.getElementById("filterDropdown");
    const filterDropdownToggle = document.getElementById("filterDropdownToggle");
    const filterDropdownLabel = document.getElementById("filterDropdownLabel");
    const filterDropdownMenu = document.getElementById("filterDropdownMenu");
    const filterOptions = document.querySelectorAll(".filter-option");
    const modalOverlay = document.getElementById("detailModal");
    const modalBody = document.getElementById("detailModalBody");
    const modalClose = document.getElementById("detailModalClose");

    const PAGE_SIZE = 40;

    let currentStatus = "All";
    let currentRows = [];
    let renderedCount = 0;
    let debounceTimer = null;

    const BADGE_PALETTE = [
        "badge-color-1",
        "badge-color-2",
        "badge-color-3",
        "badge-color-4",
        "badge-color-5"
    ];

    const STATUS_BADGE_MAP = {
        "RECEIVED": "badge-color-received",
        "RECIEVED": "badge-color-received",
        "SUBMITTED": "badge-color-submitted",
        "ALREADY HAVING": "badge-color-already-having",
        "ALREADY HAVE": "badge-color-already-having",
        "REJECTED": "badge-color-rejected",
        "NOT VALID": "badge-color-not-valid"
    };

    function badgeClassFor(status) {
        const normalized = status.trim().toUpperCase();

        if (STATUS_BADGE_MAP[normalized]) {
            return STATUS_BADGE_MAP[normalized];
        }

        let hash = 0;
        for (let i = 0; i < status.length; i++) {
            hash = (hash * 31 + status.charCodeAt(i)) >>> 0;
        }
        return BADGE_PALETTE[hash % BADGE_PALETTE.length];
    }

    function gatePassClassFor(dateStr) {
        if (!dateStr) {
            return "";
        }
        const parsed = new Date(dateStr);
        if (isNaN(parsed.getTime())) {
            return "";
        }
        return parsed.getTime() < Date.now() ? "gatepass-expired" : "gatepass-valid";
    }

    function dateOnly(dateStr) {
        if (!dateStr) {
            return "";
        }
        return String(dateStr).trim().split(" ")[0];
    }

    function animateCount(el, to) {
        const from = Number(el.textContent.replace(/\D/g, "")) || 0;
        if (from === to) {
            el.textContent = to;
            return;
        }
        const duration = 450;
        const start = performance.now();

        function tick(now) {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(from + (to - from) * eased);
            if (progress < 1) {
                requestAnimationFrame(tick);
            }
        }

        requestAnimationFrame(tick);
    }

    function renderSkeleton(count) {
        let html = "";
        for (let i = 0; i < count; i++) {
            html += `
                <div class="skeleton-card">
                    <div class="skeleton-line w-40"></div>
                    <div class="skeleton-line w-25"></div>
                    <div class="skeleton-grid">
                        <div>
                            <div class="skeleton-line w-70"></div>
                            <div class="skeleton-line w-50"></div>
                        </div>
                        <div>
                            <div class="skeleton-line w-70"></div>
                            <div class="skeleton-line w-50"></div>
                        </div>
                    </div>
                </div>
            `;
        }
        resultList.innerHTML = html;
    }

    function cardHtml(row, index) {

        const status = row["STATUS"] || "-";
        const statusClass = badgeClassFor(status);
        const isExact = row["match_type"] === "exact";
        const gatePassRaw = row["ALL_FIELDS"] ? row["ALL_FIELDS"]["GATE PASS EXPIRE DATE"] : "";
        const gatePassClass = gatePassClassFor(gatePassRaw);
        const loadedRaw = row["LOADED"] || "";
        const loadedClass = loadedRaw ? "gatepass-valid" : "";

        const delay = Math.min(index % PAGE_SIZE, 10) * 0.035;

        return `
            <div class="truck-card${isExact ? " match-exact" : ""}" data-row-index="${index}" style="animation-delay:${delay}s">
                <div class="truck-card-top">
                    <div class="truck-no">${row["TRUCK"] || ""}</div>
                    <span class="status-badge ${statusClass}">${status}</span>
                </div>
                <div class="trailer-no">Trailer ${row["TRAILER"] || "-"}</div>
                <div class="truck-card-grid">
                    <div>
                        <div class="field-label">Driver</div>
                        <div class="field-value">${row["DRIVER NAME"] || "-"}</div>
                    </div>
                    <div>
                        <div class="field-label">ID No</div>
                        <div class="field-value">${row["ID NO"] || "-"}</div>
                    </div>
                    <div>
                        <div class="field-label">Transporter</div>
                        <div class="field-value">${row["TRANSPORTOR"] || "-"}</div>
                    </div>
                    <div>
                        <div class="field-label">Sub</div>
                        <div class="field-value">${row["SUB"] || "-"}</div>
                    </div>
                    <div>
                        <div class="field-label">Gate Pass Expiry</div>
                        <div class="field-value ${gatePassClass}">${dateOnly(gatePassRaw) || "-"}</div>
                    </div>
                    <div>
                        <div class="field-label">Token</div>
                        <div class="field-value">${(row["ALL_FIELDS"] && row["ALL_FIELDS"]["TOKEN"]) || "-"}</div>
                    </div>
                    <div>
                        <div class="field-label">Loaded</div>
                        <div class="field-value ${loadedClass}">${dateOnly(loadedRaw) || "-"}</div>
                    </div>
                </div>
                <div class="truck-card-hint">Tap to view more details</div>
            </div>
        `;
    }

    function renderLoadMore() {

        const remaining = currentRows.length - renderedCount;

        const existing = document.getElementById("loadMoreBtn");
        if (existing) {
            existing.remove();
        }

        if (remaining <= 0) {
            return;
        }

        const btn = document.createElement("button");
        btn.id = "loadMoreBtn";
        btn.className = "load-more-btn";
        btn.textContent = `Load More (${remaining} remaining)`;
        btn.addEventListener("click", renderNextBatch);
        resultList.appendChild(btn);
    }

    function renderNextBatch() {

        const nextRows = currentRows.slice(renderedCount, renderedCount + PAGE_SIZE);

        let html = "";
        nextRows.forEach(function (row, i) {
            html += cardHtml(row, renderedCount + i);
        });

        const existing = document.getElementById("loadMoreBtn");
        if (existing) {
            existing.insertAdjacentHTML("beforebegin", html);
        } else {
            resultList.insertAdjacentHTML("beforeend", html);
        }

        renderedCount += nextRows.length;
        renderLoadMore();
    }

    function renderCards(rows) {

        currentRows = rows;
        renderedCount = 0;
        animateCount(resultCount, rows.length);

        if (rows.length === 0) {
            resultList.innerHTML = `
                <div class="empty-state">
                    <span class="empty-state-icon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/>
                            <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </span>
                    <span>No Records Found</span>
                </div>
            `;
            return;
        }

        resultList.innerHTML = "";
        renderNextBatch();
    }

    function fetchResults() {

        const keyword = searchBox.value.trim();

        renderSkeleton(4);

        fetch(`/search?q=${encodeURIComponent(keyword)}&status=${encodeURIComponent(currentStatus)}`)
            .then(function (res) {
                return res.json();
            })
            .then(function (data) {
                renderCards(data);
            })
            .catch(function () {
                resultList.innerHTML = `<div class="empty-state">Error loading data.</div>`;
            });
    }

    // ============================
    // LIVE SEARCH (debounced)
    // ============================

    searchBox.addEventListener("input", function () {
        searchBox.parentElement.classList.toggle("has-value", searchBox.value.trim() !== "");
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(fetchResults, 200);
    });

    searchClearBtn.addEventListener("click", function () {
        searchBox.value = "";
        searchBox.parentElement.classList.remove("has-value");
        searchBox.focus();
        fetchResults();
    });

    // ============================
    // FILTER DROPDOWN
    // ============================

    filterDropdownToggle.addEventListener("click", function () {
        filterDropdown.classList.toggle("open");
    });

    filterOptions.forEach(function (option) {
        option.addEventListener("click", function () {
            filterOptions.forEach(function (o) {
                o.classList.remove("active");
            });
            option.classList.add("active");
            filterDropdownLabel.textContent = option.dataset.status;
            currentStatus = option.dataset.status;
            filterDropdown.classList.remove("open");
            fetchResults();
        });
    });

    document.addEventListener("click", function (e) {
        if (!filterDropdown.contains(e.target)) {
            filterDropdown.classList.remove("open");
        }
    });

    // ============================
    // DOWNLOAD BUTTON
    // ============================

    downloadBtn.addEventListener("click", function () {

        const keyword = searchBox.value.trim();

        if (keyword === "" && currentStatus === "All") {
            alert("Please enter a search term or select a filter.");
            return;
        }

        window.location.href = `/download?q=${encodeURIComponent(keyword)}&status=${encodeURIComponent(currentStatus)}`;
    });

    // ============================
    // DOWNLOAD BY LOADED DATE
    // ============================

    loadedDownloadBtn.addEventListener("click", function () {

        const loadedDate = loadedDateInput.value;

        if (!loadedDate) {
            alert("Please select a loaded date.");
            return;
        }

        window.location.href = `/download?loaded_date=${encodeURIComponent(loadedDate)}`;
    });

    // ============================
    // DRILL-DOWN MODAL
    // ============================

    function openDetail(row) {

        const fields = row["ALL_FIELDS"] || {};
        const keys = Object.keys(fields);

        let html = "";

        keys.forEach(function (key) {
            const value = key === "GATE PASS EXPIRE DATE" ? dateOnly(fields[key]) : fields[key];
            html += `
                <div class="detail-row">
                    <div class="detail-label">${key}</div>
                    <div class="detail-value">${value || "-"}</div>
                </div>
            `;
        });

        modalBody.innerHTML = html;
        modalOverlay.classList.add("open");
    }

    function closeDetail() {
        modalOverlay.classList.remove("open");
    }

    resultList.addEventListener("click", function (e) {
        const card = e.target.closest(".truck-card");
        if (!card) {
            return;
        }
        const index = Number(card.dataset.rowIndex);
        const row = currentRows[index];
        if (row) {
            openDetail(row);
        }
    });

    modalClose.addEventListener("click", closeDetail);

    modalOverlay.addEventListener("click", function (e) {
        if (e.target === modalOverlay) {
            closeDetail();
        }
    });

    // ============================
    // SCROLL TO TOP
    // ============================

    window.addEventListener("scroll", function () {
        scrollTopBtn.classList.toggle("visible", window.scrollY > 400);
    });

    scrollTopBtn.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // ============================
    // INITIAL LOAD
    // ============================

    const initialTotal = Number(totalRecords.textContent) || 0;
    totalRecords.textContent = "0";
    animateCount(totalRecords, initialTotal);

    fetchResults();

});
