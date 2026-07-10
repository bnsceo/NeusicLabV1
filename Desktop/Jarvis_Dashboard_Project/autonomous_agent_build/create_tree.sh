#!/bin/bash
BASE_DIR="$(pwd)"
mkdir -p "${BASE_DIR}/backend/app/agents/library"/{engineering,design,sales,marketing,product,project-management,testing,paid-media,specialized}
mkdir -p "${BASE_DIR}/backend/app/agents/custom"
mkdir -p "${BASE_DIR}/backend/app/agents/orchestrator"
mkdir -p "${BASE_DIR}/.claude/agents"
mkdir -p "${BASE_DIR}/dashboard"
mkdir -p "${BASE_DIR}/scripts"
echo "✅ Tree created in $BASE_DIR"
