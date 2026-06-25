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
    
    // Video upload state
    this.uploadedVideoFile = null;
    this.evaluatingCandidateId = null;
    
    // Override Screen state
    this.overrideCandidateId = null;
    this.overrideStatus = "Passed";

    this.charts = {};
  }

  async init() {
    this.currentTheme = localStorage.getItem("sd_theme") || "light";
    this.currentLang = localStorage.getItem("sd_lang") || "en";
    this.applyTheme();

    const savedUser = localStorage.getItem("sd_current_user");
    const savedRole = localStorage.getItem("sd_current_role");
    if (savedUser && savedRole) {
      this.currentUser = JSON.parse(savedUser);
      this.currentRole = savedRole;
    }

    await this.loadTemplates();
    await this.initFirebase();

    const candidateForm = document.getElementById("modal-candidate-form");
    if (candidateForm) {
      candidateForm.addEventListener("submit", e => this.handleSaveCandidate(e));
    }

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

    if (this.currentUser && this.currentRole) {
      this.setupDashboardView();
      this.showScreen("app-layout");
      this.route(this.currentRole === "admin" ? "admin-dashboard" : "candidate-dashboard");
    }

    this.renderNotifications();
    
    const statTotal = document.getElementById("landing-stat-total");
    const statRate = document.getElementById("landing-stat-rate");
    if(statTotal) statTotal.innerText = "14,250+";
    if(statRate) statRate.innerText = "72.4%";
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
      { id: "screen-admin-candidate-profile", path: "pages/admin-candidate-profile.html" },
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
        const [candSnap, notifySnap] = await Promise.all([
          fb.getDocs(fb.collection(db, "candidates")),
          fb.getDocs(fb.collection(db, "notifications"))
        ]);

        this.candidates = [];
        candSnap.forEach(d => {
          this.candidates.push({ id: d.id, ...d.data() });
        });
        this.candidates.sort((a, b) => Number(b.id) - Number(a.id));

        this.notifications = [];
        notifySnap.forEach(d => {
          this.notifications.push({ id: d.id, ...d.data() });
        });
        this.notifications.sort((a,b) => b.id - a.id);

      } catch (err) {
        console.error("Firestore transaction error:", err.message);
        this.loadOfflineFallback();
      }
    } else {
      this.loadOfflineFallback();
    }

    if (this.currentUser && this.currentRole === "candidate") {
      const fresh = this.candidates.find(c => c.id === this.currentUser.id);
      if (fresh) this.currentUser = fresh;
    }
  }

  loadOfflineFallback() {
    this.candidates = [];
    localStorage.removeItem("sd_firebase_fallback_candidates");

    const cachedNotify = localStorage.getItem("sd_firebase_fallback_notify");
    if (cachedNotify) {
      this.notifications = JSON.parse(cachedNotify);
    } else {
      this.notifications = [];
      localStorage.setItem("sd_firebase_fallback_notify", JSON.stringify(this.notifications));
    }
  }

  saveOfflineFallback() {
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
    } else if (screenId === "admin-candidate-profile") {
      document.getElementById("current-screen-title").innerText = "Candidate Profile Review";
      this.renderAdminCandidateProfile();
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
      } catch (err) {}
    }

    const user = this.candidates.find(c => c.appNo === appNo && c.dob === dob);
    if (user) {
      this.currentUser = user;
      this.currentRole = "candidate";
      localStorage.setItem("sd_current_user", JSON.stringify(this.currentUser));
      localStorage.setItem("sd_current_role", this.currentRole);
      this.setupDashboardView();
      this.showScreen("app-layout");
      this.route("candidate-dashboard");
    } else {
      alert("Invalid Candidate Application Number or Date of Birth.");
    }
  }

  async handleAdminLogin(e) {
    e.preventDefault();
    const user = document.getElementById("admin-user").value.trim();
    const pass = document.getElementById("admin-pass").value;

    if (user === "rto.officer.01" && pass === "rto123") {
      this.currentUser = { name: "Officer K. Raghavan", appNo: "RTO-1045", dob: "", email: "rtokasaragod@gov.in" };
      this.currentRole = "admin";
      localStorage.setItem("sd_current_user", JSON.stringify(this.currentUser));
      localStorage.setItem("sd_current_role", this.currentRole);
      this.setupDashboardView();
      this.showScreen("app-layout");
      this.route("admin-dashboard");
    } else {
      alert("Invalid credentials.");
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
    localStorage.removeItem("sd_current_user");
    localStorage.removeItem("sd_current_role");
    window.location.reload();
  }

  // NOTIFICATION DRAWER
  async toggleNotifications() {
    const panel = document.getElementById("app-notification-panel");
    panel.classList.toggle("active");
    
    if (panel.classList.contains("active")) {
      if (useFirebase && db) {
        try {
          const snap = await fb.getDocs(fb.collection(db, "notifications"));
          snap.forEach(async (d) => {
            if (d.data().unread) {
              await fb.updateDoc(fb.doc(db, "notifications", d.id), { unread: false });
            }
          });
          const dot = document.getElementById("notify-badge-dot");
          if(dot) dot.style.display = "none";
          await this.fetchData();
          this.renderNotifications();
        } catch (err) {}
      } else {
        this.notifications.forEach(n => n.unread = false);
        this.saveOfflineFallback();
        this.renderNotifications();
      }
    }
  }

  renderNotifications() {
    const list = document.getElementById("app-notifications-list");
    if(!list) return;
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
      } catch (err) {}
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
    document.getElementById("db-ai-confidence").innerText = (user.aiConfidence || 0) + "%";
    document.getElementById("db-officer-approval").innerText = user.officerApproved ? "Approved" : "Pending";

    const statusBg = document.getElementById("db-status-bg");
    const eligBg = document.getElementById("db-eligibility-bg");
    
    const statusLower = (user.status || "").trim().toLowerCase();
    if (statusLower === "passed") {
      statusBg.className = "stat-icon bg-success-light";
      statusBg.innerHTML = `<i class="fa-solid fa-circle-check"></i>`;
    } else if (statusLower === "failed") {
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
    const offset = circumference - ((user.score || 0) / 100) * circumference;
    const scoreCircleBar = document.getElementById("score-circle-bar");
    scoreCircleBar.style.strokeDashoffset = offset;
    scoreCircleBar.style.stroke = statusLower === "passed" ? "var(--success)" : "var(--danger)";
  }

  // CANDIDATE RESULTS SCREEN
  renderCandidateResults() {
    const user = this.currentUser;
    
    const statusStamp = document.getElementById("res-status-stamp");
    statusStamp.innerText = user.status;
    const statusLower = (user.status || "").trim().toLowerCase();
    statusStamp.className = `badge ${statusLower === 'passed' ? 'badge-success' : 'badge-danger'}`;

    document.getElementById("res-score-val").innerText = user.score;
    document.getElementById("res-confidence-val").innerText = (user.aiConfidence || 0) + "%";
    document.getElementById("res-evaluation-date").innerText = user.testDate;
    document.getElementById("res-officer-remarks").innerText = user.officerRemarks;
    document.getElementById("res-officer-name").innerText = user.officerName || "Inspector K. Raghavan";
    document.getElementById("res-approval-badge").className = `badge ${user.officerApproved ? 'badge-success' : 'badge-warning'}`;
    document.getElementById("res-approval-badge").innerText = user.officerApproved ? "Approved" : "Pending Approval";

    const vListCount = document.getElementById("res-violation-count");
    const vLength = user.violations ? user.violations.length : 0;
    vListCount.innerText = vLength === 1 ? "1 Violation" : `${vLength} Violations`;
    vListCount.className = `badge ${vLength > 0 ? 'badge-danger' : 'badge-success'}`;

    const list = document.getElementById("results-violations-list");
    list.innerHTML = "";
    if (vLength === 0) {
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
      card.className = `violation-card-item severity-${(v.severity||'').toLowerCase()}`;
      card.innerHTML = `
        <div class="violation-card-icon">
          <i class="fa-solid fa-triangle-exclamation"></i>
        </div>
        <div class="violation-card-info">
          <div class="violation-card-title">
            ${v.name}
            <span>Time: ${v.time}</span>
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

  // LICENSE ELIGIBILITY SCREEN
  renderCandidateEligibility() {
    const user = this.currentUser;
    document.getElementById("cert-name").innerText = user.name;
    document.getElementById("cert-app-no").innerText = user.appNo;
    document.getElementById("cert-ll-no").innerText = user.llNo;
    document.getElementById("cert-score").innerText = `${user.score} / 100`;
    
    const statusText = document.getElementById("cert-status");

    const statusLower = (user.status || "").trim().toLowerCase();
    if (statusLower === "passed") {
      statusText.innerText = "APPROVED FOR LICENSE";
      statusText.style.color = "var(--success)";
    } else if (statusLower === "failed") {
      statusText.innerText = "NOT ELIGIBLE (FAILED)";
      statusText.style.color = "var(--danger)";
    } else {
      statusText.innerText = "EVALUATION PENDING";
      statusText.style.color = "var(--text-muted)";
    }

    document.getElementById("cert-eval-date").innerText = user.testDate;
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
    const iconWrapper = document.getElementById("general-notice-icon");
    if(iconWrapper) iconWrapper.outerHTML = `<div id="general-notice-icon" style="font-size:3rem; margin-bottom:20px;">${iconHtml}</div>`;
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
    const passed = this.candidates.filter(c => (c.status || "").trim().toLowerCase() === "passed").length;
    const failed = this.candidates.filter(c => (c.status || "").trim().toLowerCase() === "failed").length;
    const pending = this.candidates.filter(c => {
      const s = (c.status || "").trim().toLowerCase();
      return s === "pending" || s === "processing";
    }).length;

    document.getElementById("admin-stat-total").innerText = total;
    document.getElementById("admin-stat-passed").innerText = passed;
    document.getElementById("admin-stat-failed").innerText = failed;
    document.getElementById("admin-stat-pending").innerText = pending;

    const tbody = document.getElementById("admin-dashboard-recent-table");
    if(!tbody) return;
    tbody.innerHTML = "";
    
    const sorted = [...this.candidates].reverse().slice(0, 5);
    sorted.forEach(c => {
      const row = document.createElement("tr");
      const statusLower = (c.status || "").trim().toLowerCase();
      let badgeClass = "badge-success";
      if (statusLower === "failed") badgeClass = "badge-danger";
      else if (statusLower === "pending" || statusLower === "processing") badgeClass = "badge-warning";

      row.innerHTML = `
        <td><strong>${c.name}</strong></td>
        <td style="font-family:monospace;">${c.appNo}</td>
        <td>${c.testDate || '-'}</td>
        <td><strong>${c.score || 0}</strong></td>
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
    if(!table) return;
    table.innerHTML = "";
    
    this.candidates.forEach(c => {
      const row = document.createElement("tr");
      const badgeClass = this.getStatusBadgeClass(c.status);

      row.innerHTML = `
        <td><strong>${c.name}</strong></td>
        <td style="font-family:monospace;">${c.appNo}</td>
        <td>${c.dob}</td>
        <td style="font-family:monospace;">${c.llNo}</td>
        <td>${c.mobile}</td>
        <td>${c.testDate || '-'}</td>
        <td><span class="badge ${badgeClass}">${c.status}</span></td>
        <td class="table-action-row">
          <button class="table-action-btn" onclick="app.viewCandidateProfile('${c.id}')" title="View Detail"><i class="fa-solid fa-eye"></i></button>
          <button class="table-action-btn" onclick="app.overrideAIResult('${c.id}')" title="Override decision"><i class="fa-solid fa-sliders"></i></button>
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
      const badgeClass = this.getStatusBadgeClass(c.status);

      row.innerHTML = `
        <td><strong>${c.name}</strong></td>
        <td style="font-family:monospace;">${c.appNo}</td>
        <td>${c.dob}</td>
        <td style="font-family:monospace;">${c.llNo}</td>
        <td>${c.mobile}</td>
        <td>${c.testDate || '-'}</td>
        <td><span class="badge ${badgeClass}">${c.status}</span></td>
        <td class="table-action-row">
          <button class="table-action-btn" onclick="app.viewCandidateProfile('${c.id}')" title="View detail"><i class="fa-solid fa-eye"></i></button>
          <button class="table-action-btn" onclick="app.overrideAIResult('${c.id}')" title="Override decision"><i class="fa-solid fa-sliders"></i></button>
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

  getStatusBadgeClass(status) {
    const normalized = String(status || "").trim().toLowerCase();
    if (normalized === "failed") return "badge-danger";
    if (normalized === "passed") return "badge-success";
    if (normalized === "pending" || normalized === "processing") return "badge-warning";
    return "badge-secondary";
  }

  normalizeValue(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  isValidAppNo(appNo) {
    return /^[A-Za-z0-9][A-Za-z0-9\-\/ ]{2,}$/.test(String(appNo || "").trim());
  }

  isValidLicenseNo(llNo) {
    return /^[A-Za-z0-9][A-Za-z0-9\-\/ ]{2,}$/.test(String(llNo || "").trim());
  }

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
  }

  isValidPhoneNumber(phone) {
    const normalized = phone.replace(/\D/g, "");
    return /^\d{10}$/.test(normalized);
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

    if (!name) {
      alert("Validation Failed: Candidate name is required.");
      document.getElementById("cand-name").focus();
      return;
    }

    if (!appNo || !this.isValidAppNo(appNo)) {
      alert("Validation Failed: Enter a valid application number.");
      document.getElementById("cand-app-no").focus();
      return;
    }

    if (!dob) {
      alert("Validation Failed: Date of birth is required.");
      document.getElementById("cand-dob").focus();
      return;
    }

    const birthDate = new Date(dob);
    if (!Number.isFinite(birthDate.getTime())) {
      alert("Validation Failed: Enter a valid date of birth.");
      document.getElementById("cand-dob").focus();
      return;
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < 18) {
      alert("Validation Failed: Candidate must be at least 18 years old.");
      document.getElementById("cand-dob").focus();
      return;
    }

    if (!llNo || !this.isValidLicenseNo(llNo)) {
      alert("Validation Failed: Enter a valid learner's license number.");
      document.getElementById("cand-ll-no").focus();
      return;
    }

    if (!mobile) {
      alert("Validation Failed: Mobile number is required.");
      document.getElementById("cand-mobile").focus();
      return;
    }

    if (!this.isValidPhoneNumber(mobile)) {
      alert("Validation Failed: Please enter a valid 10-digit mobile number.");
      document.getElementById("cand-mobile").focus();
      return;
    }

    if (email && !this.isValidEmail(email)) {
      alert("Validation Failed: Enter a valid email address.");
      document.getElementById("cand-email").focus();
      return;
    }

    if (!testDate) {
      alert("Validation Failed: Driving test date is required.");
      document.getElementById("cand-test-date").focus();
      return;
    }

    const selectedDate = new Date(testDate);
    const todayDateOnly = new Date();
    todayDateOnly.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);
    
    if (!id && selectedDate < todayDateOnly) {
      alert("Validation Failed: Driving test date cannot be in the past.");
      document.getElementById("cand-test-date").focus();
      return;
    }

    const normalizedAppNo = this.normalizeValue(appNo);
    const normalizedLLNo = this.normalizeValue(llNo);
    const normalizedMobile = mobile.replace(/\D/g, "");

    const duplicateApp = this.candidates.find(c => this.normalizeValue(c.appNo) === normalizedAppNo && c.id !== id);
    if (duplicateApp) {
      alert(`Validation Failed: The Application Number "${appNo}" is already registered.`);
      document.getElementById("cand-app-no").focus();
      return;
    }

    const duplicateLL = this.candidates.find(c => this.normalizeValue(c.llNo) === normalizedLLNo && c.id !== id);
    if (duplicateLL) {
      alert(`Validation Failed: The Learner's License Number "${llNo}" is already registered.`);
      document.getElementById("cand-ll-no").focus();
      return;
    }

    const duplicateMobile = this.candidates.find(c => c.mobile.replace(/\D/g, "") === normalizedMobile && c.id !== id);
    if (duplicateMobile) {
      alert(`Validation Failed: The mobile number "${mobile}" is already registered.`);
      document.getElementById("cand-mobile").focus();
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

    this.selectedCandidate = c;
    this.currentRole = "admin";
    this.showScreen("app-layout");
    this.route("admin-candidate-profile");
  }

  renderAdminCandidateProfile() {
    const cand = this.selectedCandidate;
    if (!cand) return;

    const profileTitle = document.getElementById("admin-candidate-profile-title");
    if (profileTitle) profileTitle.innerText = cand.name;

    const profileBadge = document.getElementById("admin-candidate-profile-status");
    if (profileBadge) {
      const statusLower = (cand.status || "").trim().toLowerCase();
      const badgeClass = statusLower === "passed" ? "badge-success" : statusLower === "failed" ? "badge-danger" : "badge-warning";
      profileBadge.className = `badge ${badgeClass}`;
      profileBadge.innerText = cand.status;
    }

    const details = [
      ["admin-candidate-app-no", cand.appNo],
      ["admin-candidate-dob", cand.dob],
      ["admin-candidate-ll-no", cand.llNo],
      ["admin-candidate-mobile", cand.mobile],
      ["admin-candidate-email", cand.email],
      ["admin-candidate-test-date", cand.testDate],
      ["admin-candidate-score", `${cand.score}`],
      ["admin-candidate-confidence", `${cand.aiConfidence}%`],
      ["admin-candidate-eligibility", cand.eligibility],
      ["admin-candidate-officer", cand.officerName || "Inspector K. Raghavan"],
      ["admin-candidate-remarks", cand.officerRemarks],
      ["admin-candidate-rating", cand.driverRating],
      ["admin-candidate-rating-desc", cand.driverRatingDesc],
      ["admin-candidate-retest", cand.retestDate || "Not scheduled"]
    ];

    details.forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.innerText = value;
    });

    const strengths = document.getElementById("admin-candidate-strengths");
    if (strengths) {
      strengths.innerHTML = (cand.strengths && cand.strengths.length)
        ? cand.strengths.map(item => `<li>${item}</li>`).join("")
        : `<li>No strengths recorded.</li>`;
    }

    const weaknesses = document.getElementById("admin-candidate-weaknesses");
    if (weaknesses) {
      weaknesses.innerHTML = (cand.weaknesses && cand.weaknesses.length)
        ? cand.weaknesses.map(item => `<li>${item}</li>`).join("")
        : `<li>No weaknesses recorded.</li>`;
    }

    const violations = document.getElementById("admin-candidate-violations");
    if (violations) {
      violations.innerHTML = "";
      if (!cand.violations || cand.violations.length === 0) {
        violations.innerHTML = `<div style="padding:16px; border:1px solid var(--border-color); border-radius:var(--radius-md); color:var(--text-sub);">No violations recorded for this candidate.</div>`;
      } else {
        cand.violations.forEach(v => {
          const item = document.createElement("div");
          item.className = "violation-card-item";
          item.innerHTML = `
            <div class="violation-card-icon">
              <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div class="violation-card-info">
              <div class="violation-card-title">
                ${v.name}
                <span>Time: ${v.time}</span>
              </div>
              <div style="font-size:0.75rem; font-weight:700; margin-bottom:4px;" class="${v.severity === 'Critical' ? 'text-danger' : 'text-warning'}">
                Severity: ${v.severity}
              </div>
              <p style="font-size:0.85rem; color:var(--text-sub);">${v.description}</p>
            </div>
          `;
          violations.appendChild(item);
        });
      }
    }

    const aScore = document.getElementById("admin-candidate-assessment-score");
    if (aScore) aScore.innerText = cand.score !== undefined ? cand.score : "-";

    const aDecision = document.getElementById("admin-candidate-assessment-decision");
    if (aDecision) {
      const status = cand.status || "Pending";
      const statusLower = status.trim().toLowerCase();
      let cls = "badge-warning";
      if (statusLower === "passed") cls = "badge-success";
      else if (statusLower === "failed") cls = "badge-danger";
      aDecision.className = `badge ${cls}`;
      aDecision.innerText = status;
    }

    const aConf = document.getElementById("admin-candidate-assessment-confidence");
    if (aConf) aConf.innerText = cand.aiConfidence ? `${cand.aiConfidence}%` : "-";

    const aRemarks = document.getElementById("admin-candidate-assessment-remarks");
    if (aRemarks) aRemarks.value = cand.officerRemarks || "";

    const aViolations = document.getElementById("admin-candidate-assessment-violations");
    if (aViolations) {
      aViolations.innerHTML = "";
      if (!cand.violations || cand.violations.length === 0) {
        aViolations.innerHTML = `<div style="color:var(--text-sub);">No violations recorded.</div>`;
      } else {
        cand.violations.forEach(v => {
          aViolations.innerHTML += `
            <div style="padding:8px; border-bottom:1px dashed var(--border-color); display:flex; justify-content:space-between; align-items:center; gap:8px;">
              <div style="font-size:0.9rem;"><strong>${v.name}</strong><div style="font-size:0.8rem; color:var(--text-muted)">Time: ${v.time} • ${v.description}</div></div>
              <span class="badge ${v.severity === 'Critical' ? 'badge-danger' : 'badge-warning'}">${v.severity}</span>
            </div>
          `;
        });
      }
    }
  }

  // ==========================================
  // REAL PYTHON VIDEO UPLOAD & AI ENGINE
  // ==========================================
  renderVideoEvaluation() {
    const select = document.getElementById("upload-candidate-select");
    if(!select) return;
    select.innerHTML = "";
    
    const pending = this.candidates.filter(c => c.status === "Pending" || c.status === "Processing");
    if (pending.length === 0) {
      this.candidates.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.name} (${c.appNo})</option>`;
      });
    } else {
      pending.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.name} (${c.appNo})</option>`;
      });
    }

    this.resetEvaluationUI();
  }

  handleVideoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    this.uploadedVideoFile = file;
    document.getElementById("start-evaluation-btn").disabled = false;
    document.getElementById("upload-title").innerText = file.name;
    
    const log = document.getElementById("evaluation-console-log");
    log.innerHTML += `
      <div class="log-line success">> Video telemetry package loaded: ${file.name} (${(file.size/1024/1024).toFixed(2)} MB)</div>
      <div class="log-line">> Ready to stream to YOLO backend. Click Start AI Evaluation.</div>
    `;
    log.scrollTop = log.scrollHeight;
  }

  async startAIEvaluation() {
    if (!this.uploadedVideoFile) return;

    const candSelect = document.getElementById("upload-candidate-select");
    this.evaluatingCandidateId = candSelect.value;
    const candidateId = this.evaluatingCandidateId;
    
    const btn = document.getElementById('start-evaluation-btn');
    const progressWrapper = document.getElementById('evaluation-progress-wrapper');
    const logBox = document.getElementById("evaluation-console-log");

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing Video on Local GPU...';
    progressWrapper.style.display = 'block';

    logBox.innerHTML += `<div class="log-line warning">> Transmitting video to Local PyTorch Engine for ${candidateId}...</div>`;
    logBox.innerHTML += `<div class="log-line">> A local OpenCV window will open to display the real-time AI tracking. Please wait...</div>`;
    logBox.scrollTop = logBox.scrollHeight;

    const formData = new FormData();
    formData.append('video', this.uploadedVideoFile);
    formData.append('candidate_id', candidateId);

    try {
            // FIX 3: Point the fetch to Python on Port 5000!
            const response = await fetch('http://127.0.0.1:5000/api/evaluate', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            console.log("Backend PyTorch Response:", data);

        if (data.success) {
            const results = data.results;
            logBox.innerHTML += `<div class="log-line success">> Evaluation Complete! Processing AI results vector.</div>`;
            logBox.scrollTop = logBox.scrollHeight;
            
            // Extract the true score and format violations
            const finalScore = Number(results.total_score) || 0;
            let violationEntries = [];
            
            if (results.violations) {
                if (Array.isArray(results.violations)) {
                    violationEntries = results.violations.map(v => [v, 1]);
                } else if (typeof results.violations === 'object') {
                    violationEntries = Object.entries(results.violations);
                }
            }
            
            const hasViolations = violationEntries.length > 0;

            // STRICT RTO LOGIC: Any violation instantly forces a FAILED result
            let strictDecision = 'FAILED';
            if (finalScore === 100 && !hasViolations) {
                strictDecision = 'PASSED';
            }

            // Map violations to fit the App DB schema
            const formattedViolations = violationEntries.map(([v_name, v_count]) => ({
                name: v_name,
                severity: "Warning",
                time: "N/A",
                description: `Occurrence Count: ${v_count}`
            }));

            const modifiedResult = {
                score: finalScore,
                aiConfidence: results.ai_confidence || 0,
                status: strictDecision,
                eligibility: strictDecision === "PASSED" ? "Eligible" : "Not Eligible",
                officerRemarks: strictDecision === "PASSED" ? "AI verified path. Recommended pass." : "AI detected boundary or sequence violations.",
                officerName: "System AI Engine",
                officerApproved: false, 
                testDate: new Date().toISOString().split('T')[0],
                violations: formattedViolations
            };

            // 1. UPDATE LOCAL & FIREBASE DB
            if (useFirebase && db) {
                await fb.updateDoc(fb.doc(db, "candidates", candidateId), modifiedResult);
            } else {
                const index = this.candidates.findIndex(item => item.id === candidateId);
                if (index >= 0) {
                    this.candidates[index] = { ...this.candidates[index], ...modifiedResult };
                    this.saveOfflineFallback();
                }
            }
            await this.fetchData();

            // 2. UPDATE THE INLINE DASHBOARD (If viewing admin-video-evaluation.html)
            const dashboard = document.getElementById('result-dashboard');
            if (dashboard) {
                document.getElementById('dashboard-candidate-id').innerText = candidateId;
                document.getElementById('ai-score').innerText = finalScore;
                document.getElementById('ai-confidence').innerText = (results.ai_confidence || 0) + '%';
                
                const decisionBadge = document.getElementById('ai-decision');
                decisionBadge.innerText = strictDecision;
                decisionBadge.className = strictDecision === 'PASSED' ? 'badge-decision pass' : 'badge-decision fail';

                const vContainer = document.getElementById('violations-log');
                vContainer.innerHTML = '';
                
                if (hasViolations) {
                    violationEntries.forEach(([v_name, v_count]) => {
                        vContainer.innerHTML += `
                            <div class="violation-item">
                                <div>
                                    <strong style="color:white;">${v_name}</strong>
                                    <div class="violation-meta">Occurrence Count: ${v_count}</div>
                                </div>
                                <span class="badge-warning">WARNING</span>
                            </div>
                        `;
                        logBox.innerHTML += `<div class="log-line error">> Foul Logged: ${v_name} x${v_count}</div>`;
                    });
                } else {
                    vContainer.innerHTML = `
                        <div style="padding: 20px; text-align: center; color: var(--success); background: rgba(74, 222, 128, 0.1); border-radius: 8px; border: 1px dashed var(--success);">
                            <i class="fa-solid fa-check-circle" style="font-size: 2rem; margin-bottom: 10px;"></i>
                            <div>No violations detected. Perfect run!</div>
                        </div>
                    `;
                    logBox.innerHTML += `<div class="log-line success">> Violations: None. Clean run!</div>`;
                }
                logBox.scrollTop = logBox.scrollHeight;

                document.getElementById('upload-section').style.display = 'none';
                dashboard.style.display = 'block';
            } else {
                // Fallback to routing to the standard override screen if inline dashboard is missing
                this.overrideAIResult(candidateId);
            }

        } else {
            logBox.innerHTML += `<div class="log-line error">> Error: ${data.error}</div>`;
            logBox.scrollTop = logBox.scrollHeight;
        }

    } catch (error) {
        logBox.innerHTML += `<div class="log-line error">> Connection Error: Ensure app.py is running on port 5000 in your terminal!</div>`;
        logBox.scrollTop = logBox.scrollHeight;
        console.error("Local PyTorch Fetch Error:", error);
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-microchip"></i> Start AI Evaluation Process';
        btn.disabled = false;
        progressWrapper.style.display = 'none';
    }
  }

  resetEvaluationUI() {
    const dashboard = document.getElementById('result-dashboard');
    const uploadSec = document.getElementById('upload-section');
    if (dashboard) dashboard.style.display = 'none';
    if (uploadSec) uploadSec.style.display = 'grid';
    
    this.uploadedVideoFile = null;
    
    const btn = document.getElementById('start-evaluation-btn');
    if (btn) btn.disabled = true;
    
    const title = document.getElementById('upload-title');
    if (title) title.innerText = "Choose video file or Drag & Drop";
    
    const log = document.getElementById("evaluation-console-log");
    if (log) {
        log.innerHTML = `
          <div class="log-line">> RTO Artificial Intelligence System ready.</div>
          <div class="log-line">> Select candidate and upload footage to begin.</div>
        `;
    }
  }

  // OVERRIDE RESULT UI
  overrideAIResult(candidateId) {
    this.overrideCandidateId = candidateId;
    const cand = this.candidates.find(c => c.id === candidateId);
    if (!cand) return;

    document.getElementById("override-candidate-badge").innerText = cand.appNo;
    document.getElementById("override-ai-score").innerText = cand.score;
    document.getElementById("override-ai-decision").innerText = cand.status;
    const statusLower = (cand.status || "").trim().toLowerCase();
    let badgeClass = "badge-success";
    if (statusLower === "failed") badgeClass = "badge-danger";
    else if (statusLower === "pending" || statusLower === "processing") badgeClass = "badge-warning";
    document.getElementById("override-ai-decision").className = `badge ${badgeClass}`;
    document.getElementById("override-ai-confidence").innerText = (cand.aiConfidence || 0) + "%";
    document.getElementById("override-remarks").value = cand.officerRemarks;
    
    this.overrideStatus = cand.status;
    this.updateOverrideButtons();

    const vList = document.getElementById("override-violations-summary-list");
    vList.innerHTML = "";
    if (!cand.violations || cand.violations.length === 0) {
      vList.innerHTML = `<div style="font-size:0.85rem; color:var(--text-muted);">No violations detected.</div>`;
    } else {
      cand.violations.forEach(v => {
        vList.innerHTML += `
          <div style="padding:10px; border:1px solid var(--border-color); border-radius:var(--radius-sm); font-size:0.8rem; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong>${v.name}</strong><br>
              <span style="color:var(--text-muted)">Time: ${v.time} • Severity: ${v.severity}</span>
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
      status: this.overrideStatus,
      eligibility: this.overrideStatus === "Passed" ? "Eligible" : "Retest Required",
      officerRemarks: document.getElementById("override-remarks").value,
      officerApproved: true,
      officerName: "Inspector K. Raghavan",
      testDate: new Date().toISOString().split('T')[0]
    };

    if (this.overrideStatus === "Failed" && !cand.retestDate) {
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

  async publishCandidateResult(candidateId) {
    const cand = this.candidates.find(c => c.id === candidateId);
    if (!cand) return;

    const remarksEl = document.getElementById("admin-candidate-assessment-remarks");
    const officerRemarks = remarksEl ? remarksEl.value : cand.officerRemarks;

    const modified = {
      officerRemarks,
      officerApproved: true,
      officerName: cand.officerName || "Inspector K. Raghavan",
      testDate: new Date().toISOString().split('T')[0]
    };

    try {
      if (useFirebase && db) {
        await fb.updateDoc(fb.doc(db, "candidates", candidateId), modified);
      } else {
        const idx = this.candidates.findIndex(x => x.id === candidateId);
        if (idx >= 0) {
          this.candidates[idx] = { ...this.candidates[idx], ...modified };
          this.saveOfflineFallback();
        }
      }

      await this.addNotification("Result Published", `Final result published for candidate ${cand.name} (${cand.appNo}).`, "info");
      alert("Final result published and persisted.");
      await this.fetchData();
      this.renderAdminCandidateProfile();
    } catch (err) {
      console.error(err);
    }
  }

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

  toggleSidebar() {
    const sidebar = document.getElementById("app-sidebar");
    sidebar.classList.toggle("mobile-open");
  }
}

const appInstance = new SmartDriveApp();
window.onload = () => appInstance.init();
window.app = appInstance; // Bind globally for HTML event handlers