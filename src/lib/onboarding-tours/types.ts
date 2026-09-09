export type TourStep = {
  // Route to navigate to for this step, e.g. "/checking" — TourRunner
  // pushes here (if not already there) before spotlighting the target.
  path: string;
  // A `data-tour="<value>"` attribute value on the real element to spotlight.
  selector: string;
  title: string;
  body: string;
  placement?: "top" | "bottom" | "left" | "right";
  // Most steps advance via the tour's own "Next" button after the user has
  // merely looked at the highlighted element — real data-mutating actions
  // (save/send/generate) are explained, not required, to keep tour content
  // authoring simple. Set this only for the deliberately-chosen "practice"
  // steps where clicking the real element for real (into the user's own
  // disposable demo clone) is the point — e.g. actually logging an
  // assignment or toggling a filter.
  requireRealClick?: boolean;
};
