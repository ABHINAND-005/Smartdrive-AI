/**
 * SmartDrive AI - App Logic Engine (Firebase Cloud Firestore Ingested)
 * Handles State management, Simulation, Chart generation, AI Chatbot, Localization
 */

// ==========================================
// FIREBASE CONFIGURATION
// ==========================================
// Paste your Firebase Project web application configuration details here:
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
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

const BACKUP_CANDIDATES = [
  {
    id: "1",
    name: "Abhinand S",
    appNo: "APP-2026-001",
    dob: "2000-01-01",
    llNo: "KL-14/10452/2026",
    mobile: "9447201045",
    email: "abhinand.s@gmail.com",
    testDate: "2026-06-08",
    score: 88,
    aiConfidence: 96.5,
    status: "Passed",
    eligibility: "Eligible",
    officerRemarks: "Candidate demonstrates stable lane behavior and vehicle control. All minimal boundary touches corrected swiftly. Approved.",
    officerName: "Inspector K. Raghavan",
    officerApproved: true,
    driverRating: "Safe Driver",
    driverRatingDesc: "Candidate shows high vehicle control stability and defensive driving habits.",
    strengths: ["Maintains accurate centering inside test lane grid", "Smooth steering wheel movement during the curve", "Correct indicator engagement prior to turning"],
    weaknesses: ["Slight delay in restoring steering output after parking merge"],
    retestReadiness: 92,
    retestDate: "",
    violations: [
      {
        name: "Lane Boundary Touch",
        severity: "Warning",
        time: 14,
        description: "Left front tire breached yellow guideline coordinates temporarily during the curve loop.",
        x: 210, y: 90
      }
    ]
  },
  {
    id: "2",
    name: "Meera Nair",
    appNo: "APP-2026-002",
    dob: "1998-05-15",
    llNo: "KL-14/09845/2026",
    mobile: "9845620145",
    email: "meera.nair@yahoo.com",
    testDate: "2026-06-07",
    score: 45,
    aiConfidence: 92.4,
    status: "Failed",
    eligibility: "Retest Required",
    officerRemarks: "Critical boundaries crossed twice on left corners. Engine stalled in box parking grid. Retest recommended after mandatory road practice.",
    officerName: "Inspector K. Raghavan",
    officerApproved: true,
    driverRating: "Risky Driver",
    driverRatingDesc: "Frequent boundary drifts and engine stalls show insufficient maneuver practice.",
    strengths: ["Proper seatbelt wear and look-around scans verified"],
    weaknesses: ["Crossed outer boundary lines during tight turns", "Improper brake balance control resulting in vehicle stall"],
    retestReadiness: 48,
    retestDate: "2026-06-15",
    violations: [
      {
        name: "Lane Boundary Touch",
        severity: "Warning",
        time: 8,
        description: "Left tire crossed lateral limits at 8s.",
        x: 100, y: 160
      },
      {
        name: "Vehicle Stall",
        severity: "Critical",
        time: 18,
        description: "Vehicle remained stationary with zero engine speed in parking grid for 7 seconds.",
        x: 300, y: 130
      },
      {
        name: "Wrong Indicator Usage",
        severity: "Warning",
        time: 25,
        description: "Turned into exit lane without activating side indicators.",
        x: 280, y: 140
      }
    ]
  },
  {
    id: "3",
    name: "Rahul K",
    appNo: "APP-2026-003",
    dob: "2001-11-20",
    llNo: "KL-14/11054/2026",
    mobile: "9048756321",
    email: "rahul.k@outlook.com",
    testDate: "2026-06-09",
    score: 95,
    aiConfidence: 98.2,
    status: "Passed",
    eligibility: "Eligible",
    officerRemarks: "Flawless boundary scores. Perfect reverse parking execution.",
    officerName: "Inspector A. Prasad",
    officerApproved: true,
    driverRating: "Safe Driver",
    driverRatingDesc: "Superior coordinate alignment and timely signaling alerts.",
    strengths: ["Zero boundary drifts logged", "Flawless lane docking", "Immediate indicator transitions"],
    weaknesses: [],
    retestReadiness: 98,
    retestDate: "",
    violations: []
  },
  {
    id: "4",
    name: "Sneha Joseph",
    appNo: "APP-2026-004",
    dob: "1999-08-30",
    llNo: "KL-14/08451/2026",
    mobile: "8596041235",
    email: "sneha.j@gmail.com",
    testDate: "2026-06-05",
    score: 62,
    aiConfidence: 94.0,
    status: "Failed",
    eligibility: "Retest Required",
    officerRemarks: "Overspeeding in curves. Retest scheduled.",
    officerName: "Inspector A. Prasad",
    officerApproved: true,
    driverRating: "Average Driver",
    driverRatingDesc: "General stability matches standard thresholds, but speed limits breached.",
    strengths: ["Accurate reverse path tracking lines"],
    weaknesses: ["Breached speed limits on turns"],
    retestReadiness: 65,
    retestDate: "2026-06-12",
    violations: [
      {
        name: "Overspeeding",
        severity: "Warning",
        time: 12,
        description: "Exceeded 20 km/h limit in turn radius.",
        x: 100, y: 100
      },
      {
        name: "Unsafe Turn",
        severity: "Warning",
        time: 22,
        description: "Turned curve with excessive steering momentum.",
        x: 380, y: 90
      }
    ]
  }
];

