import json
from datetime import datetime
from typing import Dict, Any, List

# =====================================================================
# 1. MOCK DATA & SIMULATED APIS
# =====================================================================

MOCK_CRM_DATABASE = {
    "CLIENT_1001": {
        "client_id": "CLIENT_1001",
        "name": "Alexander Hayes",
        "risk_profile": "Moderate",
        "investment_goals": "Capital Preservation & Long-Term Growth",
        "target_liquidity_threshold": 25000.0,
        "relationship_tenure_years": 4,
        "last_advisor_review": "2026-08-15"
    }
}

MOCK_TRANSACTIONS = [
    {"tx_id": "TX_01", "date": "2026-10-01", "type": "dividend", "amount": 1250.0, "category": "Passive Income"},
    {"tx_id": "TX_02", "date": "2026-10-10", "type": "investment", "amount": 5000.0, "category": "Equity SIP"},
    {"tx_id": "TX_03", "date": "2026-10-18", "type": "withdrawal", "amount": 42000.0, "category": "Uncategorized Wire"}, # Spike Anomaly
    {"tx_id": "TX_04", "date": "2026-10-24", "type": "fee", "amount": 120.0, "category": "Custodian Fee"},
]

MOCK_PORTFOLIO_SNAPSHOT = {
    "cash_balance": 18500.0,
    "equities_value": 310000.0,
    "fixed_income_value": 180000.0,
    "alternative_assets": 45000.0,
    "total_aum": 553500.0
}


# =====================================================================
# 2. SUB-AGENT IMPLEMENTATIONS
# =====================================================================

class CRMDataIngestionAgent:
    """Mengambil konteks nasabah dan telemetri transaksi dari sistem CRM/Core Banking."""
    
    def fetch_client_context(self, client_id: str) -> Dict[str, Any]:
        client_meta = MOCK_CRM_DATABASE.get(client_id, {})
        if not client_meta:
            raise ValueError(f"Client ID {client_id} not found in CRM.")
        
        return {
            "metadata": client_meta,
            "portfolio": MOCK_PORTFOLIO_SNAPSHOT,
            "transactions": MOCK_TRANSACTIONS
        }


class AnomalyAnalysisAgent:
    """Menganalisis pergerakan dana, deviasi saldo likuiditas, dan anomali transaksi."""
    
    def analyze(self, client_data: Dict[str, Any]) -> Dict[str, Any]:
        metadata = client_data["metadata"]
        portfolio = client_data["portfolio"]
        transactions = client_data["transactions"]
        
        anomalies = []
        risk_flags = []
        
        # 1. Cek Likuiditas terhadap Threshold CRM
        min_liquidity = metadata.get("target_liquidity_threshold", 0.0)
        current_cash = portfolio.get("cash_balance", 0.0)
        
        if current_cash < min_liquidity:
            risk_flags.append({
                "severity": "HIGH",
                "type": "LIQUIDITY_DEFICIT",
                "message": f"Cash balance (${current_cash:,.2f}) fell below minimum client policy threshold (${min_liquidity:,.2f})."
            })
            
        # 2. Deteksi Anomali Transaksi (Outlier Withdrawal / Wire Transfers)
        for tx in transactions:
            if tx["type"] == "withdrawal" and tx["amount"] > 20000.0:
                anomalies.append({
                    "tx_id": tx["tx_id"],
                    "date": tx["date"],
                    "amount": tx["amount"],
                    "severity": "CRITICAL",
                    "reason": "Unusual high-volume withdrawal transaction detected with uncategorized label."
                })
                
        # 3. Analisis Alokasi Aset
        total_aum = portfolio.get("total_aum", 1.0)
        equity_ratio = portfolio.get("equities_value", 0.0) / total_aum
        
        if metadata.get("risk_profile") == "Moderate" and equity_ratio > 0.50:
            risk_flags.append({
                "severity": "MEDIUM",
                "type": "ASSET_ALLOCATION_DRIFT",
                "message": f"Equity exposure is at {equity_ratio*100:.1f}%, slightly aggressive for Moderate profile target."
            })
            
        return {
            "anomalies_detected": anomalies,
            "risk_signals": risk_flags,
            "liquidity_status": "DEFICIT" if current_cash < min_liquidity else "HEALTHY",
            "current_equity_allocation_pct": round(equity_ratio * 100, 2)
        }


class AdvisoryInsightAgent:
    """Merumuskan rekomendasi keputusan taktis untuk Wealth Advisor."""
    
    def generate_recommendations(self, metadata: Dict[str, Any], analysis: Dict[str, Any]) -> List[str]:
        recommendations = []
        
        if analysis["liquidity_status"] == "DEFICIT":
            recommendations.append(
                "Immediate Cash Rebalancing: Suggest reallocating $15,000 from mature Fixed Income / Money Market to replenish the operating cash buffer."
            )
            
        if analysis["anomalies_detected"]:
            recommendations.append(
                "Client Security Outreach: Trigger a courtesy check-in call with Alexander Hayes regarding the $42,000 withdrawal on 2026-10-18 to confirm intent and tax implications."
            )
            
        if any(flag["type"] == "ASSET_ALLOCATION_DRIFT" for flag in analysis["risk_signals"]):
            recommendations.append(
                "Portfolio Rebalancing Advisory: Present portfolio trim options during the next quarterly review to bring equity allocation back toward the target 45-50% threshold."
            )
            
        return recommendations


# =====================================================================
# 3. ORCHESTRATOR AGENT (CENTRAL COORDINATOR)
# =====================================================================

class WealthAdvisorOrchestrator:
    """Koordinator utama yang mengeksekusi pipeline end-to-end antar agen."""
    
    def __init__(self):
        self.ingestion_agent = CRMDataIngestionAgent()
        self.anomaly_agent = AnomalyAnalysisAgent()
        self.advisory_agent = AdvisoryInsightAgent()

    def process_client_case(self, client_id: str) -> str:
        # Step 1: Ingest Data
        client_context = self.ingestion_agent.fetch_client_context(client_id)
        
        # Step 2: Analisis & Deteksi Risiko
        analysis_result = self.anomaly_agent.analyze(client_context)
        
        # Step 3: Sintesis Rekomendasi
        recommendations = self.advisory_agent.generate_recommendations(
            client_context["metadata"], 
            analysis_result
        )
        
        # Step 4: Output Keputusan Terstruktur
        structured_dossier = {
            "evaluation_timestamp": datetime.utcnow().isoformat() + "Z",
            "advisor_briefing": {
                "client_id": client_context["metadata"]["client_id"],
                "client_name": client_context["metadata"]["name"],
                "risk_profile": client_context["metadata"]["risk_profile"],
                "total_aum_usd": client_context["portfolio"]["total_aum"]
            },
            "risk_and_anomalies": {
                "flagged_anomalies": analysis_result["anomalies_detected"],
                "active_risk_signals": analysis_result["risk_signals"]
            },
            "actionable_advisory_steps": recommendations
        }
        
        return json.dumps(structured_dossier, indent=2)


# =====================================================================
# 4. EXECUTION / VERIFICATION
# =====================================================================

if __name__ == "__main__":
    orchestrator = WealthAdvisorOrchestrator()
    output_json = orchestrator.process_client_case("CLIENT_1001")
    print(output_json)