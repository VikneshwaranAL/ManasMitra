/**
 * ==========================================================================
 * ManasMitra - Cognitive Wellness & Routine Companion for Older Adults
 * Core Application Logic (Vanilla JavaScript ES6+)
 * ==========================================================================
 */

(function() {
  'use strict';

  // ==========================================================================
  // 1. DATA PERSISTENCE & STORAGE CONSTANTS
  // ==========================================================================
  const STORAGE_KEYS = {
    PATIENT: 'mm_patient',
    ASSESSMENTS: 'mm_assessments',
    STAGE: 'mm_stage',
    SCORES: 'mm_scores',
    REMINDERS: 'mm_reminders',
    FAMILY: 'mm_family',
    MEMORIES: 'mm_memories',
    VOICE: 'mm_voice',
    CHAT: 'mm_ai_chat'
  };

  /**
   * Safe localStorage getter
   */
  function get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      if (item === null || item === undefined) return defaultValue;
      return JSON.parse(item);
    } catch (err) {
      console.warn(`[ManasMitra Storage] Error reading ${key}:`, err);
      return defaultValue;
    }
  }

  /**
   * Safe localStorage setter
   */
  function put(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error(`[ManasMitra Storage] Error writing ${key}:`, err);
      return false;
    }
  }

  // ==========================================================================
  // 1B. DATABASE & REST API CLIENT INTEGRATION
  // ==========================================================================
  const API_BASE = 'http://127.0.0.1:8000/api';
  let isDatabaseOnline = false;

  async function checkDatabaseConnection() {
    const badge = document.getElementById('db-status-badge');
    const text = document.getElementById('db-status-text');

    try {
      const res = await fetch(`${API_BASE}/status`, { cache: 'no-cache' });
      if (res.ok) {
        const data = await res.json();
        isDatabaseOnline = true;
        if (badge && text) {
          badge.className = 'db-status-badge online';
          badge.title = `Connected to SQLite Database: ${data.database}`;
          text.textContent = 'SQLite Connected';
        }
        console.log('[ManasMitra DB] Connected to backend database:', data);
        // Sync data from database to local cache
        await syncFromDatabase();
      } else {
        throw new Error('Non-200 response');
      }
    } catch (err) {
      isDatabaseOnline = false;
      if (badge && text) {
        badge.className = 'db-status-badge offline';
        badge.title = 'Running in offline LocalStorage mode';
        text.textContent = 'Local Mode';
      }
      console.log('[ManasMitra DB] Backend server offline, running in LocalStorage mode.');
    }
  }

  async function syncFromDatabase() {
    if (!isDatabaseOnline) return;
    try {
      // Sync patient if present
      const patientRes = await fetch(`${API_BASE}/patient`);
      if (patientRes.ok) {
        const p = await patientRes.json();
        if (p && p.name) {
          put(STORAGE_KEYS.PATIENT, {
            name: p.name,
            age: p.age,
            caregiver: p.caregiver_name,
            phone: p.phone_number,
            language: p.preferred_language,
            pin: p.pin,
            avatar: p.avatar || '👵',
            registeredAt: p.created_at
          });
          if (p.current_stage) {
            put(STORAGE_KEYS.STAGE, p.current_stage);
          }
        }
      }

      // Sync scores
      const scoresRes = await fetch(`${API_BASE}/scores`);
      if (scoresRes.ok) {
        const scores = await scoresRes.json();
        if (Array.isArray(scores) && scores.length > 0) {
          put(STORAGE_KEYS.SCORES, scores.map(s => ({
            id: 'sc_' + s.id,
            gameName: s.game_name,
            stage: s.stage,
            score: s.score,
            level: s.level ? Number(s.level) : 1,
            date: new Date(s.played_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
            timestamp: new Date(s.played_at).getTime()
          })));
        }
      }

      // Sync family
      const famRes = await fetch(`${API_BASE}/family`);
      if (famRes.ok) {
        const fam = await famRes.json();
        if (Array.isArray(fam) && fam.length > 0) {
          const currentMembers = get(STORAGE_KEYS.FAMILY, []);
          const videoMap = {};
          currentMembers.forEach(m => {
            if (m.hasVideo) {
              videoMap[m.id] = true;
              if (m.phone) videoMap[m.phone] = true;
              if (m.name) videoMap[m.name] = true;
            }
          });
          put(STORAGE_KEYS.FAMILY, fam.map(f => {
            const famId = 'fam_' + f.id;
            const hasVid = !!(videoMap[famId] || videoMap[f.phone] || videoMap[f.name]);
            return {
              id: famId,
              name: f.name,
              relation: f.relationship,
              phone: f.phone,
              email: f.email,
              city: f.city,
              role: f.support_role,
              notes: f.notes,
              is_primary: f.is_primary === 1 || !!f.is_primary,
              hasVideo: hasVid
            };
          }));
        }
      }

      // Sync memories
      const memRes = await fetch(`${API_BASE}/memories`);
      if (memRes.ok) {
        const mem = await memRes.json();
        if (Array.isArray(mem) && mem.length > 0) {
          put(STORAGE_KEYS.MEMORIES, mem.map(m => ({
            id: 'mem_' + m.id,
            title: m.title,
            desc: m.description,
            date: m.memory_date,
            preset: m.preset_icon || 'family',
            customImage: m.image_data
          })));
        }
      }

      // Sync reminders
      const remRes = await fetch(`${API_BASE}/reminders`);
      if (remRes.ok) {
        const rems = await remRes.json();
        if (Array.isArray(rems) && rems.length > 0) {
          const today = getTodayDateString();
          put(STORAGE_KEYS.REMINDERS, rems.map(r => ({
            id: r.id,
            task: r.task_name,
            time: r.scheduled_time,
            repeat: r.repeat_type,
            snoozeUntil: r.snooze_until ? new Date(r.snooze_until).getTime() : null,
            snoozeUsed: r.snooze_count > 0,
            skippedToday: r.today_status === 'skipped_today',
            completedDate: r.today_status === 'completed' ? today : null,
            stateDate: today
          })));
        }
      }

      // Sync assessments
      const assessRes = await fetch(`${API_BASE}/assessments`);
      if (assessRes.ok) {
        const assessments = await assessRes.json();
        if (Array.isArray(assessments) && assessments.length > 0) {
          put(STORAGE_KEYS.ASSESSMENTS, assessments.map(a => ({
            date: a.assessment_date,
            score: a.score,
            stage: a.stage
          })));
        }
      }

      // Re-render current view with synced DB data
      if (currentActiveViewId === 'view-dashboard') renderDashboard();
      else if (currentActiveViewId === 'view-reminders') renderRemindersList();
      else if (currentActiveViewId === 'view-family') renderFamilyCards();
      else if (currentActiveViewId === 'view-memory') renderMemoryCards();
      else if (currentActiveViewId === 'view-progress') renderProgressGraph();
      else if (currentActiveViewId === 'view-ai') renderAiAnalysis();

      renderFlowerGrowthCards();
    } catch (e) {
      console.warn('[ManasMitra DB] Sync error:', e);
    }
  }

  // ==========================================================================
  // 2. DEFAULT INITIAL DATA SEEDING (FOR INSTANT DEMO & FIRST RUN)
  // ==========================================================================
  function seedDefaultDataIfEmpty() {
    // Seed Sample Reminders if none exist
    if (!get(STORAGE_KEYS.REMINDERS)) {
      const now = new Date();
      const currentHour = String(now.getHours()).padStart(2, '0');
      const currentMinute = String(now.getMinutes()).padStart(2, '0');
      
      // Calculate a reminder 2 minutes in the future for quick demonstration
      const futureDate = new Date(now.getTime() + 2 * 60000);
      const futureHour = String(futureDate.getHours()).padStart(2, '0');
      const futureMinute = String(futureDate.getMinutes()).padStart(2, '0');

      const defaultReminders = [
        {
          id: 'rem_1',
          task: 'Morning Blood Pressure Medicine',
          time: '08:30',
          repeat: 'daily',
          snoozeUntil: null,
          snoozeUsed: false,
          skippedToday: false,
          completedDate: getTodayDateString(),
          stateDate: getTodayDateString()
        },
        {
          id: 'rem_2',
          task: 'Drink a Glass of Warm Water',
          time: `${currentHour}:${currentMinute}`, // Matches current time for quick review
          repeat: 'daily',
          snoozeUntil: null,
          snoozeUsed: false,
          skippedToday: false,
          completedDate: null,
          stateDate: getTodayDateString()
        },
        {
          id: 'rem_3',
          task: 'Afternoon Garden Walk & Fresh Air',
          time: `${futureHour}:${futureMinute}`,
          repeat: 'daily',
          snoozeUntil: null,
          snoozeUsed: false,
          skippedToday: false,
          completedDate: null,
          stateDate: getTodayDateString()
        }
      ];
      put(STORAGE_KEYS.REMINDERS, defaultReminders);
    }

    // Seed Sample Family Members if none exist
    if (!get(STORAGE_KEYS.FAMILY)) {
      const defaultFamily = [
        {
          id: 'fam_1',
          name: 'Rajesh Sharma',
          relation: 'Son',
          phone: '+91 98765 43210',
          email: 'rajesh.sharma@example.com',
          city: 'Guwahati',
          role: 'Caregiver',
          is_primary: true,
          notes: 'Manages morning medication & weekly groceries'
        },
        {
          id: 'fam_2',
          name: 'Ananya Sharma',
          relation: 'Granddaughter',
          phone: '+91 98765 11223',
          email: 'ananya@example.com',
          city: 'Shillong',
          role: 'Family',
          notes: 'Calls every evening at 7:00 PM for storytime'
        },
        {
          id: 'fam_3',
          name: 'Dr. A. Sen',
          relation: 'Family Physician',
          phone: '+91 98765 88990',
          email: 'dr.sen@wellnessclinic.org',
          city: 'Guwahati',
          role: 'Doctor',
          notes: 'Available for routine monthly cognitive checkups'
        }
      ];
      put(STORAGE_KEYS.FAMILY, defaultFamily);
    }

    // Seed Sample Memories if none exist
    if (!get(STORAGE_KEYS.MEMORIES)) {
      const defaultMemories = [
        {
          id: 'mem_1',
          title: 'Family Summer Trip to Shillong Hills',
          desc: 'A joyful afternoon enjoying cool mountain breeze, pine trees, and fresh roasted corn with children and grandchildren.',
          date: 'Summer 2023',
          preset: 'travel',
          customImage: null
        },
        {
          id: 'mem_2',
          title: 'Morning Chai in the Jasmine Garden',
          desc: 'Enjoying fresh morning Assam tea sitting beneath the blooming white jasmine creepers in the courtyard.',
          date: 'Routine Tradition',
          preset: 'garden',
          customImage: null
        },
        {
          id: 'mem_3',
          title: 'Granddaughter Ananya’s 10th Birthday',
          desc: 'We made homemade kheer, sang festive songs together, and gifted her a colorful storybook.',
          date: 'October 2024',
          preset: 'family',
          customImage: null
        }
      ];
      put(STORAGE_KEYS.MEMORIES, defaultMemories);
    }

    // Seed Sample Game Scores if none exist (so progress graph and AI insights are populated immediately)
    if (!get(STORAGE_KEYS.SCORES)) {
      const sampleScores = [
        { id: 'sc_1', gameName: 'Memory Match Cards', stage: 'Stage I', score: 85, level: 1, date: '01 Sep', timestamp: Date.now() - 6 * 86400000 },
        { id: 'sc_2', gameName: 'Number Sequence', stage: 'Stage I', score: 100, level: 1, date: '02 Sep', timestamp: Date.now() - 5 * 86400000 },
        { id: 'sc_3', gameName: 'Remember Object', stage: 'Stage I', score: 80, level: 1, date: '03 Sep', timestamp: Date.now() - 4 * 86400000 },
        { id: 'sc_4', gameName: 'Pattern Completion', stage: 'Stage I', score: 90, level: 1, date: '04 Sep', timestamp: Date.now() - 3 * 86400000 },
        { id: 'sc_5', gameName: 'Daily Routine Challenge', stage: 'Stage I', score: 95, level: 1, date: '05 Sep', timestamp: Date.now() - 2 * 86400000 },
        { id: 'sc_6', gameName: 'What Object Is This?', stage: 'Stage II', score: 100, level: 1, date: '06 Sep', timestamp: Date.now() - 1 * 86400000 }
      ];
      put(STORAGE_KEYS.SCORES, sampleScores);
    }

    // Default Voice Setting (enabled by default)
    if (get(STORAGE_KEYS.VOICE) === null) {
      put(STORAGE_KEYS.VOICE, true);
    }
  }

  /**
   * Helper to format today's date as YYYY-MM-DD
   */
  function getTodayDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // ==========================================================================
  // 3. NAVIGATION & VIEW CONTROLLER (SPA HISTORY STACK)
  // ==========================================================================
  const navHistory = [];
  let navHistoryIndex = -1;
  let currentActiveViewId = 'view-welcome';

  function navigateTo(viewId, addToHistory = true) {
    const targetSection = document.getElementById(viewId);
    if (!targetSection) {
      console.warn(`View ${viewId} does not exist.`);
      return;
    }

    // Hide all views
    document.querySelectorAll('.app-view').forEach(view => {
      view.classList.remove('active');
    });

    // Show target view
    targetSection.classList.add('active');
    currentActiveViewId = viewId;

    // Manage History Stack
    if (addToHistory) {
      if (navHistoryIndex < navHistory.length - 1) {
        navHistory.splice(navHistoryIndex + 1);
      }
      navHistory.push(viewId);
      navHistoryIndex = navHistory.length - 1;
    }

    // Update Navigation Dock Active State
    updateDockActiveState(viewId);

    // Scroll to top of main content
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Trigger View-Specific Refreshes
    handleViewArrival(viewId);
  }

  function navBack() {
    if (navHistoryIndex > 0) {
      navHistoryIndex--;
      navigateTo(navHistory[navHistoryIndex], false);
    } else {
      showToast('You are at the first screen.', 'info');
    }
  }

  function navForward() {
    if (navHistoryIndex < navHistory.length - 1) {
      navHistoryIndex++;
      navigateTo(navHistory[navHistoryIndex], false);
    } else {
      showToast('You are at the latest screen.', 'info');
    }
  }

  function updateDockActiveState(viewId) {
    document.querySelectorAll('.dock-item').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.view === viewId) {
        btn.classList.add('active');
      }
    });
  }

  function handleViewArrival(viewId) {
    switch (viewId) {
      case 'view-dashboard':
        renderDashboard();
        speakAssistantContext(`Welcome back, ${getCurrentPatientName()}. You have your daily routine and games ready.`);
        break;
      case 'view-assessment':
        initAssessmentScreening();
        break;
      case 'view-games':
        renderGamesHub();
        break;
      case 'view-reminders':
        renderRemindersList();
        break;
      case 'view-memory':
        renderMemoryCards();
        break;
      case 'view-family':
        renderFamilyCards();
        break;
      case 'view-ai':
        renderAiAnalysis();
        break;
      case 'view-progress':
        renderProgressGraph();
        break;
      case 'view-ai-chat':
        renderAiChat();
        speakAssistantContext('ManasMitra AI Companion ready. Ask me anything about your routine or games.');
        break;
    }
  }

  function getCurrentPatientName() {
    const patient = get(STORAGE_KEYS.PATIENT);
    return patient ? patient.name : 'Shanti Devi';
  }

  // ==========================================================================
  // 4. SPEECH SYNTHESIS / VOICE ASSISTANT ENGINE
  // ==========================================================================
  let isVoiceEnabled = true;

  function initVoiceAssistant() {
    isVoiceEnabled = get(STORAGE_KEYS.VOICE, true);
    updateVoiceButtonUI();

    const voiceBtn = document.getElementById('voice-assistant-btn');
    if (voiceBtn) {
      voiceBtn.addEventListener('click', () => {
        isVoiceEnabled = !isVoiceEnabled;
        put(STORAGE_KEYS.VOICE, isVoiceEnabled);
        updateVoiceButtonUI();
        if (isVoiceEnabled) {
          speakAssistantContext('Voice assistant turned on. ManasMitra will guide you aloud.');
          showToast('Voice Assistant Activated 🔊', 'success');
        } else {
          stopSpeaking();
          showToast('Voice Assistant Muted 🔇', 'info');
        }
      });
    }

    const stopBtn = document.getElementById('voice-stop-btn');
    if (stopBtn) {
      stopBtn.addEventListener('click', stopSpeaking);
    }
  }

  function updateVoiceButtonUI() {
    const voiceBtn = document.getElementById('voice-assistant-btn');
    const statusText = document.getElementById('voice-status-text');
    if (!voiceBtn || !statusText) return;

    if (isVoiceEnabled) {
      voiceBtn.classList.add('active');
      statusText.textContent = 'Voice On';
      voiceBtn.title = 'Voice assistant enabled (Click to mute)';
    } else {
      voiceBtn.classList.remove('active');
      statusText.textContent = 'Voice Muted';
      voiceBtn.title = 'Voice assistant muted (Click to activate)';
    }
  }

  function speakAssistantContext(text) {
    if (!isVoiceEnabled || !('speechSynthesis' in window)) return;
    
    // Stop any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9; // Calm, deliberate pace for elderly comprehension
    utterance.pitch = 1.0;
    utterance.lang = 'en-IN'; // Indian English cadence if supported

    const banner = document.getElementById('voice-banner');
    const bannerText = document.getElementById('voice-speech-text');

    utterance.onstart = () => {
      if (banner && bannerText) {
        bannerText.textContent = text;
        banner.classList.remove('hidden');
      }
    };

    utterance.onend = () => {
      if (banner) banner.classList.add('hidden');
    };

    utterance.onerror = () => {
      if (banner) banner.classList.add('hidden');
    };

    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    const banner = document.getElementById('voice-banner');
    if (banner) banner.classList.add('hidden');
  }

  // ==========================================================================
  // 5. REGISTRATION & LOGIN CONTROLLER
  // ==========================================================================
  function initAuthControllers() {
    // Welcome CTA buttons
    document.getElementById('btn-welcome-start')?.addEventListener('click', () => {
      navigateTo('view-register');
    });

    document.getElementById('btn-welcome-login')?.addEventListener('click', () => {
      navigateTo('view-login');
    });

    // One-Click Demo Button for Hackathon Judges
    document.getElementById('btn-load-demo')?.addEventListener('click', () => {
      loadSampleProfile();
    });

    // Switch between Register & Login
    document.getElementById('btn-reg-back-login')?.addEventListener('click', () => {
      navigateTo('view-login');
    });

    document.getElementById('btn-login-to-register')?.addEventListener('click', () => {
      navigateTo('view-register');
    });

    // Registration Form
    const regForm = document.getElementById('form-register');
    if (regForm) {
      regForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const patientName = document.getElementById('reg-patient-name').value.trim();
        const age = parseInt(document.getElementById('reg-age').value, 10);
        const caregiver = document.getElementById('reg-caregiver-name').value.trim();
        const phone = document.getElementById('reg-phone').value.trim();
        const lang = document.getElementById('reg-language').value;
        const pin = document.getElementById('reg-pin').value.trim();
        const avatar = document.querySelector('input[name="reg-avatar"]:checked')?.value || '👵';

        const errorBox = document.getElementById('reg-error-msg');
        errorBox.classList.add('hidden');
        errorBox.textContent = '';

        // Age Validation (Min 5, Max 89)
        if (isNaN(age) || age < 5 || age > 89) {
          errorBox.textContent = 'Please enter a valid age between 5 and 89 years.';
          errorBox.classList.remove('hidden');
          return;
        }

        // PIN Validation (4 numeric digits)
        if (!/^\d{4}$/.test(pin)) {
          errorBox.textContent = 'PIN must be exactly 4 digits (0-9).';
          errorBox.classList.remove('hidden');
          return;
        }

        if (!patientName || !caregiver || !phone) {
          errorBox.textContent = 'Please fill out all required fields.';
          errorBox.classList.remove('hidden');
          return;
        }

        const patientData = {
          name: patientName,
          age: age,
          caregiver: caregiver,
          phone: phone,
          language: lang,
          pin: pin,
          avatar: avatar,
          registeredAt: new Date().toISOString()
        };

        put(STORAGE_KEYS.PATIENT, patientData);

        // Asynchronously sync to SQLite Database if online
        if (isDatabaseOnline) {
          fetch(`${API_BASE}/patient/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: patientName,
              age: age,
              caregiver_name: caregiver,
              phone_number: phone,
              preferred_language: lang,
              pin: pin,
              avatar: avatar
            })
          }).catch(err => console.warn('[ManasMitra DB] Registration sync error:', err));
        }

        showToast('Registration successful! Please log in.', 'success');
        
        // Auto-fill login field
        const loginNameInput = document.getElementById('login-patient-name');
        if (loginNameInput) loginNameInput.value = patientName;
        
        navigateTo('view-login');
      });
    }

    // Login Form & Keypad
    const loginForm = document.getElementById('form-login');
    const loginPinInput = document.getElementById('login-pin');

    // On-screen numeric keypad bindings
    document.querySelectorAll('.keypad-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        if (!loginPinInput) return;

        if (key === 'clear') {
          loginPinInput.value = '';
        } else if (key === 'backspace') {
          loginPinInput.value = loginPinInput.value.slice(0, -1);
        } else if (loginPinInput.value.length < 4) {
          loginPinInput.value += key;
        }
      });
    });

    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const patientName = document.getElementById('login-patient-name').value.trim();
        const pin = loginPinInput.value.trim();
        const errorBox = document.getElementById('login-error-msg');
        errorBox.classList.add('hidden');
        errorBox.textContent = '';

        const registeredPatient = get(STORAGE_KEYS.PATIENT);

        if (!registeredPatient) {
          errorBox.textContent = 'No registered patient profile found. Please register first.';
          errorBox.classList.remove('hidden');
          return;
        }

        // Case-insensitive match on patient name and exact PIN
        if (
          registeredPatient.name.toLowerCase() === patientName.toLowerCase() &&
          registeredPatient.pin === pin
        ) {
          showToast(`Welcome back, ${registeredPatient.name}!`, 'success');
          
          // Check if weekly assessment already done
          const assessments = get(STORAGE_KEYS.ASSESSMENTS, []);
          if (assessments.length === 0) {
            navigateTo('view-assessment');
          } else {
            navigateTo('view-dashboard');
          }
        } else {
          errorBox.textContent = 'Incorrect Patient Name or 4-digit PIN. Please re-check.';
          errorBox.classList.remove('hidden');
        }
      });
    }
  }

  function loadSampleProfile() {
    const demoPatient = {
      name: 'Shanti Devi',
      age: 68,
      caregiver: 'Rajesh Sharma (Son)',
      phone: '+91 98765 43210',
      language: 'English',
      pin: '1234',
      avatar: '👵',
      registeredAt: new Date().toISOString()
    };

    put(STORAGE_KEYS.PATIENT, demoPatient);
    put(STORAGE_KEYS.STAGE, 'Stage I');

    const sampleAssessment = [
      {
        date: getTodayDateString(),
        score: 6,
        stage: 'Stage I'
      }
    ];
    put(STORAGE_KEYS.ASSESSMENTS, sampleAssessment);

    showToast('Demo profile "Shanti Devi" loaded! Welcome.', 'success');
    navigateTo('view-dashboard');
  }

  // ==========================================================================
  // 6. WEEKLY COGNITIVE ASSESSMENT ENGINE
  // ==========================================================================
  const assessmentQuestions = [
    {
      id: 1,
      title: "Day & Time Awareness",
      instructions: "What part of the day are you experiencing right now?",
      icon: "☀️",
      options: [
        { label: "Morning / Daytime", score: 1, icon: "🌅" },
        { label: "Evening / Night", score: 1, icon: "🌙" },
        { label: "Not sure today", score: 0, icon: "❓" }
      ]
    },
    {
      id: 2,
      title: "Familiar Object Recognition",
      instructions: "Which item below is used to tell what time it is?",
      icon: "🕰️",
      options: [
        { label: "Wall Clock / Watch", score: 1, icon: "⏰" },
        { label: "Fresh Apple", score: 0, icon: "🍎" },
        { label: "Walking Shoe", score: 0, icon: "👟" }
      ]
    },
    {
      id: 3,
      title: "Gentle Word Recall",
      instructions: "Earlier we mentioned: 'Sunshine, River, Garden'. Which of these was on that list?",
      icon: "🌿",
      options: [
        { label: "River", score: 1, icon: "🌊" },
        { label: "Aeroplane", score: 0, icon: "✈️" },
        { label: "Computer", score: 0, icon: "💻" }
      ]
    },
    {
      id: 4,
      title: "Number Sequence Challenge",
      instructions: "What number comes next in this gentle pattern: 2, 4, 6, [ ? ]",
      icon: "🔢",
      options: [
        { label: "8", score: 1, icon: "8️⃣" },
        { label: "5", score: 0, icon: "5️⃣" },
        { label: "13", score: 0, icon: "🔟" }
      ]
    },
    {
      id: 5,
      title: "Odd-Object Identification",
      instructions: "Which item does NOT belong with the vehicles?",
      icon: "🚗",
      options: [
        { label: "Eating Spoon", score: 1, icon: "🥄" },
        { label: "Motor Car", score: 0, icon: "🚙" },
        { label: "City Bus", score: 0, icon: "🚌" }
      ]
    },
    {
      id: 6,
      title: "Healthy Daily Routine",
      instructions: "What is a healthy routine when you wake up in the morning?",
      icon: "💧",
      options: [
        { label: "Drink water and brush teeth", score: 1, icon: "🪥" },
        { label: "Skip breakfast all day", score: 0, icon: "🚫" },
        { label: "Never wash face", score: 0, icon: "😴" }
      ]
    }
  ];

  let currentQuestionIndex = 0;
  let assessmentScoreAccumulator = 0;

  function initAssessmentScreening() {
    currentQuestionIndex = 0;
    assessmentScoreAccumulator = 0;
    renderAssessmentQuestion();
  }

  function renderAssessmentQuestion() {
    const questionBody = document.getElementById('assessment-question-body');
    const counterEl = document.getElementById('assessment-counter');
    const progressFill = document.getElementById('assessment-progress-bar');
    if (!questionBody) return;

    if (currentQuestionIndex >= assessmentQuestions.length) {
      finishAssessmentScreening();
      return;
    }

    const q = assessmentQuestions[currentQuestionIndex];
    counterEl.textContent = `Question ${currentQuestionIndex + 1} of ${assessmentQuestions.length}`;
    
    const pct = ((currentQuestionIndex + 1) / assessmentQuestions.length) * 100;
    progressFill.style.width = `${pct}%`;

    questionBody.innerHTML = `
      <div class="q-prompt-box">
        <div class="q-visual-icon" aria-hidden="true">${q.icon}</div>
        <h3 class="q-title">${q.title}</h3>
        <p class="q-instructions">${q.instructions}</p>
      </div>
      <div class="q-options-grid" role="group" aria-label="Question choices">
        ${q.options.map((opt, i) => `
          <button type="button" class="q-option-btn" data-score="${opt.score}">
            <span class="q-option-icon" aria-hidden="true">${opt.icon}</span>
            <span>${opt.label}</span>
          </button>
        `).join('')}
      </div>
    `;

    // Voice assistant prompt
    speakAssistantContext(`${q.title}. ${q.instructions}`);

    // Option click bindings
    questionBody.querySelectorAll('.q-option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const scoreVal = parseInt(btn.dataset.score, 10);
        assessmentScoreAccumulator += scoreVal;
        currentQuestionIndex++;
        renderAssessmentQuestion();
      });
    });
  }

  function finishAssessmentScreening() {
    const finalScore = assessmentScoreAccumulator;
    let assignedStage = 'Stage I';
    let explanation = 'Continue with memory, attention, patterns and routine activities.';

    if (finalScore >= 5) {
      assignedStage = 'Stage I';
      explanation = 'Continue with memory, attention, patterns and routine activities.';
    } else if (finalScore >= 3) {
      assignedStage = 'Stage II';
      explanation = 'Focus on recognition, familiar people, places and objects.';
    } else {
      assignedStage = 'Stage III';
      explanation = 'Focus on familiar faces, objects, pictures and language activities.';
    }

    // Save assessment record
    const assessments = get(STORAGE_KEYS.ASSESSMENTS, []);
    assessments.push({
      date: getTodayDateString(),
      score: finalScore,
      stage: assignedStage
    });
    put(STORAGE_KEYS.ASSESSMENTS, assessments);
    put(STORAGE_KEYS.STAGE, assignedStage);

    // Asynchronously sync to SQLite Database if online
    if (isDatabaseOnline) {
      fetch(`${API_BASE}/assessments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: 1,
          score: finalScore,
          stage: assignedStage,
          details: { questions_count: assessmentQuestions.length }
        })
      }).catch(err => console.warn('[ManasMitra DB] Assessment sync error:', err));
    }

    // Populate Stage Result View
    document.getElementById('stage-result-name').textContent = assignedStage;
    document.getElementById('stage-result-explanation').textContent = explanation;
    document.getElementById('stage-result-score').textContent = `${finalScore} / ${assessmentQuestions.length}`;
    
    const iconMap = { 'Stage I': '🌟', 'Stage II': '🌿', 'Stage III': '🌸' };
    document.getElementById('stage-badge-icon').textContent = iconMap[assignedStage] || '🌟';

    // Button to Dashboard
    document.getElementById('btn-stage-to-dashboard').onclick = () => {
      navigateTo('view-dashboard');
    };

    speakAssistantContext(`Screening complete. You have been assigned ${assignedStage}. ${explanation}`);
    navigateTo('view-stage-result');
  }

  // ==========================================================================
  // 6B. VIRTUAL FLOWER GAMIFICATION SYSTEM
  // ==========================================================================
  const FLOWER_STAGES = [
    { min: 0, max: 99, name: 'Seed', icon: '🌱', nextAt: 100, nextName: 'Sprout', nextIcon: '🌿' },
    { min: 100, max: 249, name: 'Sprout', icon: '🌿', nextAt: 250, nextName: 'Growing Flower', nextIcon: '🌷' },
    { min: 250, max: 499, name: 'Growing Flower', icon: '🌷', nextAt: 500, nextName: 'Blooming Flower', nextIcon: '🌸' },
    { min: 500, max: 999, name: 'Blooming Flower', icon: '🌸', nextAt: 1000, nextName: 'Full Bloom', nextIcon: '🌺' },
    { min: 1000, max: Infinity, name: 'Full Bloom', icon: '🌺', nextAt: null, nextName: null, nextIcon: null }
  ];

  /**
   * Calculate lifetime points from all saved game scores.
   * 1 game score point = 1 gamification point.
   */
  function getLifetimePoints() {
    const scores = get(STORAGE_KEYS.SCORES, []);
    return scores.reduce((sum, s) => sum + (Number(s.score) || 0), 0);
  }

  /**
   * Get flower progress details for a given points total
   */
  function getFlowerProgress(points) {
    const total = Math.max(0, Number(points) || 0);
    const stage = FLOWER_STAGES.find(s => total >= s.min && total <= s.max) || FLOWER_STAGES[0];

    let progressPct = 0;
    let pointsNeeded = 0;
    let progressText = '';

    if (stage.nextAt) {
      pointsNeeded = Math.max(0, stage.nextAt - total);
      const stageSpan = stage.nextAt - stage.min;
      const progressInStage = Math.max(0, total - stage.min);
      progressPct = Math.min(100, Math.max(0, Math.round((progressInStage / stageSpan) * 100)));
      progressText = `${pointsNeeded} pts to ${stage.nextName} ${stage.nextIcon}`;
    } else {
      progressPct = 100;
      pointsNeeded = 0;
      progressText = 'Fully Bloomed! 🌺 Maximum Bloom Achieved';
    }

    return {
      points: total,
      stage: stage,
      pointsNeeded: pointsNeeded,
      progressPct: progressPct,
      progressText: progressText
    };
  }

  /**
   * Update all flower growth cards (Dashboard and Progress views)
   */
  function renderFlowerGrowthCards() {
    const points = getLifetimePoints();
    const progress = getFlowerProgress(points);

    const views = [
      {
        prefix: 'dash-flower-',
        subtitle: `Every brain game nurtures your flower garden. (${points} points earned)`
      },
      {
        prefix: 'progress-flower-',
        subtitle: `Mindful cognitive exercises bring your flower to full bloom. (${points} lifetime points)`
      }
    ];

    views.forEach(v => {
      const avatarEl = document.getElementById(`${v.prefix}avatar`);
      const badgeEl = document.getElementById(`${v.prefix}stage-badge`);
      const subtitleEl = document.getElementById(`${v.prefix}subtitle`);
      const totalPointsEl = document.getElementById(`${v.prefix}total-points`);
      const currentStageEl = document.getElementById(`${v.prefix}current-stage`);
      const neededEl = document.getElementById(`${v.prefix}needed-points`);
      const fillEl = document.getElementById(`${v.prefix}progress-fill`);
      const barBgEl = document.getElementById(`${v.prefix}progressbar`);
      const milestonesContainer = document.getElementById(`${v.prefix}milestones`);

      if (avatarEl) avatarEl.textContent = progress.stage.icon;
      if (badgeEl) badgeEl.textContent = `${progress.stage.icon} ${progress.stage.name}`;
      if (subtitleEl) subtitleEl.textContent = v.subtitle;
      if (totalPointsEl) totalPointsEl.textContent = progress.points;
      if (currentStageEl) currentStageEl.textContent = `Current Stage: ${progress.stage.icon} ${progress.stage.name}`;
      if (neededEl) neededEl.textContent = progress.progressText;
      if (fillEl) fillEl.style.width = `${progress.progressPct}%`;
      if (barBgEl) {
        barBgEl.setAttribute('aria-valuenow', progress.progressPct);
        barBgEl.setAttribute('aria-label', `Flower growth: ${progress.stage.name}, ${progress.progressPct}% towards next stage`);
      }

      if (milestonesContainer) {
        const pills = milestonesContainer.querySelectorAll('.flower-milestone-pill');
        pills.forEach(pill => {
          const pillStageName = pill.dataset.stage;
          const stageIndex = FLOWER_STAGES.findIndex(s => s.name === progress.stage.name);
          const pillIndex = FLOWER_STAGES.findIndex(s => s.name === pillStageName);

          pill.classList.remove('active', 'passed');
          if (pillIndex === stageIndex) {
            pill.classList.add('active');
          } else if (pillIndex < stageIndex) {
            pill.classList.add('passed');
          }
        });
      }
    });
  }

  // ==========================================================================
  // 7. PATIENT DASHBOARD CONTROLLER
  // ==========================================================================
  function renderDashboard() {
    const patient = get(STORAGE_KEYS.PATIENT, { name: 'Shanti Devi', avatar: '👵' });
    const stage = get(STORAGE_KEYS.STAGE, 'Stage I');
    const scores = get(STORAGE_KEYS.SCORES, []);
    const reminders = get(STORAGE_KEYS.REMINDERS, []);
    const assessments = get(STORAGE_KEYS.ASSESSMENTS, []);

    // Header values
    document.getElementById('dashboard-greeting').textContent = `Namaste, ${patient.name} 👋`;
    document.getElementById('dash-avatar').textContent = patient.avatar || '👵';
    document.getElementById('dash-stage-label').textContent = stage;

    // Metrics calculation
    document.getElementById('dash-games-count').textContent = scores.length;
    
    if (scores.length > 0) {
      const avg = Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length);
      document.getElementById('dash-avg-score').textContent = `${avg}%`;
    } else {
      document.getElementById('dash-avg-score').textContent = '--';
    }

    // Task Completion Percentage for today
    const today = getTodayDateString();
    const totalTodayTasks = reminders.length;
    const completedTodayTasks = reminders.filter(r => r.completedDate === today).length;
    const taskPct = totalTodayTasks > 0 ? Math.round((completedTodayTasks / totalTodayTasks) * 100) : 0;
    document.getElementById('dash-task-pct').textContent = `${taskPct}%`;

    // Weekly Check Status
    const lastAssessment = assessments[assessments.length - 1];
    const statusEl = document.getElementById('dash-assessment-status');
    if (lastAssessment) {
      statusEl.textContent = 'Up to Date';
      statusEl.style.color = 'var(--color-success)';
    } else {
      statusEl.textContent = 'Due';
      statusEl.style.color = 'var(--color-amber-primary)';
    }

    // Render Today's Reminders Summary
    renderDashboardRemindersSummary(reminders);

    // Update Virtual Flower Growth Card
    renderFlowerGrowthCards();
  }

  function renderDashboardRemindersSummary(reminders) {
    const container = document.getElementById('dash-reminders-list');
    if (!container) return;

    if (reminders.length === 0) {
      container.innerHTML = `
        <div class="text-center py-3 text-muted">
          <p>No reminders configured for today yet.</p>
        </div>
      `;
      return;
    }

    const today = getTodayDateString();

    container.innerHTML = reminders.map(r => {
      const isDone = r.completedDate === today;
      return `
        <div class="reminder-quick-item ${isDone ? 'completed' : ''}">
          <div class="reminder-quick-left">
            <span class="reminder-time-badge">${r.time}</span>
            <span class="reminder-quick-name">${escapeHTML(r.task)}</span>
          </div>
          <div>
            ${isDone
              ? '<span class="badge badge-success">✅ Completed</span>'
              : `<button type="button" class="btn btn-outline btn-compact btn-quick-done" data-id="${r.id}">Done</button>`
            }
          </div>
        </div>
      `;
    }).join('');

    // Attach quick done button handlers
    container.querySelectorAll('.btn-quick-done').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        markReminderCompleted(id);
      });
    });
  }

  // ==========================================================================
  // 8. COGNITIVE GAMES HUB & ARENA ENGINE (14 ADAPTIVE GAMES)
  // ==========================================================================
  const COGNITIVE_GAMES = [
    // STAGE I GAMES
    {
      id: 'g_s1_memory',
      stage: 'stage1',
      stageLabel: 'Stage I',
      title: 'Memory Match Cards',
      icon: '🃏',
      desc: 'Flip cards and find matching pairs of friendly icons.',
      instruction: 'Find matching pairs of symbols by flipping over two cards at a time.'
    },
    {
      id: 'g_s1_remember',
      stage: 'stage1',
      stageLabel: 'Stage I',
      title: 'Remember Object',
      icon: '🔍',
      desc: 'Observe an item for a few moments, then recall what you saw.',
      instruction: 'Memorize the item shown on screen, then pick the exact match.'
    },
    {
      id: 'g_s1_number_seq',
      stage: 'stage1',
      stageLabel: 'Stage I',
      title: 'Number Sequence',
      icon: '🔢',
      desc: 'Look at the progressive numbers and choose what comes next.',
      instruction: 'Select the missing number to complete the sequence.'
    },
    {
      id: 'g_s1_pattern',
      stage: 'stage1',
      stageLabel: 'Stage I',
      title: 'Pattern Completion',
      icon: '🔷',
      desc: 'Examine repeating geometric shapes and predict the next symbol.',
      instruction: 'Look at the sequence of shapes and choose the next pattern.'
    },
    {
      id: 'g_s1_routine',
      stage: 'stage1',
      stageLabel: 'Stage I',
      title: 'Daily Routine Challenge',
      icon: '☀️',
      desc: 'Arrange everyday morning habits in logical sequence.',
      instruction: 'Choose the correct sequence of morning routines.'
    },

    // STAGE II GAMES
    {
      id: 'g_s2_what_object',
      stage: 'stage2',
      stageLabel: 'Stage II',
      title: 'What Object Is This?',
      icon: '🫖',
      desc: 'Look at the high-clarity object picture and choose its name.',
      instruction: 'Identify the familiar object displayed below.'
    },
    {
      id: 'g_s2_family_pic',
      stage: 'stage2',
      stageLabel: 'Stage II',
      title: 'Simple Family Picture',
      icon: '👨‍👩‍👧',
      desc: 'Match loving family members with their supportive roles.',
      instruction: 'Read the warm family clue and identify the loved one.'
    },
    {
      id: 'g_s2_places',
      stage: 'stage2',
      stageLabel: 'Stage II',
      title: 'Place Recognition',
      icon: '🏡',
      desc: 'Recognize comforting household and neighborhood locations.',
      instruction: 'Identify which room or place is described in the clue.'
    },
    {
      id: 'g_s2_faces',
      stage: 'stage2',
      stageLabel: 'Stage II',
      title: 'Face Recognition',
      icon: '😊',
      desc: 'Find the happy, smiling, and calm friendly expression.',
      instruction: 'Tap the friendly smiling face among the choices.'
    },
    {
      id: 'g_s2_music',
      stage: 'stage2',
      stageLabel: 'Stage II',
      title: 'Familiar Music',
      icon: '🪕',
      desc: 'Identify traditional acoustic Indian instruments and soothing melodies.',
      instruction: 'Which musical instrument creates this acoustic melody?'
    },

    // STAGE III GAMES
    {
      id: 'g_s3_popular_faces',
      stage: 'stage3',
      stageLabel: 'Stage III',
      title: 'Popular & Familiar Faces',
      icon: '👵',
      desc: 'Gently recognize beloved elders and friendly smiling companions.',
      instruction: 'Touch the friendly grandmother face.'
    },
    {
      id: 'g_s3_used_objects',
      stage: 'stage3',
      stageLabel: 'Stage III',
      title: 'Frequently Used Objects',
      icon: '🪥',
      desc: 'Point to everyday items like spoons, toothbrushes, and spectacles.',
      instruction: 'Touch the item you use every morning to brush teeth.'
    },
    {
      id: 'g_s3_picture_touch',
      stage: 'stage3',
      stageLabel: 'Stage III',
      title: 'Picture Interaction',
      icon: '🌻',
      desc: 'A calming tactile exercise tapping colorful blooming flowers.',
      instruction: 'Touch the bright blooming sunflower.'
    },
    {
      id: 'g_s3_language',
      stage: 'stage3',
      stageLabel: 'Stage III',
      title: 'Linguistic / Language Activity',
      icon: '🔤',
      desc: 'Fill in the missing letter to complete simple comforting words.',
      instruction: 'Complete the word: M A N _ S'
    }
  ];

  let currentActiveGame = null;
  let currentActiveLevel = 1;
  let activeGameScore = 0;

  function renderGamesHub() {
    const stage = get(STORAGE_KEYS.STAGE, 'Stage I');
    const stageChip = document.getElementById('games-current-stage-tag');
    if (stageChip) stageChip.textContent = stage;

    const grid = document.getElementById('games-grid');
    if (!grid) return;

    grid.innerHTML = COGNITIVE_GAMES.map(g => `
      <div class="game-card" data-stage="${g.stage}">
        <div class="game-card-header">
          <span class="game-icon" aria-hidden="true">${g.icon}</span>
          <span class="badge ${g.stage === 'stage1' ? 'badge-teal' : g.stage === 'stage2' ? 'badge-amber' : 'badge-success'}">${g.stageLabel}</span>
        </div>
        <h3 class="game-title">${escapeHTML(g.title)}</h3>
        <p class="game-desc">${escapeHTML(g.desc)}</p>
        <button type="button" class="btn btn-primary btn-play-game" data-game-id="${g.id}">
          <span>Play Activity</span>
          <span aria-hidden="true">&#8594;</span>
        </button>
      </div>
    `).join('');

    // Attach play buttons
    grid.querySelectorAll('.btn-play-game').forEach(btn => {
      btn.addEventListener('click', () => {
        const gameId = btn.dataset.gameId;
        launchGameArena(gameId, 1);
      });
    });

    // Attach filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const filter = tab.dataset.filter;
        
        grid.querySelectorAll('.game-card').forEach(card => {
          if (filter === 'all' || card.dataset.stage === filter) {
            card.classList.remove('hidden');
          } else {
            card.classList.add('hidden');
          }
        });
      };
    });
  }

  function updateArenaLevelButtons(level) {
    [1, 2, 3].forEach(lvl => {
      const btn = document.getElementById(`btn-level-${lvl}`);
      if (btn) {
        if (lvl === level) {
          btn.classList.add('active');
          btn.setAttribute('aria-pressed', 'true');
        } else {
          btn.classList.remove('active');
          btn.setAttribute('aria-pressed', 'false');
        }
      }
    });
  }

  function setGameArenaLevel(level) {
    currentActiveLevel = level;
    updateArenaLevelButtons(currentActiveLevel);
    activeGameScore = 0;
    const scoreEl = document.getElementById('arena-live-score');
    if (scoreEl) scoreEl.textContent = '0';
    if (currentActiveGame) {
      const levelNames = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };
      speakAssistantContext(`${currentActiveGame.title}, Level ${currentActiveLevel} — ${levelNames[currentActiveLevel]}`);
      buildGameLogic(currentActiveGame, currentActiveLevel);
    }
  }

  function initArenaControllers() {
    [1, 2, 3].forEach(lvl => {
      const btn = document.getElementById(`btn-level-${lvl}`);
      if (btn) {
        btn.onclick = () => {
          setGameArenaLevel(lvl);
        };
      }
    });
  }

  function launchGameArena(gameId, level = 1) {
    const game = COGNITIVE_GAMES.find(g => g.id === gameId);
    if (!game) return;

    currentActiveGame = game;
    currentActiveLevel = level;
    activeGameScore = 0;

    document.getElementById('arena-game-title').textContent = game.title;
    document.getElementById('arena-game-icon').textContent = game.icon;
    document.getElementById('arena-game-instructions').textContent = game.instruction;
    document.getElementById('arena-live-score').textContent = '0';

    updateArenaLevelButtons(currentActiveLevel);

    // Hide any previous feedback modal
    const modal = document.getElementById('arena-feedback-modal');
    if (modal) modal.classList.add('hidden');

    navigateTo('view-game-arena');
    speakAssistantContext(`${game.title}. ${game.instruction}`);

    // Build specific game logic with selected difficulty level
    buildGameLogic(game, currentActiveLevel);
  }

  function buildGameLogic(game, level = 1) {
    const container = document.getElementById('arena-interactive-play-container');
    if (!container) return;
    container.innerHTML = '';

    switch (game.id) {
      case 'g_s1_memory':
        runMemoryMatchGame(container, level);
        break;

      case 'g_s1_remember':
        runRememberObjectGame(container, level);
        break;

      case 'g_s1_number_seq':
        if (level === 1) {
          runChoiceGame(container, {
            prompt: 'Look at the numbers: 2, 4, 6, [ ? ]',
            image: '🔢',
            choices: [
              { text: '8', correct: true },
              { text: '7', correct: false },
              { text: '9', correct: false },
              { text: '5', correct: false }
            ]
          });
        } else if (level === 2) {
          runChoiceGame(container, {
            prompt: 'Look at the numbers: 10, 20, 30, [ ? ]',
            image: '🔢',
            choices: [
              { text: '40', correct: true },
              { text: '35', correct: false },
              { text: '45', correct: false },
              { text: '50', correct: false }
            ]
          });
        } else {
          runChoiceGame(container, {
            prompt: 'Look at the numbers: 3, 7, 11, [ ? ]',
            image: '🔢',
            choices: [
              { text: '15 (+4 each step)', correct: true },
              { text: '14', correct: false },
              { text: '16', correct: false },
              { text: '13', correct: false }
            ]
          });
        }
        break;

      case 'g_s1_pattern':
        if (level === 1) {
          runChoiceGame(container, {
            prompt: 'Which shape comes next: 🔺, 🔵, 🔺, 🔵, [ ? ]',
            image: '🔷',
            choices: [
              { text: '🔺 (Red Triangle)', correct: true },
              { text: '⭐ (Star)', correct: false },
              { text: '⬛ (Black Square)', correct: false }
            ]
          });
        } else if (level === 2) {
          runChoiceGame(container, {
            prompt: 'Which shape comes next: ⭐, 🔵, 🔶, ⭐, 🔵, [ ? ]',
            image: '🔷',
            choices: [
              { text: '🔶 (Orange Diamond)', correct: true },
              { text: '⭐ (Star)', correct: false },
              { text: '🔵 (Blue Circle)', correct: false }
            ]
          });
        } else {
          runChoiceGame(container, {
            prompt: 'Which shape comes next: 🔺, 🔺, 🔵, 🔵, 🔺, [ ? ]',
            image: '🔷',
            choices: [
              { text: '🔺 (Red Triangle)', correct: true },
              { text: '🔵 (Blue Circle)', correct: false },
              { text: '⭐ (Star)', correct: false }
            ]
          });
        }
        break;

      case 'g_s1_routine':
        if (level === 1) {
          runChoiceGame(container, {
            prompt: 'What is the first thing we do after waking up in the morning?',
            image: '🌅',
            choices: [
              { text: 'Wash Face & Drink Warm Water', correct: true },
              { text: 'Eat Full Heavy Dinner', correct: false },
              { text: 'Go Immediately to Sleep', correct: false }
            ]
          });
        } else if (level === 2) {
          runChoiceGame(container, {
            prompt: 'What is the best routine right before or with morning breakfast?',
            image: '☀️',
            choices: [
              { text: 'Take Prescribed Morning Medicine with Water', correct: true },
              { text: 'Go for a 10km Run', correct: false },
              { text: 'Stay in Dark Bedroom', correct: false }
            ]
          });
        } else {
          runChoiceGame(container, {
            prompt: 'What is the healthiest routine 30 minutes before nighttime sleep?',
            image: '🌙',
            choices: [
              { text: 'Relax, Dim Lights & Sip Warm Milk', correct: true },
              { text: 'Drink Strong Hot Black Coffee', correct: false },
              { text: 'Do Heavy Furniture Lifting', correct: false }
            ]
          });
        }
        break;

      case 'g_s2_what_object':
        if (level === 1) {
          runChoiceGame(container, {
            prompt: 'What familiar household item is shown in this picture?',
            image: '🫖',
            choices: [
              { text: 'Warm Tea Pot', correct: true },
              { text: 'Garden Shovel', correct: false },
              { text: 'Reading Spectacles', correct: false }
            ]
          });
        } else if (level === 2) {
          runChoiceGame(container, {
            prompt: 'What personal item is shown in this picture?',
            image: '👓',
            choices: [
              { text: 'Reading Spectacles', correct: true },
              { text: 'Teacup', correct: false },
              { text: 'Door Key', correct: false },
              { text: 'Hand Towel', correct: false }
            ]
          });
        } else {
          runChoiceGame(container, {
            prompt: 'What acoustic musical device is shown in this picture?',
            image: '📻',
            choices: [
              { text: 'Vintage Table Radio', correct: true },
              { text: 'Wall Clock', correct: false },
              { text: 'Microwave Oven', correct: false },
              { text: 'Gramophone', correct: false }
            ]
          });
        }
        break;

      case 'g_s2_family_pic':
        if (level === 1) {
          runChoiceGame(container, {
            prompt: 'Who prepares delicious warm snacks and tells loving bedtime stories?',
            image: '👵',
            choices: [
              { text: 'Loving Grandmother', correct: true },
              { text: 'Postman', correct: false },
              { text: 'Bus Driver', correct: false }
            ]
          });
        } else if (level === 2) {
          runChoiceGame(container, {
            prompt: 'Who is your primary adult caregiver helping with morning medicine and groceries?',
            image: '👨',
            choices: [
              { text: 'Devoted Son (Rajesh)', correct: true },
              { text: 'Shopkeeper', correct: false },
              { text: 'Electrician', correct: false }
            ]
          });
        } else {
          runChoiceGame(container, {
            prompt: 'Who calls every evening at 7:00 PM to share her school drawings and stories?',
            image: '👧',
            choices: [
              { text: 'Granddaughter (Ananya)', correct: true },
              { text: 'Bank Manager', correct: false },
              { text: 'News Anchor', correct: false }
            ]
          });
        }
        break;

      case 'g_s2_places':
        if (level === 1) {
          runChoiceGame(container, {
            prompt: 'In which part of the house do we brew tea and cook warm meals?',
            image: '🍳',
            choices: [
              { text: 'Kitchen', correct: true },
              { text: 'Balcony', correct: false },
              { text: 'Garage', correct: false }
            ]
          });
        } else if (level === 2) {
          runChoiceGame(container, {
            prompt: 'Where in the house do you sleep peacefully with cozy pillows and blankets?',
            image: '🛏️',
            choices: [
              { text: 'Bedroom', correct: true },
              { text: 'Kitchen', correct: false },
              { text: 'Entry Hallway', correct: false },
              { text: 'Garden Shed', correct: false }
            ]
          });
        } else {
          runChoiceGame(container, {
            prompt: 'Where do elders take gentle evening walks among blooming flowers and fresh air?',
            image: '🌳',
            choices: [
              { text: 'Community Garden Park', correct: true },
              { text: 'Bus Depot', correct: false },
              { text: 'Busy Railway Track', correct: false },
              { text: 'Basement Parking', correct: false }
            ]
          });
        }
        break;

      case 'g_s2_faces':
        if (level === 1) {
          runChoiceGame(container, {
            prompt: 'Touch the joyful, smiling face:',
            image: '💛',
            choices: [
              { text: '😄 Happy Smiling Face', correct: true },
              { text: '😢 Crying Face', correct: false },
              { text: '😠 Angry Face', correct: false }
            ]
          });
        } else if (level === 2) {
          runChoiceGame(container, {
            prompt: 'Find the calm, peaceful, and content expression:',
            image: '✨',
            choices: [
              { text: '😌 Calm & Peaceful Face', correct: true },
              { text: '😱 Shocked Face', correct: false },
              { text: '😴 Sleeping Face', correct: false },
              { text: '😡 Frowning Face', correct: false }
            ]
          });
        } else {
          runChoiceGame(container, {
            prompt: 'Touch the warm, loving, and affectionate expression:',
            image: '💖',
            choices: [
              { text: '🥰 Warm Loving Face with Hearts', correct: true },
              { text: '😐 Blank Neutral Face', correct: false },
              { text: '😕 Confused Face', correct: false },
              { text: '🥱 Yawning Face', correct: false }
            ]
          });
        }
        break;

      case 'g_s2_music':
        if (level === 1) {
          runChoiceGame(container, {
            prompt: 'Which Indian string instrument produces classical serene ragas?',
            image: '🪕',
            choices: [
              { text: 'Sitar', correct: true },
              { text: 'Trumpet', correct: false },
              { text: 'Brass Bell', correct: false }
            ]
          });
        } else if (level === 2) {
          runChoiceGame(container, {
            prompt: 'Which pair of Indian hand drums provides rhythmic beats in classical music?',
            image: '🥁',
            choices: [
              { text: 'Tabla Drums', correct: true },
              { text: 'Violin', correct: false },
              { text: 'Electric Guitar', correct: false },
              { text: 'Saxophone', correct: false }
            ]
          });
        } else {
          runChoiceGame(container, {
            prompt: 'Which traditional bamboo wind instrument creates gentle, soulful melodies?',
            image: '🎵',
            choices: [
              { text: 'Bansuri (Bamboo Flute)', correct: true },
              { text: 'Bagpipes', correct: false },
              { text: 'Trombone', correct: false },
              { text: 'Accordion', correct: false }
            ]
          });
        }
        break;

      case 'g_s3_popular_faces':
        if (level === 1) {
          runChoiceGame(container, {
            prompt: 'Touch the friendly grandmother face:',
            image: '🌸',
            choices: [
              { text: '👵 Loving Grandmother', correct: true },
              { text: '🐱 Playful Kitten', correct: false },
              { text: '🚗 Small Car', correct: false }
            ]
          });
        } else if (level === 2) {
          runChoiceGame(container, {
            prompt: 'Touch the kind, smiling grandfather face:',
            image: '🌟',
            choices: [
              { text: '👴 Smiling Grandfather', correct: true },
              { text: '👶 Newborn Infant', correct: false },
              { text: '🛵 Motor Scooter', correct: false }
            ]
          });
        } else {
          runChoiceGame(container, {
            prompt: 'Touch the caring, trusted family doctor:',
            image: '🩺',
            choices: [
              { text: '👨‍⚕️ Caring Family Doctor', correct: true },
              { text: '📦 Cardboard Box', correct: false },
              { text: '🪨 Garden Rock', correct: false },
              { text: '🌂 Umbrella', correct: false }
            ]
          });
        }
        break;

      case 'g_s3_used_objects':
        if (level === 1) {
          runChoiceGame(container, {
            prompt: 'Touch the item you use to brush teeth every morning:',
            image: '✨',
            choices: [
              { text: '🪥 Toothbrush', correct: true },
              { text: '🥄 Metal Spoon', correct: false },
              { text: '🔑 House Key', correct: false }
            ]
          });
        } else if (level === 2) {
          runChoiceGame(container, {
            prompt: 'Touch the utensil we use to eat warm porridge or soup:',
            image: '🥣',
            choices: [
              { text: '🥄 Soup Spoon', correct: true },
              { text: '🪥 Toothbrush', correct: false },
              { text: '🔒 Padlock', correct: false }
            ]
          });
        } else {
          runChoiceGame(container, {
            prompt: 'Touch the item that helps you read small letters in books clearly:',
            image: '📖',
            choices: [
              { text: '👓 Reading Glasses', correct: true },
              { text: '🔦 Flashlight', correct: false },
              { text: '✂️ Scissors', correct: false },
              { text: 'Comb', correct: false }
            ]
          });
        }
        break;

      case 'g_s3_picture_touch':
        if (level === 1) {
          runChoiceGame(container, {
            prompt: 'Touch the beautiful yellow Sunflower:',
            image: '🌿',
            choices: [
              { text: '🌻 Bright Sunflower', correct: true },
              { text: '🪨 Garden Pebble', correct: false },
              { text: '📦 Wooden Box', correct: false }
            ]
          });
        } else if (level === 2) {
          runChoiceGame(container, {
            prompt: 'Touch the fresh, ripe red Apple:',
            image: '🌳',
            choices: [
              { text: '🍎 Red Apple', correct: true },
              { text: '🌻 Sunflower', correct: false },
              { text: '👟 Shoe', correct: false }
            ]
          });
        } else {
          runChoiceGame(container, {
            prompt: 'Touch the soothing sacred Lotus blossom:',
            image: '💧',
            choices: [
              { text: '🪷 Blooming Lotus Flower', correct: true },
              { text: '🌵 Prickly Cactus', correct: false },
              { text: '🍂 Dried Leaf', correct: false },
              { text: '🪵 Wooden Log', correct: false }
            ]
          });
        }
        break;

      case 'g_s3_language':
        if (level === 1) {
          runChoiceGame(container, {
            prompt: 'Complete the comforting word: M A N _ S',
            image: '🌱',
            choices: [
              { text: 'Letter A (M A N A S)', correct: true },
              { text: 'Letter O (M A N O S)', correct: false },
              { text: 'Letter X (M A N X S)', correct: false }
            ]
          });
        } else if (level === 2) {
          runChoiceGame(container, {
            prompt: 'Complete the affectionate word: M I T _ A (Friend)',
            image: '🤝',
            choices: [
              { text: 'Letter R (M I T R A)', correct: true },
              { text: 'Letter Z (M I T Z A)', correct: false },
              { text: 'Letter K (M I T K A)', correct: false }
            ]
          });
        } else {
          runChoiceGame(container, {
            prompt: 'Complete the serene greeting word: S H A N _ I (Peace)',
            image: '🕊️',
            choices: [
              { text: 'Letter T (S H A N T I)', correct: true },
              { text: 'Letter B (S H A N B I)', correct: false },
              { text: 'Letter W (S H A N W I)', correct: false },
              { text: 'Letter Q (S H A N Q I)', correct: false }
            ]
          });
        }
        break;
    }
  }

  // --- GAME IMPLEMENTATION 1: MEMORY MATCH CARDS (SUPPORTS LEVELS 1, 2, 3) ---
  function runMemoryMatchGame(container, level = 1) {
    let symbols;
    let gridClass;
    let matchIncrement;

    if (level === 1) {
      symbols = ['🍎', '🌻']; // 2 pairs = 4 cards
      gridClass = 'memory-board grid-2x2';
      matchIncrement = 50;
    } else if (level === 2) {
      symbols = ['🍎', '🌻', '🐶']; // 3 pairs = 6 cards
      gridClass = 'memory-board grid-3x2';
      matchIncrement = 35;
    } else {
      symbols = ['🍎', '🌻', '🐶', '🚗']; // 4 pairs = 8 cards
      gridClass = 'memory-board grid-4x2';
      matchIncrement = 25;
    }

    const deck = [...symbols, ...symbols].sort(() => Math.random() - 0.5);

    let firstCard = null;
    let secondCard = null;
    let lockBoard = false;
    let matchesFound = 0;

    const board = document.createElement('div');
    board.className = gridClass;

    deck.forEach((sym, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'memory-card-btn';
      btn.dataset.symbol = sym;
      btn.dataset.index = index;
      btn.textContent = '❓';
      btn.setAttribute('aria-label', 'Hidden card');

      btn.addEventListener('click', () => {
        if (lockBoard || btn === firstCard || btn.classList.contains('matched')) return;

        btn.textContent = sym;
        btn.classList.add('flipped');

        if (!firstCard) {
          firstCard = btn;
          return;
        }

        secondCard = btn;
        lockBoard = true;

        if (firstCard.dataset.symbol === secondCard.dataset.symbol) {
          // Matched!
          firstCard.classList.add('matched');
          secondCard.classList.add('matched');
          matchesFound++;
          activeGameScore += matchIncrement;
          document.getElementById('arena-live-score').textContent = activeGameScore;
          
          firstCard = null;
          secondCard = null;
          lockBoard = false;

          if (matchesFound === symbols.length) {
            setTimeout(() => {
              finishCurrentGame(100, 'All pairs matched beautifully!');
            }, 600);
          }
        } else {
          // Not a match
          setTimeout(() => {
            if (firstCard) {
              firstCard.textContent = '❓';
              firstCard.classList.remove('flipped');
            }
            if (secondCard) {
              secondCard.textContent = '❓';
              secondCard.classList.remove('flipped');
            }
            firstCard = null;
            secondCard = null;
            lockBoard = false;
          }, 900);
        }
      });

      board.appendChild(btn);
    });

    container.appendChild(board);
  }

  // --- GAME IMPLEMENTATION 2: REMEMBER OBJECT (TIMED RECALL - SUPPORTS LEVELS 1, 2, 3) ---
  function runRememberObjectGame(container, level = 1) {
    let targets;
    let countdown;
    let makeChoices;

    if (level === 1) {
      targets = [
        { name: 'Red Apple', icon: '🍎' },
        { name: 'Sunflower', icon: '🌻' },
        { name: 'Golden Bell', icon: '🔔' }
      ];
      countdown = 6;
      makeChoices = picked => [
        { text: `${picked.icon} ${picked.name}`, correct: true },
        { text: '🌊 Ocean Wave', correct: false },
        { text: '🚗 Red Car', correct: false }
      ].sort(() => Math.random() - 0.5);
    } else if (level === 2) {
      targets = [
        { name: 'Butterfly', icon: '🦋' },
        { name: 'Red Apple', icon: '🍎' },
        { name: 'Golden Bell', icon: '🔔' }
      ];
      countdown = 4;
      makeChoices = picked => [
        { text: `${picked.icon} ${picked.name}`, correct: true },
        { text: '🌊 Ocean Wave', correct: false },
        { text: '🎈 Colorful Balloon', correct: false }
      ].sort(() => Math.random() - 0.5);
    } else {
      targets = [
        { name: 'Colorful Butterfly', icon: '🦋' },
        { name: 'Singing Sparrow', icon: '🐦' },
        { name: 'Golden Honeybee', icon: '🐝' }
      ];
      countdown = 3;
      makeChoices = picked => [
        { text: `${picked.icon} ${picked.name}`, correct: true },
        { text: '🐝 Yellow Honeybee', correct: false },
        { text: '🐦 Singing Sparrow', correct: false },
        { text: '🦗 Green Grasshopper', correct: false }
      ].filter((c, idx, arr) => c.correct || arr.findIndex(x => x.text === c.text) === idx).slice(0, 4).sort(() => Math.random() - 0.5);
    }

    const picked = targets[Math.floor(Math.random() * targets.length)];

    container.innerHTML = `
      <div class="arena-question-container">
        <p class="arena-q-prompt">Remember this item! It will disappear in <span id="rem-timer">${countdown}</span>s...</p>
        <div class="arena-q-image">${picked.icon}</div>
        <p class="text-large"><strong>${picked.name}</strong></p>
      </div>
    `;

    const timerInt = setInterval(() => {
      countdown--;
      const timerEl = document.getElementById('rem-timer');
      if (timerEl) timerEl.textContent = countdown;

      if (countdown <= 0) {
        clearInterval(timerInt);
        // Show recall question
        runChoiceGame(container, {
          prompt: 'What object was shown on the card?',
          image: '❓',
          choices: makeChoices(picked)
        });
      }
    }, 1000);
  }

  // --- GENERIC CHOICE GAME RUNNER ---
  function runChoiceGame(container, data) {
    container.innerHTML = `
      <div class="arena-question-container">
        <div class="arena-q-image" aria-hidden="true">${data.image}</div>
        <h3 class="arena-q-prompt">${escapeHTML(data.prompt)}</h3>
        <div class="arena-choices-grid">
          ${data.choices.map((c, i) => `
            <button type="button" class="arena-choice-btn" data-correct="${c.correct}">
              ${escapeHTML(c.text)}
            </button>
          `).join('')}
        </div>
      </div>
    `;

    container.querySelectorAll('.arena-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const isCorrect = btn.dataset.correct === 'true';
        if (isCorrect) {
          btn.style.backgroundColor = 'var(--color-success-light)';
          btn.style.borderColor = 'var(--color-success)';
          activeGameScore = 100;
          document.getElementById('arena-live-score').textContent = '100';
          setTimeout(() => {
            finishCurrentGame(100, 'Excellent answer! Very clear thinking.');
          }, 400);
        } else {
          btn.style.backgroundColor = 'var(--color-danger-light)';
          btn.style.borderColor = 'var(--color-danger)';
          setTimeout(() => {
            finishCurrentGame(70, 'Good effort! Practice helps the brain stay sharp.');
          }, 600);
        }
      });
    });
  }

  // ==========================================================================
  // FLOWER THROWING CELEBRATION ANIMATION
  // ==========================================================================
  function triggerFlowerThrowingCelebration() {
    let container = document.getElementById('flower-celebration-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'flower-celebration-container';
      container.className = 'flower-celebration-overlay';
      container.setAttribute('aria-hidden', 'true');
      document.body.appendChild(container);
    }

    // Reset container
    container.innerHTML = '';

    const flowers = ['🌸', '🌺', '🌼', '🌷', '🌻', '🌹', '💐', '🏵️'];
    const totalFlowers = 42; // Joyous floral shower

    for (let i = 0; i < totalFlowers; i++) {
      const el = document.createElement('div');
      el.className = 'celebration-flower-particle';
      el.textContent = flowers[Math.floor(Math.random() * flowers.length)];

      // Launch source: 0 = Bottom Left, 1 = Bottom Center, 2 = Bottom Right
      const source = i % 3;
      let startX, midX, driftX, endX;

      if (source === 0) {
        // Thrown upwards from bottom-left towards center and right
        startX = Math.random() * 22; // 0vw - 22vw
        midX = startX + 18 + Math.random() * 32;
        driftX = midX + (Math.random() * 16 - 8);
        endX = midX + 15 + Math.random() * 25;
      } else if (source === 1) {
        // Thrown upwards from bottom-center
        startX = 38 + Math.random() * 24; // 38vw - 62vw
        midX = startX + (Math.random() * 36 - 18);
        driftX = midX + (Math.random() * 20 - 10);
        endX = midX + (Math.random() * 40 - 20);
      } else {
        // Thrown upwards from bottom-right towards center and left
        startX = 78 + Math.random() * 20; // 78vw - 98vw
        midX = startX - 18 - Math.random() * 32;
        driftX = midX + (Math.random() * 16 - 8);
        endX = midX - 15 - Math.random() * 25;
      }

      const apexY = 6 + Math.random() * 34; // Apex height: 6vh to 40vh from top
      const duration = 2.4 + Math.random() * 1.5; // 2.4s to 3.9s
      const delay = Math.random() * 0.45; // Staggered launch
      const size = 1.9 + Math.random() * 1.6; // 1.9rem to 3.5rem

      const midRot = (Math.random() * 360 - 180) + 'deg';
      const apexRot = (Math.random() * 540 - 270) + 'deg';
      const endRot = (Math.random() * 900 - 450) + 'deg';

      el.style.fontSize = `${size}rem`;
      el.style.setProperty('--start-x', `${startX}vw`);
      el.style.setProperty('--mid-x', `${midX}vw`);
      el.style.setProperty('--drift-x', `${driftX}vw`);
      el.style.setProperty('--end-x', `${endX}vw`);
      el.style.setProperty('--apex-y', `${apexY}vh`);
      el.style.setProperty('--mid-rot', midRot);
      el.style.setProperty('--apex-rot', apexRot);
      el.style.setProperty('--end-rot', endRot);

      el.style.animation = `flowerThrowArc ${duration}s cubic-bezier(0.18, 0.95, 0.32, 1) ${delay}s forwards`;

      container.appendChild(el);
    }

    // Clean up particles from DOM when animation completes
    setTimeout(() => {
      if (container) {
        container.innerHTML = '';
      }
    }, 4500);
  }

  function finishCurrentGame(score, message) {
    // Immediately trigger the celebratory flower throwing animation!
    triggerFlowerThrowingCelebration();

    // Record prior points and flower state to detect threshold transitions
    const prevPoints = getLifetimePoints();
    const prevFlower = getFlowerProgress(prevPoints);

    const levelLabel = currentActiveLevel === 1 ? 'Level 1 — Easy' : currentActiveLevel === 2 ? 'Level 2 — Medium' : 'Level 3 — Hard';

    // Record score
    const scores = get(STORAGE_KEYS.SCORES, []);
    const record = {
      id: 'sc_' + Date.now(),
      gameName: currentActiveGame.title,
      stage: currentActiveGame.stageLabel,
      score: score,
      level: currentActiveLevel,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      timestamp: Date.now()
    };
    scores.push(record);
    put(STORAGE_KEYS.SCORES, scores);

    // Asynchronously sync to SQLite Database if online
    if (isDatabaseOnline) {
      fetch(`${API_BASE}/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: 1,
          game_id: currentActiveGame.id,
          game_name: currentActiveGame.title,
          stage: currentActiveGame.stageLabel,
          score: score,
          duration_seconds: 30,
          level: currentActiveLevel
        })
      }).catch(err => console.warn('[ManasMitra DB] Score sync error:', err));
    }

    // Immediately update flower progress
    const newPoints = getLifetimePoints();
    const newFlower = getFlowerProgress(newPoints);
    renderFlowerGrowthCards();

    // Check if flower growth crossed a stage threshold
    const crossedThreshold = newFlower.stage.name !== prevFlower.stage.name;

    // Toast notifications
    showToast(`Wonderful! You earned ${score} points on ${levelLabel}! 🌸`, 'success');

    if (crossedThreshold) {
      setTimeout(() => {
        showToast(`🎉 Celebration! Your flower grew into a ${newFlower.stage.name}! ${newFlower.stage.icon}`, 'success');
      }, 1200);
      speakAssistantContext(`Congratulations! Your flower has grown into a ${newFlower.stage.name}!`);
    } else {
      speakAssistantContext(`Wonderful effort on ${levelLabel}! You scored ${score} points!`);
    }

    // Show modal feedback
    const modal = document.getElementById('arena-feedback-modal');
    document.getElementById('arena-feedback-title').textContent = score >= 80 ? 'Wonderful Effort! 🌟' : 'Good Try! 👏';
    
    const levelBadgeEl = document.getElementById('arena-feedback-level-badge');
    if (levelBadgeEl) {
      levelBadgeEl.textContent = `${levelLabel} Completed`;
    }

    document.getElementById('arena-feedback-msg').textContent = `${message} You scored ${score} points on ${levelLabel}!`;
    document.getElementById('arena-feedback-stars').textContent = score >= 90 ? '⭐⭐⭐' : score >= 70 ? '⭐⭐' : '⭐';

    // Update arena flower growth chip
    const chipIcon = document.getElementById('arena-flower-chip-icon');
    const chipText = document.getElementById('arena-flower-chip-text');
    if (chipIcon) chipIcon.textContent = newFlower.stage.icon;
    if (chipText) {
      chipText.textContent = `+${score} Points! Flower celebration 🌸`;
    }

    modal.classList.remove('hidden');

    document.getElementById('btn-arena-replay').onclick = () => {
      modal.classList.add('hidden');
      launchGameArena(currentActiveGame.id, currentActiveLevel);
    };

    document.getElementById('btn-arena-done').onclick = () => {
      modal.classList.add('hidden');
      navigateTo('view-games');
    };
  }

  // Arena Exit Button
  document.getElementById('btn-arena-exit')?.addEventListener('click', () => {
    navigateTo('view-games');
  });

  // ==========================================================================
  // 9. DETERMINISTIC CENTRAL REMINDER SCHEDULER & MODAL POPUP
  // ==========================================================================
  /**
   * CRITICAL ARCHITECTURE RULE:
   * Do NOT use recursive setTimeout chains.
   * Use ONE central interval running every 1000ms.
   *
   * Flow:
   * Scheduled Time -> Popup -> "No" -> Exactly one 5-minute snooze -> Popup -> "No" -> STOP for the day.
   * If "Yes" at either popup -> Task completed -> Stop for the day.
   * Only ONE popup open at a time.
   */
  let activeReminderModalId = null;

  function initReminderScheduler() {
    setInterval(checkReminders, 1000);

    // Form submission
    const form = document.getElementById('form-add-reminder');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const taskName = document.getElementById('rem-task-name').value.trim();
        const timeVal = document.getElementById('rem-time').value;
        const repeatVal = document.getElementById('rem-repeat').value;

        if (!taskName || !timeVal) {
          showToast('Please provide both task name and time.', 'warning');
          return;
        }

        const newReminder = {
          id: 'rem_' + Date.now(),
          task: taskName,
          time: timeVal,
          repeat: repeatVal,
          snoozeUntil: null,
          snoozeUsed: false,
          skippedToday: false,
          completedDate: null,
          stateDate: getTodayDateString()
        };

        const reminders = get(STORAGE_KEYS.REMINDERS, []);
        reminders.push(newReminder);
        put(STORAGE_KEYS.REMINDERS, reminders);

        // Asynchronously sync to SQLite Database if online
        if (isDatabaseOnline) {
          fetch(`${API_BASE}/reminders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              patient_id: 1,
              task_name: taskName,
              scheduled_time: timeVal,
              repeat_type: repeatVal
            })
          }).catch(err => console.warn('[ManasMitra DB] Reminder sync error:', err));
        }

        form.reset();
        showToast(`Reminder set for ${timeVal}!`, 'success');
        renderRemindersList();
      });
    }

    // Preset Suggestions chips
    document.querySelectorAll('.preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const taskInput = document.getElementById('rem-task-name');
        if (taskInput) {
          taskInput.value = chip.dataset.name;
          taskInput.focus();
        }
      });
    });

    // Test Reminder Now Button (Triggers instant popup for hackathon demonstration)
    document.getElementById('btn-test-reminder-now')?.addEventListener('click', () => {
      triggerTestReminderPopup();
    });

    // Popup action buttons
    document.getElementById('btn-rem-yes')?.addEventListener('click', handleReminderYes);
    document.getElementById('btn-rem-no')?.addEventListener('click', handleReminderNo);
  }

  function checkReminders() {
    const reminders = get(STORAGE_KEYS.REMINDERS, []);
    if (!reminders || reminders.length === 0) return;

    const now = new Date();
    const today = getTodayDateString();
    const currentHH = String(now.getHours()).padStart(2, '0');
    const currentMM = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHH}:${currentMM}`;
    const nowTimestamp = now.getTime();

    let updated = false;

    for (let i = 0; i < reminders.length; i++) {
      const r = reminders[i];

      // Midnight / New Day State Reset
      if (r.stateDate !== today) {
        r.stateDate = today;
        r.snoozeUntil = null;
        r.snoozeUsed = false;
        r.skippedToday = false;
        r.completedDate = null;
        updated = true;
      }

      // If already handled today (completed or skipped after 2nd NO), skip
      if (r.completedDate === today || r.skippedToday) {
        continue;
      }

      // If a popup is already currently displaying on screen, do not open another simultaneously
      if (activeReminderModalId !== null) {
        break;
      }

      // 1. SNOOZE CHECK: Did a 5-minute snooze elapse?
      if (r.snoozeUntil && nowTimestamp >= r.snoozeUntil) {
        r.snoozeUntil = null; // Clear snooze trigger
        updated = true;
        openReminderModal(r, true);
        break;
      }

      // 2. NORMAL TIME CHECK: Is it the exact scheduled time?
      if (!r.snoozeUntil && !r.snoozeUsed && r.time === currentTimeStr) {
        // Trigger only once per minute
        if (r.lastTriggerMinute !== currentTimeStr) {
          r.lastTriggerMinute = currentTimeStr;
          updated = true;
          openReminderModal(r, false);
          break;
        }
      }
    }

    if (updated) {
      put(STORAGE_KEYS.REMINDERS, reminders);
    }
  }

  function openReminderModal(reminder, isSnoozed) {
    activeReminderModalId = reminder.id;
    const modal = document.getElementById('reminder-modal');
    const taskNameEl = document.getElementById('modal-rem-task-name');
    const badgeEl = document.getElementById('modal-rem-status-badge');

    taskNameEl.textContent = reminder.task;
    badgeEl.textContent = isSnoozed ? '⏰ 5-Minute Follow-up Reminder' : '🔔 Scheduled Daily Routine';

    modal.classList.remove('hidden');

    const speechText = `Reminder for ${reminder.task}. Have you completed this task?`;
    speakAssistantContext(speechText);
  }

  function closeReminderModal() {
    activeReminderModalId = null;
    const modal = document.getElementById('reminder-modal');
    if (modal) modal.classList.add('hidden');
  }

  function handleReminderYes() {
    if (!activeReminderModalId) return;

    const reminders = get(STORAGE_KEYS.REMINDERS, []);
    const today = getTodayDateString();
    const target = reminders.find(r => r.id === activeReminderModalId);

    if (target) {
      target.completedDate = today;
      target.snoozeUntil = null;
      put(STORAGE_KEYS.REMINDERS, reminders);
      showToast(`Great job! "${target.task}" marked as completed today.`, 'success');
      speakAssistantContext(`Wonderful! ${target.task} marked as completed.`);
    }

    closeReminderModal();
    renderRemindersList();
    if (currentActiveViewId === 'view-dashboard') renderDashboard();
  }

  function handleReminderNo() {
    if (!activeReminderModalId) return;

    const reminders = get(STORAGE_KEYS.REMINDERS, []);
    const target = reminders.find(r => r.id === activeReminderModalId);

    if (target) {
      if (!target.snoozeUsed) {
        // FIRST NO: Schedule exactly ONE popup after 5 minutes
        target.snoozeUntil = Date.now() + 5 * 60 * 1000; // 5 minutes in milliseconds
        target.snoozeUsed = true;
        put(STORAGE_KEYS.REMINDERS, reminders);
        showToast('Reminder deferred. We will remind you once more in 5 minutes.', 'info');
        speakAssistantContext(`Understood. ManasMitra will remind you once more in 5 minutes.`);
      } else {
        // SECOND NO: STOP showing popup for the rest of today. No infinite loop!
        target.skippedToday = true;
        target.snoozeUntil = null;
        put(STORAGE_KEYS.REMINDERS, reminders);
        showToast('Reminder paused for the rest of today.', 'warning');
        speakAssistantContext(`Understood. We will rest this reminder for the rest of today.`);
      }
    }

    closeReminderModal();
    renderRemindersList();
    if (currentActiveViewId === 'view-dashboard') renderDashboard();
  }

  function triggerTestReminderPopup() {
    const testReminder = {
      id: 'test_rem_' + Date.now(),
      task: 'Drink a Glass of Warm Water (Test Alert)',
      time: 'Now',
      repeat: 'once',
      snoozeUntil: null,
      snoozeUsed: false,
      skippedToday: false,
      completedDate: null,
      stateDate: getTodayDateString()
    };

    // Save temporarily into storage so snooze/yes handlers work identically
    const reminders = get(STORAGE_KEYS.REMINDERS, []);
    reminders.push(testReminder);
    put(STORAGE_KEYS.REMINDERS, reminders);

    openReminderModal(testReminder, false);
  }

  function markReminderCompleted(id) {
    const reminders = get(STORAGE_KEYS.REMINDERS, []);
    const today = getTodayDateString();
    const target = reminders.find(r => r.id === id);
    if (target) {
      target.completedDate = today;
      target.snoozeUntil = null;
      put(STORAGE_KEYS.REMINDERS, reminders);
      showToast(`"${target.task}" completed!`, 'success');
      renderDashboard();
    }
  }

  function deleteReminder(id) {
    // If currently displaying popup belongs to this reminder, close it immediately
    if (activeReminderModalId === id) {
      closeReminderModal();
    }

    let reminders = get(STORAGE_KEYS.REMINDERS, []);
    reminders = reminders.filter(r => r.id !== id);
    put(STORAGE_KEYS.REMINDERS, reminders);
    showToast('Reminder deleted.', 'info');
    renderRemindersList();
    if (currentActiveViewId === 'view-dashboard') renderDashboard();
  }

  function renderRemindersList() {
    const container = document.getElementById('reminders-active-list');
    if (!container) return;

    const reminders = get(STORAGE_KEYS.REMINDERS, []);
    const today = getTodayDateString();

    if (reminders.length === 0) {
      container.innerHTML = `
        <div class="text-center py-4 text-muted">
          <p>No reminders configured. Add your first routine task above!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = reminders.map(r => {
      const isCompleted = r.completedDate === today;
      const isSnoozed = r.snoozeUntil && !isCompleted;
      const isSkipped = r.skippedToday;

      let statusBadge = '<span class="badge badge-teal">Scheduled</span>';
      if (isCompleted) statusBadge = '<span class="badge badge-success">Completed Today</span>';
      else if (isSnoozed) statusBadge = '<span class="badge badge-amber">Snoozed (5 Min)</span>';
      else if (isSkipped) statusBadge = '<span class="badge badge-amber">Paused for Today</span>';

      return `
        <div class="reminder-row-card">
          <div class="reminder-row-left">
            <span class="reminder-row-icon" aria-hidden="true">⏰</span>
            <div class="reminder-row-details">
              <span class="reminder-row-title">${escapeHTML(r.task)}</span>
              <span class="reminder-row-meta">Repeat: ${r.repeat === 'daily' ? 'Every Day' : 'Once'} &bull; ${statusBadge}</span>
            </div>
          </div>
          <div class="reminder-row-actions">
            <span class="reminder-row-time">${r.time}</span>
            <button type="button" class="btn btn-danger btn-compact btn-delete-rem" data-id="${r.id}" title="Delete reminder">
              🗑️ Delete
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-delete-rem').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        deleteReminder(id);
      });
    });
  }

  // ==========================================================================
  // 10. MEMORY BOOK CONTROLLER
  // ==========================================================================
  function initMemoryBook() {
    const openModalBtn = document.getElementById('btn-open-memory-modal');
    const closeModalBtn = document.getElementById('btn-close-memory-modal');
    const cancelModalBtn = document.getElementById('btn-cancel-memory-modal');
    const modal = document.getElementById('modal-add-memory');
    const form = document.getElementById('form-add-memory');

    openModalBtn?.addEventListener('click', () => {
      modal?.classList.remove('hidden');
    });

    [closeModalBtn, cancelModalBtn].forEach(btn => {
      btn?.addEventListener('click', () => {
        modal?.classList.add('hidden');
        form?.reset();
      });
    });

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('mem-title').value.trim();
        const desc = document.getElementById('mem-desc').value.trim();
        const preset = document.querySelector('input[name="mem-preset"]:checked')?.value || 'family';
        const fileInput = document.getElementById('mem-custom-file');

        if (!title || !desc) {
          showToast('Please enter both title and story.', 'warning');
          return;
        }

        if (fileInput && fileInput.files && fileInput.files[0]) {
          const reader = new FileReader();
          reader.onload = (loadEvt) => {
            saveMemoryRecord(title, desc, preset, loadEvt.target.result);
          };
          reader.readAsDataURL(fileInput.files[0]);
        } else {
          saveMemoryRecord(title, desc, preset, null);
        }
      });
    }
  }

  function saveMemoryRecord(title, desc, preset, customImage) {
    const memories = get(STORAGE_KEYS.MEMORIES, []);
    const newMemory = {
      id: 'mem_' + Date.now(),
      title: title,
      desc: desc,
      date: new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
      preset: preset,
      customImage: customImage
    };
    memories.unshift(newMemory);
    put(STORAGE_KEYS.MEMORIES, memories);

    // Asynchronously sync to SQLite Database if online
    if (isDatabaseOnline) {
      fetch(`${API_BASE}/memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: 1,
          title: title,
          description: desc,
          memory_date: newMemory.date,
          preset_icon: preset,
          image_data: customImage
        })
      }).catch(err => console.warn('[ManasMitra DB] Memory sync error:', err));
    }

    showToast('Memory saved to your book!', 'success');
    document.getElementById('modal-add-memory')?.classList.add('hidden');
    document.getElementById('form-add-memory')?.reset();
    renderMemoryCards();
  }

  function deleteMemory(id) {
    let memories = get(STORAGE_KEYS.MEMORIES, []);
    memories = memories.filter(m => m.id !== id);
    put(STORAGE_KEYS.MEMORIES, memories);
    showToast('Memory removed.', 'info');
    renderMemoryCards();
  }

  function renderMemoryCards() {
    const grid = document.getElementById('memory-cards-grid');
    if (!grid) return;

    const memories = get(STORAGE_KEYS.MEMORIES, []);
    if (memories.length === 0) {
      grid.innerHTML = `
        <div class="card text-center py-5 text-muted col-span-full">
          <p>No memories saved yet. Click "Add New Memory" to record a cherished moment!</p>
        </div>
      `;
      return;
    }

    const presetIcons = {
      family: '👨‍👩‍👧‍👦',
      garden: '🌺',
      travel: '🏔️',
      tea: '☕'
    };

    grid.innerHTML = memories.map(m => `
      <div class="memory-card">
        <div class="memory-photo-wrap">
          ${m.customImage
            ? `<img src="${m.customImage}" alt="${escapeHTML(m.title)}" class="memory-photo-img">`
            : `<span class="memory-photo-preset-icon" aria-hidden="true">${presetIcons[m.preset] || '🌸'}</span>`
          }
        </div>
        <div class="memory-content">
          <h3 class="memory-title">${escapeHTML(m.title)}</h3>
          <span class="memory-date">Recorded: ${m.date}</span>
          <p class="memory-desc">${escapeHTML(m.desc)}</p>
          <div class="memory-footer">
            <button type="button" class="btn btn-danger btn-compact btn-del-mem" data-id="${m.id}">
              🗑️ Delete
            </button>
          </div>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.btn-del-mem').forEach(btn => {
      btn.addEventListener('click', () => {
        deleteMemory(btn.dataset.id);
      });
    });
  }

  // ==========================================================================
  // 11. FAMILY & CAREGIVER DIRECTORY CONTROLLER (WITH WEB SPEECH & VIDEO)
  // ==========================================================================

  // --------------------------------------------------------------------------
  // Family Video Storage System (IndexedDB with localStorage fallback)
  // Keeps large video binaries out of SQLite while providing seamless local persistence.
  // --------------------------------------------------------------------------
  const FamilyVideoStore = {
    DB_NAME: 'ManasMitraDB_Videos',
    STORE_NAME: 'family_videos',
    _dbPromise: null,

    getDB() {
      if (this._dbPromise) return this._dbPromise;
      this._dbPromise = new Promise((resolve) => {
        if (!window.indexedDB) {
          resolve(null);
          return;
        }
        try {
          const req = indexedDB.open(this.DB_NAME, 1);
          req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(this.STORE_NAME)) {
              db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
            }
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
      return this._dbPromise;
    },

    async saveVideo(memberId, fileOrBlob, filename, mimeType) {
      try {
        const db = await this.getDB();
        if (db) {
          return new Promise((resolve) => {
            try {
              const tx = db.transaction(this.STORE_NAME, 'readwrite');
              const store = tx.objectStore(this.STORE_NAME);
              store.put({
                id: memberId,
                blob: fileOrBlob,
                name: filename,
                type: mimeType || fileOrBlob.type || 'video/mp4',
                updatedAt: Date.now()
              });
              tx.oncomplete = () => resolve(true);
              tx.onerror = () => resolve(false);
            } catch (err) {
              resolve(false);
            }
          });
        }
      } catch (e) {
        console.warn('[FamilyVideoStore] IndexedDB error:', e);
      }

      // Fallback for smaller demo clips if IndexedDB is blocked:
      if (fileOrBlob && fileOrBlob.size && fileOrBlob.size < 3 * 1024 * 1024) {
        try {
          const reader = new FileReader();
          return new Promise((resolve) => {
            reader.onload = () => {
              try {
                localStorage.setItem(`mm_vid_${memberId}`, reader.result);
                resolve(true);
              } catch (err) {
                resolve(false);
              }
            };
            reader.onerror = () => resolve(false);
            reader.readAsDataURL(fileOrBlob);
          });
        } catch (e) {
          return false;
        }
      }
      return false;
    },

    async getVideo(memberId) {
      try {
        const db = await this.getDB();
        if (db) {
          const item = await new Promise((resolve) => {
            try {
              const tx = db.transaction(this.STORE_NAME, 'readonly');
              const store = tx.objectStore(this.STORE_NAME);
              const req = store.get(memberId);
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => resolve(null);
            } catch (err) {
              resolve(null);
            }
          });
          if (item && item.blob) {
            return URL.createObjectURL(item.blob);
          }
        }
      } catch (e) {
        console.warn('[FamilyVideoStore] IndexedDB retrieval error:', e);
      }

      // Check localStorage fallback
      const local = localStorage.getItem(`mm_vid_${memberId}`);
      if (local) return local;
      return null;
    },

    async deleteVideo(memberId) {
      try {
        const db = await this.getDB();
        if (db) {
          const tx = db.transaction(this.STORE_NAME, 'readwrite');
          const store = tx.objectStore(this.STORE_NAME);
          store.delete(memberId);
        }
      } catch (e) {
        console.warn('[FamilyVideoStore] Delete error:', e);
      }
      try {
        localStorage.removeItem(`mm_vid_${memberId}`);
      } catch (e) {}
    }
  };

  function isValidPhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') return false;
    const trimmed = phone.trim();
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) return false;
    return /^[+]?[\d\s\-()]{7,25}$/.test(trimmed);
  }

  function initFamilyDirectory() {
    const openModalBtn = document.getElementById('btn-open-family-modal');
    const closeModalBtn = document.getElementById('btn-close-family-modal');
    const cancelModalBtn = document.getElementById('btn-cancel-family-modal');
    const modal = document.getElementById('modal-add-family');
    const form = document.getElementById('form-add-family');
    const speakBtn = document.getElementById('btn-speak-family');

    // Video form controls
    const videoFileInput = document.getElementById('fam-video-file');
    const chooseVideoBtn = document.getElementById('btn-choose-fam-video');
    const clearVideoBtn = document.getElementById('btn-clear-fam-video');
    const videoFileInfo = document.getElementById('fam-video-file-info');
    const videoError = document.getElementById('fam-video-error');
    const videoPreviewWrapper = document.getElementById('fam-video-preview-wrapper');
    const videoPreview = document.getElementById('fam-video-preview');

    let currentSelectedVideoFile = null;
    let currentPreviewUrl = null;

    function resetVideoUploadField() {
      if (currentPreviewUrl) {
        URL.revokeObjectURL(currentPreviewUrl);
        currentPreviewUrl = null;
      }
      currentSelectedVideoFile = null;
      if (videoFileInput) videoFileInput.value = '';
      if (videoPreview) {
        videoPreview.pause();
        videoPreview.removeAttribute('src');
        videoPreview.load();
      }
      if (videoPreviewWrapper) videoPreviewWrapper.classList.add('hidden');
      if (clearVideoBtn) clearVideoBtn.classList.add('hidden');
      if (videoError) {
        videoError.textContent = '';
        videoError.classList.add('hidden');
      }
      if (videoFileInfo) {
        videoFileInfo.textContent = 'No video chosen (MP4, WebM, OGG up to 25MB)';
        videoFileInfo.classList.remove('text-danger');
      }
      const isPrimaryCheckbox = document.getElementById('fam-is-primary');
      if (isPrimaryCheckbox) isPrimaryCheckbox.checked = false;
    }

    chooseVideoBtn?.addEventListener('click', () => {
      videoFileInput?.click();
    });

    clearVideoBtn?.addEventListener('click', () => {
      resetVideoUploadField();
    });

    videoFileInput?.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      // Validate file type
      const validTypes = ['video/mp4', 'video/webm', 'video/ogg'];
      const validExtensions = ['.mp4', '.webm', '.ogg', '.ogv'];
      const fileNameLower = file.name.toLowerCase();
      const hasValidExt = validExtensions.some(ext => fileNameLower.endsWith(ext));
      const hasValidType = validTypes.includes(file.type);

      if (!hasValidType && !hasValidExt) {
        if (videoError) {
          videoError.textContent = '⚠️ Unsupported file type. Please choose a video in MP4, WebM, or OGG format.';
          videoError.classList.remove('hidden');
        }
        showToast('Unsupported file type. Please choose MP4, WebM, or OGG video.', 'warning');
        resetVideoUploadField();
        return;
      }

      // Validate file size (max 25MB)
      const maxSize = 25 * 1024 * 1024;
      if (file.size > maxSize) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        if (videoError) {
          videoError.textContent = `⚠️ Video file is too large (${sizeMb} MB). Maximum allowed size is 25 MB.`;
          videoError.classList.remove('hidden');
        }
        showToast(`Video too large (${sizeMb} MB). Max allowed is 25 MB.`, 'warning');
        resetVideoUploadField();
        return;
      }

      // Clear any prior errors
      if (videoError) {
        videoError.textContent = '';
        videoError.classList.add('hidden');
      }

      currentSelectedVideoFile = file;
      if (currentPreviewUrl) {
        URL.revokeObjectURL(currentPreviewUrl);
      }
      currentPreviewUrl = URL.createObjectURL(file);

      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      if (videoFileInfo) {
        videoFileInfo.textContent = `📹 ${file.name} (${sizeMb} MB)`;
        videoFileInfo.classList.remove('text-danger');
      }
      if (clearVideoBtn) clearVideoBtn.classList.remove('hidden');

      if (videoPreview) {
        videoPreview.src = currentPreviewUrl;
        videoPreview.pause();
      }
      if (videoPreviewWrapper) {
        videoPreviewWrapper.classList.remove('hidden');
      }
    });

    openModalBtn?.addEventListener('click', () => {
      modal?.classList.remove('hidden');
    });

    [closeModalBtn, cancelModalBtn].forEach(btn => {
      btn?.addEventListener('click', () => {
        modal?.classList.add('hidden');
        form?.reset();
        resetVideoUploadField();
      });
    });

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('fam-name').value.trim();
        const relation = document.getElementById('fam-relation').value.trim();
        const phone = document.getElementById('fam-phone').value.trim();
        const email = document.getElementById('fam-email').value.trim();
        const city = document.getElementById('fam-city').value.trim();
        const role = document.getElementById('fam-role').value;
        const notes = document.getElementById('fam-notes').value.trim();
        const isPrimary = document.getElementById('fam-is-primary')?.checked || false;

        if (!name || !relation || !phone) {
          showToast('Please enter Name, Relationship, and Phone.', 'warning');
          return;
        }

        // Validate telephone number format (7 to 15 digits)
        if (!isValidPhoneNumber(phone)) {
          showToast('Please enter a valid phone number (7 to 15 digits).', 'warning');
          return;
        }

        let members = get(STORAGE_KEYS.FAMILY, []);
        // If designated as primary, clear primary status from other members
        if (isPrimary) {
          members = members.map(m => ({ ...m, is_primary: false }));
          // Safely update caregiver details in patient profile without altering PIN
          const patient = get(STORAGE_KEYS.PATIENT);
          if (patient) {
            patient.caregiver = name;
            patient.phone = phone;
            put(STORAGE_KEYS.PATIENT, patient);
          }
        }

        const newMemberId = 'fam_' + Date.now();
        const hasVideo = !!currentSelectedVideoFile;

        const newMember = {
          id: newMemberId,
          name: name,
          relation: relation,
          phone: phone,
          email: email,
          city: city,
          role: role,
          notes: notes,
          is_primary: isPrimary,
          hasVideo: hasVideo,
          videoName: currentSelectedVideoFile ? currentSelectedVideoFile.name : null
        };

        if (hasVideo && currentSelectedVideoFile) {
          await FamilyVideoStore.saveVideo(
            newMemberId,
            currentSelectedVideoFile,
            currentSelectedVideoFile.name,
            currentSelectedVideoFile.type
          );
        }

        members.push(newMember);
        put(STORAGE_KEYS.FAMILY, members);

        // Asynchronously sync to SQLite Database if online
        if (isDatabaseOnline) {
          fetch(`${API_BASE}/family`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              patient_id: 1,
              name: name,
              relationship: relation,
              phone: phone,
              email: email,
              city: city,
              support_role: role,
              notes: notes,
              is_primary: isPrimary ? 1 : 0
            })
          }).catch(err => console.warn('[ManasMitra DB] Family sync error:', err));
        }

        const labelText = isPrimary ? 'Primary Caregiver' : role;
        showToast(`${labelText} "${name}" added!`, 'success');
        modal?.classList.add('hidden');
        form.reset();
        resetVideoUploadField();
        renderFamilyCards();
      });
    }

    speakBtn?.addEventListener('click', speakFamilyMembersAloud);

    // Elderly-Friendly Video Player Modal Handlers
    const videoPlayerModal = document.getElementById('modal-family-video');
    const videoPlayerCloseBtn = document.getElementById('btn-close-family-video-modal');
    const videoPlayerDismissBtn = document.getElementById('btn-video-dismiss');
    const videoPlayerPlayToggle = document.getElementById('btn-video-play-toggle');
    const familyPlayerVideo = document.getElementById('family-player-video');

    function closeFamilyVideoModal() {
      if (familyPlayerVideo) {
        familyPlayerVideo.pause();
        familyPlayerVideo.currentTime = 0;
        familyPlayerVideo.removeAttribute('src');
        familyPlayerVideo.load();
      }
      if (videoPlayerPlayToggle) {
        videoPlayerPlayToggle.innerHTML = '▶️ Play';
      }
      videoPlayerModal?.classList.add('hidden');
    }

    [videoPlayerCloseBtn, videoPlayerDismissBtn].forEach(btn => {
      btn?.addEventListener('click', closeFamilyVideoModal);
    });

    videoPlayerPlayToggle?.addEventListener('click', () => {
      if (!familyPlayerVideo) return;
      if (familyPlayerVideo.paused) {
        familyPlayerVideo.play();
      } else {
        familyPlayerVideo.pause();
      }
    });

    familyPlayerVideo?.addEventListener('play', () => {
      if (videoPlayerPlayToggle) videoPlayerPlayToggle.innerHTML = '⏸️ Pause';
    });

    familyPlayerVideo?.addEventListener('pause', () => {
      if (videoPlayerPlayToggle) videoPlayerPlayToggle.innerHTML = '▶️ Play';
    });

    familyPlayerVideo?.addEventListener('ended', () => {
      if (videoPlayerPlayToggle) videoPlayerPlayToggle.innerHTML = '▶️ Replay';
    });
  }

  function speakFamilyMembersAloud() {
    const members = get(STORAGE_KEYS.FAMILY, []);
    if (!members || members.length === 0) {
      speakAssistantContext('You currently have no family contacts saved in your directory.');
      return;
    }

    const patient = get(STORAGE_KEYS.PATIENT);
    let speech = `Here are your trusted contacts: `;
    members.forEach((m, idx) => {
      const isPrimary = !!m.is_primary || (patient && (m.phone === patient.phone || m.name === patient.caregiver));
      const roleText = isPrimary ? 'Primary Caregiver' : m.role;
      speech += `Number ${idx + 1}: ${m.name}, your ${m.relation}. Role: ${roleText}. Phone number: ${m.phone}. `;
      if (m.notes) speech += `Note: ${m.notes}. `;
    });

    speakAssistantContext(speech);
  }

  async function deleteFamilyMember(id) {
    // 1. Remove associated video safely from storage if exists
    await FamilyVideoStore.deleteVideo(id);

    // 2. Remove member from local storage
    let members = get(STORAGE_KEYS.FAMILY, []);
    members = members.filter(m => m.id !== id);
    put(STORAGE_KEYS.FAMILY, members);

    // 3. Sync delete with SQLite database if online
    if (isDatabaseOnline && id) {
      const numericId = id.toString().replace('fam_', '');
      if (/^\d+$/.test(numericId)) {
        fetch(`${API_BASE}/family/${numericId}`, {
          method: 'DELETE'
        }).catch(err => console.warn('[ManasMitra DB] Family delete error:', err));
      }
    }

    showToast('Contact removed.', 'info');
    renderFamilyCards();
  }

  function renderFamilyCards() {
    const grid = document.getElementById('family-cards-grid');
    if (!grid) return;

    const members = get(STORAGE_KEYS.FAMILY, []);
    if (members.length === 0) {
      grid.innerHTML = `
        <div class="card text-center py-5 text-muted col-span-full">
          <p>No family contacts saved yet. Click "Add Member" to keep loved ones close!</p>
        </div>
      `;
      return;
    }

    const patient = get(STORAGE_KEYS.PATIENT);

    // Sort: Primary Caregiver first, then additional caregivers, then family, then others
    const sortedMembers = [...members].sort((a, b) => {
      const aPrimary = a.is_primary || (patient && (a.phone === patient.phone || a.name === patient.caregiver));
      const bPrimary = b.is_primary || (patient && (b.phone === patient.phone || b.name === patient.caregiver));
      if (aPrimary && !bPrimary) return -1;
      if (!aPrimary && bPrimary) return 1;
      if (a.role === 'Caregiver' && b.role !== 'Caregiver') return -1;
      if (a.role !== 'Caregiver' && b.role === 'Caregiver') return 1;
      return 0;
    });

    const roleBadges = {
      'Family': 'badge-teal',
      'Caregiver': 'badge-amber',
      'Doctor': 'badge-success',
      'Community Health Worker': 'badge-teal',
      'Trusted Person': 'badge-indigo'
    };

    grid.innerHTML = sortedMembers.map(m => {
      const isPrimary = !!m.is_primary || (patient && (m.phone === patient.phone || m.name === patient.caregiver));
      let roleLabel = escapeHTML(m.role);
      let badgeClass = roleBadges[m.role] || 'badge-teal';
      let avatarIcon = m.role === 'Doctor' ? '🩺' : m.role === 'Caregiver' ? '🤝' : m.role === 'Trusted Person' ? '🛡️' : '❤️';

      if (isPrimary) {
        roleLabel = '⭐ Primary Caregiver';
        badgeClass = 'badge-primary-caregiver';
        avatarIcon = '🌟';
      } else if (m.role === 'Caregiver') {
        roleLabel = '🤝 Caregiver';
      } else if (m.role === 'Family') {
        roleLabel = '❤️ Family Member';
      }

      return `
      <div class="family-card ${isPrimary ? 'primary-caregiver-card' : ''}">
        <div class="family-top">
          <div class="family-avatar" aria-hidden="true">
            ${avatarIcon}
          </div>
          <div class="family-info">
            <h3 class="family-name">${escapeHTML(m.name)}</h3>
            <span class="family-relation">${escapeHTML(m.relation)}</span>
          </div>
          <span class="badge ${badgeClass}">${roleLabel}</span>
        </div>

        <div class="family-meta-row">
          <a href="tel:${escapeHTML(m.phone)}" class="family-call-btn" title="Call directly">
            📞 Call ${escapeHTML(m.phone)}
          </a>
        </div>

        ${m.city ? `<div class="text-sm text-muted">📍 Location: ${escapeHTML(m.city)}</div>` : ''}
        ${m.email ? `<div class="text-sm text-muted">✉️ Email: ${escapeHTML(m.email)}</div>` : ''}
        ${m.notes ? `<div class="family-notes-box">💡 ${escapeHTML(m.notes)}</div>` : ''}

        <div class="family-actions">
          ${m.hasVideo ? `
          <button type="button" class="btn btn-compact btn-watch-video" data-id="${escapeHTML(m.id)}" data-name="${escapeHTML(m.name)}" title="Watch video from ${escapeHTML(m.name)}">
            🎥 Watch Video
          </button>
          ` : ''}
          <button type="button" class="btn btn-outline btn-compact btn-speak-single" data-name="${escapeHTML(m.name)}" data-rel="${escapeHTML(m.relation)}" data-phone="${escapeHTML(m.phone)}" data-role="${escapeHTML(isPrimary ? 'Primary Caregiver' : m.role)}">
            🔊 Read
          </button>
          <button type="button" class="btn btn-danger btn-compact btn-del-fam" data-id="${m.id}">
            🗑️ Delete
          </button>
        </div>
      </div>
      `;
    }).join('');

    // Attach watch video buttons
    grid.querySelectorAll('.btn-watch-video').forEach(btn => {
      btn.addEventListener('click', async () => {
        const memberId = btn.dataset.id;
        const memberName = btn.dataset.name || 'Family';
        const videoSrc = await FamilyVideoStore.getVideo(memberId);
        if (!videoSrc) {
          showToast('No video available for this contact.', 'info');
          return;
        }

        const videoPlayerTitle = document.getElementById('modal-family-video-title');
        const familyPlayerVideo = document.getElementById('family-player-video');
        const videoPlayerPlayToggle = document.getElementById('btn-video-play-toggle');
        const videoPlayerModal = document.getElementById('modal-family-video');

        if (videoPlayerTitle) {
          videoPlayerTitle.textContent = `🎥 Video: ${memberName}`;
        }
        if (familyPlayerVideo) {
          familyPlayerVideo.src = videoSrc;
          familyPlayerVideo.pause();
          familyPlayerVideo.currentTime = 0;
        }
        if (videoPlayerPlayToggle) {
          videoPlayerPlayToggle.innerHTML = '▶️ Play';
        }
        videoPlayerModal?.classList.remove('hidden');
      });
    });

    // Attach single member speak buttons
    grid.querySelectorAll('.btn-speak-single').forEach(btn => {
      btn.addEventListener('click', () => {
        const role = btn.dataset.role || 'Contact';
        const text = `${btn.dataset.name}, your ${btn.dataset.rel}. Role: ${role}. Phone number: ${btn.dataset.phone}.`;
        speakAssistantContext(text);
      });
    });

    // Attach delete buttons
    grid.querySelectorAll('.btn-del-fam').forEach(btn => {
      btn.addEventListener('click', () => {
        deleteFamilyMember(btn.dataset.id);
      });
    });
  }

  // ==========================================================================
  // 12. FRONTEND AI ACTIVITY ANALYSIS PROTOTYPE
  // ==========================================================================
  function renderAiAnalysis() {
    const scores = get(STORAGE_KEYS.SCORES, []);
    const reminders = get(STORAGE_KEYS.REMINDERS, []);
    const stage = get(STORAGE_KEYS.STAGE, 'Stage I');
    const today = getTodayDateString();

    const gamesCount = scores.length;
    const avgScore = gamesCount > 0 ? Math.round(scores.reduce((acc, s) => acc + s.score, 0) / gamesCount) : null;
    const completedTasks = reminders.filter(r => r.completedDate === today).length;
    const taskPct = reminders.length > 0 ? Math.round((completedTasks / reminders.length) * 100) : 0;

    document.getElementById('ai-games-val').textContent = gamesCount;
    document.getElementById('ai-avg-val').textContent = avgScore !== null ? `${avgScore}%` : '--';
    document.getElementById('ai-task-val').textContent = `${taskPct}%`;
    document.getElementById('ai-stage-val').textContent = stage;

    // Generate Adaptive AI Recommendations based on local data patterns
    const recsList = document.getElementById('ai-recommendations-list');
    if (!recsList) return;

    const recommendations = [];

    if (gamesCount >= 3 && avgScore !== null && avgScore >= 85) {
      recommendations.push({
        icon: '🌟',
        text: 'Cognitive accuracy is high. Continue memory and pattern activities daily to maintain mental agility.'
      });
    } else if (gamesCount > 0 && avgScore !== null && avgScore < 70) {
      recommendations.push({
        icon: '🌿',
        text: 'Consider trying simpler Stage II object recognition activities to build confidence and calm focus.'
      });
    } else {
      recommendations.push({
        icon: '🎯',
        text: 'Try engaging in at least one cognitive game each morning after breakfast.'
      });
    }

    if (taskPct >= 66) {
      recommendations.push({
        icon: '✅',
        text: `Routine adherence is strong. ${completedTasks} of ${reminders.length} scheduled reminders completed today.`
      });
    } else if (reminders.length > 0) {
      recommendations.push({
        icon: '⏰',
        text: 'Routine task completion can be enhanced. Remember to drink water and take morning medicines.'
      });
    }

    recommendations.push({
      icon: '📋',
      text: 'Schedule your next weekly cognitive checkup on Sunday to keep activities closely matched to your stage.'
    });

    recommendations.push({
      icon: '👨‍👩‍👧',
      text: 'Family connection stimulates language centers. Consider reaching out to your caregiver or loved ones today.'
    });

    recsList.innerHTML = recommendations.map(rec => `
      <div class="ai-rec-card">
        <span class="ai-rec-icon" aria-hidden="true">${rec.icon}</span>
        <p class="ai-rec-text">${escapeHTML(rec.text)}</p>
      </div>
    `).join('');
  }

  // ==========================================================================
  // 13. COGNITIVE PERFORMANCE GRAPH (CUSTOM HTML5 CANVAS)
  // ==========================================================================
  function renderProgressGraph() {
    const canvas = document.getElementById('progress-canvas');
    const emptyOverlay = document.getElementById('graph-empty-message');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const scores = get(STORAGE_KEYS.SCORES, []);

    // Summary statistics
    const highScoreEl = document.getElementById('graph-high-score');
    const avgScoreEl = document.getElementById('graph-avg-score');
    const totalAttemptsEl = document.getElementById('graph-total-attempts');

    if (scores.length === 0) {
      if (emptyOverlay) emptyOverlay.classList.remove('hidden');
      highScoreEl.textContent = '0';
      avgScoreEl.textContent = '0%';
      totalAttemptsEl.textContent = '0';
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    if (emptyOverlay) emptyOverlay.classList.add('hidden');

    const maxScore = Math.max(...scores.map(s => s.score));
    const avgScore = Math.round(scores.reduce((a, b) => a + b.score, 0) / scores.length);
    highScoreEl.textContent = `${maxScore}%`;
    avgScoreEl.textContent = `${avgScore}%`;
    totalAttemptsEl.textContent = scores.length;

    // Draw high-contrast elderly-friendly graph
    const width = canvas.width;
    const height = canvas.height;
    const padding = { top: 40, right: 40, bottom: 60, left: 60 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    // Canvas Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Grid lines & Y-axis labels (0, 25, 50, 75, 100)
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.5;
    ctx.font = '14px Lexend, sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const ySteps = [0, 25, 50, 75, 100];
    ySteps.forEach(val => {
      const y = padding.top + chartH - (val / 100) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      ctx.fillText(`${val}%`, padding.left - 12, y);
    });

    // Determine points to plot (last 10 scores)
    const recentScores = scores.slice(-10);
    const stepX = recentScores.length > 1 ? chartW / (recentScores.length - 1) : chartW / 2;

    const points = recentScores.map((s, idx) => {
      const x = recentScores.length === 1 ? padding.left + chartW / 2 : padding.left + idx * stepX;
      const y = padding.top + chartH - (s.score / 100) * chartH;
      return { x, y, score: s.score, date: s.date, game: s.gameName };
    });

    // Draw Gradient Area Under Curve
    if (points.length > 1) {
      const grad = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
      grad.addColorStop(0, 'rgba(13, 92, 99, 0.25)');
      grad.addColorStop(1, 'rgba(13, 92, 99, 0.01)');

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
      ctx.lineTo(points[0].x, padding.top + chartH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Draw Line
    if (points.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = '#0D5C63';
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
    }

    // Draw Nodes and Score Value Tags
    points.forEach((pt, idx) => {
      // Outer Circle
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#0D5C63';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      // Score Text Pill above
      ctx.fillStyle = '#13222B';
      ctx.font = 'bold 13px Lexend, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${pt.score}%`, pt.x, pt.y - 14);

      // X Axis Date / Attempt Label
      ctx.fillStyle = '#475569';
      ctx.font = '12px Lexend, sans-serif';
      ctx.fillText(pt.date, pt.x, height - padding.bottom + 22);
    });

    // Update Virtual Flower Growth Card in Progress View
    renderFlowerGrowthCards();
  }

  // Refresh Chart button
  document.getElementById('btn-refresh-graph')?.addEventListener('click', () => {
    renderProgressGraph();
    showToast('Progress graph refreshed.', 'info');
  });

  document.getElementById('btn-graph-play-game')?.addEventListener('click', () => {
    navigateTo('view-games');
  });

  // ==========================================================================
  // 14. GLOBAL EVENT BINDINGS & TOAST NOTIFICATION UTILITIES
  // ==========================================================================
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  function setupGlobalNavigationBindings() {
    // Top Bar History
    document.getElementById('nav-back-btn')?.addEventListener('click', navBack);
    document.getElementById('nav-fwd-btn')?.addEventListener('click', navForward);

    // Brand Home Button
    document.getElementById('brand-home-btn')?.addEventListener('click', () => {
      const patient = get(STORAGE_KEYS.PATIENT);
      if (patient) {
        navigateTo('view-dashboard');
      } else {
        navigateTo('view-welcome');
      }
    });

    // Bottom Navigation Dock
    document.querySelectorAll('.dock-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetView = btn.dataset.view;
        const patient = get(STORAGE_KEYS.PATIENT);

        // If clicking home but not registered, take to welcome
        if (targetView === 'view-dashboard' && !patient) {
          navigateTo('view-welcome');
          return;
        }

        navigateTo(targetView);
      });
    });

    // Dashboard Action Cards Shortcuts
    document.getElementById('act-card-games')?.addEventListener('click', () => navigateTo('view-games'));
    document.getElementById('act-card-reminders')?.addEventListener('click', () => navigateTo('view-reminders'));
    document.getElementById('act-card-memory')?.addEventListener('click', () => navigateTo('view-memory'));
    document.getElementById('act-card-family')?.addEventListener('click', () => navigateTo('view-family'));
    document.getElementById('act-card-ai')?.addEventListener('click', () => navigateTo('view-ai'));
    document.getElementById('act-card-ai-chat')?.addEventListener('click', () => navigateTo('view-ai-chat'));
    document.getElementById('act-card-progress')?.addEventListener('click', () => navigateTo('view-progress'));
    document.getElementById('btn-dash-goto-reminders')?.addEventListener('click', () => navigateTo('view-reminders'));
    document.getElementById('nav-chat-btn')?.addEventListener('click', () => navigateTo('view-ai-chat'));
    document.getElementById('btn-goto-ai-chat')?.addEventListener('click', () => navigateTo('view-ai-chat'));
  }

  // ==========================================================================
  // 14. MANASMITRA AI CHAT COMPANION CONTROLLER
  // ==========================================================================

  function getChatHistory() {
    const defaultHistory = [
      {
        sender: 'assistant',
        text: `Namaste ${escapeHTML(getCurrentPatientName())}! 🙏 I am your ManasMitra AI companion. Ask me anything about your brain games, flower garden, daily reminders, or caregivers.`,
        htmlContent: `Namaste ${escapeHTML(getCurrentPatientName())}! 🙏 I am your ManasMitra AI companion. Ask me anything about your brain games, flower garden, daily reminders, or caregivers.`,
        timestamp: Date.now()
      }
    ];
    return get(STORAGE_KEYS.CHAT, defaultHistory);
  }

  function saveChatHistory(history) {
    put(STORAGE_KEYS.CHAT, history);
  }

  function cleanTextForSpeech(htmlOrText) {
    const tmp = document.createElement('div');
    tmp.innerHTML = htmlOrText;
    return (tmp.textContent || tmp.innerText || '')
      .replace(/•/g, ', ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function formatChatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function generateAiResponse(queryText) {
    const q = (queryText || '').toLowerCase().trim();
    const patient = get(STORAGE_KEYS.PATIENT, { name: 'Shanti Devi', age: 68, caregiver_name: 'Rajesh Sharma' });
    const patientName = patient.name || 'Shanti Devi';
    const caregiverName = patient.caregiver_name || 'Rajesh Sharma';
    const stage = get(STORAGE_KEYS.STAGE, 'Stage I');
    const scores = get(STORAGE_KEYS.SCORES, []);
    const reminders = get(STORAGE_KEYS.REMINDERS, []);
    const family = get(STORAGE_KEYS.FAMILY, []);
    const lifetimePoints = getLifetimePoints();
    const flower = getFlowerProgress(lifetimePoints);

    // 1. "How am I doing?"
    if (q.includes('how am i') || q.includes('how do i do') || q.includes('how are things') || q.includes('wellness status')) {
      const gamesCount = scores.length;
      const completedReminders = reminders.filter(r => r.completedToday).length;
      let scoreText = '';
      if (gamesCount > 0) {
        const avg = Math.round(scores.reduce((sum, s) => sum + (Number(s.score) || 0), 0) / gamesCount);
        scoreText = `You have completed ${gamesCount} game session${gamesCount === 1 ? '' : 's'} with an encouraging average score of ${avg}%. `;
      } else {
        scoreText = `You haven't played any games today yet. `;
      }

      let reminderText = '';
      if (reminders.length > 0) {
        reminderText = `You have completed ${completedReminders} out of ${reminders.length} scheduled daily reminders. `;
      } else {
        reminderText = `You have no scheduled reminders for today. `;
      }

      return `Namaste ${escapeHTML(patientName)}! You are doing very well today. ${scoreText}${reminderText}Your virtual flower is a <strong>${flower.stage.name} ${flower.stage.icon}</strong> with <strong>${lifetimePoints.toLocaleString()} lifetime points</strong>. Keep up your wonderful daily routine!`;
    }

    // 2. "What games should I play?"
    if (q.includes('what game') || q.includes('which game') || q.includes('recommend a game') || q.includes('games to play') || q.includes('should i play')) {
      const stageGames = COGNITIVE_GAMES.filter(g => g.stage === stage);
      const list = stageGames.slice(0, 3).map(g => `• <strong>${escapeHTML(g.title)}</strong> (${escapeHTML(g.category)}) — ${escapeHTML(g.desc)}`).join('<br>');
      return `For your current cognitive level (<strong>${stage}</strong>), I recommend these gentle and engaging activities:<br><br>${list}<br><br>Tap the <strong>Games</strong> tab whenever you feel ready to exercise your mind!`;
    }

    // 3. "What is my progress?"
    if (q.includes('progress') || q.includes('my trend') || q.includes('performance') || q.includes('accuracy')) {
      const gamesCount = scores.length;
      if (gamesCount === 0) {
        return `You have not recorded any game sessions yet, ${escapeHTML(patientName)}. Play a game in the Cognitive Games hub to see your progress chart grow!`;
      }
      const avg = Math.round(scores.reduce((sum, s) => sum + (Number(s.score) || 0), 0) / gamesCount);
      const highest = Math.max(...scores.map(s => Number(s.score) || 0));
      const recent = scores.slice(0, 3).map(s => `• <strong>${escapeHTML(s.game_name || s.game_id)}</strong>: ${s.score}% (Level ${s.level || 1})`).join('<br>');

      return `Here is your cognitive wellness summary, ${escapeHTML(patientName)}:<br><br>
      • <strong>Stage:</strong> ${stage}<br>
      • <strong>Games Completed:</strong> ${gamesCount} sessions<br>
      • <strong>Average Score:</strong> ${avg}%<br>
      • <strong>Highest Score:</strong> ${highest} points<br>
      • <strong>Recent Activities:</strong><br>${recent}<br><br>
      Consistent gentle practice helps maintain your mental focus and clarity!`;
    }

    // 4. "How many points do I have?"
    if (q.includes('how many point') || q.includes('total points') || q.includes('my points') || q.includes('score points')) {
      return `You have earned <strong>${lifetimePoints.toLocaleString()} lifetime cognitive points</strong>! Every brain game you play adds points to nurture your virtual flower garden.`;
    }

    // 5. "Tell me about my flower."
    if (q.includes('flower') || q.includes('garden') || q.includes('bloom') || q.includes('sunflower')) {
      if (flower.progressPct >= 100) {
        return `Your virtual flower is in <strong>Full Radiant Bloom ${flower.stage.icon}</strong>! You have accumulated <strong>${lifetimePoints.toLocaleString()} points</strong>. Your mindful daily cognitive exercises keep it glowing beautifully.`;
      }
      return `Your virtual flower is currently a <strong>${flower.stage.name} ${flower.stage.icon}</strong> with <strong>${lifetimePoints.toLocaleString()} points</strong>. You are ${flower.progressPct}% towards the next stage. You need <strong>${flower.pointsNeeded} more points</strong> to grow into a ${flower.stage.nextName} ${flower.stage.nextIcon}. Play a brain game to give it more water!`;
    }

    // 6. "What reminders do I have?"
    if (q.includes('reminder') || q.includes('medicine') || q.includes('schedule') || q.includes('routine') || q.includes('alarm')) {
      if (!reminders || reminders.length === 0) {
        return `You currently have no scheduled reminders saved, ${escapeHTML(patientName)}. You can add medicine, water, or rest reminders in the <strong>Reminders</strong> tab.`;
      }
      const list = reminders.map(r => {
        const status = r.completedToday ? '✅ Completed' : '⏰ Pending';
        return `• <strong>${escapeHTML(r.task)}</strong> at ${escapeHTML(r.time)} (${status})`;
      }).join('<br>');
      return `Here are your scheduled daily routine reminders:<br><br>${list}<br><br>Staying on track with your water, medicine, and walks supports your cognitive health!`;
    }

    // 7. "Who are my caregivers?"
    if (q.includes('caregiver') || q.includes('doctor') || q.includes('family') || q.includes('contact') || q.includes('who can i call') || q.includes('who is my')) {
      let famList = '';
      if (family && family.length > 0) {
        famList = family.map(f => `• <strong>${escapeHTML(f.name)}</strong> (${escapeHTML(f.relation || f.role)}) — 📞 ${escapeHTML(f.phone)}`).join('<br>');
      } else {
        famList = `• <strong>${escapeHTML(caregiverName)}</strong> (Primary Caregiver)`;
      }
      return `Here are your trusted caregivers and loved ones:<br><br>${famList}<br><br>You can reach out to them anytime or visit the <strong>Family Members</strong> tab to listen to their voices or watch video greetings.`;
    }

    // Greetings & Welcomes
    if (q.includes('hello') || q.includes('namaste') || q.includes('hi') || q.includes('hey') || q.includes('good morning') || q.includes('good evening') || q.includes('good afternoon')) {
      return `Namaste ${escapeHTML(patientName)}! 🙏 I am your ManasMitra AI companion. I am right here with you. How can I help you today? You can ask me about your games, your flower, your reminders, or your caregivers.`;
    }

    // Medical advice / Diagnosis guardrail
    if (q.includes('dementia') || q.includes('alzheimer') || q.includes('diagnos') || q.includes('disease') || q.includes('cure') || q.includes('prescrib') || q.includes('sick') || q.includes('illness') || q.includes('symptom')) {
      return `I am your supportive cognitive wellness companion, not a medical professional. I cannot diagnose conditions or prescribe treatments. If you feel unwell or have medical concerns, please speak with your doctor or contact your caregiver <strong>${escapeHTML(caregiverName)}</strong> right away.`;
    }

    // Memory Book queries
    if (q.includes('memory') || q.includes('memories') || q.includes('photo') || q.includes('story')) {
      const memories = get(STORAGE_KEYS.MEMORIES, []);
      if (memories.length === 0) {
        return `You haven't added any memories to your Memory Book yet. You can visit the <strong>Memory Book</strong> tab to add treasured family moments and photographs!`;
      }
      return `You have <strong>${memories.length} treasured stor${memories.length === 1 ? 'y' : 'ies'}</strong> saved in your Memory Book! Re-reading family moments helps warm the heart and maintain memory continuity.`;
    }

    // Stage queries
    if (q.includes('stage')) {
      return `You are currently participating in <strong>${stage}</strong>. In ${stage}, cognitive activities are calibrated to provide comforting, rewarding exercises with zero stress or time pressure.`;
    }

    // Fallback response
    return `I am here to help you with your daily routine and cognitive wellness, ${escapeHTML(patientName)}. You can ask me about:<br><br>
    • "How am I doing?"<br>
    • "What games should I play?"<br>
    • "What is my progress?"<br>
    • "How many points do I have?"<br>
    • "Tell me about my flower."<br>
    • "What reminders do I have?"<br>
    • "Who are my caregivers?"`;
  }

  function renderChatMessages() {
    const historyBox = document.getElementById('chat-history-area');
    if (!historyBox) return;

    const history = getChatHistory();
    historyBox.innerHTML = history.map((msg, idx) => {
      const isUser = msg.sender === 'user';
      const timeStr = formatChatTime(msg.timestamp);

      if (isUser) {
        return `
          <div class="chat-message-row user-row">
            <div class="chat-bubble-container">
              <div class="chat-bubble user-bubble">${escapeHTML(msg.text)}</div>
              <div class="chat-meta"><span>${timeStr}</span></div>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="chat-message-row assistant-row">
            <div class="chat-avatar" aria-hidden="true">🌸</div>
            <div class="chat-bubble-container">
              <div class="chat-bubble assistant-bubble">${msg.htmlContent || msg.text}</div>
              <div class="chat-meta">
                <span>${timeStr}</span>
                <button type="button" class="btn-read-answer" data-idx="${idx}" title="Read this answer aloud">
                  <span aria-hidden="true">🔊</span>
                  <span>Read Answer</span>
                </button>
              </div>
            </div>
          </div>
        `;
      }
    }).join('');

    // Scroll to latest message
    historyBox.scrollTop = historyBox.scrollHeight;

    // Attach Read Answer click listeners
    historyBox.querySelectorAll('.btn-read-answer').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        const msg = history[idx];
        if (msg) {
          const speechText = cleanTextForSpeech(msg.htmlContent || msg.text);
          if (!isVoiceEnabled) {
            toggleVoiceAssistant();
          }
          speakAssistantContext(speechText);
        }
      });
    });
  }

  function sendUserMessage(rawText) {
    const text = (rawText || '').trim();
    if (!text) return;

    const history = getChatHistory();
    const userMsg = {
      sender: 'user',
      text: text,
      timestamp: Date.now()
    };
    history.push(userMsg);

    // Generate AI response
    const answerHtml = generateAiResponse(text);
    const aiMsg = {
      sender: 'assistant',
      text: cleanTextForSpeech(answerHtml),
      htmlContent: answerHtml,
      timestamp: Date.now()
    };
    history.push(aiMsg);

    saveChatHistory(history);
    renderChatMessages();
  }

  function clearChatHistory() {
    const resetHistory = [
      {
        sender: 'assistant',
        text: `Chat cleared. Namaste ${escapeHTML(getCurrentPatientName())}! 🙏 How can I assist you right now?`,
        htmlContent: `Chat cleared. Namaste ${escapeHTML(getCurrentPatientName())}! 🙏 How can I assist you right now?`,
        timestamp: Date.now()
      }
    ];
    saveChatHistory(resetHistory);
    renderChatMessages();
    showToast('Chat history cleared.', 'info');
  }

  function initAiChat() {
    const form = document.getElementById('form-ai-chat');
    const input = document.getElementById('chat-input');
    const clearBtn = document.getElementById('btn-clear-chat');
    const suggestionsContainer = document.getElementById('chat-suggestions');

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!input) return;
      const val = input.value.trim();
      if (!val) return;
      sendUserMessage(val);
      input.value = '';
    });

    clearBtn?.addEventListener('click', () => {
      clearChatHistory();
    });

    suggestionsContainer?.querySelectorAll('.chat-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const q = chip.dataset.question;
        if (q) {
          sendUserMessage(q);
        }
      });
    });
  }

  function renderAiChat() {
    renderChatMessages();
    setTimeout(() => {
      const input = document.getElementById('chat-input');
      input?.focus();
    }, 100);
  }

  // ==========================================================================
  // 15. APPLICATION INITIALIZATION ENTRY POINT
  // ==========================================================================
  function initApp() {
    seedDefaultDataIfEmpty();
    initVoiceAssistant();
    initAuthControllers();
    initReminderScheduler();
    initMemoryBook();
    initFamilyDirectory();
    initAiChat();
    setupGlobalNavigationBindings();
    initArenaControllers();

    // Check live database connectivity
    checkDatabaseConnection();

    // Check if a patient profile is already registered
    const patient = get(STORAGE_KEYS.PATIENT);
    if (patient) {
      navigateTo('view-dashboard');
    } else {
      navigateTo('view-welcome');
    }

    console.log('[ManasMitra] Elderly-first cognitive companion successfully initialized.');
  }

  // Start app on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})();
