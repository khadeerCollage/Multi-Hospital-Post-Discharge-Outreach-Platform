from dataclasses import dataclass
import uuid
from typing import Optional

@dataclass
class TenantContext:
    tenant_id: Optional[uuid.UUID]
    user_id: uuid.UUID
    role: str

    def has_access_to(self, target_tenant_id: uuid.UUID) -> bool:
        if self.role == "platform_admin":
            return True
        return self.tenant_id == target_tenant_id
