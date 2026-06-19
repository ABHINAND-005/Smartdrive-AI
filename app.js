/**
 * SmartDrive AI - App Logic Engine (Firebase Cloud Firestore Ingested)
 * Handles State management, Simulation, Chart generation, AI Chatbot, Localization
 */

// ==========================================
// FIREBASE CONFIGURATION
// ==========================================
// Paste your Firebase Project web application configuration details here:
const firebaseConfig = {
  apiKey: "AIzaSyB0k3XqG7LABYY5qwozeYk-_V-1jaVVspU",
  authDomain: "smartdrive-ai-b723c.firebaseapp.com",
  projectId: "smartdrive-ai-b723c",
  storageBucket: "smartdrive-ai-b723c.firebasestorage.app",
  messagingSenderId: "595277301071",
  appId: "1:595277301071:web:ff5693c8b2d0aaaea0b13a",
  measurementId: "G-8L6KZ8ND2S"
};

let db = null;
let useFirebase = false;
let fb = {}; // Firebase Firestore method mappings

const translations = {
  en: {
    nav_candidate_sec: "Candidate Portal",
    nav_dashboard: "User Dashboard",
    nav_results: "Test Results",
    nav_video: "Video Review",
    nav_feedback: "AI Feedback",
    nav_eligibility: "License Eligibility",
    nav_verification: "Document Verification",
    nav_retest: "Schedule Retest",
    nav_settings_sec: "Account Settings",
    nav_settings: "Profile Settings",
    db_ll_no: "Learner's License No",
    db_test_status: "Test Status",
    db_license_status: "License Eligibility",
    db_result_card_title: "Driving Evaluation Summary",
    db_score_lbl: "Score",
    db_score_sub: "Your test video was processed automatically. AI detected lane disciplines, indicator setups, and vehicle control parameters.",
    db_officer_approval: "Officer Approval",
    db_btn_breakdown: "View Full Breakdown",
    db_btn_review: "Review Path Video",
    db_quick_actions: "Quick Actions",
    db_dl_reports: "Download Reports PDF",
    db_upload_docs: "Upload Identity Documents",
    db_book_retest: "Schedule Retest Slot"
  },
  ml: {
    nav_candidate_sec: "കാൻഡിഡേറ്റ് പോർട്ടൽ",
    nav_dashboard: "ഉപയോക്തൃ ഡാഷ്‌ബോർഡ്",
    nav_results: "പരീക്ഷാ ഫലം",
    nav_video: "വീഡിയോ അവലോകനം",
    nav_feedback: "AI അഭിപ്രായം",
    nav_eligibility: "ലൈസൻസ് യോഗ്യത",
    nav_verification: "പ്രമാണ പരിശോധന",
    nav_retest: "റീടെസ്റ്റ് ഷെഡ്യൂൾ",
    nav_settings_sec: "അക്കൗണ്ട് ക്രമീകരണങ്ങൾ",
    nav_settings: "പ്രൊഫൈൽ ക്രമീകരണങ്ങൾ",
    db_ll_no: "ലേണേഴ്സ് ലൈസൻസ് നമ്പർ",
    db_test_status: "ടെസ്റ്റ് സ്റ്റാറ്റസ്",
    db_license_status: "ലൈസൻസ് യോഗ്യത",
    db_result_card_title: "ഡ്രൈവിംഗ് വിലയിരുത്തൽ സംഗ്രഹം",
    db_score_lbl: "സ്കോർ",
    db_score_sub: "നിങ്ങളുടെ ടെസ്റ്റ് വീഡിയോ സ്വയമേവ പ്രോസസ്സ് ചെയ്തു. AI പാതകൾ, ഇൻഡിക്കേറ്റർ ക്രമീകരണങ്ങൾ, വാഹന നിയന്ത്രണങ്ങൾ എന്നിവ കണ്ടെത്തി.",
    db_officer_approval: "ഉദ്യോഗസ്ഥ അംഗീകാരം",
    db_btn_breakdown: "പരീക്ഷാ ഫലം കാണുക",
    db_btn_review: "പാത വീഡിയോ അവലോകനം ചെയ്യുക",
    db_quick_actions: "ദ്രുത നടപടികൾ",
    db_dl_reports: "റിപ്പോർട്ടുകൾ ഡൗൺലോഡ് ചെയ്യുക",
    db_upload_docs: "തിരിച്ചറിയൽ രേഖകൾ അപ്‌ലോഡ് ചെയ്യുക",
    db_book_retest: "റീടെസ്റ്റ് സ്ലോട്ട് ബുക്ക് ചെയ്യുക"
  }
};

const BACKUP_CANDIDATES = [];

class SmartDriveApp {
  constructor() {
    this.currentTheme = "light";
    this.currentLang = "en";
    this.currentUser = null;
    this.currentRole = null;
    this.candidates = [];
    this.notifications = [];
    
    // Video Simulation States
    this.videoDuration = 30;
    this.videoTime = 0;
    this.isPlaying = false;
    this.playInterval = null;
    this.activeViolationIndex = -1;
    this.simulatedPath = [];
    
    // Video upload state
    this.uploadedVideoFile = null;
    this.evaluatingCandidateId = null;
    this.evaluatingProgress = 0;
    this.evaluationLogs = [];
    this.evaluationTimer = null;
    
    // Override Screen state
    this.overrideCandidateId = null;
    this.overrideStatus = "Passed";

    this.charts = {};
  }

