/**
 * Schedule Tracker & Slot Matching Logic
 * وحدة القياس والتقويم - محرك تتبع ومطابقة الجداول الزمنية
 */

class MAEUScheduleTracker {
  constructor(data) {
    this.setData(data);
    this.attendanceKey = 'MAEU_ATTENDANCE_V1';
    this.attendanceRecords = this.loadAttendance();
  }

  setData(data) {
    this.data = data || { general_schedule: [], department_stats: [], hourly_density: [] };
    this.schedule = (this.data.general_schedule || []).map(row => {
      const r = { ...row };
      if (r['التاريخ'] && window.ExcelParser) {
        r['التاريخ'] = window.ExcelParser.normalizeDateString(r['التاريخ']);
      }
      return r;
    });
    this.hourlyDensity = this.data.hourly_density || [];
    this.deptStats = this.data.department_stats || [];

    // Auto-generate deptStats from hourly_density when department_stats is empty
    if (this.deptStats.length === 0 && this.hourlyDensity.length > 0) {
      this.deptStats = this.generateDeptStatsFromDensity();
    }

    this.extractUniqueMetadata();
  }

  /**
   * Generate department stats from hourly_density when department_stats is empty
   * Maps each hourly slot entry directly to the format expected by renderAnalytics()
   */
  generateDeptStatsFromDensity() {
    const monthNames = ['', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

    // Calculate total tests for weight percentage
    let totalTestsAll = 0;
    this.hourlyDensity.forEach(entry => {
      const tests = parseInt(entry['عدد الاختبارات بالساعة'] || 0, 10);
      totalTestsAll += isNaN(tests) ? 0 : tests;
    });

    // Map each hourly density entry to dept stats format
    const result = this.hourlyDensity.map(entry => {
      const dept = entry['القسم / الأقسام المجدولة'] || entry['القسم'] || '';
      const date = entry['التاريخ'] || '';
      const day = entry['اليوم'] || '';
      const period = entry['الفترة الزمنية'] || '';
      const tests = parseInt(entry['عدد الاختبارات بالساعة'] || 0, 10);
      const profs = parseInt(entry['عدد أعضاء هيئة التدريس'] || 0, 10);

      // Format date: "اليوم dd MonthName"
      let formattedDate = day;
      const dateMatch = date.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch) {
        const dayNum = parseInt(dateMatch[3], 10);
        const monthNum = parseInt(dateMatch[2], 10);
        const monthName = monthNames[monthNum] || '';
        formattedDate = `${day} ${dayNum} ${monthName}`;
      }

      const weight = totalTestsAll > 0 
        ? Math.round((tests / totalTestsAll) * 100) 
        : 0;

      return {
        'اسم القسم': dept,
        'عدد الاختبارات الإلكترونية': tests,
        'عدد أعضاء هيئة التدريس': profs,
        'الساعات المخصصة': 1,
        'الوزن النسبي (%)': weight + '%',
        'اليوم والتاريخ': formattedDate,
        'فترة الاستقبال': period,
        '_date': date
      };
    });

    // Sort chronologically by date then period start hour
    result.sort((a, b) => {
      const dateA = a._date || '';
      const dateB = b._date || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const matchA = (a['فترة الاستقبال'] || '').match(/(\d+)/);
      const matchB = (b['فترة الاستقبال'] || '').match(/(\d+)/);
      const hourA = matchA ? parseInt(matchA[1], 10) : 0;
      const hourB = matchB ? parseInt(matchB[1], 10) : 0;
      return hourA - hourB;
    });

    return result;
  }

