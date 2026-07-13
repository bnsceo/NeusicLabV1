#!/usr/bin/env python3
"""
Supervisor Router – The brain of the Digital Empire.
Listens for high-level goals, delegates to workers, and compiles Mission Briefings.
Mock mode available via MOCK_MODE=true environment variable.
"""

import os
import json
import glob
from typing import List, Dict, Any
import openai

# Configuration
AGENTS_LIBRARY = "backend/app/agents/library"
CUSTOM_AGENTS = "backend/app/agents/custom"

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "your-key-here")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

DEFAULT_MODEL = "openai/gpt-3.5-turbo"   # or "anthropic/claude-3-haiku"

MOCK_MODE = os.environ.get("MOCK_MODE", "false").lower() == "true"

class Supervisor:
    def __init__(self):
        if not MOCK_MODE:
            self.client = openai.OpenAI(
                base_url=OPENROUTER_BASE_URL,
                api_key=OPENROUTER_API_KEY,
            )
        else:
            self.client = None
        self.agents = self._load_agents()
        self.agent_names = list(self.agents.keys())

    def _load_agents(self) -> Dict[str, str]:
        """Read all .md files from library and custom folders."""
        agents = {}
        for folder in [AGENTS_LIBRARY, CUSTOM_AGENTS]:
            pattern = os.path.join(folder, "**/*.md")
            for filepath in glob.glob(pattern, recursive=True):
                with open(filepath, 'r') as f:
                    content = f.read()
                    if content.startswith("---"):
                        try:
                            import yaml
                            parts = content.split("---", 2)
                            meta = yaml.safe_load(parts[1])
                            name = meta.get("name", os.path.basename(filepath))
                            agents[name] = content
                        except:
                            agents[os.path.basename(filepath)] = content
                    else:
                        agents[os.path.basename(filepath)] = content
        return agents

    def _find_agent(self, query: str) -> str:
        if query in self.agents:
            return query
        base = os.path.splitext(os.path.basename(query))[0]
        base_lower = base.lower()
        for name in self.agent_names:
            name_lower = name.lower()
            if base_lower in name_lower or name_lower in base_lower:
                return name
        return None

    def delegate(self, task: str, agent_query: str) -> str:
        """Send a task to a specific agent and get its output."""
        if MOCK_MODE:
            return f"Mock output for agent '{agent_query}' doing '{task}'"
        agent_name = self._find_agent(agent_query)
        if agent_name is None:
            return f"Error: Agent '{agent_query}' not found. Available: {self.agent_names[:10]}..."
        prompt = f"""
You are the {agent_name} agent.
Here is your complete definition:
{self.agents[agent_name]}

Now, perform the following task:
{task}

Provide your output in a structured format (Markdown with code blocks if needed).
"""
        response = self.client.chat.completions.create(
            model=DEFAULT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=800,
        )
        return response.choices[0].message.content

    def break_down_goal(self, goal: str) -> List[Dict[str, str]]:
        if MOCK_MODE:
            # Return a synthetic decomposition
            return [
                {"description": "Design wireframes", "agent": "UX Architect"},
                {"description": "Implement frontend code", "agent": "Frontend Developer"},
                {"description": "Write copy", "agent": "Copywriter"},
                {"description": "Optimize performance", "agent": "Performance Benchmarker"},
            ]
        supervisor_def = self.agents.get("Supervisor (Smart-Strategist)")
        if not supervisor_def:
            for name in self.agent_names:
                if 'supervisor' in name.lower():
                    supervisor_def = self.agents[name]
                    break
        if not supervisor_def:
            supervisor_def = "You are a strategic planner."

        agent_list = "\n".join(f"- {name}" for name in self.agent_names)

        prompt = f"""
You are the Supervisor. Your definition:
{supervisor_def}

The Architect has given this goal: "{goal}"

Here is the list of available agent names (choose only from this list):
{agent_list}

Break the goal down into a list of sub-tasks. For each sub-task, specify:
- description
- agent: the exact agent name (must be one from the list above)

Return the list as JSON: [{{"description": "...", "agent": "..."}}, ...]
"""
        response = self.client.chat.completions.create(
            model=DEFAULT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=600,
        )
        try:
            tasks = json.loads(response.choices[0].message.content)
            return tasks
        except json.JSONDecodeError:
            return [{"description": goal, "agent": "Senior Developer"}]

    def run(self, goal: str) -> Dict[str, Any]:
        print(f"🧠 Supervisor received goal: {goal}")
        if MOCK_MODE:
            print("🧪 MOCK MODE: Generating synthetic briefing")
            tasks = [
                {"description": "Design wireframes", "agent": "UX Architect"},
                {"description": "Implement frontend code", "agent": "Frontend Developer"},
                {"description": "Write copy", "agent": "Copywriter"},
                {"description": "Optimize performance", "agent": "Performance Benchmarker"},
            ]
            results = []
            for task in tasks:
                agent_name = task.get("agent", "Senior Developer")
                desc = task.get("description", task)
                print(f"   → Assigning '{desc}' to {agent_name}")
                output = self.delegate(desc, agent_name)
                results.append({
                    "agent": agent_name,
                    "task": desc,
                    "output": output
                })
            briefing_content = f"# Mission Briefing\n\n**Objective:** {goal}\n\n"
            for r in results:
                briefing_content += f"## Agent: {r['agent']}\n**Task:** {r['task']}\n\n**Output:**\n{r['output']}\n\n---\n"
            briefing_content += "\n**Please review and DECREE or ABANDON.**"

            # Write to file so dashboard can read
            with open("mission_briefing.md", "w") as f:
                f.write(briefing_content)

            # Also write status.json
            with open("mission_status.json", "w") as f:
                json.dump({"status": "pending", "objective": goal, "timestamp": "2026-07-10T00:00:00Z"}, f)

            return {
                "objective": goal,
                "agents": results,
                "status": "pending",
                "timestamp": "2026-07-10T00:00:00Z"
            }

        # Normal mode (not mock)
        tasks = self.break_down_goal(goal)
        print(f"📋 Decomposed into {len(tasks)} tasks.")
        results = []
        for task in tasks:
            agent_query = task.get("agent", "Senior Developer")
            desc = task.get("description", task)
            print(f"   → Assigning '{desc}' to {agent_query}")
            output = self.delegate(desc, agent_query)
            results.append({
                "agent": agent_query,
                "task": desc,
                "output": output
            })
        # Compile Mission Briefing
        briefing = f"# Mission Briefing\n\n**Objective:** {goal}\n\n"
        for r in results:
            briefing += f"## Agent: {r['agent']}\n**Task:** {r['task']}\n\n**Output:**\n{r['output']}\n\n---\n"
        briefing += "\n**Please review and DECREE or ABANDON.**"
        # Save to file
        with open("mission_briefing.md", "w") as f:
            f.write(briefing)
        with open("mission_status.json", "w") as f:
            json.dump({"status": "pending", "objective": goal, "timestamp": "2026-07-10T00:00:00Z"}, f)
        return {
            "objective": goal,
            "agents": results,
            "status": "pending",
            "timestamp": "2026-07-10T00:00:00Z"
        }


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python supervisor_router.py '<goal>'")
        sys.exit(1)
    goal = sys.argv[1]
    sup = Supervisor()
    briefing = sup.run(goal)
    print("\n" + "="*80)
    print(json.dumps(briefing, indent=2))
    print("="*80)
    print("📄 Briefing saved to mission_briefing.md")