  async init() {
    this.currentTheme = localStorage.getItem("sd_theme") || "light";
    this.currentLang = localStorage.getItem("sd_lang") || "en";
    this.applyTheme();

    // Restore user session from localStorage immediately if it exists
    const savedUser = localStorage.getItem("sd_current_user");
    const savedRole = localStorage.getItem("sd_current_role");
    if (savedUser && savedRole) {
      this.currentUser = JSON.parse(savedUser);
      this.currentRole = savedRole;
    }

    // Dynamically load page template fragments
    await this.loadTemplates();

    // Initialize Firebase
    await this.initFirebase();

    // Fetch initial database records with connection timeout fallback
    if (useFirebase) {
      try {
        await Promise.race([
          this.fetchData(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Firestore connection timeout")), 6000))
        ]);
      } catch (err) {
        console.warn("Firestore initialization timed out or failed. Falling back to local storage simulator mode:", err.message);
        useFirebase = false;
        this.loadOfflineFallback();
      }
    } else {
      this.loadOfflineFallback();
    }

    // Setup dashboard if session was restored
    if (this.currentUser && this.currentRole) {
      this.setupDashboardView();
      this.showScreen("app-layout");
      this.route(this.currentRole === "admin" ? "admin-dashboard" : "candidate-dashboard");
    }

    this.renderNotifications();
    
    document.getElementById("landing-stat-total").innerText = "14,250+";
    document.getElementById("landing-stat-rate").innerText = "72.4%";
  }

  async loadTemplates() {
    const templates = [
      { id: "screen-landing", path: "pages/landing.html" },
      { id: "screen-user-login", path: "pages/user-login.html" },
      { id: "screen-admin-login", path: "pages/admin-login.html" },
      { id: "screen-candidate-dashboard", path: "pages/candidate-dashboard.html" },
      { id: "screen-candidate-results", path: "pages/candidate-results.html" },
      { id: "screen-candidate-eligibility", path: "pages/candidate-eligibility.html" },
      { id: "screen-admin-dashboard", path: "pages/admin-dashboard.html" },
      { id: "screen-admin-candidates", path: "pages/admin-candidates.html" },
      { id: "screen-admin-video-evaluation", path: "pages/admin-video-evaluation.html" },
      { id: "screen-admin-result-override", path: "pages/admin-result-override.html" },
      { id: "screen-admin-reports-analytics", path: "pages/admin-reports-analytics.html" },
      { id: "screen-profile-settings", path: "pages/profile-settings.html" }
    ];

    await Promise.all(templates.map(async (t) => {
      const el = document.getElementById(t.id);
      if (el) {
        try {
          const res = await fetch(t.path);
          if (!res.ok) throw new Error(`Status ${res.status}`);
          const html = await res.text();
          el.innerHTML = html;
        } catch (err) {
          console.error(`Failed to load template ${t.id} from ${t.path}:`, err);
        }
      }
    }));
  }

  // DYNAMIC FIREBASE INTEGRATION WITH CDN WRAPPERS
  async initFirebase() {
    if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY") {
      try {
        console.log("Loading Cloud Firebase SDK dynamically...");
        const appMod = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
        const firestoreMod = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        
        const appInstance = appMod.initializeApp(firebaseConfig);
        db = firestoreMod.getFirestore(appInstance);
        
        useFirebase = true;
        fb = firestoreMod;
        
        console.log("Connected to Firebase Firestore Cloud Database!");
      } catch (err) {
        console.warn("Firebase script import failed (probably offline). Running in browser storage simulator:", err.message);
        useFirebase = false;
      }
    } else {
      console.log("Firebase credentials not configured. Running in Local Storage Simulator Mode.");
      useFirebase = false;
    }
  }

  async fetchData() {
    if (useFirebase && db) {
      try {
        // Fetch candidates and notifications in parallel
        const [candSnap, notifySnap] = await Promise.all([
          fb.getDocs(fb.collection(db, "candidates")),
          fb.getDocs(fb.collection(db, "notifications"))
        ]);

        this.candidates = [];
        candSnap.forEach(d => {
          this.candidates.push({ id: d.id, ...d.data() });
        });
        // Sort newest registered first
        this.candidates.sort((a, b) => Number(b.id) - Number(a.id));

        // Seed Firestore if it is completely empty
        if (this.candidates.length === 0) {
          console.log("Cloud database empty. Seeding initial candidate data...");
          const seedPromises = BACKUP_CANDIDATES.map(c => 
            fb.setDoc(fb.doc(db, "candidates", c.id), c)
          );
          await Promise.all(seedPromises);
          this.candidates = BACKUP_CANDIDATES;
        }

        this.notifications = [];
        notifySnap.forEach(d => {
          this.notifications.push({ id: d.id, ...d.data() });
        });
        this.notifications.sort((a,b) => b.id - a.id);

        if (this.notifications.length === 0) {
          const defaultNotify = [
            { title: "Result Published", desc: "Your driving evaluation result is now available.", time: "2 hours ago", unread: true, type: "success" },
            { title: "License Approved", desc: "Digital verification badge generated.", time: "1 day ago", unread: false, type: "primary" }
          ];
          const seedPromises = defaultNotify.map((n, i) => {
            const temp = { ...n, id: Date.now() + i };
            return fb.setDoc(fb.doc(db, "notifications", String(temp.id)), temp);
          });
          await Promise.all(seedPromises);
          this.notifications = defaultNotify;
        }
      } catch (err) {
        console.error("Firestore transaction error:", err.message);
        this.loadOfflineFallback();
      }
    } else {
      this.loadOfflineFallback();
    }

    // Refresh active session variables
    if (this.currentUser && this.currentRole === "candidate") {
      const fresh = this.candidates.find(c => c.id === this.currentUser.id);
      if (fresh) this.currentUser = fresh;
    }
  }

  loadOfflineFallback() {
    const cachedCand = localStorage.getItem("sd_firebase_fallback_candidates");
    if (cachedCand) {
      this.candidates = JSON.parse(cachedCand);
    } else {
      this.candidates = BACKUP_CANDIDATES;
      localStorage.setItem("sd_firebase_fallback_candidates", JSON.stringify(this.candidates));
    }
    // Sort newest registered first
    this.candidates.sort((a, b) => Number(b.id) - Number(a.id));

    const cachedLogs = localStorage.getItem("sd_firebase_fallback_logs");
    if (cachedLogs) {
      this.auditLogs = JSON.parse(cachedLogs);
    } else {
      this.auditLogs = [
        { time: "2026-06-08 18:32:05", action: "Officer Authenticated", user: "rto.officer.01", ip: "192.168.1.45", detail: "Successful portal login session." },
        { time: "2026-06-08 17:15:12", action: "Result Published", user: "rto.officer.01", ip: "192.168.1.45", detail: "Published Passed result for APP-2026-001." }
      ];
      localStorage.setItem("sd_firebase_fallback_logs", JSON.stringify(this.auditLogs));
    }

    const cachedNotify = localStorage.getItem("sd_firebase_fallback_notify");
    if (cachedNotify) {
      this.notifications = JSON.parse(cachedNotify);
    } else {
      this.notifications = [
        { id: 1, title: "Result Published (Simulated)", desc: "Your driving evaluation result is cached locally.", time: "2 hours ago", unread: true, type: "success" },
        { id: 2, title: "Identity Verified (Simulated)", desc: "Aadhaar verified locally.", time: "2 days ago", unread: false, type: "info" }
      ];
      localStorage.setItem("sd_firebase_fallback_notify", JSON.stringify(this.notifications));
    }
  }

