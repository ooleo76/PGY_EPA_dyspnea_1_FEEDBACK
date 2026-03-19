// ============================================================
// ▼▼▼ 設定區：請填入您的 GAS 部署網址 ▼▼▼
// ============================================================
const APP_CONFIG = {
    gasUrl: "https://script.google.com/macros/s/AKfycbx_HP26PxVSXpqc5Ap_C3MiOPv76uzvaJYcRe3OghOtGKXjL1JHT6a7Cw6Vnd_4l9KojA/exec",       
    adminEmail: "chihenglee1006@gmail.com",          
    enableNotify: true                      
};
// ============================================================

let hasSentDataForCurrentReport = false;
const originalContent = {};
const selectedAdvices = new Set();

const adviceContent = {
    'intubation': { title: '插管技能重點提醒', content: ['插管前：確認血壓、體重、充分preoxygenation (3分鐘)', '鎮靜劑：Propofol 1-2 mg/kg, Midazolam 0.1-0.3 mg/kg', '肌鬆劑：Succinyl 1-1.5mg/kg, Rocuronium 0.6-1.2 mg/kg', '管徑選擇：男性7.5, 女性7', '插管後：監測生命徵象、確認ETCO2、安排CXR'] },
    'handover': { title: '交班技巧 (ISBAR結構)', content: ['I — Introduction / Identify：自我介紹並確認病人身分', 'S — Situation：說明目前的情況或交班重點', 'B — Background：交代病人背景與相關病史', 'A — Assessment：提供評估與目前檢查結果', 'R — Recommendation：提出建議、需求或後續計畫'] },
    'respiratory': { title: '呼吸評估重點', content: ['病史收集：呼吸困難onset、過去病史、誘發因子、伴隨症狀', '理學檢查：生命徵象、聽診、體液狀態評估', '檢查項目：ABG、CXR、必要時BNP', '氧氣治療：從適當FiO2開始，觀察反應後調整', '監測指標：SpO2、呼吸功、意識狀態變化'] },
    'clinical-thinking': { title: '臨床思維發展', content: ['病例報告結構：基本資料→評估發現→處置反應→臨床判斷→後續計畫', '鑑別診斷思考：急性呼吸衰竭原因分析 (PNA? HF? COPD AE?)', '治療優先序：ABC原則，生命徵象穩定優先'] },
    'physical-exam': { title: '理學檢查技巧提升', content: ['系統性檢查：按照固定順序進行完整評估', '聽診技巧：練習辨識正常與異常呼吸音', '視診重點：注意病人整體外觀、呼吸型態', '觸診技巧：評估脈搏、水腫、淋巴結', '整合能力：將檢查發現與病史相互對證'] }
};

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('eval-date').valueAsDate = new Date();
    document.querySelectorAll('.editable-text').forEach(textarea => {
        const lbl = textarea.closest('label');
        if (lbl) originalContent[lbl.getAttribute('for')] = textarea.value;
    });

    document.querySelectorAll('.checkbox-item input[type="checkbox"]:not([data-advice])').forEach(cb => {
        cb.addEventListener('change', function () {
            const item = this.closest('.checkbox-item');
            if (item) item.classList.toggle('checked', this.checked);
        });
    });

    document.querySelectorAll('.custom-item').forEach(item => {
        const cb  = item.querySelector('input[type="checkbox"]');
        const txt = item.querySelector('input[type="text"]');
        if (txt && cb) {
            txt.addEventListener('input', function () {
                cb.disabled = !this.value.trim();
                if (!this.value.trim()) cb.checked = false;
            });
        }
    });

    document.querySelectorAll('.advice-group input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', function () {
            const t = this.getAttribute('data-advice');
            if (this.checked) selectedAdvices.add(t);
            else selectedAdvices.delete(t);
        });
    });

    document.querySelectorAll('.editable-text').forEach(ta => {
        ta.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
        });
        ta.style.height = 'auto';
        ta.style.height = ta.scrollHeight + 'px';
    });
});

function selectRadio(name, value) {
    document.querySelectorAll(`input[name="${name}"]`).forEach(radio => {
        const item = radio.closest('.radio-item');
        if (item) {
            radio.checked = (radio.value === value);
            item.classList.toggle('selected', radio.value === value);
        }
    });
}

