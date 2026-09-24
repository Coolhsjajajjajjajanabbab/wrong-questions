// 私人错题集 - 统计看板逻辑

function getErrors() { return JSON.parse(localStorage.getItem('wrongQuestions') || '[]'); }

const errors = getErrors();

// ===== 总览数据 =====
const total = errors.length;
const mastered = errors.filter(e => e.mastered).length;
const unmastered = total - mastered;
const totalReviews = errors.reduce((sum, e) => sum + (e.reviewCount || 0), 0);

document.getElementById('statTotal').textContent = total;
document.getElementById('statMastered').textContent = mastered;
document.getElementById('statUnmastered').textContent = unmastered;
document.getElementById('statReview').textContent = totalReviews;

// 掌握率
const rate = total > 0 ? Math.round((mastered / total) * 100) : 0;
document.getElementById('progressBar').style.width = rate + '%';
document.getElementById('progressText').textContent = rate + '%';

// ===== 科目分布 =====
function renderBarChart(containerId, data, filterType) {
    const container = document.getElementById(containerId);
    if (data.length === 0) {
        container.innerHTML = '<p class="tip">暂无数据</p>';
        return;
    }
    const max = Math.max(...data.map(d => d.value));
    container.innerHTML = data.map(d => `
        <div class="bar-row bar-clickable" data-filter-type="${filterType}" data-filter-value="${d.label}">
            <span class="bar-label">${d.label}</span>
            <div class="bar-track">
                <div class="bar-fill" style="width:${(d.value / max) * 100}%"></div>
            </div>
            <span class="bar-value">${d.value}</span>
        </div>
    `).join('');
}

// 各科错题数
const subjectMap = {};
errors.forEach(e => {
    const s = e.subject || '未分类';
    subjectMap[s] = (subjectMap[s] || 0) + 1;
});
const subjectData = Object.entries(subjectMap)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
renderBarChart('subjectChart', subjectData, 'subject');

// 错因分布
const reasonMap = {};
errors.forEach(e => {
    const r = e.errorReason || '未分析';
    reasonMap[r] = (reasonMap[r] || 0) + 1;
});
const reasonData = Object.entries(reasonMap)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
renderBarChart('reasonChart', reasonData, 'reason');

// 高频考点 TOP 5
const chapterMap = {};
errors.filter(e => !e.mastered).forEach(e => {
    if (e.chapter) chapterMap[e.chapter] = (chapterMap[e.chapter] || 0) + 1;
});
const chapterData = Object.entries(chapterMap)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
renderBarChart('topChapters', chapterData, 'chapter');

// 难度分布
const diffMap = { '简单': 0, '中等': 0, '困难': 0 };
errors.forEach(e => {
    const d = e.difficulty || '中等';
    diffMap[d] = (diffMap[d] || 0) + 1;
});
const diffData = Object.entries(diffMap).map(([label, value]) => ({ label, value }));
renderBarChart('difficultyChart', diffData, 'difficulty');

// ===== 最近复习记录 =====
const reviewed = errors
    .filter(e => e.lastReview)
    .sort((a, b) => b.lastReview > a.lastReview ? 1 : -1)
    .slice(0, 8);

const reviewContainer = document.getElementById('recentReviews');
if (reviewed.length === 0) {
    reviewContainer.innerHTML = '<p class="tip">还没有复习记录</p>';
} else {
    reviewContainer.innerHTML = reviewed.map(e => `
        <div class="review-item">
            <span class="review-subject">${e.subject}</span>
            <span class="review-question">${e.question ? e.question.slice(0, 30) + (e.question.length > 30 ? '…' : '') : '<em class="no-text">仅图片</em>'}</span>
            <span class="review-info">第${e.reviewCount}次复习 · ${e.lastReview}</span>
            <span class="review-status ${e.mastered ? 'mastered' : ''}">${e.mastered ? '✅ 已掌握' : '❌ 未掌握'}</span>
        </div>
    `).join('');
}

// ===== 可折叠模块 =====
document.querySelectorAll('.collapse-header').forEach(header => {
    header.addEventListener('click', function () {
        const parent = this.closest('.collapsible');
        parent.classList.toggle('collapsed');
    });
});

// ===== 条形图点击跳转到搜索页 =====
document.querySelectorAll('.bar-clickable').forEach(row => {
    row.addEventListener('click', function () {
        const type = this.dataset.filterType;
        const value = encodeURIComponent(this.dataset.filterValue);
        window.location.href = `search.html?${type}=${value}`;
    });
});

// ===== 统计卡片点击显示错题列表弹窗 =====
const statModalOverlay = document.getElementById('statModalOverlay');
const statModalTitle = document.getElementById('statModalTitle');
const statModalBody = document.getElementById('statModalBody');
const statModalClose = document.getElementById('statModalClose');

// 渲染错题项
function renderErrorItem(error) {
    return `
        <div class="stat-error-item">
            <div class="stat-error-header">
                <span class="stat-error-subject">${error.subject}</span>
                <span class="stat-error-date">${error.date}</span>
            </div>
            ${error.image ? `<img src="${error.image}" class="stat-error-image" alt="题目截图">` : ''}
            ${error.question ? `<div class="stat-error-question">${error.question}</div>` : '<div class="stat-error-question" style="color: #999; font-style: italic;">（仅图片，无文字）</div>'}
            <div class="stat-error-footer">
                ${error.chapter ? `<span class="stat-error-chapter">📍 ${error.chapter}</span>` : ''}
                <span class="stat-error-status ${error.mastered ? 'mastered' : ''}">${error.mastered ? '✅ 已掌握' : '❌ 未掌握'}</span>
            </div>
        </div>
    `;
}

// 显示错题列表
function showErrorList(title, filteredErrors) {
    statModalTitle.textContent = `${title} (${filteredErrors.length}题)`;
    if (filteredErrors.length === 0) {
        statModalBody.innerHTML = '<div class="stat-error-empty">暂无错题</div>';
    } else {
        statModalBody.innerHTML = filteredErrors.map(renderErrorItem).join('');
    }
    statModalOverlay.style.display = 'flex';
}

// 关闭弹窗
statModalClose.addEventListener('click', () => {
    statModalOverlay.style.display = 'none';
});

statModalOverlay.addEventListener('click', (e) => {
    if (e.target === statModalOverlay) {
        statModalOverlay.style.display = 'none';
    }
});

// 统计卡片点击事件
document.querySelectorAll('.stat-clickable').forEach(card => {
    card.addEventListener('click', function () {
        const statType = this.dataset.stat;
        let title = '';
        let filteredErrors = [];

        switch (statType) {
            case 'total':
                title = '全部错题';
                filteredErrors = errors;
                break;
            case 'mastered':
                title = '已掌握';
                filteredErrors = errors.filter(e => e.mastered);
                break;
            case 'unmastered':
                title = '未掌握';
                filteredErrors = errors.filter(e => !e.mastered);
                break;
            case 'review':
                title = '有复习记录';
                filteredErrors = errors.filter(e => e.reviewCount > 0);
                break;
        }

        showErrorList(title, filteredErrors);
    });
});
