"""CrewAI agent registry scaffold — roles defined now, execution lands in Agent 2.0.
Kept dependency-free so the August backend runs without crewai installed;
September swaps AgentSpec for real crewai.Agent instances."""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class AgentSpec:
    name: str
    role: str
    goal: str
    tools: tuple[str, ...] = field(default_factory=tuple)


REGISTRY: dict[str, AgentSpec] = {
    "producer": AgentSpec(
        name="producer", role="Producer",
        goal="Arrangement, energy, transitions, and song structure decisions.",
        tools=("arrangement_analysis", "section_detection")),
    "mix_engineer": AgentSpec(
        name="mix_engineer", role="Mix Engineer",
        goal="Levels, EQ, compression, and stereo placement advice.",
        tools=("level_analysis", "masking_detection")),
    "arranger": AgentSpec(
        name="arranger", role="Arrangement Assistant",
        goal="Piano-roll arrangements, groove, and pattern variation.",
        tools=("pattern_generation", "quantize_advice")),
}


def list_agents() -> list[dict]:
    return [{"name": a.name, "role": a.role, "goal": a.goal, "tools": list(a.tools),
             "status": "registered"} for a in REGISTRY.values()]
