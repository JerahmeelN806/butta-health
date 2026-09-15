import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Download,
  FileCheck2,
  FlaskConical,
  HeartPulse,
  Info,
  Leaf,
  Lightbulb,
  LogOut,
  Pill,
  Plus,
  Printer,
  Search,
  ShieldCheck,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import gsap from "gsap";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { companionTips, navItems, presets } from "./data";
import { PublicExperience } from "./components/PublicExperience";
import { AnimatedSelect } from "./components/AnimatedSelect";
import { ObservationComposer } from "./components/ObservationComposer";
import { ApiError, buttaApi, setSessionExpiredHandler, type AppUser, type HealthProfile, type HealthProfileInput } from "./services/api";
import {
  clearDemoStorage,
  DEMO_AI_CONSENT_KEY,
  DEMO_PREFERENCES_KEY,
  DEMO_PROFILE_KEY,
  DEMO_SESSION_KEY,
} from "./services/demoStorage";
import { buildDoctorSummary, mockBackend, parseObservation } from "./services/mockApi";
import type {
  AiConsent,
  AiSafetyMetadata,
  DailyCheckIn,
  DashboardSnapshot,
  DoctorSummary,
  ExtractedRecord,
  HealthRecord,
  NotificationPreferences,
  RecordType,
  ViewId,
} from "./types";

const typeStyles: Record<RecordType, string> = {
  SYMPTOM: "border-emerald/25 bg-emerald/10 text-emerald",
  MEDICATION: "border-teal/25 bg-teal/10 text-teal",
  DIGESTIVE: "border-gold/40 bg-gold/15 text-[#725900]",
  DOCTOR_VISIT: "border-rust/25 bg-rust/10 text-rust",
  CHECK_IN: "border-teal/25 bg-teal/10 text-teal",
};

const statusStyles: Record<HealthRecord["status"], string> = {
  Confirmed: "border-emerald/20 bg-emerald/10 text-emerald",
  "Needs monitoring": "border-amber/25 bg-amber/10 text-amber",
  Prepared: "border-teal/20 bg-teal/10 text-teal",
};

const severityStyles: Record<HealthRecord["severity"], string> = {
  Mild: "border-emerald/20 bg-emerald/10 text-emerald",
  Moderate: "border-amber/25 bg-amber/10 text-amber",
  Severe: "border-rust/20 bg-rust/10 text-rust",
  "Not specified": "border-line bg-well text-muted",
};

const typeLabels: Record<RecordType, string> = {
  SYMPTOM: "Symptom",
  MEDICATION: "Medication",
  DIGESTIVE: "Digestive",
  DOCTOR_VISIT: "Doctor visit",
  CHECK_IN: "Check-in",
};

const filters: Array<RecordType | "ALL"> = ["ALL", "SYMPTOM", "MEDICATION", "DIGESTIVE", "DOCTOR_VISIT", "CHECK_IN"];

const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

function formatDate(value: string, mode: "short" | "long" = "short") {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(mode === "long" ? { year: "numeric" } : {}),
  }).format(new Date(value));
}

const emptyHealthProfile: HealthProfileInput = {
  dateOfBirth: null,
  sex: null,
  bloodGroup: null,
  allergies: [],
  existingConditions: [],
  currentMedications: [],
  emergencyContactName: null,
  emergencyContactPhone: null,
};

function toProfileInput(profile: HealthProfile | null): HealthProfileInput {
  if (!profile) return emptyHealthProfile;
  const { dateOfBirth, sex, bloodGroup, allergies, existingConditions, currentMedications, emergencyContactName, emergencyContactPhone } = profile;
  return { dateOfBirth, sex, bloodGroup, allergies, existingConditions, currentMedications, emergencyContactName, emergencyContactPhone };
}

function profileCompletion(user: AppUser, profile: HealthProfile | null) {
  const checks = [
    user.firstName,
    user.lastName,
    user.email,
    profile?.dateOfBirth,
    profile?.sex,
    profile?.bloodGroup,
    profile?.allergies.length,
    profile?.existingConditions.length,
    profile?.currentMedications.length,
    profile?.emergencyContactName,
    profile?.emergencyContactPhone,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const workspacePaths: Record<ViewId, string> = {
  dashboard: "/app/dashboard",
  profile: "/app/profile",
  capture: "/app/log-event",
  timeline: "/app/history",
  settings: "/app/settings",
  companion: "/app/companion",
  "doctor-prep": "/app/doctor-prep",
  "doctor-summary": "/app/doctor-summary",
};

function isWorkspacePath(pathname = window.location.pathname) {
  return pathname === "/app" || pathname.startsWith("/app/");
}

function viewFromPath(pathname = window.location.pathname): ViewId {
  const match = Object.entries(workspacePaths).find(([, path]) => path === pathname);
  return (match?.[0] as ViewId | undefined) || "dashboard";
}

function TypeBadge({ type }: { type: RecordType }) {
  return (
    <span className={`badge border ${typeStyles[type]}`} title={typeLabels[type]}>
      <span className="badge-dot" />
      <span>{typeLabels[type]}</span>
    </span>
  );
}

function StatusBadge({ status }: { status: HealthRecord["status"] }) {
  return (
    <span className={`badge border ${statusStyles[status]}`} title={status}>
      <span className="badge-dot" />
      <span>{status}</span>
    </span>
  );
}

function SeverityBadge({ severity }: { severity: HealthRecord["severity"] }) {
  return (
    <span className={`badge border ${severityStyles[severity]}`} title={`${severity} severity`}>
      <span>{severity}</span>
    </span>
  );
}

function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [restoringSession, setRestoringSession] = useState(isWorkspacePath);
  const [sessionNotice, setSessionNotice] = useState("");

  // A 401 on any authenticated call means the JWT cookie died server-side
  // (expiry or invalidation) mid-session. Without this the UI would keep
  // showing the workspace as if still logged in until the next full reload.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser((current) => {
        if (!current || current.demo) return current;
        window.localStorage.removeItem(DEMO_SESSION_KEY);
        window.history.pushState({}, "", "/signin");
        setSessionNotice("Your session expired. Please sign in again.");
        return null;
      });
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  // Catches the case where the cookie expired while the tab was backgrounded
  // or the machine was asleep: re-validate as soon as the tab is focused again
  // instead of waiting for the next action to fail.
  useEffect(() => {
    function revalidateOnFocus() {
      if (document.visibilityState !== "visible") return;
      if (!user || user.demo) return;
      buttaApi.me().catch(() => undefined);
    }
    document.addEventListener("visibilitychange", revalidateOnFocus);
    window.addEventListener("focus", revalidateOnFocus);
    return () => {
      document.removeEventListener("visibilitychange", revalidateOnFocus);
      window.removeEventListener("focus", revalidateOnFocus);
    };
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    async function restoreWorkspaceSession() {
      if (!isWorkspacePath()) {
        setRestoringSession(false);
        return;
      }

      const storedDemo = window.localStorage.getItem(DEMO_SESSION_KEY);
      if (storedDemo) {
        try {
          const demoUser = JSON.parse(storedDemo) as AppUser;
          if (demoUser.demo && !cancelled) setUser(demoUser);
          setRestoringSession(false);
          return;
        } catch {
          window.localStorage.removeItem(DEMO_SESSION_KEY);
        }
      }

      try {
        const { user: restoredUser } = await buttaApi.me();
        if (!cancelled) setUser(restoredUser);
      } catch {
        if (!cancelled && isWorkspacePath()) {
          window.history.replaceState({}, "", "/signin");
        }
      } finally {
        if (!cancelled) setRestoringSession(false);
      }
    }

    void restoreWorkspaceSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function handleHistoryNavigation() {
      if (!isWorkspacePath()) {
        setRestoringSession(false);
        setUser(null);
        return;
      }
      if (user) return;

      setRestoringSession(true);
      const storedDemo = window.localStorage.getItem(DEMO_SESSION_KEY);
      if (storedDemo) {
        try {
          const demoUser = JSON.parse(storedDemo) as AppUser;
          if (demoUser.demo && !cancelled) setUser(demoUser);
          if (!cancelled) setRestoringSession(false);
          return;
        } catch {
          window.localStorage.removeItem(DEMO_SESSION_KEY);
        }
      }

      try {
        const { user: restoredUser } = await buttaApi.me();
        if (!cancelled) setUser(restoredUser);
      } catch {
        if (!cancelled) window.history.replaceState({}, "", "/signin");
      } finally {
        if (!cancelled) setRestoringSession(false);
      }
    }

    const onPopState = () => void handleHistoryNavigation();
    window.addEventListener("popstate", onPopState);
    return () => {
      cancelled = true;
      window.removeEventListener("popstate", onPopState);
    };
  }, [user]);

  function enterWorkspace(nextUser: AppUser) {
    if (nextUser.demo) window.localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(nextUser));
    else window.localStorage.removeItem(DEMO_SESSION_KEY);
    setSessionNotice("");
    setUser(nextUser);
  }

  async function signOut() {
    if (user && !user.demo) await buttaApi.logout().catch(() => undefined);
    window.localStorage.removeItem(DEMO_SESSION_KEY);
    window.history.pushState({}, "", "/");
    setSessionNotice("");
    setUser(null);
  }

  if (restoringSession) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper text-teal" role="status" aria-label="Restoring your session">
        <Leaf className="animate-pulse" size={34} fill="currentColor" strokeWidth={1.4} />
      </div>
    );
  }

  if (!user) return <PublicExperience onEnter={enterWorkspace} notice={sessionNotice} />;

  return <HealthWorkspace user={user} onSignOut={signOut} />;
}

