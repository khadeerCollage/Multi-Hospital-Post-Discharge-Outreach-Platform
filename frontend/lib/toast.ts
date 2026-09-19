import { toast } from "sonner";

/**
 * Standardized Clinical Toast Notification System
 * Designed specifically for hospital workflows with high-visibility alerts.
 */
export const clinicalToast = {
  success: (title: string, description?: string) => {
    toast.success(title, {
      description,
      duration: 4500,
    });
  },

  error: (title: string, description?: string) => {
    toast.error(title, {
      description,
      duration: 6000,
    });
  },

  warning: (title: string, description?: string) => {
    toast.warning(title, {
      description,
      duration: 5000,
    });
  },

  info: (title: string, description?: string) => {
    toast.info(title, {
      description,
      duration: 4000,
    });
  },

  /**
   * Patient Enrolled / Registered Toast
   */
  patientRegistered: (patientName: string, mrn: string) => {
    toast.success(`Patient Registered Successfully`, {
      description: `${patientName} (${mrn}) is now enrolled in post-discharge outreach.`,
      duration: 5000,
    });
  },

  /**
   * Critical Red-Flag Clinical Escalation Alert
   */
  escalation: (patientName: string, mrn: string, reason: string, escalationId?: string) => {
    toast.error(`URGENT: Red-Flag Clinical Escalation`, {
      description: `${patientName} (${mrn}) - ${reason}`,
      duration: 10000,
      action: escalationId ? {
        label: "Review Case",
        onClick: () => {
          window.location.href = `/escalations/${escalationId}`;
        },
      } : undefined,
    });
  },

  /**
   * Promise Toast for async operations
   */
  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: any) => string);
    }
  ) => {
    return toast.promise(promise, messages);
  },
};