  saveOfflineFallback() {
    localStorage.setItem("sd_firebase_fallback_candidates", JSON.stringify(this.candidates));
    localStorage.setItem("sd_firebase_fallback_logs", JSON.stringify(this.auditLogs));
    localStorage.setItem("sd_firebase_fallback_notify", JSON.stringify(this.notifications));
  }

  // NAVIGATION & ROUTING
  route(screenId) {
    const panels = document.querySelectorAll(".dashboard-view");
    panels.forEach(p => p.style.display = "none");
    
    const target = document.getElementById("screen-" + screenId);
    if (target) {
      target.style.display = "block";
      target.classList.add("animate-fade");
    }

    const menuItems = document.querySelectorAll(".sidebar .menu-item");
    menuItems.forEach(item => item.classList.remove("active"));
    const activeMenu = document.getElementById("menu-" + screenId);
    if (activeMenu) activeMenu.classList.add("active");

    document.getElementById("app-notification-panel").classList.remove("active");

    if (this.isPlaying) {
      this.togglePlay();
    }

    if (screenId === "candidate-dashboard") {
      document.getElementById("current-screen-title").innerText = this.currentLang === "en" ? "User Dashboard" : "ഉപയോക്തൃ ഡാഷ്‌ബോർഡ്";
      this.renderCandidateDashboard();
    } else if (screenId === "candidate-results") {
      document.getElementById("current-screen-title").innerText = this.currentLang === "en" ? "Driving Test Results" : "പരീക്ഷാ ഫലം";
      this.renderCandidateResults();
    } else if (screenId === "candidate-eligibility") {
      document.getElementById("current-screen-title").innerText = this.currentLang === "en" ? "License Eligibility" : "ലൈസൻസ് യോഗ്യത";
      this.renderCandidateEligibility();
    } else if (screenId === "admin-dashboard") {
      document.getElementById("current-screen-title").innerText = "Admin Portal Dashboard";
      this.renderAdminDashboard();
    } else if (screenId === "admin-candidates") {
      document.getElementById("current-screen-title").innerText = "Candidate Registry Control";
      this.renderCandidatesCRUD();
    } else if (screenId === "admin-video-evaluation") {
      document.getElementById("current-screen-title").innerText = "Video Upload & Ingestion Engine";
      this.renderVideoEvaluation();
    } else if (screenId === "admin-reports-analytics") {
      document.getElementById("current-screen-title").innerText = "Reports & RTO Analytics Charts";
      this.renderAnalyticsCharts();
    } else if (screenId === "profile-settings") {
      document.getElementById("current-screen-title").innerText = this.currentLang === "en" ? "Profile & App Settings" : "പ്രൊഫൈൽ ക്രമീകരണങ്ങൾ";
      this.renderProfileSettings();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  showScreen(screenId) {
    const screens = document.querySelectorAll(".app-screen");
    screens.forEach(s => s.classList.remove("active"));
    const appLayout = document.getElementById("app-layout");

    if (screenId === "app-layout") {
      appLayout.style.display = "block";
    } else {
      appLayout.style.display = "none";
      const target = document.getElementById(screenId);
      if (target) {
        target.classList.add("active");
      }
    }
  }

  toggleTheme() {
    this.currentTheme = this.currentTheme === "light" ? "dark" : "light";
    this.applyTheme();
    localStorage.setItem("sd_theme", this.currentTheme);
  }

  applyTheme() {
    document.documentElement.setAttribute("data-theme", this.currentTheme);
    const themeBtnIcon = document.getElementById("theme-btn-icon");
    if (themeBtnIcon) {
      if (this.currentTheme === "dark") {
        themeBtnIcon.className = "fa-solid fa-sun";
      } else {
        themeBtnIcon.className = "fa-solid fa-moon";
      }
    }
  }

  changeLanguage(lang) {
    this.currentLang = lang;
    document.querySelectorAll("[data-lang]").forEach(el => {
      const key = el.getAttribute("data-lang");
      if (translations[lang] && translations[lang][key]) {
        el.innerText = translations[lang][key];
      }
    });

    const selectors = document.querySelectorAll(".lang-select");
    selectors.forEach(sel => sel.value = lang);
    const profileSel = document.getElementById("profile-lang-select");
    if (profileSel) profileSel.value = lang;

    localStorage.setItem("sd_lang", this.currentLang);

    const activeMenu = document.querySelector(".sidebar .menu-item.active");
    if (activeMenu) {
      const clickAttr = activeMenu.getAttribute("onclick");
      const match = clickAttr.match(/'([^']+)'/);
      if (match && match[1]) {
        this.route(match[1]);
      }
    }
  }

  // AUTHENTICATION
  async handleUserLogin(e) {
    e.preventDefault();
    const appNo = document.getElementById("user-app-no").value.trim();
    const dob = document.getElementById("user-dob").value;

    if (useFirebase) {
      try {
        await Promise.race([
          this.fetchData(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000))
        ]);
      } catch (err) {
        console.warn("Fetch timed out. Using local cache.");
      }
    }

    const user = this.candidates.find(c => c.appNo === appNo && c.dob === dob);
    if (user) {
      this.currentUser = user;
      this.currentRole = "candidate";
      // Save session to localStorage
      localStorage.setItem("sd_current_user", JSON.stringify(this.currentUser));
      localStorage.setItem("sd_current_role", this.currentRole);
      this.setupDashboardView();
      this.showScreen("app-layout");
      this.route("candidate-dashboard");
      
      // Perform log write in background to avoid blocking user session

    } else {
      alert("Invalid Candidate Application Number or Date of Birth. Check App No (e.g. APP-2026-001) and Date.");
    }
  }

  async handleAdminLogin(e) {
    e.preventDefault();
    const user = document.getElementById("admin-user").value.trim();
    const pass = document.getElementById("admin-pass").value;

    if (user === "rto.officer.01" && pass === "rto123") {
      this.currentUser = { name: "Officer K. Raghavan", appNo: "RTO-1045", dob: "", email: "rtokasaragod@gov.in" };
      this.currentRole = "admin";
      // Save session to localStorage
      localStorage.setItem("sd_current_user", JSON.stringify(this.currentUser));
      localStorage.setItem("sd_current_role", this.currentRole);
      this.setupDashboardView();
      this.showScreen("app-layout");
      this.route("admin-dashboard");

      // Perform log write in background to avoid blocking user session

    } else {
      alert("Invalid credentials. Hint: use rto.officer.01 and rto123.");
    }
  }

