"""
CLI interface to Hermes.
Phase 0: text commands only.
Commands: objective, status, approve, reject, research, companies.
"""

import sys
from hermes import Hermes
from schema import init_db


def print_banner():
    """Print the startup banner."""
    print("""
╔════════════════════════════════════════════════════════════════╗
║                    HERMES COMMAND CENTER                       ║
║              Autonomous AI Holding Company v0.1                ║
╚════════════════════════════════════════════════════════════════╝

Type 'help' for commands.
""")


def print_help():
    """Print available commands."""
    help_text = """
Commands:
  objective <text>      Set a business objective for Hermes to propose
  approve [budget]      Approve the pending company proposal (default: $500)
  reject                Reject the pending company proposal
  status                Show the operating picture
  research <company_id> Trigger research cycle for a company
  companies             List all companies and their status
  help                  Show this message
  exit                  Quit

Examples:
  objective Find me an underpriced SaaS niche in project management
  approve 1000
  research ecommerce-v1
    """
    print(help_text)


def parse_command(line: str) -> tuple[str, str]:
    """Parse a command line into (command, args)."""
    parts = line.strip().split(maxsplit=1)
    if not parts:
        return "", ""
    command = parts[0].lower()
    args = parts[1] if len(parts) > 1 else ""
    return command, args


def main():
    """Main CLI loop."""
    init_db()
    hermes = Hermes()
    
    print_banner()
    print(hermes.status())

    while True:
        try:
            user_input = input("\n> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n[Hermes] Shutting down.")
            sys.exit(0)

        if not user_input:
            continue

        command, args = parse_command(user_input)

        if command == "help":
            print_help()

        elif command == "exit":
            print("[Hermes] Shutting down.")
            sys.exit(0)

        elif command == "objective":
            if not args:
                print("[Hermes] Usage: objective <business objective>")
            else:
                print(hermes.propose_company(args))

        elif command == "approve":
            budget = 500.0
            if args:
                try:
                    budget = float(args)
                except ValueError:
                    print("[Hermes] Budget must be a number.")
                    continue
            print(hermes.approve_company(budget=budget))

        elif command == "reject":
            print(hermes.reject_company())

        elif command == "status":
            print(hermes.status())

        elif command == "research":
            if not args:
                print("[Hermes] Usage: research <company_id>")
            else:
                print(hermes.run_research(args))

        elif command == "companies":
            db = hermes.db
            c = db.cursor()
            c.execute("SELECT id, name, stage, (SELECT COUNT(*) FROM departments WHERE company_id = companies.id) as dept_count FROM companies")
            rows = c.fetchall()
            if not rows:
                print("[Hermes] No companies yet.")
            else:
                print("\n[Hermes] Companies:")
                for row in rows:
                    print(f"  {row['id']:8} | {row['name']:30} | stage: {row['stage']:10} | depts: {row['dept_count']}")

        else:
            print(f"[Hermes] Unknown command: {command}. Type 'help' for options.")


if __name__ == "__main__":
    main()