// 產生完整報告字串
function buildReportText() {
    const studentName = document.getElementById('student-name').value || '未填寫';
    const evaluator   = document.getElementById('evaluator').value   || '未填寫';
    const evalDate    = document.getElementById('eval-date').value   || '未填寫';

    let report = `PGY學員臨床技能評估報告\n================\n`;
    report += `學員：${studentName}\n評估者：${evaluator}\n評估日期：${evalDate}\n\n`;

    const byImp = {}, byGood = {};

    document.querySelectorAll('.checkbox-item input[type="checkbox"]:checked').forEach(item => {
        if (item.getAttribute('data-advice')) return;
        const cat  = item.getAttribute('data-category');
        const type = item.getAttribute('data-type');
        const ta   = item.parentElement.querySelector('.editable-text');
        const text = ta ? ta.value.trim() : '';
        if (type === 'improvement') { if (!byImp[cat]) byImp[cat] = []; byImp[cat].push(text); }
        else if (type === 'good')   { if (!byGood[cat]) byGood[cat] = []; byGood[cat].push(text); }
    });

    document.querySelectorAll('.custom-item input[type="checkbox"]:checked').forEach(item => {
        const cat  = item.getAttribute('data-category');
        const type = item.getAttribute('data-type');
        const txt  = item.parentElement.querySelector('input[type="text"]');
        const text = txt ? txt.value.trim() : '';
        if (!text) return;
        if (type === 'improvement') { if (!byImp[cat]) byImp[cat] = []; byImp[cat].push(text); }
        else if (type === 'good')   { if (!byGood[cat]) byGood[cat] = []; byGood[cat].push(text); }
    });

    if (Object.keys(byImp).length > 0) {
        report += `=================\n可以更好的部分：\n`;
        Object.keys(byImp).forEach(cat => {
            report += `【${cat}】\n`;
            byImp[cat].forEach(i => { report += `• ${i}\n`; });
            report += `\n`;
        });
    }

    if (Object.keys(byGood).length > 0) {
        report += `=================\n表現良好的部分：\n`;
        Object.keys(byGood).forEach(cat => {
            report += `【${cat}】\n`;
            byGood[cat].forEach(i => { report += `• ${i}\n`; });
            report += `\n`;
        });
    }

    const respEpa  = document.querySelector('input[name="resp_epa"]:checked');
    const intubEpa = document.querySelector('input[name="intub_epa"]:checked');
    report += `=========\nEPA評分：\n`;
    report += `呼吸困難評估：${respEpa  ? '等級' + respEpa.value  : '未評分'}\n`;
    report += `氣管內管插管：${intubEpa ? '等級' + intubEpa.value : '未評分'}\n\n`;

    if (selectedAdvices.size > 0) {
        report += `=========\n學習建議：\n`;
        selectedAdvices.forEach(t => {
            const a = adviceContent[t];
            if (a) { report += `${a.title}：\n`; a.content.forEach(i => { report += `• ${i}\n`; }); report += `\n`; }
        });
    }

    const extra = document.getElementById('additional-comments').value;
    if (extra.trim()) report += `=========\n額外建議：\n${extra}\n\n`;

    return report;
}

// 發送完整結構化資料到 GAS
function sendDataToGAS() {
    if (!APP_CONFIG.enableNotify || !APP_CONFIG.gasUrl || APP_CONFIG.gasUrl === 'https://script.google.com/macros/s/AKfycbx_HP26PxVSXpqc5Ap_C3MiOPv76uzvaJYcRe3OghOtGKXjL1JHT6a7Cw6Vnd_4l9KojA/exec') return;
    if (hasSentDataForCurrentReport) return; // 避免同一次評估重複發送

    const payload = {
        adminEmail: APP_CONFIG.adminEmail,
        studentName: document.getElementById('student-name').value || '未填寫',
        evaluator: document.getElementById('evaluator').value || '未填寫',
        evalDate: document.getElementById('eval-date').value || new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
        fullReport: buildReportText()
    };

    const improvements = [];
    const goods = [];
    document.querySelectorAll('.checkbox-item input[type="checkbox"]:checked').forEach(cb => {
        if (cb.getAttribute('data-advice')) return;
        const text = cb.parentElement.querySelector('.editable-text')?.value || cb.parentElement.querySelector('input[type="text"]')?.value || '';
        if(text) {
            if (cb.getAttribute('data-type') === 'improvement') improvements.push(`[${cb.getAttribute('data-category')}] ${text}`);
            if (cb.getAttribute('data-type') === 'good') goods.push(`[${cb.getAttribute('data-category')}] ${text}`);
        }
    });
    payload.improvements = improvements.join('\n');
    payload.goods = goods.join('\n');

    const respEpa = document.querySelector('input[name="resp_epa"]:checked');
    const intubEpa = document.querySelector('input[name="intub_epa"]:checked');
    payload.respEpa = respEpa ? respEpa.value : '未評分';
    payload.intubEpa = intubEpa ? intubEpa.value : '未評分';

    const modifications = [];
    document.querySelectorAll('.editable-text').forEach(textarea => {
        const id = textarea.closest('label')?.getAttribute('for');
        const orig = id ? originalContent[id] : null;
        const curr = textarea.value.trim();
        if (orig && curr !== orig && curr !== '') {
            modifications.push({ id: id, original: orig, modified: curr });
        }
    });
    payload.modifications = JSON.stringify(modifications);

    fetch(APP_CONFIG.gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    }).then(() => {
        console.log("資料已成功傳送至 Google Sheets");
        hasSentDataForCurrentReport = true;
    }).catch(err => console.error("傳送失敗:", err));
}