function HealthWorkspace({ user, onSignOut }: { user: AppUser; onSignOut: () => void }) {
  const [activeView, setActiveView] = useState<ViewId>(viewFromPath);
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordsError, setRecordsError] = useState("");
  const [recordsReload, setRecordsReload] = useState(0);
  const [dashboard, setDashboard] = useState<DashboardSnapshot | null>(null);
  const [todayCheckIn, setTodayCheckIn] = useState<DailyCheckIn | null>(null);
  const [checkInSaving, setCheckInSaving] = useState(false);
  const [checkInError, setCheckInError] = useState("");
  const [healthProfile, setHealthProfile] = useState<HealthProfile | null>(null);
  const [aiConsent, setAiConsent] = useState<AiConsent | null>(null);
  const [observation, setObservation] = useState(
    "I've had a slight headache since yesterday evening, and I felt a bit dizzy when standing up this morning.",
  );
  const [inputMode, setInputMode] = useState<"Typed" | "Voice" | "Preset">("Typed");
  const [extracted, setExtracted] = useState<ExtractedRecord | null>(null);
  const [extractionSafety, setExtractionSafety] = useState<AiSafetyMetadata | null>(null);
  const [educationalContext, setEducationalContext] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<RecordType | "ALL">("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [summary, setSummary] = useState<DoctorSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [insightRailOpen, setInsightRailOpen] = useState(false);
  const [pendingAttachmentIds, setPendingAttachmentIds] = useState<string[]>([]);
  const viewRef = useRef<HTMLDivElement | null>(null);

  function navigateView(nextView: ViewId) {
    const nextPath = workspacePaths[nextView];
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
    setActiveView(nextView);
    setInsightRailOpen(false);
  }

  useEffect(() => {
    const currentPath = window.location.pathname;
    if (currentPath === "/app" || !Object.values(workspacePaths).includes(currentPath)) {
      window.history.replaceState({}, "", workspacePaths.dashboard);
      setActiveView("dashboard");
    }

    const onPopState = () => {
      if (isWorkspacePath()) setActiveView(viewFromPath());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRecordsError("");

    const workspaceRequest = user.demo
      ? Promise.all([mockBackend.getRecords(), mockBackend.getTodayCheckIn()])
          .then(([events, checkIn]) => ({ events, checkIn, dashboard: null }))
      : Promise.all([
          buttaApi.getHealthEvents({ limit: 100 }),
          buttaApi.getDashboard(browserTimezone),
          buttaApi.getTodayCheckIn(browserTimezone),
        ]).then(([eventData, dashboardData, checkInData]) => ({
          events: eventData.events,
          dashboard: dashboardData.dashboard,
          checkIn: checkInData.checkIn,
        }));

    workspaceRequest
      .then((data) => {
        if (cancelled) return;
        setRecords(data.events);
        setDashboard(data.dashboard);
        setTodayCheckIn(data.checkIn);
        setSelectedIds(data.events.slice(0, 3).map((record) => record.id));
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setRecordsError(error instanceof Error ? error.message : "Your health events could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [recordsReload, user]);

  useEffect(() => {
    if (user.demo) {
      const demoProfile = window.localStorage.getItem(DEMO_PROFILE_KEY);
      const fallbackProfile: HealthProfileInput = {
        ...emptyHealthProfile,
        dateOfBirth: "1992-05-18",
        sex: "Female",
        bloodGroup: "O+",
        allergies: ["Pollen"],
        existingConditions: ["Migraine"],
        currentMedications: ["Acetaminophen as needed"],
        emergencyContactName: "Jordan Johnson",
      };
      if (!demoProfile) {
        setHealthProfile(fallbackProfile);
        return;
      }
      try {
        setHealthProfile(JSON.parse(demoProfile) as HealthProfileInput);
      } catch {
        window.localStorage.removeItem(DEMO_PROFILE_KEY);
        setHealthProfile(fallbackProfile);
      }
      return;
    }

    buttaApi
      .getProfile()
      .then(({ profile }) => setHealthProfile(profile))
      .catch((error: unknown) => {
        if (!(error instanceof ApiError) || error.status !== 404) {
          console.error("Unable to load health profile", error);
        }
      });
  }, [user]);

  useEffect(() => {
    if (user.demo) {
      const stored = window.localStorage.getItem(DEMO_AI_CONSENT_KEY);
      setAiConsent({
        granted: stored === "true",
        policyVersion: "demo",
        grantedAt: null,
        revokedAt: null,
        updatedAt: null,
      });
      return;
    }

    buttaApi
      .getAiConsent()
      .then(({ consent }) => setAiConsent(consent))
      .catch((error: unknown) => console.error("Unable to load AI consent", error));
  }, [user]);

  async function saveAiConsent(granted: boolean) {
    if (user.demo) {
      window.localStorage.setItem(DEMO_AI_CONSENT_KEY, String(granted));
      setAiConsent((current) => ({ ...(current ?? { policyVersion: "demo", grantedAt: null, revokedAt: null, updatedAt: null }), granted }));
      return;
    }
    const { consent } = await buttaApi.setAiConsent(granted);
    setAiConsent(consent);
  }

  useLayoutEffect(() => {
    const context = gsap.context(() => {
      gsap.fromTo(
        ".app-shell",
        { autoAlpha: 0, y: 16 },
        { autoAlpha: 1, y: 0, duration: 0.7, ease: "power3.out", clearProps: "transform,opacity,visibility,willChange" },
      );
    });

    return () => context.revert();
  }, []);

  useLayoutEffect(() => {
    if (!viewRef.current) return;
    const context = gsap.context(() => {
      gsap.fromTo(
        ".view-panel",
        { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: 0.42, ease: "power2.out", clearProps: "transform,opacity,visibility,willChange" },
      );
      gsap.fromTo(
        ".stagger-in",
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out", stagger: 0.045, delay: 0.08, clearProps: "transform,opacity,visibility,willChange" },
      );
      gsap.fromTo(
        ".dashboard-enter",
        { autoAlpha: 0, y: 22 },
        { autoAlpha: 1, y: 0, duration: 0.58, ease: "power3.out", stagger: 0.08, delay: 0.08, clearProps: "transform,opacity,visibility" },
      );
      gsap.fromTo(
        ".dashboard-rail-enter",
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.5, ease: "power2.out", delay: 0.16, clearProps: "opacity,visibility" },
      );
    }, viewRef);

    return () => context.revert();
  }, [activeView]);

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((record) => {
      const matchesType = filter === "ALL" || record.type === filter;
      const matchesSearch =
        !term ||
        [record.title, record.notes, record.treatment, ...record.symptoms].some((value) =>
          value.toLowerCase().includes(term),
        );
      return matchesType && matchesSearch;
    });
  }, [filter, records, search]);

  const selectedRecords = useMemo(
    () => records.filter((record) => selectedIds.includes(record.id)),
    [records, selectedIds],
  );

  const metrics = useMemo(() => {
    if (!user.demo && dashboard) {
      return {
        monitoring: dashboard.monitoringCount,
        symptoms: dashboard.symptomCount,
        records: dashboard.totalEvents,
      };
    }
    const monitoring = records.filter((record) => record.status === "Needs monitoring").length;
    const symptoms = records.filter((record) => record.type === "SYMPTOM").length;
    return { monitoring, symptoms, records: records.length };
  }, [dashboard, records, user.demo]);

  async function openConfirm(
    source: ExtractedRecord["source"] = inputMode,
    attachmentIds: string[] = [],
    symptomTags: string[] = [],
  ) {
    if (!observation.trim()) return;
    setInputMode(source);
    setExtractionSafety(null);
    setEducationalContext([]);
    setPendingAttachmentIds(attachmentIds);

    if (user.demo) {
      setExtracted(parseObservation(observation, source, symptomTags));
      return;
    }

    setExtracting(true);
    try {
      const { draft, safety, educationalContext: context } = await buttaApi.extractHealthEvent({
        observation, source, symptomTags,
      });
      setExtracted(draft);
      setExtractionSafety(safety);
      setEducationalContext(context);
    } catch {
      // AI extraction is unavailable, refused, or timed out; the deterministic
      // parser keeps capture working and never loses the user's original text.
      setExtracted(parseObservation(observation, source, symptomTags));
    } finally {
      setExtracting(false);
    }
  }

  async function saveRecord() {
    if (!extracted) return;
    setSaving(true);
    setSaveError("");
    try {
      const record = user.demo
        ? await mockBackend.createRecord(extracted)
        : (await buttaApi.createHealthEvent(extracted)).healthEvent;
      if (!user.demo && pendingAttachmentIds.length) {
        await buttaApi.attachToHealthEvent(record.id, pendingAttachmentIds);
      }
      setRecords((current) => [record, ...current]);
      setSelectedIds((current) => [record.id, ...current].slice(0, 5));
      setObservation("");
      setExtracted(null);
      setPendingAttachmentIds([]);
      if (!user.demo) setRecordsReload((value) => value + 1);
      navigateView("timeline");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Your health event could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!loading) {
      setSummary(buildDoctorSummary(records, selectedIds));
    }
  }, [loading, records, selectedIds]);

  async function saveHealthProfile(nextProfile: HealthProfileInput) {
    if (user.demo) {
      window.localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify(nextProfile));
      setHealthProfile(nextProfile);
      return;
    }

    const { profile } = await buttaApi.saveProfile(nextProfile);
    setHealthProfile(profile);
    setRecordsReload((value) => value + 1);
  }

  async function respondToDailyCheckIn(notes: string) {
    if (!todayCheckIn || todayCheckIn.respondedAt) return;
    setCheckInSaving(true);
    setCheckInError("");
    try {
      const result = user.demo
        ? await mockBackend.respondToCheckIn(todayCheckIn, notes)
        : await buttaApi.respondToCheckIn(todayCheckIn.id, { notes });
      setTodayCheckIn(result.checkIn);
      setRecords((current) => [result.healthEvent, ...current]);
      setSelectedIds((current) => [result.healthEvent.id, ...current].slice(0, 5));
      if (!user.demo) setRecordsReload((value) => value + 1);
    } catch (error) {
      setCheckInError(error instanceof Error ? error.message : "Today's check-in could not be saved.");
    } finally {
      setCheckInSaving(false);
    }
  }

  const showInsightRail = ["capture", "timeline", "companion", "doctor-prep", "doctor-summary"].includes(activeView);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="app-shell min-h-screen w-full">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col overflow-y-auto border-r border-line bg-paper2 px-5 py-5 lg:flex">
          <BrandBlock />
          <DesktopNav activeView={activeView} onChange={navigateView} />
          <div className="mt-auto pt-6">
            <div className="relative h-40 overflow-hidden rounded-lg border border-teal/10 bg-well">
              <img src="/assets/butta-sidebar-botanical.png" alt="Watercolor eucalyptus and sage leaves" className="absolute inset-0 h-full w-full object-cover object-bottom" />
              <div className="absolute inset-x-0 bottom-0 bg-teal px-3 py-2.5 text-center">
                <p className="text-xs font-extrabold leading-5 text-white">Small steps. A healthier you.</p>
              </div>
            </div>
            <div className="mt-4 space-y-4 border-t border-line pt-4">
              <StatusStrip label="Records synced" value={`${metrics.records} entries`} />
              <StatusStrip label="Doctor view" value={`${selectedRecords.length} selected`} />
              <button onClick={onSignOut} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-extrabold text-muted transition hover:bg-well hover:text-ink">
                <LogOut size={17} />
                Sign out
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 pb-28 lg:ml-64 lg:pb-0">
          <MobileTopbar
            onSignOut={onSignOut}
            showInsightTrigger={showInsightRail}
            onOpenInsightRail={() => setInsightRailOpen(true)}
          />
          <DashboardTopbar
            user={user}
            search={search}
            setSearch={setSearch}
            onSearch={() => navigateView("timeline")}
            onProfile={() => navigateView("profile")}
          />
          <div className="min-h-[calc(100vh-72px)]">
            <section
              ref={viewRef}
              className={`min-w-0 px-4 py-4 sm:px-6 lg:px-8 lg:py-7 ${activeView === "dashboard" ? "xl:pr-[348px]" : showInsightRail ? "2xl:pr-[348px]" : ""}`}
            >
              <div className={`view-panel mx-auto w-full min-w-0 overflow-visible ${activeView === "dashboard" ? "max-w-[1240px]" : "max-w-5xl"}`}>
                {recordsError && (
                  <div role="alert" className="mb-5 flex flex-col gap-3 rounded-lg border border-rust/25 bg-rust/5 px-4 py-3 text-sm font-semibold text-rust sm:flex-row sm:items-center sm:justify-between">
                    <span>{recordsError}</span>
                    <button type="button" onClick={() => setRecordsReload((value) => value + 1)} className="self-start rounded border border-rust/30 bg-white px-3 py-2 text-xs font-extrabold sm:self-auto">Try again</button>
                  </div>
                )}
                {activeView !== "dashboard" && activeView !== "profile" && activeView !== "settings" && <HeaderBand metrics={metrics} />}
                {activeView === "dashboard" && (
                  <DashboardView
                    user={user}
                    profile={healthProfile}
                    records={records}
                    dashboard={dashboard}
                    checkIn={todayCheckIn}
                    checkInSaving={checkInSaving}
                    checkInError={checkInError}
                    onCheckIn={respondToDailyCheckIn}
                    loading={loading}
                    setActiveView={navigateView}
                  />
                )}
                {activeView === "profile" && (
                  <HealthProfileView
                    user={user}
                    profile={healthProfile}
                    onSave={saveHealthProfile}
                  />
                )}
                {activeView === "capture" && (
                  <CaptureView
                    observation={observation}
                    setObservation={setObservation}
                    openConfirm={openConfirm}
                    extracting={extracting}
                    aiConsent={aiConsent}
                    onEnableAiCapture={() => void saveAiConsent(true)}
                    records={records}
                    isDemo={Boolean(user.demo)}
                  />
                )}
                {activeView === "timeline" && (
                  <TimelineView
                    records={filteredRecords}
                    rawCount={records.length}
                    search={search}
                    setSearch={setSearch}
                    filter={filter}
                    setFilter={setFilter}
                    setActiveView={navigateView}
                  />
                )}
                {activeView === "companion" && <CompanionView records={records} />}
                {activeView === "doctor-prep" && (
                  <DoctorPrepView
                    records={records}
                    selectedIds={selectedIds}
                    setSelectedIds={setSelectedIds}
                    setActiveView={navigateView}
                  />
                )}
                {activeView === "doctor-summary" && (
                  <DoctorSummaryView summary={summary} selectedRecords={selectedRecords} />
                )}
                {activeView === "settings" && (
                  <SettingsView
                    user={user}
                    onSignOut={onSignOut}
                    onResetDemo={() => {
                      clearDemoStorage();
                      onSignOut();
                    }}
                    aiConsent={aiConsent}
                    onSaveAiConsent={saveAiConsent}
                  />
                )}
              </div>
            </section>

            {showInsightRail && (
              <InsightRail user={user} records={records} selectedRecords={selectedRecords} setActiveView={navigateView} />
            )}
            {showInsightRail && insightRailOpen && (
              <MobileInsightDrawer
                user={user}
                records={records}
                selectedRecords={selectedRecords}
                setActiveView={navigateView}
                onClose={() => setInsightRailOpen(false)}
              />
            )}
          </div>
        </main>

        <MobileNav activeView={activeView} onChange={navigateView} />
      </div>

      {extracted && (
        <ConfirmModal
          extracted={extracted}
          setExtracted={setExtracted}
          original={observation}
          safety={extractionSafety}
          educationalContext={educationalContext}
          saving={saving}
          error={saveError}
          onClose={() => {
            setExtracted(null);
            setExtractionSafety(null);
            setEducationalContext([]);
          }}
          onSave={saveRecord}
        />
      )}
    </div>
  );
}

