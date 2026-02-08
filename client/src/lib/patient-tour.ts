import Shepherd from "shepherd.js";

const PATIENT_TOUR_COMPLETED_KEY = "trialatlas-patient-tour-v1-completed";
const COORDINATOR_TOUR_COMPLETED_KEY = "trialatlas-coordinator-tour-v1-completed";
const PENDING_TOUR_KEY = "trialatlas-pending-tour";

let activeTour: any = null;
type TourRole = "patient" | "coordinator";
type PendingTour = { role: TourRole; force: boolean };

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function getCompletedKey(role: TourRole): string {
  return role === "patient" ? PATIENT_TOUR_COMPLETED_KEY : COORDINATOR_TOUR_COMPLETED_KEY;
}

function markTourCompleted(role: TourRole): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(getCompletedKey(role), new Date().toISOString());
}

function clearTourCompleted(role: TourRole): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(getCompletedKey(role));
}

function isTourCompleted(role: TourRole): boolean {
  if (!isBrowser()) return true;
  return Boolean(window.localStorage.getItem(getCompletedKey(role)));
}

function writePendingTour(pending: PendingTour): void {
  if (!isBrowser()) return;
  window.sessionStorage.setItem(PENDING_TOUR_KEY, JSON.stringify(pending));
}

function readPendingTour(): PendingTour | null {
  if (!isBrowser()) return null;
  const raw = window.sessionStorage.getItem(PENDING_TOUR_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingTour;
    if (!parsed || (parsed.role !== "patient" && parsed.role !== "coordinator")) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function clearPendingTour(): void {
  if (!isBrowser()) return;
  window.sessionStorage.removeItem(PENDING_TOUR_KEY);
}

function getPrimarySelector(role: TourRole): string {
  return role === "patient"
    ? '[data-testid="section-connect-ehr-header"]'
    : '[data-testid="section-coordinator-header"]';
}

function getDefaultRoute(role: TourRole): string {
  return role === "patient" ? "/connect-ehr" : "/coordinator-inbox";
}

function hasPrimaryTarget(role: TourRole): boolean {
  if (!isBrowser()) return false;
  return Boolean(window.document.querySelector(getPrimarySelector(role)));
}

function ensureRouteAndElement(route: string, selector: string): Promise<void> {
  if (!isBrowser()) return Promise.resolve();

  return new Promise((resolve) => {
    if (window.location.pathname !== route) {
      window.location.assign(route);
      resolve();
      return;
    }

    const start = Date.now();
    const timeoutMs = 4500;

    const check = () => {
      if (window.document.querySelector(selector)) {
        resolve();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        resolve();
        return;
      }
      window.setTimeout(check, 80);
    };

    check();
  });
}

function createPatientTour() {
  const tour = new Shepherd.Tour({
    useModalOverlay: true,
    defaultStepOptions: {
      cancelIcon: {
        enabled: true,
      },
      classes: "shepherd-theme-default trialatlas-tour-step",
      highlightClass: "trialatlas-tour-highlight",
      scrollTo: { behavior: "smooth", block: "center" },
    },
  });

  const skipButton = {
    text: "Skip Tour",
    action: () => tour.cancel(),
  };

  const backButton = {
    text: "Back",
    action: () => tour.back(),
  };

  const nextButton = {
    text: "Next",
    action: () => tour.next(),
  };

  tour.addStep({
    id: "patient-tour-connect-nav",
    title: "Start here first",
    text: "Before searching trials, connect your health record from this menu item.",
    attachTo: {
      element: '[data-testid="link-nav-connect-health-record"]',
      on: "right",
    },
    beforeShowPromise: () =>
      ensureRouteAndElement("/connect-ehr", '[data-testid="link-nav-connect-health-record"]'),
    buttons: [skipButton, nextButton],
  });

  tour.addStep({
    id: "patient-tour-connect-provider",
    title: "Connect your provider",
    text: "Select your provider and complete authorization to import your health profile.",
    attachTo: {
      element: () =>
        window.document.querySelector<HTMLElement>(
          '[data-testid="button-connect-provider"], [data-testid="card-connected-record"], [data-testid="card-connect-providers"]',
        ),
      on: "bottom",
    },
    beforeShowPromise: () =>
      ensureRouteAndElement(
        "/connect-ehr",
        '[data-testid="button-connect-provider"], [data-testid="card-connected-record"], [data-testid="card-connect-providers"]',
      ),
    buttons: [backButton, nextButton],
  });

  tour.addStep({
    id: "patient-tour-how-it-works",
    title: "What happens next",
    text: "This section explains how your records are securely used for matching.",
    attachTo: {
      element: '[data-testid="card-connect-how-it-works"]',
      on: "bottom",
    },
    beforeShowPromise: () =>
      ensureRouteAndElement("/connect-ehr", '[data-testid="card-connect-how-it-works"]'),
    buttons: [backButton, nextButton],
  });

  tour.addStep({
    id: "patient-tour-find-trials-nav",
    title: "Go to trial search",
    text: "After connecting your record, go to Find Trials.",
    attachTo: {
      element: '[data-testid="link-nav-find-trials"]',
      on: "right",
    },
    beforeShowPromise: () =>
      ensureRouteAndElement("/connect-ehr", '[data-testid="link-nav-find-trials"]'),
    buttons: [
      backButton,
      {
        text: "Finish",
        action: () => tour.complete(),
      },
    ],
  });

  tour.on("complete", () => {
    markTourCompleted("patient");
    activeTour = null;
  });

  tour.on("cancel", () => {
    markTourCompleted("patient");
    activeTour = null;
  });

  return tour;
}

function createCoordinatorTour() {
  const tour = new Shepherd.Tour({
    useModalOverlay: true,
    defaultStepOptions: {
      cancelIcon: {
        enabled: true,
      },
      classes: "shepherd-theme-default trialatlas-tour-step",
      highlightClass: "trialatlas-tour-highlight",
      scrollTo: { behavior: "smooth", block: "center" },
    },
  });

  const skipButton = {
    text: "Skip Tour",
    action: () => tour.cancel(),
  };

  const backButton = {
    text: "Back",
    action: () => tour.back(),
  };

  const nextButton = {
    text: "Next",
    action: () => tour.next(),
  };

  tour.addStep({
    id: "coordinator-tour-header",
    title: "Coordinator Workspace",
    text: "This is your lead-management workspace.",
    attachTo: {
      element: '[data-testid="section-coordinator-header"]',
      on: "bottom",
    },
    buttons: [skipButton, nextButton],
  });

  tour.addStep({
    id: "coordinator-tour-stats",
    title: "Lead Status Summary",
    text: "Use these cards to quickly filter by lead status.",
    attachTo: {
      element: '[data-testid="grid-coordinator-stats"]',
      on: "bottom",
    },
    buttons: [backButton, nextButton],
  });

  tour.addStep({
    id: "coordinator-tour-table",
    title: "Lead Queue",
    text: "Open lead details and update status from this table.",
    attachTo: {
      element: '[data-testid="card-coordinator-leads"]',
      on: "top",
    },
    buttons: [backButton, nextButton],
  });

  tour.addStep({
    id: "coordinator-tour-admin",
    title: "Admin Dashboard",
    text: "Use Admin for overall trial and recruitment insights.",
    attachTo: {
      element: '[data-testid="link-nav-admin"]',
      on: "right",
    },
    buttons: [backButton, nextButton],
  });

  tour.addStep({
    id: "coordinator-tour-account",
    title: "Account Menu",
    text: "Replay this tour anytime from here.",
    attachTo: {
      element: '[data-testid="button-user-menu"]',
      on: "bottom",
    },
    buttons: [backButton, { text: "Finish", action: () => tour.complete() }],
  });

  tour.on("complete", () => {
    markTourCompleted("coordinator");
    activeTour = null;
  });

  tour.on("cancel", () => {
    markTourCompleted("coordinator");
    activeTour = null;
  });

  return tour;
}

function createTourForRole(role: TourRole) {
  return role === "patient" ? createPatientTour() : createCoordinatorTour();
}

export function startRoleTour(role: TourRole, options?: { force?: boolean }): void {
  if (!isBrowser()) return;

  if (!options?.force && isTourCompleted(role)) {
    return;
  }

  if (!hasPrimaryTarget(role)) {
    writePendingTour({ role, force: Boolean(options?.force) });
    const route = getDefaultRoute(role);
    if (window.location.pathname !== route) {
      window.location.assign(route);
    }
    return;
  }

  clearPendingTour();

  if (activeTour) {
    activeTour.cancel();
    activeTour = null;
  }

  activeTour = createTourForRole(role);

  window.setTimeout(() => {
    activeTour?.start();
  }, 180);
}

export function startPatientTour(options?: { force?: boolean }): void {
  startRoleTour("patient", options);
}

export function startCoordinatorTour(options?: { force?: boolean }): void {
  startRoleTour("coordinator", options);
}

export function resumePendingRoleTour(): void {
  const pending = readPendingTour();
  if (!pending) return;

  if (!pending.force && isTourCompleted(pending.role)) {
    clearPendingTour();
    return;
  }

  if (!hasPrimaryTarget(pending.role)) {
    return;
  }

  clearPendingTour();
  startRoleTour(pending.role, { force: pending.force });
}

export function isPatientTourCompleted(): boolean {
  return isTourCompleted("patient");
}

export function restartPatientTour(): void {
  clearTourCompleted("patient");
  startRoleTour("patient", { force: true });
}

export function restartCoordinatorTour(): void {
  clearTourCompleted("coordinator");
  startRoleTour("coordinator", { force: true });
}

export function restartRoleTour(role: TourRole): void {
  clearTourCompleted(role);
  startRoleTour(role, { force: true });
}