function generateReport() {
    const reportText = buildReportText();
    document.getElementById('report').textContent = reportText;
    document.getElementById('report').style.display = 'block';
    document.querySelector('.report-buttons').style.display = 'flex';
    document.getElementById('report').scrollIntoView({ behavior: 'smooth' });

    // 生成時就將所有資料發送過去 (包含 PDF 生成與 email 發送都在後端處理)
    sendDataToGAS();
}

function escapeHTML(text) {
    return text.replace(/[&<>'"]/g, t => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[t] || t));
}

function saveReport() {
    const content = document.getElementById('report').textContent;
    const name    = document.getElementById('student-name').value || '未命名學員';
    const date    = document.getElementById('eval-date').value    || new Date().toISOString().split('T')[0];
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `PGY評估報告_${name}_${date}.txt` });
    document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); a.remove();
    alert('TXT 檔已儲存！');
}

function copyReport() {
    const content = document.getElementById('report').textContent;
    navigator.clipboard.writeText(content).then(() => {
        alert('已複製到剪貼簿！');
    }).catch(() => {
        const ta = Object.assign(document.createElement('textarea'), { value: content });
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
        alert('已複製到剪貼簿！');
    });
}

function saveAsWord() {
    const content = document.getElementById('report').textContent;
    const name    = document.getElementById('student-name').value || '未命名學員';
    const date    = document.getElementById('eval-date').value    || new Date().toISOString().split('T')[0];
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset="utf-8"></head><body style="font-family:'Microsoft JhengHei',sans-serif;line-height:1.5;">${escapeHTML(content).replace(/\n/g,'<br>')}</body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `PGY評估報告_${name}_${date}.doc` });
    document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); a.remove();
    alert('Word 文檔已下載！');
}

function printReport() {
    window.print();
}

function clearForm() {
    if (!confirm('確定要重設表單嗎？')) return;
    ['student-name', 'evaluator', 'additional-comments'].forEach(id => {
        document.getElementById(id).value = '';
    });
    document.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
        cb.checked = false;
        cb.closest('.checkbox-item')?.classList.remove('checked');
    });
    document.querySelectorAll('.editable-text').forEach(ta => {
        const lbl = ta.closest('label');
        const id  = lbl ? lbl.getAttribute('for') : null;
        if (id && originalContent[id] !== undefined) {
            ta.value = originalContent[id];
            ta.style.height = 'auto';
            ta.style.height = ta.scrollHeight + 'px';
        }
    });
    document.querySelectorAll('input[type="radio"]:checked').forEach(r => {
        r.checked = false;
        r.closest('.radio-item')?.classList.remove('selected');
    });
    document.querySelectorAll('.custom-item input[type="text"]').forEach(i => { i.value = ''; });
    document.querySelectorAll('.custom-item input[type="checkbox"]').forEach(cb => { cb.disabled = true; cb.checked = false; });
    selectedAdvices.clear();
    document.querySelectorAll('.advice-group input[type="checkbox"]').forEach(cb => { cb.checked = false; });
    document.getElementById('report').style.display = 'none';
    document.querySelector('.report-buttons').style.display = 'none';
    document.getElementById('eval-date').valueAsDate = new Date();
    hasSentDataForCurrentReport = false;
    alert('表單已重設！');
}