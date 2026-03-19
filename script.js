// ================= 設定區 =================
const SHEET_ID = '1YebXuJ_H-QIas6W6E2WeqYzB7A3Oo3MmeKg87vcjPuw';
const FOLDER_ID = '19kP-bxfC81_67Scaf5ghQW2jvsM20kS1';
// ==========================================

// 接收來自評估表單的資料 (POST 請求)
function doPost(e) {
  try {
    // ✅ 修正1：改從 e.parameter.payload 接收 FormData 傳來的資料
    const data = JSON.parse(e.parameter.payload);
    const ss = SpreadsheetApp.openById(SHEET_ID);

    // 1. 寫入「完整紀錄」分頁
    let recordSheet = ss.getSheetByName("完整紀錄");
    if (!recordSheet) {
      recordSheet = ss.insertSheet("完整紀錄");
      recordSheet.appendRow(["時間戳記", "評估者", "學員", "評估日期", "呼吸EPA", "插管EPA", "待改進項目", "表現良好項目"]);
    }
    recordSheet.appendRow([
      data.timestamp, data.evaluator, data.studentName, data.evalDate,
      data.respEpa, data.intubEpa, data.improvements, data.goods
    ]);

    // 2. 寫入「修改追蹤」分頁
    const mods = JSON.parse(data.modifications || "[]");
    if (mods.length > 0) {
      let modSheet = ss.getSheetByName("修改追蹤");
      if (!modSheet) {
        modSheet = ss.insertSheet("修改追蹤");
        modSheet.appendRow(["時間戳記", "評估者", "項目ID", "原始文字", "修改後文字"]);
      }
      mods.forEach(function(m) {
        modSheet.appendRow([data.timestamp, data.evaluator, m.id, m.original, m.modified]);
      });
    }

    // 3. 產出 PDF 並存檔至雲端硬碟，同時取回 blob 供 email 附件使用
    // ✅ 修正2：createPDF 同時回傳 url 和 blob，避免 email 附件需要再次搜尋檔案
    const pdf = createPDF(data.studentName, data.evalDate, data.fullReport);

    // 4. 發送 Email 給管理者
    if (data.adminEmail) {
      const subject = '[PGY臨床評估] ' + data.studentName + ' 的呼吸道評估已完成';
      const body = '評估者：' + data.evaluator + '\n學員：' + data.studentName + '\n日期：' + data.evalDate + '\n\n報告 PDF 已自動存檔，連結如下：\n' + pdf.url;

      MailApp.sendEmail({
        to: data.adminEmail,
        subject: subject,
        body: body,
        // ✅ 修正3：直接使用剛建立的 blob，不再透過 Drive 搜尋（避免索引延遲）
        attachments: [pdf.blob]
      });
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 接收來自儀表板的讀取要求 (GET 請求)
function doGet(e) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName("完整紀錄");

  // 如果沒有資料表，回傳空資料格式
  if (!sheet) {
    return ContentService
      .createTextOutput(JSON.stringify({
        totalEvaluations: 0,
        epaStats: {
          resp:  { '1':0, '2':0, '3':0, '4':0, '5':0 },
          intub: { '1':0, '2':0, '3':0, '4':0, '5':0 }
        },
        rawImprovements: []
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const data = sheet.getDataRange().getValues();
  data.shift(); // 移除標題列

  var epaStats = {
    resp:  { '1':0, '2':0, '3':0, '4':0, '5':0 },
    intub: { '1':0, '2':0, '3':0, '4':0, '5':0 }
  };
  var rawImprovements = [];

  data.forEach(function(row) {
    // 統計 EPA（欄位中可能含「等級」文字，一併去除）
    var rEpa = String(row[4]).replace('等級', '').trim();
    var iEpa = String(row[5]).replace('等級', '').trim();
    if (epaStats.resp[rEpa]  !== undefined) epaStats.resp[rEpa]++;
    if (epaStats.intub[iEpa] !== undefined) epaStats.intub[iEpa]++;

    // 收集第 G 欄（索引 6）的「待改進項目」
    if (row[6]) {
      rawImprovements.push(row[6].toString());
    }
  });

  var result = {
    totalEvaluations: data.length,
    epaStats: epaStats,
    rawImprovements: rawImprovements
  };

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- 輔助函數：將純文字轉換為 PDF 並存入 Drive ---
// ✅ 修正4：回傳物件 { url, blob }，讓 doPost 可直接取用 blob 作為 email 附件
function createPDF(studentName, date, reportText) {
  var folder = DriveApp.getFolderById(FOLDER_ID);

  // 建立暫存 Google Doc
  var tempDoc = DocumentApp.create('TEMP_' + studentName + '_' + date);
  var body = tempDoc.getBody();
  // ✅ 修正5：改用 setText() 取代 insertParagraph(0,...)，更穩定
  body.setText(reportText);
  tempDoc.saveAndClose();

  // ✅ 修正6：透過 DriveApp.getFileById() 取得 File 物件後再呼叫 getAs()
  //    （DocumentApp 的 Document 物件不支援 getAs()）
  var docFile = DriveApp.getFileById(tempDoc.getId());
  var pdfBlob = docFile.getAs(MimeType.PDF);
  pdfBlob.setName('PGY評估_' + studentName + '_' + date + '.pdf');

  // 將 PDF 存入指定資料夾
  var pdfFile = folder.createFile(pdfBlob);

  // 刪除暫存 Google Doc
  docFile.setTrashed(true);

  return {
    url:  pdfFile.getUrl(),
    blob: pdfBlob
  };
}