class SmartDriveApp {
  constructor() {
    this.currentTheme = "light";
    this.currentLang = "en";
    this.currentUser = null;
    this.currentRole = null;
    this.candidates = [];
    this.auditLogs = [];
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

    // Dynamically load page template fragments
    await this.loadTemplates();

    this.initMockPath();

    // Initialize Firebase
    await this.initFirebase();

    // Fetch initial database records
    await this.fetchData();

    this.renderNotifications();
    this.renderAuditLogs();
    
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
      { id: "screen-candidate-video-review", path: "pages/candidate-video-review.html" },
      { id: "screen-candidate-feedback", path: "pages/candidate-feedback.html" },
      { id: "screen-candidate-eligibility", path: "pages/candidate-eligibility.html" },
      { id: "screen-candidate-verification", path: "pages/candidate-verification.html" },
      { id: "screen-candidate-retest", path: "pages/candidate-retest.html" },
      { id: "screen-admin-dashboard", path: "pages/admin-dashboard.html" },
      { id: "screen-admin-candidates", path: "pages/admin-candidates.html" },
      { id: "screen-admin-video-evaluation", path: "pages/admin-video-evaluation.html" },
      { id: "screen-admin-result-override", path: "pages/admin-result-override.html" },
      { id: "screen-admin-reports-analytics", path: "pages/admin-reports-analytics.html" },
      { id: "screen-admin-audit-logs", path: "pages/admin-audit-logs.html" },
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
        // Fetch candidates collection
        const candSnap = await fb.getDocs(fb.collection(db, "candidates"));
        this.candidates = [];
        candSnap.forEach(d => {
          this.candidates.push({ id: d.id, ...d.data() });
        });

        // Seed Firestore if it is completely empty
        if (this.candidates.length === 0) {
          console.log("Cloud database empty. Seeding initial candidate data...");
          for (const c of BACKUP_CANDIDATES) {
            await fb.setDoc(fb.doc(db, "candidates", c.id), c);
          }
          this.candidates = BACKUP_CANDIDATES;
        }

        // Fetch logs collection
        const logSnap = await fb.getDocs(fb.collection(db, "audit_logs"));
        this.auditLogs = [];
        logSnap.forEach(d => {
          this.auditLogs.push(d.data());
        });
        // Sort descending locally
        this.auditLogs.sort((a,b) => new Date(b.time) - new Date(a.time));

        // Seed default logs if empty
        if (this.auditLogs.length === 0) {
          const defaultLogs = [
            { time: "2026-06-08 18:32:05", action: "Officer Authenticated", user: "rto.officer.01", ip: "192.168.1.45", detail: "Successful portal login session." },
            { time: "2026-06-08 17:15:12", action: "Result Published", user: "rto.officer.01", ip: "192.168.1.45", detail: "Published Passed result for APP-2026-001." }
          ];
          for (const l of defaultLogs) {
            await fb.addDoc(fb.collection(db, "audit_logs"), l);
          }
          this.auditLogs = defaultLogs;
        }

        // Fetch notifications collection
        const notifySnap = await fb.getDocs(fb.collection(db, "notifications"));
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
          for (const n of defaultNotify) {
            const temp = { ...n, id: Date.now() };
            await fb.setDoc(fb.doc(db, "notifications", String(temp.id)), temp);
          }
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

    if (screenId !== "candidate-video-review" && this.isPlaying) {
      this.togglePlay();
    }

    if (screenId === "candidate-dashboard") {
      document.getElementById("current-screen-title").innerText = this.currentLang === "en" ? "User Dashboard" : "ഉപയോക്തൃ ഡാഷ്‌ബോർഡ്";
      this.renderCandidateDashboard();
    } else if (screenId === "candidate-results") {
      document.getElementById("current-screen-title").innerText = this.currentLang === "en" ? "Driving Test Results" : "പരീക്ഷാ ഫലം";
      this.renderCandidateResults();
    } else if (screenId === "candidate-video-review") {
      document.getElementById("current-screen-title").innerText = this.currentLang === "en" ? "Driving Test Video Review" : "വീഡിയോ അവലോകനം";
      this.initVideoReview();
    } else if (screenId === "candidate-feedback") {
      document.getElementById("current-screen-title").innerText = this.currentLang === "en" ? "AI Driving Analysis" : "AI അഭിപ്രായം";
      this.renderCandidateFeedback();
    } else if (screenId === "candidate-eligibility") {
      document.getElementById("current-screen-title").innerText = this.currentLang === "en" ? "License Eligibility" : "ലൈസൻസ് യോഗ്യത";
      this.renderCandidateEligibility();
    } else if (screenId === "candidate-retest") {
      document.getElementById("current-screen-title").innerText = this.currentLang === "en" ? "Schedule Retest Slot" : "റീടെസ്റ്റ് ഷെഡ്യൂൾ";
      this.renderRetestBooking();
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
    } else if (screenId === "admin-audit-logs") {
      document.getElementById("current-screen-title").innerText = "System Cryptographic Logs";
      this.renderAuditLogs();
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

    await this.fetchData();

    const user = this.candidates.find(c => c.appNo === appNo && c.dob === dob);
    if (user) {
      this.currentUser = user;
      this.currentRole = "candidate";
      this.setupDashboardView();
      await this.addAuditLog("Candidate Authenticated", user.name, "APP Login session.");
      this.showScreen("app-layout");
      this.route("candidate-dashboard");
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
      this.setupDashboardView();
      await this.addAuditLog("Officer Authenticated", "Officer K. Raghavan", "Secure admin session initialized.");
      this.showScreen("app-layout");
      this.route("admin-dashboard");
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

  // AUDIT LOG SYSTEM
  renderAuditLogs() {
    const tableBody = document.getElementById("admin-audit-logs-table");
    if (!tableBody) return;

    tableBody.innerHTML = "";
    this.auditLogs.forEach(l => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td style="font-family:monospace; font-size:0.8rem;">${l.time}</td>
        <td><strong style="color:var(--primary)">${l.action}</strong></td>
        <td>${l.user}</td>
        <td style="font-family:monospace;">${l.ip}</td>
        <td style="color:var(--text-sub); font-size:0.85rem;">${l.detail}</td>
      `;
      tableBody.appendChild(row);
    });
  }

  async addAuditLog(action, user, detail) {
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace('T', ' ');
    const ip = "192.168.1." + Math.floor(Math.random() * 254);
    const logObj = { time: timestamp, action, user, ip, detail };

    if (useFirebase && db) {
      try {
        await fb.addDoc(fb.collection(db, "audit_logs"), logObj);
        await this.fetchData();
        this.renderAuditLogs();
      } catch (err) {
        console.error(err);
      }
    } else {
      this.auditLogs.unshift(logObj);
      this.saveOfflineFallback();
      this.renderAuditLogs();
    }
  }

  async clearAuditLogs() {
    if (useFirebase && db) {
      try {
        const snap = await fb.getDocs(fb.collection(db, "audit_logs"));
        snap.forEach(async (d) => {
          await fb.deleteDoc(fb.doc(db, "audit_logs", d.id));
        });
        this.auditLogs = [];
        await this.addAuditLog("Audit Logs Cleared", "rto.officer.01", "Officer cleared database logs.");
      } catch (err) {
        console.error(err);
      }
    } else {
      this.auditLogs = [];
      await this.addAuditLog("Audit Logs Cleared (Offline)", "rto.officer.01", "Officer cleared simulation audit logs.");
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
      document.getElementById("db-retest-nav-btn").style.display = "none";
    } else {
      eligBg.className = "stat-icon bg-danger-light";
      document.getElementById("db-retest-nav-btn").style.display = "flex";
    }

    const circumference = 2 * Math.PI * 70;
    const offset = circumference - (user.score / 100) * circumference;
    const scoreCircleBar = document.getElementById("score-circle-bar");
    scoreCircleBar.style.strokeDashoffset = offset;
    scoreCircleBar.style.stroke = user.status === "Passed" ? "var(--success)" : "var(--danger)";

    const assessment = document.getElementById("db-score-assessment");
    if (user.score >= 80) assessment.innerText = "Safe Driving Performance";
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

  // VIDEO REVIEW PAGE (Simulation coordinates and timeline)
  initMockPath() {
    this.simulatedPath = [];
    
    for (let f = 0; f < 80; f++) {
      const progress = f / 80;
      const y = 280 - progress * 180;
      this.simulatedPath.push({ x: 100, y, v: 16, indicator: false });
    }

    for (let f = 0; f < 80; f++) {
      const progress = f / 80;
      const x = 100 + progress * 200;
      let y = 100;
      if (f + 80 >= 135 && f + 80 <= 145) {
        y = 85;
      }
      this.simulatedPath.push({ x, y, v: 12, indicator: progress > 0.6 });
    }

    for (let f = 0; f < 60; f++) {
      const progress = f / 60;
      const y = 100 + progress * 110;
      this.simulatedPath.push({ x: 300, y, v: 8, indicator: false });
    }

    for (let f = 0; f < 40; f++) {
      const progress = f / 40;
      const y = 210 - progress * 110;
      this.simulatedPath.push({ x: 300, y, v: -6, indicator: false });
    }

    for (let f = 0; f < 40; f++) {
      const progress = f / 40;
      const x = 300 + progress * 240;
      this.simulatedPath.push({ x, y: 100, v: 14, indicator: true });
    }
  }

  initVideoReview() {
    this.videoTime = 0;
    this.isPlaying = false;
    this.activeViolationIndex = -1;
    
    const container = document.getElementById("review-timeline-markers");
    container.innerHTML = "";
    
    const user = this.currentUser;
    user.violations.forEach((v, index) => {
      const marker = document.createElement("div");
      marker.className = `timeline-marker ${v.severity === 'Critical' ? 'critical' : 'warning'}`;
      const percentage = (v.time / this.videoDuration) * 100;
      marker.style.left = `${percentage}%`;
      marker.innerHTML = `<span class="timeline-marker-tooltip">${v.name} (00:${v.time.toString().padStart(2, '0')})</span>`;
      marker.onclick = (e) => {
        e.stopPropagation();
        this.videoTime = v.time;
        this.activeViolationIndex = index;
        this.updateScrubber();
        this.drawReviewFrame();
      };
      container.appendChild(marker);
    });

    this.updateScrubber();
    this.drawReviewFrame();
  }

  togglePlay() {
    const btn = document.getElementById("review-play-btn");
    if (this.isPlaying) {
      clearInterval(this.playInterval);
      btn.innerHTML = `<i class="fa-solid fa-play"></i>`;
      this.isPlaying = false;
    } else {
      btn.innerHTML = `<i class="fa-solid fa-pause"></i>`;
      this.isPlaying = true;
      
      this.playInterval = setInterval(() => {
        this.videoTime += 0.1;
        if (this.videoTime >= this.videoDuration) {
          this.videoTime = this.videoDuration;
          this.togglePlay();
        }
        this.updateScrubber();
        this.drawReviewFrame();
      }, 100);
    }
  }

  resetVideo() {
    if (this.isPlaying) this.togglePlay();
    this.videoTime = 0;
    this.activeViolationIndex = -1;
    this.updateScrubber();
    this.drawReviewFrame();
  }

  updateScrubber() {
    const percentage = (this.videoTime / this.videoDuration) * 100;
    document.getElementById("review-progress-bar").style.width = `${percentage}%`;
    document.getElementById("review-scrubber-handle").style.left = `${percentage}%`;
    
    const mins = Math.floor(this.videoTime / 60);
    const secs = Math.floor(this.videoTime % 60);
    document.getElementById("review-time-display").innerText = 
      `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')} / 00:30`;
  }

  handleScrub(e) {
    const bar = document.getElementById("review-scrubber");
    const rect = bar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    this.videoTime = percentage * this.videoDuration;
    if (this.videoTime < 0) this.videoTime = 0;
    if (this.videoTime > this.videoDuration) this.videoTime = this.videoDuration;
    
    this.updateScrubber();
    this.drawReviewFrame();
  }

  drawReviewFrame() {
    const canvas = document.getElementById("review-canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = this.currentTheme === "dark" ? "#0b0f19" : "#f1f5f9";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 26;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = this.currentTheme === "dark" ? "#1e293b" : "#cbd5e1";
    
    ctx.beginPath();
    ctx.moveTo(100, 280);
    ctx.lineTo(100, 100);
    ctx.lineTo(300, 100);
    ctx.lineTo(300, 220);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(300, 100);
    ctx.lineTo(540, 100);
    ctx.stroke();

    ctx.lineWidth = 1;
    ctx.strokeStyle = "#fbbf24";
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.rect(80, 75, 480, 230);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.lineWidth = 4;
    ctx.strokeStyle = "var(--success)";
    ctx.beginPath();
    ctx.moveTo(85, 280);
    ctx.lineTo(115, 280);
    ctx.stroke();

    ctx.strokeStyle = "var(--primary)";
    ctx.beginPath();
    ctx.moveTo(540, 85);
    ctx.lineTo(540, 115);
    ctx.stroke();

    const frameIndex = Math.min(
      Math.floor((this.videoTime / this.videoDuration) * (this.simulatedPath.length - 1)),
      this.simulatedPath.length - 1
    );
    const vehicle = this.simulatedPath[frameIndex];

    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(59, 130, 246, 0.4)";
    ctx.beginPath();
    ctx.moveTo(100, 280);
    for (let i = 0; i <= frameIndex; i++) {
      ctx.lineTo(this.simulatedPath[i].x, this.simulatedPath[i].y);
    }
    ctx.stroke();

    const user = this.currentUser;
    let hudAlert = document.getElementById("review-hud-alert");
    hudAlert.style.display = "none";
    
    user.violations.forEach((v, index) => {
      ctx.fillStyle = v.severity === "Critical" ? "rgba(239, 68, 68, 0.3)" : "rgba(245, 158, 11, 0.3)";
      ctx.strokeStyle = v.severity === "Critical" ? "#ef4444" : "#f59e0b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(v.x, v.y, 20, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = v.severity === "Critical" ? "#ef4444" : "#f59e0b";
      ctx.beginPath();
      ctx.arc(v.x, v.y, 5, 0, 2 * Math.PI);
      ctx.fill();

      if (Math.abs(this.videoTime - v.time) < 1.5) {
        hudAlert.innerText = `${v.name.toUpperCase()} DETECTED`;
        hudAlert.style.display = "block";
        hudAlert.className = `hud-pill ${v.severity === 'Critical' ? 'danger' : 'warning'}`;
        this.activeViolationIndex = index;
      }
    });

    ctx.fillStyle = "var(--primary)";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "rgba(37, 99, 235, 0.5)";
    ctx.beginPath();
    ctx.arc(vehicle.x, vehicle.y, 8, 0, 2 * Math.PI);
    ctx.fill();
    ctx.shadowBlur = 0;

    if (vehicle.indicator && Math.floor(this.videoTime * 5) % 2 === 0) {
      ctx.fillStyle = "#eab308";
      ctx.beginPath();
      ctx.arc(vehicle.x + 12, vehicle.y, 3, 0, 2 * Math.PI);
      ctx.fill();
    }

    document.getElementById("review-hud-velocity").innerText = `SPEED: ${Math.abs(vehicle.v)} km/h`;

    this.renderSelectedViolationInfo();
    this.drawEvidenceScreenshot(vehicle.x, vehicle.y);
  }

  drawEvidenceScreenshot(vx, vy) {
    const canvas = document.getElementById("evidence-canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(16, 185, 129, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();

    ctx.fillStyle = "#4ade80";
    ctx.font = "10px monospace";
    ctx.fillText("CAM_02 [CAB_FEED]", 10, 20);
    ctx.fillText("GPS_LOCK: OK", 10, 35);
    ctx.fillText(`X:${vx.toFixed(1)} Y:${vy.toFixed(1)}`, 10, 50);

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 40, 0, Math.PI, true);
    ctx.stroke();

    const mins = Math.floor(this.videoTime / 60);
    const secs = Math.floor(this.videoTime % 60);
    document.getElementById("review-evidence-timestamp").innerText = 
      `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  renderSelectedViolationInfo() {
    const details = document.getElementById("review-selected-violation-details");
    const user = this.currentUser;
    
    if (this.activeViolationIndex >= 0 && user.violations[this.activeViolationIndex]) {
      const v = user.violations[this.activeViolationIndex];
      details.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <h4 class="${v.severity === 'Critical' ? 'text-danger' : 'text-warning'}" style="font-size:1.05rem;">${v.name}</h4>
          <span class="badge ${v.severity === 'Critical' ? 'badge-danger' : 'badge-warning'}">${v.severity}</span>
        </div>
        <p style="font-size:0.85rem; color:var(--text-sub); line-height:1.5; margin-bottom:10px;">
          ${v.description}
        </p>
        <div style="font-size:0.8rem; font-family:monospace; color:var(--text-muted);">
          Coordinates: X:${v.x} Y:${v.y}<br>
          Frame Trigger: s${v.time}
        </div>
      `;
    } else {
      details.innerHTML = `
        <p style="font-size:0.9rem; color:var(--text-sub);">Select a violation from the timeline scrubber or play the video to see active boundary overlays.</p>
      `;
    }
  }

  // AI FEEDBACK AND RECOMMENDATIONS SCREEN
  renderCandidateFeedback() {
    const user = this.currentUser;
    document.getElementById("feedback-driver-rating").innerText = user.driverRating;
    document.getElementById("feedback-driver-rating-desc").innerText = user.driverRatingDesc;
    
    const strengthsList = document.getElementById("feedback-strengths");
    strengthsList.innerHTML = "";
    user.strengths.forEach(s => {
      strengthsList.innerHTML += `<li>${s}</li>`;
    });

    const weaknessesList = document.getElementById("feedback-weaknesses");
    weaknessesList.innerHTML = "";
    user.weaknesses.forEach(w => {
      weaknessesList.innerHTML += `<li>${w}</li>`;
    });

    document.getElementById("feedback-readiness-val").innerText = user.retestReadiness + "%";
    document.getElementById("feedback-readiness-bar").style.width = user.retestReadiness + "%";

    document.getElementById("feedback-personalized-text").innerText = 
      user.status === "Passed" 
        ? `"Your overall score is excellent. Ensure you use the side mirrors rather than relying exclusively on the back-facing camera to avoid manual remark overrides. Maintain indicator status for at least 3 seconds before executing maneuvers."`
        : `"Retest readiness index requires target values above 80% to schedule slot booking. Focus on lateral path controls and parallel reverse docking maneuvers prior to reappearing."`;
  }

  // LICENSE ELIGIBILITY SCREEN
  renderCandidateEligibility() {
    const user = this.currentUser;
    document.getElementById("cert-name").innerText = user.name;
    document.getElementById("cert-app-no").innerText = user.appNo;
    document.getElementById("cert-ll-no").innerText = user.llNo;
    document.getElementById("cert-score").innerText = `${user.score} / 100`;
    
    const statusText = document.getElementById("cert-status");
    const retestText = document.getElementById("cert-retest-status");

    if (user.status === "Passed") {
      statusText.innerText = "APPROVED FOR LICENSE";
      statusText.style.color = "var(--success)";
      retestText.innerText = "No Retest Required";
      retestText.style.color = "var(--text-main)";
    } else {
      statusText.innerText = "NOT ELIGIBLE (FAILED)";
      statusText.style.color = "var(--danger)";
      retestText.innerText = `Retest Scheduled: ${user.retestDate}`;
      retestText.style.color = "var(--danger)";
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

  // DOCUMENT VERIFICATION SCREEN
  handleDocUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const docType = document.getElementById("verification-doc-type").value;
    
    this.showGeneralNoticeModal(
      `<i class="fa-solid fa-spinner" style="animation: spin 1s infinite; color:var(--primary)"></i>`,
      "OCR Verification in progress",
      `Parsing layout boundaries for ${docType} document. Analyzing cryptographic watermark checks...`
    );

    setTimeout(async () => {
      this.closeGeneralNoticeModal();
      const list = document.getElementById("verification-doc-list");
      const newItem = document.createElement("div");
      newItem.style = "padding:16px; border:1px solid var(--border-color); border-radius:var(--radius-md); display:flex; justify-content:space-between; align-items:center; animation:fadeIn 0.3s ease;";
      newItem.innerHTML = `
        <div style="display:flex; gap:14px; align-items:center;">
          <i class="fa-solid fa-file-signature text-primary" style="font-size:1.5rem;"></i>
          <div>
            <h4 style="font-size:0.9rem; font-weight:700;">Uploaded ${docType} Proof</h4>
            <span style="font-size:0.75rem; color:var(--text-muted);">Uploaded Just now • Verified by AI OCR</span>
          </div>
        </div>
        <span class="badge badge-success">VERIFIED</span>
      `;
      list.appendChild(newItem);
      await this.addNotification("Identity Verified", `OCR parser verified your uploaded ${docType} document successfully.`, "success");
    }, 2000);
  }

  // RETEST SLOT BOOKING SCREEN
  renderRetestBooking() {
    const calendar = document.querySelector(".calendar-grid");
    const cells = calendar.querySelectorAll(".calendar-cell");
    cells.forEach(c => c.remove());
    
    for (let day = 1; day <= 30; day++) {
      const cell = document.createElement("div");
      const isSunday = (day % 7 === 0);
      const isPast = day < 15;

      if (isPast || isSunday) {
        cell.className = "calendar-cell muted";
      } else {
        cell.className = "calendar-cell available";
        cell.onclick = () => {
          calendar.querySelectorAll(".calendar-cell").forEach(c => c.classList.remove("active"));
          cell.classList.add("active");
          document.getElementById("retest-selected-date-lbl").innerText = `Booking Retest Date: ${day} June 2026`;
        };
      }
      cell.innerText = day;
      calendar.appendChild(cell);
    }
  }

  selectSlot(btn) {
    const container = document.getElementById("retest-slots-container");
    container.querySelectorAll(".btn").forEach(b => b.className = "btn btn-secondary");
    btn.className = "btn btn-secondary active";
    btn.style.borderColor = "var(--primary)";
  }

  async bookRetest() {
    const selectedDate = document.getElementById("retest-selected-date-lbl").innerText;
    if (selectedDate.includes("Select a date")) {
      alert("Please select an available date cell on the calendar grid first.");
      return;
    }

    const user = this.currentUser;
    
    this.showGeneralNoticeModal(
      `<i class="fa-solid fa-circle-check text-success"></i>`,
      "Retest slot confirmed",
      `Your booking request for ${selectedDate} has been locked. RTO inspector allocated.`
    );

    await this.addNotification("Retest Scheduled", `Retest slot scheduled for ${selectedDate.replace('Booking Retest Date: ', '')}.`, "warning");
    await this.addAuditLog("Retest Booked", user.name, `Scheduled slot booking on ${selectedDate.replace('Booking Retest Date: ', '')}`);
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

    const rate = ((passed / (passed + failed || 1)) * 100).toFixed(1) + "%";
    document.getElementById("admin-metric-passrate").innerText = rate;
    document.getElementById("admin-metric-passrate-bar").style.width = rate;

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
    document.getElementById("cand-app-no").value = "APP-2026-" + String(this.candidates.length + 1).padStart(3, '0');
    document.getElementById("cand-dob").value = "2000-01-01";
    document.getElementById("cand-ll-no").value = "KL-14/" + Math.floor(Math.random() * 20000 + 10000) + "/2026";
    document.getElementById("cand-mobile").value = "9447" + Math.floor(Math.random() * 900000 + 100000);
    document.getElementById("cand-email").value = "";
    document.getElementById("cand-test-date").value = new Date().toISOString().split('T')[0];

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

    try {
      if (useFirebase && db) {
        if (id) {
          const index = this.candidates.findIndex(c => c.id === id);
          if (index >= 0) {
            const candRef = fb.doc(db, "candidates", id);
            await fb.updateDoc(candRef, { name, appNo, dob, llNo, mobile, email, testDate });
          }
          await this.addAuditLog("Candidate Edited", "rto.officer.01", `Modified registry details for candidate name: ${name}`);
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
          await this.addAuditLog("Candidate Registered", "rto.officer.01", `New registry record added: ${name}`);
        }
      } else {
        // Fallback
        if (id) {
          const index = this.candidates.findIndex(c => c.id === id);
          if (index >= 0) {
            this.candidates[index] = { ...this.candidates[index], name, appNo, dob, llNo, mobile, email, testDate };
            this.saveOfflineFallback();
          }
          await this.addAuditLog("Candidate Edited (Offline)", "rto.officer.01", `Modified registry details for candidate name: ${name}`);
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
          await this.addAuditLog("Candidate Registered (Offline)", "rto.officer.01", `New registry record added: ${name}`);
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
        await this.addAuditLog("Candidate Deleted", "rto.officer.01", `Deleted candidate registry record: ${c ? c.name : id}`);
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

      await this.addAuditLog("Result Published", "rto.officer.01", `Published final ${this.overrideStatus} result for candidate: ${cand.name} (${cand.appNo})`);
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
    if (this.charts.violations) this.charts.violations.destroy();
    if (this.charts.reasons) this.charts.reasons.destroy();

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

    const ctx2 = document.getElementById("chart-violations-freq").getContext("2d");
    this.charts.violations = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: ['Lane Boundary Touch', 'Vehicle Stall', 'Improper Reverse', 'Indicator Miss', 'Overspeeding', 'Unsafe Turn'],
        datasets: [{
          label: 'Instances Logged',
          data: [42, 28, 12, 35, 14, 18],
          backgroundColor: 'rgba(59, 130, 246, 0.85)',
          borderColor: 'var(--primary)',
          borderWidth: 1
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false
      }
    });

    const ctx3 = document.getElementById("chart-failurereasons-pie").getContext("2d");
    this.charts.reasons = new Chart(ctx3, {
      type: 'doughnut',
      data: {
        labels: ['Boundary Line Touches', 'Parking Dock Stalls', 'Improper Reverses', 'Excessive Speed'],
        datasets: [{
          data: [45, 25, 20, 10],
          backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }

  showHeatspotInfo(zone, detail, stats) {
    const info = document.getElementById("heatmap-info-display");
    info.innerHTML = `
      <strong>Zone: ${zone}</strong><br>
      <span style="color:var(--danger)">Failure Stats: ${stats}</span><br>
      <span style="font-size:0.8rem; color:var(--text-sub);">${detail}</span>
    `;
  }

  renderProfileSettings() {
    const user = this.currentUser;
    document.getElementById("profile-edit-name").value = user.name;
    document.getElementById("profile-edit-mobile").value = user.mobile || "+91 9447201045";
    document.getElementById("profile-edit-email").value = user.email || "candidate@gov.in";
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
