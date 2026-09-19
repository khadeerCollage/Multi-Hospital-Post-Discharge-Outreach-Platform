from typing import List, Dict, Any
from pydantic import BaseModel

class CampaignAnalytics(BaseModel):
    campaign_id: str
    total_calls: int
    success_rate: float
    average_duration: float
    escalations: int

class HospitalAnalytics(BaseModel):
    tenant_id: str
    total_patients: int
    active_campaigns: int
    overall_contact_rate: float
    average_escalation_rate: float

class PlatformAnalytics(BaseModel):
    total_hospitals: int
    total_campaigns_run: int
    system_wide_calls: int
    platform_uptime_days: int

class AIUsageMetrics(BaseModel):
    total_requests: int
    total_input_tokens: int
    total_output_tokens: int
    estimated_cost_usd: float
    average_latency_ms: float
