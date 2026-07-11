# Cyvora

Cyvora is an AI Command Center for founder-led operations: a dashboard for turning objectives into companies, departments, teams, agents, tasks, connectors, and outputs.

## What this project does

- captures a business objective from the founder
- previews the generated operating structure before execution
- requires approval before the build or mission can start
- supports a local-only free mode for development and testing
- keeps the UI focused on hierarchy, execution, and control

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

## Free local Codex mode

If you want to use Codex without OpenAI billing on your own machine, run:

```bash
npm run codex:free -- "your prompt here"
```

The first run may download a local model into Ollama. After that, it stays local to your machine.

## Project notes

- The app is designed to run in local, demo, and later production modes.
- The public demo mode is read-only.
- Approval gates are intentionally required before execution.

## Learn more

- [Next.js documentation](https://nextjs.org/docs)
- [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying)

