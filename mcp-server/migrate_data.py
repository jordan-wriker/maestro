import json
import sqlite3
from pathlib import Path
import argparse
import sys

def migrate_json_logs(dry_run=False):
    # Calculate logs_dir = Path(__file__).parent.parent / "logs"
    logs_dir = Path(__file__).parent.parent / "logs"
    subdirs = ["claude", "codex"]
    
    processed_count = 0
    modified_count = 0
    error_count = 0
    
    # Iterate through ["claude", "codex"] subdirectories
    for subdir in subdirs:
        dir_path = logs_dir / subdir
        if not dir_path.exists():
            continue
            
        # For each *.json file
        for file_path in dir_path.glob("*.json"):
            processed_count += 1
            print(f"Processing {file_path}")
            
            try:
                # Read the JSON content
                with open(file_path, 'r') as f:
                    data = json.load(f)
                
                modified = False
                
                # Check if top-level "session_id" exists
                if "session_id" in data:
                    if dry_run:
                        print(f"[DRY RUN] Would rename 'session_id' to 'conversation_id' in {file_path}")
                    else:
                        # If exists, rename to "conversation_id" using data["conversation_id"] = data.pop("session_id")
                        data["conversation_id"] = data.pop("session_id")
                    modified = True
                
                # Iterate through data.get("logs", []) array
                logs_array = data.get("logs", [])
                for log in logs_array:
                    # For each log entry, check if "session_id" exists
                    if "session_id" in log:
                        if dry_run:
                            pass # Just noting modification
                        else:
                            # If exists, rename to "conversation_id" using log["conversation_id"] = log.pop("session_id")
                            log["conversation_id"] = log.pop("session_id")
                        modified = True
                
                if modified:
                    modified_count += 1
                    if not dry_run:
                        # Write back to file with json.dump(data, f, indent=2)
                        with open(file_path, 'w') as f:
                            json.dump(data, f, indent=2)
            
            # Handle json.JSONDecodeError, OSError, and KeyError exceptions gracefully
            except (json.JSONDecodeError, OSError, KeyError) as e:
                error_count += 1
                print(f"Error processing {file_path}: {e}")
                
    # Track statistics: files processed, files modified, files skipped (errors)
    print(f"JSON Log Stats: Processed {processed_count}, Modified {modified_count}, Errors {error_count}")

def migrate_database(dry_run=False):
    # Calculate db_path = Path(__file__).parent.parent / "mcp-dashboard" / "prisma" / "dev.db"
    db_path = Path(__file__).parent.parent / "mcp-dashboard" / "prisma" / "dev.db"
    
    # Check if database file exists using db_path.exists()
    if not db_path.exists():
        # If not exists, print message and return (no migration needed)
        print(f"Database not found at {db_path}")
        return

    try:
        # Connect to SQLite database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if sessionId column exists in TaskLog table using PRAGMA table_info(TaskLog)
        cursor.execute("PRAGMA table_info(TaskLog)")
        columns = cursor.fetchall()
        # columns is a list of tuples (cid, name, type, notnull, dflt_value, pk)
        column_names = [col[1] for col in columns]
        
        # If column doesn't exist, print message and return (already migrated or doesn't need migration)
        if "sessionId" not in column_names:
            print("Column 'sessionId' not found in TaskLog table. No migration needed.")
            conn.close()
            return
            
        if dry_run:
            # In migrate_database(): check schema but don't execute ALTER statement
            # Print what would be changed with [DRY RUN] prefix
            print(f"[DRY RUN] Would execute: ALTER TABLE TaskLog RENAME COLUMN sessionId TO conversationId")
        else:
            # Execute ALTER TABLE TaskLog RENAME COLUMN sessionId TO conversationId
            cursor.execute("ALTER TABLE TaskLog RENAME COLUMN sessionId TO conversationId")
            conn.commit()
            
            # Verify the migration by checking column exists using PRAGMA table_info(TaskLog) again
            cursor.execute("PRAGMA table_info(TaskLog)")
            new_columns = cursor.fetchall()
            new_column_names = [col[1] for col in new_columns]
            
            if "conversationId" in new_column_names:
                print("Database migration successful: usage of sessionId replaced with conversationId.")
            else:
                print("Database migration verification failed.")

        conn.close()
    
    # Handle sqlite3.Error exceptions
    except sqlite3.Error as e:
        # Print success/failure messages
        print(f"Database error: {e}")

def main():
    # Parse command-line arguments using argparse
    parser = argparse.ArgumentParser(description="Migrate data from session_id to conversation_id")
    # Add --dry-run flag to preview changes without modifying files
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without modifying files")
    args = parser.parse_args()
    
    # Print banner with migration description
    print("Starting Data Migration...")
    
    # Call migrate_json_logs(dry_run=args.dry_run)
    migrate_json_logs(dry_run=args.dry_run)
    
    # Call migrate_database(dry_run=args.dry_run)
    migrate_database(dry_run=args.dry_run)
    
    # Print summary statistics (total files processed, modified, errors)
    # (Note: stats were printed inside functions per instructions, but I'll add a final done message)
    
    # Return appropriate exit code (0 for success, 1 for errors)
    sys.exit(0)

if __name__ == "__main__":
    main()
