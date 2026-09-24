// 私人错题集 - 错题录入逻辑（自动分析 + 标签管理）

// ===== 工具函数 =====
function getErrors() { return JSON.parse(localStorage.getItem('wrongQuestions') || '[]'); }
function saveErrors(data) { localStorage.setItem('wrongQuestions', JSON.stringify(data)); }
function todayStr() { return new Date().toLocaleDateString('zh-CN'); }

// ===== 自动补全 =====
function refreshDatalists() {
    const errors = getErrors();
    const subjects = [...new Set(errors.map(e => e.subject).filter(Boolean))];
    const chapters = [...new Set(errors.map(e => e.chapter).filter(Boolean))];
    document.getElementById('subjectList').innerHTML = subjects.map(s => `<option value="${s}">`).join('');
    document.getElementById('chapterList').innerHTML = chapters.map(c => `<option value="${c}">`).join('');
}
refreshDatalists();

// ===== 模式切换 =====
const modeTabs = document.querySelectorAll('.mode-tab');
const singleForm = document.getElementById('shareForm');
const batchForm = document.getElementById('batchForm');
modeTabs.forEach(tab => {
    tab.addEventListener('click', function () {
        modeTabs.forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        if (this.dataset.mode === 'single') {
            singleForm.style.display = ''; batchForm.style.display = 'none';
        } else {
            singleForm.style.display = 'none'; batchForm.style.display = '';
        }
    });
});

// ============================================================
//  图片上传 + 自动分析拆分
// ============================================================
let fullImageBase64 = '';
let questionCropBase64 = '';
let answerCropBase64 = '';
let originalImage = null;       // 原始 Image 对象，用于手动裁剪
let manualMode = false;         // 是否进入手动裁剪模式
let cropMode = 'question';

const uploadArea = document.getElementById('imageUploadArea');
const fileInput = document.getElementById('questionImage');
const cropToolbar = document.getElementById('cropToolbar');
const cropCanvasWrap = document.getElementById('cropCanvasWrap');
const canvas = document.getElementById('cropCanvas');
const ctx = canvas.getContext('2d');
const cropRect = document.getElementById('cropRect');
const cropResults = document.getElementById('cropResults');
const autoStatus = document.getElementById('autoStatus');
const manualAdjustWrap = document.getElementById('manualAdjustWrap');

let imgNaturalW = 0, imgNaturalH = 0;
let canvasW = 0, canvasH = 0;
let scaleX = 1, scaleY = 1;

uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('dragover'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
uploadArea.addEventListener('drop', e => {
    e.preventDefault(); uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files[0] && e.dataTransfer.files[0].type.startsWith('image/'))
        handleImage(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', function () { if (this.files[0]) handleImage(this.files[0]); });

function handleImage(file) {
    manualMode = false;
    const reader = new FileReader();
    reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            originalImage = img;
            imgNaturalW = img.width;
            imgNaturalH = img.height;

            // 压缩全图存储
            const tmpCanvas = document.createElement('canvas');
            const storeW = Math.min(img.width, 1200);
            const storeH = Math.round(img.height * (storeW / img.width));
            tmpCanvas.width = storeW; tmpCanvas.height = storeH;
            tmpCanvas.getContext('2d').drawImage(img, 0, 0, storeW, storeH);
            fullImageBase64 = tmpCanvas.toDataURL('image/jpeg', 0.7);

            // 显示原图预览
            const previewWrap = document.getElementById('imagePreviewWrap');
            const previewThumb = document.getElementById('imagePreviewThumb');
            previewThumb.src = fullImageBase64;
            previewWrap.style.display = 'block';
            
            uploadArea.querySelector('p').textContent = '✅ 图片已上传，点击可更换';
            manualAdjustWrap.style.display = 'flex';
            cropResults.style.display = 'flex';

            // 重置
            questionCropBase64 = '';
            answerCropBase64 = '';
            updateCropResult('question', '');
            updateCropResult('answer', '');
            cropToolbar.style.display = 'none';
            cropCanvasWrap.style.display = 'none';
            cropRect.style.display = 'none';

            // 显示分析中状态
            autoStatus.style.display = 'block';
            autoStatus.className = 'auto-status auto-analyzing';
            autoStatus.innerHTML = '🔍 <span class="auto-status-text">正在分析图片，识别题目和答案区域...</span>';

            // 延迟执行分析（让 UI 先更新）
            setTimeout(() => analyzeAndSplit(img), 50);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// 原图点击放大
document.getElementById('imagePreviewThumb').addEventListener('click', function() {
    if (fullImageBase64) {
        showModal(fullImageBase64);
    }
});

// ============================================================
//  自动分析算法：检测颜色差异 + 空白分隔线，拆分题目和答案
// ============================================================
function analyzeAndSplit(img) {
    // 创建分析用 canvas（使用原图尺寸以获得最佳精度）
    const analyzeCanvas = document.createElement('canvas');
    const aW = Math.min(img.width, 1600);
    const aH = Math.round(img.height * (aW / img.width));
    analyzeCanvas.width = aW;
    analyzeCanvas.height = aH;
    const aCtx = analyzeCanvas.getContext('2d');
    aCtx.drawImage(img, 0, 0, aW, aH);

    const imageData = aCtx.getImageData(0, 0, aW, aH);
    const pixels = imageData.data;

    // 1. 计算每行的"空白度"和"红色度"
    const blankThreshold = 220;  // RGB 都大于此值视为空白像素
    const minBlankRatio = 0.6;   // 一行中空白像素占比超过此值视为"空行"
    
    // 红色检测：R > 180, G < 100, B < 100
    const redThreshold = { rMin: 180, gMax: 100, bMax: 100 };

    const rowBlank = new Float32Array(aH);
    const rowRed = new Float32Array(aH);
    
    for (let y = 0; y < aH; y++) {
        let blankCount = 0;
        let redCount = 0;
        let nonBlankCount = 0;
        
        for (let x = 0; x < aW; x++) {
            const idx = (y * aW + x) * 4;
            const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
            
            // 空白检测
            if (r > blankThreshold && g > blankThreshold && b > blankThreshold) {
                blankCount++;
            } else {
                nonBlankCount++;
                // 红色检测
                if (r > redThreshold.rMin && g < redThreshold.gMax && b < redThreshold.bMax) {
                    redCount++;
                }
            }
        }
        
        rowBlank[y] = blankCount / aW;
        rowRed[y] = nonBlankCount > 0 ? redCount / nonBlankCount : 0;
    }

    // 2. 标记空行
    const isBlankRow = new Uint8Array(aH);
    for (let y = 0; y < aH; y++) {
        isBlankRow[y] = rowBlank[y] >= minBlankRatio ? 1 : 0;
    }

    // 3. 找出连续空白行的"空白带"
    const gaps = [];
    let gapStart = -1;
    for (let y = 0; y <= aH; y++) {
        if (y < aH && isBlankRow[y]) {
            if (gapStart === -1) gapStart = y;
        } else {
            if (gapStart !== -1) {
                gaps.push({ start: gapStart, end: y - 1, height: y - gapStart });
                gapStart = -1;
            }
        }
    }

    // 4. 过滤有效分隔带
    const minGapH = Math.max(5, Math.round(aH * 0.008));
    const topMargin = Math.round(aH * 0.15);
    const bottomMargin = Math.round(aH * 0.85);

    const validGaps = gaps.filter(g =>
        g.height >= minGapH &&
        g.start >= topMargin &&
        g.end <= bottomMargin
    );

    // 5. 检测红色文字的起始位置（答案区域通常以红色文字开始）
    let redStartY = null;
    const redThresholdRatio = 0.3; // 一行中非空白像素有30%以上是红色
    
    for (let y = Math.round(aH * 0.2); y < Math.round(aH * 0.8); y++) {
        // 检查这一行是否有较多红色
        if (rowRed[y] > redThresholdRatio) {
            // 检查上方是否有明显的空白或颜色变化
            let hasTransition = false;
            const checkRange = Math.round(aH * 0.02);
            
            for (let checkY = Math.max(0, y - checkRange); checkY < y; checkY++) {
                if (isBlankRow[checkY] || rowRed[checkY] < 0.1) {
                    hasTransition = true;
                    break;
                }
            }
            
            if (hasTransition) {
                redStartY = y;
                break;
            }
        }
    }

    // 6. 选取最佳分隔线：综合评分
    let bestGap = null;
    let splitY = null;
    
    if (validGaps.length > 0) {
        const midY = aH / 2;
        validGaps.sort((a, b) => {
            const scoreA = a.height * 2 - Math.abs((a.start + a.end) / 2 - midY) * 0.1;
            const scoreB = b.height * 2 - Math.abs((b.start + b.end) / 2 - midY) * 0.1;
            return scoreB - scoreA;
        });
        bestGap = validGaps[0];
    }

    // 优先级1：红色文字起始位置（最准确的答案标记）
    if (redStartY !== null) {
        splitY = redStartY;
        autoStatus.className = 'auto-status auto-success';
        autoStatus.innerHTML = `✅ <span class="auto-status-text">自动识别完成：检测到红色答案区域，已自动拆分题目+答案</span>`;
    }
    // 优先级2：空白分隔带
    else if (bestGap) {
        splitY = Math.round((bestGap.start + bestGap.end) / 2);
        autoStatus.className = 'auto-status auto-success';
        autoStatus.innerHTML = `✅ <span class="auto-status-text">自动识别完成：检测到题目+答案区域，已自动拆分</span>`;
    }
    // 优先级3：未检测到分隔线 → 整张图作为题目
    else {
        questionCropBase64 = fullImageBase64;
        updateCropResult('question', fullImageBase64);
        autoStatus.className = 'auto-status auto-question-only';
        autoStatus.innerHTML = `📝 <span class="auto-status-text">未检测到答案区域，整张图片已作为题目</span>`;
    }

    // 7. 执行拆分
    if (splitY !== null) {
        doAutoSplit(img, splitY, aH);
    }
}

function doAutoSplit(img, splitY, aH) {
    // 如果传入的是分析画布坐标，需要换算到原图坐标
    let origSplitY = splitY;
    if (aH && aH !== img.naturalHeight) {
        origSplitY = Math.round(splitY * (img.naturalHeight / aH));
    }
    
    // 确保分割点在原图范围内
    origSplitY = Math.max(10, Math.min(origSplitY, img.naturalHeight - 10));

    // 使用原图尺寸裁剪
    const topCanvas = document.createElement('canvas');
    topCanvas.width = img.naturalWidth;
    topCanvas.height = origSplitY;
    topCanvas.getContext('2d').drawImage(img, 0, 0, img.naturalWidth, origSplitY, 0, 0, img.naturalWidth, origSplitY);
    questionCropBase64 = topCanvas.toDataURL('image/jpeg', 0.8);
    updateCropResult('question', questionCropBase64);

    const bottomH = img.naturalHeight - origSplitY;
    if (bottomH > 10) {
        const botCanvas = document.createElement('canvas');
        botCanvas.width = img.naturalWidth;
        botCanvas.height = bottomH;
        botCanvas.getContext('2d').drawImage(img, 0, origSplitY, img.naturalWidth, bottomH, 0, 0, img.naturalWidth, bottomH);
        answerCropBase64 = botCanvas.toDataURL('image/jpeg', 0.8);
        updateCropResult('answer', answerCropBase64);
    }
}

function updateCropResult(target, src) {
    const el = document.getElementById(target === 'question' ? 'cropResultQuestion' : 'cropResultAnswer');
    if (src) {
        const img = el.querySelector('.crop-result-img');
        img.src = src;
        img.style.cursor = 'pointer';
        el.style.display = 'flex';
    } else {
        el.style.display = 'none';
    }
}

// 裁剪结果点击放大
document.getElementById('cropResults').addEventListener('click', function(e) {
    const img = e.target.closest('.crop-result-img');
    if (!img) return;
    // 不要在点击清除按钮时触发
    if (e.target.closest('.crop-clear-btn')) return;
    showModal(img.src);
});

// 通用放大模态框
function showModal(imgSrc) {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
        <div class="image-modal-content">
            <span class="image-modal-close">&times;</span>
            <img src="${imgSrc}" class="image-modal-img">
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) {
        if (e.target === modal || e.target.className === 'image-modal-close') {
            document.body.removeChild(modal);
        }
    });
}

// 清除单个裁剪结果
document.querySelectorAll('.crop-clear-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        const target = this.dataset.target;
        if (target === 'question') { questionCropBase64 = ''; updateCropResult('question', ''); }
        else { answerCropBase64 = ''; updateCropResult('answer', ''); }
    });
});