function DashboardTopbar({
  user,
  search,
  setSearch,
  onSearch,
  onProfile,
}: {
  user: AppUser;
  search: string;
  setSearch: (value: string) => void;
  onSearch: () => void;
  onProfile: () => void;
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();

  return (
    <header className="sticky top-0 z-30 hidden h-[72px] items-center justify-between border-b border-line bg-white/95 px-8 backdrop-blur lg:flex">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
        className="relative w-full max-w-md"
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint" size={18} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search your health events..."
          aria-label="Search health events"
          className="h-11 w-full rounded-lg border border-transparent bg-well pl-11 pr-4 text-sm text-ink outline-none transition placeholder:text-faint focus:border-teal/30 focus:bg-white focus:ring-2 focus:ring-teal/10"
        />
      </form>

      <div className="relative ml-6 flex items-center gap-4">
        <button
          type="button"
          onClick={() => setNotificationsOpen((open) => !open)}
          className="relative grid h-10 w-10 place-items-center rounded-lg text-muted transition hover:bg-well hover:text-ink"
          aria-label="Notifications"
          aria-expanded={notificationsOpen}
        >
          <Bell size={20} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rust ring-2 ring-white" />
        </button>
        <button type="button" onClick={onProfile} className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-well">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal text-sm font-extrabold text-white shadow-lift">
            {initials}
          </span>
          <span className="min-w-0">
            <span className="block max-w-40 truncate text-sm font-extrabold">Hello, {user.firstName}</span>
            <span className="block text-xs font-semibold text-muted">View health profile</span>
          </span>
          <ChevronDown size={16} className="text-faint" />
        </button>

        {notificationsOpen && (
          <div className="absolute right-0 top-[54px] w-80 overflow-hidden rounded-lg border border-line bg-white shadow-float">
            <div className="border-b border-line px-4 py-3">
              <p className="text-sm font-extrabold">Notifications</p>
            </div>
            <button type="button" onClick={onProfile} className="flex w-full gap-3 px-4 py-4 text-left transition hover:bg-well">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal/10 text-teal">
                <UserRound size={17} />
              </span>
              <span>
                <span className="block text-sm font-bold">Review your health profile</span>
                <span className="mt-1 block text-xs leading-5 text-muted">Keep medications and emergency details current.</span>
              </span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function DashboardView({
  user,
  profile,
  records,
  dashboard,
  checkIn,
  checkInSaving,
  checkInError,
  onCheckIn,
  loading,
  setActiveView,
}: {
  user: AppUser;
  profile: HealthProfile | null;
  records: HealthRecord[];
  dashboard: DashboardSnapshot | null;
  checkIn: DailyCheckIn | null;
  checkInSaving: boolean;
  checkInError: string;
  onCheckIn: (notes: string) => Promise<void>;
  loading: boolean;
  setActiveView: (view: ViewId) => void;
}) {
  const completion = dashboard?.profileCompletion ?? profileCompletion(user, profile);
  const latestRecord = dashboard?.latestEvent ?? records[0];
  const recentRecords = dashboard?.recentEvents ?? records.slice(0, 4);
  const now = new Date();
  const locallyCalculatedMonth = records.filter((record) => {
    const date = new Date(record.eventDate);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;
  const thisMonthRecords = dashboard?.eventsThisMonth ?? locallyCalculatedMonth;
  const memberSinceValue = dashboard?.memberSince ?? user.createdAt;
  const memberSince = memberSinceValue
    ? new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(new Date(memberSinceValue))
    : "Today";
  const locallyCalculatedDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const count = records.filter((record) => new Date(record.eventDate).toDateString() === date.toDateString()).length;
    return {
      label: new Intl.DateTimeFormat("en", { weekday: "short" }).format(date),
      count,
    };
  });
  const days = dashboard?.activity ?? locallyCalculatedDays;
  const maxDailyCount = Math.max(1, ...days.map((day) => day.count));

  return (
    <div className="dashboard-view">
      <div className="dashboard-enter mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{getGreeting()}, {user.firstName}</h1>
            <SunMark />
          </div>
          <p className="mt-1 text-base font-medium text-muted">Here is what is happening with your health story.</p>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="text-sm font-bold text-muted">
            {new Intl.DateTimeFormat("en", { weekday: "long", month: "short", day: "numeric", year: "numeric" }).format(now)}
          </p>
          <span className="mt-2 inline-flex rounded-lg bg-teal/5 px-3 py-2 text-xs font-extrabold text-teal">
            Small steps build a clearer history
          </span>
        </div>
      </div>

      <div className="grid gap-5">
        <div className="min-w-0 space-y-5">
          <section className="dashboard-enter grid grid-cols-2 gap-3 xl:grid-cols-4">
            <DashboardMetric
              icon={UserRound}
              label="Profile"
              value={`${completion}%`}
              detail="complete"
              badge="Private"
              progress={completion}
              onClick={() => setActiveView("profile")}
            />
            <DashboardMetric
              icon={FileCheck2}
              label="Health events"
              value={String(thisMonthRecords)}
              detail="this month"
              badge="Monthly"
              onClick={() => setActiveView("timeline")}
            />
            <DashboardMetric
              icon={latestRecord?.type === "MEDICATION" ? Pill : HeartPulse}
              label="Latest event"
              value={latestRecord?.title || "No events yet"}
              detail={latestRecord ? formatDate(latestRecord.eventDate) : "Start your history"}
              badge="Recent"
              compact
              onClick={() => setActiveView(latestRecord ? "timeline" : "capture")}
            />
            <DashboardMetric
              icon={CalendarDays}
              label="Member since"
              value={memberSince}
              detail={user.demo ? "Demo profile" : "Private account"}
              badge="Account"
              compact
            />
          </section>

          <section className="surface-card dashboard-enter overflow-hidden rounded-lg">
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <h2 className="text-lg font-extrabold">Recent health events</h2>
                <p className="mt-0.5 text-xs font-semibold text-muted">Your newest recorded observations</p>
              </div>
              <button type="button" onClick={() => setActiveView("timeline")} className="inline-flex items-center gap-2 text-sm font-extrabold text-teal hover:text-tealDark">
                View all
                <ArrowRight size={16} />
              </button>
            </div>
            <div className="min-h-[284px]">
              {loading ? (
                <div className="grid min-h-[284px] place-items-center text-sm font-semibold text-muted">Loading your health history...</div>
              ) : recentRecords.length ? (
                recentRecords.map((record) => (
                  <button
                    key={record.id}
                    type="button"
                    onClick={() => setActiveView("timeline")}
                    className="group grid w-full grid-cols-[64px_42px_minmax(0,1fr)_20px] items-center gap-3 border-b border-line px-5 py-3.5 text-left last:border-b-0 hover:bg-well/60"
                  >
                    <span className="text-xs font-extrabold leading-4 text-muted">
                      {new Intl.DateTimeFormat("en", { month: "short", day: "2-digit" }).format(new Date(record.eventDate))}
                      <span className="block font-semibold text-faint">{new Date(record.eventDate).getFullYear()}</span>
                    </span>
                    <HealthEventIcon record={record} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-extrabold text-ink">{record.title}</span>
                      <span className="mt-0.5 block truncate text-xs font-semibold text-muted">
                        {record.symptoms.slice(0, 2).join(", ") || record.notes}
                      </span>
                    </span>
                    <ChevronRight size={17} className="text-faint transition group-hover:translate-x-0.5 group-hover:text-teal" />
                  </button>
                ))
              ) : (
                <div className="grid min-h-[284px] place-items-center px-6 text-center">
                  <div>
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-teal/10 text-teal"><Plus size={20} /></span>
                    <p className="mt-3 text-sm font-extrabold">No health events yet</p>
                    <button type="button" onClick={() => setActiveView("capture")} className="mt-2 text-sm font-bold text-teal">Log your first event</button>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="dashboard-enter grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
            <div className="surface-card rounded-lg p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-extrabold">Your health at a glance</h2>
                  <p className="mt-1 text-xs font-semibold text-muted">Events recorded over the last seven days</p>
                </div>
                <span className="badge border border-line bg-well text-muted"><span>This week</span></span>
              </div>
              <div className="mt-5 grid h-28 grid-cols-7 items-end gap-3 border-b border-line px-1">
                {days.map((day) => (
                  <div key={day.label} className="flex h-full flex-col items-center justify-end gap-2">
                    <span className="w-full max-w-5 rounded-t bg-teal transition-[height] duration-500" style={{ height: `${Math.max(8, (day.count / maxDailyCount) * 78)}%` }} title={`${day.count} events`} />
                    <span className="text-[11px] font-bold text-muted">{day.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <DailyCheckInCard
              checkIn={checkIn}
              loading={loading}
              saving={checkInSaving}
              error={checkInError}
              onSubmit={onCheckIn}
              onViewHistory={() => setActiveView("timeline")}
            />
          </section>
        </div>

        <aside className="dashboard-rail-enter space-y-4 xl:fixed xl:bottom-0 xl:right-0 xl:top-[72px] xl:z-20 xl:flex xl:w-[320px] xl:flex-col xl:overflow-y-auto xl:border-l xl:border-line xl:bg-paper xl:p-4">
          <section className="relative min-h-[278px] overflow-hidden rounded-lg bg-teal">
            <img src="/assets/butta-hero-wellness.png" alt="Woman taking a calm wellness break with a warm drink" className="absolute inset-0 h-full w-full object-cover object-center" />
            <div className="absolute inset-0 bg-[#173f35]/60" />
            <div className="relative z-10 max-w-[64%] p-5 text-white">
              <h2 className="text-xl font-extrabold leading-6">Take care of yourself</h2>
              <p className="mt-2 text-xs font-semibold leading-5 text-white/85">Your health is a priority, not a luxury.</p>
            </div>
            <button type="button" onClick={() => setActiveView("capture")} className="absolute bottom-4 left-4 right-4 z-10 flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white bg-white px-4 text-sm font-extrabold text-teal transition hover:bg-well">
              <Plus size={17} />
              Log health event
            </button>
          </section>

          <section className="surface-card overflow-hidden rounded-lg">
            <div className="border-b border-line px-4 py-4">
              <h2 className="text-base font-extrabold">Quick actions</h2>
            </div>
            <QuickAction icon={UserRound} label="Update profile" onClick={() => setActiveView("profile")} />
            <QuickAction icon={Plus} label="Log health event" onClick={() => setActiveView("capture")} />
            <QuickAction icon={Clock3} label="View health history" onClick={() => setActiveView("timeline")} />
          </section>

          <section className="relative min-h-40 flex-1 overflow-hidden rounded-lg border border-teal/10 bg-well p-5 text-center">
            <img src="/assets/butta-sidebar-botanical.png" alt="" className="absolute inset-0 h-full w-full object-cover object-bottom opacity-35" />
            <div className="relative px-3 py-4">
              <Leaf className="mx-auto text-teal" size={22} fill="currentColor" strokeWidth={1.4} />
              <p className="mt-3 text-sm font-extrabold leading-6 text-tealDark">A healthier you starts with a clearer story.</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SunMark() {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold/15 text-[#b88712]" aria-hidden="true">
      <Sun size={19} />
    </span>
  );
}

function DashboardMetric({
  icon: Icon,
  label,
  value,
  detail,
  badge,
  progress,
  compact = false,
  onClick,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
  badge: string;
  progress?: number;
  compact?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal/10 text-teal"><Icon size={19} /></span>
        <span className="badge max-w-[88px] border border-line bg-well text-muted"><span>{badge}</span></span>
      </div>
      <p className="mt-3 text-xs font-bold text-muted">{label}</p>
      <p className={`mt-0.5 overflow-hidden font-extrabold text-ink ${compact ? "truncate text-base" : "text-2xl"}`} title={value}>{value}</p>
      <p className="mt-0.5 truncate text-xs font-semibold text-faint">{detail}</p>
      {typeof progress === "number" && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-well"><div className="h-full rounded-full bg-teal" style={{ width: `${progress}%` }} /></div>
      )}
    </>
  );

  const className = "surface-card min-w-0 rounded-lg p-4 text-left transition hover:-translate-y-0.5 hover:border-teal/30 hover:shadow-lift";
  return onClick ? <button type="button" onClick={onClick} className={className}>{content}</button> : <div className={className}>{content}</div>;
}

function HealthEventIcon({ record }: { record: HealthRecord }) {
  const Icon = record.type === "MEDICATION" ? Pill : record.type === "DOCTOR_VISIT" ? FileCheck2 : record.type === "CHECK_IN" ? Check : HeartPulse;
  const color = record.type === "MEDICATION" || record.type === "CHECK_IN" ? "bg-teal/10 text-teal" : record.type === "DOCTOR_VISIT" ? "bg-gold/20 text-[#8a6800]" : "bg-rust/10 text-rust";
  return <span className={`grid h-10 w-10 place-items-center rounded-full ${color}`}><Icon size={18} /></span>;
}

function DailyCheckInCard({
  checkIn,
  loading,
  saving,
  error,
  onSubmit,
  onViewHistory,
}: {
  checkIn: DailyCheckIn | null;
  loading: boolean;
  saving: boolean;
  error: string;
  onSubmit: (notes: string) => Promise<void>;
  onViewHistory: () => void;
}) {
  const [notes, setNotes] = useState("");

  if (loading || !checkIn) {
    return <div className="surface-card grid min-h-52 place-items-center rounded-lg p-5 text-sm font-semibold text-muted">Preparing today's check-in...</div>;
  }

  if (checkIn.respondedAt) {
    return (
      <div className="surface-card flex min-h-52 flex-col justify-between rounded-lg p-5">
        <div>
          <span className="grid h-11 w-11 place-items-center rounded-full bg-teal/10 text-teal"><Check size={20} /></span>
          <p className="mt-4 text-xs font-extrabold uppercase text-muted">Today's check-in</p>
          <h2 className="mt-2 text-base font-extrabold">Your response is recorded</h2>
          <p className="mt-2 text-sm leading-6 text-muted">It is now part of your health timeline and can be included in visit preparation.</p>
        </div>
        <button type="button" onClick={onViewHistory} className="mt-4 inline-flex items-center gap-2 self-start text-sm font-extrabold text-teal">View in history <ArrowRight size={16} /></button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (notes.trim()) void onSubmit(notes.trim());
      }}
      className="surface-card flex min-h-52 flex-col rounded-lg p-5"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold/20 text-[#8a6800]"><Lightbulb size={19} /></span>
        <div>
          <p className="text-xs font-extrabold uppercase text-muted">Today's check-in</p>
          <p className="mt-1 text-sm font-extrabold leading-5">{checkIn.promptText}</p>
        </div>
      </div>
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        maxLength={2000}
        rows={2}
        placeholder="Write a short response"
        aria-label="Daily check-in response"
        className="mt-4 min-h-16 w-full resize-none rounded-lg border border-line bg-well px-3 py-2 text-sm outline-none transition placeholder:text-faint focus:border-teal focus:bg-white"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <p role={error ? "alert" : undefined} className="min-w-0 text-xs font-semibold text-rust">{error}</p>
        <button type="submit" disabled={saving || !notes.trim()} className="ml-auto min-h-10 shrink-0 rounded-lg bg-teal px-4 text-sm font-extrabold text-white transition hover:bg-tealDark disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? "Saving..." : "Save check-in"}
        </button>
      </div>
    </form>
  );
}

function QuickAction({ icon: Icon, label, onClick }: { icon: typeof Activity; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex w-full items-center gap-3 border-b border-line px-4 py-3.5 text-left last:border-b-0 hover:bg-well/60">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal/10 text-teal"><Icon size={17} /></span>
      <span className="min-w-0 flex-1 truncate text-sm font-bold">{label}</span>
      <ChevronRight size={17} className="text-faint transition group-hover:translate-x-0.5 group-hover:text-teal" />
    </button>
  );
}

function HealthProfileView({
  user,
  profile,
  onSave,
}: {
  user: AppUser;
  profile: HealthProfile | null;
  onSave: (profile: HealthProfileInput) => Promise<void>;
}) {
  const [draft, setDraft] = useState<HealthProfileInput>(toProfileInput(profile));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    setDraft(toProfileInput(profile));
  }, [profile]);

  function updateList(key: "allergies" | "existingConditions" | "currentMedications", value: string) {
    setDraft((current) => ({ ...current, [key]: value.split(",").map((item) => item.trimStart()) }));
  }

  const sanitizedDraft = {
    ...draft,
    allergies: draft.allergies.map((item) => item.trim()).filter(Boolean),
    existingConditions: draft.existingConditions.map((item) => item.trim()).filter(Boolean),
    currentMedications: draft.currentMedications.map((item) => item.trim()).filter(Boolean),
  };
  const isDirty = JSON.stringify(sanitizedDraft) !== JSON.stringify(toProfileInput(profile));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isDirty) return;
    setStatus("saving");
    try {
      await onSave(sanitizedDraft);
      setDraft(sanitizedDraft);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="space-y-5">
      <div className="stagger-in flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-extrabold">Health profile</h1>
          <p className="mt-1 text-sm font-semibold text-muted">Keep the details that add context to your health events up to date.</p>
        </div>
        <span className="text-sm font-extrabold text-teal">{profileCompletion(user, profile)}% complete</span>
      </div>

      <form onSubmit={submit} className="surface-card stagger-in overflow-hidden rounded-lg">
        <div className="grid gap-5 border-b border-line p-5 sm:grid-cols-2 sm:p-6">
          <ProfileField label="First name" value={user.firstName} disabled />
          <ProfileField label="Last name" value={user.lastName} disabled />
          <ProfileField label="Email address" value={user.email} disabled className="sm:col-span-2" />
        </div>
        <div className="grid gap-5 border-b border-line p-5 sm:grid-cols-3 sm:p-6">
          <ProfileField label="Date of birth" type="date" value={draft.dateOfBirth || ""} onChange={(value) => setDraft({ ...draft, dateOfBirth: value || null })} />
          <AnimatedSelect
            label="Sex"
            value={draft.sex || ""}
            onChange={(value) => setDraft({ ...draft, sex: value || null })}
            options={["Female", "Male"]}
          />
          <AnimatedSelect
            label="Blood group"
            value={draft.bloodGroup || ""}
            onChange={(value) => setDraft({ ...draft, bloodGroup: (value || null) as HealthProfileInput["bloodGroup"] })}
            options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]}
          />
        </div>
        <div className="grid gap-5 border-b border-line p-5 sm:grid-cols-2 sm:p-6">
          <ProfileField label="Allergies" value={draft.allergies.join(", ")} placeholder="Pollen, penicillin" onChange={(value) => updateList("allergies", value)} />
          <ProfileField label="Existing conditions" value={draft.existingConditions.join(", ")} placeholder="Migraine" onChange={(value) => updateList("existingConditions", value)} />
          <ProfileField label="Current medications" value={draft.currentMedications.join(", ")} placeholder="Medication and dose" onChange={(value) => updateList("currentMedications", value)} className="sm:col-span-2" />
        </div>
        <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
          <ProfileField label="Emergency contact" value={draft.emergencyContactName || ""} placeholder="Full name" onChange={(value) => setDraft({ ...draft, emergencyContactName: value || null })} />
          <ProfileField label="Emergency phone" value={draft.emergencyContactPhone || ""} placeholder="Phone number" onChange={(value) => setDraft({ ...draft, emergencyContactPhone: value || null })} />
        </div>
        <div className="flex flex-col items-start justify-between gap-3 border-t border-line bg-well/50 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
          <p className={`text-sm font-bold ${status === "error" ? "text-rust" : "text-muted"}`}>
            {status === "saved" ? "Profile updated." : status === "error" ? "Profile could not be updated." : "Only you can access these details."}
          </p>
          <button disabled={status === "saving" || !isDirty} className="min-h-11 rounded-lg bg-teal px-5 text-sm font-extrabold text-white shadow-lift transition hover:bg-tealDark disabled:cursor-not-allowed disabled:opacity-60">
            {status === "saving" ? "Saving..." : "Save profile"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ProfileField({ label, value, onChange, placeholder, disabled = false, type = "text", className = "" }: { label: string; value: string; onChange?: (value: string) => void; placeholder?: string; disabled?: boolean; type?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-extrabold">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange?.(event.target.value)} placeholder={placeholder} disabled={disabled} className="mt-2 h-12 w-full rounded-lg border border-line bg-white px-4 text-sm outline-none transition placeholder:text-faint focus:border-teal disabled:bg-well disabled:text-muted" />
    </label>
  );
}

function SettingsView({
  user,
  onSignOut,
  onResetDemo,
  aiConsent,
  onSaveAiConsent,
}: {
  user: AppUser;
  onSignOut: () => void;
  onResetDemo: () => void;
  aiConsent: AiConsent | null;
  onSaveAiConsent: (granted: boolean) => Promise<void>;
}) {
  const [aiConsentStatus, setAiConsentStatus] = useState<"idle" | "saving" | "error">("idle");
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    eventReminders: true,
    weeklySummary: true,
    dailyCheckIn: true,
    checkInTime: "09:00",
    timezone: browserTimezone,
  });
  const [preferenceStatus, setPreferenceStatus] = useState<"loading" | "idle" | "saving" | "saved" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    if (user.demo) {
      const stored = window.localStorage.getItem(DEMO_PREFERENCES_KEY);
      if (stored) {
        try {
          setPreferences(JSON.parse(stored) as NotificationPreferences);
        } catch {
          window.localStorage.removeItem(DEMO_PREFERENCES_KEY);
        }
      }
      setPreferenceStatus("idle");
      return;
    }

    buttaApi.getNotificationPreferences()
      .then(({ preferences: saved }) => {
        if (!cancelled) {
          setPreferences(saved);
          setPreferenceStatus("idle");
        }
      })
      .catch(() => {
        if (!cancelled) setPreferenceStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function savePreferences(next: NotificationPreferences) {
    setPreferences(next);
    setPreferenceStatus("saving");
    try {
      if (user.demo) {
        window.localStorage.setItem(DEMO_PREFERENCES_KEY, JSON.stringify(next));
      } else {
        const { preferences: saved } = await buttaApi.saveNotificationPreferences(next);
        setPreferences(saved);
      }
      setPreferenceStatus("saved");
    } catch {
      setPreferenceStatus("error");
    }
  }

  return (
    <div className="space-y-5">
      <div className="stagger-in">
        <span className="badge border border-line bg-white text-muted"><span>Account preferences</span></span>
        <h1 className="mt-3 text-3xl font-extrabold">Settings</h1>
        <p className="mt-1 text-sm font-semibold text-muted">Manage reminders, summaries, and account access.</p>
      </div>
      <section className="surface-card stagger-in overflow-hidden rounded-lg">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-base font-extrabold">Notifications</h2>
          <span className={`text-xs font-bold ${preferenceStatus === "error" ? "text-rust" : "text-muted"}`}>
            {preferenceStatus === "loading" ? "Loading..." : preferenceStatus === "saving" ? "Saving..." : preferenceStatus === "saved" ? "Saved" : preferenceStatus === "error" ? "Could not save" : ""}
          </span>
        </div>
        <SettingToggle label="Event reminders" detail="Receive a reminder when an event needs follow-up context." checked={preferences.eventReminders} onChange={(checked) => void savePreferences({ ...preferences, eventReminders: checked })} />
        <SettingToggle label="Daily check-in reminder" detail="Schedule a reminder for your short daily reflection." checked={preferences.dailyCheckIn} onChange={(checked) => void savePreferences({ ...preferences, dailyCheckIn: checked })} />
        <SettingToggle label="Weekly health summary" detail="Receive a concise weekly recap of your recorded events." checked={preferences.weeklySummary} onChange={(checked) => void savePreferences({ ...preferences, weeklySummary: checked })} />
        <label className="flex items-center justify-between gap-5 px-5 py-4">
          <span>
            <span className="block text-sm font-extrabold">Check-in time</span>
            <span className="mt-1 block text-xs font-semibold leading-5 text-muted">Uses {preferences.timezone}.</span>
          </span>
          <input
            type="time"
            value={preferences.checkInTime}
            disabled={!preferences.dailyCheckIn || preferenceStatus === "loading"}
            onChange={(event) => setPreferences({ ...preferences, checkInTime: event.target.value })}
            onBlur={() => void savePreferences(preferences)}
            className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-bold outline-none focus:border-teal disabled:bg-well disabled:text-faint"
          />
        </label>
      </section>
      <section className="surface-card stagger-in overflow-hidden rounded-lg">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-base font-extrabold">AI-assisted capture</h2>
          <span className={`text-xs font-bold ${aiConsentStatus === "error" ? "text-rust" : "text-muted"}`}>
            {aiConsentStatus === "saving" ? "Saving..." : aiConsentStatus === "error" ? "Could not save" : ""}
          </span>
        </div>
        <SettingToggle
          label="Use AI to organize observations"
          detail="Sends what you type to a locally hosted model to draft structured fields. You always review and confirm before anything is saved. Off by default; you can turn this off anytime."
          checked={aiConsent?.granted ?? false}
          onChange={async (checked) => {
            setAiConsentStatus("saving");
            try {
              await onSaveAiConsent(checked);
              setAiConsentStatus("idle");
            } catch {
              setAiConsentStatus("error");
            }
          }}
        />
      </section>
      {user.demo && (
        <section className="surface-card stagger-in overflow-hidden rounded-lg">
          <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-extrabold">Reset demo workspace</p>
              <p className="mt-1 text-xs font-semibold text-muted">Remove only the synthetic demo profile and health events stored in this browser.</p>
            </div>
            <button type="button" onClick={onResetDemo} className="min-h-11 rounded-lg border border-line px-4 text-sm font-extrabold text-muted transition hover:bg-well hover:text-ink">Reset demo</button>
          </div>
        </section>
      )}
      <section className="surface-card stagger-in overflow-hidden rounded-lg">
        <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold">{user.email}</p>
            <p className="mt-1 text-xs font-semibold text-muted">Signed in as {user.firstName} {user.lastName}</p>
          </div>
          <button type="button" onClick={onSignOut} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-rust/25 px-4 text-sm font-extrabold text-rust transition hover:bg-rust/5"><LogOut size={17} />Sign out</button>
        </div>
      </section>
    </div>
  );
}

function SettingToggle({ label, detail, checked, onChange }: { label: string; detail: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-5 border-b border-line px-5 py-4 last:border-b-0 hover:bg-well/50">
      <span><span className="block text-sm font-extrabold">{label}</span><span className="mt-1 block text-xs font-semibold leading-5 text-muted">{detail}</span></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 shrink-0 accent-teal" />
    </label>
  );
}

function BrandBlock() {
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-teal text-paper shadow-lift">
          <Leaf size={22} fill="currentColor" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-lg font-extrabold leading-5 text-ink">Butta Health</p>
          <p className="mt-1 text-xs font-semibold text-muted">Your health. Your story.</p>
        </div>
      </div>
    </div>
  );
}

function DesktopNav({ activeView, onChange }: { activeView: ViewId; onChange: (view: ViewId) => void }) {
  return (
    <nav className="mt-8 space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = activeView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={`group flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold transition ${
              active ? "bg-well text-teal shadow-[inset_3px_0_0_#2F7D69]" : "text-muted hover:bg-well/70 hover:text-ink"
            }`}
          >
            <Icon size={19} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function MobileTopbar({
  onSignOut,
  showInsightTrigger,
  onOpenInsightRail,
}: {
  onSignOut: () => void;
  showInsightTrigger: boolean;
  onOpenInsightRail: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-line bg-paper/90 px-4 backdrop-blur lg:hidden">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-teal text-paper">
          <Leaf size={20} fill="currentColor" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-base font-extrabold leading-5">Butta Health</p>
          <p className="text-xs font-semibold text-muted">Your health. Your story.</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {showInsightTrigger && (
          <button
            onClick={onOpenInsightRail}
            className="grid h-10 w-10 place-items-center rounded-lg border border-line bg-paper2 text-muted 2xl:hidden"
            aria-label="Open patient insights"
            title="Patient insights"
          >
            <Activity size={18} />
          </button>
        )}
        <button onClick={onSignOut} className="grid h-10 w-10 place-items-center rounded-lg border border-line bg-paper2" aria-label="Sign out" title="Sign out">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}

function HeaderBand({ metrics }: { metrics: { monitoring: number; symptoms: number; records: number } }) {
  return (
    <div className="scroll-row -mx-4 mb-5 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0">
      <Metric icon={FileCheck2} label="Structured records" value={metrics.records} detail="Ready for review" />
      <Metric icon={HeartPulse} label="Symptom events" value={metrics.symptoms} detail="Timeline ready" />
      <Metric icon={AlertTriangle} label="Watch items" value={metrics.monitoring} detail="Needs attention" />
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Activity;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="surface-card stagger-in min-w-[216px] snap-start rounded-lg px-4 py-4 sm:min-w-0">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal/10 text-teal">
          <Icon size={19} strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-xs font-bold text-muted">{label}</span>
          <span className="mt-0.5 block text-2xl font-extrabold leading-7 text-ink">{value}</span>
        </div>
      </div>
      <p className="mt-3 border-t border-line pt-2 text-xs font-semibold text-muted">{detail}</p>
    </div>
  );
}

function CaptureView({
  observation,
  setObservation,
  openConfirm,
  extracting,
  aiConsent,
  onEnableAiCapture,
  records,
  isDemo,
}: {
  observation: string;
  setObservation: (value: string) => void;
  openConfirm: (source?: ExtractedRecord["source"], attachmentIds?: string[], symptomTags?: string[]) => void;
  extracting: boolean;
  aiConsent: AiConsent | null;
  onEnableAiCapture: () => void;
  records: HealthRecord[];
  isDemo: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  const showAiBanner = aiConsent !== null && !aiConsent.granted && !dismissed;

  return (
    <div className="space-y-5">
      {showAiBanner && (
        <div className="stagger-in flex flex-col items-start justify-between gap-3 rounded-lg border border-teal/25 bg-teal/5 p-4 sm:flex-row sm:items-center">
          <p className="text-sm font-semibold leading-6 text-tealDark">
            Turn on AI-assisted capture in Settings for smarter, more accurate extraction from what you type. You will always review and confirm before anything is saved.
          </p>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={onEnableAiCapture} className="min-h-10 rounded-lg bg-teal px-4 text-sm font-extrabold text-white transition hover:bg-tealDark">
              Turn on
            </button>
            <button type="button" onClick={() => setDismissed(true)} className="min-h-10 rounded-lg border border-line bg-white px-4 text-sm font-extrabold text-muted transition hover:bg-well">
              Not now
            </button>
          </div>
        </div>
      )}
      <section
        className="stagger-in relative flex min-h-[420px] w-full flex-col overflow-hidden rounded-lg bg-cover bg-center p-5 sm:p-7"
        style={{ backgroundImage: "url('/assets/wellness-workspace.png')" }}
        role="img"
        aria-label="Warm desk with health journal, water, medication organizer, tablet, and smartwatch"
      >
        <div className="absolute inset-0 bg-[#173f35]/55" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#173f35]/90 via-[#173f35]/55 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#173f35]/80 via-transparent to-transparent" />
        <div className="relative min-w-0 max-w-2xl">
          <h2 className="max-w-full break-words font-serif text-3xl leading-[1.12] text-white sm:text-4xl">
            How are you feeling right now?
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-white/80">
            Type in plain language. Butta organizes the details into editable medical fields before anything is saved.
          </p>
        </div>

        <div className="relative mt-auto flex w-full justify-center pt-8">
          <div className="w-full max-w-xl">
            <ObservationComposer
              observation={observation}
              setObservation={setObservation}
              extracting={extracting}
              onSubmit={(attachmentIds, symptomTags) => void openConfirm("Typed", attachmentIds, symptomTags)}
              allowAttachments={!isDemo}
              symptomTagOptions={presets}
            />
          </div>
        </div>
      </section>

      <section className="stagger-in grid gap-4 lg:grid-cols-[1fr_1.15fr]">
        <ClinicalPanel records={records} />
        <ExtractionPreview observation={observation} />
      </section>
    </div>
  );
}

function ClinicalPanel({ records }: { records: HealthRecord[] }) {
  const recentRecords = records.filter(
    (record) => Date.now() - new Date(record.eventDate).getTime() <= 48 * 60 * 60 * 1000,
  );

  return (
    <div className="surface-card rounded-lg p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded bg-paper text-teal ring-1 ring-line">
          <FlaskConical size={22} />
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-emerald">Your history</p>
          <h3 className="font-serif text-2xl">48-hour context</h3>
        </div>
      </div>
      {recentRecords.length ? (
        <ul className="mt-4 space-y-2">
          {recentRecords.slice(0, 3).map((record) => (
            <li key={record.id} className="text-base leading-7 text-muted">
              <span className="font-semibold text-ink">{typeLabels[record.type]}:</span> {record.title}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-base leading-7 text-muted">
          No events recorded in the last 48 hours. New entries will appear here for context as you log them.
        </p>
      )}
    </div>
  );
}

function ExtractionPreview({ observation }: { observation: string }) {
  const preview = observation.trim() ? parseObservation(observation, "Typed") : null;
  return (
    <div className="surface-card rounded-lg p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">Detected entities</h3>
        <span className="badge border border-amber/20 bg-amber/10 text-amber">
          <span className="badge-dot" />
          <span>Draft</span>
        </span>
      </div>
      {preview ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Entity label="Type" value={typeLabels[preview.type]} />
          <Entity label="Severity" value={preview.severity} />
          <Entity label="Title" value={preview.title} />
          <Entity label="Fields" value={`${preview.symptoms.length} extracted`} />
        </div>
      ) : (
        <p className="text-sm text-muted">Enter an observation to preview extracted structure.</p>
      )}
    </div>
  );
}

function Entity({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-well/70 px-3 py-2.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">{label}</p>
      <p className="mt-1 truncate font-bold text-ink" title={value}>{value}</p>
    </div>
  );
}

function TimelineView({
  records,
  rawCount,
  search,
  setSearch,
  filter,
  setFilter,
  setActiveView,
}: {
  records: HealthRecord[];
  rawCount: number;
  search: string;
  setSearch: (value: string) => void;
  filter: RecordType | "ALL";
  setFilter: (value: RecordType | "ALL") => void;
  setActiveView: (view: ViewId) => void;
}) {
  return (
    <div className="space-y-5">
      <section className="surface-card stagger-in rounded-lg p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">Longitudinal health record</p>
            <h2 className="mt-2 font-serif text-4xl">Clinical timeline</h2>
            <p className="mt-2 max-w-2xl text-muted">
              Searchable, structured patient entries with category filtering and expandable doctor context.
            </p>
          </div>
          <div className="relative min-w-0 lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-12 w-full rounded border border-line bg-well pl-10 pr-3 outline-none transition focus:border-teal focus:ring-1 focus:ring-teal"
              placeholder="Search records"
            />
          </div>
        </div>
        <button type="button" onClick={() => setActiveView("doctor-prep")} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-extrabold text-teal transition hover:border-teal/40 hover:bg-well">
          <FileCheck2 size={17} />
          Prepare for a doctor visit
        </button>
        <div className="scroll-row -mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {filters.map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`min-h-10 shrink-0 rounded-full border px-4 text-xs font-extrabold transition ${
                filter === item
                  ? "border-teal bg-teal text-paper"
                  : "border-line bg-paper text-muted hover:border-teal/40 hover:text-ink"
              }`}
            >
              {item === "ALL" ? "All" : typeLabels[item]}
            </button>
          ))}
        </div>
      </section>

      <div className="space-y-3">
        {records.map((record) => (
          <TimelineCard key={record.id} record={record} />
        ))}
        {!records.length && (
          <div className="surface-card rounded-lg p-8 text-center text-muted">
            No matching records found in {rawCount} entries.
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineCard({ record }: { record: HealthRecord }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="surface-card stagger-in overflow-hidden rounded-lg p-4 transition-shadow hover:shadow-float">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start gap-4 text-left"
      >
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-teal/10 text-teal">
          <Activity size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center">
            <h3 className="min-w-0 max-w-full truncate font-serif text-xl sm:flex-1" title={record.title}>{record.title}</h3>
            <div className="flex max-w-full gap-2 overflow-hidden">
              <TypeBadge type={record.type} />
              <SeverityBadge severity={record.severity} />
            </div>
          </div>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-xs font-semibold text-faint">
            <span>{formatDate(record.eventDate)}</span>
            <span>{record.source}</span>
            <StatusBadge status={record.status} />
          </div>
        </div>
        <ChevronRight className={`mt-2 shrink-0 text-faint transition ${open ? "rotate-90" : ""}`} size={18} />
      </button>
      {open && (
        <div className="mt-4 grid gap-3 border-t border-line pt-4 md:grid-cols-[1fr_1.25fr]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Extracted symptoms</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {record.symptoms.map((symptom) => (
                <span key={symptom} className="badge border border-line bg-well text-muted" title={symptom}>
                  <span>{symptom}</span>
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Patient notes</p>
            <p className="mt-2 text-sm leading-6 text-muted">{record.notes}</p>
            <p className="mt-3 text-sm leading-6 text-muted">{record.treatment}</p>
          </div>
        </div>
      )}
    </article>
  );
}

function CompanionView({ records }: { records: HealthRecord[] }) {
  const latest = records[0];
  return (
    <div className="space-y-5">
      <section className="surface-card stagger-in rounded-lg p-5">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded bg-rust/10 text-rust">
            <AlertTriangle size={22} />
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-rust">Non-diagnostic support</p>
            <h2 className="mt-2 font-serif text-4xl">Health companion</h2>
            <p className="mt-2 max-w-3xl text-muted">
              This surface gives general relief practices and monitoring prompts. It does not diagnose, prescribe, or replace a clinician.
            </p>
          </div>
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-3">
        {companionTips.map((tip) => (
          <div key={tip.title} className="surface-card stagger-in rounded-lg p-5">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-emerald/10 text-emerald">
              <ShieldCheck size={21} />
            </span>
            <h3 className="mt-4 font-serif text-2xl">{tip.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted">{tip.body}</p>
          </div>
        ))}
      </section>
      <section className="surface-card stagger-in rounded-lg p-5">
        <h3 className="font-serif text-3xl">Guided self-check</h3>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {[
            "When did the symptom start, and has it changed since then?",
            "Is there a clear trigger such as standing, food, exertion, medication, sleep, or stress?",
            "What helped, what did not help, and how long did relief last?",
            "Are there new or worsening symptoms that should be raised with a clinician promptly?",
          ].map((question) => (
            <label key={question} className="soft-card flex items-start gap-3 rounded-lg p-3 text-sm leading-6 text-muted transition hover:border-teal/30">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-teal" />
              {question}
            </label>
          ))}
        </div>
        {latest && (
          <div className="mt-5 rounded border border-gold/30 bg-gold/10 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#725900]">Based on latest record</p>
            <p className="mt-1 text-sm leading-6 text-muted">
              Latest entry is "{latest.title}". Track change, recurrence, and response to supportive care for the next doctor review.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function DoctorPrepView({
  records,
  selectedIds,
  setSelectedIds,
  setActiveView,
}: {
  records: HealthRecord[];
  selectedIds: string[];
  setSelectedIds: (value: string[]) => void;
  setActiveView: (view: ViewId) => void;
}) {
  function toggle(id: string) {
    setSelectedIds(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
  }

  return (
    <div className="space-y-5">
      <section className="surface-card stagger-in rounded-lg p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">Consultation builder</p>
        <h2 className="mt-2 font-serif text-4xl">Doctor visit prep</h2>
        <p className="mt-2 max-w-3xl text-muted">
          Select relevant entries and generate a focused clinical bundle. The mock API aggregates only the selected records.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={() => setSelectedIds(records.slice(0, 5).map((record) => record.id))}
            className="rounded border border-line bg-paper px-4 py-2 font-semibold text-ink transition hover:border-teal/40"
          >
            Select recent five
          </button>
          <button
            onClick={() => setSelectedIds(records.filter((record) => record.type === "SYMPTOM").map((record) => record.id))}
            className="rounded border border-line bg-paper px-4 py-2 font-semibold text-ink transition hover:border-teal/40"
          >
            Select symptoms
          </button>
          <button
            onClick={() => setActiveView("doctor-summary")}
            className="rounded bg-teal px-4 py-2 font-semibold text-paper transition hover:bg-tealDark"
          >
            Generate summary
          </button>
        </div>
      </section>
      <div className="grid gap-3">
        {records.map((record) => (
          <button
            key={record.id}
            onClick={() => toggle(record.id)}
            className={`stagger-in flex min-w-0 flex-col items-start gap-3 rounded-lg border p-4 text-left shadow-[0_5px_18px_rgba(27,52,45,.04)] transition sm:flex-row sm:gap-4 ${
              selectedIds.includes(record.id)
                ? "border-teal bg-teal/10"
                : "border-line bg-paper2 hover:border-teal/40"
            }`}
          >
            <span
              className={`mt-1 grid h-6 w-6 shrink-0 place-items-center rounded border ${
                selectedIds.includes(record.id) ? "border-teal bg-teal text-paper" : "border-line bg-paper"
              }`}
            >
              {selectedIds.includes(record.id) && <Check size={15} />}
            </span>
            <span className="min-w-0 max-w-full flex-1">
              <span className="block max-w-full truncate font-serif text-xl" title={record.title}>{record.title}</span>
              <span className="mt-1 block font-mono text-[11px] uppercase tracking-[0.12em] text-faint">
                {record.id} / {formatDate(record.eventDate)}
              </span>
            </span>
            <span className="max-w-full sm:ml-auto"><TypeBadge type={record.type} /></span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DoctorSummaryView({
  summary,
  selectedRecords,
}: {
  summary: DoctorSummary | null;
  selectedRecords: HealthRecord[];
}) {
  return (
    <div className="space-y-5">
      <section className="surface-card stagger-in rounded-lg p-5 print:border-0 print:bg-white print:shadow-none">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">Doctor-facing export</p>
            <h2 className="mt-2 font-serif text-4xl">Clinical snapshot</h2>
            <p className="mt-2 max-w-3xl text-muted">
              A concise, printable report organized for a physician workflow.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded border border-line bg-paper px-4 py-2 font-semibold">
              <Printer size={17} />
              Print
            </button>
            <button className="inline-flex items-center gap-2 rounded bg-teal px-4 py-2 font-semibold text-paper">
              <Download size={17} />
              Export
            </button>
          </div>
        </div>
      </section>

      <section className="surface-card stagger-in overflow-hidden rounded-lg p-5 print:shadow-none">
        <div className="border-b border-line pb-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">Butta Health clinical summary</p>
          <h3 className="mt-2 font-serif text-3xl">{summary?.chiefComplaint || "Preparing summary"}</h3>
          <p className="mt-2 text-sm text-muted">
            Generated {summary ? formatDate(summary.generatedAt, "long") : "after records load"} from {summary?.selectedCount || selectedRecords.length} selected records.
          </p>
        </div>
        <div className="grid gap-5 py-5 md:grid-cols-2">
          <ReportBlock title="Chief complaint" value={summary?.chiefComplaint || "No chief complaint available"} />
          <ReportBlock title="Reported frequency" value={summary?.frequency || "No frequency calculated"} />
          <ReportBlock title="Active profile" value="Adult patient profile, medications and allergies not verified in prototype." />
          <ReportBlock title="Clinical boundary" value="Patient-generated record. Non-diagnostic system output. Confirm details during visit." />
        </div>
        <div className="border-t border-line pt-5">
          <h4 className="font-serif text-2xl">Selected timeline</h4>
          <div className="mt-3 divide-y divide-line">
            {(summary?.records || selectedRecords).map((record) => (
              <div key={record.id} className="grid min-w-0 gap-2 py-3 md:grid-cols-[148px_minmax(0,1fr)_140px]">
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-faint">{formatDate(record.eventDate)}</p>
                <div>
                  <p className="font-semibold text-ink">{record.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted">{record.notes}</p>
                </div>
                <div className="min-w-0 md:justify-self-end"><TypeBadge type={record.type} /></div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function ReportBlock({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted">{value}</p>
    </div>
  );
}

function InsightRailContent({
  user,
  records,
  selectedRecords,
  setActiveView,
}: {
  user: AppUser;
  records: HealthRecord[];
  selectedRecords: HealthRecord[];
  setActiveView: (view: ViewId) => void;
}) {
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const recentCount = records.filter((record) => now - new Date(record.eventDate).getTime() <= sevenDaysMs).length;
  const priorCount = records.filter((record) => {
    const age = now - new Date(record.eventDate).getTime();
    return age > sevenDaysMs && age <= sevenDaysMs * 2;
  }).length;
  const trendLabel =
    priorCount === 0 && recentCount === 0
      ? "No activity yet"
      : recentCount > priorCount
        ? "More than last week"
        : recentCount < priorCount
          ? "Fewer than last week"
          : "Same as last week";
  const activityBarWidth = Math.min(100, (recentCount / Math.max(1, recentCount, priorCount)) * 100);

  return (
    <div className="space-y-4 pr-1">
      <section className="surface-card rounded-lg p-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">Patient context</p>
        <div className="mt-4 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-teal text-paper">
            <UserRound size={22} />
          </div>
          <div>
            <h3 className="truncate font-serif text-2xl" title={`${user.firstName} ${user.lastName}`}>{user.firstName} {user.lastName}</h3>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-faint">{user.demo ? "Demo profile" : "Private profile"}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Entity label="Records" value={String(records.length)} />
          <Entity label="Selected" value={String(selectedRecords.length)} />
        </div>
      </section>
      <section className="surface-card rounded-lg p-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">Recent activity</p>
        <div className="mt-3 flex items-end justify-between">
          <h3 className="font-serif text-2xl">Events logged</h3>
          <p className="whitespace-nowrap text-xl font-extrabold">{recentCount} <span className="text-xs text-faint">last 7 days</span></p>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-well">
          <div className="h-full rounded-full bg-emerald transition-[width] duration-500" style={{ width: `${activityBarWidth}%` }} />
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
          <span>Prior week: {priorCount}</span>
          <span className="text-emerald">{trendLabel}</span>
        </div>
      </section>
      <button
        onClick={() => setActiveView("doctor-summary")}
        className="flex w-full items-center justify-between rounded-lg bg-teal px-4 py-4 text-left font-semibold text-paper transition hover:bg-tealDark"
      >
        <span>Open doctor snapshot</span>
        <FileCheck2 size={19} />
      </button>
    </div>
  );
}

function InsightRail({
  user,
  records,
  selectedRecords,
  setActiveView,
}: {
  user: AppUser;
  records: HealthRecord[];
  selectedRecords: HealthRecord[];
  setActiveView: (view: ViewId) => void;
}) {
  return (
    <aside className="fixed bottom-0 right-0 top-[72px] z-20 hidden w-[320px] overflow-y-auto border-l border-line bg-paper p-5 2xl:block">
      <InsightRailContent user={user} records={records} selectedRecords={selectedRecords} setActiveView={setActiveView} />
    </aside>
  );
}

function MobileInsightDrawer({
  user,
  records,
  selectedRecords,
  setActiveView,
  onClose,
}: {
  user: AppUser;
  records: HealthRecord[];
  selectedRecords: HealthRecord[];
  setActiveView: (view: ViewId) => void;
  onClose: () => void;
}) {
  const drawerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!drawerRef.current) return;
    const context = gsap.context(() => {
      gsap.fromTo(".insight-drawer-backdrop", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.22, clearProps: "opacity,visibility,willChange" });
      gsap.fromTo(".insight-drawer-panel", { autoAlpha: 0, x: 42 }, { autoAlpha: 1, x: 0, duration: 0.4, ease: "power3.out", clearProps: "transform,opacity,visibility,willChange" });
    }, drawerRef);

    return () => context.revert();
  }, []);

  return (
    <div ref={drawerRef} className="fixed inset-0 z-50 2xl:hidden">
      <div className="insight-drawer-backdrop absolute inset-0 bg-ink/45 backdrop-blur-sm" onClick={onClose} />
      <div className="insight-drawer-panel absolute bottom-0 right-0 top-0 w-full max-w-sm overflow-y-auto border-l border-line bg-paper p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">Patient insights</p>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded border border-line bg-paper2" aria-label="Close patient insights">
            <X size={18} />
          </button>
        </div>
        <InsightRailContent user={user} records={records} selectedRecords={selectedRecords} setActiveView={setActiveView} />
      </div>
    </div>
  );
}

function ConfirmModal({
  extracted,
  setExtracted,
  original,
  safety,
  educationalContext,
  saving,
  error,
  onClose,
  onSave,
}: {
  extracted: ExtractedRecord;
  setExtracted: (record: ExtractedRecord) => void;
  original: string;
  safety: AiSafetyMetadata | null;
  educationalContext: string[];
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!modalRef.current) return;
    const context = gsap.context(() => {
      gsap.fromTo(".modal-backdrop", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.22, clearProps: "opacity,visibility,willChange" });
      gsap.fromTo(".modal-panel", { autoAlpha: 0, x: 42 }, { autoAlpha: 1, x: 0, duration: 0.4, ease: "power3.out", clearProps: "transform,opacity,visibility,willChange" });
    }, modalRef);

    return () => context.revert();
  }, []);

  return (
    <div ref={modalRef} className="fixed inset-0 z-50">
      <div className="modal-backdrop absolute inset-0 bg-ink/45 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-panel absolute bottom-0 right-0 top-auto max-h-[92vh] w-full overscroll-contain overflow-y-auto overflow-x-hidden rounded-t-lg border border-line bg-paper p-5 shadow-2xl sm:bottom-4 sm:right-4 sm:top-4 sm:max-w-2xl sm:rounded-lg sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">Confirmation gate</p>
            <h2 className="mt-2 font-serif text-4xl">Review before saving</h2>
          </div>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded border border-line bg-paper2">
            <X size={18} />
          </button>
        </div>
        {safety?.urgent && (
          <div role="alert" className="mt-4 flex items-start gap-3 rounded-lg border border-rust/30 bg-rust/5 p-4">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-rust" />
            <p className="text-sm font-semibold leading-6 text-rust">{safety.advisory}</p>
          </div>
        )}
        {educationalContext.length > 0 && (
          <div className="mt-4 rounded-lg border border-teal/25 bg-teal/5 p-4">
            <div className="flex items-start gap-3">
              <Info size={20} className="mt-0.5 shrink-0 text-tealDark" />
              <div className="min-w-0">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-tealDark">
                  General education, not a diagnosis
                </p>
                <ul className="mt-2 space-y-1.5 text-sm leading-6 text-muted">
                  {educationalContext.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs leading-5 text-faint">
                  This is general information, not advice about your specific case. Butta Health does not
                  diagnose conditions or recommend treatment — talk to a clinician for medical guidance.
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="surface-card min-w-0 rounded-lg p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">What you said</p>
            <p className="mt-3 text-base leading-7 text-muted">{original}</p>
          </div>
          <div className="surface-card min-w-0 rounded-lg p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Extracted medical record</p>
            <div className="mt-3 space-y-3">
              <EditField
                label="Title"
                value={extracted.title}
                onChange={(value) => setExtracted({ ...extracted, title: value })}
              />
              <EditField
                label="Treatment"
                value={extracted.treatment}
                onChange={(value) => setExtracted({ ...extracted, treatment: value })}
              />
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Severity</span>
                <select
                  value={extracted.severity}
                  onChange={(event) => setExtracted({ ...extracted, severity: event.target.value as ExtractedRecord["severity"] })}
                  className="mt-1 h-10 w-full rounded border border-line bg-paper px-3 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
                >
                  <option>Mild</option>
                  <option>Moderate</option>
                  <option>Severe</option>
                  <option>Not specified</option>
                </select>
              </label>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Symptoms</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {extracted.symptoms.map((item) => (
                    <span key={item} className="badge border border-line bg-well text-muted" title={item}>
                      <span>{item}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button onClick={onClose} className="rounded border border-line bg-paper2 px-5 py-3 font-semibold text-ink">
            Keep editing
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded bg-teal px-5 py-3 font-semibold text-paper transition hover:bg-tealDark disabled:cursor-wait disabled:opacity-70"
          >
            {saving ? "Saving record" : "Confirm and save record"}
            <ArrowRight size={18} />
          </button>
        </div>
        {error && <p role="alert" className="mt-3 text-right text-sm font-semibold text-rust">{error}</p>}
      </div>
    </div>
  );
}

function EditField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded border border-line bg-paper px-3 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
      />
    </label>
  );
}

function StatusStrip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 font-mono text-[11px] uppercase tracking-[0.13em]">
      <span className="text-faint">{label}</span>
      <span className="text-teal">{value}</span>
    </div>
  );
}

function MobileNav({ activeView, onChange }: { activeView: ViewId; onChange: (view: ViewId) => void }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-tealDark/30 bg-teal text-paper shadow-2xl lg:hidden">
      <div className="grid grid-cols-5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`flex min-h-[72px] flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold transition ${
                active ? "text-gold" : "text-paper/70"
              }`}
            >
              <Icon size={20} />
              <span className="max-w-full truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default App;