  extractUniqueMetadata() {
    this.uniqueDays = [...new Set(this.schedule.map(r => r['اليوم']).filter(Boolean))];
    this.uniqueDates = [...new Set(this.schedule.map(r => r['التاريخ']).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    this.uniqueDepts = [...new Set(this.schedule.map(r => r['القسم']).filter(Boolean))].sort();
    this.uniquePeriods = ['2 م - 3 م', '3 م - 4 م', '4 م - 5 م', '5 م - 6 م'];
  }

  /**
   * Maps an hour (0-23) to a slot period string
   */
  getSlotFromHour(hour) {
    switch (hour) {
      case 14: return '2 م - 3 م';
      case 15: return '3 م - 4 م';
      case 16: return '4 م - 5 م';
      case 17: return '5 م - 6 م';
      default: return null;
    }
  }

  /**
   * Maps slot period string back to starting hour
   */
  getHourFromSlot(period) {
    if (period.includes('2 م') || period.includes('2-3')) return 14;
    if (period.includes('3 م') || period.includes('3-4')) return 15;
    if (period.includes('4 م') || period.includes('4-5')) return 16;
    if (period.includes('5 م') || period.includes('5-6')) return 17;
    return 14;
  }

  /**
   * Get Next Period string from current
   */
  getNextPeriod(currentPeriod) {
    const idx = this.uniquePeriods.indexOf(currentPeriod);
    if (idx !== -1 && idx < this.uniquePeriods.length - 1) {
      return this.uniquePeriods[idx + 1];
    }
    return null;
  }

  /**
   * Find professors matching a specific date and period
   */
  getProfessorsForSlot(dateStr, periodStr) {
    if (!dateStr || !periodStr) return [];
    
    // Extract starting hour from period string for robust comparison
    const getStartHour = (p) => {
      if (!p) return -1;
      const m = String(p).match(/^(\d+)/);
      return m ? parseInt(m[1], 10) : -1;
    };
    const targetStartHour = getStartHour(periodStr);
    
    return this.schedule.filter(item => {
      const matchDate = this.matchDate(item['التاريخ'], dateStr);
      // Exact string match first, then compare starting hour only
      const itemPeriod = item['الفترة الزمنية'];
      const matchPeriod = itemPeriod === periodStr || 
                          getStartHour(itemPeriod) === targetStartHour;
      return matchDate && matchPeriod;
    });
  }

  /**
   * Robust date matching comparing ISO, Arabic date, or day numbers
   */
  matchDate(itemDate, targetDate) {
    if (!itemDate || !targetDate) return false;
    const cleanItem = String(itemDate).trim();
    const cleanTarget = String(targetDate).trim();

    if (cleanItem === cleanTarget) return true;

    // Compare year-month-day
    const itemMatch = cleanItem.match(/(\d{4})-(\d{2})-(\d{2})/);
    const targetMatch = cleanTarget.match(/(\d{4})-(\d{2})-(\d{2})/);

    if (itemMatch && targetMatch) {
      return itemMatch[0] === targetMatch[0];
    }

    // Compare day number if in August 2026
    const dayItemMatch = cleanItem.match(/(\d{1,2})/);
    const dayTargetMatch = cleanTarget.match(/(\d{1,2})/);
    if (dayItemMatch && dayTargetMatch) {
      return parseInt(dayItemMatch[1], 10) === parseInt(dayTargetMatch[1], 10);
    }

    return false;
  }

  /**
   * Find Next Scheduled Slot if currently outside working hours
   */
  findNextUpcomingSlot(currentDate) {
    const currHour = currentDate.getHours();
    const isoToday = currentDate.toISOString().split('T')[0];

    // Check today's remaining slots
    if (currHour < 14) {
      const profs = this.getProfessorsForSlot(isoToday, '2 م - 3 م');
      if (profs.length > 0) {
        return { date: isoToday, period: '2 م - 3 م', profs: profs, reason: 'اليوم تبدأ أول فترة في تمام الساعة 2:00 ظهراً' };
      }
    }

    // Look for next available dates in schedule
    for (const dt of this.uniqueDates) {
      for (const p of this.uniquePeriods) {
        const profs = this.getProfessorsForSlot(dt, p);
        if (profs.length > 0) {
          return { date: dt, period: p, profs: profs, reason: `أقرب فترة مجدولة (${dt} - ${p})` };
        }
      }
    }

    return null;
  }

  /**
   * Split multiple courses into badges
   */
  parseCourses(courseStr) {
    if (!courseStr || courseStr === '-') return [];
    // Split by comma or plus sign outside brackets
    const parts = courseStr.split(/,|\n/).map(s => s.trim()).filter(Boolean);
    return parts.length > 0 ? parts : [courseStr];
  }

  /**
   * Attendance Tracking
   */
  loadAttendance() {
    try {
      const saved = localStorage.getItem(this.attendanceKey);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  }

  saveAttendance() {
    try {
      localStorage.setItem(this.attendanceKey, JSON.stringify(this.attendanceRecords));
    } catch (e) {
      console.warn('Could not save attendance to localStorage');
    }
  }

  getAttendanceStatus(date, slot, profName) {
    const key = `${date}_${slot}_${profName}`;
    return this.attendanceRecords[key] || false;
  }

  toggleAttendance(date, slot, profName) {
    const key = `${date}_${slot}_${profName}`;
    this.attendanceRecords[key] = !this.attendanceRecords[key];
    this.saveAttendance();
    return this.attendanceRecords[key];
  }

  /**
   * Filter General Schedule with Search and Criteria
   */
  searchSchedule(query = '', filterDept = '', filterDay = '', filterDegree = '') {
    const q = query.trim().toLowerCase();

    return this.schedule.filter(row => {
      if (filterDept && row['القسم'] !== filterDept) return false;
      if (filterDay && row['اليوم'] !== filterDay) return false;
      if (filterDegree && row['الدرجة العلمية'] !== filterDegree) return false;

      if (q) {
        const name = (row['اسم الأستاذ'] || '').toLowerCase();
        const course = (row['اسم المقرر'] || '').toLowerCase();
        const dept = (row['القسم'] || '').toLowerCase();
        return name.includes(q) || course.includes(q) || dept.includes(q);
      }

      return true;
    });
  }

  /**
   * Compute Overall Metrics (710 Tests, 460 Faculty Members, 32 Hours, 8 Days, 17 Depts)
   */
  getOverallMetrics() {
    let totalTests = 0;
    let totalProfsFromStats = 0;

    if (this.deptStats && this.deptStats.length > 0) {
      this.deptStats.forEach(d => {
        const tests = parseInt(d['عدد الاختبارات الإلكترونية'] || 0, 10);
        const profs = parseInt(d['عدد أعضاء هيئة التدريس'] || 0, 10);
        if (!isNaN(tests)) totalTests += tests;
        if (!isNaN(profs)) totalProfsFromStats += profs;
      });
    }

    if (totalTests === 0) totalTests = 710;
    const totalHours = 32; // 8 days × 4 hours/day = 32 hours total
    const totalRecords = this.schedule.length || totalProfsFromStats || 460;
    const totalDepts = this.deptStats.length || this.uniqueDepts.length || 17;
    
    // 8 official scheduled reception days as defined in department distribution
    const deptDates = new Set(this.deptStats.map(d => d['اليوم والتاريخ']).filter(Boolean));
    const totalDays = deptDates.size > 0 ? deptDates.size : 8;

    return {
      totalTests,
      totalHours,
      totalRecords,
      totalProfs: totalRecords,
      totalDepts,
      totalDays
    };
  }
}

window.MAEUScheduleTracker = MAEUScheduleTracker;