// ===== 手动微调入口 =====
document.getElementById('manualAdjustBtn').addEventListener('click', function () {
    if (!originalImage) return;
    manualMode = true;

    // 显示手动裁剪工具
    const maxDisplayW = 800;
    canvasW = Math.min(originalImage.width, maxDisplayW);
    canvasH = Math.round(originalImage.height * (canvasW / originalImage.width));
    scaleX = imgNaturalW / canvasW;
    scaleY = imgNaturalH / canvasH;

    canvas.width = canvasW;
    canvas.height = canvasH;
    ctx.drawImage(originalImage, 0, 0, canvasW, canvasH);

    cropCanvasWrap.style.display = 'block';
    cropToolbar.style.display = 'flex';
    cropRect.style.display = 'none';

    // 重置手动状态
    questionCropBase64 = '';
    answerCropBase64 = '';
    updateCropResult('question', '');
    updateCropResult('answer', '');
    cropMode = 'question';
    document.querySelectorAll('.crop-mode-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.crop-mode-btn[data-crop="question"]').classList.add('active');
    document.getElementById('cropHintText').textContent = '👆 拖拽框选题目区域，然后切换框选答案';

    autoStatus.style.display = 'none';
});

// 重新上传
document.getElementById('autoResetBtn').addEventListener('click', function () {
    fullImageBase64 = '';
    questionCropBase64 = '';
    answerCropBase64 = '';
    originalImage = null;
    manualMode = false;
    updateCropResult('question', '');
    updateCropResult('answer', '');
    cropResults.style.display = 'none';
    manualAdjustWrap.style.display = 'none';
    autoStatus.style.display = 'none';
    cropToolbar.style.display = 'none';
    cropCanvasWrap.style.display = 'none';
    uploadArea.querySelector('p').textContent = '📷 点击或拖拽上传题目图片';
    fileInput.value = '';
});

