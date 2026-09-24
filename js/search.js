// 私人错题集 - 搜索浏览逻辑

function getErrors() { return JSON.parse(localStorage.getItem('wrongQuestions') || '[]'); }
function saveErrors(d) { localStorage.setItem('wrongQuestions', JSON.stringify(d)); }

let allErrors = getErrors();

// ===== 初始化筛选下拉 =====
let filterTags = [];  // 当前选中的筛选标签

function initFilters() {
    const subjects = [...new Set(allErrors.map(e => e.subject).filter(Boolean))];
    const reasons = [...new Set(allErrors.map(e => e.errorReason).filter(Boolean))];
    document.getElementById('filterSubject').innerHTML =
        '<option value="">全部科目</option>' + subjects.map(s => `<option value="${s}">${s}</option>`).join('');
    document.getElementById('filterReason').innerHTML =
        '<option value="">全部错因</option>' + reasons.map(r => `<option value="${r}">${r}</option>`).join('');

    // 标签筛选
    const allTags = [...new Set(allErrors.flatMap(e => e.tags || []))];
    const tagContainer = document.getElementById('filterTags');
    if (allTags.length > 0) {
        tagContainer.innerHTML = '<span class="filter-tags-label">标签：</span>' +
            allTags.map(t => `<span class="filter-tag-btn" data-tag="${t}">${t}</span>`).join('');
    } else {
        tagContainer.innerHTML = '';
    }
}
initFilters();

// 标签筛选点击
document.getElementById('filterTags').addEventListener('click', function (e) {
    const btn = e.target.closest('.filter-tag-btn');
    if (!btn) return;
    const tag = btn.dataset.tag;
    if (filterTags.includes(tag)) {
        filterTags = filterTags.filter(t => t !== tag);
        btn.classList.remove('active');
    } else {
        filterTags.push(tag);
        btn.classList.add('active');
    }
    doSearch();
});

// ===== 搜索与筛选 =====
function doSearch() {
    const kw = document.getElementById('searchInput').value.trim().toLowerCase();
    const subject = document.getElementById('filterSubject').value;
    const reason = document.getElementById('filterReason').value;
    const diff = document.getElementById('filterDifficulty').value;
    const status = document.getElementById('filterStatus').value;

    let results = allErrors.filter(e => {
        // 关键词：搜题目、章节、标签、笔记、我的答案、正确答案
        if (kw) {
            const searchable = [e.question, e.chapter, e.myAnswer, e.correctAnswer,
                e.notes, (e.tags || []).join(' ')].join(' ').toLowerCase();
            if (!searchable.includes(kw)) return false;
        }
        if (subject && e.subject !== subject) return false;
        if (reason && e.errorReason !== reason) return false;
        if (diff && e.difficulty !== diff) return false;
        if (status === '已掌握' && !e.mastered) return false;
        if (status === '未掌握' && e.mastered) return false;
        // 标签筛选：选中的标签必须全部命中
        if (filterTags.length > 0) {
            const eTags = e.tags || [];
            if (!filterTags.every(ft => eTags.includes(ft))) return false;
        }
        return true;
    });

    // 按日期倒序
    results.sort((a, b) => (b.id > a.id ? 1 : -1));

    document.getElementById('resultCount').textContent =
        `共 ${results.length} 条错题（总计 ${allErrors.length} 条）`;

    renderCards(results);
}

