const SPREADSHEET_ID = '1jSwHR5eaN7NP29-4JJSNTC2owf_ufrcB47jLMzUsNLk';
const SHEET_NAME = 'MOVIMIENTOS';

function getSheet() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME);
  return sheet || spreadsheet.getSheets()[0];
}

function buildJsonOutput(payload) {
  const output = ContentService.createTextOutput(JSON.stringify(payload));
  output.setMimeType(ContentService.MimeType.JSON);
  output.setHeader('Access-Control-Allow-Origin', '*');
  output.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  output.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return output;
}

function normalizeRow(obj) {
  return {
    Timestamp: obj.Timestamp || obj.timestamp || '',
    'Datos Personales': obj['Datos Personales'] || obj.datosPersonales || '',
    Empresa: obj.Empresa || obj.empresa || '',
    'Código de Farmacia': obj['Código de Farmacia'] || obj['CODIGO DE FARMACIA'] || obj.codigoFarmacia || '',
    Sector: obj.Sector || obj.sector || '',
    'Anfitrión': obj['Anfitrión'] || obj.anfitrion || '',
    Observaciones: obj.Observaciones || obj.observaciones || '',
    'Modo Evento': obj['Modo Evento'] || obj.modoEvento ? 'SI' : 'NO'
  };
}

function doGet(e) {
  const sheet = getSheet();
  const values = sheet.getDataRange().getDisplayValues();

  if (values.length <= 1) {
    return buildJsonOutput([]);
  }

  const headers = values[0];
  const rows = values.slice(1).map((row) => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] || '';
    });
    return normalizeRow(obj);
  });

  return buildJsonOutput(rows);
}

function doPost(e) {
  try {
    const payload = typeof e.postData.contents === 'string' ? JSON.parse(e.postData.contents) : {};
    const sheet = getSheet();

    const nextRow = sheet.getLastRow() + 1;
    sheet.getRange(nextRow, 1, 1, 9).setValues([[
      new Date(),
      payload.datosPersonales || '',
      payload.empresa || '',
      payload.sector || '',
      payload.anfitrion || '',
      payload.observaciones || 'SIN OBSERVACIONES',
      payload.modoEvento ? 'SI' : 'NO',
      '',
      payload.codigoFarmacia || ''
    ]]);
    return buildJsonOutput({ success: true, message: 'OK' });
  } catch (error) {
    return buildJsonOutput({ success: false, message: error.message });
  }
}

function doOptions(e) {
  return buildJsonOutput({ success: true });
}
