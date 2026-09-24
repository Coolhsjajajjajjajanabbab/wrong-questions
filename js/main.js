// 私人错题集 - 主页面逻辑
document.addEventListener('DOMContentLoaded', function () {

    // ===== 工具函数 =====
    function getErrors() {
        return JSON.parse(localStorage.getItem('wrongQuestions') || '[]');
    }

    function todayStr() {
        return new Date().toLocaleDateString('zh-CN');
    }

    // ===== 快捷统计 =====
    const errors = getErrors();
    document.getElementById('totalCount').textContent = errors.length;
    document.getElementById('todayCount').textContent =
        errors.filter(e => e.date === todayStr()).length;
    document.getElementById('subjectCount').textContent =
        new Set(errors.map(e => e.subject)).size;

    // ===== 最近 5 条错题预览 =====
    const recent = errors.slice(-5).reverse();
    const container = document.getElementById('recentErrors');
    if (recent.length === 0) {
        container.innerHTML = '<p class="tip">还没有错题，快去录入吧！</p>';
    } else {
        container.innerHTML = recent.map(e => `
            <div class="recent-card">
                <span class="subject-badge">${e.subject}</span>
                <span class="recent-question">${e.question.slice(0, 40)}${e.question.length > 40 ? '…' : ''}</span>
                <span class="recent-date">${e.date}</span>
            </div>
        `).join('');
    }

    // ===== 功能卡片跳转 =====
    document.querySelectorAll('.feature-card').forEach(card => {
        card.addEventListener('click', function () {
            const page = this.getAttribute('data-page');
            if (page) window.location.href = page;
        });
    });

    // ===== 导出 =====
    document.getElementById('exportBtn').addEventListener('click', function () {
        const data = getErrors();
        if (data.length === 0) { alert('没有错题数据可导出'); return; }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `错题集_${todayStr().replace(/\//g, '-')}.json`;
        a.click();
    });

    // ===== 导入 =====
    const importFile = document.getElementById('importFile');
    document.getElementById('importBtn').addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (ev) {
            try {
                const imported = JSON.parse(ev.target.result);
                if (!Array.isArray(imported)) { alert('文件格式不正确'); return; }
                const existing = getErrors();
                // 合并去重（按 id）
                const existingIds = new Set(existing.map(q => q.id));
                let added = 0;
                imported.forEach(item => {
                    if (!existingIds.has(item.id)) {
                        existing.push(item);
                        added++;
                    }
                });
                localStorage.setItem('wrongQuestions', JSON.stringify(existing));
                alert(`导入成功！新增 ${added} 条，跳过 ${imported.length - added} 条重复。`);
                location.reload();
            } catch (err) {
                alert('导入失败，请检查文件是否为正确的 JSON 格式');
            }
        };
        reader.readAsText(file);
    });
});
