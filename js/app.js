/**
 * Main Application Orchestrator
 * وحدة القياس والتقويم - التطبيق الرئيسي وشاشة الاستقبال
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Lucide Icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // 2. State & Data
  const rawData = window.ExcelParser ? window.ExcelParser.loadData() : window.DEFAULT_SCHEDULE_DATA;
  const tracker = new MAEUScheduleTracker(rawData);

  let currentView = 'reception'; // 'reception' | 'calendar' | 'stats' | 'upload'
  let isSimulatedMode = false;
  let activeSimulationDay = null; // e.g. "2026-08-23"
  let activeSimulationPeriod = null; // e.g. "2 م - 3 م"
  let activeAutoScrollTimers = [];

  // 3. Messages for Top Continuous Marquee (Right to Left)
  const tickerMessages = [
    { text: "مرحباً بكم في وحدة القياس والتقويم", icon: "sparkles" },
    { text: "«أهلاً وسهلاً بكم.. نرجو الحفاظ على سرية بيانات الدخول وتحديث كلمة المرور الخاصة بكم.»", icon: "shield-check" },
    { text: "«يُرجى التكرم بمراجعة نصوص الأسئلة، بدائل الإجابة، والدرجات بدقة قبل الاعتماد.»", icon: "check-check" },
    { text: "«نثمّن حرصكم العالي على سرية وخصوصية محتوى الاختبارات الأكاديمية.»", icon: "award" },
    { text: "«حرصاً على أمان بياناتكم، يُرجى مسح أي مسودات أو ملفات خاصة بالاختبار من الجهاز بعد الانتهاء.»", icon: "trash-2" },
    { text: "«تأكدوا من تسجيل الخروج من حسابكم قبل المغادرة.. وفريق وحدة القياس والتقويم دائماً في خدمتكم.»", icon: "log-out" }
  ];

  function setupContinuousMarquee() {
    const marqueeTrack = document.getElementById('marquee-track');
    if (!marqueeTrack) return;

    // Duplicate messages twice for seamless infinite marquee loop moving Right to Left
    const allMsgs = [...tickerMessages, ...tickerMessages];
    marqueeTrack.innerHTML = allMsgs.map(msg => `
      <span class="marquee-msg-item">
        <i data-lucide="${msg.icon}"></i>
        <span>${msg.text}</span>
      </span>
      <span class="marquee-separator">✦</span>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  setupContinuousMarquee();

  // 4. Automated Continuous Vertical Auto-Scroll Engine for Reception, Calendar & Stats Screens
  let activeScrollAnimIds = [];
  function initTableAutoScroll() {
    activeScrollAnimIds.forEach(id => cancelAnimationFrame(id));
    activeScrollAnimIds = [];
    activeAutoScrollTimers.forEach(t => clearTimeout(t));
    activeAutoScrollTimers = [];

    // Give DOM a frame to compute clientHeight/scrollHeight
    setTimeout(() => {
      const viewports = document.querySelectorAll('.table-scroll-viewport, #view-stats');
      viewports.forEach(viewport => {
        if (viewport.scrollHeight > viewport.clientHeight + 15) {
          let currentPos = viewport.scrollTop;
          let direction = 1; // 1 = down, -1 = up
          let isPaused = false;
          let isHovered = false;
          let lastProgrammaticTime = 0;
          let manualPauseTimer = null;
          let lastTime = performance.now();
          const speedDown = 50; // Smooth, steady reading speed (50 pixels/sec)
          const speedUp = 120; // Prompt, smooth return speed (120 pixels/sec)

          function triggerManualPause() {
            isPaused = true;
            currentPos = viewport.scrollTop;

            if (manualPauseTimer) {
              clearTimeout(manualPauseTimer);
            }
            manualPauseTimer = setTimeout(() => {
              isPaused = false;
              lastTime = performance.now();
              currentPos = viewport.scrollTop;
              const maxScroll = viewport.scrollHeight - viewport.clientHeight;
              if (currentPos >= maxScroll - 10) {
                direction = -1;
              } else if (currentPos <= 10) {
                direction = 1;
              }
            }, 10000); // 10 seconds pause upon user manual scroll
            activeAutoScrollTimers.push(manualPauseTimer);
          }

          // User interaction listeners
          viewport.onmouseenter = () => { isHovered = true; };
          viewport.onmouseleave = () => { isHovered = false; };
          viewport.addEventListener('wheel', () => triggerManualPause(), { passive: true });
          viewport.addEventListener('touchmove', () => triggerManualPause(), { passive: true });
          viewport.addEventListener('pointerdown', () => triggerManualPause());
          viewport.addEventListener('keydown', () => triggerManualPause());

          // Track manual scrollbar drag (only when delta from auto-scroll is significant and not triggered by script)
          viewport.addEventListener('scroll', () => {
            const timeSinceProg = performance.now() - lastProgrammaticTime;
            const diff = Math.abs(viewport.scrollTop - currentPos);
            if (timeSinceProg > 150 && diff > 2) {
              triggerManualPause();
            }
          });

          function step(time) {
            const dt = Math.min((time - lastTime) / 1000, 0.1);
            lastTime = time;

            if (!isPaused && !isHovered) {
              const maxScroll = viewport.scrollHeight - viewport.clientHeight;
              if (direction === 1) {
                currentPos += speedDown * dt;
                if (currentPos >= maxScroll) {
                  currentPos = maxScroll;
                  lastProgrammaticTime = performance.now();
                  viewport.scrollTop = maxScroll;
                  isPaused = true;
                  const tId = setTimeout(() => {
                    direction = -1;
                    isPaused = false;
                    lastTime = performance.now();
                  }, 2500); // 2.5 seconds pause at bottom
                  activeAutoScrollTimers.push(tId);
                } else {
                  lastProgrammaticTime = performance.now();
                  viewport.scrollTop = currentPos;
                }
              } else {
                currentPos -= speedUp * dt;
                if (currentPos <= 0) {
                  currentPos = 0;
                  lastProgrammaticTime = performance.now();
                  viewport.scrollTop = 0;
                  isPaused = true;
                  const tId = setTimeout(() => {
                    direction = 1;
                    isPaused = false;
                    lastTime = performance.now();
                  }, 2000); // 2 seconds pause at top
                  activeAutoScrollTimers.push(tId);
                } else {
                  lastProgrammaticTime = performance.now();
                  viewport.scrollTop = currentPos;
                }
              }
            } else if (isHovered) {
              currentPos = viewport.scrollTop;
            }

            const nextId = requestAnimationFrame(step);
            activeScrollAnimIds.push(nextId);
          }

          const firstId = requestAnimationFrame(step);
          activeScrollAnimIds.push(firstId);
        }
      });
    }, 250);
  }

  // Title Prefix Helper (أ.د. / أ.م.د. / د. / م.م.)
  function formatProfNameWithTitle(name, degree) {
    if (!name) return '';
    let cleanName = name.trim();
    cleanName = cleanName.replace(/^(أ\.د\.|أ\.م\.د\.|د\.|أستاذ دكتور|أستاذ|دكتور)\s*/i, '');

    let prefix = 'د. ';
    if (degree) {
      const deg = degree.trim();
      if (deg === 'أستاذ') {
        prefix = 'أ.د. ';
      } else if (deg === 'أستاذ مساعد') {
        prefix = 'أ.م.د. ';
      } else if (deg === 'مدرس') {
        prefix = 'د. ';
      } else if (deg === 'مدرس مساعد') {
        prefix = 'م.م. ';
      } else if (deg.includes('أستاذ مساعد')) {
        prefix = 'أ.م.د. ';
      } else if (deg.includes('أستاذ')) {
        prefix = 'أ.د. ';
      }
    }

    return `<span class="prof-title-prefix">${prefix}</span><span class="prof-actual-name">${cleanName}</span>`;
  }

  // 5. Reception Slot View Rendering (Streamlined 3-Column Table Format)
  function renderSlotDetails(targetDate, targetSlot, nowObj) {
    const slotRangeEl = document.getElementById('current-slot-range');
    const slotStatusPill = document.getElementById('current-slot-status-pill');
    const activeDeptTitle = document.getElementById('current-slot-dept-name') || document.getElementById('active-department-name');
    const tablesContainer = document.getElementById('reception-tables-container') || document.getElementById('current-profs-container');
    const countProfsEl = document.getElementById('stat-slot-profs-count');
    const countDeptsEl = document.getElementById('stat-slot-depts-count');

    let profs = [];
    let isActiveSession = false;

    if (targetSlot) {
      profs = tracker.getProfessorsForSlot(targetDate, targetSlot);
      isActiveSession = profs.length > 0;
    }

    if (slotRangeEl) {
      slotRangeEl.innerHTML = targetSlot 
        ? `<i data-lucide="clock"></i> الفترة: ${targetSlot}` 
        : `<i data-lucide="moon"></i> خارج فترات الاستقبال الرسمية`;
    }

    // Update the period badge text dynamically
    const slotBadgeText = document.getElementById('current-slot-badge-text');
    if (slotBadgeText) {
      if (targetSlot) {
        // Convert "3 م - 4 م" to "فترة 3:00 م - 4:00 م"
        const formatted = targetSlot.replace(/(\d+)\s*م/g, '$1:00 م');
        slotBadgeText.textContent = `فترة ${formatted}`;
      } else {
        slotBadgeText.textContent = 'خارج الفترات';
      }
    }

    if (slotStatusPill) {
      if (isActiveSession) {
        slotStatusPill.className = 'slot-status-pill slot-status-active';
        slotStatusPill.innerHTML = `<i data-lucide="radio"></i> فترة جارية الآن`;
      } else {
        slotStatusPill.className = 'slot-status-pill slot-status-inactive';
        slotStatusPill.innerHTML = `<i data-lucide="pause-circle"></i> لا توجد جلسة نشطة`;
      }
    }

    // Extract unique departments in this slot
    const slotDepts = [...new Set(profs.map(p => p['القسم']).filter(Boolean))];
    if (activeDeptTitle) {
      activeDeptTitle.textContent = slotDepts.length > 0 
        ? slotDepts.join(' + ') 
        : 'لا توجد أقسام مجدولة في هذه الساعة';
    }

    if (countProfsEl) countProfsEl.textContent = profs.length;
    if (countDeptsEl) countDeptsEl.textContent = slotDepts.length;

    // Render Streamlined Reception Table (Single-Screen Fit)
    if (tablesContainer) {
      if (profs.length === 0) {
        tablesContainer.className = 'reception-tables-container';
        const upcoming = tracker.findNextUpcomingSlot(nowObj);
        tablesContainer.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem 1.5rem;" class="glass-panel">
            <div style="font-size: 2.5rem; color: var(--brand-amber-400); margin-bottom: 0.5rem;">
              <i data-lucide="calendar-clock"></i>
            </div>
            <h3 style="font-size: 1.3rem; font-weight: 800; margin-bottom: 0.4rem;">
              ${targetSlot ? 'لا يوجد أساتذة مجدولون في هذه الساعة المحددة' : 'لا توجد فترات استقبال جارية في الوقت الراهن'}
            </h3>
            <p style="color: var(--text-secondary); max-width: 600px; margin: 0 auto 1rem; font-size: 0.9rem;">
              ${upcoming ? `الجلسة القادمة المجدولة: <strong>${upcoming.reason}</strong> (${upcoming.profs.length} أستاذ)` : 'ساعات العمل الرسمية لاستقبال الأساتذة هي من 2:00 م حتى 6:00 م.'}
            </p>
            <button class="btn-primary" id="btn-quick-preview-first" style="margin: 0 auto; padding: 0.5rem 1.25rem; font-size: 0.9rem;">
              <i data-lucide="eye"></i> معاينة جدول أول يوم (${tracker.uniqueDates[0] || 'الأحد'})
            </button>
          </div>
        `;
        const previewBtn = document.getElementById('btn-quick-preview-first');
        if (previewBtn) {
          previewBtn.addEventListener('click', () => {
            const firstDate = tracker.uniqueDates[0] || '2026-08-23';
            setSimulation(firstDate, '2 م - 3 م');
          });
        }
      } else {
        // Build streamlined table rows (Name with title prefix + Department only)
        const renderTableRows = (items, startIdx) => {
          return items.map((prof, i) => `
            <tr>
              <td style="width: 38px; text-align: center;">
                <span class="prof-idx-badge">${startIdx + i + 1}</span>
              </td>
              <td>
                <div class="prof-table-name">${formatProfNameWithTitle(prof['اسم الأستاذ'], prof['الدرجة العلمية'])}</div>
              </td>
              <td style="width: 150px;">
                <span class="prof-table-dept" title="${prof['القسم']}">${prof['القسم']}</span>
              </td>
            </tr>
          `).join('');
        };

        const renderTableHeader = () => `
          <thead>
            <tr>
              <th style="width: 38px; text-align: center;">م</th>
              <th>اسم الأستاذ</th>
              <th style="width: 150px;">القسم</th>
            </tr>
          </thead>
        `;

        const renderCardHtml = (items, startIdx) => `
          <div class="reception-table-card">
            <div class="table-scroll-viewport">
              <table class="reception-table">
                ${renderTableHeader()}
                <tbody>
                  ${renderTableRows(items, startIdx)}
                </tbody>
              </table>
            </div>
          </div>
        `;

        const count = profs.length;
        if (count <= 6) {
          // Single table
          tablesContainer.className = 'reception-tables-container';
          tablesContainer.innerHTML = renderCardHtml(profs, 0);
        } else if (count <= 10) {
          // Dual column
          tablesContainer.className = 'reception-tables-container dual-column';
          const midPoint = Math.ceil(count / 2);
          const col1 = profs.slice(0, midPoint);
          const col2 = profs.slice(midPoint);
          tablesContainer.innerHTML = renderCardHtml(col1, 0) + renderCardHtml(col2, midPoint);
        } else {
          // 3 Columns side-by-side (Ideal for 12 to 40 professors)
          tablesContainer.className = 'reception-tables-container triple-column';
          const size1 = Math.ceil(count / 3);
          const size2 = Math.ceil((count - size1) / 2);
          const col1 = profs.slice(0, size1);
          const col2 = profs.slice(size1, size1 + size2);
          const col3 = profs.slice(size1 + size2);

          tablesContainer.innerHTML = 
            renderCardHtml(col1, 0) + 
            renderCardHtml(col2, size1) + 
            renderCardHtml(col3, size1 + size2);
        }
      }
    }

    // Initialize Auto-Scroll if list overflows available height
    initTableAutoScroll();

    if (window.lucide) window.lucide.createIcons();
  }

  // 5.5 Render Mini Reception Display (Pure Names Display - Ultra Clean)
  function renderMiniReceptionUI(targetDate, targetPeriod, now) {
    const miniDeptTitle = document.getElementById('mini-dept-title');
    const miniDateDisplay = document.getElementById('mini-date-display');
    const miniPeriodDisplay = document.getElementById('mini-period-display');
    const miniClockTime = document.getElementById('mini-clock-time');
    const miniProfsCount = document.getElementById('mini-profs-count');
    const miniNamesGrid = document.getElementById('mini-names-grid');

    if (!miniNamesGrid) return;

    const currNow = now || (typeof clock !== 'undefined' && clock ? clock.getCurrentTime() : new Date());
    if (miniClockTime) {
      const hr = currNow.getHours();
      const min = String(currNow.getMinutes()).padStart(2, '0');
      const ap = hr >= 12 ? 'م' : 'ص';
      const dHr = String(hr % 12 || 12).padStart(2, '0');
      miniClockTime.textContent = `${dHr}:${min} ${ap}`;
    }

    let activeDate = targetDate;
    let activePeriod = targetPeriod;

    if (!isSimulatedMode && !activePeriod) {
      const currentHour = currNow.getHours();
      activePeriod = tracker.getSlotFromHour(currentHour);
      activeDate = currNow.toISOString().split('T')[0];
    }

    if (!activePeriod && !isSimulatedMode) {
      const nextSlot = tracker.findNextUpcomingSlot(currNow);
      if (nextSlot) {
        activeDate = nextSlot.date;
        activePeriod = nextSlot.period;
        const depts = nextSlot.profs ? [...new Set(nextSlot.profs.map(p => p['القسم']).filter(Boolean))].join('، ') : '';
        if (miniDeptTitle) miniDeptTitle.textContent = `الفترة القادمة: ${depts || 'استقبال الأساتذة'}`;
      } else {
        if (miniDeptTitle) miniDeptTitle.textContent = 'خارج أوقات العمل الرسمية';
      }
    }

    const profs = tracker.getProfessorsForSlot(activeDate, activePeriod);

    if (miniDateDisplay) miniDateDisplay.textContent = formatDatePillLabel(activeDate) || activeDate || 'اليوم';
    if (miniPeriodDisplay) miniPeriodDisplay.textContent = activePeriod || 'غير محدد';
    if (miniProfsCount) miniProfsCount.textContent = profs.length;

    if (profs.length > 0) {
      const uniqueDeptsInSlot = [...new Set(profs.map(p => p['القسم']).filter(Boolean))];
      if (miniDeptTitle && (!miniDeptTitle.textContent.includes('الفترة القادمة') || isSimulatedMode)) {
        miniDeptTitle.textContent = uniqueDeptsInSlot.length > 0 ? uniqueDeptsInSlot.join(' - ') : 'استقبال الأساتذة في الوقت الحالي';
      }

      miniNamesGrid.innerHTML = profs.map((item, idx) => `
        <div class="mini-prof-card">
          <span class="mini-prof-index">${idx + 1}</span>
          <div class="mini-prof-details">
            <div class="mini-prof-name">${formatProfNameWithTitle(item['اسم الأستاذ'], item['الدرجة العلمية'])}</div>
            <div class="mini-prof-dept"><i data-lucide="building"></i> ${item['القسم']}</div>
          </div>
        </div>
      `).join('');
    } else {
      miniNamesGrid.innerHTML = `
        <div class="mini-empty-state">
          <i data-lucide="calendar-x" class="mini-empty-icon"></i>
          <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.35rem;">لا توجد مواعيد استقبال في هذه الفترة</h3>
          <p style="font-size: 0.9rem;">يمكنك مراجعة الجدول الزمني العام لمعرفة مواعيد استقبال الأقسام.</p>
        </div>
      `;
    }

    if (window.lucide) window.lucide.createIcons();
    initTableAutoScroll();
  }

  function refreshReceptionView(now) {
    const currentHour = now.getHours();
    const currentSlot = tracker.getSlotFromHour(currentHour);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const isoDate = `${year}-${month}-${day}`;
    renderSlotDetails(isoDate, currentSlot, now);
    renderMiniReceptionUI(isoDate, currentSlot, now);
  }

  function renderCurrentSlotUI() {
    const now = clock.getCurrentTime();
    if (isSimulatedMode) {
      renderSlotDetails(activeSimulationDay, activeSimulationPeriod, now);
      renderMiniReceptionUI(activeSimulationDay, activeSimulationPeriod, now);
    } else {
      refreshReceptionView(now);
    }
  }

  // Date Pill Label Formatter Helper (e.g. "2026-08-29" -> "29 أغسطس")
  function formatDatePillLabel(dateStr) {
    if (!dateStr) return '';
    const norm = window.ExcelParser ? window.ExcelParser.normalizeDateString(dateStr) : dateStr;
    const m = norm.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const day = parseInt(m[3], 10);
      const monthNames = ['', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
      const month = monthNames[parseInt(m[2], 10)] || 'أغسطس';
      return `${day} ${month}`;
    }
    return norm;
  }

  // 6. Simulation Toolbar Days & Slots Setup
  function buildSimulationToolbar() {
    const daysContainer = document.getElementById('quick-days-list');
    if (!daysContainer) return;

    daysContainer.innerHTML = '';
    const availableDates = tracker.uniqueDates;

    availableDates.forEach((dt, idx) => {
      const btn = document.createElement('button');
      btn.className = `day-pill-btn ${idx === 0 && isSimulatedMode ? 'active' : ''}`;
      btn.textContent = formatDatePillLabel(dt);
      btn.title = dt;
      btn.dataset.date = dt;

      btn.addEventListener('click', () => {
        setSimulation(dt, activeSimulationPeriod || '2 م - 3 م');
      });
      daysContainer.appendChild(btn);
    });

    const slotHourBtns = document.querySelectorAll('.slot-hour-btn');
    slotHourBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const period = btn.dataset.period;
        setSimulation(activeSimulationDay || availableDates[0] || '2026-08-23', period);
      });
    });
  }

  function setSimulation(dateStr, periodStr) {
    const isNewSlot = (activeSimulationPeriod !== periodStr || activeSimulationDay !== dateStr);

    isSimulatedMode = true;
    activeSimulationDay = dateStr;
    activeSimulationPeriod = periodStr;

    const syncIndicator = document.getElementById('sync-indicator');
    const syncLabel = document.getElementById('sync-label');
    if (syncIndicator) syncIndicator.className = 'sync-status-indicator simulated';
    if (syncLabel) syncLabel.textContent = 'وضع المحاكاة اليدوي';

    document.querySelectorAll('.day-pill-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.date === dateStr);
    });
    document.querySelectorAll('.slot-hour-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.period === periodStr);
    });

    const hour = tracker.getHourFromSlot(periodStr);
    const mockDate = new Date();
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      mockDate.setFullYear(parseInt(parts[0], 10));
      mockDate.setMonth(parseInt(parts[1], 10) - 1);
      mockDate.setDate(parseInt(parts[2], 10));
    }
    mockDate.setHours(hour, 15, 0);
    clock.setSimulatedTime(mockDate);

    renderCurrentSlotUI();

    // Play chime exactly once upon changing to a new slot
    if (isNewSlot && clock) {
      clock.playChime('slot_start');
    }
  }

  function resetToLive() {
    isSimulatedMode = false;
    activeSimulationDay = null;
    activeSimulationPeriod = null;

    const syncIndicator = document.getElementById('sync-indicator');
    const syncLabel = document.getElementById('sync-label');
    if (syncIndicator) syncIndicator.className = 'sync-status-indicator';
    if (syncLabel) syncLabel.textContent = 'التزامن التلقائي اللحظي (حي)';

    document.querySelectorAll('.day-pill-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.slot-hour-btn').forEach(b => b.classList.remove('active'));

    clock.resetToLiveTime();
    renderCurrentSlotUI();
    if (clock) clock.playChime('slot_start');
    showToast('تم العودة إلى وضع التتبع المباشر للوقت الحالي', 'check');
  }

  const liveSyncBtn = document.getElementById('btn-reset-live');
  if (liveSyncBtn) {
    liveSyncBtn.addEventListener('click', resetToLive);
  }

  // 7. Initialize Digital Clock
  const clock = new MAEUClock({
    onTick: (now, timeInfo) => {
      if (!isSimulatedMode) {
        refreshReceptionView(now);
      }
    },
    onHourChange: (now) => {
      showToast('بداية فترة استقبال جديدة على منظومة Qorrect', 'bell');
      if (!isSimulatedMode) {
        renderCurrentSlotUI();
      }
    }
  });

  // 8. Full Timetable View Rendering & Filters
  function renderFullCalendar() {
    const tableBody = document.getElementById('full-calendar-tbody');
    const deptSelect = document.getElementById('filter-department');
    const daySelect = document.getElementById('filter-day');
    const searchInput = document.getElementById('table-search-input');
    const countBadge = document.getElementById('filtered-count-badge');
    if (!tableBody) return;

    if (deptSelect && deptSelect.options.length <= 1) {
      tracker.uniqueDepts.forEach(dept => {
        const opt = document.createElement('option');
        opt.value = dept;
        opt.textContent = dept;
        deptSelect.appendChild(opt);
      });
    }

    if (daySelect && daySelect.options.length <= 1) {
      tracker.uniqueDays.forEach(day => {
        const opt = document.createElement('option');
        opt.value = day;
        opt.textContent = day;
        daySelect.appendChild(opt);
      });
    }

    const query = searchInput ? searchInput.value : '';
    const selDept = deptSelect ? deptSelect.value : '';
    const selDay = daySelect ? daySelect.value : '';

    const results = tracker.searchSchedule(query, selDept, selDay);
    if (countBadge) countBadge.textContent = `${results.length} سجل`;

    if (results.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            لا توجد نتائج مطابقة لبحثك
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = results.slice(0, 150).map((row, idx) => `
      <tr>
        <td style="font-family: var(--font-mono); font-weight: 700; color: var(--text-muted);">${idx + 1}</td>
        <td><strong>${row['اليوم']}</strong></td>
        <td>${row['التاريخ']}</td>
        <td><span class="degree-badge" style="font-size: 0.8rem;">${row['الفترة الزمنية']}</span></td>
        <td><strong style="color: var(--text-highlight);">${row['القسم']}</strong></td>
        <td><strong>${row['اسم الأستاذ']}</strong> <span style="font-size: 0.8rem; color: var(--text-muted);">(${row['الدرجة العلمية']})</span></td>
        <td style="max-width: 250px;">${row['اسم المقرر']}</td>
      </tr>
    `).join('');
  }

  const tableSearchInput = document.getElementById('table-search-input');
  const deptSelect = document.getElementById('filter-department');
  const daySelect = document.getElementById('filter-day');
  if (tableSearchInput) tableSearchInput.addEventListener('input', renderFullCalendar);
  if (deptSelect) deptSelect.addEventListener('change', renderFullCalendar);
  if (daySelect) daySelect.addEventListener('change', renderFullCalendar);

  // 9. Department Stats & Hourly Density Rendering (Sorted Chronologically)
  function renderAnalytics() {
    const metrics = tracker.getOverallMetrics();
    const totalTestsEl = document.getElementById('metric-total-tests');
    const totalProfEl = document.getElementById('metric-total-profs');
    const totalHoursEl = document.getElementById('metric-total-hours');
    const totalDaysEl = document.getElementById('metric-total-days');
    const totalDeptsEl = document.getElementById('metric-total-depts');

    if (totalTestsEl) totalTestsEl.textContent = metrics.totalTests;
    if (totalProfEl) totalProfEl.textContent = metrics.totalProfs;
    if (totalHoursEl) totalHoursEl.textContent = metrics.totalHours;
    if (totalDaysEl) totalDaysEl.textContent = metrics.totalDays;
    if (totalDeptsEl) totalDeptsEl.textContent = metrics.totalDepts;

    // Helper to extract chronological order key (day number * 100 + start hour)
    const getDeptChronologicalKey = (dept) => {
      const dateStr = String(dept['اليوم والتاريخ'] || dept['التاريخ'] || '');
      const periodStr = String(dept['فترة الاستقبال'] || dept['الفترة'] || '');
      
      const m = dateStr.match(/(\d{1,2})/);
      const dayNum = m ? parseInt(m[1], 10) : 99;
      
      const hourMatch = periodStr.match(/(\d{1,2})/);
      const startHour = hourMatch ? parseInt(hourMatch[1], 10) : 2;
      
      return dayNum * 100 + startHour;
    };

    // Sort departments chronologically
    const sortedDepts = [...tracker.deptStats].sort((a, b) => 
      getDeptChronologicalKey(a) - getDeptChronologicalKey(b)
    );

    const deptGrid = document.getElementById('dept-density-grid');
    if (deptGrid && sortedDepts.length > 0) {
      deptGrid.innerHTML = sortedDepts.map((d, idx) => {
        const tests = d['عدد الاختبارات الإلكترونية'] || 0;
        const weight = d['الوزن النسبي (%)'] || '0%';
        const hours = d['الساعات المخصصة'] || 1;
        const profsCount = d['عدد أعضاء هيئة التدريس'] || 0;
        const dayTime = d['اليوم والتاريخ'] || '';
        const period = d['فترة الاستقبال'] || '';

        return `
          <div class="dept-density-card">
            <div class="dept-density-header">
              <span style="display: flex; align-items: center; gap: 0.45rem;">
                <span class="prof-idx-badge" style="width: 22px; height: 22px; font-size: 0.72rem;">${idx + 1}</span>
                <span>${d['اسم القسم']}</span>
              </span>
              <span class="degree-badge">${weight}</span>
            </div>
            <div style="font-size: 0.82rem; color: var(--text-secondary); display: flex; justify-content: space-between; margin-top: 0.25rem;">
              <span>عدد الاختبارات: <strong style="color: var(--text-highlight); font-size: 0.95rem;">${tests}</strong></span>
              <span>الأساتذة: <strong>${profsCount}</strong></span>
              <span>الساعات: <strong>${hours}</strong></span>
            </div>
            <div class="density-progress-outer" style="margin: 0.45rem 0;">
              <div class="density-progress-bar" style="width: ${weight};"></div>
            </div>
            <div style="font-size: 0.78rem; color: var(--brand-green-400); font-weight: 700; display: flex; align-items: center; gap: 0.35rem;">
              <i data-lucide="calendar" style="width: 13px; height: 13px; display: inline;"></i>
              <span>${dayTime}</span>
              <span style="color: var(--text-muted); margin: 0 2px;">•</span>
              <span>${period}</span>
            </div>
          </div>
        `;
      }).join('');
      if (window.lucide) window.lucide.createIcons();
    }
  }

  // 10. Navigation Tabs Setup
  const navBtns = document.querySelectorAll('.nav-btn');
  const viewSections = {
    'reception': document.getElementById('view-reception'),
    'mini-reception': document.getElementById('view-mini-reception'),
    'calendar': document.getElementById('view-calendar'),
    'stats': document.getElementById('view-stats'),
    'upload': document.getElementById('view-upload')
  };

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.dataset.view;
      if (!targetView || !viewSections[targetView]) return;

      navBtns.forEach(b => b.classList.toggle('active', b === btn));
      Object.entries(viewSections).forEach(([name, sec]) => {
        if (sec) sec.style.display = name === targetView ? 'flex' : 'none';
      });

      // Show clock dashboard and simulation toolbar ONLY on the full 'reception' tab
      const clockDashboard = document.getElementById('clock-slot-dashboard');
      const simToolbar = document.getElementById('simulation-toolbar');
      if (clockDashboard) {
        clockDashboard.style.display = targetView === 'reception' ? 'grid' : 'none';
      }
      if (simToolbar) {
        simToolbar.style.display = targetView === 'reception' ? 'flex' : 'none';
      }

      currentView = targetView;
      if (targetView === 'calendar') {
        renderFullCalendar();
        setTimeout(() => initTableAutoScroll(), 300);
      }
      if (targetView === 'stats') {
        renderAnalytics();
        setTimeout(() => initTableAutoScroll(), 300);
      }
      if (targetView === 'reception' || targetView === 'mini-reception') renderCurrentSlotUI();
    });
  });

  // 11. Excel File Drag & Drop and Upload Handler
  const dropzone = document.getElementById('excel-dropzone');
  const fileInput = document.getElementById('excel-file-input');
  const resetBtn = document.getElementById('btn-reset-default-data');

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('drag-over');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileUpload(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFileUpload(e.target.files[0]);
      }
    });
  }

  function handleFileUpload(file) {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      showToast('يرجى رفع ملف إكسيل بصيغة .xlsx أو .xls', 'alert-triangle');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target.result;
        const parsed = window.ExcelParser.parseWorkbook(buffer);

        if (!parsed.general_schedule || parsed.general_schedule.length === 0) {
          showToast('تعذر استخراج بيانات الجدول من الملف. تأكد من وجود صف الترويسة', 'alert-circle');
          return;
        }

        window.ExcelParser.saveToStorage(parsed);
        tracker.setData(parsed);
        buildSimulationToolbar();
        renderCurrentSlotUI();
        renderAnalytics();
        renderFullCalendar();

        showToast(`تم تحميل الجدول بنجاح (${parsed.general_schedule.length} سجلاً)`, 'check-circle-2');
        
        const receptionNavBtn = document.querySelector('[data-view="reception"]');
        if (receptionNavBtn) receptionNavBtn.click();
      } catch (err) {
        console.error('Error parsing uploaded excel:', err);
        showToast('حدث خطأ أثناء معالجة ملف الإكسيل', 'alert-circle');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const def = window.ExcelParser.resetToDefault();
      tracker.setData(def);
      buildSimulationToolbar();
      renderCurrentSlotUI();
      renderAnalytics();
      renderFullCalendar();
      showToast('تمت استعادة الجدول الافتراضي الأصلي', 'rotate-ccw');
    });
  }

  // 12. Theme & Kiosk Mode Toggles
  const themeToggleBtn = document.getElementById('btn-toggle-theme');
  const fullscreenBtn = document.getElementById('btn-toggle-fullscreen');
  const soundToggleBtn = document.getElementById('btn-toggle-sound');

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      themeToggleBtn.innerHTML = `<i data-lucide="${newTheme === 'dark' ? 'sun' : 'moon'}"></i>`;
      if (window.lucide) window.lucide.createIcons();
    });
  }

  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.log(err));
        document.body.classList.add('kiosk-mode');
        fullscreenBtn.innerHTML = '<i data-lucide="minimize"></i>';
      } else {
        document.exitFullscreen().catch(err => console.log(err));
        document.body.classList.remove('kiosk-mode');
        fullscreenBtn.innerHTML = '<i data-lucide="maximize"></i>';
      }
      if (window.lucide) window.lucide.createIcons();
    });
  }

  if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', () => {
      clock.soundEnabled = !clock.soundEnabled;
      soundToggleBtn.innerHTML = `<i data-lucide="${clock.soundEnabled ? 'volume-2' : 'volume-x'}"></i>`;
      showToast(clock.soundEnabled ? 'تم تفعيل التنبيهات الصوتية' : 'تم كتم الصوت', clock.soundEnabled ? 'volume-2' : 'volume-x');
      if (window.lucide) window.lucide.createIcons();
    });
  }

  // 13. Toast Notification Helper
  function showToast(message, icon = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <i data-lucide="${icon}" style="color: var(--brand-green-400);"></i>
      <span>${message}</span>
    `;
    toastContainer.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(15px)';
      toast.style.transition = 'all 0.35s ease';
      setTimeout(() => toast.remove(), 350);
    }, 4000);
  }

  // 14. Responsive Window Resize Handler for Auto-Scroll
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      initTableAutoScroll();
    }, 150);
  });

  // 15. Initial Bootstrap
  buildSimulationToolbar();
  renderCurrentSlotUI();
});