  setupDashboardView() {
    const navCand = document.getElementById("nav-candidate-group");
    const navAdmin = document.getElementById("nav-admin-group");
    const profileAvatar = document.getElementById("header-profile-avatar");
    const profileName = document.getElementById("header-profile-name");
    const profileRole = document.getElementById("header-profile-role");

    if (this.currentRole === "candidate") {
      navCand.style.display = "block";
      navAdmin.style.display = "none";
      profileAvatar.innerText = this.currentUser.name[0];
      profileName.innerText = this.currentUser.name;
      profileRole.innerText = this.currentUser.appNo;
    } else {
      navCand.style.display = "none";
      navAdmin.style.display = "block";
      profileAvatar.innerText = "O";
      profileName.innerText = this.currentUser.name;
      profileRole.innerText = "RTO Inspector";
    }
  }

  logout() {
    this.currentUser = null;
    this.currentRole = null;
    // Clear session from localStorage
    localStorage.removeItem("sd_current_user");
    localStorage.removeItem("sd_current_role");
    this.showScreen("screen-landing");
  }

  // NOTIFICATION DRAWER
  async toggleNotifications() {
    const panel = document.getElementById("app-notification-panel");
    panel.classList.toggle("active");
    
    if (panel.classList.contains("active")) {
      if (useFirebase && db) {
        try {
          // Batch update notifications unread to false
          const snap = await fb.getDocs(fb.collection(db, "notifications"));
          snap.forEach(async (d) => {
            if (d.data().unread) {
              await fb.updateDoc(fb.doc(db, "notifications", d.id), { unread: false });
            }
          });
          document.getElementById("notify-badge-dot").style.display = "none";
          await this.fetchData();
          this.renderNotifications();
        } catch (err) {
          console.error(err);
        }
      } else {
        this.notifications.forEach(n => n.unread = false);
        this.saveOfflineFallback();
        this.renderNotifications();
      }
    }
  }

  renderNotifications() {
    const list = document.getElementById("app-notifications-list");
    list.innerHTML = "";
    
    const unreadCount = this.notifications.filter(n => n.unread).length;
    const dot = document.getElementById("notify-badge-dot");
    if (dot) dot.style.display = unreadCount > 0 ? "block" : "none";

    if (this.notifications.length === 0) {
      list.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted);">No new alerts.</div>`;
      return;
    }

