import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  HeartPulse,
  Leaf,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { FormEvent, useLayoutEffect, useRef, useState } from "react";
import { ApiError, buttaApi, type AppUser, type HealthProfileInput } from "../services/api";
import { DEMO_PROFILE_KEY } from "../services/demoStorage";
import { AnimatedSelect } from "./AnimatedSelect";

gsap.registerPlugin(ScrollTrigger);

type PublicScreen = "home" | "signin" | "signup" | "onboarding";
type AuthMode = "signin" | "signup";

type PublicExperienceProps = {
  onEnter: (user: AppUser) => void;
  notice?: string;
};

const demoUser: AppUser = {
  id: "demo-user",
  email: "maya@demo.butta.health",
  firstName: "Maya",
  lastName: "Chen",
  demo: true,
};

function routeToScreen(): PublicScreen {
  if (window.location.pathname === "/signin") return "signin";
  if (window.location.pathname === "/signup") return "signup";
  if (window.location.pathname === "/onboarding") return "onboarding";
  return "home";
}

function screenPath(screen: PublicScreen) {
  return screen === "home" ? "/" : `/${screen}`;
}

export function PublicExperience({ onEnter, notice }: PublicExperienceProps) {
  const [screen, setScreen] = useState<PublicScreen>(routeToScreen);
  const [pendingUser, setPendingUser] = useState<AppUser | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  function transitionScreen(commit: () => void) {
    const currentScreen = stageRef.current?.querySelector(".public-screen");
    if (!currentScreen) {
      commit();
      return;
    }

    gsap.killTweensOf(currentScreen);
    gsap.to(currentScreen, {
      autoAlpha: 0,
      y: -20,
      scale: 0.995,
      pointerEvents: "none",
      duration: 0.36,
      ease: "power2.in",
      onComplete: () => {
        gsap.set(currentScreen, {
          clearProps: "opacity,visibility,transform,pointerEvents",
        });
        commit();
      },
    });
  }

  function navigate(next: PublicScreen) {
    if (next === screen) return;

    const commit = () => {
      window.history.pushState({}, "", screenPath(next));
      setScreen(next);
    };
    transitionScreen(commit);
  }

  useLayoutEffect(() => {
    const onPopState = () => setScreen(routeToScreen());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useLayoutEffect(() => {
    if (!stageRef.current) return;
    const context = gsap.context(() => {
      const incomingScreen = stageRef.current?.querySelector(".public-screen");
      if (incomingScreen) {
        gsap.set(incomingScreen, {
          clearProps: "opacity,visibility,transform,pointerEvents",
        });
      }

      const isLanding = Boolean(stageRef.current?.querySelector(".hero-visual-frame"));
      const isAuth = Boolean(stageRef.current?.querySelector(".auth-left-section"));
      const timeline = gsap.timeline({ delay: 0.3, defaults: { ease: "expo.out" } });

      if (isLanding) {
        timeline
          .fromTo(".public-header", { autoAlpha: 0, y: -96 }, { autoAlpha: 1, y: 0, duration: 0.9 })
          .fromTo(
            ".hero-left-section",
            { autoAlpha: 0, x: -180 },
            { autoAlpha: 1, x: 0, duration: 1.1, clearProps: "transform" },
            "-=0.35",
          )
          .fromTo(
            ".hero-right-section",
            { autoAlpha: 0, x: 180 },
            { autoAlpha: 1, x: 0, duration: 1.1, clearProps: "transform" },
            "-=0.82",
          )
          .fromTo(
            ".hero-copy-item",
            { autoAlpha: 0, y: 34 },
            { autoAlpha: 1, y: 0, duration: 0.72, stagger: 0.11, ease: "power3.out" },
            "-=0.72",
          )
          .fromTo(
            ".hero-visual-frame",
            { clipPath: "inset(0 0 100% 0)", scale: 0.94 },
            { clipPath: "inset(0 0 0% 0)", scale: 1, duration: 1, ease: "power3.out" },
            "-=0.92",
          )
          .fromTo(
            ".hero-float",
            { autoAlpha: 0, y: 28, scale: 0.84 },
            { autoAlpha: 1, y: 0, scale: 1, duration: 0.62, stagger: 0.14, ease: "back.out(1.5)" },
            "-=0.4",
          )
          .fromTo(".hero-support", { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.62 }, "-=0.12")
          .call(() => {
            gsap.to(".hero-float-a", { y: -7, duration: 2.8, repeat: -1, yoyo: true, ease: "sine.inOut" });
            gsap.to(".hero-float-b", { y: 7, duration: 3.2, repeat: -1, yoyo: true, ease: "sine.inOut" });
            gsap.to(".hero-float-c", { y: -5, duration: 3.5, repeat: -1, yoyo: true, ease: "sine.inOut" });
          });

        const header = stageRef.current?.querySelector(".public-header");
        if (header) {
          ScrollTrigger.create({
            start: 28,
            end: "max",
            onUpdate: (self) => header.classList.toggle("is-scrolled", self.scroll() > 28),
          });
        }

        gsap.fromTo(
          ".detail-reveal",
          { autoAlpha: 0, y: 48 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.8,
            stagger: 0.12,
            ease: "power3.out",
            scrollTrigger: { trigger: ".landing-detail", start: "top 78%", once: true },
          },
        );
      } else if (isAuth) {
        timeline
          .fromTo(".auth-header", { autoAlpha: 0, y: -88 }, { autoAlpha: 1, y: 0, duration: 0.82 })
          .fromTo(
            ".auth-left-section",
            { autoAlpha: 0, x: -180 },
            { autoAlpha: 1, x: 0, duration: 1.05, clearProps: "transform,opacity,visibility,willChange" },
            "-=0.3",
          )
          .fromTo(
            ".auth-image-reveal",
            { clipPath: "inset(0 100% 0 0)", scale: 1.04 },
            { clipPath: "inset(0 0% 0 0)", scale: 1, duration: 1.05 },
            "-=0.72",
          )
          .fromTo(
            ".auth-overlay-nav",
            { autoAlpha: 0, y: -24 },
            { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out" },
            "-=0.6",
          )
          .fromTo(
            ".auth-right-section",
            { autoAlpha: 0, x: 180 },
            { autoAlpha: 1, x: 0, duration: 1.05, clearProps: "transform" },
            "-=0.84",
          )
          .fromTo(
            ".auth-form-content",
            { autoAlpha: 0, y: 28 },
            { autoAlpha: 1, y: 0, duration: 0.62, stagger: 0.06, ease: "power3.out" },
            "-=0.55",
          );
      } else {
        timeline
          .fromTo(".public-visual", { autoAlpha: 0, x: -36 }, { autoAlpha: 1, x: 0, duration: 0.8 })
          .fromTo(".public-reveal", { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.72, stagger: 0.1 }, "-=0.45");
      }
    }, stageRef);
    return () => context.revert();
  }, [screen]);

  function enterDemo() {
    const commit = () => {
      window.history.pushState({}, "", "/app/dashboard");
      onEnter(demoUser);
    };
    transitionScreen(commit);
  }

  return (
    <div ref={stageRef} className="min-h-screen overflow-x-hidden bg-paper text-ink">
      {screen === "home" && <LandingPage key="home" navigate={navigate} enterDemo={enterDemo} />}
      {(screen === "signin" || screen === "signup") && (
        <AuthPage
          key={screen}
          mode={screen}
          navigate={navigate}
          enterDemo={enterDemo}
          notice={screen === "signin" ? notice : undefined}
          onAuthenticated={(user, isNew) => {
            setPendingUser(user);
            if (isNew) navigate("onboarding");
            else {
              window.history.pushState({}, "", "/app/dashboard");
              onEnter(user);
            }
          }}
        />
      )}
      {screen === "onboarding" && (
        <OnboardingPage
          key="onboarding"
          user={pendingUser || demoUser}
          onBack={() => navigate("signup")}
          onComplete={(user) => {
            window.history.pushState({}, "", "/app/dashboard");
            onEnter(user);
          }}
        />
      )}
    </div>
  );
}

function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${inverse ? "text-white" : "text-ink"}`}>
      <span className={`grid h-11 w-11 place-items-center rounded-lg ${inverse ? "bg-white/15" : "bg-teal text-white shadow-lift"}`}>
        <Leaf size={22} fill="currentColor" strokeWidth={1.5} />
      </span>
      <span>
        <span className="block text-lg font-extrabold leading-5 sm:text-xl">Butta Health</span>
        <span className={`mt-1 hidden text-xs font-semibold sm:block ${inverse ? "text-white/70" : "text-muted"}`}>Your health. Your story.</span>
      </span>
    </div>
  );
}

function LandingPage({
  navigate,
  enterDemo,
}: {
  navigate: (screen: PublicScreen) => void;
  enterDemo: () => void;
}) {
  return (
    <main className="public-screen bg-[#f4f7f6]">
      <section className="relative min-h-screen overflow-hidden">
        <header className="public-header fixed inset-x-0 top-0 z-50 border-b border-transparent bg-transparent">
          <div className="navbar-inner mx-auto flex h-20 max-w-[1360px] items-center justify-between px-5 sm:px-8 lg:px-10">
            <Brand />
            <div className="flex items-center gap-2 sm:gap-3">
              <button onClick={() => navigate("signin")} className="rounded-lg px-3 py-2.5 text-sm font-extrabold text-teal transition hover:bg-well sm:px-4">
                Sign in
              </button>
              <button onClick={() => navigate("signup")} className="rounded-lg bg-teal px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition hover:-translate-y-0.5 hover:bg-tealDark sm:px-5">
                Get started
              </button>
            </div>
          </div>
        </header>

        <div className="relative z-10 mx-auto grid max-w-[1360px] items-center gap-10 px-5 pb-10 pt-28 sm:px-8 md:pt-32 lg:min-h-[730px] lg:grid-cols-[minmax(0,0.95fr)_minmax(440px,1.05fr)] lg:px-10 lg:pb-16 lg:pt-28">
          <div className="hero-left-section max-w-[590px] lg:pb-8">
            <span className="hero-copy-item badge border border-teal/15 bg-white/70 text-teal shadow-sm">
              <span className="badge-dot" />
              <span>Health clarity, one moment at a time</span>
            </span>
            <p className="hero-copy-item mt-7 text-sm font-extrabold text-teal">Better health today.</p>
            <h1 className="hero-copy-item mt-2 text-[clamp(2.75rem,5.4vw,5rem)] font-extrabold leading-[1] text-ink">
              A brighter<br /><span className="text-teal">tomorrow.</span>
            </h1>
            <p className="hero-copy-item mt-6 max-w-lg text-lg font-medium leading-8 text-muted sm:text-xl">
              Track how you feel, turn everyday details into a clear health story, and arrive at every appointment prepared.
            </p>
            <div className="hero-copy-item mt-8 flex flex-col gap-3 sm:flex-row">
              <button onClick={() => navigate("signup")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-teal px-6 font-extrabold text-white shadow-lift transition hover:-translate-y-0.5 hover:bg-tealDark">
                Start your health story <ArrowRight size={18} />
              </button>
              <button onClick={enterDemo} className="inline-flex min-h-12 items-center justify-center rounded-lg border border-teal/20 bg-white/75 px-6 font-extrabold text-teal shadow-sm transition hover:bg-white">
                Explore demo
              </button>
            </div>
            <div className="hero-copy-item mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-bold text-muted">
              <span className="inline-flex items-center gap-2"><Check size={16} className="text-teal" /> Private by design</span>
              <span className="inline-flex items-center gap-2"><Check size={16} className="text-teal" /> Choose what your doctor sees</span>
            </div>
          </div>

          <div className="hero-right-section relative mx-auto h-[390px] w-full max-w-[540px] sm:h-[500px] lg:h-[540px]">
            <div className="hero-visual-frame absolute bottom-5 left-[12%] top-5 w-[72%] overflow-hidden rounded-lg bg-[#dcebe4] shadow-float sm:left-[14%] sm:w-[70%]">
              <img
                src="/assets/butta-hero-wellness.png"
                alt="Woman enjoying a calm morning with a warm drink among green plants"
                className="h-full w-full object-cover object-[73%_center]"
              />
            </div>

            <div className="hero-float hero-float-a surface-card absolute left-0 top-[22%] flex max-w-[190px] items-center gap-3 rounded-lg px-3 py-2.5 sm:max-w-[220px] sm:px-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal/10 text-teal"><HeartPulse size={18} /></span>
              <span className="min-w-0"><span className="block text-[10px] font-extrabold text-faint">IN YOUR WORDS</span><span className="block truncate text-sm font-extrabold text-ink">Describe how you feel</span></span>
            </div>

            <div className="hero-float hero-float-b surface-card absolute right-0 top-[9%] w-[150px] rounded-lg p-3.5 sm:w-[174px] sm:p-4">
              <div className="flex items-center justify-between"><span className="text-[10px] font-extrabold text-faint">REVIEW FIRST</span><Sparkles size={16} className="text-gold" /></div>
              <p className="mt-3 text-base font-extrabold leading-5 text-ink">You approve every detail</p>
              <p className="mt-2 text-xs font-bold leading-4 text-teal">Nothing saves automatically</p>
            </div>

            <div className="hero-float hero-float-c surface-card absolute bottom-[9%] right-0 w-[190px] rounded-lg p-3.5 sm:w-[224px] sm:p-4">
              <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-amber/10 text-amber"><ShieldCheck size={16} /></span><span className="badge border border-emerald/15 bg-emerald/10 text-emerald"><span className="badge-dot" /><span>You stay in control</span></span></div>
              <p className="mt-3 truncate text-sm font-extrabold text-ink">Share only when you choose</p>
              <p className="mt-1 text-xs font-semibold text-muted">Your notes remain private by default</p>
            </div>
          </div>
        </div>

        <div className="hero-support relative z-10 border-y border-line bg-white/85 backdrop-blur">
          <div className="mx-auto grid max-w-3xl grid-cols-3 divide-x divide-line px-4 sm:px-8 lg:px-0">
            {[
              ["01", "Capture naturally"],
              ["02", "See the pattern"],
              ["03", "Choose what to share"],
            ].map(([step, label]) => (
              <div key={step} className="min-w-0 px-3 py-4 text-center sm:px-6 sm:py-5">
                <span className="block text-[10px] font-extrabold text-teal">{step}</span>
                <span className="mt-1 block truncate text-xs font-bold text-ink sm:text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="landing-detail min-h-[72vh] bg-white px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
        <div className="mx-auto max-w-[1160px]">
          <div className="detail-reveal max-w-2xl">
            <p className="text-sm font-extrabold text-teal">How Butta works</p>
            <h2 className="mt-3 text-3xl font-extrabold leading-tight text-ink sm:text-5xl">From a passing thought to useful health context.</h2>
            <p className="mt-5 text-lg font-semibold leading-8 text-muted">Butta helps you organize what happened without inventing a diagnosis or sharing anything automatically.</p>
          </div>
          <div className="mt-14 grid border-y border-line md:grid-cols-3 md:divide-x md:divide-line">
            {[
              ["01", "Capture naturally", "Write or speak the way you normally would. Start with one symptom, medication, or visit note."],
              ["02", "Review the structure", "Butta extracts useful details into editable fields. You confirm the wording before it becomes part of your timeline."],
              ["03", "Share intentionally", "Select only the records that matter for an appointment, then create a concise summary for the conversation."],
            ].map(([step, title, body]) => (
              <article key={step} className="detail-reveal px-1 py-8 md:px-8 md:py-10 first:md:pl-0 last:md:pr-0">
                <span className="text-xs font-extrabold text-teal">{step}</span>
                <h3 className="mt-4 text-xl font-extrabold text-ink">{title}</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-muted">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function AuthPage({
  mode,
  navigate,
  enterDemo,
  notice,
  onAuthenticated,
}: {
  mode: AuthMode;
  navigate: (screen: PublicScreen) => void;
  enterDemo: () => void;
  notice?: string;
  onAuthenticated: (user: AppUser, isNew: boolean) => void;
}) {
  const isSignUp = mode === "signup";
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", confirmPassword: "" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (isSignUp && form.password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (isSignUp && form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const result = isSignUp
        ? await buttaApi.register({
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            password: form.password,
          })
        : await buttaApi.login({ email: form.email, password: form.password });
      onAuthenticated(result.user, isSignUp);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "We could not complete that request.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="public-screen grid min-h-screen overflow-x-hidden bg-white lg:grid-cols-[minmax(420px,0.9fr)_minmax(520px,1.1fr)]">
        <section className="auth-left-section relative hidden h-screen overflow-hidden bg-teal lg:sticky lg:top-0 lg:block">
          <div className="auth-image-reveal absolute inset-0">
            <img src="/assets/butta-auth-wellness.png" alt="Woman pausing for a calm moment among green plants" className="h-full w-full object-cover object-center" />
          </div>
          <div className="auth-overlay-nav absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-[rgba(31,73,62,0.48)] p-8 backdrop-blur-[2px] xl:p-10">
            <Brand inverse />
            <button onClick={() => navigate("home")} className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25" aria-label="Back to home">
              <ArrowLeft size={20} />
            </button>
          </div>
        </section>

        <section className="auth-right-section flex min-h-screen min-w-0 items-center justify-center bg-paper px-5 py-8 sm:px-8 lg:px-10 xl:px-16">
          <div className="w-full max-w-[480px]">
          <div className="auth-header mb-8 flex items-center justify-between lg:hidden">
            <Brand />
            <button onClick={() => navigate("home")} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-muted" aria-label="Back to home"><ArrowLeft size={18} /></button>
          </div>
          <div className="surface-card rounded-lg p-5 sm:p-8">
            <div className="auth-form-content grid grid-cols-2 rounded-lg bg-well p-1">
              <button onClick={() => navigate("signin")} className={`min-h-10 rounded-md text-sm font-extrabold transition ${!isSignUp ? "bg-white text-teal shadow-sm" : "text-muted"}`}>Sign in</button>
              <button onClick={() => navigate("signup")} className={`min-h-10 rounded-md text-sm font-extrabold transition ${isSignUp ? "bg-white text-teal shadow-sm" : "text-muted"}`}>Create account</button>
            </div>

            <div className="auth-form-content mt-7">
              <span className="badge border border-teal/15 bg-teal/10 text-teal"><span className="badge-dot" /><span>{isSignUp ? "Begin your health story" : "Welcome back"}</span></span>
              <h1 className="mt-4 text-3xl font-extrabold leading-tight">{isSignUp ? "Create your account" : "Sign in to Butta Health"}</h1>
              <p className="mt-2 text-sm font-semibold leading-6 text-muted">{isSignUp ? "A few details, then we will personalize your profile." : "Continue building a clear record of how you feel."}</p>
            </div>

            {notice && (
              <div role="status" className="auth-form-content mt-5 rounded-lg border border-gold/30 bg-gold/10 px-4 py-3 text-sm font-bold leading-5 text-[#8a6800]">
                {notice}
              </div>
            )}

            <form onSubmit={submit} className="auth-form-content mt-7 space-y-4">
              {isSignUp && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="First name" value={form.firstName} onChange={(value) => setForm({ ...form, firstName: value })} icon={UserRound} autoComplete="given-name" required />
                  <TextField label="Last name" value={form.lastName} onChange={(value) => setForm({ ...form, lastName: value })} icon={UserRound} autoComplete="family-name" required />
                </div>
              )}
              <TextField label="Email address" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} icon={Mail} autoComplete="email" required />
              <div className="block">
                <label htmlFor="auth-password" className="text-sm font-extrabold text-ink">Password</label>
                <span className="relative mt-2 block">
                  <LockKeyhole className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" size={18} />
                  <input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    required
                    className="h-12 w-full rounded-lg border border-line bg-white pl-11 pr-12 text-sm font-semibold text-ink outline-none transition placeholder:text-faint focus:border-teal focus:ring-2 focus:ring-teal/10"
                    placeholder={isSignUp ? "8 characters minimum" : "Enter your password"}
                  />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-muted transition hover:bg-well hover:text-ink" aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </div>

              {isSignUp && (
                <div className="block">
                  <label htmlFor="auth-confirm-password" className="text-sm font-extrabold text-ink">Confirm password</label>
                  <span className="relative mt-2 block">
                    <LockKeyhole className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" size={18} />
                    <input
                      id="auth-confirm-password"
                      type={showPassword ? "text" : "password"}
                      value={form.confirmPassword}
                      onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
                      autoComplete="new-password"
                      required
                      className="h-12 w-full rounded-lg border border-line bg-white pl-11 pr-4 text-sm font-semibold text-ink outline-none transition placeholder:text-faint focus:border-teal focus:ring-2 focus:ring-teal/10"
                      placeholder="Re-enter your password"
                    />
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <label className="inline-flex cursor-pointer items-center gap-2 font-bold text-muted">
                  <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-4 w-4 accent-teal" />
                  Remember me
                </label>
                {!isSignUp && <button type="button" className="font-extrabold text-teal hover:text-tealDark">Forgot password?</button>}
              </div>

              {error && (
                <div role="alert" className="rounded-lg border border-rust/20 bg-rust/10 px-4 py-3 text-sm font-bold leading-5 text-rust">
                  {error}
                  {error.includes("not available") && <button type="button" onClick={enterDemo} className="mt-2 block font-extrabold underline underline-offset-2">Continue with the demo profile</button>}
                </div>
              )}

              <button disabled={loading} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-teal px-5 font-extrabold text-white shadow-lift transition hover:bg-tealDark disabled:cursor-wait disabled:opacity-65">
                {loading ? "Please wait" : isSignUp ? "Create account" : "Sign in"}
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>

            <div className="auth-form-content my-6 flex items-center gap-3 text-xs font-bold text-faint"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
            <button onClick={enterDemo} className="auth-form-content min-h-11 w-full rounded-lg border border-line bg-white text-sm font-extrabold text-muted transition hover:border-teal/30 hover:text-teal">Explore the prototype without an account</button>
          </div>

          <p className="auth-form-content mt-5 text-center text-xs font-semibold leading-5 text-faint">By continuing, you agree to Butta Health's terms and privacy notice.</p>
          </div>
      </section>
    </main>
  );
}

function TextField({
  label,
  value,
  onChange,
  icon: Icon,
  type = "text",
  autoComplete,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon: typeof Mail;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-extrabold text-ink">{label}</span>
      <span className="relative mt-2 block">
        <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" size={18} />
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} required={required} className="h-12 w-full min-w-0 rounded-lg border border-line bg-white pl-11 pr-3 text-sm font-semibold outline-none transition placeholder:text-faint focus:border-teal focus:ring-2 focus:ring-teal/10" placeholder={label} />
      </span>
    </label>
  );
}

function OnboardingPage({
  user,
  onBack,
  onComplete,
}: {
  user: AppUser;
  onBack: () => void;
  onComplete: (user: AppUser) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<HealthProfileInput>({
    dateOfBirth: null,
    sex: null,
    bloodGroup: null,
    allergies: [],
    existingConditions: [],
    currentMedications: [],
    emergencyContactName: null,
    emergencyContactPhone: null,
  });
  const [lists, setLists] = useState({ allergies: "", existingConditions: "", currentMedications: "" });

  async function finish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextProfile: HealthProfileInput = {
      ...profile,
      allergies: splitList(lists.allergies),
      existingConditions: splitList(lists.existingConditions),
      currentMedications: splitList(lists.currentMedications),
    };
    if (user.demo) {
      localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify(nextProfile));
      onComplete(user);
      return;
    }
    setLoading(true);
    setError("");
    try {
      await buttaApi.saveProfile(nextProfile);
      onComplete(user);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Your profile could not be saved.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="public-screen grid min-h-screen overflow-x-hidden bg-white lg:grid-cols-[minmax(420px,0.9fr)_minmax(520px,1.1fr)]">
      <section className="auth-left-section relative hidden h-screen overflow-hidden bg-teal lg:sticky lg:top-0 lg:block">
        <div className="auth-image-reveal absolute inset-0">
          <img src="/assets/butta-auth-wellness.png" alt="Calm wellness portrait" className="h-full w-full object-cover object-center" />
        </div>
        <div className="auth-overlay-nav absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-[rgba(31,73,62,0.48)] p-8 backdrop-blur-[2px] xl:p-10">
          <Brand inverse />
        </div>
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[rgba(20,46,39,0.92)] via-[rgba(20,46,39,0.55)] to-transparent p-8 pt-24 text-white xl:p-10 xl:pt-28">
          <Sparkles size={24} />
          <p className="mt-4 text-2xl font-extrabold leading-tight">Your profile helps each record carry the right context.</p>
          <p className="mt-3 text-sm font-semibold leading-6 text-white/70">You stay in control. Every field can be updated later.</p>
        </div>
      </section>

      <section className="flex min-h-screen justify-center overflow-y-auto px-5 py-6 sm:px-8 lg:items-center lg:py-10">
        <div className="public-reveal w-full max-w-3xl">
          <div className="flex items-center justify-between lg:hidden"><Brand /><span className="badge border border-teal/15 bg-teal/10 text-teal">Step {step} of 2</span></div>
          <div className="mt-8 flex items-center gap-4 lg:mt-0">
            <button onClick={step === 1 ? onBack : () => setStep(1)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-white text-muted" aria-label="Go back"><ArrowLeft size={18} /></button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-4 text-xs font-extrabold text-muted"><span>Complete your profile</span><span>Step {step} of 2</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"><div className={`h-full rounded-full bg-teal transition-all duration-500 ${step === 1 ? "w-1/2" : "w-full"}`} /></div>
            </div>
          </div>

          <form onSubmit={finish} className="surface-card mt-6 rounded-lg p-5 sm:p-8">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-teal/10 text-teal"><HeartPulse size={22} /></span>
              <div><h1 className="text-3xl font-extrabold leading-tight">{step === 1 ? "Tell us about you" : "Add your health context"}</h1><p className="mt-2 text-sm font-semibold leading-6 text-muted">{step === 1 ? "These basics help organize your personal health record." : "Leave anything blank that you would rather add later."}</p></div>
            </div>

            {step === 1 ? (
              <div className="mt-7 grid gap-5 sm:grid-cols-2">
                <label className="block"><span className="text-sm font-extrabold">Date of birth</span><input type="date" max={new Date().toISOString().slice(0, 10)} value={profile.dateOfBirth || ""} onChange={(event) => setProfile({ ...profile, dateOfBirth: event.target.value || null })} className="mt-2 h-12 w-full rounded-lg border border-line bg-white px-3 font-semibold outline-none focus:border-teal focus:ring-2 focus:ring-teal/10" /></label>
                <SelectField label="Sex" value={profile.sex || ""} onChange={(value) => setProfile({ ...profile, sex: value || null })} options={["Female", "Male"]} />
                <SelectField label="Blood group" value={profile.bloodGroup || ""} onChange={(value) => setProfile({ ...profile, bloodGroup: (value || null) as HealthProfileInput["bloodGroup"] })} options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]} />
                <div className="rounded-lg border border-teal/15 bg-teal/5 p-4"><ShieldCheck className="text-teal" size={20} /><p className="mt-3 text-sm font-extrabold">Private and editable</p><p className="mt-1 text-xs font-semibold leading-5 text-muted">Only information you choose is included in your summaries.</p></div>
              </div>
            ) : (
              <div className="mt-7 grid gap-5 sm:grid-cols-2">
                <ListField label="Allergies" placeholder="Peanuts, penicillin" value={lists.allergies} onChange={(value) => setLists({ ...lists, allergies: value })} />
                <ListField label="Existing conditions" placeholder="Asthma, migraine" value={lists.existingConditions} onChange={(value) => setLists({ ...lists, existingConditions: value })} />
                <ListField label="Current medications" placeholder="Medication name, dose" value={lists.currentMedications} onChange={(value) => setLists({ ...lists, currentMedications: value })} />
                <div className="grid gap-4">
                  <TextField label="Emergency contact" value={profile.emergencyContactName || ""} onChange={(value) => setProfile({ ...profile, emergencyContactName: value || null })} icon={UserRound} />
                  <TextField label="Contact phone" type="tel" value={profile.emergencyContactPhone || ""} onChange={(value) => setProfile({ ...profile, emergencyContactPhone: value || null })} icon={HeartPulse} />
                </div>
              </div>
            )}

            {error && <p role="alert" className="mt-5 rounded-lg border border-rust/20 bg-rust/10 px-4 py-3 text-sm font-bold text-rust">{error}</p>}

            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={() => onComplete(user)} className="min-h-11 px-3 text-sm font-extrabold text-muted hover:text-ink">Skip for now</button>
              {step === 1 ? (
                <button type="button" onClick={() => setStep(2)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-teal px-6 font-extrabold text-white shadow-lift hover:bg-tealDark">Continue <ArrowRight size={18} /></button>
              ) : (
                <button disabled={loading} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-teal px-6 font-extrabold text-white shadow-lift hover:bg-tealDark disabled:opacity-65">{loading ? "Saving profile" : "Finish setup"}<Check size={18} /></button>
              )}
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <AnimatedSelect label={label} value={value} onChange={onChange} options={options} placeholder={`Select ${label.toLowerCase()}`} />;
}

function ListField({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block"><span className="text-sm font-extrabold">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="mt-2 w-full resize-none rounded-lg border border-line bg-white px-3 py-3 text-sm font-semibold leading-6 outline-none placeholder:text-faint focus:border-teal focus:ring-2 focus:ring-teal/10" placeholder={`${placeholder} (comma separated)`} /></label>
  );
}

function splitList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
