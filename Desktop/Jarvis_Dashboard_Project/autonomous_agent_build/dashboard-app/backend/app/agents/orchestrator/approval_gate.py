#!/usr/bin/env python3
"""
Approval Gate – Interactive CLI for reviewing and approving/rejecting briefings.
"""

import os
import sys
import subprocess
import json

BRIEFINGS_DIR = "."

def list_briefings():
    """Find all .md briefings."""
    import glob
    return glob.glob(os.path.join(BRIEFINGS_DIR, "*briefing*.md"))

def view_briefing(path):
    """Display the briefing content."""
    with open(path, 'r') as f:
        print(f.read())

def approve(path):
    """Simulate deployment – here you could trigger a CI/CD pipeline."""
    print(f"✅ DECREE granted for {path}. Deploying...")
    # Example: git add/commit/push or run a deployment script
    # subprocess.run(["git", "add", path])
    # subprocess.run(["git", "commit", "-m", f"Approved: {path}"])
    # subprocess.run(["git", "push"])
    print("🚀 Deployment initiated.")

def abandon(path):
    print(f"❌ ABANDONED {path}. No action taken.")

def main():
    briefings = list_briefings()
    if not briefings:
        print("No pending briefings found.")
        return
    print("Pending Mission/Repair Briefings:")
    for i, b in enumerate(briefings, 1):
        print(f"{i}. {os.path.basename(b)}")
    choice = input("Select a briefing number to review (or q to quit): ")
    if choice.lower() == 'q':
        return
    try:
        idx = int(choice) - 1
        path = briefings[idx]
        view_briefing(path)
        action = input("Enter 'd' to DECREE, 'a' to ABANDON, or 's' to skip: ").lower()
        if action == 'd':
            approve(path)
        elif action == 'a':
            abandon(path)
        else:
            print("Skipped.")
    except (ValueError, IndexError):
        print("Invalid selection.")

if __name__ == "__main__":
    main()
