import os

def list_files(directory):
    """Lists all files and directories in the given directory."""
    try:
        with os.scandir(directory) as entries:
            for entry in entries:
                print(f"- {entry.name} {"(Dir)" if entry.is_dir() else "(File)"}")
    except FileNotFoundError:
        print(f"Error: Directory '{directory}' not found.")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    print("File Monitor Utility")
    # For now, let's list files in the current directory
    list_files(".")
