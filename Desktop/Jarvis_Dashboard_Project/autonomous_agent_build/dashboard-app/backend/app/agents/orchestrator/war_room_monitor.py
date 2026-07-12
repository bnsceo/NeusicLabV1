#!/usr/bin/env python3
"""
War Room Monitor – Listens for alerts, investigates, and drafts Repair Briefings.
"""

import os
import time
import glob
import openai
from datetime import datetime

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "your-key-here")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

# Path to logs (adjust to your setup)
LOG_DIR = "logs/"  # e.g., /var/log/myapp
WAR_ROOM_AGENT = "backend/app/agents/custom/war-room.md"

class WarRoom:
    def __init__(self):
        self.client = openai.OpenAI(
            base_url=OPENROUTER_BASE_URL,
            api_key=OPENROUTER_API_KEY,
        )
        with open(WAR_ROOM_AGENT, 'r') as f:
            self.agent_def = f.read()

    def check_health(self) -> bool:
        """Mock health check – replace with actual monitoring."""
        # For demo: check if any error logs exist in the last 5 minutes
        error_files = glob.glob(os.path.join(LOG_DIR, "error*.log"))
        if not error_files:
            return True
        # check last modified time
        for f in error_files:
            if time.time() - os.path.getmtime(f) < 300:  # 5 min
                return False
        return True

    def investigate(self, alert: str) -> str:
        """Read relevant logs and perform RCA."""
        # For demo: read last 50 lines of the latest error log
        log_content = ""
        error_files = sorted(glob.glob(os.path.join(LOG_DIR, "error*.log")), key=os.path.getmtime, reverse=True)
        if error_files:
            with open(error_files[0], 'r') as f:
                log_content = f.read()[-5000:]  # last 5k chars
        prompt = f"""
        You are the War Room agent.
        Your definition:
        {self.agent_def}

        Alert triggered: {alert}

        Recent logs:
        {log_content}

        Investigate the root cause. Provide your analysis and a draft fix.
        """
        response = self.client.chat.completions.create(
            model="anthropic/claude-3.5-sonnet",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
        )
        return response.choices[0].message.content

    def run(self, alert: str = None):
        if alert is None:
            alert = "Anomaly detected: error rate spike or performance degradation."
        print(f"⚠️ War Room triggered: {alert}")
        investigation = self.investigate(alert)
        briefing = f"# Repair Briefing\n\n**Incident:** {alert}\n\n**Investigation:**\n{investigation}\n\n---\n**Please review and DECREE or ABANDON.**"
        print("\n" + "="*80)
        print(briefing)
        print("="*80)
        with open("repair_briefing.md", "w") as f:
            f.write(briefing)
        print("📄 Repair Briefing saved to repair_briefing.md")

if __name__ == "__main__":
    import sys
    alert = sys.argv[1] if len(sys.argv) > 1 else None
    wr = WarRoom()
    wr.run(alert)