// 手动裁剪模式切换
document.querySelectorAll('.crop-mode-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        document.querySelectorAll('.crop-mode-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        cropMode = this.dataset.crop;
        cropRect.style.display = 'none';
    });
});

// 重置手动裁剪
document.getElementById('cropResetBtn').addEventListener('click', function () {
    questionCropBase64 = '';
    answerCropBase64 = '';
    updateCropResult('question', '');
    updateCropResult('answer', '');
    cropRect.style.display = 'none';
    cropMode = 'question';
    document.querySelectorAll('.crop-mode-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.crop-mode-btn[data-crop="question"]').classList.add('active');
    document.getElementById('cropHintText').textContent = '👆 拖拽框选题目区域';
});

// ===== 拖拽裁剪（手动模式） =====
let isDragging = false;
let dragStart = { x: 0, y: 0 };

canvas.addEventListener('mousedown', startDrag);
canvas.addEventListener('mousemove', moveDrag);
canvas.addEventListener('mouseup', endDrag);
canvas.addEventListener('touchstart', e => { e.preventDefault(); startDrag(getTouchPos(e)); }, { passive: false });
canvas.addEventListener('touchmove', e => { e.preventDefault(); moveDrag(getTouchPos(e)); }, { passive: false });
canvas.addEventListener('touchend', e => { e.preventDefault(); endDrag(getTouchPos(e)); }, { passive: false });

function getTouchPos(e) {
    const touch = e.changedTouches[0];
    const rect = canvas.getBoundingClientRect();
    return { offsetX: touch.clientX - rect.left, offsetY: touch.clientY - rect.top };
}

function startDrag(e) {
    if (!manualMode) return;
    isDragging = true;
    dragStart = { x: e.offsetX, y: e.offsetY };
    cropRect.style.display = 'block';
    updateCropRectPos(e.offsetX, e.offsetY, 0, 0);
}

function moveDrag(e) {
    if (!isDragging) return;
    const x = Math.min(dragStart.x, e.offsetX);
    const y = Math.min(dragStart.y, e.offsetY);
    const w = Math.abs(e.offsetX - dragStart.x);
    const h = Math.abs(e.offsetY - dragStart.y);
    updateCropRectPos(x, y, w, h);
}

function endDrag(e) {
    if (!isDragging) return;
    isDragging = false;

    const x = Math.min(dragStart.x, e.offsetX);
    const y = Math.min(dragStart.y, e.offsetY);
    const w = Math.abs(e.offsetX - dragStart.x);
    const h = Math.abs(e.offsetY - dragStart.y);

    if (w < 10 || h < 10) { cropRect.style.display = 'none'; return; }
    doManualCrop(x, y, w, h);
}