    this.notifications.forEach(n => {
      let icon = "fa-bell";
      let iconColor = "var(--primary)";
      if (n.type === "success") { icon = "fa-circle-check"; iconColor = "var(--success)"; }
      else if (n.type === "danger") { icon = "fa-triangle-exclamation"; iconColor = "var(--danger)"; }
      else if (n.type === "info") { icon = "fa-circle-info"; iconColor = "var(--info)"; }

      const item = document.createElement("div");
      item.className = `notification-item ${n.unread ? 'unread' : ''}`;
      item.innerHTML = `
        <div class="notification-item-icon" style="background-color:${iconColor}22; color:${iconColor}">
          <i class="fa-solid ${icon}"></i>
        </div>
        <div class="notification-item-content">
          <div class="notification-item-title">${n.title}</div>
          <div class="notification-item-desc">${n.desc}</div>
          <div class="notification-item-time">${n.time}</div>
        </div>
      `;
      list.appendChild(item);
    });
  }

  async addNotification(title, desc, type = "info") {
    const n = { title, desc, time: "Just now", unread: true, type };
    if (useFirebase && db) {
      try {
        const id = Date.now();
        await fb.setDoc(fb.doc(db, "notifications", String(id)), { id, ...n });
        await this.fetchData();
        this.renderNotifications();
      } catch (err) {
        console.error(err);
      }
    } else {
      this.notifications.unshift({ id: Date.now(), ...n });
      this.saveOfflineFallback();
      this.renderNotifications();
    }
  }



  // USER DASHBOARD SCREEN
  renderCandidateDashboard() {
    const user = this.currentUser;
    document.getElementById("db-ll-number").innerText = user.llNo;
    document.getElementById("db-test-status").innerText = user.status;
    document.getElementById("db-license-eligibility").innerText = user.eligibility;
    document.getElementById("db-eval-date").innerText = user.testDate;
    document.getElementById("db-score-val").innerText = user.score;
    document.getElementById("db-ai-confidence").innerText = user.aiConfidence + "%";
    document.getElementById("db-officer-approval").innerText = user.officerApproved ? "Approved" : "Pending";

    const statusBg = document.getElementById("db-status-bg");
    const eligBg = document.getElementById("db-eligibility-bg");
    
    if (user.status === "Passed") {
      statusBg.className = "stat-icon bg-success-light";
      statusBg.innerHTML = `<i class="fa-solid fa-circle-check"></i>`;
    } else if (user.status === "Failed") {
      statusBg.className = "stat-icon bg-danger-light";
      statusBg.innerHTML = `<i class="fa-solid fa-circle-xmark"></i>`;
    } else {
      statusBg.className = "stat-icon bg-warning-light";
      statusBg.innerHTML = `<i class="fa-solid fa-hourglass-half"></i>`;
    }

    if (user.eligibility === "Eligible") {
      eligBg.className = "stat-icon bg-success-light";
    } else {
      eligBg.className = "stat-icon bg-danger-light";
    }

    const circumference = 2 * Math.PI * 70;
    const offset = circumference - (user.score / 100) * circumference;
    const scoreCircleBar = document.getElementById("score-circle-bar");
    scoreCircleBar.style.strokeDashoffset = offset;
    scoreCircleBar.style.stroke = user.status === "Passed" ? "var(--success)" : "var(--danger)";

    const assessment = document.getElementById("db-score-assessment");
    if (user.score === 0) assessment.innerText = "Evaluation Pending";
    else if (user.score >= 80) assessment.innerText = "Safe Driving Performance";
    else if (user.score >= 60) assessment.innerText = "Average Performance Profile";
    else assessment.innerText = "Risky Driving Profile Detected";
  }

  // CANDIDATE RESULTS SCREEN
  renderCandidateResults() {
    const user = this.currentUser;
    
    const statusStamp = document.getElementById("res-status-stamp");
    statusStamp.innerText = user.status;
    statusStamp.className = `badge ${user.status === 'Passed' ? 'badge-success' : 'badge-danger'}`;

    document.getElementById("res-score-val").innerText = user.score;
    document.getElementById("res-confidence-val").innerText = user.aiConfidence + "%";
    document.getElementById("res-evaluation-date").innerText = user.testDate;
    document.getElementById("res-officer-remarks").innerText = user.officerRemarks;
    document.getElementById("res-officer-name").innerText = user.officerName || "Inspector K. Raghavan";
    document.getElementById("res-approval-badge").className = `badge ${user.officerApproved ? 'badge-success' : 'badge-warning'}`;
    document.getElementById("res-approval-badge").innerText = user.officerApproved ? "Approved" : "Pending Approval";

    const vListCount = document.getElementById("res-violation-count");
    vListCount.innerText = user.violations.length === 1 ? "1 Violation" : `${user.violations.length} Violations`;
    vListCount.className = `badge ${user.violations.length > 0 ? 'badge-danger' : 'badge-success'}`;

    const list = document.getElementById("results-violations-list");
    list.innerHTML = "";
    if (user.violations.length === 0) {
      list.innerHTML = `
        <div style="text-align:center; padding:40px; color:var(--text-muted); background:var(--bg-main); border-radius:var(--radius-md);">
          <i class="fa-solid fa-circle-check text-success" style="font-size:3rem; margin-bottom:12px;"></i>
          <h4>Zero Violations Logged</h4>
          <p style="font-size:0.85rem; margin-top:4px;">Excellent boundary control and signalling disciplines observed.</p>
        </div>
      `;
      return;
    }

    user.violations.forEach(v => {
      const card = document.createElement("div");
      card.className = `violation-card-item severity-${v.severity.toLowerCase()}`;
      card.innerHTML = `
        <div class="violation-card-icon">
          <i class="fa-solid fa-triangle-exclamation"></i>
        </div>
        <div class="violation-card-info">
          <div class="violation-card-title">
            ${v.name}
            <span>Time: 00:${v.time.toString().padStart(2, '0')}</span>
          </div>
          <div style="font-size:0.75rem; font-weight:700; margin-bottom:4px;" class="${v.severity === 'Critical' ? 'text-danger' : 'text-warning'}">
            Severity: ${v.severity}
          </div>
          <p style="font-size:0.85rem; color:var(--text-sub);">${v.description}</p>
        </div>
      `;
      list.appendChild(card);
    });
  }
  // AI FEEDBACK AND RECOMMENDATIONS SCREEN

  // LICENSE ELIGIBILITY SCREEN
  renderCandidateEligibility() {
    const user = this.currentUser;
    document.getElementById("cert-name").innerText = user.name;
    document.getElementById("cert-app-no").innerText = user.appNo;
    document.getElementById("cert-ll-no").innerText = user.llNo;
    document.getElementById("cert-score").innerText = `${user.score} / 100`;
    
    const statusText = document.getElementById("cert-status");

    if (user.status === "Passed") {
      statusText.innerText = "APPROVED FOR LICENSE";
      statusText.style.color = "var(--success)";
    } else if (user.status === "Failed") {
      statusText.innerText = "NOT ELIGIBLE (FAILED)";
      statusText.style.color = "var(--danger)";
    } else {
      statusText.innerText = "EVALUATION PENDING";
      statusText.style.color = "var(--text-muted)";
    }

    document.getElementById("cert-eval-date").innerText = user.testDate;

    const qrCanvas = document.getElementById("eligibility-qr-canvas");
    new QRious({
      element: qrCanvas,
      value: `https://sarathi.parivahan.gov.in/verify/rto-kzd/app=${user.appNo}`,
      size: 160
    });
  }

  downloadReport(reportType) {
    const user = this.currentUser;
    this.showGeneralNoticeModal(
      `<i class="fa-solid fa-file-arrow-down" style="color:var(--primary)"></i>`,
      "Downloading Report",
      `Dynamic ${reportType} report generated for application ID ${user.appNo}. Starting PDF download pipeline...`
    );
  }



  showGeneralNoticeModal(iconHtml, title, desc) {
    document.getElementById("general-notice-icon").outerHTML = `<div id="general-notice-icon" style="font-size:3rem; margin-bottom:20px;">${iconHtml}</div>`;
    document.getElementById("general-notice-title").innerText = title;
    document.getElementById("general-notice-desc").innerText = desc;
    document.getElementById("modal-general-notice").classList.add("active");
  }

  closeGeneralNoticeModal() {
    document.getElementById("modal-general-notice").classList.remove("active");
  }

  // ADMIN PORTAL - STATISTICS & RECENT TABLE
  renderAdminDashboard() {
    const total = this.candidates.length;
    const passed = this.candidates.filter(c => c.status === "Passed").length;
    const failed = this.candidates.filter(c => c.status === "Failed").length;
    const pending = this.candidates.filter(c => c.status === "Pending" || c.status === "Processing").length;

    document.getElementById("admin-stat-total").innerText = total;
    document.getElementById("admin-stat-passed").innerText = passed;
    document.getElementById("admin-stat-failed").innerText = failed;
    document.getElementById("admin-stat-pending").innerText = pending;

    const tbody = document.getElementById("admin-dashboard-recent-table");
    tbody.innerHTML = "";
    
    const sorted = [...this.candidates].reverse().slice(0, 5);
    sorted.forEach(c => {
      const row = document.createElement("tr");
      let badgeClass = "badge-success";
      if (c.status === "Failed") badgeClass = "badge-danger";
      else if (c.status === "Pending" || c.status === "Processing") badgeClass = "badge-warning";

      row.innerHTML = `
        <td><strong>${c.name}</strong></td>
        <td style="font-family:monospace;">${c.appNo}</td>
        <td>${c.testDate}</td>
        <td><strong>${c.score}</strong></td>
        <td><span class="badge ${badgeClass}">${c.status}</span></td>
        <td class="table-action-row">
          <button class="table-action-btn" onclick="app.viewCandidateProfile('${c.id}')" title="View details"><i class="fa-solid fa-eye"></i></button>
          <button class="table-action-btn" onclick="app.overrideAIResult('${c.id}')" title="Override decision"><i class="fa-solid fa-sliders"></i></button>
        </td>
      `;
      tbody.appendChild(row);
    });
  }

  // CANDIDATES REGISTRY CRUD
  renderCandidatesCRUD() {
    const table = document.getElementById("admin-candidates-crud-table");
    table.innerHTML = "";
    
    this.candidates.forEach(c => {
      const row = document.createElement("tr");
      let badgeClass = "badge-success";
      if (c.status === "Failed") badgeClass = "badge-danger";
      else if (c.status === "Pending" || c.status === "Processing") badgeClass = "badge-warning";

      row.innerHTML = `
        <td><strong>${c.name}</strong></td>
        <td style="font-family:monospace;">${c.appNo}</td>
        <td>${c.dob}</td>
        <td style="font-family:monospace;">${c.llNo}</td>
        <td>${c.mobile}</td>
        <td>${c.testDate}</td>
        <td><span class="badge ${badgeClass}">${c.status}</span></td>
        <td class="table-action-row">
          <button class="table-action-btn" onclick="app.viewCandidateProfile('${c.id}')" title="View Detail"><i class="fa-solid fa-eye"></i></button>
          <button class="table-action-btn" onclick="app.openEditCandidateModal('${c.id}')" title="Edit Registry"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="table-action-btn delete" onclick="app.deleteCandidate('${c.id}')" title="Delete Candidate"><i class="fa-solid fa-trash-can"></i></button>
        </td>
      `;
      table.appendChild(row);
    });
  }

  searchCandidates(val) {
    const table = document.getElementById("admin-candidates-crud-table");
    table.innerHTML = "";
    const filtered = this.candidates.filter(c => 
      c.name.toLowerCase().includes(val.toLowerCase()) || 
      c.appNo.toLowerCase().includes(val.toLowerCase()) || 
      c.llNo.toLowerCase().includes(val.toLowerCase())
    );

    filtered.forEach(c => {
      const row = document.createElement("tr");
      let badgeClass = "badge-success";
      if (c.status === "Failed") badgeClass = "badge-danger";
      else if (c.status === "Pending" || c.status === "Processing") badgeClass = "badge-warning";

      row.innerHTML = `
        <td><strong>${c.name}</strong></td>
        <td style="font-family:monospace;">${c.appNo}</td>
        <td>${c.dob}</td>
        <td style="font-family:monospace;">${c.llNo}</td>
        <td>${c.mobile}</td>
        <td>${c.testDate}</td>
        <td><span class="badge ${badgeClass}">${c.status}</span></td>
        <td class="table-action-row">
          <button class="table-action-btn" onclick="app.viewCandidateProfile('${c.id}')"><i class="fa-solid fa-eye"></i></button>
          <button class="table-action-btn" onclick="app.openEditCandidateModal('${c.id}')"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="table-action-btn delete" onclick="app.deleteCandidate('${c.id}')"><i class="fa-solid fa-trash-can"></i></button>
        </td>
      `;
      table.appendChild(row);
    });
  }

  openAddCandidateModal() {
    document.getElementById("modal-candidate-title").innerText = "Register New Candidate";
    document.getElementById("modal-candidate-id").value = "";
    document.getElementById("cand-name").value = "";
    document.getElementById("cand-app-no").value = "";
    document.getElementById("cand-dob").value = "";
    document.getElementById("cand-ll-no").value = "";
    document.getElementById("cand-mobile").value = "";
    document.getElementById("cand-email").value = "";
    document.getElementById("cand-test-date").value = "";

    document.getElementById("modal-add-candidate").classList.add("active");
  }

  openEditCandidateModal(id) {
    const c = this.candidates.find(item => item.id === id);
    if (!c) return;

    document.getElementById("modal-candidate-title").innerText = "Edit Candidate Registry";
    document.getElementById("modal-candidate-id").value = c.id;
    document.getElementById("cand-name").value = c.name;
    document.getElementById("cand-app-no").value = c.appNo;
    document.getElementById("cand-dob").value = c.dob;
    document.getElementById("cand-ll-no").value = c.llNo;
    document.getElementById("cand-mobile").value = c.mobile;
    document.getElementById("cand-email").value = c.email;
    document.getElementById("cand-test-date").value = c.testDate;

    document.getElementById("modal-add-candidate").classList.add("active");
  }

  closeCandidateModal() {
    document.getElementById("modal-add-candidate").classList.remove("active");
  }

  async handleSaveCandidate(e) {
    e.preventDefault();
    const id = document.getElementById("modal-candidate-id").value;
    const name = document.getElementById("cand-name").value.trim();
    const appNo = document.getElementById("cand-app-no").value.trim();
    const dob = document.getElementById("cand-dob").value;
    const llNo = document.getElementById("cand-ll-no").value.trim();
    const mobile = document.getElementById("cand-mobile").value.trim();
    const email = document.getElementById("cand-email").value.trim();
    const testDate = document.getElementById("cand-test-date").value;

    // Age validation (must be 18+)
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < 18) {
      alert("Validation Failed: Candidate must be at least 18 years old.");
      return;
    }

    // Driving test date validation (cannot be in the past)
    const selectedDate = new Date(testDate);
    const todayDateOnly = new Date();
    todayDateOnly.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);
    
    // Only enforce test date checks for new candidate registrations
    if (!id && selectedDate < todayDateOnly) {
      alert("Validation Failed: Driving test date cannot be in the past.");
      return;
    }

    // Duplicate Application Number check
    const duplicateApp = this.candidates.find(c => c.appNo === appNo && c.id !== id);
    if (duplicateApp) {
      alert(`Validation Failed: The Application Number "${appNo}" is already registered to candidate "${duplicateApp.name}".`);
      return;
    }

    // Duplicate License Number check
    const duplicateLL = this.candidates.find(c => c.llNo === llNo && c.id !== id);
    if (duplicateLL) {
      alert(`Validation Failed: The Learner's License Number "${llNo}" is already registered to candidate "${duplicateLL.name}".`);
      return;
    }

    try {
      if (useFirebase && db) {
        if (id) {
          const index = this.candidates.findIndex(c => c.id === id);
          if (index >= 0) {
            const candRef = fb.doc(db, "candidates", id);
            await fb.updateDoc(candRef, { name, appNo, dob, llNo, mobile, email, testDate });
          }

        } else {
          const newId = String(Date.now());
          const newCandObj = {
            id: newId, name, appNo, dob, llNo, mobile, email, testDate,
            score: 0, aiConfidence: 0, status: "Pending", eligibility: "Not Eligible",
            officerRemarks: "Awaiting video upload & evaluation.", officerName: "Inspector K. Raghavan",
            officerApproved: false, driverRating: "Awaiting Evaluation", driverRatingDesc: "Please upload track telemetry.",
            strengths: [], weaknesses: [], retestReadiness: 0, retestDate: "", violations: []
          };
          await fb.setDoc(fb.doc(db, "candidates", newId), newCandObj);

        }
      } else {
        // Fallback
        if (id) {
          const index = this.candidates.findIndex(c => c.id === id);
          if (index >= 0) {
            this.candidates[index] = { ...this.candidates[index], name, appNo, dob, llNo, mobile, email, testDate };
            this.saveOfflineFallback();
          }

        } else {
          const newCand = {
            id: String(Date.now()), name, appNo, dob, llNo, mobile, email, testDate,
            score: 0, aiConfidence: 0, status: "Pending", eligibility: "Not Eligible",
            officerRemarks: "Awaiting video upload & evaluation.", officerName: "Inspector K. Raghavan",
            officerApproved: false, driverRating: "Awaiting Evaluation", driverRatingDesc: "Please upload track telemetry.",
            strengths: [], weaknesses: [], retestReadiness: 0, retestDate: "", violations: []
          };
          this.candidates.push(newCand);
          this.saveOfflineFallback();

        }
      }
      
      await this.fetchData();
      this.closeCandidateModal();
      this.renderCandidatesCRUD();
    } catch (err) {
      console.error(err);
    }
  }

  async deleteCandidate(id) {
    if (confirm("Are you sure you want to delete this candidate record?")) {
      try {
        const c = this.candidates.find(item => item.id === id);
        if (useFirebase && db) {
          await fb.deleteDoc(fb.doc(db, "candidates", id));
        } else {
          const index = this.candidates.findIndex(item => item.id === id);
          if (index >= 0) {
            this.candidates.splice(index, 1);
            this.saveOfflineFallback();
          }
        }

        await this.fetchData();
        this.renderCandidatesCRUD();
      } catch (err) {
        console.error(err);
      }
    }
  }

  viewCandidateProfile(id) {
    const c = this.candidates.find(item => item.id === id);
    if (!c) return;

    this.currentUser = c;
    this.currentRole = "candidate";
    this.setupDashboardView();
    this.showScreen("app-layout");
    this.route("candidate-dashboard");
  }

  // VIDEO UPLOAD & AI SIMULATOR
  renderVideoEvaluation() {
    const select = document.getElementById("upload-candidate-select");
    select.innerHTML = "";
    
    const pending = this.candidates.filter(c => c.status === "Pending");
    if (pending.length === 0) {
      this.candidates.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.name} (${c.appNo})</option>`;
      });
    } else {
      pending.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.name} (${c.appNo})</option>`;
      });
    }

    document.getElementById("start-evaluation-btn").disabled = true;
    document.getElementById("evaluation-progress-wrapper").style.display = "none";
    
    const log = document.getElementById("evaluation-console-log");
    log.innerHTML = `
      <div class="log-line">> RTO Artificial Intelligence System ready.</div>
      <div class="log-line">> Select candidate and upload footage to begin.</div>
    `;
  }

  handleVideoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    this.uploadedVideoFile = file;
    document.getElementById("start-evaluation-btn").disabled = false;
    
    const log = document.getElementById("evaluation-console-log");
    log.innerHTML += `
      <div class="log-line success">> Video telemetry package ingested: ${file.name} (${(file.size/1024/1024).toFixed(2)} MB)</div>
      <div class="log-line">> System coordinates mappings loaded. Click Start AI Evaluation.</div>
    `;
    log.scrollTop = log.scrollHeight;
  }

  startAIEvaluation() {
    const candSelect = document.getElementById("upload-candidate-select");
    this.evaluatingCandidateId = candSelect.value;
    
    document.getElementById("start-evaluation-btn").disabled = true;
    document.getElementById("evaluation-progress-wrapper").style.display = "block";
    this.evaluatingProgress = 0;
    
    const logs = [
      "Initializing computer vision tensor networks...",
      "Mapping RTO SmartTrack boundary vectors...",
      "Tracking vehicle path coordinates (10 fps logging)...",
      "Analyzing boundary intersections...",
      "Checking parking docking alignment parameters...",
      "Evaluating turn indicator delays...",
      "Generating final safe driver assessment score..."
    ];

    const logBox = document.getElementById("evaluation-console-log");

    this.evaluationTimer = setInterval(() => {
      this.evaluatingProgress += 10;
      if (this.evaluatingProgress > 100) this.evaluatingProgress = 100;

      document.getElementById("evaluation-progress-bar").style.width = this.evaluatingProgress + "%";
      document.getElementById("evaluation-progress-val").innerText = this.evaluatingProgress + "%";

      const logIdx = Math.floor((this.evaluatingProgress / 100) * (logs.length - 1));
      logBox.innerHTML += `<div class="log-line">> ${logs[logIdx]}</div>`;
      logBox.scrollTop = logBox.scrollHeight;

      if (this.evaluatingProgress >= 100) {
        clearInterval(this.evaluationTimer);
        this.finishAIEvaluation();
      }
    }, 400);
  }

  async finishAIEvaluation() {
    const id = this.evaluatingCandidateId;
    const cand = this.candidates.find(c => c.id === id);
    if (!cand) return;

    const aiResult = {
      score: 82,
      aiConfidence: 95.4,
      status: "Passed",
      eligibility: "Eligible",
      driverRating: "Safe Driver",
      driverRatingDesc: "Vehicle maintains good speed profiles and centers turn lanes properly.",
      strengths: ["Defensive spacing parameters normal", "Safe reverse alignment inside dock grid"],
      weaknesses: ["Indicator signal delayed at exit curve"],
      officerRemarks: "AI calculation shows correct path tracking. Recommended approval.",
      officerName: "Inspector K. Raghavan",
      officerApproved: true,
      testDate: new Date().toISOString().split('T')[0],
      violations: [
        {
          name: "Wrong Indicator Usage",
          severity: "Warning",
          time: 25,
          description: "Turned exits without satisfying 3 seconds pre-signal alerts.",
          x: 280, y: 140
        }
      ]
    };

    try {
      if (useFirebase && db) {
        await fb.updateDoc(fb.doc(db, "candidates", id), aiResult);
      } else {
        const index = this.candidates.findIndex(item => item.id === id);
        if (index >= 0) {
          this.candidates[index] = { ...this.candidates[index], ...aiResult };
          this.saveOfflineFallback();
        }
      }

      await this.fetchData();
      
      const logBox = document.getElementById("evaluation-console-log");
      logBox.innerHTML += `
        <div class="log-line success">> AI Evaluation complete. Score: 82. Result: Passed.</div>
        <div class="log-line success">> Ingesting reports to RTO gateway DB...</div>
      `;
      logBox.scrollTop = logBox.scrollHeight;

      setTimeout(() => {
        this.overrideAIResult(id);
      }, 1200);
    } catch (err) {
      console.error(err);
    }
  }

  overrideAIResult(candidateId) {
    this.overrideCandidateId = candidateId;
    const cand = this.candidates.find(c => c.id === candidateId);
    if (!cand) return;

    document.getElementById("override-candidate-badge").innerText = cand.appNo;
    document.getElementById("override-ai-score").innerText = cand.score;
    document.getElementById("override-ai-decision").innerText = cand.status;
    document.getElementById("override-ai-decision").className = `badge ${cand.status === 'Passed' ? 'badge-success' : 'badge-danger'}`;
    document.getElementById("override-ai-confidence").innerText = cand.aiConfidence + "%";
    document.getElementById("override-remarks").value = cand.officerRemarks;
    
    this.overrideStatus = cand.status;
    this.updateOverrideButtons();

    const vList = document.getElementById("override-violations-summary-list");
    vList.innerHTML = "";
    if (cand.violations.length === 0) {
      vList.innerHTML = `<div style="font-size:0.85rem; color:var(--text-muted);">No violations detected.</div>`;
    } else {
      cand.violations.forEach(v => {
        vList.innerHTML += `
          <div style="padding:10px; border:1px solid var(--border-color); border-radius:var(--radius-sm); font-size:0.8rem; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong>${v.name}</strong><br>
              <span style="color:var(--text-muted)">Time: s${v.time} • Severity: ${v.severity}</span>
            </div>
            <span class="badge ${v.severity === 'Critical' ? 'badge-danger' : 'badge-warning'}">${v.severity}</span>
          </div>
        `;
      });
    }

    this.route("admin-result-override");
  }

  setOverrideStatus(status) {
    this.overrideStatus = status;
    this.updateOverrideButtons();
  }

  updateOverrideButtons() {
    const btnPass = document.getElementById("override-btn-pass");
    const btnFail = document.getElementById("override-btn-fail");

    if (this.overrideStatus === "Passed") {
      btnPass.className = "btn btn-secondary active";
      btnPass.style.borderColor = "var(--success)";
      btnPass.style.color = "var(--success)";
      
      btnFail.className = "btn btn-secondary";
      btnFail.style.borderColor = "";
      btnFail.style.color = "";
    } else {
      btnFail.className = "btn btn-secondary active";
      btnFail.style.borderColor = "var(--danger)";
      btnFail.style.color = "var(--danger)";
      
      btnPass.className = "btn btn-secondary";
      btnPass.style.borderColor = "";
      btnPass.style.color = "";
    }
  }

  async saveOverrideResult() {
    const cand = this.candidates.find(c => c.id === this.overrideCandidateId);
    if (!cand) return;

    const modifiedResult = {
      score: cand.score,
      aiConfidence: cand.aiConfidence,
      status: this.overrideStatus,
      eligibility: this.overrideStatus === "Passed" ? "Eligible" : "Retest Required",
      officerRemarks: document.getElementById("override-remarks").value,
      officerApproved: true,
      officerName: "Inspector K. Raghavan",
      testDate: new Date().toISOString().split('T')[0],
      driverRating: cand.driverRating,
      driverRatingDesc: cand.driverRatingDesc,
      retestReadiness: cand.retestReadiness,
      retestDate: cand.retestDate,
      strengths: cand.strengths,
      weaknesses: cand.weaknesses,
      violations: cand.violations
    };

    if (this.overrideStatus === "Failed" && !modifiedResult.retestDate) {
      const rtDate = new Date();
      rtDate.setDate(rtDate.getDate() + 7);
      modifiedResult.retestDate = rtDate.toISOString().split('T')[0];
    }

    try {
      if (useFirebase && db) {
        await fb.updateDoc(fb.doc(db, "candidates", cand.id), modifiedResult);
      } else {
        const index = this.candidates.findIndex(item => item.id === cand.id);
        if (index >= 0) {
          this.candidates[index] = { ...this.candidates[index], ...modifiedResult };
          this.saveOfflineFallback();
        }
      }


      await this.addNotification("Result Published", `Evaluation scores published for candidate ${cand.name} (${cand.appNo}).`, "info");

      alert("Result override saved and published successfully.");
      this.route("admin-dashboard");
    } catch (err) {
      console.error(err);
    }
  }

  // ANALYTICS & HISTOGRAM CHARTS
  renderAnalyticsCharts() {
    if (this.charts.passrate) this.charts.passrate.destroy();

    const ctx1 = document.getElementById("chart-passrate-trend").getContext("2d");
    this.charts.passrate = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
          {
            label: 'Pass %',
            data: [68, 70, 71, 69, 74, 72.4],
            backgroundColor: 'rgba(16, 185, 129, 0.85)',
            borderColor: 'var(--success)',
            borderWidth: 1
          },
          {
            label: 'Fail %',
            data: [32, 30, 29, 31, 26, 27.6],
            backgroundColor: 'rgba(239, 68, 68, 0.85)',
            borderColor: 'var(--danger)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, max: 100 }
        }
      }
    });
  }

  renderProfileSettings() {
    const user = this.currentUser;
    const isCand = this.currentRole === "candidate";
    
    const nameGroup = document.getElementById("profile-name-group");
    const mobileGroup = document.getElementById("profile-mobile-group");
    
    if (isCand) {
      if (nameGroup) nameGroup.style.display = "block";
      if (mobileGroup) mobileGroup.style.display = "block";
      document.getElementById("profile-edit-name").value = user.name;
      document.getElementById("profile-edit-mobile").value = user.mobile || "";
    } else {
      if (nameGroup) nameGroup.style.display = "none";
      if (mobileGroup) mobileGroup.style.display = "none";
    }
    document.getElementById("profile-edit-email").value = user.email || "";
  }

  // SIDEBAR TOGGLE

  toggleSidebar() {
    const sidebar = document.getElementById("app-sidebar");
    sidebar.classList.toggle("mobile-open");
  }
}

const app = new SmartDriveApp();
window.onload = () => app.init();
window.app = app; // Bind globally for HTML event handlers
