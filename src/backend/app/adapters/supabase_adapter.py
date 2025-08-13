import os
from typing import Any, Dict, List, Optional, Tuple
import httpx


class SupabaseAdapter:
    def __init__(self) -> None:
        self.base_url = os.getenv("SUPABASE_URL", "").rstrip("/")
        self.service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        self.read_only = os.getenv("SUPABASE_READ_ONLY", "true").lower() == "true"

    def _headers(self) -> Dict[str, str]:
        return {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _rest(self, path: str) -> str:
        if not self.base_url:
            raise RuntimeError("SUPABASE_URL not configured")
        return f"{self.base_url}/rest/v1/{path.lstrip('/')}"

    async def select(self, table: str, params: Dict[str, str]) -> List[Dict[str, Any]]:
        url = self._rest(table)
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(url, headers=self._headers(), params=params)
            r.raise_for_status()
            return r.json()

    async def upsert(self, table: str, rows: List[Dict[str, Any]]) -> Dict[str, Any]:
        if self.read_only:
            return {"status": "read_only"}
        url = self._rest(table)
        params = {"on_conflict": "id"}
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(url, headers=self._headers(), params=params, json=rows)
            r.raise_for_status()
            return {"status": "ok", "count": len(rows)}

    # Domain helpers
    async def get_cadence_rules(self, tenant_id: str) -> List[Dict[str, Any]]:
        return await self.select(
            "cadence_rules",
            {"select": "*", "tenant_id": f"eq.{tenant_id}", "limit": "500"},
        )

    async def get_cadence_templates(self, tenant_id: str) -> List[Dict[str, Any]]:
        return await self.select(
            "cadence_templates",
            {"select": "*", "tenant_id": f"eq.{tenant_id}", "limit": "500"},
        )

    async def get_lead_status(self, tenant_id: str) -> List[Dict[str, Any]]:
        return await self.select(
            "lead_status",
            {"select": "*", "tenant_id": f"eq.{tenant_id}", "limit": "500"},
        )

    @staticmethod
    def validate_channels(rules: List[Dict[str, Any]]) -> Dict[str, Any]:
        valid = {"sms", "email", "call"}
        bad: List[Dict[str, Any]] = []
        for row in rules:
            ch = str(row.get("channel", "")).lower()
            if ch not in valid:
                bad.append({"id": row.get("id"), "channel": ch})
        return {"invalid_channels": bad, "invalid_count": len(bad)}

    @staticmethod
    def check_rule_template_fk(rules: List[Dict[str, Any]], templates: List[Dict[str, Any]]) -> Dict[str, Any]:
        template_ids = {t.get("id") for t in templates}
        missing: List[Dict[str, Any]] = []
        for r in rules:
            tid = r.get("template_id")
            if not tid or tid not in template_ids:
                missing.append({"rule_id": r.get("id"), "template_id": tid})
        return {"missing_fk": missing, "missing_count": len(missing)}