// ===== 渲染卡片 =====
function renderCards(list) {
    const container = document.getElementById('errorCards');
    if (list.length === 0) {
        container.innerHTML = '<p class="tip">没有找到匹配的错题</p>';
        return;
    }
    container.innerHTML = list.map(e => `
        <div class="error-card" data-id="${e.id}">
            <div class="error-card-header">
                <span class="subject-badge">${e.subject || '未分类'}</span>
                <span class="difficulty-badge difficulty-${e.difficulty}">${e.difficulty || ''}</span>
                <span class="date-label">${e.date}</span>
                <button class="card-delete-btn" data-id="${e.id}" title="删除">🗑️</button>
            </div>
            <div class="error-card-body">
                ${e.chapter ? `<div class="chapter-tag">📎 ${e.chapter}</div>` : ''}
                <div class="question-text">${e.question ? e.question.slice(0, 100) + (e.question.length > 100 ? '…' : '') : '<em class="no-text">仅图片</em>'}</div>
                ${e.image ? '<div class="has-image">📷 含题目截图</div>' : ''}
                ${e.answerImage ? '<div class="has-image">📋 含解析截图</div>' : ''}
            </div>
            <div class="error-card-footer">
                <span class="reason-tag">${e.errorReason || '未分析'}</span>
                ${(e.tags || []).map(t => `<span class="tag-pill">${t}</span>`).join('')}
                <span class="mastered-label ${e.mastered ? 'mastered' : ''}">${e.mastered ? '✅ 已掌握' : '❌ 未掌握'}</span>
            </div>
        </div>
    `).join('');
}

// ===== 事件绑定 =====
document.getElementById('searchBtn').addEventListener('click', doSearch);
document.getElementById('searchInput').addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(); });
['filterSubject', 'filterReason', 'filterDifficulty', 'filterStatus'].forEach(id => {
    document.getElementById(id).addEventListener('change', doSearch);
});

// 初始加载 — 读取 URL 参数自动筛选
(function applyUrlFilters() {
    const params = new URLSearchParams(window.location.search);

    if (params.has('subject')) {
        const v = decodeURIComponent(params.get('subject'));
        const sel = document.getElementById('filterSubject');
        if ([...sel.options].some(o => o.value === v)) sel.value = v;
    }
    if (params.has('reason')) {
        const v = decodeURIComponent(params.get('reason'));
        const sel = document.getElementById('filterReason');
        if ([...sel.options].some(o => o.value === v)) sel.value = v;
    }
    if (params.has('difficulty')) {
        const v = decodeURIComponent(params.get('difficulty'));
        document.getElementById('filterDifficulty').value = v;
    }
    if (params.has('status')) {
        const v = decodeURIComponent(params.get('status'));
        document.getElementById('filterStatus').value = v;
    }
    if (params.has('chapter')) {
        const v = decodeURIComponent(params.get('chapter'));
        document.getElementById('searchInput').value = v;
    }
    if (params.has('tag')) {
        const v = decodeURIComponent(params.get('tag'));
        filterTags = [v];
        const btn = document.querySelector(`.filter-tag-btn[data-tag="${v}"]`);
        if (btn) btn.classList.add('active');
    }
})();

doSearch();

// ===== 详情弹窗 =====
const overlay = document.getElementById('modalOverlay');
const modalContent = document.getElementById('modalContent');

