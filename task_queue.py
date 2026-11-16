#!/usr/bin/env python3
"""
Local file-based task queue implementation.
Tasks are stored as JSON lines in a file.
"""

import json
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any


class FileTaskQueue:
    def __init__(self, queue_file: str = "tasks.json"):
        """
        Initialize the task queue.
        
        Args:
            queue_file: Path to the file storing tasks
        """
        self.queue_file = Path(queue_file)
        self._ensure_queue_file()
    
    def _ensure_queue_file(self):
        """Ensure the queue file exists."""
        if not self.queue_file.exists():
            self.queue_file.parent.mkdir(parents=True, exist_ok=True)
            self.queue_file.write_text("")
    
    def add_task(self, task: Dict[str, Any]) -> str:
        """
        Add a task to the queue.
        
        Args:
            task: Dictionary representing the task
            
        Returns:
            Task ID (timestamp-based)
        """
        # Add metadata
        task_with_meta = {
            "id": f"task_{int(time.time() * 1000)}",
            "created_at": datetime.now().isoformat(),
            "status": "pending",
            **task
        }
        
        # Append to queue file
        with open(self.queue_file, "a") as f:
            f.write(json.dumps(task_with_meta) + "\n")
        
        return task_with_meta["id"]
    
    def get_next_task(self) -> Optional[Dict[str, Any]]:
        """
        Get the next pending task from the queue.
        
        Returns:
            Task dictionary or None if no pending tasks
        """
        if not self.queue_file.exists():
            return None
            
        lines = self.queue_file.read_text().strip().split("\n")
        if not lines or lines == [""]:
            return None
        
        # Find first pending task
        for i, line in enumerate(lines):
            if not line.strip():
                continue
            try:
                task = json.loads(line)
                if task.get("status") == "pending":
                    # Mark as processing
                    task["status"] = "processing"
                    task["processed_at"] = datetime.now().isoformat()
                    # Update the line in file
                    lines[i] = json.dumps(task)
                    self.queue_file.write_text("\n".join(lines))
                    return task
            except json.JSONDecodeError:
                # Skip malformed lines
                continue
        
        return None
    
    def complete_task(self, task_id: str, result: Any = None):
        """
        Mark a task as completed.
        
        Args:
            task_id: ID of the task to complete
            result: Optional result data
        """
        if not self.queue_file.exists():
            return
            
        lines = self.queue_file.read_text().strip().split("\n")
        updated_lines = []
        
        for line in lines:
            if not line.strip():
                updated_lines.append(line)
                continue
            try:
                task = json.loads(line)
                if task.get("id") == task_id:
                    task["status"] = "completed"
                    task["completed_at"] = datetime.now().isoformat()
                    if result is not None:
                        task["result"] = result
                    updated_lines.append(json.dumps(task))
                else:
                    updated_lines.append(line)
            except json.JSONDecodeError:
                updated_lines.append(line)
        
        self.queue_file.write_text("\n".join(updated_lines))
    
    def fail_task(self, task_id: str, error: str):
        """
        Mark a task as failed.
        
        Args:
            task_id: ID of the task to fail
            error: Error message
        """
        if not self.queue_file.exists():
            return
            
        lines = self.queue_file.read_text().strip().split("\n")
        updated_lines = []
        
        for line in lines:
            if not line.strip():
                updated_lines.append(line)
                continue
            try:
                task = json.loads(line)
                if task.get("id") == task_id:
                    task["status"] = "failed"
                    task["failed_at"] = datetime.now().isoformat()
                    task["error"] = error
                    updated_lines.append(json.dumps(task))
                else:
                    updated_lines.append(line)
            except json.JSONDecodeError:
                updated_lines.append(line)
        
        self.queue_file.write_text("\n".join(updated_lines))
    
    def list_tasks(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List tasks, optionally filtered by status.
        
        Args:
            status: Filter by status (pending, processing, completed, failed)
            
        Returns:
            List of task dictionaries
        """
        if not self.queue_file.exists():
            return []
            
        lines = self.queue_file.read_text().strip().split("\n")
        tasks = []
        
        for line in lines:
            if not line.strip():
                continue
            try:
                task = json.loads(line)
                if status is None or task.get("status") == status:
                    tasks.append(task)
            except json.JSONDecodeError:
                continue
        
        return tasks
    
    def clear_completed(self):
        """Remove completed and failed tasks from the queue."""
        if not self.queue_file.exists():
            return
            
        lines = self.queue_file.read_text().strip().split("\n")
        active_lines = []
        
        for line in lines:
            if not line.strip():
                active_lines.append(line)
                continue
            try:
                task = json.loads(line)
                if task.get("status") in ["pending", "processing"]:
                    active_lines.append(line)
            except json.JSONDecodeError:
                active_lines.append(line)
        
        self.queue_file.write_text("\n".join(active_lines))


def demo():
    """Demonstrate the task queue functionality."""
    print("=" * 50)
    print("File Task Queue Demo")
    print("=" * 50)
    
    # Create queue instance
    queue = FileTaskQueue("demo_tasks.json")
    
    # Add some sample tasks
    task1_id = queue.add_task({
        "type": "data_processing",
        "payload": {"input": "sample_data_1", "operation": "clean"}
    })
    
    task2_id = queue.add_task({
        "type": "api_call",
        "payload": {"endpoint": "/users", "method": "GET"}
    })
    
    task3_id = queue.add_task({
        "type": "file_operation",
        "payload": {"action": "read", "path": "/tmp/test.txt"}
    })
    
    print(f"Added tasks: {task1_id}, {task2_id}, {task3_id}")
    
    # List all tasks
    print("\nAll tasks:")
    for task in queue.list_tasks():
        print(f"  [{task['status']}] {task['id']}: {task.get('type', 'unknown')}")
    
    # Process tasks
    print("\nProcessing tasks:")
    while True:
        task = queue.get_next_task()
        if task is None:
            break
        
        print(f"Processing: {task['id']} ({task['type']})")
        # Simulate work
        time.sleep(0.1)
        
        # Complete the task
        queue.complete_task(task["id"], {"result": "success"})
        print(f"  Completed: {task['id']}")
    
    # List tasks after processing
    print("\nTasks after processing:")
    for task in queue.list_tasks():
        print(f"  [{task['status']}] {task['id']}: {task.get('type', 'unknown')}")
    
    # Clear completed tasks
    queue.clear_completed()
    print("\nAfter clearing completed tasks:")
    for task in queue.list_tasks():
        print(f"  [{task['status']}] {task['id']}: {task.get('type', 'unknown')}")
    
    print("\nDemo completed!")


if __name__ == "__main__":
    demo()