function updateCropRectPos(x, y, w, h) {
    cropRect.style.left = x + 'px';
    cropRect.style.top = y + 'px';
    cropRect.style.width = w + 'px';
    cropRect.style.height = h + 'px';
    cropRect.className = 'crop-rect crop-' + cropMode;
}

function doManualCrop(sx, sy, sw, sh) {
    const ox = Math.round(sx * scaleX);
    const oy = Math.round(sy * scaleY);
    const ow = Math.round(sw * scaleX);
    const oh = Math.round(sh * scaleY);

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = ow;
    cropCanvas.height = oh;
    cropCanvas.getContext('2d').drawImage(originalImage, ox, oy, ow, oh, 0, 0, ow, oh);
    const cropped = cropCanvas.toDataURL('image/jpeg', 0.8);

    if (cropMode === 'question') {
        questionCropBase64 = cropped;
        updateCropResult('question', cropped);
        // 自动切换到答案模式
        cropMode = 'answer';
        document.querySelectorAll('.crop-mode-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.crop-mode-btn[data-crop="answer"]').classList.add('active');
        document.getElementById('cropHintText').textContent = '👆 现在框选答案/解析区域';
        cropRect.style.display = 'none';
    } else if (cropMode === 'answer') {
        answerCropBase64 = cropped;
        updateCropResult('answer', cropped);
        cropRect.style.display = 'none';
    }
}

// ============================================================
//  自定义标签系统
// ============================================================
const TAG_STORAGE_KEY = 'errorTags';
let selectedTags = [];

function getTagLibrary() {
    return JSON.parse(localStorage.getItem(TAG_STORAGE_KEY) || '[]');
}
function saveTagLibrary(tags) {
    localStorage.setItem(TAG_STORAGE_KEY, JSON.stringify(tags));
}
function renderTagPool() {
    const library = getTagLibrary();
    const pool = document.getElementById('tagPool');
    if (library.length === 0) {
        pool.innerHTML = '<span class="tag-empty-hint">还没有标签，在下方添加你的第一个标签</span>';
    } else {
        pool.innerHTML = library.map(tag => {
            const active = selectedTags.includes(tag);
            return `<span class="tag-pool-item ${active ? 'active' : ''}" data-tag="${tag}">${tag}</span>`;
        }).join('');
    }
    renderSelectedTags();
}
function renderSelectedTags() {
    const container = document.getElementById('tagSelected');
    if (selectedTags.length === 0) {
        container.innerHTML = '<span class="tag-empty-hint">点击下方标签选用，或手动添加新标签</span>';
    } else {
        container.innerHTML = selectedTags.map(t =>
            `<span class="tag-selected-item">${t} <span class="tag-remove" data-tag="${t}">✕</span></span>`
        ).join('');
    }
}

document.getElementById('tagPool').addEventListener('click', function (e) {
    const item = e.target.closest('.tag-pool-item');
    if (!item) return;
    const tag = item.dataset.tag;
    if (selectedTags.includes(tag)) {
        selectedTags = selectedTags.filter(t => t !== tag);
    } else {
        selectedTags.push(tag);
    }
    renderTagPool();
});

document.getElementById('tagSelected').addEventListener('click', function (e) {
    const rm = e.target.closest('.tag-remove');
    if (!rm) return;
    selectedTags = selectedTags.filter(t => t !== rm.dataset.tag);
    renderTagPool();
});

document.getElementById('tagAddBtn').addEventListener('click', addNewTag);
document.getElementById('tagNewInput').addEventListener('keypress', e => { if (e.key === 'Enter') { e.preventDefault(); addNewTag(); } });

function addNewTag() {
    const input = document.getElementById('tagNewInput');
    const name = input.value.trim();
    if (!name) return;
    const library = getTagLibrary();
    if (!library.includes(name)) {
        library.push(name);
        saveTagLibrary(library);
    }
    if (!selectedTags.includes(name)) selectedTags.push(name);
    input.value = '';
    renderTagPool();
}

const managePanel = document.getElementById('tagManagePanel');
document.getElementById('tagManageBtn').addEventListener('click', function () {
    managePanel.style.display = managePanel.style.display === 'none' ? '' : 'none';
    renderManageList();
});