document.getElementById('errorCards').addEventListener('click', function (e) {
    // 快捷删除按钮
    const delBtn = e.target.closest('.card-delete-btn');
    if (delBtn) {
        e.stopPropagation();
        const delId = delBtn.dataset.id;
        if (!confirm('确定删除这条错题吗？')) return;
        const errors = getErrors().filter(q => String(q.id) !== String(delId));
        saveErrors(errors);
        allErrors = errors;
        doSearch();
        return;
    }

    const card = e.target.closest('.error-card');
    if (!card) return;
    const id = card.dataset.id;
    const error = allErrors.find(q => String(q.id) === String(id));
    if (!error) return;

    modalContent.innerHTML = `
        <div class="modal-header">
            <span class="subject-badge">${error.subject || '未分类'}</span>
            <span class="difficulty-badge difficulty-${error.difficulty}">${error.difficulty || ''}</span>
            <button class="modal-close" id="modalClose">✕</button>
        </div>
        <div class="modal-body">
            ${error.chapter ? `<div class="detail-row"><strong>考点：</strong>${error.chapter}</div>` : ''}
            <div class="detail-row"><strong>日期：</strong>${error.date}</div>
            ${error.image ? `<div class="detail-row"><strong>题目截图：</strong><br><img src="${error.image}" class="detail-image"></div>` : ''}
            ${error.question ? `<div class="detail-row"><strong>题目：</strong><br><div class="detail-text">${error.question}</div></div>` : ''}
            <div class="answer-section hidden" id="answerSection">
                <div class="answer-toggle-btn" id="answerToggleBtn">👁️ 点击查看答案</div>
                <div class="answer-content" style="display:none">
                    <div class="detail-row-grid">
                        <div><strong>我的答案：</strong><br><div class="detail-text wrong">${error.myAnswer || '未记录'}</div></div>
                        <div><strong>正确答案：</strong><br><div class="detail-text right">${error.correctAnswer || '未记录'}</div></div>
                    </div>
                    ${error.answerImage ? `<div class="detail-row"><strong>解析截图：</strong><br><img src="${error.answerImage}" class="detail-image"></div>` : ''}
                </div>
            </div>
            <div class="detail-row"><strong>错因：</strong>${error.errorReason || '未分析'}</div>
            ${error.notes ? `<div class="detail-row"><strong>笔记：</strong><br><div class="detail-text">${error.notes}</div></div>` : ''}
            ${error.tags && error.tags.length ? `<div class="detail-row"><strong>标签：</strong>${error.tags.map(t => `<span class="tag-pill">${t}</span>`).join(' ')}</div>` : ''}
            <div class="detail-row"><strong>复习次数：</strong>${error.reviewCount || 0} 次 &nbsp; ${error.lastReview ? '最近复习：' + error.lastReview : ''}</div>
        </div>
        <div class="modal-actions">
            <button class="btn ${error.mastered ? 'btn-secondary' : ''}" id="toggleMaster">
                ${error.mastered ? '标记为未掌握' : '✅ 标记为已掌握'}
            </button>
            <button class="btn-secondary" id="addReview">📝 记一次复习</button>
            <button class="btn-danger" id="deleteError">🗑️ 删除</button>
        </div>
    `;
    overlay.classList.add('show');

    // 关闭
    document.getElementById('modalClose').onclick = () => overlay.classList.remove('show');

    // 答案展开/折叠
    const answerToggle = document.getElementById('answerToggleBtn');
    const answerContent = document.querySelector('#answerSection .answer-content');
    const answerSection = document.getElementById('answerSection');
    if (answerToggle && answerContent) {
        answerToggle.addEventListener('click', function () {
            const isHidden = answerContent.style.display === 'none';
            answerContent.style.display = isHidden ? 'block' : 'none';
            answerToggle.textContent = isHidden ? '🙈 点击收起答案' : '👁️ 点击查看答案';
            answerSection.classList.toggle('hidden', !isHidden);
        });
    }

    // 标记掌握/未掌握
    document.getElementById('toggleMaster').onclick = function () {
        const errors = getErrors();
        const idx = errors.findIndex(q => String(q.id) === String(id));
        if (idx > -1) {
            errors[idx].mastered = !errors[idx].mastered;
            saveErrors(errors);
            allErrors = errors;
            overlay.classList.remove('show');
            doSearch();
        }
    };

    // 记一次复习
    document.getElementById('addReview').onclick = function () {
        const errors = getErrors();
        const idx = errors.findIndex(q => String(q.id) === String(id));
        if (idx > -1) {
            errors[idx].reviewCount = (errors[idx].reviewCount || 0) + 1;
            errors[idx].lastReview = new Date().toLocaleDateString('zh-CN');
            saveErrors(errors);
            allErrors = errors;
            alert('✅ 已记录复习！');
        }
    };

    // 删除
    document.getElementById('deleteError').onclick = function () {
        if (!confirm('确定删除这条错题吗？')) return;
        const errors = getErrors().filter(q => String(q.id) !== String(id));
        saveErrors(errors);
        allErrors = errors;
        overlay.classList.remove('show');
        doSearch();
    };
});

overlay.addEventListener('click', function (e) {
    if (e.target === overlay) overlay.classList.remove('show');
});
