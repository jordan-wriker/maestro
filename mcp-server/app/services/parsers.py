import json
from typing import List, Dict, Any, Optional

TRUNCATION_LIMIT = 500
MAX_TOOL_RESULT_LENGTH = 500

def parse_claude_events(raw_output: str, prompt: str) -> List[Dict[str, Any]]:
    """
    Parse Claude JSON output into normalized events.
    
    Args:
        raw_output: The raw JSON string output from Claude CLI.
        prompt: The original prompt sent to the agent.
        
    Returns:
        List of event dictionaries with keys: type, content, subtype, etc.
        Event types: prompt, system, response, tool_call, tool_result, result, error.
    """
    events: List[Dict[str, Any]] = []
    tool_calls_by_id: Dict[str, Dict[str, Any]] = {}
    events.append({"type": "prompt", "content": prompt})

    try:
        # Handle case where output might be empty or whitespace (e.g. crash)
        if not raw_output.strip():
             return events

        data = json.loads(raw_output)
        if not isinstance(data, list): data = [data]
        
        final_result = None
        for item in data:
            if isinstance(item, dict) and item.get("type") == "result":
                final_result = item.get("result", "")
                break

        for item in data:
            if not isinstance(item, dict): continue
            item_type = item.get("type")

            if item_type == "system" and item.get("subtype") == "init":
                events.append({"type": "system", "content": f"Session initialized (model: {item.get('model', 'unknown')})"})
            elif item_type == "assistant":
                message = item.get("message", {})
                content_list = message.get("content", [])
                for content in content_list:
                    if content.get("type") == "text":
                        text = content.get("text", "")
                        if text and text == final_result: continue
                        events.append({"type": "response", "content": text})
                    elif content.get("type") == "tool_use":
                        tool_id = content.get("id")
                        tool_event = {"type": "tool_call", "tool": content.get("name", "unknown"), "content": json.dumps(content.get("input", {}), indent=2)}
                        events.append(tool_event)
                        if tool_id: tool_calls_by_id[tool_id] = tool_event
            elif item_type == "user":
                message = item.get("message", {})
                content_list = message.get("content", [])
                for content in content_list:
                    if content.get("type") == "tool_result":
                        tool_use_id = content.get("tool_use_id")
                        result_content = content.get("content", "")
                        if len(result_content) > MAX_TOOL_RESULT_LENGTH: 
                            result_content = result_content[:MAX_TOOL_RESULT_LENGTH] + "\n... (truncated)"
                        if tool_use_id and tool_use_id in tool_calls_by_id:
                            tool_calls_by_id[tool_use_id]["output"] = result_content
                        else:
                            events.append({"type": "tool_result", "content": result_content})
            elif item_type == "result":
                events.append({"type": "result", "subtype": item.get("subtype", "unknown"), "content": item.get("result", "")})
                
    except json.JSONDecodeError as e:
        events.append({"type": "error", "content": f"Failed to parse Claude output: {str(e)}"})
    except Exception as e:
        events.append({"type": "error", "content": f"Unexpected error parsing Claude output: {str(e)}"})
        
    return events

def parse_codex_events(raw_output: str, prompt: str) -> List[Dict[str, Any]]:
    """
    Parse Codex NDJSON output into normalized events.
    
    Args:
        raw_output: The raw NDJSON string output from Codex CLI.
        prompt: The original prompt sent to the agent.
        
    Returns:
        List of event dictionaries with keys: type, content, subtype, etc.
        Event types: prompt, system, reasoning, tool_call, response, result.
    """
    events: List[Dict[str, Any]] = []
    events.append({"type": "prompt", "content": prompt})

    if not raw_output.strip():
        return events

    for line_num, line in enumerate(raw_output.splitlines(), 1):
        if not line.strip(): continue
        try:
            event = json.loads(line)
            event_type = event.get("type")
            if event_type == "thread.started":
                events.append({"type": "system", "content": f"Thread started: {event.get('thread_id', 'unknown')}"})
            elif event_type == "item.completed":
                item = event.get("item", {})
                item_type = item.get("type")
                if item_type == "reasoning":
                    events.append({"type": "reasoning", "content": item.get("text", "")})
                elif item_type == "command_execution":
                    cmd = item.get("command", "")
                    output = item.get("aggregated_output", "")
                    # Apply truncation limit
                    if len(output) > TRUNCATION_LIMIT: 
                        output = output[:TRUNCATION_LIMIT] + "\n... (truncated)"
                        
                    events.append({
                        "type": "tool_call", 
                        "tool": "bash", 
                        "content": cmd, 
                        "output": output, 
                        "exit_code": item.get("exit_code")
                    })
                elif item_type == "agent_message":
                    events.append({"type": "response", "content": item.get("text", "")})
        except json.JSONDecodeError:
            # Skip malformed NDJSON lines safely, but we could log if we had a logger here.
            # Since this is a pure function, we just ignore.
            continue
    
    # Mark the last response as a result (for proper green styling)
    for i in range(len(events) - 1, -1, -1):
        if events[i].get("type") == "response":
            events[i]["type"] = "result"
            break
    
    return events
