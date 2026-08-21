/**
 * Excel Parser Module for MAEU Schedule Dashboard
 * وحدة القياس والتقويم - محرك معالجة جداول الإكسيل
 */

const ExcelParser = {
  // Arabic Month Names mapping for robust date parsing
  arabicMonths: {
    'يناير': 1, 'فبراير': 2, 'مارس': 3, 'أبريل': 4, 'مايو': 5, 'يونيو': 6,
    'يوليو': 7, 'أغسطس': 8, 'سبتمبر': 9, 'أكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12
  },

  /**
   * Parse an uploaded Excel file array buffer
   * @param {ArrayBuffer} arrayBuffer 
   * @returns {Object} Structured schedule data
   */
  parseWorkbook(arrayBuffer) {
    if (typeof XLSX === 'undefined') {
      throw new Error('مكتبة SheetJS (XLSX) غير متوفرة');
    }

    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    const result = {
      general_schedule: [],
      department_stats: [],
      hourly_density: []
    };

    // 1. Find General Schedule Sheet
    const generalSheetName = workbook.SheetNames.find(name => 
      name.includes('العام') || name.includes('الجدول') || name.includes('schedule')
    ) || workbook.SheetNames[0];

    if (generalSheetName) {
      result.general_schedule = this.parseGeneralSheet(workbook.Sheets[generalSheetName]);
    }

    // 2. Find Department Stats Sheet
    const deptSheetName = workbook.SheetNames.find(name => 
      name.includes('الأقسام') || name.includes('توزيع') || name.includes('احصائيات')
    );
    if (deptSheetName) {
      result.department_stats = this.parseDeptStatsSheet(workbook.Sheets[deptSheetName]);
    }

    // 3. Find Hourly Density Sheet
    const densitySheetName = workbook.SheetNames.find(name => 
      name.includes('كثافة') || name.includes('الساعة') || name.includes('density')
    );
    if (densitySheetName) {
      result.hourly_density = this.parseDensitySheet(workbook.Sheets[densitySheetName]);
    }

    return result;
  },

  /**
   * Parse General Schedule Worksheet
   */
  parseGeneralSheet(ws) {
    const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!rawData || rawData.length === 0) return [];

    // Locate header row containing 'اسم الأستاذ' or 'الأستاذ' or 'القسم'
    let headerRowIndex = -1;
    let headers = [];

    for (let r = 0; r < Math.min(10, rawData.length); r++) {
      const row = rawData[r].map(c => String(c).trim());
      if (row.some(c => c.includes('الأستاذ') || c.includes('القسم') || c.includes('المقرر'))) {
        headerRowIndex = r;
        headers = row;
        break;
      }
    }

    if (headerRowIndex === -1) {
      // Default to row 0 if no explicit header detected
      headerRowIndex = 0;
      headers = rawData[0].map(c => String(c).trim());
    }

    const rows = [];
    for (let r = headerRowIndex + 1; r < rawData.length; r++) {
      const rowArr = rawData[r];
      if (!rowArr || rowArr.length === 0) continue;

      const rowObj = {};
      headers.forEach((h, idx) => {
        if (h) {
          rowObj[h] = rowArr[idx] !== undefined ? String(rowArr[idx]).trim() : '';
        }
      });

      // Filter out empty rows or title rows
      const profName = rowObj['اسم الأستاذ'] || rowObj['الاسم'] || rowObj['الأستاذ'];
      if (profName && profName.length > 2 && !profName.includes('اسم الأستاذ')) {
        // Normalize fields
        const normalized = {
          'اليوم': rowObj['اليوم'] || '',
          'التاريخ': this.normalizeDateString(rowObj['التاريخ'] || ''),
          'الفترة الزمنية': this.normalizePeriodString(rowObj['الفترة الزمنية'] || rowObj['الفترة'] || ''),
          'القسم': rowObj['القسم'] || rowObj['اسم القسم'] || 'عام',
          'اسم الأستاذ': profName,
          'الدرجة العلمية': rowObj['الدرجة العلمية'] || rowObj['الدرجة'] || 'عضو هيئة تدريس',
          'اسم المقرر': rowObj['اسم المقرر'] || rowObj['المقرر'] || rowObj['المقررات'] || '-'
        };
        rows.push(normalized);
      }
    }

    return rows;
  },

  /**
   * Parse Department Stats Sheet
   */
  parseDeptStatsSheet(ws) {
    const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!rawData || rawData.length < 2) return [];

    let headerRowIndex = 1;
    let headers = rawData[headerRowIndex] ? rawData[headerRowIndex].map(c => String(c).trim()) : [];
    
    const rows = [];
    for (let r = headerRowIndex + 1; r < rawData.length; r++) {
      const rowArr = rawData[r];
      if (!rowArr || rowArr.length === 0) continue;
      const rowObj = {};
      headers.forEach((h, idx) => {
        if (h) rowObj[h] = rowArr[idx] !== undefined ? String(rowArr[idx]).trim() : '';
      });
      if (rowObj['اسم القسم'] || rowObj['القسم']) {
        rows.push(rowObj);
      }
    }
    return rows;
  },

  /**
   * Parse Hourly Density Sheet
   */
  parseDensitySheet(ws) {
    const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!rawData || rawData.length < 2) return [];

    let headerRowIndex = 1;
    let headers = rawData[headerRowIndex] ? rawData[headerRowIndex].map(c => String(c).trim()) : [];
    
    const rows = [];
    for (let r = headerRowIndex + 1; r < rawData.length; r++) {
      const rowArr = rawData[r];
      if (!rowArr || rowArr.length === 0) continue;
      const rowObj = {};
      headers.forEach((h, idx) => {
        if (h) rowObj[h] = rowArr[idx] !== undefined ? String(rowArr[idx]).trim() : '';
      });
      if (rowObj['الفترة الزمنية'] || rowObj['اليوم']) {
        rows.push(rowObj);
      }
    }
    return rows;
  },

  /**
   * Standardize date string into YYYY-MM-DD
   */
  normalizeDateString(val) {
    if (!val) return '';

    if (val instanceof Date && !isNaN(val)) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    let str = String(val).trim();

    // Case 1: Standard JS Date toString() output (e.g. "Sat Aug 29 2026 00:00:00 GMT+0300")
    if (str.includes('GMT') || str.includes('Eastern European') || str.match(/[a-zA-Z]{3}\s+[a-zA-Z]{3}\s+\d{1,2}\s+\d{4}/)) {
      const jsDate = new Date(str);
      if (!isNaN(jsDate.getTime())) {
        const y = jsDate.getFullYear();
        const m = String(jsDate.getMonth() + 1).padStart(2, '0');
        const d = String(jsDate.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    }

    // Case 2: Standard ISO like "2026-08-22" or "2026/08/22"
    const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
    }

    // Case 3: DD-MM-YYYY or DD/MM/YYYY
    const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (dmyMatch) {
      return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
    }

    // Case 4: English month name like 29-Aug-2026 or 29-Aug-26
    const engMonths = {
      'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
      'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
    };
    const engMatch = str.match(/(\d{1,2})[-/\s]+([a-zA-Z]{3,9})[-/\s]+(\d{2,4})/);
    if (engMatch) {
      const day = engMatch[1].padStart(2, '0');
      const monKey = engMatch[2].toLowerCase().substring(0, 3);
      const monNum = engMonths[monKey] || 8;
      let year = engMatch[3];
      if (year.length === 2) year = '20' + year;
      return `${year}-${String(monNum).padStart(2, '0')}-${day}`;
    }

    // Case 5: Arabic format like "29-أغسطس-26" or "السبت (29-أغسطس-26)" or "29 أغسطس 2026"
    for (const [arM, mNum] of Object.entries(this.arabicMonths)) {
      if (str.includes(arM)) {
        const mAr = str.match(/(\d{1,2})\s*[-/]?\s*([^\d\s()]+)\s*[-/]?\s*(\d{2,4})/);
        if (mAr) {
          const day = mAr[1].padStart(2, '0');
          let year = mAr[3];
          if (year.length === 2) year = '20' + year;
          return `${year}-${String(mNum).padStart(2, '0')}-${day}`;
        }
        const dayMatch = str.match(/(\d{1,2})/);
        const day = dayMatch ? dayMatch[1].padStart(2, '0') : '01';
        return `2026-${String(mNum).padStart(2, '0')}-${day}`;
      }
    }

    return str;
  },

  /**
   * Standardize period string (e.g. "2 م - 3 م")
   */
  normalizePeriodString(val) {
    if (!val) return '2 م - 3 م';
    let s = String(val).trim();
    s = s.replace(/\s+/g, ' ');
    return s;
  },

  /**
   * Get Storage Key
   */
  STORAGE_KEY: 'MAEU_SCHEDULE_DATA_V1',

  /**
   * Save to LocalStorage
   */
  saveToStorage(data) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
      return false;
    }
  },

  /**
   * Load from LocalStorage or fallback to default
   */
  loadData() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.general_schedule && parsed.general_schedule.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('LocalStorage load failed, fallback to default:', e);
    }
    return window.DEFAULT_SCHEDULE_DATA || { general_schedule: [], department_stats: [], hourly_density: [] };
  },

  /**
   * Reset data to default bundled schedule
   */
  resetToDefault() {
    localStorage.removeItem(this.STORAGE_KEY);
    return window.DEFAULT_SCHEDULE_DATA;
  }
};

window.ExcelParser = ExcelParser;
