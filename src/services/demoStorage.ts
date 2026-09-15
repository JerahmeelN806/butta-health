export const DEMO_SESSION_KEY = "butta:demo:session:v1";
export const DEMO_EVENTS_KEY = "butta:demo:events:v1";
export const DEMO_PROFILE_KEY = "butta:demo:profile:v1";
export const DEMO_CHECK_IN_KEY = "butta:demo:check-in:v1";
export const DEMO_PREFERENCES_KEY = "butta:demo:preferences:v1";
export const DEMO_AI_CONSENT_KEY = "butta:demo:ai-consent:v1";

export function clearDemoStorage() {
  window.localStorage.removeItem(DEMO_SESSION_KEY);
  window.localStorage.removeItem(DEMO_EVENTS_KEY);
  window.localStorage.removeItem(DEMO_PROFILE_KEY);
  window.localStorage.removeItem(DEMO_CHECK_IN_KEY);
  window.localStorage.removeItem(DEMO_PREFERENCES_KEY);
  window.localStorage.removeItem(DEMO_AI_CONSENT_KEY);
}
