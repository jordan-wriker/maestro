import json
from app.services.parsers import parse_codex_events, parse_claude_events

def test_codex_reproduction():
    # Simulate a codex output where aggregated_output is a list (could happen if upstream changes or weird data)
    # The parser uses item.get("aggregated_output")
    
    raw_event = json.dumps({
        "type": "item.completed",
        "item": {
            "type": "command_execution",
            "command": "ls",
            "aggregated_output": ["list", "of", "strings"], # This should be a string
            "exit_code": 0
        }
    })
    
    events, _ = parse_codex_events(raw_event, "prompt")
    print("Codex Event:", events[1])

def test_claude_reproduction():
    # Simulate claude output where tool result content is structured
    raw_output = json.dumps([
        {
            "type": "user",
            "message": {
                "content": [
                    {
                        "type": "tool_result", 
                        "tool_use_id": "call_1", 
                        "content": {"some": "structured data"} # This should be a string
                    }
                ]
            }
        }
    ])
    
    events, _ = parse_claude_events(raw_output, "prompt")
    # find the tool result or where it was attached
    print("Claude Events:", events)

if __name__ == "__main__":
    print("--- Codex ---")
    try:
        test_codex_reproduction()
    except Exception as e:
        print(e)

    print("\n--- Claude ---")
    try:
        test_claude_reproduction()
    except Exception as e:
        print(e)