function renderManageList() {
    const library = getTagLibrary();
    const list = document.getElementById('tagManageList');
    if (library.length === 0) {
        list.innerHTML = '<p class="tag-empty-hint">暂无标签</p>';
    } else {
        list.innerHTML = library.map(tag =>
            `<span class="tag-manage-item">${tag} <span class="tag-manage-del" data-tag="${tag}">✕</span></span>`
        ).join('');
    }
}

document.getElementById('tagManageList').addEventListener('click', function (e) {
    const del = e.target.closest('.tag-manage-del');
    if (!del) return;
    if (!confirm(`确定删除标签「${del.dataset.tag}」吗？`)) return;
    let library = getTagLibrary().filter(t => t !== del.dataset.tag);
    saveTagLibrary(library);
    selectedTags = selectedTags.filter(t => t !== del.dataset.tag);
    renderTagPool();
    renderManageList();
});

renderTagPool();

// ============================================================
//  提交保存
// ============================================================
singleForm.addEventListener('submit', function (e) {
    e.preventDefault();

    const questionText = document.getElementById('question').value.trim();
    const hasImage = questionCropBase64 || fullImageBase64;

    if (!questionText && !hasImage) {
        alert('请至少填写题目内容或上传题目截图！');
        return;
    }

    const storeImage = questionCropBase64 || fullImageBase64;

    const newError = {
        id: Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        subject: document.getElementById('subject').value.trim(),
        chapter: document.getElementById('chapter').value.trim(),
        difficulty: document.getElementById('difficulty').value,
        question: questionText,
        image: storeImage,
        imageFull: (storeImage !== fullImageBase64) ? fullImageBase64 : '',
        answerImage: answerCropBase64 || '',
        myAnswer: document.getElementById('myAnswer').value.trim(),
        correctAnswer: document.getElementById('correctAnswer').value.trim(),
        errorReason: document.getElementById('errorReason').value,
        notes: document.getElementById('notes').value.trim(),
        tags: [...selectedTags],
        reviewCount: 0,
        lastReview: '',
        mastered: false,
        date: todayStr()
    };

    const errors = getErrors();
    errors.push(newError);
    saveErrors(errors);

    const library = getTagLibrary();
    selectedTags.forEach(t => { if (!library.includes(t)) library.push(t); });
    saveTagLibrary(library);

    alert('✅ 错题已保存！');
    this.reset();
    fullImageBase64 = '';
    questionCropBase64 = '';
    answerCropBase64 = '';
    originalImage = null;
    manualMode = false;
    selectedTags = [];
    cropCanvasWrap.style.display = 'none';
    cropToolbar.style.display = 'none';
    cropResults.style.display = 'none';
    manualAdjustWrap.style.display = 'none';
    autoStatus.style.display = 'none';
    cropRect.style.display = 'none';
    document.getElementById('imagePreviewWrap').style.display = 'none';
    updateCropResult('question', '');
    updateCropResult('answer', '');
    uploadArea.querySelector('p').textContent = '📷 点击或拖拽上传题目图片';
    renderTagPool();
    refreshDatalists();
});

// ===== 批量导入 =====
document.getElementById('batchImportBtn').addEventListener('click', function () {
    const text = document.getElementById('batchInput').value.trim();
    if (!text) { alert('请先粘贴题目内容！'); return; }
    const lines = text.split('\n');
    let added = 0;
    const errors = getErrors();
    lines.forEach(line => {
        if (line.trim() === '') return;
        const parts = line.split(/[,，]/).map(s => s.trim());
        if (parts.length >= 3) {
            errors.push({
                id: Date.now() + '_' + Math.random().toString(36).slice(2, 8),
                subject: parts[0] || '', chapter: parts[1] || '',
                question: parts[2] || '', myAnswer: parts[3] || '',
                correctAnswer: parts[4] || '', errorReason: parts[5] || '',
                difficulty: parts[6] || '中等',
                image: '', imageFull: '', answerImage: '',
                notes: '', tags: [],
                reviewCount: 0, lastReview: '', mastered: false,
                date: todayStr()
            });
            added++;
        }
    });
    saveErrors(errors);
    alert(`成功导入 ${added} 条错题！`);
    document.getElementById('batchInput').value = '';
    refreshDatalists();
});
