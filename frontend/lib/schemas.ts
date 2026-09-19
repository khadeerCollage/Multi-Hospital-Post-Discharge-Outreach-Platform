import { z } from "zod";

/**
 * Zod Schema for Patient Registration / Admission
 */
export const patientFormSchema = z.object({
  mrn: z.string().min(3, "MRN must be at least 3 characters").max(50),
  first_name: z.string().min(1, "First name is required").max(100),
  last_name: z.string().min(1, "Last name is required").max(100),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be in YYYY-MM-DD format"),
  gender: z.enum(["male", "female", "other"]),
  phone: z.string().min(7, "Valid phone number required").max(20),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  risk_level: z.enum(["routine", "low", "moderate", "high", "critical"]),
  preferred_language: z.string().default("en"),
  procedure_name: z.string().optional().or(z.literal("")),
  primary_diagnosis: z.string().optional().or(z.literal("")),
  attending_physician: z.string().optional().or(z.literal("")),
  discharge_date: z.string().optional().or(z.literal("")),
});

export type PatientFormValues = z.infer<typeof patientFormSchema>;

/**
 * Zod Schema for Campaign Creation
 */
export const campaignFormSchema = z.object({
  name: z.string().min(3, "Campaign name must be at least 3 characters").max(150),
  description: z.string().optional().or(z.literal("")),
  target_risk_levels: z.array(z.string()).min(1, "Select at least one risk level"),
  condition_filter: z.string().optional().or(z.literal("")),
  max_concurrent_calls: z.number().min(1).max(50).default(10),
  max_retries: z.number().min(1).max(10).default(5),
});

export type CampaignFormValues = z.infer<typeof campaignFormSchema>;
