import { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * Pass-through wrapper. The page-level fade was removed because it competed
 * visually with the persistent V4Header animation, causing a "stuttering" feel.
 * Pages can opt-in to their own subtle entrance animations if needed.
 */
export const PageTransition = ({ children }: PageTransitionProps) => {
  return <>{children}</>;
};
