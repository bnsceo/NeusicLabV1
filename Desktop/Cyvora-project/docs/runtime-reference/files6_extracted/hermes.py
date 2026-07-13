"""
Hermes: Executive AI Core orchestrator.
Maintains state, delegates to crews, escalates to you.
Phase 0: text-only, single-company focus.
"""

import json
import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional
from schema import get_db, init_db
from crews import create_research_crew, create_hermes_agent, propose_company_task


class Hermes:
    def __init__(self):
        self.db = get_db()
        self.agent = create_hermes_agent()
        self.state = self._load_state()
        self.pending_approval = None

    def _load_state(self) -> Dict[str, Any]:
        """Load the operating picture from the database."""
        c = self.db.cursor()
        c.execute("SELECT * FROM operating_picture ORDER BY timestamp DESC LIMIT 1")
        row = c.fetchone()
        if row:
            return dict(row)
        else:
            return {
                "total_companies": 0,
                "active_companies": 0,
                "pending_approvals": 0,
                "current_burn_rate": 0.0,
                "monthly_revenue": 0.0,
                "hermes_status": "idle",
            }

    def _save_state(self):
        """Update the operating picture snapshot."""
        c = self.db.cursor()
        c.execute("""
            INSERT INTO operating_picture
            (id, total_companies, active_companies, pending_approvals, 
             current_burn_rate, monthly_revenue, hermes_status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            str(uuid.uuid4()),
            self._count_companies(),
            self._count_active_companies(),
            self._count_pending_approvals(),
            self._calculate_burn_rate(),
            self._calculate_revenue(),
            self.state.get("hermes_status", "idle"),
        ))
        self.db.commit()

    def _count_companies(self) -> int:
        c = self.db.cursor()
        c.execute("SELECT COUNT(*) FROM companies")
        return c.fetchone()[0]

    def _count_active_companies(self) -> int:
        c = self.db.cursor()
        c.execute("SELECT COUNT(*) FROM companies WHERE stage NOT IN ('paused', 'killed')")
        return c.fetchone()[0]

    def _count_pending_approvals(self) -> int:
        c = self.db.cursor()
        c.execute("SELECT COUNT(*) FROM approvals WHERE status = 'pending'")
        return c.fetchone()[0]

    def _calculate_burn_rate(self) -> float:
        """Rough estimate: sum of all uncommitted spend per company."""
        c = self.db.cursor()
        c.execute("SELECT SUM(uncommitted) FROM budgets")
        result = c.fetchone()[0]
        return result or 0.0

    def _calculate_revenue(self) -> float:
        """Sum of revenue across all companies (Phase 0: all zero)."""
        return 0.0  # Placeholder; will be populated when ventures generate revenue

    def propose_company(self, objective: str) -> str:
        """
        Human sets an objective.
        Hermes proposes a company structure.
        Return the proposal text; user will approve or redirect.
        """
        self.state["hermes_status"] = "thinking"
        self._save_state()

        print(f"\n[Hermes] Processing objective: {objective}\n")
        
        # Use CrewAI to generate the proposal
        task = propose_company_task(objective)
        
        try:
            proposal_text = task.execute()
        except Exception as e:
            return f"[Hermes] Error generating proposal: {str(e)}\n(This usually means an API issue — check your Anthropic key.)"

        self.state["hermes_status"] = "waiting_on_you"
        
        # Store as a pending approval
        approval_id = str(uuid.uuid4())
        c = self.db.cursor()
        c.execute("""
            INSERT INTO approvals
            (id, type, prompt, status)
            VALUES (?, ?, ?, ?)
        """, (approval_id, "launch_company", proposal_text, "pending"))
        self.db.commit()
        
        self.pending_approval = approval_id
        
        return proposal_text

    def approve_company(self, approval_id: Optional[str] = None, budget: float = 500.0) -> str:
        """
        You approve the proposed company.
        Hermes spins it up: creates db record, initializes budget, schedules research.
        """
        if approval_id is None:
            approval_id = self.pending_approval
        
        if not approval_id:
            return "[Hermes] No pending approval to approve."

        c = self.db.cursor()
        c.execute("SELECT * FROM approvals WHERE id = ?", (approval_id,))
        approval = c.fetchone()
        
        if not approval:
            return "[Hermes] Approval not found."
        
        if approval["status"] != "pending":
            return f"[Hermes] This approval is already {approval['status']}."

        # Create the company
        company_id = str(uuid.uuid4())[:8]
        company_name = "Ecommerce Venture"  # Parsed from proposal in a real system
        
        c.execute("""
            INSERT INTO companies (id, name, objective, stage)
            VALUES (?, ?, ?, ?)
        """, (company_id, company_name, approval["prompt"][:200], "research"))
        
        # Initialize budget
        c.execute("""
            INSERT INTO budgets (company_id, monthly_ceiling, spent_this_month, uncommitted)
            VALUES (?, ?, ?, ?)
        """, (company_id, budget, 0, 0))
        
        # Create the Research department
        c.execute("""
            INSERT INTO departments (id, company_id, name, lead_agent, crew_type)
            VALUES (?, ?, ?, ?, ?)
        """, (str(uuid.uuid4())[:8], company_id, "Research & Trends", "Scout", "research"))
        
        # Create the Treasury department
        c.execute("""
            INSERT INTO departments (id, company_id, name, lead_agent, crew_type)
            VALUES (?, ?, ?, ?, ?)
        """, (str(uuid.uuid4())[:8], company_id, "Treasury", "Ledger", "treasury"))
        
        # Mark approval as done
        c.execute("""
            UPDATE approvals SET status = ?, decision_made_at = ?, decision_made_by = ?
            WHERE id = ?
        """, ("approved", datetime.now(), "you", approval_id))
        
        self.db.commit()
        
        self.pending_approval = None
        self.state["hermes_status"] = "idle"
        self._save_state()
        
        return f"""
[Hermes] ✓ Company approved and spun up.

Company: {company_name}
ID: {company_id}
Budget: ${budget:.2f}/month
Status: research

Departments created:
  • Research & Trends (Scout)
  • Treasury (Ledger)

Next: Scout will run first research cycle now.
        """

    def reject_company(self, approval_id: Optional[str] = None) -> str:
        """You reject the proposed company."""
        if approval_id is None:
            approval_id = self.pending_approval
        
        if not approval_id:
            return "[Hermes] No pending approval to reject."

        c = self.db.cursor()
        c.execute("""
            UPDATE approvals SET status = ?, decision_made_at = ?, decision_made_by = ?
            WHERE id = ?
        """, ("rejected", datetime.now(), "you", approval_id))
        
        self.db.commit()
        
        self.pending_approval = None
        self.state["hermes_status"] = "idle"
        return "[Hermes] Proposal rejected. Standing by for next objective."

    def status(self) -> str:
        """Return the current operating picture."""
        self._load_state()
        return f"""
[Hermes] Operating Picture
═══════════════════════════════════════

Companies: {self.state["total_companies"]} total, {self.state["active_companies"]} active
Pending approvals: {self.state["pending_approvals"]}
Monthly burn rate: ${self.state["current_burn_rate"]:.2f}
Monthly revenue: ${self.state["monthly_revenue"]:.2f}

Status: {self.state["hermes_status"].upper()}
        """

    def run_research(self, company_id: str) -> str:
        """
        Trigger the Research crew to scan for trends.
        This is the core loop that runs weekly.
        """
        print(f"\n[Hermes] Running research for {company_id}...\n")
        
        self.state["hermes_status"] = "thinking"
        self._save_state()

        crew = create_research_crew(company_id)
        
        try:
            result = crew.kickoff()
        except Exception as e:
            return f"[Hermes] Research failed: {str(e)}"

        # Store result
        c = self.db.cursor()
        c.execute("""
            INSERT INTO research_results
            (id, company_id, findings)
            VALUES (?, ?, ?)
        """, (str(uuid.uuid4()), company_id, str(result)))
        self.db.commit()

        self.state["hermes_status"] = "idle"
        self._save_state()

        return f"""
[Hermes] ✓ Research cycle complete.

Findings:
{result}

Review above, or I can summarize further. Standing by.
        """


if __name__ == "__main__":
    init_db()
    hermes = Hermes()
    print(hermes.status())
