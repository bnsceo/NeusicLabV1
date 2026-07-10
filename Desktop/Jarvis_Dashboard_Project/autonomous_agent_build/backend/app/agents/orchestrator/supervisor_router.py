#!/usr/bin/env python3
"""
Supervisor Router – The brain of the Digital Empire.
Listens for high-level goals, delegates to workers, and compiles Mission Briefings.
"""

import os
import json
import glob
from typing import List, Dict, Any
import openai

# Configuration
AGENTS_LIBRARY = "backend/app/agents/library"
CUSTOM_AGENTS = "backend/app/agents/custom"

# Set your API key via environment variable
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "your-key-here")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

DEFAULT_MODEL = "openai/gpt-3.5-turbo"   # or "anthropic/claude-3-haiku"

class Supervisor:
    def __init__(self):
        self.client = openai.OpenAI(
            base_url=OPENROUTER_BASE_URL,
            api_key=OPENROUTER_API_KEY,
        )
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
                    # Extract name from frontmatter
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
        """
        Find the best matching agent name given a query.
        Handles partial matches, paths, and case insensitivity.
        """
        # If exact match, return it
        if query in self.agents:
            return query
        # Strip path and extension
        base = os.path.splitext(os.path.basename(query))[0]
        # Try to match based on substring (case-insensitive)
        base_lower = base.lower()
        for name in self.agent_names:
            name_lower = name.lower()
            # Check if the base is contained in the name, or vice versa
            if base_lower in name_lower or name_lower in base_lower:
                return name
        # If still not found, return None
        return None

    def delegate(self, task: str, agent_query: str) -> str:
        """Send a task to a specific agent and get its output."""
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
        )
        return response.choices[0].message.content

    def break_down_goal(self, goal: str) -> List[Dict[str, str]]:
        """
        Use the Supervisor to decompose a goal into sub-tasks.
        The LLM is given the list of available agent names so it can pick from them.
        """
        supervisor_def = self.agents.get("Supervisor (Smart-Strategist)")
        if not supervisor_def:
            for name in self.agent_names:
                if 'supervisor' in name.lower():
                    supervisor_def = self.agents[name]
                    break
        if not supervisor_def:
            supervisor_def = "You are a strategic planner."

        # Provide the list of agent names for the LLM to choose from
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
        )
        try:
            tasks = json.loads(response.choices[0].message.content)
            return tasks
        except json.JSONDecodeError:
            # fallback: simple split
            return [{"description": goal, "agent": "Senior Developer"}]

    def run(self, goal: str) -> str:
        """Main orchestration: decompose, delegate, compile briefing."""
        print(f"🧠 Supervisor received goal: {goal}")
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
        return briefing

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python supervisor_router.py '<goal>'")
        sys.exit(1)
    goal = sys.argv[1]
    sup = Supervisor()
    briefing = sup.run(goal)
    print("\n" + "="*80)
    print(briefing)
    print("="*80)
    with open("mission_briefing.md", "w") as f:
        f.write(briefing)
    print("📄 Briefing saved to mission_briefing.md")
