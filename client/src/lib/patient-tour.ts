import Shepherd from "shepherd.js";

const PATIENT_TOUR_COMPLETED_KEY = "trialatlas-patient-tour-v1-completed";

let activeTour: any = null;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function markPatientTourCompleted(): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(PATIENT_TOUR_COMPLETED_KEY, new Date().toISOString());
}

export function isPatientTourCompleted(): boolean {
  if (!isBrowser()) return true;
  return Boolean(window.localStorage.getItem(PATIENT_TOUR_COMPLETED_KEY));
}

function clearPatientTourCompleted(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(PATIENT_TOUR_COMPLETED_KEY);
}

function createPatientTour() {
  const tour = new Shepherd.Tour({
    useModalOverlay: true,
    defaultStepOptions: {
      cancelIcon: {
        enabled: true,
      },
      classes: "shepherd-theme-default",
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
    id: "patient-tour-welcome",
    title: "Welcome to TrialAtlas",
    text: "This quick walkthrough shows how to find trials and take the next step as a patient.",
    buttons: [skipButton, nextButton],
  });

  tour.addStep({
    id: "patient-tour-condition",
    title: "Start with your condition",
    text: "Enter your condition or diagnosis to find matching studies.",
    attachTo: {
      element: '[data-testid="input-condition"]',
      on: "bottom",
    },
    buttons: [backButton, nextButton],
  });

  tour.addStep({
    id: "patient-tour-location",
    title: "Add a location",
    text: "Add your city, state, or country to narrow results near you.",
    attachTo: {
      element: '[data-testid="input-location"]',
      on: "bottom",
    },
    buttons: [backButton, nextButton],
  });

  tour.addStep({
    id: "patient-tour-filters",
    title: "Use smart filters",
    text: "Refine by recruitment status and phase to focus on trials that fit your needs.",
    attachTo: {
      element: '[data-testid="select-status"]',
      on: "bottom",
    },
    buttons: [backButton, nextButton],
  });

  tour.addStep({
    id: "patient-tour-search",
    title: "Search trials",
    text: "Run your search here. Then open a trial card to view details and share your interest.",
    attachTo: {
      element: '[data-testid="button-search"]',
      on: "top",
    },
    buttons: [
      backButton,
      {
        text: "Finish",
        action: () => tour.complete(),
      },
    ],
  });

  tour.on("complete", () => {
    markPatientTourCompleted();
    activeTour = null;
  });

  tour.on("cancel", () => {
    markPatientTourCompleted();
    activeTour = null;
  });

  return tour;
}

export function startPatientTour(options?: { force?: boolean }): void {
  if (!isBrowser()) return;

  if (!options?.force && isPatientTourCompleted()) {
    return;
  }

  if (activeTour) {
    activeTour.cancel();
    activeTour = null;
  }

  activeTour = createPatientTour();

  window.setTimeout(() => {
    activeTour?.start();
  }, 180);
}

export function restartPatientTour(): void {
  clearPatientTourCompleted();
  startPatientTour({ force: true });
}
