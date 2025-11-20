#!/bin/bash

# Setup script to create required workflows for the frontend app
# Run this after starting your backend

BACKEND_URL="${BACKEND_URL:-http://localhost:3000}"

echo "Creating conversation workflow..."

# Create conversation workflow
curl -X POST "${BACKEND_URL}/workflows" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Conversation Workflow",
    "version": "1.0.0",
    "type": "linear",
    "definition": {
      "entryNode": "conversation_agent",
      "nodes": [
        {
          "id": "conversation_agent",
          "type": "agent",
          "config": {
            "agent_id": "agent.conversational"
          }
        }
      ],
      "edges": []
    }
  }' | jq -r '.id' > /tmp/conversation_workflow_id.txt

CONVERSATION_WORKFLOW_ID=$(cat /tmp/conversation_workflow_id.txt)
echo "Conversation workflow created: ${CONVERSATION_WORKFLOW_ID}"

echo ""
echo "Creating code agent workflow..."

# Create code agent workflow
curl -X POST "${BACKEND_URL}/workflows" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Code Agent Workflow",
    "version": "1.0.0",
    "type": "linear",
    "definition": {
      "entryNode": "code_agent",
      "nodes": [
        {
          "id": "code_agent",
          "type": "agent",
          "config": {
            "agent_id": "agent.code_assistant"
          }
        }
      ],
      "edges": []
    }
  }' | jq -r '.id' > /tmp/code_agent_workflow_id.txt

CODE_AGENT_WORKFLOW_ID=$(cat /tmp/code_agent_workflow_id.txt)
echo "Code agent workflow created: ${CODE_AGENT_WORKFLOW_ID}"

echo ""
echo "Updating frontend manifest with workflow IDs..."
echo "Update frontend-app-manifest.json:"
echo "  - conversation_flow.workflow_ref: ${CONVERSATION_WORKFLOW_ID}"
echo "  - code_agent_flow.workflow_ref: ${CODE_AGENT_WORKFLOW_ID}"

echo ""
echo "Creating conversational agent..."

# Create conversational agent with natural language DB tools
curl -X POST "${BACKEND_URL}/agents" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "agent.conversational",
    "name": "Conversational Agent",
    "instructions": "You are a helpful assistant that can read and write to the database using natural language. When users ask questions about data, use the natural_language_db_read tool. When users want to modify data, use natural_language_db_write tool with dry-run mode first.",
    "model_profile": {
      "provider": "openai",
      "model": "gpt-4o-mini",
      "temperature": 0.7
    },
    "allowed_tools": [
      "natural_language_db_read",
      "natural_language_db_write"
    ]
  }'

echo ""
echo ""
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update frontend-app-manifest.json with the workflow IDs above"
echo "2. Import the app: curl -X POST ${BACKEND_URL}/apps/import -H 'Content-Type: application/json' -d @frontend-app-manifest.json"

